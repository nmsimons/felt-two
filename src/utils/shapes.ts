import { Shape, Shapes as FluidShapes } from "../schema/app_schema.js";
import { Application, Graphics, TextStyle, Text } from "pixi.js";
import { Color, ShapeType } from "./utils.js";
import { AzureMember, IAzureAudience } from "@fluidframework/azure-client";
import {
	removeUserFromPresenceArray,
	addUserToPresenceArray,
	shouldShowPresence,
	userIsInPresenceArray,
} from "./presence.js";
import { Pixi2Signal, Signals } from "./wrappers.js";
import { Signaler } from "@fluid-experimental/data-objects";
import { Tree, TreeView } from "fluid-framework";

// set some constants for shapes
export const shapeLimit = 1000;

// brings the shape to the top of the zorder
export function bringToFront(feltShape: FeltShape): void {
	// do something with the zorder
}

// increments the zorder by one and returns the value
export function getMaxZIndex(): number {
	// do something with the zorder
	return 0;
}

export function addShapeToShapeTree(
	shapeType: ShapeType,
	color: Color,
	id: string,
	x: number,
	y: number,
	z: number,
	shapeTree: TreeView<typeof FluidShapes>,
): void {
	shapeTree.root.insertAtStart(
		new Shape({
			id,
			x,
			y,
			color,
			shapeType: shapeType,
		}),
	);
}

// defines a custom map for storing local shapes that fires an event when the map changes
export class Shapes extends Map<string, FeltShape> {
	private _cbs: Array<() => void> = [];

	public onChanged(cb: () => void) {
		this._cbs.push(cb);
	}

	private _max: number;

	constructor(recommendedMax: number) {
		super();
		this._max = recommendedMax;
	}

	public get maxReached(): boolean {
		return this.size >= this._max;
	}

	public set(key: string, value: FeltShape): this {
		super.set(key, value);
		for (const cb of this._cbs) {
			cb();
		}
		return this;
	}

	public delete(key: string): boolean {
		const b = super.delete(key);
		for (const cb of this._cbs) {
			cb();
		}
		return b;
	}

	public clear(): void {
		super.clear();
		for (const cb of this._cbs) {
			cb();
		}
	}
}

// wrapper class for a PIXI shape with a few extra methods and properties
// for creating and managing shapes
export class FeltShape extends Graphics {
	dragging = false;
	static readonly size: number = 60;
	private _selectionFrame: Graphics | undefined;
	private _presenceFrame: Graphics | undefined;
	private _shape: Graphics;
	public readonly id: string;

	constructor(
		private app: Application,
		public shape: Shape, // the Fluid shape object
		private clearPresence: (userId: string) => void,
		private addToSelected: (shape: FeltShape) => void,
		readonly audience: IAzureAudience,
		public useSignals: () => boolean,
		readonly signaler: Signaler,
	) {
		super();
		this.id = this.shape.id;
		this._shape = new Graphics();

		this.initProperties();
		this.initPixiShape();
		this.initUserEvents();

		Tree.on(this.shape, "nodeChanged", () => this.sync());
	}

	private initPixiShape = () => {
		this.setShape();
		this._shape.fill(0xffffff);
		this.interactive = true;
		this.addChild(this._shape);
		this.app.stage.addChild(this);
	};

	private initProperties = () => {
		this._shape.tint = Number(this.color);
		this.x = this.shape.x;
		this.y = this.shape.y;
		this.zIndex = this.z;
	};

	private initUserEvents = () => {
		const onDragStart = (event: any) => {
			this.dragging = true;
			this.app.stage.on("pointermove", onDragMove);
			event.interactionFrequency = 1;
		};

		const onDragEnd = (event: any) => {
			if (this.dragging) {
				this.app.stage.off("pointermove", onDragMove);
				this.dragging = false;
				const pos = clampXY(event.data.global.x, event.data.global.y);
				this.updateFluidLocation(pos.x, pos.y); // syncs local changes with Fluid data - note that this call uses the current position to fix a big where the shape shifts on selection
			}
		};

		const onDragMove = (event: any) => {
			if (this.dragging) {
				event.interactionFrequency = 1;
				const pos = clampXY(event.data.global.x, event.data.global.y);
				this.updateFluidLocation(pos.x, pos.y);
			}
		};

		const onSelect = (event: any) => {
			this.select();
		};

		const clampXY = (x: number, y: number): { x: number; y: number } => {
			if (x < this._shape.width / 2 || x > this.app.screen.width - this._shape.width / 2) {
				x = this.x;
			}

			if (y < this._shape.height / 2 || y > this.app.screen.height - this._shape.height / 2) {
				y = this.y;
			}
			return { x, y };
		};

		this.app.stage.eventMode = "static";
		this.app.stage.hitArea = this.app.screen;
		this.app.stage.on("pointerup", onDragEnd);
		this.app.stage.on("pointerupoutside", onDragEnd);

		// intialize event handlers
		this.on("pointerdown", onDragStart).on("pointerdown", onSelect);
	};

	set color(color: Color) {
		this.shape.color = color;
	}

	get color() {
		return this.shape.color as Color;
	}

	set z(value: number) {
		// no op
	}

	get z() {
		return 0; // no op
	}

	private updateFluidLocation = (x: number, y: number) => {
		// Store the position in Fluid
		if (this.dragging && this.useSignals()) {
			const sig = Pixi2Signal(this);
			this.signaler.submitSignal(Signals.ON_DRAG, sig);
			this.x = x;
			this.y = y;
		} else if (this.dragging) {
			this.x = x;
			this.y = y;
		} else {
			Tree.runTransaction(this.shape, () => {
				this.shape.x = x;
				this.shape.y = y;
			});
		}
	};

