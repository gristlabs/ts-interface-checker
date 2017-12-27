import {assert} from "chai";
import {createCheckers} from "../lib/index";
import * as t from "../lib/types";
import * as sample from "./fixtures/sample-ti";
import * as shapes from "./fixtures/shapes-ti";

function noop() { /* noop */ }

describe("ts-interface-checker", () => {
  it("should validate data", () => {
    const {ICacheItem} = createCheckers({ICacheItem: sample.ICacheItem});

    // Plain check of a valid object.
    ICacheItem.check({key: "foo", value: {}, size: 17, tag: "baz"});

    // Object with an optional property missing. This should pass strict check too.
    ICacheItem.check({key: "foo", value: {}, size: 17});
    ICacheItem.strictCheck({key: "foo", value: {}, size: 17});

    // Type of a field is invalid.
    assert.throws(() => ICacheItem.check({key: "foo", value: {}, size: "text", tag: "baz"}),
      "value.size is not a number");

    // The whole object is of wrong type.
    assert.throws(() => ICacheItem.check("hello"), "value is not an object");

    // Extra property is OK with plain check(), but fails with strictCheck().
    ICacheItem.check({key: "foo", value: {}, size: 17, extra: "baz"});
    assert.throws(() => ICacheItem.strictCheck({key: "foo", value: {}, size: 17, extra: "baz"}),
      "value.extra is extraneous");
  });

  it("should produce helpful errors", () => {
    const {ICacheItem} = createCheckers(sample);
    assert.throws(() => ICacheItem.check({key: "foo", value: {}, size: null, tag: "baz"}),
      /^value\.size is not a number$/);
    assert.throws(() => ICacheItem.check({key: "foo", value: {}, tag: "baz"}),
      "value.size is missing");
    assert.throws(() => ICacheItem.check({value: {}, tag: "baz"}),
      "value.key is missing");
  });

  it("should support unions", () => {
    const {Type} = createCheckers({
      Type: t.union("string", "number", "null", t.iface([], [t.prop("foo", "string")])),
    });
    Type.check("hello");
    Type.check(-17.5);
    Type.check(null);
    Type.check({foo: "bar"});
    assert.throws(() => Type.check(undefined), "value is none of string, number, null, 1 more");
    assert.throws(() => Type.check([]),
      "value is none of string, number, null, 1 more, value.foo is missing");
    assert.throws(() => Type.check({foo: 17}),
      "value is none of string, number, null, 1 more, value.foo is not a string");
    assert.throws(() => Type.check({}),
      "value is none of string, number, null, 1 more, value.foo is missing");
  });

  it("should generate good messages for complex unions", () => {
    const {Type} = createCheckers({
      Foo: t.iface([], [t.prop("foo", "number")]),
      Type: t.union(t.iface([], [t.prop("a", "Foo")]),
                    t.iface([], [t.prop("a", "number")])),
    });
    Type.check({a: 12});
    Type.check({a: {foo: 12}});
    assert.throws(() => Type.check({a: "x"}), /^value is none of 2 types, value.a is not a number$/);
    assert.throws(() => Type.check({a: {foo: "x"}}),
      /^value is none of 2 types, value.a is not a Foo, value.a.foo is not a number$/);
  });

  it("should support tuples", () => {
    const {Type} = createCheckers({
      Type: t.tuple("string", "number", t.iface([], [t.prop("foo", "string")])),
    });
    Type.check(["hello", 4.5, {foo: "bar"}]);
    Type.check(["hello", 4.5, {foo: "bar"}, "baz"]);
    assert.throws(() => Type.check(undefined), "value is not an array");
    assert.throws(() => Type.check([]), "value[0] is not a string");
    assert.throws(() => Type.check([4.5, "hello", {foo: "bar"}]), "value[0] is not a string");
    assert.throws(() => Type.check(["hello", 4.5]), "value[2] is not an object");
    assert.throws(() => Type.strictCheck(["x", 4, {foo: "bar"}, "baz"]), "value[3] is extraneous");
  });

  it("should support arrays", () => {
    const {Type} = createCheckers({Type: t.array(t.iface([], [t.prop("foo", "string")]))});
    Type.check([]);
    Type.check([{foo: "bar"}, {foo: ""}]);
    assert.throws(() => Type.check(undefined), "value is not an array");
    assert.throws(() => Type.check({}), "value is not an array");
    assert.throws(() => Type.check([null]), "value[0] is not an object");
    assert.throws(() => Type.check([{foo: "bar"}, {foo: 17}]), "value[1].foo is not a string");
    assert.throws(() => Type.check([{foo: "bar"}, {bar: "foo"}]), "value[1].foo is missing");
  });

  it("should support literals", () => {
    const tt = createCheckers({
      foo: t.lit("foo"), num: t.lit(17), flag: t.lit(true),
      union: t.union(t.lit("foo"), t.lit("bar"), t.lit("baz")),
    });
    tt.foo.check("foo");
    tt.num.check(17);
    tt.flag.check(true);
    tt.union.check("foo");
    tt.union.check("bar");
    tt.union.check("baz");

    assert.throws(() => tt.foo.check("bar"), "value is not \"foo\"");
    assert.throws(() => tt.foo.check(17), "value is not \"foo\"");
    assert.throws(() => tt.num.check("foo"), "value is not 17");
    assert.throws(() => tt.flag.check(false), "value is not true");
    assert.throws(() => tt.union.check("FOO"), /^value is none of 3 types, value is not "baz"$/);
    assert.throws(() => tt.union.check(undefined), /^value is none of 3 types, value is not "baz"$/);
  });

  it("should handle discriminated unions", () => {
    const {Shape} = createCheckers(shapes);
    Shape.check({kind: "square", size: 17});
    Shape.check({kind: "rectangle", width: 17, height: 4});
    Shape.check({kind: "circle", radius: 0.5});

    // Extraneous property.
    Shape.check({kind: "square", size: 17, depth: 5});
    assert.throws(() => Shape.strictCheck({kind: "square", size: 17, depth: 5}),
      /^value is none of Square, Rectangle, Circle, value is not a Square, value.depth is extraneous$/);

    // Mismatching or missing kind.
    assert.throws(() => Shape.check({kind: "square", width: 17, height: 4}),
      /value.size is missing/);
    assert.throws(() => Shape.check({kind: "rectangle", radius: 0.5}),
      /^value is none of Square, Rectangle, Circle, value is not a Rectangle, value.width is missing$/);
    assert.throws(() => Shape.check({width: 17, height: 4}), /value.kind is missing/);

    // Missing or misspelled property.
    assert.throws(() => Shape.check({kind: "rectangle", height: 4}), /value.width is missing/);
    assert.throws(() => Shape.check({kind: "circle", Radius: 0.5}), /value.radius is missing/);
  });

  it("should fail early when suite is missing types", () => {
    assert.throws(() => createCheckers({Invalid: t.name("InvalidName")}),
      "Unknown type InvalidName");
    assert.throws(() => createCheckers({Invalid: t.iface(["InvalidName"], [])}),
      "Unknown type InvalidName");
  });

  it("should support basic types", () => {
    const {Type, Never} = createCheckers({
      Type: t.iface([], [
        t.prop("any", "any"),
        t.prop("number", "number"),
        t.prop("object", "object"),
        t.prop("boolean", "boolean"),
        t.prop("string", "string"),
        t.prop("symbol", "symbol"),
        t.prop("void", "void"),
        t.prop("undefined", "undefined", true),
        t.prop("null", "null"),
      ]),
      Never: t.name("never"),
    });
    Type.check({
      any:        1,
      number:     1,
      object:     {},
      boolean:    true,
      string:     "x",
      symbol:     Symbol("x"),
      void:       null,
      undefined:  void 0,
      null:       null,
    });
    assert.throws(() => Type.getProp("number").check(null), "value is not a number");
    assert.throws(() => Type.getProp("object").check(null), "value is not an object");
    assert.throws(() => Type.getProp("boolean").check(1), "value is not a boolean");
    assert.throws(() => Type.getProp("string").check(1), "value is not a string");
    assert.throws(() => Type.getProp("symbol").check("x"), "value is not a symbol");
    assert.throws(() => Type.getProp("void").check("x"), "value is not void");
    assert.throws(() => Type.getProp("undefined").check(null), "value is not undefined");
    assert.throws(() => Type.getProp("null").check(undefined), "value is not null");
    assert.throws(() => Never.check(null), "value is unexpected");
  });

  it("should check function parameters and results", () => {
    const {A, B} = createCheckers({
      A: t.func("string", t.param("a", "number"), t.param("b", "string", true)),
      B: t.iface([], [
        t.prop("join", t.func("boolean", t.param("arr", t.array("string")))),
        t.prop("foo", "string"),
      ]),
    });
    A.getArgs().check([1.2]);
    A.getArgs().check([1.2, "test"]);
    A.getArgs().check([1.2, "test", false]);
    A.getResult().check("test");
    B.methodArgs("join").check([[]]);
    B.methodArgs("join").check([["a", "b", "c"]]);
    B.methodResult("join").check(true);

    assert.throws(() => B.getArgs(), /non-function/);
    assert.throws(() => B.getResult(), /non-function/);
    assert.throws(() => B.methodArgs("blah"), /has no property blah/);
    assert.throws(() => B.methodResult("foo"), /foo is not a method/);
    assert.throws(() => B.getProp("blah"), /has no property blah/);

    assert.throws(() => A.getArgs().check(["test"]), /a is not a number/);
    assert.throws(() => A.getArgs().check([1.2, ["test"]]), /b is not a string/);
    assert.throws(() => A.getArgs().strictCheck([1.2, "test", false]), "value[2] is extraneous");
    assert.throws(() => A.getResult().check(null), /value is not a string/);
    assert.throws(() => B.methodArgs("join").check([[1]]), "arr[0] is not a string");
    assert.throws(() => B.methodResult("join").check(null), "value is not a boolean");

    A.check(noop);
    B.check({join: noop, foo: "foo"});
    B.getProp("join").check(noop);
    assert.throws(() => A.check([]), "value is not a function");
    assert.throws(() => B.check({join: null, foo: "foo"}), "value.join is not a function");
  });

  it("should respect inherited interfaces", () => {
    const {Type} = createCheckers({
      Base: t.iface([], [t.prop("a", "string")]),
      Type: t.iface(["Base"], [t.prop("b", "number")]),
    });
    Type.check({a: "foo", b: 17});
    assert.throws(() => Type.check({b: 17}), /value.a is missing/);
    assert.throws(() => Type.check({a: 17, b: 17}), /value.a is not a string/);
    assert.throws(() => Type.check({a: "foo"}), /value.b is missing/);
  });
});
