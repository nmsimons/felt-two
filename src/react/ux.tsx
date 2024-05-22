/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { IAzureAudience } from "@fluidframework/azure-client";
import { Color, ShapeType as S, UXColor } from "../utils/utils.js";
import { ConnectionState, IFluidContainer, Tree, TreeView } from "fluid-framework";
import { Shapes as FluidShapes } from "../schema/app_schema.js";
import { FeltApplication as FeltApplication } from "../utils/application.js";
import { Application, Container } from "pixi.js";
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
	ArrowUndoFilled,
	ArrowRedoFilled,
} from "@fluentui/react-icons";
import "../output.css";
import { UndoRedo } from "../utils/undo.js";
import { Session } from "../schema/session_schema.js";

// eslint-disable-next-line react/prop-types
export function ReactApp(props: {
	feltApplication: FeltApplication;
	undoRedo: UndoRedo;
}): JSX.Element {
	const appProps = {
		feltApplication: props.feltApplication,
		audience: props.feltApplication.audience,
		createShape: props.feltApplication.createShape,
		createLotsOfShapes: props.feltApplication.createLotsOfShapes,
		changeColor: props.feltApplication.changeColorofSelected,
		deleteShape: props.feltApplication.deleteSelectedShapes,
		deleteAllShapes: props.feltApplication.deleteAllShapes,
		bringToFront: props.feltApplication.bringSelectedToFront,
		toggleSignals: props.feltApplication.toggleSignals,
		signals: props.feltApplication.getUseSignals,
		selectionManager: props.feltApplication.selection,
		shapeTree: props.feltApplication.shapeTree,
		fluidContainer: props.feltApplication.container,
		canvas: props.feltApplication.canvas,
		pixiApp: props.feltApplication.pixiApp,
		undoRedo: props.undoRedo,
	};

	const deleteShape = props.feltApplication.deleteSelectedShapes;

	const keyDownHandler = (e: KeyboardEvent) => {
		switch (e.key) {
			case "Delete": {
				deleteShape();
				break;
			}
		}
	};
	React.useEffect(() => {
		window.addEventListener("keydown", (event) => keyDownHandler(event));
	}, []);

	return (
		<div className="w-full h-full">
			<Header {...appProps} />
			<Toolbar {...appProps} />
			<Canvas {...appProps} />
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
	selectionManager: TreeView<typeof Session>;
	undoRedo: UndoRedo;
	canvas: Container;
	feltApplication: FeltApplication;
}) {
	const shapeButtonColor = "black";
	const [maxReached, setMaxReached] = React.useState(false);
	const [selected, setSelected] = React.useState(false);
	const [canUndo, setCanUndo] = React.useState(props.undoRedo.canUndo());
	const [canRedo, setCanRedo] = React.useState(props.undoRedo.canRedo());

	React.useEffect(() => {
		const unsubscribe = props.undoRedo.events.on("commitApplied", () => {
			setCanUndo(props.undoRedo.canUndo());
			setCanRedo(props.undoRedo.canRedo());
		});
		return () => {
			unsubscribe();
		};
	}, []);

	React.useEffect(() => {
		const unsubscribe = Tree.on(props.selectionManager.root, "treeChanged", () => {
			const client = props.audience.getMyself();
			if (client !== undefined) {
				const selected = props.selectionManager.root.clients.find(
					(c) => c.clientId === client.id,
				);
				if (selected !== undefined && selected.selected.length > 0) {
					setSelected(true);
				} else {
					setSelected(false);
				}
			}
		});
		return () => {
			unsubscribe();
		};
	}, []);

	React.useEffect(() => {
		props.canvas.on("childAdded", () => {
			setMaxReached(props.feltApplication.maxReached);
		});
		props.canvas.on("childRemoved", () => {
			setMaxReached(props.feltApplication.maxReached);
		});
	}, []);

	return (
		<ButtonBar>
			<ButtonGroup>
				<IconButton
					icon={<CircleFilled />}
					color={UXColor.Red}
					disabled={maxReached}
					handleClick={() => props.createShape(S.Circle, Color.Red)}
					background="bg-white"
				/>
				<IconButton
					icon={<SquareFilled />}
					color={UXColor.Blue}
					disabled={maxReached}
					handleClick={() => props.createShape(S.Square, Color.Blue)}
					background="bg-white"
				/>
				<IconButton
					icon={<TriangleFilled />}
					color={UXColor.Orange}
					disabled={maxReached}
					handleClick={() => props.createShape(S.Triangle, Color.Orange)}
					background="bg-white"
				/>
				<IconButton
					icon={<RectangleLandscapeFilled />}
					color={UXColor.Purple}
					disabled={maxReached}
					handleClick={() => props.createShape(S.Rectangle, Color.Purple)}
					background="bg-white"
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
			<ButtonGroup>
				<IconButton
					icon={<ArrowUndoFilled />}
					color={shapeButtonColor}
					disabled={!canUndo}
					handleClick={() => props.undoRedo.undo()}
				/>
				<IconButton
					icon={<ArrowRedoFilled />}
					color={shapeButtonColor}
					disabled={!canRedo}
					handleClick={() => props.undoRedo.redo()}
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

export function SignalsToggle(props: { toggleSignals: any; signals: () => boolean }) {
	const [, setChecked] = React.useState(props.signals());

	const handleChange = () => {
		props.toggleSignals();
		setChecked(props.signals());
	};

	return (
		<div className="">
			<label className="pr-2" htmlFor="switchRoundedInfo">
				Use signals:
			</label>
			<input
				id="switchRoundedInfo"
				type="checkbox"
				name="switchRoundedInfo"
				className="p-2"
				checked={props.signals()}
				onChange={handleChange}
			/>
		</div>
	);
}

export function IndexToggle(props: { feltApplication: FeltApplication }) {
	const [, setChecked] = React.useState(props.feltApplication.showIndex);

	const handleChange = () => {
		props.feltApplication.showIndex = !props.feltApplication.showIndex;
		setChecked(props.feltApplication.showIndex);
	};

	return (
		<div className="">
			<label className="pr-2" htmlFor="switchRoundedInfo">
				Show index:
			</label>
			<input
				id="switchRoundedInfo"
				type="checkbox"
				name="switchRoundedInfo"
				className="p-2"
				checked={props.feltApplication.showIndex}
				onChange={handleChange}
			/>
		</div>
	);
}

export function ShapeCount(props: { canvas: Container; shapeTree: TreeView<typeof FluidShapes> }) {
	const [fluidCount, setFluidCount] = useState(props.shapeTree.root.length);

	useEffect(() => {
		Tree.on(props.shapeTree.root, "nodeChanged", () => {
			setFluidCount(props.shapeTree.root.length);
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
	feltApplication: FeltApplication;
	canvas: Container;
	toggleSignals: any;
	signals: () => boolean;
}): JSX.Element {
	return (
		<div className="h-[48px] flex shrink-0 flex-row items-center justify-between bg-black text-base text-white z-40 w-full">
			<div className="flex m-2">Felt</div>
			<div className="flex m-2 gap-4 ">
				<IndexToggle feltApplication={props.feltApplication} />
				<SignalsToggle {...props} />
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
			{...(props.disabled ? { disabled: true } : {})}
			className={`transition disabled:opacity-60 disabled:hover:scale-100 hover:scale-150 ${props.color} ${props.background} font-bold p-1 rounded inline-flex items-center h-6 w-6 grow`}
			onClick={(e) => handleClick(e)}
		>
			{props.icon}
			<IconButtonText>{props.children}</IconButtonText>
		</button>
	);
}

IconButton.defaultProps = {
	color: "text-white",
	background: "bg-gray-600",
};

function IconButtonText(props: { children: React.ReactNode }): JSX.Element {
	if (props.children == undefined) {
		return <span></span>;
	} else {
		return <span className="text-sm pl-2 leading-none">{props.children}</span>;
	}
}
