import * as t from "../../lib/types"
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
}));

const exportedTypeSuite: t.ITypeSuite = {
  Wheels,
  Doors,
  Car,
  House,
};
export default exportedTypeSuite;
