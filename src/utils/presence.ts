import { Shape } from "../schema/app_schema.js";

export function removeUserFromPresenceArray({
	userId,
	shape,
}: {
	userId: string;
	shape: Shape;
}): void {
	// Remove the user from the presence array
}

export function addUserToPresenceArray({ userId, shape }: { userId: string; shape: Shape }): void {
	// Add the user to the presence array
}

export function shouldShowPresence(shape: Shape, userId: string): boolean {
	// Check if the user is in the presence array
	return false;
}

export function userIsInPresenceArray(shape: Shape, userId: string): boolean {
	// Check if the user is in the presence array
	return false;
}

export function clearPresence(userId: string) {
	// Clear the presence array
}
