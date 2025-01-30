import { FeltShape } from "./shapes.js";

export interface DragPackage {
	id: string;
	x: number;
	y: number;
}

export const Pixi2Drag = (feltShape: FeltShape): DragPackage => {
	return {
		id: feltShape.id,
		x: feltShape.x,
		y: feltShape.y,
	};
};

export const Drag2Pixi = (feltShape: FeltShape, signal: DragPackage) => {
	feltShape.x = signal.x;
	feltShape.y = signal.y;
	return feltShape;
};
