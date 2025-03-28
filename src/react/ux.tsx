/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSX, useCallback, useEffect, useState } from "react";
import { Color, ShapeType as S, UXColor } from "../utils/utils.js";
import { ConnectionState, Tree } from "fluid-framework";
import { FeltApplication as FeltApplication } from "../utils/application.js";
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
	PositionBackwardFilled,
	PositionToBackFilled,
	PositionForwardFilled,
	SelectAllOnFilled,
} from "@fluentui/react-icons";
import "../output.css";
import React from "react";

// eslint-disable-next-line react/prop-types
export function ReactApp(props: { feltApplication: FeltApplication }): JSX.Element {
	const deleteShape = props.feltApplication.deleteSelectedShapes;

	const keyDownHandler = (e: KeyboardEvent) => {
		switch (e.key) {
			case "Delete": {
				deleteShape();
				break;
			}
		}
	};
	useEffect(() => {
		window.addEventListener("keydown", (event) => keyDownHandler(event));
	}, []);

	return (
		<div className="w-full h-full">
			<Header {...props} />
			<Toolbar {...props} />
			<Canvas {...props} />
		</div>
	);
}

// eslint-disable-next-line react/prop-types
export function Toolbar(props: { feltApplication: FeltApplication }) {
	const undoRedo = props.feltApplication.undoRedo;

	const shapeButtonColor = "black";
	const [maxReached, setMaxReached] = React.useState(false);
	const [selected, setSelected] = React.useState(false);
	const [multiSelected, setMultiSelected] = React.useState(false);
	const [canUndo, setCanUndo] = React.useState(undoRedo.getUndoStackLength() > 0);
	const [canRedo, setCanRedo] = React.useState(undoRedo.getRedoStackLength() > 0);

	useEffect(() => {
		const unsubscribe = undoRedo.events.on("commitApplied", () => {
			setCanUndo(undoRedo.getUndoStackLength() > 0);
			setCanRedo(undoRedo.getRedoStackLength() > 0);
		});
		return () => {
			unsubscribe();
		};
	}, []);

	// Test for selection to enable/disable buttons
	useEffect(() => {
		const handleSelectionChange = () => {
			const selected = props.feltApplication.selection.getLocalSelected();
			if (selected.length === 1) {
				setSelected(true);
				setMultiSelected(false);
			} else if (selected.length > 1) {
				setSelected(true);
				setMultiSelected(true);
			} else {
				setSelected(false);
				setMultiSelected(false);
			}
		};
		const unsubscribe = props.feltApplication.selection.events.on(
			"localUpdated",
			handleSelectionChange,
		);
		return unsubscribe;
	}, []);

	useEffect(() => {
		props.feltApplication.canvas.on("childAdded", () => {
			setMaxReached(props.feltApplication.maxReached);
		});
		props.feltApplication.canvas.on("childRemoved", () => {
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
					handleClick={() => props.feltApplication.createShape(S.Circle, Color.Red)}
					background="bg-white"
				/>
				<IconButton
					icon={<SquareFilled />}
					color={UXColor.Blue}
					disabled={maxReached}
					handleClick={() => props.feltApplication.createShape(S.Square, Color.Blue)}
					background="bg-white"
				/>
				<IconButton
					icon={<TriangleFilled />}
					color={UXColor.Orange}
					disabled={maxReached}
					handleClick={() => props.feltApplication.createShape(S.Triangle, Color.Orange)}
					background="bg-white"
				/>
				<IconButton
					icon={<RectangleLandscapeFilled />}
					color={UXColor.Purple}
					disabled={maxReached}
					handleClick={() => props.feltApplication.createShape(S.Rectangle, Color.Purple)}
					background="bg-white"
				/>
				<IconButton
					icon={<ShapesFilled />}
					color={shapeButtonColor}
					disabled={maxReached}
					handleClick={() => props.feltApplication.createLotsOfShapes(100)}
				/>
			</ButtonGroup>
			<ButtonGroup>
				<IconButton
					icon={<SelectAllOnFilled />}
					color={shapeButtonColor}
					disabled={false}
					handleClick={() => props.feltApplication.selectAllShapes()}
				/>
			</ButtonGroup>
			<ButtonGroup>
				<IconButton
					icon={<PaintBrushFilled />}
					color={UXColor.Red}
					disabled={!selected}
					handleClick={() => props.feltApplication.changeColorofSelected(Color.Red)}
					background="bg-white"
				/>
				<IconButton
					icon={<PaintBrushFilled />}
					color={UXColor.Green}
					disabled={!selected}
					handleClick={() => props.feltApplication.changeColorofSelected(Color.Green)}
					background="bg-white"
				/>
				<IconButton
					icon={<PaintBrushFilled />}
					color={UXColor.Blue}
					disabled={!selected}
					handleClick={() => props.feltApplication.changeColorofSelected(Color.Blue)}
					background="bg-white"
				/>
				<IconButton
					icon={<PaintBrushFilled />}
					color={UXColor.Orange}
					disabled={!selected}
					handleClick={() => props.feltApplication.changeColorofSelected(Color.Orange)}
					background="bg-white"
				/>
				<IconButton
					icon={<PaintBrushFilled />}
					color={UXColor.Purple}
					disabled={!selected}
					handleClick={() => props.feltApplication.changeColorofSelected(Color.Purple)}
					background="bg-white"
				/>
			</ButtonGroup>
			<ButtonGroup>
				<IconButton
					icon={<PositionForwardFilled />}
					color={shapeButtonColor}
					disabled={!selected || multiSelected}
					handleClick={() => props.feltApplication.bringSelectedForward()}
				/>
				<IconButton
					icon={<PositionToFrontFilled />}
					color={shapeButtonColor}
					disabled={!selected || multiSelected}
					handleClick={() => props.feltApplication.bringSelectedToFront()}
				/>
				<IconButton
					icon={<PositionBackwardFilled />}
					color={shapeButtonColor}
					disabled={!selected || multiSelected}
					handleClick={() => props.feltApplication.sendSelectedBackward()}
				/>
				<IconButton
					icon={<PositionToBackFilled />}
					color={shapeButtonColor}
					disabled={!selected || multiSelected}
					handleClick={() => props.feltApplication.sendSelectedToBack()}
				/>
				<IconButton
					icon={<DeleteFilled />}
					color={shapeButtonColor}
					disabled={!selected}
					handleClick={() => props.feltApplication.deleteSelectedShapes()}
				/>
				<IconButton
					icon={<EraserFilled />}
					color={shapeButtonColor}
					disabled={false}
					handleClick={() => props.feltApplication.deleteAllShapes()}
				/>
			</ButtonGroup>
			<ButtonGroup>
				<IconButton
					icon={<ArrowUndoFilled />}
					color={shapeButtonColor}
					disabled={!canUndo}
					handleClick={() => props.feltApplication.undoRedo.undo()}
				/>
				<IconButton
					icon={<ArrowRedoFilled />}
					color={shapeButtonColor}
					disabled={!canRedo}
					handleClick={() => props.feltApplication.undoRedo.redo()}
				/>
			</ButtonGroup>
		</ButtonBar>
	);
}

export function Canvas(props: { feltApplication: FeltApplication }): JSX.Element {
	useEffect(() => {
		const canvas = document.createElement("canvas");
		canvas.id = "canvas";
		document.getElementById("canvas")?.appendChild(props.feltApplication.pixiApp.canvas);
	}, []);
	return (
		<div className="flex justify-center w-full">
			<div className="w-fit h-fit m-6" id="canvas"></div>
		</div>
	);
}

export function IndexToggle(props: { feltApplication: FeltApplication }) {
	const [, setChecked] = useState(props.feltApplication.showIndex);

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

export function ShapeCount(props: { feltApplication: FeltApplication }) {
	const [fluidCount, setFluidCount] = useState(props.feltApplication.shapeTree.root.length);

	useEffect(() => {
		Tree.on(props.feltApplication.shapeTree.root, "nodeChanged", () => {
			setFluidCount(props.feltApplication.shapeTree.root.length);
		});
	}, []);

	return <div>Shapes: {fluidCount}</div>;
}

export function ConnectionStatus(props: { feltApplication: FeltApplication }) {
	const fluidContainer = props.feltApplication.container;

	const [connectionState, setConnectionState] = useState(fluidContainer.connectionState);

	useEffect(() => {
		fluidContainer.on("connected", () => {
			setConnectionState(fluidContainer.connectionState);
		});
		fluidContainer.on("disconnected", () => {
			setConnectionState(fluidContainer.connectionState);
		});
		fluidContainer.on("disposed", () => {
			setConnectionState(fluidContainer.connectionState);
		});
		fluidContainer.on("dirty", () => {
			setConnectionState(fluidContainer.connectionState);
		});
		fluidContainer.on("saved", () => {
			setConnectionState(fluidContainer.connectionState);
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

export function Audience(props: { feltApplication: FeltApplication }): JSX.Element {
	const audience = props.feltApplication.audience;

	// retrieve all the members currently in the session
	const [members, setMembers] = useState(Array.from(audience.getMembers().values()));

	const setMembersCallback = useCallback(
		() => setMembers(Array.from(audience.getMembers().values())),
		[setMembers, audience],
	);

	// Setup a listener to update our users when new clients join the session
	useEffect(() => {
		audience.on("membersChanged", setMembersCallback);
	}, [audience, setMembersCallback]);

	return <div>Users: {members.length}</div>;
}

export function Header(props: { feltApplication: FeltApplication }): JSX.Element {
	return (
		<div className="h-[48px] flex shrink-0 flex-row items-center justify-between bg-black text-base text-white z-40 w-full">
			<div className="flex m-2">Felt</div>
			<div className="flex m-2 gap-4 ">
				<IndexToggle feltApplication={props.feltApplication} />
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
