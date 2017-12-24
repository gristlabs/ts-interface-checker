import {assert} from "chai";
import {createCheckers} from "../lib/index";
import * as t from "../lib/types";
import * as sample from "./fixtures/sample-ti";
import * as shapes from "./fixtures/shapes-ti";

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
      /\.size is not a number/);

    // The whole object is of wrong type.
    assert.throws(() => ICacheItem.check("hello"), /value is not an object/);

    // Extra property is OK with plain check(), but fails with strictCheck().
    ICacheItem.check({key: "foo", value: {}, size: 17, extra: "baz"});
    assert.throws(() => ICacheItem.strictCheck({key: "foo", value: {}, size: 17, extra: "baz"}),
      /\.extra is extraneous/);
  });

  it("should produce helpful errors", () => {
    const {ICacheItem} = createCheckers(sample);
    assert.throws(() => ICacheItem.check({key: "foo", value: {}, size: null, tag: "baz"}),
      /\.size is not a number/);
    assert.throws(() => ICacheItem.check({key: "foo", value: {}, tag: "baz"}),
      /\.size is missing/);
    assert.throws(() => ICacheItem.check({value: {}, tag: "baz"}),
      /\.key is missing/);
  });

  it("should support unions", () => {
    const {Type} = createCheckers({
      Type: t.union("string", "number", "null", t.iface([], [t.prop("foo", "string")])),
    });
    Type.check("hello");
    Type.check(-17.5);
    Type.check(null);
    Type.check({foo: "bar"});
    assert.throws(() => Type.check(undefined), /value has no match.*value is not a string/);
    assert.throws(() => Type.check([]), /value has no match.*value.foo is missing/);
    assert.throws(() => Type.check({foo: 17}), /value has no match.*value.foo is not a string/);
    assert.throws(() => Type.check({}), /value has no match.*value.foo is missing/);
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
    assert.throws(() => tt.union.check("FOO"), /value has no match.*is not "foo"/);
    assert.throws(() => tt.union.check(undefined), /value has no match.*is not "foo"/);
  });

  it("should handle discriminated unions", () => {
    const {Shape} = createCheckers(shapes);
    Shape.check({kind: "square", size: 17});
    Shape.check({kind: "rectangle", width: 17, height: 4});
    Shape.check({kind: "circle", radius: 0.5});

    // Extraneous property.
    Shape.check({kind: "square", size: 17, depth: 5});
    assert.throws(() => Shape.strictCheck({kind: "square", size: 17, depth: 5}),
      /value.depth is extraneous/);

    // Mismatching or missing kind.
    assert.throws(() => Shape.check({kind: "square", width: 17, height: 4}),
      /value.size is missing/);
    assert.throws(() => Shape.check({kind: "rectangle", radius: 0.5}), /value.width is missing/);
    assert.throws(() => Shape.check({width: 17, height: 4}), /value.kind is missing/);

    // Missing or misspelled property.
    assert.throws(() => Shape.check({kind: "rectangle", height: 4}), /value.width is missing/);
    assert.throws(() => Shape.check({kind: "circle", Radius: 0.5}), /value.radius is missing/);
  });
});
