import {assert} from "chai";
import * as sample from "./fixtures/sample-ti";

import {SuiteValidator} from "../lib/validate";

describe("ts-interface-checker", () => {
  it("should validate data", () => {
    const vsuite = new SuiteValidator(sample);
    const vICacheItem = vsuite.getValidator("ICacheItem");
    vICacheItem.validate({key: "foo", value: {}, size: 17, tag: "baz"});
    assert.throws(() => vICacheItem.validate({key: "foo", value: {}, size: "text", tag: "baz"}),
      /\.size is not a number/);
  });

  it("should produce helpful errors", () => {
    const vsuite = new SuiteValidator(sample);
    const vICacheItem = vsuite.getValidator("ICacheItem");
    assert.throws(() => vICacheItem.validate({key: "foo", value: {}, size: null, tag: "baz"}),
      /\.size is not a number/);
    assert.throws(() => vICacheItem.validate({key: "foo", value: {}, tag: "baz"}),
      /\.size is missing/);
    assert.throws(() => vICacheItem.validate({value: {}, tag: "baz"}),
      /\.key is missing/);
  });
});
