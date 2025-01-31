/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	type IPresence,
	Latest,
	type PresenceStatesSchema,
	type PresenceStatesEntries,
} from "@fluidframework/presence/alpha";
import { FeltShape } from "./shapes.js";

export class SelectionManager extends EventTarget {
	statesName: `${string}:${string}` = "shape:selection";

	statesSchema = {
		// sets selected to an array of strings
		selected: Latest({ items: [] as string[] }),
	} satisfies PresenceStatesSchema;

	private valueManager: PresenceStatesEntries<typeof this.statesSchema>["selected"];

	constructor(presence: IPresence) {
		super();
		this.valueManager = presence.getStates(this.statesName, this.statesSchema).props.selected;

		// when the selection changes, emit an event to notify the app that the selection has changed
		this.valueManager.events.on("updated", () =>
			this.dispatchEvent(new Event("selectionChanged")),
		);

		// when an attendee disconnects, update the selection
		presence.events.on("attendeeDisconnected", () => {
			this.dispatchEvent(new Event("selectionChanged"));
		});
	}

	/** Test if the given id is selected by the local client */
	public testSelection(id: string) {
		return this.valueManager.local.items.indexOf(id) != -1;
	}

	/** Test if the given id is selected by any remote client */
	public testRemoteSelection(id: string) {
		const remoteSelectedClients: string[] = [];

		for (const cv of this.valueManager.clientValues()) {
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
		this.valueManager.local = { items: [] };
		// emit an event to notify the app that the selection has changed
		this.dispatchEvent(new Event("selectionChanged"));
		return;
	}

	/** Change the selection to the given id or array of ids */
	public setSelection(id: string | string[]) {
		if (typeof id == "string") {
			id = [id];
		}
		this.valueManager.local = { items: id };
		// emit an event to notify the app that the selection has changed
		this.dispatchEvent(new Event("selectionChanged"));
		return;
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
		const arr: string[] = this.valueManager.local.items.slice();
		const i = arr.indexOf(id);
		if (i == -1) {
			arr.push(id);
		}
		this.valueManager.local = { items: arr };

		// emit an event to notify the app that the selection has changed
		this.dispatchEvent(new Event("selectionChanged"));

		return;
	}

	/** Remove the given id from the selection */
	public removeFromSelection(id: string) {
		const arr: string[] = this.valueManager.local.items.slice();
		const i = arr.indexOf(id);
		if (i != -1) {
			arr.splice(i, 1);
		}
		this.valueManager.local = { items: arr };

		// emit an event to notify the app that the selection has changed
		this.dispatchEvent(new Event("selectionChanged"));

		return;
	}

	/** Get the current local selection array */
	public getLocalSelected(): readonly string[] {
		return this.valueManager.local.items;
	}

	/** Get the current remote selection map where the key is the selected item and the value is an array of client ids */
	public getRemoteSelected(): Map<string, string[]> {
		const remoteSelected = new Map<string, string[]>();
		for (const cv of this.valueManager.clientValues()) {
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
		dragging: Latest({
			id: "",
			x: 0,
			y: 0,
		} as DragPackage),
	} satisfies PresenceStatesSchema;

	private valueManager: PresenceStatesEntries<typeof this.statesSchema>["dragging"];

	constructor(presence: IPresence) {
		this.valueManager = presence.getStates(this.statesName, this.statesSchema).props.dragging;
	}

	public updateEvent = {
		on: (callback: () => void) => {
			this.valueManager.events.on("updated", callback);
		},
	};

	/** Indicate that an item is being dragged */
	public setDragging(target: DragPackage) {
		this.valueManager.local = target;
		return;
	}

	/** Get the current drag target */
	public getDragTargetData() {
		return this.valueManager.clientValues();
	}

	// Clear the drag data for the local client
	public clearDragging() {
		this.valueManager.local = { id: "", x: 0, y: 0 };
		return;
	}
}

export interface DragPackage {
	id: string;
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
