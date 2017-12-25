const t = require("../../dist/types");

exports.ITest = t.iface([], [
  t.prop("string", t.union("string", "null"), true),
  t.prop("uint32", t.union("number", "null"), true),
  t.prop("inner", t.union("IInner", "null"), true),
  t.prop("float", t.union("number", "null"), true),
]);

exports.IInner = t.iface([], [
  t.prop("int32", t.union("number", "null"), true),
  t.prop("innerInner", t.union("IInnerInner", "null"), true),
  t.prop("outer", t.union("IOuter", "null"), true),
]);

exports.IInnerInner = t.iface([], [
  t.prop("long", t.union("number", "Long", "null"), true),
  t.prop("enum", t.union("Enum", "null"), true),
  t.prop("sint32", t.union("number", "null"), true),
]);

exports.Enum = t.union(t.lit(0), t.lit(1), t.lit(2), t.lit(3), t.lit(4));

exports.IOuter = t.iface([], [
  t.prop("bool", t.union(t.array("boolean"), "null"), true),
  t.prop("double", t.union("number", "null"), true),
]);

exports.Long = t.iface([], [
  t.prop("low", "number"),
  t.prop("high", "number"),
  t.prop("unsigned", "boolean"),
]);
