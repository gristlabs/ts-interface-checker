import * as t from "../../lib/types";
// tslint:disable:object-literal-key-quotes

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

export const NumberAlias = t.name("number");

export const NumberAlias2 = t.name("NumberAlias");

export const SomeEnum = t.enumtype({
  "Foo": 0,
  "Bar": 1,
});

export const Direction = t.enumtype({
  "Up": 1,
  "Down": 2,
  "Left": 17,
  "Right": 18,
});

export const DirectionStr = t.enumtype({
  "Up": "UP",
  "Down": "DOWN",
  "Left": "LEFT",
  "Right": "RIGHT",
});

export const BooleanLikeHeterogeneousEnum = t.enumtype({
  "No": 0,
  "Yes": "YES",
});

export const EnumComputed = t.enumtype({
  "Foo": 0,
  "Bar": 17,
  "Baz": 16,
});

export const AnimalFlags = t.enumtype({
  "None": 0,
  "HasClaws": 1,
  "CanFly": 2,
  "EatsFish": 4,
  "Endangered": 8,
});

export const ISampling = t.iface(["ICacheItem"], {
  "xstring": "string",
  "xstring2": "string",
  "xany": "any",
  "xnumber": "number",
  "xnumber2": t.opt("number"),
  "xNumberAlias": "NumberAlias",
  "xNumberAlias2": "NumberAlias2",
  "xnull": "null",
  "xMyType": "MyType",
  "xarray": t.array("string"),
  "xarray2": t.array("MyType"),
  "xtuple": t.tuple("string", "number"),
  "xopttuple": t.tuple("string", t.opt("number")),
  "xunion": t.union("number", "null"),
  "xparen": t.union("number", "string"),
  "xiface": t.iface([], {
    "foo": "string",
    "bar": "number",
  }),
  "xliteral": t.union(t.lit("foo"), t.lit("ba\"r"), t.lit(3)),
  "xfunc": t.func("number", t.param("price", "number"), t.param("quantity", "number")),
  "xfunc2": t.func("number", t.param("price", "number"), t.param("quantity", "number", true)),
  "xDirection": "Direction",
  "xDirectionStr": "DirectionStr",
  "xDirUp": t.union(t.enumlit("Direction", "Up"), t.enumlit("Direction", "Left")),
  "xDirStrLeft": t.enumlit("DirectionStr", "Left"),
  "ximplicit": "any",
  "ximplicitFunc": t.func("number", t.param("price", "any")),
  "ximplicitFunc2": t.func("any", t.param("price", "any")),
});

const exportedTypeSuite: t.ITypeSuite = {
  ICacheItem,
  ILRUCache,
  MyType,
  NumberAlias,
  NumberAlias2,
  SomeEnum,
  Direction,
  DirectionStr,
  BooleanLikeHeterogeneousEnum,
  EnumComputed,
  AnimalFlags,
  ISampling,
};
export default exportedTypeSuite;
