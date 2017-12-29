// tslint:disable:object-literal-key-quotes
import * as t from "../../lib/types";

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
