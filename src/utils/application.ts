/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ISignaler, SignalListener } from "@fluid-experimental/data-objects";
import { IAzureAudience } from "@fluidframework/azure-client";
import { Shape, Shapes } from "../schema/app_schema.js";
import { FeltShape, createShapeNode } from "./shapes.js";
import { Color, getNextColor, getNextShape, getRandomInt, ShapeType } from "./utils.js";
import { Container, FederatedPointerEvent, Application as PIXIApplication } from "pixi.js";
import { ConnectionState, IFluidContainer, Tree, TreeView } from "fluid-framework";
import { Signal2Pixi, SignalPackage, Signals } from "./wrappers.js";
import { createUndoRedoStacks, UndoRedo } from "./undo.js";
import { SelectionManager } from "./presence_helpers.js";

export class FeltApplication {
	readonly undoRedo: UndoRedo;
	// private _selectedShapes: Array<FeltShape> = [];

	private constructor(
		public pixiApp: PIXIApplication,
		public selection: SelectionManager,
		public audience: IAzureAudience,
		public useSignals: boolean,
		public signaler: ISignaler,
		public shapeTree: TreeView<typeof Shapes>,
		public container: IFluidContainer,
		public maxShapes: number = 10000,
	) {
		// Initialize the canvas container
		this._canvas = FeltApplication.createCanvasContainer(pixiApp, () => {
			this.selection.updateSelection([]);
		});

		// Get all existing shapes
		this.updateAllShapes();

		// Show the selection and presence of the shapes
		this.updateLocalSelectionAndPresence();

		// event handler for detecting remote changes to Fluid data and updating
		// the local data
		Tree.on(shapeTree.root, "nodeChanged", () => {
			this.updateAllShapes();
		});

		// event handler for detecting changes to the selection data and updating
		// the local selection and presence
		this.selection.addEventListener("selectionChanged", () => {
			this.updateLocalSelectionAndPresence();
		});

		// When shapes are dragged, instead of updating the Fluid data, we send a Signal using fluid. This function will
		// handle the signal we send and update the local state accordingly.
		const signalHandler: SignalListener<SignalPackage> = (
			clientId: string,
			local: boolean,
			payload: SignalPackage,
		) => {
			if (!local) {
				const localShape = this.canvas.getChildByLabel(payload.id) as FeltShape | undefined;
				if (localShape) {
					Signal2Pixi(localShape, payload);
				}
			}
		};

		signaler.onSignal(Signals.ON_DRAG, signalHandler);

		this.undoRedo = createUndoRedoStacks(shapeTree.events);
	}

	public static async build(
		shapeTree: TreeView<typeof Shapes>,
		container: IFluidContainer,
		audience: IAzureAudience,
		signaler: ISignaler,
		selection: SelectionManager,
	): Promise<FeltApplication> {
		// create PIXI app
		const pixiApp = await this.createPixiApp();

		return new FeltApplication(
			pixiApp,
			selection,
			audience,
			true,
			signaler,
			shapeTree,
			container,
		);
	}

	private static async createPixiApp() {
		const pixiApp = await FeltApplication.initPixiApp();
		pixiApp.stage.sortableChildren = true;
		pixiApp.stage.removeChildren();
		return pixiApp;
	}

	// initialize the PIXI app
	private static async initPixiApp() {
		// The PixiJS application instance
		const app = new PIXIApplication();

		await app.init({
			width: 600,
			height: 600,
			autoDensity: true, // Handles high DPI screens
			backgroundColor: 0x000000,
		});

		return app;
	}

	// Create a new scaled container
	private static createCanvasContainer = (
		app: PIXIApplication,
		clearSelectionAndPresence: (event: FederatedPointerEvent) => void,
	) => {
		// This is the stage for the new scene
		const canvasContainer = new Container();

		// Set the size of the container to the size of the stage
		canvasContainer.width = app.canvas.width;
		canvasContainer.height = app.canvas.height;
		canvasContainer.position.set(app.stage.x, app.stage.y);
		canvasContainer.boundsArea = app.screen;

		canvasContainer.interactive = true;
		canvasContainer.interactiveChildren = true;

		canvasContainer.sortableChildren = true;
		canvasContainer.label = "canvas";

		canvasContainer.eventMode = "static";
		canvasContainer.hitArea = canvasContainer.boundsArea;

		canvasContainer.on("pointerup", (event) => {
			if (event.target.label === "canvas") {
				clearSelectionAndPresence(event);
			}
		});

		app.stage.addChild(canvasContainer);
		return canvasContainer;
	};

