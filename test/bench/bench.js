"use strict";

// jshint expr:true

const assert = require("chai").assert;
const Benchmark = require("benchmark");
const {createCheckers} = require("../../dist/index");
const data = require("./data.json");
const bench = require("./proto-bench-ti");
const pbjsStaticCls = require("./static_pbjs");

const {ITest} = createCheckers(bench);

const badData = Object.assign({}, data, {uint32: "asdf"});

assert.throws(() => ITest.check(badData), /\.uint32 is none of number, null/);
assert.match(pbjsStaticCls.Test.verify(badData), /integer expected/);

assert.strictEqual(ITest.check(data), undefined);
assert.strictEqual(pbjsStaticCls.Test.verify(data), null);

const suite = new Benchmark.Suite("encode/decode");
suite
.add("ts-interface-checker", function() {
  ITest.check(data);
})
.add("protobuf verify", function() {
  pbjsStaticCls.Test.verify(data);
})
.on('cycle', function(event) {
  console.log(String(event.target));
})
.run();
