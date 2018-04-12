/**
 * This module defines nodes used to define types and validations for objects and interfaces.
 */
// tslint:disable:no-shadowed-variable prefer-for-of

import {IContext, NoopContext} from "./util";

export type CheckerFunc = (value: any, ctx: IContext) => boolean;

/** Node that represents a type. */
export abstract class TType {
  public abstract getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc;
}

/**
 * Descriptor from which TType may be build (by parseSpec()). A plain string is equivalent to
 * name(string).
 */
export type TypeSpec = TType | string;

/** Parses a type spec into a TType node. */
function parseSpec(typeSpec: TypeSpec): TType {
  return typeof typeSpec === "string" ? name(typeSpec) : typeSpec;
}

/**
 * Represents a suite of named types. Suites are used to resolve type names.
 */
export interface ITypeSuite {
  [name: string]: TType;
}

function getNamedType(suite: ITypeSuite, name: string): TType {
  const ttype = suite[name];
  if (!ttype) { throw new Error(`Unknown type ${name}`); }
  return ttype;
}

/**
 * Defines a type name, either built-in, or defined in this suite. It can typically be included in
 * the specs as just a plain string.
 */
export function name(value: string): TName { return new TName(value); }
export class TName extends TType {
  private _failMsg: string;
  constructor(public name: string) { super(); this._failMsg = `is not a ${name}`; }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    const ttype = getNamedType(suite, this.name);
    const checker = ttype.getChecker(suite, strict);
    if (ttype instanceof BasicType || ttype instanceof TName) { return checker; }
    // For complex types, add an additional "is not a <Type>" message on failure.
    return (value: any, ctx: IContext) => checker(value, ctx) ? true : ctx.fail(null, this._failMsg, 0);
  }
}

/**
 * Defines a literal value, e.g. lit('hello') or lit(123).
 */
export function lit(value: any): TLiteral { return new TLiteral(value); }
export class TLiteral extends TType {
  public name: string;
  private _failMsg: string;
  constructor(public value: any) {
    super();
    this.name = JSON.stringify(value);
    this._failMsg = `is not ${this.name}`;
  }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    return (value: any, ctx: IContext) => (value === this.value) ? true : ctx.fail(null, this._failMsg, -1);
  }
}

/**
 * Defines an array type, e.g. array('number').
 */
export function array(typeSpec: TypeSpec): TArray { return new TArray(parseSpec(typeSpec)); }
export class TArray extends TType {
  constructor(public ttype: TType) { super(); }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    const itemChecker = this.ttype.getChecker(suite, strict);
    return (value: any, ctx: IContext) => {
      if (!Array.isArray(value)) { return ctx.fail(null, "is not an array", 0); }
      for (let i = 0; i < value.length; i++) {
        const ok = itemChecker(value[i], ctx);
        if (!ok) { return ctx.fail(i, null, 1); }
      }
      return true;
    };
  }
}

/**
 * Defines a tuple type, e.g. tuple('string', 'number').
 */
export function tuple(...typeSpec: TypeSpec[]): TTuple {
  return new TTuple(typeSpec.map((t) => parseSpec(t)));
}
export class TTuple extends TType {
  constructor(public ttypes: TType[]) { super(); }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    const itemCheckers = this.ttypes.map((t) => t.getChecker(suite, strict));
    const checker = (value: any, ctx: IContext) => {
      if (!Array.isArray(value)) { return ctx.fail(null, "is not an array", 0); }
      for (let i = 0; i < itemCheckers.length; i++) {
        const ok = itemCheckers[i](value[i], ctx);
        if (!ok) { return ctx.fail(i, null, 1); }
      }
      return true;
    };

    if (!strict) { return checker; }

    return (value: any, ctx: IContext) => {
      if (!checker(value, ctx)) { return false; }
      return value.length <= itemCheckers.length ? true :
        ctx.fail(itemCheckers.length, "is extraneous", 2);
    };
  }
}

