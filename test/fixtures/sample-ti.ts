import * as t from "../../lib/types";

export const ICacheItem = t.iface([], {
  "key": "string",
  "value": "any",
  "size": "number",
  "tag": t.opt("string"),
});

export const ILRUCache = t.iface([], {
  "capacity": "number",
  "set": t.func("boolean", t.param("item", "ICacheItem"), t.param("overwrite", "boolean", true)),
  "get": t.func("ICacheItem", t.param("key", "string")),
});

export const MyType = t.union("boolean", "number", "ILRUCache");

export const ISampling = t.iface(["ICacheItem"], {
  "xstring": "string",
  "xstring2": "string",
  "xany": "any",
  "xnumber": "number",
  "xnumber2": t.opt("number"),
  "xnull": "null",
  "xMyType": "MyType",
  "xarray": t.array("string"),
  "xarray2": t.array("MyType"),
  "xtuple": t.tuple("string", "number"),
  "xunion": t.union("number", "null"),
  "xparen": t.union("number", "string"),
  "xiface": t.iface([], {
    "foo": "string",
    "bar": "number",
  }),
  "xliteral": t.union(t.lit("foo"), t.lit("ba\"r"), t.lit(3)),
  "xfunc": t.func("number", t.param("price", "number"), t.param("quantity", "number")),
  "xfunc2": t.func("number", t.param("price", "number"), t.param("quantity", "number", true)),
});