	private _canvas: Container;

	public get canvas(): Container {
		return this._canvas;
	}

	public get fluidConnectionState(): ConnectionState {
		return this.container.connectionState;
	}

	private _showIndex = false;

	public set showIndex(value: boolean) {
		this._showIndex = value;
		this.canvas.children.forEach((child) => {
			if (child instanceof FeltShape) {
				child.showIndex = this._showIndex;
			}
		});
	}

	public get showIndex(): boolean {
		return this._showIndex;
	}

	// Creates a new FeltShape object which is the local object that represents
	// all shapes on the canvas
	public addNewLocalShape = (shape: Shape): FeltShape => {
		const feltShape = new FeltShape(
			this.canvas,
			shape,
			(shape: FeltShape) => {
				this.selection.updateSelection(shape.id);
			},
			(shape: FeltShape) => {
				this.selection.addItemToSelection(shape.id);
			},
			this.audience,
			() => {
				return this.useSignals;
			},
			this.showIndex,
			this.signaler,
		);

		return feltShape;
	};

	// Return a bool indicating if the max number of shapes has been reached
	public get maxReached(): boolean {
		return this.shapeTree.root.length >= this.maxShapes;
	}

	// function passed into React UX for creating shapes
	public createShape = (shapeType: ShapeType, color: Color): void => {
		if (this.maxReached) return;

		const shape = createShapeNode(
			shapeType,
			color,
			getRandomInt(FeltShape.size, this.pixiApp.screen.width - FeltShape.size),
			getRandomInt(FeltShape.size, this.pixiApp.screen.height - FeltShape.size),
		);

		this.shapeTree.root.insertAtEnd(shape);
	};

	// function passed into React UX for creating lots of different shapes at once
	public createLotsOfShapes = (amount: number): void => {
		if (this.maxReached) return;
		Tree.runTransaction(this.shapeTree.root, () => {
			let shapeType = ShapeType.Circle;
			let color = Color.Red;
			const shapes = [];

			for (let index = 0; index < amount; index++) {
				shapeType = getNextShape(shapeType);
				color = getNextColor(color);

				if (this.shapeTree.root.length + shapes.length < this.maxShapes) {
					const shape = createShapeNode(
						shapeType,
						color,
						getRandomInt(FeltShape.size, this.pixiApp.screen.width - FeltShape.size),
						getRandomInt(FeltShape.size, this.pixiApp.screen.height - FeltShape.size),
					);
					shapes.push(shape);
				}
			}

			this.shapeTree.root.insertAtEnd(...shapes);
		});
	};

	// Changes the color of a shape and syncs with the Fluid data
	public changeColor = (shape: FeltShape, color: Color): void => {
		shape.color = color;
	};

	// A function that iterates over all selected shapes and calls the passed function
	// for each shape
	private changeSelectedShapes = (f: (shape: FeltShape) => void): void => {
		if (this.selection.getLocalSelected().length === 0) return;
		Tree.runTransaction(this.shapeTree.root, () => {
			for (const id of this.selection.getLocalSelected()) {
				const localShape = this.canvas.getChildByLabel(id) as FeltShape | undefined;
				if (localShape !== undefined && localShape !== null) {
					f(localShape);
				}
			}
		});
	};

	// A function that calls the passed function for a single selected shape
	private changeSingleSelectedShape = (f: (shape: FeltShape) => void): void => {
		if (this.selection.getLocalSelected().length === 0) return;
		Tree.runTransaction(this.shapeTree.root, () => {
			const id = this.selection.getLocalSelected()[0];
			const localShape = this.canvas.getChildByLabel(id) as FeltShape | undefined;
			if (localShape !== undefined && localShape !== null) {
				f(localShape);
			}
		});
	};

	private organizeSelectedShapesIntoRanges = (): Array<Array<FeltShape>> => {
		const ranges: Array<Array<FeltShape>> = [];

		if (this.selection.getLocalSelected().length === 0) return ranges;

		const selected = Array.from(this.selection.getLocalSelected())
			.map((id) => this.canvas.getChildByLabel(id) as FeltShape)
			.sort((a, b) => a.zIndex - b.zIndex);

		let range: Array<FeltShape> = [];
		let last = -1;

		for (const shape of selected) {
			if (last === -1) {
				range.push(shape);
			} else if (last + 1 === shape.zIndex) {
				range.push(shape);
			} else {
				ranges.push(range);
				range = [shape];
			}
			last = shape.zIndex;
		}

		ranges.push(range);

		return ranges;
	};