/**
 * Defines a union type, e.g. union('number', 'null').
 */
export function union(...typeSpec: TypeSpec[]): TUnion {
  return new TUnion(typeSpec.map((t) => parseSpec(t)));
}
export class TUnion extends TType {
  private _failMsg: string;
  constructor(public ttypes: TType[]) {
    super();
    const names = ttypes.map((t) => t instanceof TName || t instanceof TLiteral ? t.name : null)
      .filter((n) => n);
    const otherTypes: number = ttypes.length - names.length;
    if (names.length) {
      if (otherTypes > 0) {
        names.push(`${otherTypes} more`);
      }
      this._failMsg = `is none of ${names.join(", ")}`;
    } else {
      this._failMsg = `is none of ${otherTypes} types`;
    }
  }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    const itemCheckers = this.ttypes.map((t) => t.getChecker(suite, strict));
    return (value: any, ctx: IContext) => {
      const ur = ctx.unionResolver();
      for (let i = 0; i < itemCheckers.length; i++) {
        const ok = itemCheckers[i](value, ur.createContext());
        if (ok) { return true; }
      }
      ctx.resolveUnion(ur);
      return ctx.fail(null, this._failMsg, 0);
    };
  }
}

function makeIfaceProps(props: {[name: string]: TOptional|TypeSpec}): TProp[] {
  return Object.keys(props).map((name: string) => makeIfaceProp(name, props[name]));
}

function makeIfaceProp(name: string, prop: TOptional|TypeSpec): TProp {
  return prop instanceof TOptional ?
    new TProp(name, prop.ttype, true) :
    new TProp(name, parseSpec(prop), false);
}

/**
 * Defines an interface. The first argument is an array of interfaces that it extends, and the
 * second is an array of properties.
 */
export function iface(bases: string[], props: {[name: string]: TOptional|TypeSpec}): TIface {
  return new TIface(bases, makeIfaceProps(props));
}
export class TIface extends TType {
  private propSet: Set<string>;
  constructor(public bases: string[], public props: TProp[]) {
    super();
    this.propSet = new Set(props.map((p) => p.name));
  }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    const baseCheckers = this.bases.map((b) => getNamedType(suite, b).getChecker(suite, strict));
    const propCheckers = this.props.map((prop) => prop.ttype.getChecker(suite, strict));
    const testCtx = new NoopContext();
    const isPropRequired: boolean[] = this.props.map((prop, i) =>
      !prop.isOpt && !propCheckers[i](undefined, testCtx));

    const checker = (value: any, ctx: IContext) => {
      if (typeof value !== "object" || value === null) { return ctx.fail(null, "is not an object", 0); }
      for (let i = 0; i < baseCheckers.length; i++) {
        if (!baseCheckers[i](value, ctx)) { return false; }
      }
      for (let i = 0; i < propCheckers.length; i++) {
        const name = this.props[i].name;
        const v = value[name];
        if (v === undefined) {
          if (isPropRequired[i]) { return ctx.fail(name, "is missing", 1); }
        } else {
          const ok = propCheckers[i](v, ctx);
          if (!ok) { return ctx.fail(name, null, 1); }
        }
      }
      return true;
    };

    if (!strict) { return checker; }

    // In strict mode, check also for unknown enumerable properties.
    return (value: any, ctx: IContext) => {
      if (!checker(value, ctx)) { return false; }
      for (const prop in value) {
        if (!this.propSet.has(prop)) {
          return ctx.fail(prop, "is extraneous", 2);
        }
      }
      return true;
    };
  }
}

/**
 * Defines an optional property on an interface.
 */
export function opt(typeSpec: TypeSpec): TOptional { return new TOptional(parseSpec(typeSpec)); }
export class TOptional {
  constructor(public ttype: TType) {}
}

/**
 * Defines a property in an interface.
 */
