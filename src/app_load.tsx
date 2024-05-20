import { OdspClient } from "@fluid-experimental/odsp-client";
import { AzureClient } from "@fluidframework/azure-client";
import React from "react";
import { createRoot } from "react-dom/client";
import { ReactApp } from "./react/ux.js";
import { appTreeConfiguration } from "./schema/app_schema.js";
import { sessionTreeConfiguration } from "./schema/session_schema.js";
import { createUndoRedoStacks } from "./utils/undo.js";
import { containerSchema } from "./schema/container_schema.js";
import { loadFluidData } from "./infra/fluid.js";
import { IFluidContainer } from "fluid-framework";
import { Signaler } from "@fluid-experimental/data-objects";
import { FeltApplication } from "./utils/application.js";

export async function loadApp(
	client: AzureClient | OdspClient,
	containerId: string,
): Promise<IFluidContainer> {
	// Initialize Fluid Container
	const { services, container } = await loadFluidData(containerId, containerSchema, client);

	// Initialize the SharedTree DDSes
	const sessionTree = container.initialObjects.sessionData.schematize(sessionTreeConfiguration);
	const appTree = container.initialObjects.appData.schematize(appTreeConfiguration);

	// initialize signal manager
	const signaler = container.initialObjects.signalManager as Signaler;

	// create the root element for React
	const app = document.createElement("div");
	app.id = "app";
	document.body.appendChild(app);
	const root = createRoot(app);

	// Create undo/redo stacks for the app
	const undoRedo = createUndoRedoStacks(appTree.events);

	const feltApplication = await FeltApplication.build(
		appTree,
		container,
		services.audience,
		signaler,
	);

	// Render the app - note we attach new containers after render so
	// the app renders instantly on create new flow. The app will be
	// interactive immediately.
	root.render(<ReactApp feltApplication={feltApplication} undoRedo={undoRedo} />);

	// disable right-click context menu since right-click is reserved
	document.addEventListener("contextmenu", (event) => event.preventDefault());

	return container;
}
