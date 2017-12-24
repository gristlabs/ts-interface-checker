/**
 * This module defines nodes used to define types and validations for objects and interfaces.
 */
// tslint:disable:no-shadowed-variable

import {ICheckFailReporter, VContext} from "./util";

/** Base Node. */
export class TNode {}

/** Node that represents a type. */
export abstract class TType extends TNode implements ICheckFailReporter {
  public abstract ctxCheck(ctx: VContext, value: any): void;
  public ctxFailMessage(): string|null { return null; }
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

/**
 * Defines a type name, either built-in, or defined in this suite. It can typically be included in
 * the specs as just a plain string.
 */
export function name(value: string): TName { return new TName(value); }
export class TName extends TType {
  constructor(public name: string) { super(); }

  public ctxCheck(ctx: VContext, value: any): void {
    ctx.setMessage(this);
    ctx.getNamedType(this.name).ctxCheck(ctx, value);
  }
  public ctxFailMessage() {
    return `is not a ${this.name}`;
  }
}

/**
 * Defines a literal value, e.g. lit('hello') or lit(123).
 */
export function lit(value: any): TLiteral { return new TLiteral(value); }
export class TLiteral extends TType {
  constructor(public value: any) { super(); }

  public ctxCheck(ctx: VContext, value: any): void {
    ctx.assert(value === this.value, this);
  }
  public ctxFailMessage() {
    return `is not ${JSON.stringify(this.value)}`;
  }
}

/**
 * Defines an array type, e.g. array('number').
 */
export function array(typeSpec: TypeSpec): TArray { return new TArray(parseSpec(typeSpec)); }
export class TArray extends TType {
  constructor(public ttype: TType) { super(); }

  public ctxCheck(ctx: VContext, value: any): void {
    ctx.assert(Array.isArray(value), "is not an array");
    ctx.cyclePush(value);
    ctx.propPush(0);
    for (let i = 0; i < value.length; i++) {
      ctx.propSet(i);
      this.ttype.ctxCheck(ctx, value[i]);
    }
    ctx.propPop();
    ctx.cyclePop(value);
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

  public ctxCheck(ctx: VContext, value: any): void {
    ctx.assert(Array.isArray(value), "is not an array");
    if (ctx.strict && value.length > this.ttypes.length) {
      ctx.propPush(this.ttypes.length);
      ctx.fail("is extraneous");
    }
    ctx.cyclePush(value);
    ctx.propPush(0);
    for (let i = 0; i < this.ttypes.length; i++) {
      ctx.propSet(i);
      this.ttypes[i].ctxCheck(ctx, value[i]);
    }
    ctx.propPop();
    ctx.cyclePop(value);
  }
}

/**
 * Defines a union type, e.g. union('number', 'null').
 */
export function union(...typeSpec: TypeSpec[]): TUnion {
  return new TUnion(typeSpec.map((t) => parseSpec(t)));
}
export class TUnion extends TType {
  constructor(public ttypes: TType[]) { super(); }

  public ctxCheck(ctx: VContext, value: any): void {
    const message = "has no match";
    const details = [];
    for (const ttype of this.ttypes) {
      try {
        // We start a new context here for two reasons. One is to get a shorter message (relative
        // to union's path), which we'll include. More importantly, any error may leave VContext
        // in an inconsistent state (since we avoid `finally` clauses and only pop on success); so
        // any VContext has to be discarded after an error.
        return ttype.ctxCheck(ctx.makeNew(), value);
      } catch (e) {
        details.push(e.message);
      }
    }
    ctx.fail(`${message} (${details.join(", ")})`);
  }
}

/**
 * Defines an interface. The first argument is an array of interfaces that it extends, and the
 * second is an array of properties.
 */
export function iface(bases: string[], props: TProp[]): TIface { return new TIface(bases, props); }
export class TIface extends TType {
  private propSet: Set<string>;
  constructor(public bases: string[], public props: TProp[]) {
    super();
    this.propSet = new Set(props.map((p) => p.name));
  }

  public ctxCheck(ctx: VContext, value: any): void {
    ctx.assert(value !== null && typeof value === "object", "is not an object");
    ctx.cyclePush(value);
    for (const base of this.bases) {
      ctx.getNamedType(base).ctxCheck(ctx, value);
    }
    ctx.propPush("");
    for (const prop of this.props) {
      ctx.propSet(prop.name);
      if (value[prop.name] === undefined) {
        ctx.assert(prop.isOpt, "is missing");
      } else {
        prop.ttype.ctxCheck(ctx, value[prop.name]);
      }
    }
    ctx.propPop();

    if (ctx.strict) {
      // In strict mode, check also for unknown enumerable properties.
      for (const prop in value) {
        if (!this.propSet.has(prop)) {
          ctx.propPush(prop);
          ctx.fail("is extraneous");
        }
      }
    }
    ctx.cyclePop(value);
  }
}

/**
 * Defines a property in an interface.
 */
export function prop(name: string, typeSpec: TypeSpec, isOpt?: boolean): TProp {
  return new TProp(name, parseSpec(typeSpec), Boolean(isOpt));
}
export class TProp extends TNode {
  constructor(public name: string, public ttype: TType, public isOpt: boolean) { super(); }
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

  public ctxCheck(ctx: VContext, value: any): void {
    ctx.assert(typeof value === "function", "is not a function");
  }
}

/**
 * Defines a function parameter.
 */
export function param(name: string, typeSpec: TypeSpec, isOpt?: boolean): TParam {
  return new TParam(name, parseSpec(typeSpec), Boolean(isOpt));
}
export class TParam extends TNode {
  constructor(public name: string, public ttype: TType, public isOpt: boolean) { super(); }
}

/**
 * Defines a function parameter list.
 */
export class TParamList extends TType {
  constructor(public params: TParam[]) { super(); }

  // Similar to verifying a tuple, but handles optional parameters and reports parameter names.
  public ctxCheck(ctx: VContext, value: any): void {
    ctx.assert(Array.isArray(value), "is not an array");
    if (ctx.strict) {
      ctx.assert(value.length === this.params.length, "has incorrect length");
    }
    ctx.cyclePush(value);
    ctx.propPush("");
    for (let i = 0; i < this.params.length; i++) {
      const param = this.params[i];
      ctx.propSet(param.name);
      if (value[i] === undefined) {
        ctx.assert(param.isOpt, "is missing");
      } else {
        param.ttype.ctxCheck(ctx, value[i]);
      }
    }
    ctx.propPop();
    ctx.cyclePop(value);
  }
}

/**
 * Single TType implementation for all basic built-in types.
 */
class BasicType extends TType {
  constructor(public validator: (value: any) => boolean, private message: string) { super(); }

  public ctxCheck(ctx: VContext, value: any): void {
    ctx.assert(this.validator(value), this.message);
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
