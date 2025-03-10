import { AzureClient } from "@fluidframework/azure-client";
import { loadApp } from "../app_load.js";
import { clientProps, devtoolsLogger } from "../infra/azure/azureClientProps.js";
import { AttachState } from "fluid-framework";
import { initializeDevtools } from "@fluidframework/devtools/beta";

export async function anonymousAzureStart() {
	// Get the root container id from the URL
	// If there is no container id, then the app will make
	// a new container.
	let containerId = location.hash.substring(1);

	const client = new AzureClient(clientProps);

	// Load the app
	const container = await loadApp(client, containerId);

	// Initialize the Devtools passing the logger and your Container.
	// The Container could be added later as well with devtools.registerContainerDevtools().
	const devtools = initializeDevtools({
		logger: devtoolsLogger,
		initialContainers: [
			{
				container,
				containerKey: "My Container",
			},
		],
	});

	// If the app is in a `createNew` state - no containerId, and the container is detached, we attach the container.
	// This uploads the container to the service and connects to the collaboration session.
	if (container.attachState === AttachState.Detached) {
		containerId = await container.attach();

		// The newly attached container is given a unique ID that can be used to access the container in another session
		history.replaceState(undefined, "", "#" + containerId);
	}
}
