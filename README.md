# ts-interface-checker

[![Build Status](https://travis-ci.org/gristlabs/ts-interface-checker.svg?branch=master)](https://travis-ci.org/gristlabs/ts-interface-checker)
[![npm version](https://badge.fury.io/js/ts-interface-checker.svg)](https://badge.fury.io/js/ts-interface-checker)


> Runtime library to validate data against TypeScript interfaces.

This package is the runtime support for validators created by
[ts-interface-builder](https://github.com/gristlabs/ts-interface-builder).
It allows validating data, such as parsed JSON objects received
over the network, or parsed JSON or YAML files, to check if they satisfy a
TypeScript interface, and to produce informative error messages if they do not.

## Installation

```bash
npm install --save-dev ts-interface-builder
npm install --save ts-interface-checker
```

## Usage

Suppose you have a TypeScript file defining an interface:
```typescript
// foo.ts
interface Square {
  size: number;
  color?: string;
}
```

The first step is to generate some code for runtime checks:
```bash
`npm bin`/ts-interface-builder foo.ts
```

It produces a file like this:
```typescript
// foo-ti.js
import * as t from "ts-interface-checker";

export const Square = t.iface([], {
  "size": "number",
  "color": t.opt("string"),
});
...
```

Now at runtime, to check if a value satisfies the Square interface:
```typescript
import fooTI from "./foo-ti";
import {createCheckers} from "ts-interface-checker";

const {Square} = createCheckers(fooTI);

Square.check({size: 1});                  // OK
Square.check({size: 1, color: "green"});  // OK
Square.check({color: "green"});           // Fails with "value.size is missing"
Square.check({size: 4, color: 5});        // Fails with "value.color is not a string"
```

Note that `ts-interface-builder` is only needed for the build-time step, and
`ts-interface-checker` is needed at runtime. That's why the recommendation is to npm-install the
former using `--save-dev` flag and the latter using `--save`.

## Checking method calls

If you have an interface with methods, you can validate method call arguments and return values:
```typescript
// greet.ts
interface Greeter {
  greet(name: string): string;
}
```

After generating the runtime code, you can now check calls like:
```typescript
import greetTI from "./greet-ti";
import {createCheckers} from "ts-interface-checker";

const {Greeter} = createCheckers(greetTI);

Greeter.methodArgs("greet").check(["Bob"]);     // OK
Greeter.methodArgs("greet").check([17]);        // Fails with "value.name is not a string"
Greeter.methodArgs("greet").check([]);          // Fails with "value.name is missing"

Greeter.methodResult("greet").check("hello");   // OK
Greeter.methodResult("greet").check(null);      // Fails with "value is not a string"
```

## Type suites

If one type refers to a type defined in another file, you need to tell the interface checker about
all type names when you call `createCheckers()`. E.g. given

```typescript
// color.ts
export type Color = RGB | string;
export type RGB = [number, number, number];
```

```typescript
// shape.ts
import {Color} from "./color";
export interface Square {
  size: number;
  color?: Color;
}
```

the produced files `color-ti.ts` and `shape-ti.ts` do not automatically refer to each other, but
expect you to relate them in `createCheckers()` call:
```typescript
import color from "./color-ti";
import shape from "./shape-ti";
import {createCheckers} from "ts-interface-checker";

const {Square} = createCheckers(shape, color);    // Pass in all required type suites.

Square.check({size: 1, color: [255,255,255]});
```

## Strict checking

You may check that data contains no extra properties. Note that it is not generally recommended as
it this prevents backward compatibility: if you add new properties to an interface, then older
code with strict checks will not accept them.

Following on the example above:
```typescript
Square.strictCheck({size: 1, color: [255,255,255], bg: "blue"});    // Fails with value.bg is extraneous
Square.strictCheck({size: 1, color: [255,255,255,0.5]});            // Fails with ...value.color[3] is extraneous
```
