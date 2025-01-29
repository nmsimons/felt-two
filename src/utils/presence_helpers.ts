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

export class SelectionManager extends EventTarget {
	statesName: `${string}:${string}` = "shape:selection";

	statesSchema = {
		// sets selected to an array of strings
		selected: Latest({ items: [] as string[] }),
	} satisfies PresenceStatesSchema;

	private valueManager: PresenceStatesEntries<typeof this.statesSchema>["selected"];
	private sessionId: string;

	constructor(presence: IPresence) {
		super();
		this.valueManager = presence.getStates(this.statesName, this.statesSchema).props.selected;
		this.valueManager.events.on("updated", () =>
			this.dispatchEvent(new Event("selectionChanged")),
		);
		presence.events.on("attendeeDisconnected", () => {
			this.dispatchEvent(new Event("selectionChanged"));
		});
		this.sessionId = presence.getMyself().sessionId;
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
	public changeSelection(id: string | string[]) {
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
			this.removeItemFromSelection(id);
			return;
		} else {
			this.addItemToSelection(id);
		}
		return;
	}

	/** Add the given id to the selection */
	public addItemToSelection(id: string) {
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
	public removeItemFromSelection(id: string) {
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
