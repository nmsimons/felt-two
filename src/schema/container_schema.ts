/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { ContainerSchema, SharedTree } from "fluid-framework";
import { Signaler } from "@fluid-experimental/data-objects";

// Define the schema of our Container. This includes the DDSes/DataObjects
// that we want to create dynamically and any
// initial DataObjects we want created when the container is first created.
export const containerSchema = {
	initialObjects: {
		signalManager: Signaler as any,
		appData: SharedTree,
		sessionData: SharedTree,
	},
} satisfies ContainerSchema;
