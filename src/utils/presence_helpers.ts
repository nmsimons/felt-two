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
	statesName: `${string}:${string}` = "name:brainstorm-presence";

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
		this.sessionId = presence.getMyself().sessionId;
	}

	public testSelection(id: string) {
		return this.valueManager.local.items.indexOf(id) != -1;
	}

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

	public updateSelection(id: string | string[]) {
		if (typeof id == "string") {
			let arr: string[] = [];
			const i = this.valueManager.local.items.indexOf(id);
			if (i == -1) {
				arr = [id];
				this.valueManager.local = { items: arr };
				// emit an event to notify the app that the selection has changed
				this.dispatchEvent(new Event("selectionChanged"));
			}
		} else {
			this.valueManager.local = { items: id };
			// emit an event to notify the app that the selection has changed
			this.dispatchEvent(new Event("selectionChanged"));
		}
		return;
	}

	public toggleSelection(id: string) {
		const arr: string[] = this.valueManager.local.items.slice();
		const i = arr.indexOf(id);
		if (i == -1) {
			arr.push(id);
		} else {
			arr.splice(i, 1);
		}
		this.valueManager.local = { items: arr };

		// emit an event to notify the app that the selection has changed
		this.dispatchEvent(new Event("selectionChanged"));

		return;
	}

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

	public getLocalSelected(): readonly string[] {
		return this.valueManager.local.items;
	}

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

	public dispose() {
		this.valueManager.events.off("updated", () =>
			this.dispatchEvent(new Event("selectionChanged")),
		);
	}
}
