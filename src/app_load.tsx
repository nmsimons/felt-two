import { OdspClient } from "@fluidframework/odsp-client/beta";
import { AzureClient } from "@fluidframework/azure-client";
import React from "react";
import { createRoot } from "react-dom/client";
import { ReactApp } from "./react/ux.js";
import { appTreeConfiguration } from "./schema/app_schema.js";
import { sessionTreeConfiguration } from "./schema/session_schema.js";
import { containerSchema } from "./schema/container_schema.js";
import { loadFluidData } from "./infra/fluid.js";
import { IFluidContainer } from "fluid-framework";
import { ISignaler } from "@fluid-experimental/data-objects";
import { FeltApplication } from "./utils/application.js";

export async function loadApp(
	client: AzureClient | OdspClient,
	containerId: string,
): Promise<IFluidContainer> {
	// Initialize Fluid Container
	const { services, container } = await loadFluidData(containerId, containerSchema, client);

	// Initialize the SharedTree DDSes
	const appTree = container.initialObjects.appData.viewWith(appTreeConfiguration);
	if (appTree.compatibility.canInitialize) {
		appTree.initialize([]);
	}

	const sessionTree = container.initialObjects.sessionData.viewWith(sessionTreeConfiguration);
	if (sessionTree.compatibility.canInitialize) {
		sessionTree.initialize({ clients: [] });
	}

	// initialize signal manager
	const signaler = container.initialObjects.signalManager as ISignaler;

	// create the root element for React
	const app = document.createElement("div");
	app.id = "app";
	document.body.appendChild(app);
	const root = createRoot(app);

	const feltApplication = await FeltApplication.build(
		appTree,
		container,
		services.audience,
		signaler,
		sessionTree,
	);

	// Render the app - note we attach new containers after render so
	// the app renders instantly on create new flow. The app will be
	// interactive immediately.
	root.render(<ReactApp feltApplication={feltApplication} />);

	// disable right-click context menu since right-click is reserved
	document.addEventListener("contextmenu", (event) => event.preventDefault());

	return container;
}
