/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	type IPresence,
	Latest as defineState,
	type PresenceStatesSchema,
	type PresenceStatesEntries,
	LatestMap,
} from "@fluidframework/presence/alpha";
import { FeltShape } from "./shapes.js";

export class SelectionManager {
	statesName: `${string}:${string}` = "shape:selection";

	selectedType = defineState({ items: [] as string[] });

	statesSchema = {
		// sets selected to an array of strings
		selected: this.selectedType,
	} satisfies PresenceStatesSchema;

	statesSchema2 = {
		// sets selected to an array of strings
		selected: LatestMap({ items: [] as number[] }),
	} satisfies PresenceStatesSchema;

	private selectionState: PresenceStatesEntries<typeof this.statesSchema>["selected"];
	private presence: IPresence;

	constructor(presence: IPresence) {
		this.selectionState = presence.getStates(this.statesName, this.statesSchema).props.selected;
		this.presence = presence;
	}

	public events = {
		onRemoteUpdate: (callback: () => void) => {
			return this.selectionState.events.on("updated", callback);
		},
		onLocalUpdate: (callback: () => void) => {
			return this.selectionState.events.on("localUpdated", callback);
		},
		onAttendeeJoined: (callback: () => void) => {
			return this.presence.events.on("attendeeJoined", callback);
		},
		onAttendeeDisconnected: (callback: () => void) => {
			return this.presence.events.on("attendeeDisconnected", callback);
		},
	};

	/** Test if the given id is selected by the local client */
	public testSelection(id: string) {
		return this.selectionState.local.items.indexOf(id) != -1;
	}

	/** Test if the given id is selected by any remote client */
	public testRemoteSelection(id: string) {
		const remoteSelectedClients: string[] = [];

		for (const cv of this.selectionState.clientValues()) {
			if (cv.client.getConnectionStatus() === "Connected") {
				if (cv.value.items.indexOf(id) !== -1) {
					remoteSelectedClients.push(cv.client.sessionId);
				}
			}
		}

		return remoteSelectedClients.length > 0;
	}

	/** Clear the current selection */
	public clearSelection() {
		this.selectionState.local = { items: [] };
	}

	/** Change the selection to the given id or array of ids */
	public setSelection(id: string | string[]) {
		if (typeof id == "string") {
			id = [id];
		}
		this.selectionState.local = { items: id };
	}

	/** Toggle the selection of the given id */
	public toggleSelection(id: string) {
		if (this.testSelection(id)) {
			this.removeFromSelection(id);
			return;
		} else {
			this.addToSelection(id);
		}
		return;
	}

	/** Add the given id to the selection */
	public addToSelection(id: string) {
		const arr: string[] = this.selectionState.local.items.slice();
		const i = arr.indexOf(id);
		if (i == -1) {
			arr.push(id);
		}
		this.selectionState.local = { items: arr };
	}

	/** Remove the given id from the selection */
	public removeFromSelection(id: string) {
		const arr: string[] = this.selectionState.local.items.slice();
		const i = arr.indexOf(id);
		if (i != -1) {
			arr.splice(i, 1);
		}
		this.selectionState.local = { items: arr };
	}

	/** Get the current local selection array */
	public getLocalSelected(): readonly string[] {
		return this.selectionState.local.items;
	}

	/** Get the current remote selection map where the key is the selected item and the value is an array of client ids */
	public getRemoteSelected(): Map<string, string[]> {
		const remoteSelected = new Map<string, string[]>();
		for (const cv of this.selectionState.clientValues()) {
			if (cv.client.getConnectionStatus() === "Connected") {
				for (const id of cv.value.items) {
					if (!remoteSelected.has(id)) {
						remoteSelected.set(id, []);
					}
					remoteSelected.get(id)?.push(cv.client.sessionId);
				}
			}
		}

		return remoteSelected;
	}
}

export class DragManager {
	statesName: `${string}:${string}` = "shape:dragging";

	statesSchema = {
		// sets dragging to an object with id, x, and y properties
		dragging: defineState({
			id: null,
			x: 0,
			y: 0,
		} as DragPackage),
	} satisfies PresenceStatesSchema;

	private dragState: PresenceStatesEntries<typeof this.statesSchema>["dragging"];

	constructor(presence: IPresence) {
		this.dragState = presence.getStates(this.statesName, this.statesSchema).props.dragging;
	}

	public updateEvent = {
		on: (callback: () => void) => {
			this.dragState.events.on("updated", callback);
		},
	};

	/** Indicate that an item is being dragged */
	public setDragging(target: DragPackage) {
		this.dragState.local = target;
		return;
	}

	/** Get the current drag target */
	public getDragTargetData() {
		return this.dragState.clientValues();
	}

	// Clear the drag data for the local client
	public clearDragging() {
		this.dragState.local = { id: null, x: 0, y: 0 };
		return;
	}
}

export interface DragPackage {
	id: string | null;
	x: number;
	y: number;
}

export const generateDragPackage = (feltShape: FeltShape): DragPackage => {
	return {
		id: feltShape.id,
		x: feltShape.x,
		y: feltShape.y,
	};
};
