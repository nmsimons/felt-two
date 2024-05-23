/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Signaler, SignalListener } from "@fluid-experimental/data-objects";
import { IAzureAudience } from "@fluidframework/azure-client";
import { v4 as uuid } from "uuid";
import { Shape, Shapes } from "../schema/app_schema.js";
import { FeltShape, createShapeNode } from "./shapes.js";
import { Color, getNextColor, getNextShape, getRandomInt, ShapeType } from "./utils.js";
import { Container, FederatedPointerEvent, Application as PIXIApplication } from "pixi.js";
import { ConnectionState, IFluidContainer, Tree, TreeView } from "fluid-framework";
import { Signal2Pixi, SignalPackage, Signals } from "./wrappers.js";
import { Client, Session } from "../schema/session_schema.js";

export class FeltApplication {
	private constructor(
		public pixiApp: PIXIApplication,
		public selection: TreeView<typeof Session>,
		public audience: IAzureAudience,
		public useSignals: boolean,
		public signaler: Signaler,
		public shapeTree: TreeView<typeof Shapes>,
		public container: IFluidContainer,
		public maxShapes: number = 1000,
	) {
		// Initialize the canvas container
		this._canvas = FeltApplication.createCanvasContainer(pixiApp, () => {
			this.clearFluidSelection();
		});

		// Get all existing shapes
		this.updateAllShapes();

		// Show the selection and presence of the shapes
		this.updateLocalSelectionAndPresence();

		let _canvasIsDirty = false;

		// event handler for detecting remote changes to Fluid data and updating
		// the local data
		Tree.on(shapeTree.root, "nodeChanged", () => {
			_canvasIsDirty = true;
		});

		// event handler that runs after a batch of changes is complete
		// only used to iterate over the shapes if the canvas is dirty
		// and isn't used to update individual shapes
		this.shapeTree.events.on("afterBatch", () => {
			if (_canvasIsDirty) {
				_canvasIsDirty = false;
				this.updateAllShapes();
			}
		});

		// event handler for detecting changes to the selection data and updating
		Tree.on(selection.root, "treeChanged", () => {
			this.updateLocalSelectionAndPresence();
		});

		// When a user leaves the session, remove all that users presence data from
		// the presence shared map. Note, all clients run this code right now
		audience.on("membersChanged", () => {
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
	}

	public static async build(
		shapeTree: TreeView<typeof Shapes>,
		container: IFluidContainer,
		audience: IAzureAudience,
		signaler: Signaler,
		selection: TreeView<typeof Session>,
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

	// function to toggle the signals flag
	public toggleSignals = (): void => {
		this.useSignals = !this.useSignals;
	};

	public getUseSignals = (): boolean => {
		return this.useSignals;
	};

	// Creates a new FeltShape object which is the local object that represents
	// all shapes on the canvas
	public addNewLocalShape = (shape: Shape): FeltShape => {
		const feltShape = new FeltShape(
			this.canvas,
			shape,
			(shape: FeltShape) => {
				this.clearFluidSelection();
				this.setFluidSelection(shape);
			},
			(shape: FeltShape) => {
				this.setFluidSelection(shape);
			},
			this.audience,
			this.getUseSignals,
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
			uuid(),
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
						uuid(),
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
		if (shape instanceof FeltShape) shape.color = color;
	};

	// A function that iterates over all selected shapes and calls the passed function
	// for each shape
	public changeSelectedShapes = (f: Function): void => {
		Tree.runTransaction(this.shapeTree.root, () => {
			// Find the client object for the current client from the selection tree by clientId
			const client = this.getSelectionClient();

			if (client.selected.length === 0) return;

			// create a copy of the client.selected array
			const selected = [...client.selected];

			for (const id of selected) {
				// Find the local shape object by id in the canvas
				const shape = this.canvas.getChildByLabel(id) as FeltShape | undefined;
				if (shape instanceof FeltShape) {
					f(shape);
				}
			}
		});
	};

	// A function that calls the passed function for a single selected shape
	public changeSingleSelectedShape = (f: Function): void => {
		Tree.runTransaction(this.shapeTree.root, () => {
			// Find the client object for the current client from the selection tree by clientId
			const client = this.getSelectionClient();

			if (client.selected.length === 0) return;

			// Find the local shape object by id in the canvas
			const shape = this.canvas.getChildByLabel(client.selected[0]) as FeltShape | undefined;
			if (shape instanceof FeltShape) {
				f(shape);
			}
		});
	};

	// Function passed to React to change the color of selected shapes
	public changeColorofSelected = (color: Color): void => {
		this.changeSelectedShapes((shape: FeltShape) => this.changeColor(shape, color));
	};

	// Function passed to React to delete selected shapes
	public deleteSelectedShapes = (): void => {
		this.changeSingleSelectedShape((shape: FeltShape) => this.deleteShape(shape));
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
		this.shapeTree.root.removeRange();
	};

	private deleteShape = (shape: FeltShape): void => {
		const i = Tree.key(shape.shape);
		this.shapeTree.root.removeAt(i as number);
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

	public getSelectionClient = (): Client => {
		let client = this.selection.root.clients.find(
			(client) => client.clientId === this.audience.getMyself()?.id,
		);

		if (client === undefined || client === null) {
			client = new Client({
				clientId: this.audience.getMyself()?.id!,
				selected: [],
			});
			this.selection.root.clients.insertAtEnd(client);
		}

		return client;
	};

	public selectAllShapes = (): void => {
		const client = this.getSelectionClient();

		Tree.runTransaction(this.selection.root, () => {
			// Clear the selection for the current client
			this.clearFluidSelection();

			// Add all the shape ids to an array
			const shapeIds = this.shapeTree.root.map((shape) => shape.id);

			// Add all shapes to the selection for the current client
			client.selected.insertAtEnd(...shapeIds);
		});
	};

	public setFluidSelection = (shape: FeltShape): void => {
		const client = this.getSelectionClient();

		if (!client.selected.includes(shape.id)) {
			client.selected.insertAtEnd(shape.id);
		}
	};

	public clearFluidSelection = (): void => {
		const client = this.selection.root.clients.find(
			(client) => client.clientId === this.audience.getMyself()?.id,
		);

		if (client !== undefined) {
			client.selected.removeRange();
		}
	};

	// Clear the Fluid selection for a specific shape
	public clearFluidSelectionForShape = (shape: FeltShape): void => {
		const client = this.selection.root.clients.find(
			(client) => client.clientId === this.audience.getMyself()?.id,
		);

		if (client !== undefined) {
			const i = client.selected.findIndex((id) => id === shape.id);
			if (i !== -1) client.selected.removeAt(i);
		}
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
		// iterate over the selection array and updates the selection
		for (const client of this.selection.root.clients) {
			if (client.clientId === this.audience.getMyself()?.id) {
				for (const id of client.selected) {
					const localShape = this.canvas.getChildByLabel(id) as FeltShape | undefined;
					if (localShape !== undefined && localShape !== null) {
						localShape.showSelection();
					}
				}
			} else if (this.audience.getMembers().has(client.clientId)) {
				for (const id of client.selected) {
					const localShape = this.canvas.getChildByLabel(id) as FeltShape | undefined;
					if (localShape !== undefined && localShape !== null) {
						localShape.showPresence();
					}
				}
			} else {
				// remove client from selection tree
			}
		}
	};

	public updateAllShapes = () => {
		const seenIds = new Set<string>();
		if (this.shapeTree.error !== undefined) {
			return;
		}
		for (const shape of this.shapeTree.root) {
			seenIds.add(shape.id);
			let localShape = this.canvas.getChildByLabel(shape.id);
			if (localShape === undefined || localShape === null) {
				localShape = this.addNewLocalShape(shape);
			} else if (localShape.zIndex !== Tree.key(shape)) {
				if (localShape instanceof FeltShape) {
					localShape.update();
				}
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