export class TProp {
  constructor(public name: string, public ttype: TType, public isOpt: boolean) {}
}

/**
 * Defines a function. The first argument declares the function's return type, the rest declare
 * its parameters.
 */
export function func(resultSpec: TypeSpec, ...params: TParam[]): TFunc {
  return new TFunc(new TParamList(params), parseSpec(resultSpec));
}
export class TFunc extends TType {
  constructor(public paramList: TParamList, public result: TType) { super(); }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    return (value: any, ctx: IContext) => {
      return typeof value === "function" ? true : ctx.fail(null, "is not a function", 0);
    };
  }
}

/**
 * Defines a function parameter.
 */
export function param(name: string, typeSpec: TypeSpec, isOpt?: boolean): TParam {
  return new TParam(name, parseSpec(typeSpec), Boolean(isOpt));
}
export class TParam {
  constructor(public name: string, public ttype: TType, public isOpt: boolean) {}
}

/**
 * Defines a function parameter list.
 */
export class TParamList extends TType {
  constructor(public params: TParam[]) { super(); }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    const itemCheckers = this.params.map((t) => t.ttype.getChecker(suite, strict));
    const testCtx = new NoopContext();
    const isParamRequired: boolean[] = this.params.map((param, i) =>
      !param.isOpt && !itemCheckers[i](undefined, testCtx));

    const checker = (value: any, ctx: IContext) => {
      if (!Array.isArray(value)) { return ctx.fail(null, "is not an array", 0); }
      for (let i = 0; i < itemCheckers.length; i++) {
        const p = this.params[i];
        if (value[i] === undefined) {
          if (isParamRequired[i]) { return ctx.fail(p.name, "is missing", 1); }
        } else {
          const ok = itemCheckers[i](value[i], ctx);
          if (!ok) { return ctx.fail(p.name, null, 1); }
        }
      }
      return true;
    };

    if (!strict) { return checker; }

    return (value: any, ctx: IContext) => {
      if (!checker(value, ctx)) { return false; }
      return value.length <= itemCheckers.length ? true :
        ctx.fail(itemCheckers.length, "is extraneous", 2);
    };
  }
}

/**
 * Single TType implementation for all basic built-in types.
 */
export class BasicType extends TType {
  constructor(public validator: (value: any) => boolean, private message: string) { super(); }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    return (value: any, ctx: IContext) => this.validator(value) ? true : ctx.fail(null, this.message, 0);
  }
}

/**
 * Defines the suite of basic types.
 */
export const basicTypes: ITypeSuite = {
  any:        new BasicType((v) => true, "is invalid"),
  number:     new BasicType((v) => (typeof v === "number"), "is not a number"),
  object:     new BasicType((v) => (typeof v === "object" && v), "is not an object"),
  boolean:    new BasicType((v) => (typeof v === "boolean"), "is not a boolean"),
  string:     new BasicType((v) => (typeof v === "string"), "is not a string"),
  symbol:     new BasicType((v) => (typeof v === "symbol"), "is not a symbol"),
  void:       new BasicType((v) => (v == null), "is not void"),
  undefined:  new BasicType((v) => (v === undefined), "is not undefined"),
  null:       new BasicType((v) => (v === null), "is not null"),
  never:      new BasicType((v) => false, "is unexpected"),
};

// Support `Buffer` as type as well, but only if available (it is in nodejs, not in browsers).
declare abstract class Buffer {
  public static isBuffer(value: any): boolean;
}
if (typeof Buffer !== "undefined") {
  basicTypes.Buffer = new BasicType((v) => Buffer.isBuffer(v), "is not a Buffer");
}

// Support typed arrays of various flavors
for (const array of [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
                     Int32Array, Uint32Array, Float32Array, Float64Array]) {
  if (typeof array !== "undefined") {
    basicTypes[array.name] = new BasicType((v) => (v instanceof array), `is not a ${array.name}`);
  }
}
