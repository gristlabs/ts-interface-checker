import {assert} from "chai";
import {createCheckers, CheckerT, VError, Checker, IErrorDetail} from "../lib";
import * as t from "../lib/types";
import greetTI from "./fixtures/greet-ti";
import sample from "./fixtures/sample-ti";
import shapes from "./fixtures/shapes-ti";
import * as enumUnion from "./fixtures/enum-union";
import enumUnionTI from "./fixtures/enum-union-ti";
import intersectionTI from "./fixtures/intersection-ti";
import indexSignaturesTI from "./fixtures/index-signatures-ti";
import recursiveTI from "./fixtures/recursive-ti";
import {applyPatches, removePatches} from "./monkeypatch";

function noop() { /* noop */ }

interface ICacheItemInterface {
  key: string,
  value: any,
  size: number,
  tag?: string
}

describe("ts-interface-checker", suite);

describe('ts-interface-checker-with-asserts', () => {
  before(() => applyPatches());
  after(() => removePatches());
  suite();
});

function suite() {
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

    // Test that setReportedPath() does not interfere with behavior but updates message correctly.
    ICacheItem.setReportedPath("HelloWorld");
    ICacheItem.check({key: "foo", value: {}, size: 17, extra: "baz"});
    assert.throws(() => ICacheItem.strictCheck({key: "foo", value: {}, size: 17, extra: "baz"}),
      "HelloWorld.extra is extraneous");
  });

  it("should support quick tests", () => {
    const {ICacheItem} = createCheckers({ICacheItem: sample.ICacheItem}) as { ICacheItem: CheckerT<ICacheItemInterface> };
    const unk: unknown = {key: "foo", value: {}, size: 17, tag: "baz"};
    assert.isTrue(ICacheItem.test({key: "foo", value: {}, size: 17, tag: "baz"}));
    assert.isFalse(ICacheItem.test({key: "foo", value: {}, size: "text", tag: "baz"}));
    if (ICacheItem.test(unk)) {
      assert.equal(unk.key, "foo");
      assert.deepEqual(unk.value, {});
      assert.equal(unk.size, 17);
      assert.equal(unk.tag, "baz");
    }
    assert.isTrue(ICacheItem.strictTest({key: "foo", value: {}, size: 17, tag: "baz"}));
    assert.isFalse(ICacheItem.strictTest({key: "foo", value: {}, size: "text", tag: "baz"})),
    assert.isFalse(ICacheItem.strictTest({key: "foo", value: {}, size: 17, tag: "baz", extra: "baz"}));
    if (ICacheItem.strictTest(unk)) {
      assert.equal(unk.key, "foo");
      assert.deepEqual(unk.value, {});
      assert.equal(unk.size, 17);
      assert.equal(unk.tag, "baz");
    }
  });

  it("should produce helpful errors", () => {
    const {ICacheItem} = createCheckers(sample);
    assert.throws(() => ICacheItem.check({key: "foo", value: {}, size: null, tag: "baz"}),
      /^value\.size is not a number$/);
    assert.throws(() => ICacheItem.check({key: "foo", value: {}, tag: "baz"}),
      "value.size is missing");
    assert.throws(() => ICacheItem.check({value: {}, tag: "baz"}),
      "value.key is missing");
    assert.throws(() => ICacheItem.check({value: {}, tag: "baz"}), VError);
  });

  it("should support unions", () => {
    const {Type} = createCheckers({
      Type: t.union("string", "number", "null", t.iface([], {foo: "string"})),
    });
    Type.check("hello");
    Type.check(-17.5);
    Type.check(null);
    Type.check({foo: "bar"});
    assert.throws(() => Type.check(undefined), "value is none of string, number, null, 1 more");
    assert.throws(() => Type.check([]),
      "value is none of string, number, null, 1 more; value.foo is missing");
    assert.throws(() => Type.check({foo: 17}),
      "value is none of string, number, null, 1 more; value.foo is not a string");
    assert.throws(() => Type.check({}),
      "value is none of string, number, null, 1 more; value.foo is missing");
  });

  it("should support basic and indirect type aliases", () => {
    const {NumberAlias, NumberAlias2} = createCheckers(sample);

    NumberAlias.check(-123.56);
    assert.throws(() => NumberAlias.check("123"), /value is not a number/);
    assert.throws(() => NumberAlias.check({foo: -123.56}), /value is not a number/);

    NumberAlias2.check(-123.56);
    assert.throws(() => NumberAlias2.check("123"), /value is not a number/);
    assert.throws(() => NumberAlias2.check({foo: -123.56}), /value is not a number/);
  });

  it("should support enums", () => {
    const tt = createCheckers(sample);
    tt.Direction.check(1);
    tt.Direction.check(18);
    assert.throws(() => tt.Direction.check(3), /value is not a valid enum value/);
    assert.throws(() => tt.Direction.check("Left"), /value is not a valid enum value/);

    tt.DirectionStr.check("UP");
    tt.DirectionStr.check("RIGHT");
    assert.throws(() => tt.DirectionStr.check("foo"), /value is not a valid enum value/);
    assert.throws(() => tt.DirectionStr.check("up"), /value is not a valid enum value/);

    tt.BooleanLikeHeterogeneousEnum.check(0);
    tt.BooleanLikeHeterogeneousEnum.check("YES");
    assert.throws(() => tt.BooleanLikeHeterogeneousEnum.check("0"), /value is not.*valid/);
    assert.throws(() => tt.BooleanLikeHeterogeneousEnum.check(1), /value is not.*valid/);

    tt.EnumComputed.check(16);
    assert.throws(() => tt.DirectionStr.check(18), /value is not a valid enum value/);
  });

  it("should support enum literals", () => {
    const tt = createCheckers(sample, {
      foo: t.enumlit("Direction", "Left"),
      bar: t.enumlit("DirectionStr", "Right"),
    });
    tt.foo.check(17);
    tt.bar.check("RIGHT");
    assert.throws(() => tt.foo.check("Left"), /value is not Direction.Left/);
    assert.throws(() => tt.foo.check(0), /value is not Direction.Left/);
    assert.throws(() => tt.bar.check("LEFT"), /value is not DirectionStr.Right/);
    assert.throws(() => tt.bar.check("Right"), /value is not DirectionStr.Right/);

    assert.throws(() => createCheckers(sample, {foo: t.enumlit("Direction", "bad")}),
      /Unknown value Direction.bad used in enumlit/);
    assert.throws(() => createCheckers(sample, {foo: t.enumlit("MyType", "bad")}),
      /Type MyType used in enumlit is not an enum type/);
    assert.throws(() => createCheckers(sample, {foo: t.enumlit("Bad", "bad")}),
      /Unknown type Bad/);
  });

  it("should generate good messages for complex unions", () => {
    const {Type} = createCheckers({
      Foo: t.iface([], {foo: "number"}),
      Type: t.union(t.iface([], {a: "Foo"}),
                    t.iface([], {a: "number"})),
    });
    Type.check({a: 12});
    Type.check({a: {foo: 12}});
    assert.throws(() => Type.check({a: "x"}), /^value is none of 2 types; value.a is not a number$/);
    assert.throws(() => Type.check({a: {foo: "x"}}),
      /^value is none of 2 types; value.a is not a Foo; value.a.foo is not a number$/);
  });

  it("should support tuples", () => {
    const {Type} = createCheckers({
      Type: t.tuple("string", "number", t.iface([], {foo: "string"})),
    });
    Type.check(["hello", 4.5, {foo: "bar"}]);
    Type.check(["hello", 4.5, {foo: "bar"}, "baz"]);
    assert.throws(() => Type.check(undefined), "value is not an array");
    assert.throws(() => Type.check([]), "value[0] is not a string");
    assert.throws(() => Type.check([4.5, "hello", {foo: "bar"}]), "value[0] is not a string");
    assert.throws(() => Type.check(["hello", 4.5]), "value[2] is not an object");
    Type.strictCheck(["x", 4, {foo: "bar"}]);
    assert.throws(() => Type.strictCheck(["x", 4, {foo: "bar"}, "baz"]), "value[3] is extraneous");
  });

  it("should support optionals in tuples", () => {
    const {Type} = createCheckers({
      Type: t.tuple("string", "number", t.opt("string")),
    });
    Type.check(["hello", 4.5]);
    Type.check(["hello", 4.5, "baz"]);
    assert.throws(() => Type.check(undefined), "value is not an array");
    assert.throws(() => Type.check([]), "value[0] is not a string");
    assert.throws(() => Type.check([4.5, "hello", {foo: "bar"}]), "value[0] is not a string");
    assert.throws(() => Type.check(["hello", 4.5, {foo: "bar"}]), "value[2] is not a string");
    Type.strictCheck(["x", 4]);
    Type.strictCheck(["x", 4, "bar"]);
    assert.throws(() => Type.strictCheck(["x", 4, "bar", "baz"]), "value[3] is extraneous");
  });

  it("should support arrays", () => {
    const {Type} = createCheckers({Type: t.array(t.iface([], {foo: "string"}))});
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
    assert.throws(() => tt.union.check("FOO"), /^value is none of "foo", "bar", "baz"$/);
    assert.throws(() => tt.union.check(undefined), /^value is none of "foo", "bar", "baz"$/);
  });

  it("should handle discriminated unions", () => {
    const {Shape} = createCheckers(shapes);
    Shape.check({kind: "square", size: 17});
    Shape.strictCheck({kind: "square", size: 17});
    Shape.check({kind: "rectangle", width: 17, height: 4});
    Shape.check({kind: "circle", radius: 0.5});

    // Extraneous property.
    Shape.check({kind: "square", size: 17, depth: 5});
    assert.throws(() => Shape.strictCheck({kind: "square", size: 17, depth: 5}),
      /^value is none of Square, Rectangle, Circle; value is not a Square; value.depth is extraneous$/);

    // Mismatching or missing kind.
    assert.throws(() => Shape.check({kind: "square", width: 17, height: 4}),
      /value.size is missing/);
    assert.throws(() => Shape.check({kind: "rectangle", radius: 0.5}),
      dedent(`
        value is none of Square, Rectangle, Circle; value is not a Rectangle
            value.width is missing
            value.height is missing
    `));
    assert.throws(() => Shape.check({width: 17, height: 4}), /value.kind is missing/);

    // Missing or misspelled property.
    assert.throws(() => Shape.check({kind: "rectangle", height: 4}), /value.width is missing/);
    assert.throws(() => Shape.check({kind: "circle", Radius: 0.5}), /value.radius is missing/);
  });

  it("should handle enum-based discriminated unions", () => {
    const {Shape, Circle, Square} = createCheckers(enumUnionTI);
    Shape.check({kind: enumUnion.ShapeKind.Square});
    Shape.check({kind: enumUnion.ShapeKind.Circle});
    Circle.check({kind: enumUnion.ShapeKind.Circle, radius: 0.5});
    Square.check({kind: enumUnion.ShapeKind.Square, size: 3.0});

    assert.throws(() => Circle.check({kind: enumUnion.ShapeKind.Square}),
      /value.kind is not ShapeKind.Circle/);
    assert.throws(() => Square.check({kind: enumUnion.ShapeKind.Square}),
      /value.size is missing/);
    assert.throws(() => Shape.check({kind: 20}),
      /value.kind is not a valid enum value/);
  });

  it("should handle intersections", () => {
    const { Car, House, Tuples } = createCheckers(intersectionTI);
    Car.check({ numDoors: 2, numWheels: 4})
    House.check({ numDoors: 6, numRooms: 8 })
    House.check({ numDoors: 6, numRooms: 8, numWheels: "none" })

    assert.throws(() => Car.check({ numDoors: 2 }),
      /value.numWheels is missing/);
    assert.throws(() => Car.check({ numWheels: 4 }),
      /value.numDoors is missing/);
    assert.throws(() => House.check({ numDoors: 6 }),
      /value.numRooms is missing/);
    assert.throws(() => House.check({ numRooms: 8, numDoors: false }),
      /value.numDoors is not a number/);

    Tuples.check(["foo", "bar"]);
    Tuples.check(["foo", "bar", "baz"]);
    assert.throws(() => Tuples.check(["foo", null]),
      /value\[1\] is not a string/);
    assert.throws(() => Tuples.check(["foo"]),
      /value\[1\] is none of string, null/);
  });

  it("should handle intersections with strict checks", () => {
    const { Car, House, Tuples } = createCheckers(intersectionTI);
    Car.strictCheck({ numDoors: 2, numWheels: 4, })
    House.strictCheck({ numDoors: 2, numRooms: 4, })

    assert.throws(() => Car.strictCheck({ numDoors: 2, foo: 'foo' }),
      /value.numWheels is missing/);
    assert.throws(() => Car.strictCheck({ numDoors: 2, numWheels: 4, foo: 'foo' }),
      /value.foo is extraneous/);
    assert.throws(() => House.strictCheck({ numDoors: 2, numRooms: 4, bar: 'bar' }),
      /value.bar is extraneous/);

    Tuples.strictCheck(["foo", "bar"]);
    assert.throws(() => Tuples.strictCheck(["foo", "bar", "baz"]),
      /value\[2\] is extraneous/);
    assert.throws(() => Tuples.strictCheck(["foo", null]),
      /value\[1\] is not a string/);
    assert.throws(() => Tuples.strictCheck(["foo"]),
      /value\[1\] is none of string, null/);
  });

  it("should handle intersections with overlapping property names", () => {
    const { SameKeyIntersection } = createCheckers(intersectionTI);
    SameKeyIntersection.check({
      x: {
        foo: 'foo',
        bar: 0
      }
    })
    SameKeyIntersection.check({
      x: {
        foo: 'foo',
        bar: 0,
        optional: 4,
      }
    })

    assert.throws(() =>
        SameKeyIntersection.check({
          x: {
            foo: 'foo',
          }
        }), /bar is missing/);

    assert.throws(() =>
        SameKeyIntersection.check({
          x: {
            bar: 1,
          }
        }), /foo is missing/);

    assert.throws(() =>
        SameKeyIntersection.check({
          x: {
            foo: 1,
            bar: 0
          }
        }), /foo is not a string/);
  });

  it("should handle mixed union and intersection literals", () => {
    // Represents (1|2) & (2|3).
    const { MixedLiteral } = createCheckers(intersectionTI);
    MixedLiteral.check(2)
    assert.throws(() => MixedLiteral.check(1));
    assert.throws(() => MixedLiteral.check(3));
  });

  it("should not consider properties extraneous in case of an intersection", () => {
    type AorBandC = ({a: string} | {b: string}) & {c: string};
    const AorBandC = t.intersection(
      t.union(t.iface([], {a: "string"}), t.iface([], {b: "string"})),
      t.iface([], {c: "string"})
    );
    const checkers = createCheckers({AorBandC}) as {AorBandC: CheckerT<AorBandC>};
    checkers.AorBandC.strictCheck({a: "A", c: "C"});
    checkers.AorBandC.strictCheck({b: "B", c: "C"});
    checkers.AorBandC.strictCheck({a: "A", b: "B", c: "C"});
    assert.throws(() => checkers.AorBandC.strictCheck({b: "B"}), /value.c is missing/);
    assert.throws(() => checkers.AorBandC.strictCheck({c: "C"}));
    assert.throws(() => checkers.AorBandC.strictCheck({a: "A", b: "B", c: "C", d: "D"}),
      /value.d is extraneous/);
  });

  it("should fail early when suite is missing types", () => {
    assert.throws(() => createCheckers({Invalid: t.name("InvalidName")}),
      "Unknown type InvalidName");
    assert.throws(() => createCheckers({Invalid: t.iface(["InvalidName"], {})}),
      "Unknown type InvalidName");
  });

  it("should support basic types", () => {
    const {Type, Never} = createCheckers({
      Type: t.iface([], {
        any: "any",
        myNumber: "number",
        object: "object",
        boolean: "boolean",
        string: "string",
        symbol: "symbol",
        void: "void",
        undefined: "undefined",
        null: "null",
        Buffer: "Buffer",
        Uint8Array: "Uint8Array",
        date: "Date",
        regExp: "RegExp",
        other: t.iface([], {a: "string"}),
      }),
      Never: t.name("never"),
    });
    Type.check({
      any:        1,
      myNumber:     1,
      object:     {},
      boolean:    true,
      string:     "x",
      symbol:     Symbol("x"),
      void:       null,
      undefined:  void 0,
      null:       null,
      Buffer:     Buffer.from("buf"),
      Uint8Array: new Uint8Array(10),
      date:       new Date(2019, 10, 24),
      regExp:     /adsf/,
      other:      {a: "foo"},
    });
    assert.throws(() => Type.getProp("myNumber").check(null), "value.myNumber is not a number");
    assert.throws(() => Type.getProp("object").check(null), "value.object is not an object");
    assert.throws(() => Type.getProp("boolean").check(1), "value.boolean is not a boolean");
    assert.throws(() => Type.getProp("string").check(1), "value.string is not a string");
    assert.throws(() => Type.getProp("symbol").check("x"), "value.symbol is not a symbol");
    assert.throws(() => Type.getProp("void").check("x"), "value.void is not void");
    assert.throws(() => Type.getProp("undefined").check(null), "value.undefined is not undefined");
    assert.throws(() => Type.getProp("null").check(undefined), "value.null is not null");
    assert.throws(() => Never.check(null), "value is unexpected");
    assert.throws(() => Type.getProp("Buffer").check("foo"), "value.Buffer is not a Buffer");
    assert.throws(() => Type.getProp("Uint8Array").check("foo"), "value.Uint8Array is not a Uint8Array");
    assert.throws(() => Type.getProp("date").check(undefined), "value.date is not a Date");
    assert.throws(() => Type.getProp("date").check(null), "value.date is not a Date");
    assert.throws(() => Type.getProp("date").check("asdf"), "value.date is not a Date");
    assert.throws(() => Type.getProp("date").check(20191004), "value.date is not a Date");
    assert.throws(() => Type.getProp("regExp").check(null), "value.regExp is not a RegExp");
    assert.throws(() => Type.getProp("regExp").check("foo"), "value.regExp is not a RegExp");
    Type.getProp("regExp").check(new RegExp('foo'));
    assert.throws(() => Type.getProp("other").check({b: "foo"}), "value.other.a is missing");

    Type.setReportedPath("test_record");
    assert.throws(() => Type.getProp("other").check({b: "foo"}), "test_record.other.a is missing");
  });

  it("should check function parameters and results", () => {
    const {A, B} = createCheckers({
      A: t.func("string", t.param("a", "number"), t.param("b", "string", true)),
      B: t.iface([], {
        join: t.func("boolean", t.param("arr", t.array("string"))),
        foo: "string",
      }),
    });
    A.getArgs().check([1.2]);
    A.getArgs().check([1.2, "test"]);
    A.getArgs().check([1.2, "test", false]);
    A.getArgs().strictCheck([1.2, "test"]);
    A.getResult().check("test");
    B.methodArgs("join").check([[]]);
    B.methodArgs("join").check([["a", "b", "c"]]);
    B.methodResult("join").check(true);

    assert.throws(() => B.getArgs(), /non-function/);
    assert.throws(() => B.getResult(), /non-function/);
    assert.throws(() => B.methodArgs("blah"), /has no property blah/);
    assert.throws(() => B.methodResult("foo"), /foo is not a method/);
    assert.throws(() => B.getProp("blah"), /has no property blah/);

    assert.throws(() => A.getArgs().check("test"), /is not an array/);
    assert.throws(() => A.getArgs().check(["test"]), /a is not a number/);
    assert.throws(() => A.getArgs().check([1.2, ["test"]]), /b is not a string/);
    assert.throws(() => A.getArgs().strictCheck([1.2, ["test"]]), /b is not a string/);
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
      Base: t.iface([], {a: "string"}),
      Type: t.iface(["Base"], {b: "number"}),
    });
    Type.check({a: "foo", b: 17});
    assert.throws(() => Type.check({b: 17}), /value.a is missing/);
    assert.throws(() => Type.check({a: 17, b: 17}), /value.a is not a string/);
    assert.throws(() => Type.check({a: "foo"}), /value.b is missing/);

    // Try some strict checks too.
    Type.strictCheck({a: "foo", b: 17});
    assert.throws(() => Type.strictCheck({a: "foo", b: 17, c: "foo"}), /value.c is extraneous/);
    assert.throws(() => Type.strictCheck({b: 17}), /value.a is missing/);
    assert.throws(() => Type.strictCheck({a: 17, b: 17}), /value.a is not a string/);
    assert.throws(() => Type.strictCheck({a: "foo"}), /value.b is missing/);
  });

  it("should support index signatures", () => {
    const {SquareConfig, IndexSignatures} = createCheckers(indexSignaturesTI);
    // SquareConfig is a fairly relaxed type, with index signature of type 'any'.
    SquareConfig.check({color: "blue", width: 1});
    SquareConfig.check({color: "blue", width: 1, foo: new Date(2020, 2, 15)});
    SquareConfig.check({color: "blue", foo: "blue", bar: 1});
    assert.throws(() => SquareConfig.check({}), /color is missing/);
    assert.throws(() => SquareConfig.check({foo: "blue", bar: 1}), /color is missing/);
    assert.throws(() => SquareConfig.check({color: 17}), /color is not a string/);

    // Presence of index signature disables strictness (no properties are extraneous).
    SquareConfig.strictCheck({color: "blue", width: 1});
    SquareConfig.strictCheck({color: "blue", width: 1, foo: new Date(2020, 2, 15)});
    SquareConfig.strictCheck({color: "blue", foo: "blue", bar: 1});
    assert.throws(() => SquareConfig.strictCheck({}), /color is missing/);
    assert.throws(() => SquareConfig.strictCheck({foo: "blue", bar: 1}), /color is missing/);
    assert.throws(() => SquareConfig.strictCheck({color: 17}), /color is not a string/);

    // Here's a stricter index-signature type (data: {[index: number]: number[]})
    // Note that the declared type of the index key doesn't matter (in JS, object keys are always
    // seen as strings anyway).
    IndexSignatures.check({data: {5: [1, 2, 3], "foo": []}});
    IndexSignatures.check({data: {}});
    assert.throws(() => IndexSignatures.check({data: {"foo": [1, 2, "3"]}}), /data.foo\[2\] is not a number/);
    assert.throws(() => IndexSignatures.check({data: {"foo": [1, 2], "bar": 5}}), /data.bar is not an array/);
    assert.throws(() => IndexSignatures.check({}), /data is missing/);
  });

  it('should support recursive interfaces', () => {
    const {FormConfig} = createCheckers(recursiveTI);
    FormConfig.check({});
    const form = {children: []};
    FormConfig.check(form);
    FormConfig.check({children: [form, form]});

    (form as any).children = "";
    assert.throws(() => FormConfig.check(form), /value.children is not an array/);

    // A similar test using an intersection (which affects allowedProps).
    const Foo = t.iface([], {"foo": "string"});
    const Bar = t.iface([], {"nested": t.opt(t.intersection("Foo", "Bar"))});
    const Baz = t.name("Bar");
    const checkers = createCheckers({Foo, Bar, Baz});
    checkers.Baz.check({nested: {foo: 'foo', nested: {foo: 'foo2'}}});
    checkers.Baz.strictCheck({nested: {foo: 'foo', nested: {foo: 'foo2'}}});
  });

  it("should check method calls as in README docs", () => {
    const {Greeter} = createCheckers(greetTI);

    Greeter.methodArgs("greet").check(["Bob"]);     // OK
    assert.throws(() => Greeter.methodArgs("greet").check([17]), /name is not a string/);
    assert.throws(() => Greeter.methodArgs("greet").check([]), /name is missing/);

    Greeter.methodResult("greet").check("hello");   // OK
    assert.throws(() => Greeter.methodResult("greet").check(null), /value is not a string/);
  });

  it("should make type available", () => {
    const {Greeter} = createCheckers(greetTI);
    assert.instanceOf(Greeter.getType(), t.TIface);
  });

  it("should allow getting error details", () => {
    const {Shape} = createCheckers(shapes);
    const {Type} = createCheckers({
      Foo: t.iface([], {foo: "number"}),
      Type: t.union(t.iface([], {a: "Foo"}),
                    t.iface([], {a: "number"})),
    });
    const {Bar} = createCheckers({
      Bar: t.iface([], {spam: "Spam", other: "number"}),
      Spam: t.iface([], {foo: "Foo", z: "number"}),
      Foo: t.iface([], {x: "number", y: "number"}),
    });

    assert.isNull(Shape.validate({kind: "square", size: 17}));
    assert.isNull(Shape.validate({kind: "rectangle", width: 17, height: 4}));
    assert.isNull(Shape.validate({kind: "circle", radius: 0.5}));

    // Extraneous property.
    assert.isNull(Shape.validate({kind: "square", size: 17, depth: 5}));
    assert.deepEqual(Shape.strictValidate({kind: "square", size: 17, depth: 5}), [{
      path: "value", message: "is none of Square, Rectangle, Circle",
      nested: [{
        path: "value", message: "is not a Square",
        nested: [{
          path: "value.depth", message: "is extraneous",
        }],
      }],
    }]);

    // Mismatching or missing kind.
    assertCheckerErrors(
      Shape,
      {kind: "square", width: 17, height: 4},
      "value is none of Square, Rectangle, Circle; value is not a Square; value.size is missing",
      {
        path: "value", message: "is none of Square, Rectangle, Circle",
        nested: [{
          path: "value", message: "is not a Square",
          nested: [{
            path: "value.size", message: "is missing",
          }],
        }],
      }
    );

    assert.isNull(Type.validate({a: 12}));
    assert.isNull(Type.validate({a: {foo: 12}}));
    assertCheckerErrors(
      Type,
      {a: "x"},
      "value is none of 2 types; value.a is not a number",
      {
        path: "value", message: "is none of 2 types",
        nested: [{
          path: "value.a", message: "is not a number",
        }],
      }
    );
    assertCheckerErrors(
      Type,
      {a: {foo: "x"}},
      "value is none of 2 types; value.a is not a Foo; value.a.foo is not a number",
      {
        path: "value", message: "is none of 2 types",
        nested: [{
          path: "value.a", message: "is not a Foo",
          nested: [{
            path: "value.a.foo", message: "is not a number",
          }],
        }],
      }
    );

    assertCheckerErrors(
      Bar,
      {spam: {foo: {}}},
      `
      value.spam is not a Spam
          value.spam.foo is not a Foo
              value.spam.foo.x is missing
              value.spam.foo.y is missing
          value.spam.z is missing
      value.other is missing
      `,
      {
        path: "value.spam", message: "is not a Spam",
        nested: [
          {
            path: "value.spam.foo", message: "is not a Foo",
            nested: [
              {path: "value.spam.foo.x", message: "is missing"},
              {path: "value.spam.foo.y", message: "is missing"},
            ],
          },
          {path: "value.spam.z", message: "is missing"},
        ],
      },
      {
        "path": "value.other",
        "message": "is missing",
      },
    );

    const {C} = createCheckers({
      A: t.iface([], {a: "number"}),
      B: t.iface([], {b: "number"}),
      AB: t.intersection("A", "B"),
      C: t.iface([], {ab: "AB"}),
    });

    assertCheckerErrors(
      C,
      {ab: {}},
      `
      value.ab is not a AB
          value.ab is not a A; value.ab.a is missing
          value.ab is not a B; value.ab.b is missing
      `,
      {
        "path": "value.ab", "message": "is not a AB",
        "nested": [
          {
            "path": "value.ab", "message": "is not a A",
            "nested": [
              {"path": "value.ab.a", "message": "is missing"}
            ],
          },
          {
            "path": "value.ab", "message": "is not a B",
            "nested": [
              {"path": "value.ab.b", "message": "is missing"}
            ],
          }
        ],
      }
    );
  });

  it("should not return too many errors", () => {
    const {Foo} = createCheckers({
      Foo: t.iface([], {
        a: "number",
        b: "number",
        c: "number",
        d: "number",
        e: "number",
        f: "number",
      }),
    });

    assertCheckerErrors(
      Foo,
      {},
      // Only DetailContext.maxForks (3) errors
      `
      value.a is missing
      value.b is missing
      value.c is missing
      `,
      {"path": "value.a", "message": "is missing"},
      {"path": "value.b", "message": "is missing"},
      {"path": "value.c", "message": "is missing"},
    );
  });

  it("should name array types in error messages", () => {
    const {MixedArray, ArrayUnion, UnionWithUnnamedArray} = createCheckers(enumUnionTI);

    MixedArray.check(['one', 'two', 'three']);
    MixedArray.check(['one', 'two', 'three']);
    MixedArray.check([1, 'two', 3]);
    assert.throws(() => MixedArray.check([undefined]), "value[0] is none of string, number, string[]");

    ArrayUnion.check(['one', 'two', 'three']);
    ArrayUnion.check([1, 2, 3]);
    ArrayUnion.check([true, false]);
    assert.throws(() => ArrayUnion.check([undefined]), "value is none of string[], boolean[], number[], string[][]");

    UnionWithUnnamedArray.check(['one', 'two', 'three']);
    UnionWithUnnamedArray.check([1, 2, 3]);
    UnionWithUnnamedArray.check(['one', false]);
    assert.throws(() => UnionWithUnnamedArray.check([undefined]), "value is none of string[], number[], 1 more; value[0] is none of string, boolean");
  });

};


/**
 * Removes common leading indentation from a multiline string
 * Based on https://stackoverflow.com/a/25937397/2482744
 *
 * The string should start with a newline so that the indentation
 * can be calculated from the first non-blank line.
 */
const dedent = (s: string) => {
  let size = -1;

  return s.replace(/\n(\s+)/g, (m, m1) => {

    if (size < 0) {
      size = m1.replace(/\t/g, "    ").length;
    }

    return "\n" + m1.slice(Math.min(m1.length, size));
  }).trim();
}

/**
 * Test error message from check() and error details from validate() at the same time.
 */
const assertCheckerErrors = (checker: Checker, value: any, message: string, ...errors: IErrorDetail[]): void => {
  assert.deepEqual(checker.validate(value), errors);
  assert.throws(() => checker.check(value), dedent(message));
  assert.isFalse(checker.test(value));
}
