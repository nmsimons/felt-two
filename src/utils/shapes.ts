import { Shape, Shapes as FluidShapes } from "../schema/app_schema.js";
import { Graphics, TextStyle, Text, Container, FederatedPointerEvent } from "pixi.js";
import { Color, ShapeType } from "./utils.js";
import { IAzureAudience } from "@fluidframework/azure-client";
import { Pixi2Signal, Signals } from "./wrappers.js";
import { ISignaler } from "@fluid-experimental/data-objects/";
import { Tree } from "fluid-framework";

export function createShapeNode(shapeType: ShapeType, color: Color, x: number, y: number): Shape {
	return new Shape({
		x,
		y,
		color,
		shapeType: shapeType,
	});
}

// wrapper class for a PIXI shape with a few extra methods and properties
// for creating and managing shapes
export class FeltShape extends Container {
	dragging = false;
	static readonly size: number = 60;
	private _selectionFrame: Graphics | undefined;
	private _presenceFrame: Graphics | undefined;
	private _shape: Graphics;
	private _text: Text;
	public readonly id: string;

	public dirty = false;

	constructor(
		private canvas: Container,
		public shape: Shape, // the Fluid shape object
		private select: (shape: FeltShape) => void,
		private multiSelect: (shape: FeltShape) => void,
		readonly audience: IAzureAudience,
		public useSignals: () => boolean,
		readonly setShowIndex: boolean,
		readonly signaler: ISignaler,
	) {
		super();
		this.id = this.shape.id;
		this.label = this.shape.id;
		this._shape = new Graphics();
		this._text = this.drawText(this.z.toString());
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
		this._text.visible = this.setShowIndex;
		this.addChild(this._text);
		this.canvas.addChild(this);
	};

	private initProperties = () => {
		this._shape.tint = Number(this.color);
		this.x = this.shape.x;
		this.y = this.shape.y;
		this.zIndex = this.z;
	};

	private _offset: { x: number; y: number } = { x: 0, y: 0 };

	private initUserEvents = () => {
		const onDragStart = (event: FederatedPointerEvent) => {
			this._offset = calculateOffset(event);
			this.canvas.on("pointerup", onDragEnd);
			this.canvas.on("pointerupoutside", onDragEnd);
			this.canvas.on("pointermove", onDragMove);
			this.dragging = true;
		};

		const onDragEnd = () => {
			if (this.dragging) {
				this.canvas.off("pointermove", onDragMove);
				this.canvas.off("pointerup", onDragEnd);
				this.canvas.off("pointerupoutside", onDragEnd);
				this.dragging = false;
				this.updateFluidLocation(this.x, this.y);
			}
		};

		const onDragMove = (event: FederatedPointerEvent) => {
			if (this.dragging) {
				const pos = calculatePosition(event);
				this.updateFluidLocation(pos.x, pos.y);
			}
		};

		// calculate the position of the pointer relative to the shape's origin
		// this is used to ensure the shape moves smoothly with the pointer
		// when dragging
		const calculatePosition = (event: FederatedPointerEvent): { x: number; y: number } => {
			return {
				x: event.x - this._offset.x,
				y: event.y - this._offset.y,
			};
		};

		// calculate the offset of the pointer from the shape's origin
		// this is used to ensure the shape moves smoothly with the pointer
		// when dragging
		const calculateOffset = (event: FederatedPointerEvent): { x: number; y: number } => {
			return {
				x: event.x - this.x,
				y: event.y - this.y,
			};
		};

		const onSelect = (event: FederatedPointerEvent) => {
			if (event.ctrlKey) {
				this.multiSelect(this);
			} else {
				this.select(this);
			}
		};

		// intialize event handlers
		this.on("pointerdown", onSelect).on("pointerdown", onDragStart);
	};

	public set showIndex(value: boolean) {
		this._text.visible = value;
	}

	public get showIndex() {
		return this._text.visible;
	}

	public update() {
		this.dirty = false;
		this.sync();
	}

	set color(color: Color) {
		this.shape.color = color;
	}

	get color() {
		return this.shape.color as Color;
	}

	public bringToFront() {
		const parent = Tree.parent(this.shape);
		if (Tree.is(parent, FluidShapes)) {
			parent.moveToEnd(Tree.key(this.shape) as number);
		}
	}

	public sendToBack() {
		const parent = Tree.parent(this.shape);
		if (Tree.is(parent, FluidShapes)) {
			parent.moveToStart(Tree.key(this.shape) as number);
		}
	}

	public bringForward() {
		const parent = Tree.parent(this.shape);
		if (Tree.is(parent, FluidShapes)) {
			const i = Tree.key(this.shape) as number;
			console.log(i, parent.length);
			if (parent.length - 1 > i) {
				parent.moveToIndex(i + 2, i);
			}
		}
	}

	public sendBackward() {
		const parent = Tree.parent(this.shape);
		if (Tree.is(parent, FluidShapes)) {
			const i = Tree.key(this.shape) as number;
			if (0 < i) {
				parent.moveToIndex(i - 1, i);
			}
		}
	}

	public get z() {
		return Tree.key(this.shape) as number;
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
		console.log("syncing", this.shape.id);
		this.x = this.shape.x;
		this.y = this.shape.y;
		this.zIndex = this.z;
		this.setText(this.z.toString());
		this._shape.tint = Number(this.color);
	}

	private drawText(value: string): Text {
		const style = new TextStyle({
			align: "center",
			fill: "white",
			fontFamily: "Comic Sans MS",
			fontSize: 16,
			textBaseline: "bottom",
		});
		const text = new Text({ text: value, style });
		text.x = -text.width / 2;
		text.y = -text.height / 2;
		return text;
	}

	private setText(value: string) {
		this._text.text = value;
		this._text.x = -this._text.width / 2;
		this._text.y = -this._text.height / 2;
	}

	public showSelection() {
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

	public removeSelection() {
		this._selectionFrame?.clear();
	}

	public showPresence() {
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
	}

	public removePresence() {
		this._presenceFrame?.clear();
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
