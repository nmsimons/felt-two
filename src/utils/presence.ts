/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	type IPresence,
	Latest as latestStateFactory,
	LatestValueManagerEvents as LatestStateEvents,
	PresenceStates as Workspace,
	LatestValueManager as LatestState,
	ClientConnectionId,
	ClientSessionId,
} from "@fluidframework/presence/alpha";
import { FeltShape } from "./shapes.js";
import { Listenable } from "fluid-framework";

export interface PresenceManager<T> {
	initialState: T;
	state: LatestState<T>;

	clients: {
		getAttendee: (clientId: ClientConnectionId | ClientSessionId) => any;
		getAttendees: () => any;
		getMyself: () => any;
		events: any;
	};
	events: Listenable<LatestStateEvents<T>>;
}

// A function the creates a new SelectionManager instance
// with the given presence and workspace.
export function createSelectionManager(props: {
	presence: IPresence;
	workspace: Workspace<{}>;
	name: string;
}): SelectionManager {
	const { presence, workspace, name } = props;

	class SelectionManagerImpl implements PresenceManager<string[]> {
		initialState: string[] = [];

		state: LatestState<typeof this.initialState>;

		constructor(
			name: string,
			workspace: Workspace<{}>,
			private presence: IPresence,
		) {
			workspace.add(name, latestStateFactory(this.initialState));
			this.state = workspace.props[name];
		}

		public get events(): Listenable<LatestStateEvents<string[]>> {
			return this.state.events;
		}

		public clients = {
			getAttendee: (clientId: ClientConnectionId | ClientSessionId) => {
				return this.presence.getAttendee(clientId);
			},
			getAttendees: () => {
				return this.presence.getAttendees();
			},
			getMyself: () => {
				return this.presence.getMyself();
			},
			events: this.presence.events,
		};

		/** Test if the given id is selected by the local client */
		public testSelection(id: string) {
			return this.state.local.indexOf(id) != -1;
		}

		/** Test if the given id is selected by any remote client */
		public testRemoteSelection(id: string) {
			const remoteSelectedClients: string[] = [];

			for (const cv of this.state.clientValues()) {
				if (cv.client.getConnectionStatus() === "Connected") {
					if (cv.value.indexOf(id) !== -1) {
						remoteSelectedClients.push(cv.client.sessionId);
					}
				}
			}

			return remoteSelectedClients.length > 0;
		}

		/** Clear the current selection */
		public clearSelection() {
			this.state.local = [];
		}

		/** Change the selection to the given id or array of ids */
		public setSelection(id: string | string[]) {
			if (typeof id == "string") {
				id = [id];
			}
			this.state.local = id;
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
			const arr: string[] = this.state.local.slice();
			const i = arr.indexOf(id);
			if (i == -1) {
				arr.push(id);
			}
			this.state.local = arr;
		}

		/** Remove the given id from the selection */
		public removeFromSelection(id: string) {
			const arr: string[] = this.state.local.slice();
			const i = arr.indexOf(id);
			if (i != -1) {
				arr.splice(i, 1);
			}
			this.state.local = arr;
		}

		/** Get the current local selection array */
		public getLocalSelected(): readonly string[] {
			return this.state.local;
		}

		/** Get the current remote selection map where the key is the selected item and the value is an array of client ids */
		public getRemoteSelected(): Map<string, string[]> {
			const remoteSelected = new Map<string, string[]>();
			for (const cv of this.state.clientValues()) {
				if (cv.client.getConnectionStatus() === "Connected") {
					for (const id of cv.value) {
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

	return new SelectionManagerImpl(name, workspace, presence);
}

// The SelectionManager interface
// This interface is used to manage the selection of items in the app.
export interface SelectionManager extends PresenceManager<string[]> {
	testSelection(id: string): boolean;
	testRemoteSelection(id: string): boolean;
	clearSelection(): void;
	setSelection(id: string | string[]): void;
	toggleSelection(id: string): void;
	addToSelection(id: string): void;
	removeFromSelection(id: string): void;
	getLocalSelected(): readonly string[];
	getRemoteSelected(): Map<string, string[]>;
}

// A function that creates a new DragManager instance
// with the given presence and workspace.
export function createDragManager(props: {
	presence: IPresence;
	workspace: Workspace<{}>;
	name: string;
}): DragManager {
	const { presence, workspace, name } = props;

	class DragManagerImpl implements PresenceManager<DragPackage> {
		initialState: DragPackage = {
			id: null,
			x: 0,
			y: 0,
		};

		state: LatestState<DragPackage>;

		constructor(
			name: string,
			workspace: Workspace<{}>,
			private presence: IPresence,
		) {
			workspace.add(name, latestStateFactory<DragPackage>(this.initialState));
			this.state = workspace.props[name];
		}

		public clients = {
			getAttendee: (clientId: ClientConnectionId | ClientSessionId) =>
				this.presence.getAttendee(clientId),
			getAttendees: () => this.presence.getAttendees(),
			getMyself: () => this.presence.getMyself(),
			events: this.presence.events,
		};

		public get events(): Listenable<LatestStateEvents<DragPackage>> {
			return this.state.events;
		}

		/** Indicate that an item is being dragged */
		public setDragging(target: DragPackage) {
			this.state.local = target;
			return;
		}

		// Clear the drag data for the local client
		public clearDragging() {
			this.state.local = { id: null, x: 0, y: 0 };
			return;
		}
	}

	return new DragManagerImpl(name, workspace, presence);
}

// The DragManager interface
// This interface is used to manage the drag and drop functionality in the app.
export interface DragManager extends PresenceManager<DragPackage> {
	setDragging(target: DragPackage): void; // Set the drag target
	clearDragging(): void; // Clear the drag data for the local client
}

export type DragPackage = {
	id: string | null;
	x: number;
	y: number;
};

export const generateDragPackage = (feltShape: FeltShape): DragPackage => {
	return {
		id: feltShape.id,
		x: feltShape.x,
		y: feltShape.y,
	};
};
