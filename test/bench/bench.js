"use strict";

// jshint expr:true

const Benchmark = require("benchmark");
const {createCheckers} = require("../../dist/index");
const data = require("./data.json");
const bench = require("./proto-bench-ti");
const pbjsStaticCls = require("./static_pbjs");

const {ITest} = createCheckers(bench);

const badData = Object.assign({}, data, {uint32: "asdf"});
try {
  ITest.check(badData);
} catch (e) {
  console.log("ITest", e.message);
}

const x = pbjsStaticCls.Test.verify(badData);
console.log("pbjs", x);

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
