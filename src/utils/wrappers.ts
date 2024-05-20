import { FeltShape } from "./shapes.js";

export interface SignalPackage {
	id: string;
	x: number;
	y: number;
}

export const Signals = {
	ON_DRAG: "ON_DRAG",
} as const;

export const Pixi2Signal = (feltShape: FeltShape): SignalPackage => {
	return {
		id: feltShape.id,
		x: feltShape.x,
		y: feltShape.y,
	};
};

export const Signal2Pixi = (feltShape: FeltShape, signal: SignalPackage) => {
	feltShape.x = signal.x;
	feltShape.y = signal.y;
	return feltShape;
};
