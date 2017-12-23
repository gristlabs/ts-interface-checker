import {assert} from "chai";
import {createCheckers} from "../lib/index";
import * as sample from "./fixtures/sample-ti";

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
});
