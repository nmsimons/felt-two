import { Shape, Shapes as FluidShapes } from "../schema/app_schema.js";
import { Graphics, TextStyle, Text, Container, FederatedPointerEvent } from "pixi.js";
import { Color, ShapeType } from "./utils.js";
import { IAzureAudience } from "@fluidframework/azure-client";
import { generateDragPackage, SelectionManager, DragManager, DragPackage } from "./presence.js";
import { Tree, TreeStatus } from "fluid-framework";

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
	private _selected = false;
	private _remoteSelected: readonly string[] = [];
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
		readonly audience: IAzureAudience,
		readonly setShowIndex: boolean,
		readonly dragger: DragManager,
		readonly selection: SelectionManager,
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

		// Event listeners for when selection changes
		this.selection.events.on("localUpdated", () => {
			this.selected = this.selection.testSelection(this.id);
		});

		this.selection.events.on("updated", (update) => {
			if (update.value.selected.includes(this.id)) {
				// Add the remote client to the list of remote session clients
				// if it is not already in the list
				if (!this.remoteSelected.includes(update.client.sessionId)) {
					const arr = this.remoteSelected.slice();
					arr.push(update.client.sessionId);
					this.remoteSelected = arr;
				}
			} else {
				this.remoteSelected = this.remoteSelected.filter(
					(client) => client !== update.client.sessionId,
				);
			}
		});

		this.selection.clients.events.on("attendeeDisconnected", (update) => {
			this.remoteSelected = this._remoteSelected.filter(
				(client) => client !== update.sessionId,
			);
		});

		// Event listener for when dragging changes
		this.dragger.events.on("updated", (update) => {
			const data = update.value;
			// If the data is null, then the dragger is not dragging anything
			if (data === null || data.id !== this.id) return;
			this.x = data.x;
			this.y = data.y;
		});
	}

	private _select = (shape: FeltShape) => {
		if (!this.selection.testSelection(shape.id)) {
			this.selection.setSelection(shape.id);
		} else {
			this.selection.clearSelection();
		}
	};

	private _multiSelect = (shape: FeltShape) => {
		if (!this.selection.testSelection(shape.id)) {
			this.selection.addToSelection(shape.id);
		} else {
			this.selection.removeFromSelection(shape.id);
		}
	};

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

	private _moved = false;

	private _selectHandled = false;

	private initUserEvents = () => {
		const onDragStart = (event: FederatedPointerEvent) => {
			this._offset = calculateOffset(event);
			this._moved = false;
			this.dragging = true;
			setSelectionOnDragStart(event);
			this.canvas.on("pointerup", onDragEnd);
			this.canvas.on("pointerupoutside", onDragEnd);
			this.canvas.on("pointermove", onDragMove);
		};

		const onDragEnd = (event: FederatedPointerEvent) => {
			if (this.dragging) {
				this.canvas.off("pointermove", onDragMove);
				this.canvas.off("pointerup", onDragEnd);
				this.canvas.off("pointerupoutside", onDragEnd);
				this.dragging = false;
				this.updateFluidLocation(this.x, this.y);
				setSelectionOnDragEnd(event);
			}
		};

		const onDragMove = (event: FederatedPointerEvent) => {
			if (this.dragging) {
				this._moved = true;
				const pos = calculatePosition(event);
				this.updateFluidLocation(pos.x, pos.y);
			}
		};

		const setSelectionOnDragStart = (event: FederatedPointerEvent) => {
			if (!this.selected) {
				select(event);
				this._selectHandled = true;
			} else {
				this._selectHandled = false;
			}
		};

		const setSelectionOnDragEnd = (event: FederatedPointerEvent) => {
			if (!this._moved && !this._selectHandled) {
				select(event);
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

		const select = (event: FederatedPointerEvent) => {
			if (event.ctrlKey) {
				this._multiSelect(this);
			} else {
				this._select(this);
			}
		};

		// intialize event handlers
		this.on("pointerdown", onDragStart);
	};

	public set selected(value: boolean) {
		this._selected = value;
		if (value) {
			this.showSelection();
		} else {
			this.removeSelection();
		}
	}

	public get selected() {
		return this._selected;
	}

	public set remoteSelected(value: readonly string[]) {
		this._remoteSelected = value;
		if (value.length > 0) {
			this.showPresence();
		} else {
			this.removePresence();
		}
	}

	public get remoteSelected() {
		return this._remoteSelected;
	}

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
		if (Tree.status(this.shape) !== TreeStatus.InDocument) return;
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
		// Don't update the position if the shape is not in the document
		if (Tree.status(this.shape) !== TreeStatus.InDocument) return;

		// Persist the new position to Fluid when dragging is complete
		// Send the new position using the dragger during the drag
		if (this.dragging) {
			this.dragger.setDragging(generateDragPackage(this));
			// Update the position of the shape in the local state since
			// dragger doesn't fire events for local changes
			this.x = x;
			this.y = y;
		} else {
			// Clear the drag data for the local client
			this.dragger.clearDragging();
			// Update the position of the shape in the Fluid state
			// Don't update local position since it will be updated when the Fluid state changes
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
		this.setText(this.z.toString());
		this._shape.tint = Number(this.shape.color);
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
	}

	private removePresence() {
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
