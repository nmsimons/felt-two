import { TreeConfiguration, SchemaFactory } from "fluid-framework";

// Schema is defined using a factory object that generates classes for objects as well
// as list and map nodes.

// Include a UUID to guarantee that this schema will be uniquely identifiable.
// As this schema uses a recursive type, the beta SchemaFactoryRecursive is used instead of just SchemaFactory.
const sf = new SchemaFactory("fc1db2e8-0a00-11ee-be56-0242ac120002");

export class Shape extends sf.object("Shape", {
	id: sf.string,
	x: sf.number,
	y: sf.number,
	color: sf.string,
	shapeType: sf.string,
}) {}

export class Shapes extends sf.array("Shapes", Shape) {}

// Export the tree config appropriate for this schema.
// This is passed into the SharedTree when it is initialized.
export const appTreeConfiguration = new TreeConfiguration(
	// Schema for the root
	Shapes,
	// initial tree
	() => [],
);
