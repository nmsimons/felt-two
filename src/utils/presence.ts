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
	LatestMapValueManager as LatestMap,
	LatestMapValueManagerEvents as LatestMapEvents,
	LatestMap as latestMapFactory,
	ClientSessionId,
	ClientConnectionId,
	ISessionClient as SessionClient,
	PresenceEvents,
} from "@fluidframework/presence/alpha";
import { FeltShape } from "./shapes.js";
import { Listenable } from "fluid-framework";

interface presenceClients {
	getAttendee: (clientId: ClientConnectionId | ClientSessionId) => SessionClient;
	getAttendees: () => ReadonlySet<SessionClient>;
	getMyself: () => SessionClient;
	events: Listenable<PresenceEvents>;
}

export interface PresenceManager<T> {
	initialState: T;
	state: LatestState<T>;
	clients: presenceClients;
	events: Listenable<LatestStateEvents<T>>;
}

export interface PresenceMapManager<T> {
	state: LatestMap<T>;
	clients: presenceClients;
	events: Listenable<LatestMapEvents<T, string>>;
}

// A function the creates a new SelectionManager instance
// with the given presence and workspace.
export function createSelectionManager(props: {
	presence: IPresence;
	workspace: Workspace<{}>;
	name: string;
}): SelectionManager {
	const { presence, workspace, name } = props;

	class SelectionManagerImpl implements PresenceManager<SelectionPackage> {
		initialState: SelectionPackage = { selected: [] };

		state: LatestState<typeof this.initialState>;

		constructor(
			name: string,
			workspace: Workspace<{}>,
			private presence: IPresence,
		) {
			workspace.add(name, latestStateFactory(this.initialState));
			this.state = workspace.props[name];
		}

		public get events(): Listenable<LatestStateEvents<SelectionPackage>> {
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
			return this.state.local.selected.includes(id);
		}

		/** Test if the given id is selected by any remote client */
		public testRemoteSelection(id: string): string[] {
			const remoteSelectedClients: string[] = [];
			for (const cv of this.state.clientValues()) {
				if (cv.client.getConnectionStatus() === "Connected") {
					if (cv.value.selected.includes(id)) {
						remoteSelectedClients.push(cv.client.sessionId);
					}
				}
			}
			return remoteSelectedClients;
		}

		/** Clear the current selection */
		public clearSelection() {
			this.state.local = this.initialState;
		}

		/** Change the selection to the given id or array of ids */
		public setSelection(id: string | string[]) {
			if (typeof id == "string") {
				id = [id];
			}
			this.state.local = { selected: id };
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
			const arr: string[] = this.state.local.selected.slice();
			const i = arr.indexOf(id);
			if (i == -1) {
				arr.push(id);
			}
			this.state.local = { selected: arr };
		}

		/** Remove the given id from the selection */
		public removeFromSelection(id: string) {
			const arr: string[] = this.state.local.selected.slice();
			const i = arr.indexOf(id);
			if (i != -1) {
				arr.splice(i, 1);
			}
			this.state.local = { selected: arr };
		}

		/** Get the current local selection array */
		public getLocalSelected(): readonly string[] {
			return this.state.local.selected;
		}

		/** Get the current remote selection map where the key is the selected item and the value is an array of client ids */
		public getRemoteSelected(): Map<string, string[]> {
			const remoteSelected = new Map<string, string[]>();
			for (const cv of this.state.clientValues()) {
				if (cv.client.getConnectionStatus() === "Connected") {
					for (const id of cv.value.selected) {
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
export interface SelectionManager extends PresenceManager<SelectionPackage> {
	testSelection(id: string): boolean;
	testRemoteSelection(id: string): string[];
	clearSelection(): void;
	setSelection(id: string | string[]): void;
	toggleSelection(id: string): void;
	addToSelection(id: string): void;
	removeFromSelection(id: string): void;
	getLocalSelected(): readonly string[];
	getRemoteSelected(): Map<string, string[]>;
}

export type SelectionPackage = {
	selected: string[];
};

// A function that creates a new DragManager instance
// with the given presence and workspace.
export function createDragManager(props: {
	presence: IPresence;
	workspace: Workspace<{}>;
	name: string;
}): DragManager {
	const { presence, workspace, name } = props;

	class DragManagerImpl implements PresenceManager<DragPackage | null> {
		initialState: DragPackage | null = null;
		state: LatestState<DragPackage | null>;

		constructor(
			name: string,
			workspace: Workspace<{}>,
			private presence: IPresence,
		) {
			// @ts-expect-error - This is a known issue with the latestStateFactory type
			workspace.add(name, latestStateFactory<DragPackage | null>(this.initialState));
			this.state = workspace.props[name];
		}

		public clients = {
			getAttendee: (clientId: ClientConnectionId | ClientSessionId) =>
				this.presence.getAttendee(clientId),
			getAttendees: () => this.presence.getAttendees(),
			getMyself: () => this.presence.getMyself(),
			events: this.presence.events,
		};

		public get events(): Listenable<LatestStateEvents<DragPackage | null>> {
			return this.state.events;
		}

		/** Indicate that an item is being dragged */
		public setDragging(target: DragPackage) {
			this.state.local = target;
		}

		// Clear the drag data for the local client
		public clearDragging() {
			this.state.local = null;
		}
	}

	return new DragManagerImpl(name, workspace, presence);
}

// The DragManager interface
// This interface is used to manage the drag and drop functionality in the app.
export interface DragManager extends PresenceManager<DragPackage | null> {
	setDragging(target: DragPackage): void; // Set the drag target
	clearDragging(): void; // Clear the drag data for the local client
}

export type DragPackage = {
	id: string;
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