	// Function passed to React to change the color of selected shapes
	public changeColorofSelected = (color: Color): void => {
		this.changeSelectedShapes((shape: FeltShape) => this.changeColor(shape, color));
	};

	// Function passed to React to delete selected shapes
	public deleteSelectedShapes = (): void => {
		// If no shapes are selected, return
		if (this.selection.getLocalSelected().length === 0) return;

		// If multiple shapes are selected, organize them into ranges
		// and delete them in ranges
		const ranges = this.organizeSelectedShapesIntoRanges();
		Tree.runTransaction(this.shapeTree.root, () => {
			for (const range of ranges) {
				const start = range[0].zIndex;
				const end = range[range.length - 1].zIndex + 1;
				this.deleteRangeOfShapes(start, end);
			}
		});
	};

	public bringSelectedToFront = (): void => {
		this.changeSingleSelectedShape((shape: FeltShape) => this.bringToFront(shape));
	};

	public sendSelectedToBack = (): void => {
		this.changeSingleSelectedShape((shape: FeltShape) => this.sendToBack(shape));
	};

	public sendSelectedBackward = (): void => {
		this.changeSingleSelectedShape((shape: FeltShape) => this.sendBackward(shape));
	};

	public bringSelectedForward = (): void => {
		this.changeSingleSelectedShape((shape: FeltShape) => this.bringForward(shape));
	};

	public deleteAllShapes = (): void => {
		this.deleteRangeOfShapes(0, this.shapeTree.root.length);
	};

	public deleteRangeOfShapes = (start: number, end: number): void => {
		// Test to see if the range is valid
		if (start >= end) return;

		// Remove the shapes from the SharedTree
		this.shapeTree.root.removeRange(start, end);

		// clear the selection for the current client
		this.selection.updateSelection([]);
	};

	// Called when a shape is deleted in the Fluid Data
	public deleteLocalShape = (shape: FeltShape): void => {
		// Remove the shape from the canvas
		this.canvas.removeChild(shape);

		// Destroy the local shape object
		// Except don't do this because it causes a crash
		// shape.destroy();
	};

	private bringToFront = (shape: FeltShape): void => {
		shape.bringToFront();
	};

	private sendToBack = (shape: FeltShape): void => {
		shape.sendToBack();
	};

	private sendBackward = (shape: FeltShape): void => {
		shape.sendBackward();
	};

	private bringForward = (shape: FeltShape): void => {
		shape.bringForward();
	};

	public selectAllShapes = (): void => {
		// Add all the shape ids to an array
		const shapeIds = this.shapeTree.root.map((shape) => shape.id as string);

		// Add all shapes to the selection for the current client
		this.selection.updateSelection(shapeIds);
	};

	public setFluidSelection = (shape: FeltShape): void => {
		this.selection.toggleSelection(shape.id);
	};

	// Clear the Fluid selection for a specific shape
	public clearFluidSelectionForShape = (shape: FeltShape): void => {
		this.selection.removeItemFromSelection(shape.id);
	};

	public clearLocalSelectionAndPresence = (): void => {
		// iterate over the items in the canvas and remove the selection
		for (const child of this.canvas.children) {
			if (child instanceof FeltShape) {
				child.removeSelection();
				child.removePresence();
			}
		}
	};

	public updateLocalSelectionAndPresence = (): void => {
		this.clearLocalSelectionAndPresence();

		for (const id of this.selection.getLocalSelected()) {
			const localShape = this.canvas.getChildByLabel(id) as FeltShape | undefined;
			if (localShape !== undefined && localShape !== null) {
				localShape.showSelection();
			}
		}

		for (const id of this.selection.getRemoteSelected().keys()) {
			const localShape = this.canvas.getChildByLabel(id) as FeltShape | undefined;
			if (localShape !== undefined && localShape !== null) {
				localShape.showPresence();
			}
		}
	};

	public updateAllShapes = () => {
		const seenIds = new Set<string>();
		for (const shape of this.shapeTree.root) {
			seenIds.add(shape.id as string);
			let localShape = this.canvas.getChildByLabel(shape.id as string);
			if (localShape === undefined || localShape === null) {
				localShape = this.addNewLocalShape(shape);
			} else {
				(localShape as FeltShape).update();
			}
		}

		// create an array of the shapes that need to be deleted
		const shapesToDelete = this.canvas.children.filter((child) => !seenIds.has(child.label));
		if (shapesToDelete.length === 0) return;

		// iterate over the array and delete the shapes
		for (const child of shapesToDelete) {
			this.deleteLocalShape(child as FeltShape);
		}
	};
}
