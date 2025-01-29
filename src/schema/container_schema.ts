/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import { Signaler } from "@fluid-experimental/data-objects";
import {
	ExperimentalPresenceDO,
	ExperimentalPresenceManager,
} from "@fluidframework/presence/alpha";
import { ContainerSchema, SharedObjectKind, SharedTree } from "fluid-framework";

// Define the schema of our Container. This includes the DDSes/DataObjects
// that we want to create dynamically and any
// initial DataObjects we want created when the container is first created.
export const containerSchema = {
	initialObjects: {
		appData: SharedTree,
		presence:
			ExperimentalPresenceManager as unknown as SharedObjectKind<ExperimentalPresenceDO>,
		signalManager: Signaler,
	},
} satisfies ContainerSchema;
