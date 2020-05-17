import * as t from "../../lib/types";
// tslint:disable:object-literal-key-quotes

export const Wheels = t.iface([], {
  "numWheels": "number",
});

export const Doors = t.iface([], {
  "numDoors": "number",
});

export const Car = t.intersection("Wheels", "Doors");

export const House = t.intersection("Doors", t.iface([], {
  "numRooms": "number",
}), "object");

export const MixedLiteral = t.intersection(t.union(t.lit(1), t.lit(2)), t.union(t.lit(2), t.lit(3)));

export const SameKeyTypeA = t.iface([], {
  "x": t.iface([], {
    "foo": "string",
  }),
});

export const SameKeyTypeB = t.iface([], {
  "x": t.iface([], {
    "bar": "number",
    "optional": t.opt("number"),
  }),
});

export const SameKeyIntersection = t.intersection("SameKeyTypeA", "SameKeyTypeB");

export const Tuples = t.intersection(t.tuple("string", t.union("string", "null")), t.array("string"));

const exportedTypeSuite: t.ITypeSuite = {
  Wheels,
  Doors,
  Car,
  House,
  MixedLiteral,
  SameKeyTypeA,
  SameKeyTypeB,
  SameKeyIntersection,
  Tuples,
};
export default exportedTypeSuite;