	public sync() {
		this.x = this.shape.x;
		this.y = this.shape.y;
		this.zIndex = this.z;
		this._shape.tint = Number(this.color);

		const me: AzureMember | undefined = this.audience.getMyself();
		if (me !== undefined) {
			if (shouldShowPresence(this.shape, me.id)) {
				this.showPresence();
			} else {
				this.removePresence();
			}
		}
	}

	public unselect() {
		this.removeSelection(); // removes the UI

		const me: AzureMember | undefined = this.audience.getMyself();
		if (me !== undefined) {
			removeUserFromPresenceArray({ userId: me.id, shape: this.shape });
		} else {
			console.log("Failed to delete presence!!!");
		}
	}

	public select() {
		this.addToSelected(this); // this updates the local selection - even if presence isn't set, this is useful
		this.showSelection(); // this just shows the UI

		const me: AzureMember | undefined = this.audience.getMyself();
		if (me === undefined) {
			return;
		} // it must be very early or something is broken
		if (userIsInPresenceArray(this.shape, me.id)) {
			return;
		} // this is already in the presence array so no need to add it again

		this.clearPresence(me.id);
		if (me !== undefined) {
			addUserToPresenceArray({ userId: me.id, shape: this.shape });
		} else {
			console.log("Failed to set presence!!!");
		}
	}

	private showSelection() {
		if (!this._selectionFrame) {
			this._selectionFrame = new Graphics();
			this.addChild(this._selectionFrame);
		}

		this._selectionFrame.clear();

		const handleSize = 16;
		const biteSize = 4;
		const color = 0xffffff;
		const left = -this._shape.width / 2 - handleSize / 2;
		const top = -this._shape.height / 2 - handleSize / 2;
		const right = this._shape.width / 2 - handleSize / 2;
		const bottom = this._shape.height / 2 - handleSize / 2;

		this._selectionFrame.zIndex = 5;

		this.drawFrame(this._selectionFrame, handleSize, biteSize, color, left, top, right, bottom);
	}

	private removeSelection() {
		this._selectionFrame?.clear();
	}

	private showPresence() {
		if (!this._presenceFrame) {
			this._presenceFrame = new Graphics();
			this.addChild(this._presenceFrame);
		}

		this._presenceFrame.clear();

		const handleSize = 10;
		const biteSize = 4;
		const color = 0xaaaaaa;
		const left = -this._shape.width / 2 - handleSize / 2;
		const top = -this._shape.height / 2 - handleSize / 2;
		const right = this._shape.width / 2 - handleSize / 2;
		const bottom = this._shape.height / 2 - handleSize / 2;

		this._presenceFrame.zIndex = 4;

		this.drawFrame(this._presenceFrame, handleSize, biteSize, color, left, top, right, bottom);

		const style = new TextStyle({
			align: "center",
			fill: "white",
			fontFamily: "Comic Sans MS",
			fontSize: 30,
			textBaseline: "bottom",
		});
		const text = new Text("0", style); // fix this to show the number of users
		text.x = top + 15;
		text.y = left + 15;
		this._presenceFrame.removeChildren();
		this._presenceFrame.addChild(text);
	}

	private removePresence() {
		this._presenceFrame?.clear().removeChildren();
	}

	private drawFrame(
		frame: Graphics,
		handleSize: number,
		biteSize: number,
		color: number,
		left: number,
		top: number,
		right: number,
		bottom: number,
	) {
		frame.rect(left, top, handleSize, handleSize);
		frame.fill(color);
		frame.rect(left + biteSize, top + biteSize, handleSize - biteSize, handleSize - biteSize);
		frame.cut();

		frame.rect(left, bottom, handleSize, handleSize);
		frame.fill(color);
		frame.rect(left + biteSize, bottom, handleSize - biteSize, handleSize - biteSize);
		frame.cut();

		frame.rect(right, top, handleSize, handleSize);
		frame.fill(color);
		frame.rect(right, top + biteSize, handleSize - biteSize, handleSize - biteSize);
		frame.cut();

		frame.rect(right, bottom, handleSize, handleSize);
		frame.fill(color);
		frame.rect(right, bottom, handleSize - biteSize, handleSize - biteSize);
		frame.cut();
	}

	private setShape() {
		switch (this.shape.shapeType as ShapeType) {
			case ShapeType.Circle:
				this._shape.circle(0, 0, FeltShape.size / 2);
				break;
			case ShapeType.Square:
				this._shape.rect(
					-FeltShape.size / 2,
					-FeltShape.size / 2,
					FeltShape.size,
					FeltShape.size,
				);
				break;
			case ShapeType.Triangle:
				// eslint-disable-next-line no-case-declarations
				const path = [
					0,
					-(FeltShape.size / 2),
					-(FeltShape.size / 2),
					FeltShape.size / 2,
					FeltShape.size / 2,
					FeltShape.size / 2,
				];
				this._shape.poly(path);
				break;
			case ShapeType.Rectangle:
				this._shape.rect(
					(-FeltShape.size * 1.5) / 2,
					-FeltShape.size / 2,
					FeltShape.size * 1.5,
					FeltShape.size,
				);
				break;
			default:
				this._shape.circle(0, 0, FeltShape.size);
				break;
		}
	}
}
