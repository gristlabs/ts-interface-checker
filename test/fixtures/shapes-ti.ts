import * as t from "../../lib/types";
// tslint:disable:object-literal-key-quotes

export const Square = t.iface([], {
  "kind": t.lit("square"),
  "size": "number",
});

export const Rectangle = t.iface([], {
  "kind": t.lit("rectangle"),
  "width": "number",
  "height": "number",
});

export const Circle = t.iface([], {
  "kind": t.lit("circle"),
  "radius": "number",
});

export const Shape = t.union("Square", "Rectangle", "Circle");

const exportedTypeSuite: t.ITypeSuite = {
  Square,
  Rectangle,
  Circle,
  Shape,
};
export default exportedTypeSuite;
