/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { IAzureAudience } from "@fluidframework/azure-client";
import { Color, ShapeType as S, UXColor } from "../utils/utils.js";
import { Shapes } from "../utils/shapes.js";
import { ConnectionState, IFluidContainer, Tree, TreeView } from "fluid-framework";
import { Shapes as FluidShapes } from "../schema/app_schema.js";
import { Application } from "pixi.js";
import {
	SquareFilled,
	CircleFilled,
	RectangleLandscapeFilled,
	TriangleFilled,
	ShapesFilled,
	EraserFilled,
	DeleteFilled,
	PaintBrushFilled,
	PositionToFrontFilled,
} from "@fluentui/react-icons";
import "../output.css";

// eslint-disable-next-line react/prop-types
export function ReactApp(props: {
	audience: IAzureAudience;
	createShape: any;
	createLotsOfShapes: any;
	changeColor: any;
	deleteShape: any;
	deleteAllShapes: any;
	bringToFront: any;
	toggleSignals: any;
	signals: () => boolean;
	selectionManager: any;
	localShapes: Shapes;
	shapeTree: TreeView<typeof FluidShapes>;
	fluidContainer: IFluidContainer;
	pixiApp: Application;
}): JSX.Element {
	const keyDownHandler = (e: KeyboardEvent) => {
		switch (e.key) {
			case "Delete": {
				props.deleteShape();
				break;
			}
		}
	};
	React.useEffect(() => {
		window.addEventListener("keydown", (event) => keyDownHandler(event));
	}, []);

	return (
		<div className="w-full h-full">
			<Header {...props} />
			<Toolbar {...props} />
			<Canvas {...props} />
			<StatusBar {...props} />
		</div>
	);
}

// eslint-disable-next-line react/prop-types
export function Toolbar(props: {
	createShape: any;
	createLotsOfShapes: any;
	changeColor: any;
	deleteShape: any;
	deleteAllShapes: any;
	bringToFront: any;
	audience: IAzureAudience;
	selectionManager: Shapes;
	localShapes: Shapes;
}) {
	const shapeButtonColor = "black";

	React.useEffect(() => {
		props.selectionManager.onChanged(() => {
			getSelected(props.selectionManager.size);
		});
	}, []);

	React.useEffect(() => {
		props.localShapes.onChanged(() => {
			getMaxReached(props.localShapes.maxReached);
		});
	}, []);

	const [selected, getSelected] = React.useState(props.selectionManager.size);

	const [maxReached, getMaxReached] = React.useState(props.localShapes.maxReached);

	return (
		<ButtonBar>
			<ButtonGroup>
				<IconButton
					icon={<CircleFilled />}
					color={shapeButtonColor}
					disabled={maxReached}
					handleClick={() => props.createShape(S.Circle, Color.Red)}
				/>
				<IconButton
					icon={<SquareFilled />}
					color={shapeButtonColor}
					disabled={maxReached}
					handleClick={() => props.createShape(S.Square, Color.Blue)}
				/>
				<IconButton
					icon={<TriangleFilled />}
					color={shapeButtonColor}
					disabled={maxReached}
					handleClick={() => props.createShape(S.Triangle, Color.Orange)}
				/>
				<IconButton
					icon={<RectangleLandscapeFilled />}
					color={shapeButtonColor}
					disabled={maxReached}
					handleClick={() => props.createShape(S.Rectangle, Color.Purple)}
				/>
				<IconButton
					icon={<ShapesFilled />}
					color={shapeButtonColor}
					disabled={maxReached}
					handleClick={() => props.createLotsOfShapes(100)}
				/>
			</ButtonGroup>
			<ButtonGroup>
				<IconButton
					icon={<PaintBrushFilled />}
					color={UXColor.Red}
					disabled={!selected}
					handleClick={() => props.changeColor(Color.Red)}
					background="bg-white"
				/>
				<IconButton
					icon={<PaintBrushFilled />}
					color={UXColor.Green}
					disabled={!selected}
					handleClick={() => props.changeColor(Color.Green)}
					background="bg-white"
				/>
				<IconButton
					icon={<PaintBrushFilled />}
					color={UXColor.Blue}
					disabled={!selected}
					handleClick={() => props.changeColor(Color.Blue)}
					background="bg-white"
				/>
				<IconButton
					icon={<PaintBrushFilled />}
					color={UXColor.Orange}
					disabled={!selected}
					handleClick={() => props.changeColor(Color.Orange)}
					background="bg-white"
				/>
				<IconButton
					icon={<PaintBrushFilled />}
					color={UXColor.Purple}
					disabled={!selected}
					handleClick={() => props.changeColor(Color.Purple)}
					background="bg-white"
				/>
			</ButtonGroup>
			<ButtonGroup>
				<IconButton
					icon={<PositionToFrontFilled />}
					color={shapeButtonColor}
					disabled={!selected}
					handleClick={() => props.bringToFront()}
				/>
				<IconButton
					icon={<DeleteFilled />}
					color={shapeButtonColor}
					disabled={!selected}
					handleClick={() => props.deleteShape()}
				/>
				<IconButton
					icon={<EraserFilled />}
					color={shapeButtonColor}
					disabled={false}
					handleClick={() => props.deleteAllShapes()}
				/>
			</ButtonGroup>
		</ButtonBar>
	);
}

export function Canvas(props: { pixiApp: Application }): JSX.Element {
	useEffect(() => {
		const canvas = document.createElement("canvas");
		canvas.id = "canvas";
		document.getElementById("canvas")?.appendChild(props.pixiApp.canvas);
	}, []);
	return (
		<div className="flex justify-center w-full h-full">
			<div className="w-fit h-fit m-6" id="canvas"></div>
		</div>
	);
}

