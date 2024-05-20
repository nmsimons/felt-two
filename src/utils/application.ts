/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Signaler, SignalListener } from "@fluid-experimental/data-objects";
import { IAzureAudience } from "@fluidframework/azure-client";
import { v4 as uuid } from "uuid";
import { Shape, Shapes } from "../schema/app_schema.js";
import { FeltShape, shapeLimit, Shapes as PIXIShapes, createShapeNode } from "./shapes.js";
import { Color, getNextColor, getNextShape, getRandomInt, ShapeType } from "./utils.js";
import { clearPresence, removeUserFromPresenceArray } from "./presence.js";
import {
	Container,
	FederatedPointerEvent,
	Graphics,
	Application as PIXIApplication,
} from "pixi.js";
import { ConnectionState, IFluidContainer, IMember, Tree, TreeView } from "fluid-framework";
import { Signal2Pixi, SignalPackage, Signals } from "./wrappers.js";

export class FeltApplication {
	private constructor(
		public pixiApp: PIXIApplication,
		public selection: PIXIShapes,
		public audience: IAzureAudience,
		public useSignals: boolean,
		public signaler: Signaler,
		public localShapes: PIXIShapes,
		public shapeTree: TreeView<typeof Shapes>,
		public container: IFluidContainer,
	) {
		// make background clickable
		FeltApplication.addBackgroundShape(() => {
			this.clearSelection();
			clearPresence(audience.getMyself()?.id!);
		}, pixiApp);

		// Initialize the canvas container
		this._canvas = FeltApplication.createScaledContainer(pixiApp, () => {
			this.clearSelection();
			clearPresence(audience.getMyself()?.id!);
		});

		// Get all existing shapes
		this.updateAllShapes();

		// event handler for detecting remote changes to Fluid data and updating
		// the local data
		Tree.on(shapeTree.root, "nodeChanged", () => {
			this.updateAllShapes();
		});

		// When a user leaves the session, remove all that users presence data from
		// the presence shared map. Note, all clients run this code right now
		audience.on("memberRemoved", (clientId: string, member: IMember) => {
			console.log(member.id, "JUST LEFT");
			for (const shape of shapeTree.root) {
				removeUserFromPresenceArray({ userId: member.id, shape });
			}
		});

		// When shapes are dragged, instead of updating the Fluid data, we send a Signal using fluid. This function will
		// handle the signal we send and update the local state accordingly.
		const signalHandler: SignalListener<SignalPackage> = (
			clientId: string,
			local: boolean,
			payload: SignalPackage,
		) => {
			if (!local) {
				const localShape = localShapes.get(payload.id);
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
	): Promise<FeltApplication> {
		// create a local map for shapes - contains customized PIXI objects
		const localShapes = new PIXIShapes(shapeLimit);

		// initialize the selection object (a custom map) which is used to manage local selection and is passed
		// to the React app for state and events
		const selection = new PIXIShapes(shapeLimit);

		// create PIXI app
		const pixiApp = await this.createPixiApp();

		return new FeltApplication(
			pixiApp,
			selection,
			audience,
			true,
			signaler,
			localShapes,
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
		// settings.RESOLUTION = window.devicePixelRatio || 1;

		// The PixiJS application instance
		const app = new PIXIApplication();

		await app.init({
			width: 600,
			height: 600,
			autoDensity: true, // Handles high DPI screens
			backgroundColor: 0xffffff,
		});

		return app;
	}

	// Create a new scaled container
	private static createScaledContainer = (
		app: PIXIApplication,
		clearSelectionAndPresence: (event: FederatedPointerEvent) => void,
	) => {
		// This is the stage for the new scene
		const container = new Container();

		// Set the size of the container to the size of the stage
		container.width = app.canvas.width;
		container.height = app.canvas.height;
		container.position.set(app.stage.x, app.stage.y);
		container.boundsArea = app.screen;

		container.interactive = true;
		container.interactiveChildren = true;

		container.sortableChildren = true;

		container.on("pointerup", (event) => clearSelectionAndPresence(event));

		app.stage.addChild(container);

		return container;
	};

	private _canvas: Container;

	public get canvas(): Container {
		return this._canvas;
	}

	private static WIDTH = 500;

	private static HEIGHT = 500;

	private static actualWidth = (app: PIXIApplication) => {
		const { width, height } = app.screen;
		const isWidthConstrained = width < height;
		return isWidthConstrained ? width : height;
	};

	private static actualHeight = (app: PIXIApplication) => {
		const { width, height } = app.screen;
		const isHeightConstrained = width > height;
		return isHeightConstrained ? height : width;
	};

	private static addBackgroundShape = (
		clearSelectionAndPresence: (event: FederatedPointerEvent) => void,
		app: PIXIApplication,
	) => {
		const bg: Graphics = new Graphics();
		bg.rect(0, 0, app.canvas.width, app.canvas.height);
		bg.fill(0x000000);
		bg.interactive = true;

		app.stage.addChild(bg);

		bg.on("pointerup", (event) => clearSelectionAndPresence(event));
	};

	public get fluidConnectionState(): ConnectionState {
		return this.container.connectionState;
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
			(userId: string) => {
				clearPresence(userId);
			},
			(shape: FeltShape) => {
				this.clearSelection();
				this.selection.set(shape.id, shape);
			},
			this.audience,
			this.getUseSignals,
			this.signaler,
		);

		this.localShapes.set(shape.id, feltShape); // add the new shape to local data

		return feltShape;
	};

	// function passed into React UX for creating shapes
	public createShape = (shapeType: ShapeType, color: Color): void => {
		if (this.localShapes.maxReached) return;

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
		Tree.runTransaction(this.shapeTree.root, () => {
			let shapeType = ShapeType.Circle;
			let color = Color.Red;
			const shapes = [];

			for (let index = 0; index < amount; index++) {
				shapeType = getNextShape(shapeType);
				color = getNextColor(color);

				if (this.localShapes.size < shapeLimit) {
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

	// Function passed to React to change the color of selected shapes
	public changeColorofSelected = (color: Color): void => {
		this.changeSelectedShapes((shape: FeltShape) => this.changeColor(shape, color));
	};

	// Changes the color of a shape and syncs with the Fluid data
	public changeColor = (shape: FeltShape, color: Color): void => {
		shape.color = color;
	};

	// A function that iterates over all selected shapes and calls the passed function
	// for each shape
	public changeSelectedShapes = (f: Function): void => {
		Tree.runTransaction(this.shapeTree.root, () => {
			if (this.selection.size > 0) {
				this.selection.forEach((value: FeltShape | undefined, key: string) => {
					if (value !== undefined) {
						f(value);
					} else {
						this.selection.delete(key);
					}
				});
			}
		});
	};

	// Function passed to React to delete selected shapes
	public deleteSelectedShapes = (): void => {
		this.changeSelectedShapes((shape: FeltShape) => this.deleteShape(shape));
	};

	public deleteAllShapes = (): void => {
		this.shapeTree.root.removeRange();
	};

	private deleteShape = (shape: FeltShape): void => {
		const i = Tree.key(shape.shape) as number;
		this.shapeTree.root.removeAt(i);
	};

	// Called when a shape is deleted in the Fluid Data
	public deleteLocalShape = (shape: FeltShape): void => {
		// Remove shape from local map
		this.localShapes.delete(shape.id);

		// Remove the shape from the selection map
		this.selection.delete(shape.id);

		// Remove the shape from the canvas
		this.canvas.removeChild(shape);

		// Destroy the local shape object
		// shape.destroy();
	};

	public bringSelectedToFront = (): void => {
		this.changeSelectedShapes(
			(shape: FeltShape) => shape.bringToFront(), // fix this
		);
	};

	public clearSelection = (): void => {
		this.selection.forEach((value: FeltShape) => {
			value.unselect();
		});
		this.selection.clear();
	};

	public updateAllShapes = () => {
		console.log("UPDATING ALL SHAPES: ");
		const seenIds = new Set<string>();
		for (const shape of this.shapeTree.root) {
			seenIds.add(shape.id);
			let localShape = this.localShapes.get(shape.id);
			if (localShape === undefined) {
				localShape = this.addNewLocalShape(shape);
				console.log(shape.id, "Added");
			}
		}

		// delete local shapes that no longer exist
		this.localShapes.forEach((shape: FeltShape) => {
			if (!seenIds.has(shape.id)) {
				console.log(shape.id, "DELETED");
				this.deleteLocalShape(this.localShapes.get(shape.id)!);
			}
		});
	};
}
