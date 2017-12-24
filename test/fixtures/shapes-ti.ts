import * as t from "../../lib/types";

export const Square = t.iface([], [
  t.prop("kind", t.lit("square")),
  t.prop("size", "number"),
]);

export const Rectangle = t.iface([], [
  t.prop("kind", t.lit("rectangle")),
  t.prop("width", "number"),
  t.prop("height", "number"),
]);

export const Circle = t.iface([], [
  t.prop("kind", t.lit("circle")),
  t.prop("radius", "number"),
]);

export const Shape = t.union("Square", "Rectangle", "Circle");