export function StatusBar(props: {
	audience: IAzureAudience;
	toggleSignals: any;
	signals: () => boolean;
	localShapes: Shapes;
	shapeTree: TreeView<typeof FluidShapes>;
	pixiApp: Application;
	fluidContainer: IFluidContainer;
}) {
	const [, setChecked] = React.useState(props.signals());

	const handleChange = () => {
		props.toggleSignals();
		setChecked(props.signals());
	};

	return (
		<div className="level mb-0 mt-0">
			<div className="level-left">
				<div className="level-item">
					<div className="field mt-0 mb-0">
						<input
							id="switchRoundedInfo"
							type="checkbox"
							name="switchRoundedInfo"
							className="switch is-rounded is-info"
							checked={props.signals()}
							onChange={handleChange}
						/>
						<label className="mb-3 mt-0" htmlFor="switchRoundedInfo">
							Use signals
						</label>
					</div>
				</div>
			</div>
		</div>
	);
}

export function ShapeCount(props: {
	pixiApp: Application;
	shapeTree: TreeView<typeof FluidShapes>;
}) {
	const [fluidCount, setFluidCount] = useState(props.shapeTree.root.length);
	const [localCount, setLocalCount] = useState(props.pixiApp.stage.children.length);

	useEffect(() => {
		Tree.on(props.shapeTree.root, "nodeChanged", () => {
			setFluidCount(props.shapeTree.root.length),
				setLocalCount(props.pixiApp.stage.children.length);
		});
	}, []);

	return <div>Shapes: {fluidCount}</div>;
}

export function ConnectionStatus(props: { fluidContainer: IFluidContainer }) {
	const [connectionState, setConnectionState] = useState(props.fluidContainer.connectionState);

	useEffect(() => {
		props.fluidContainer.on("connected", () => {
			setConnectionState(props.fluidContainer.connectionState);
		});
		props.fluidContainer.on("disconnected", () => {
			setConnectionState(props.fluidContainer.connectionState);
		});
		props.fluidContainer.on("disposed", () => {
			setConnectionState(props.fluidContainer.connectionState);
		});
		props.fluidContainer.on("dirty", () => {
			setConnectionState(props.fluidContainer.connectionState);
		});
		props.fluidContainer.on("saved", () => {
			setConnectionState(props.fluidContainer.connectionState);
		});
	}, []);

	const convertConnectionStateToString = (connectionState: ConnectionState): string => {
		switch (connectionState) {
			case ConnectionState.Connected: {
				return "Connected";
			}
			case ConnectionState.CatchingUp: {
				return "Catching Up";
			}
			case ConnectionState.Disconnected: {
				return "Disconnected";
			}
			case ConnectionState.EstablishingConnection: {
				return "Connecting";
			}
			default: {
				return "Unknown";
			}
		}
	};

	return <div>Status: {convertConnectionStateToString(connectionState)}</div>;
}

export function Audience(props: { audience: IAzureAudience }): JSX.Element {
	const { audience } = props;

	// retrieve all the members currently in the session
	const [members, setMembers] = React.useState(Array.from(audience.getMembers().values()));

	const setMembersCallback = React.useCallback(
		() => setMembers(Array.from(audience.getMembers().values())),
		[setMembers, audience],
	);

	// Setup a listener to update our users when new clients join the session
	useEffect(() => {
		audience.on("membersChanged", setMembersCallback);
	}, [audience, setMembersCallback]);

	return <div>Users: {members.length}</div>;
}

export function Header(props: {
	shapeTree: TreeView<typeof FluidShapes>;
	fluidContainer: IFluidContainer;
	audience: IAzureAudience;
	pixiApp: Application;
}): JSX.Element {
	return (
		<div className="h-[48px] flex shrink-0 flex-row items-center justify-between bg-black text-base text-white z-40 w-full">
			<div className="flex m-2">Felt</div>
			<div className="flex m-2 gap-2 ">
				<ShapeCount {...props} />
				<ConnectionStatus {...props} />
				<Audience {...props} />
			</div>
		</div>
	);
}

export function ButtonGroup(props: { children: React.ReactNode }): JSX.Element {
	return <div className="flex flex-intial items-center gap-2">{props.children}</div>;
}

export function ButtonBar(props: { children: React.ReactNode }): JSX.Element {
	return (
		<div className="transition transform absolute z-100 bottom-0 inset-x-0 pb-2 sm:pb-5 opacity-100 scale-100 translate-y-0 ease-out duration-500 text-white">
			<div className="max-w-screen-md mx-auto px-2 sm:px-4">
				<div className="rounded-lg bg-black shadow-lg sm:p-3">
					<div className="flex flex-row items-center justify-between flex-wrap">
						{props.children}
					</div>
				</div>
			</div>
		</div>
	);
}

export function IconButton(props: {
	handleClick: () => void;
	children?: React.ReactNode;
	icon: JSX.Element;
	color?: string;
	background?: string;
	disabled?: boolean;
}): JSX.Element {
	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		props.handleClick();
	};

	return (
		<button
			className={`transition hover:scale-150 ${props.color} ${props.background} ${
				props.background === IconButton.defaultProps.background
					? "hover:bg-gray-600"
					: "hover:bg-white"
			} font-bold p-1 rounded inline-flex items-center h-6 w-6 grow`}
			onClick={(e) => handleClick(e)}
		>
			{props.icon}
			<IconButtonText>{props.children}</IconButtonText>
		</button>
	);
}

IconButton.defaultProps = {
	color: "text-gray-600",
	background: "bg-transparent",
};

function IconButtonText(props: { children: React.ReactNode }): JSX.Element {
	if (props.children == undefined) {
		return <span></span>;
	} else {
		return <span className="text-sm pl-2 leading-none">{props.children}</span>;
	}
}
