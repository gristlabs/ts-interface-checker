const t = require("../../dist/types");

exports.ITest = t.iface([], {
  "string": t.opt(t.union("string", "null")),
  "uint32": t.opt(t.union("number", "null")),
  "inner": t.opt(t.union("IInner", "null")),
  "float": t.opt(t.union("number", "null")),
});

exports.IInner = t.iface([], {
  "int32": t.opt(t.union("number", "null")),
  "innerInner": t.opt(t.union("IInnerInner", "null")),
  "outer": t.opt(t.union("IOuter", "null")),
});

exports.IInnerInner = t.iface([], {
  "long": t.opt(t.union("number", "Long", "null")),
  "enum": t.opt(t.union("Enum", "null")),
  "sint32": t.opt(t.union("number", "null")),
});

exports.Enum = t.union(t.lit(0), t.lit(1), t.lit(2), t.lit(3), t.lit(4));

exports.IOuter = t.iface([], {
  "bool": t.opt(t.union(t.array("boolean"), "null")),
  "double": t.opt(t.union("number", "null")),
});

exports.Long = t.iface([], {
  "low": "number",
  "high": "number",
  "unsigned": "boolean",
});
