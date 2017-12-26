/**
 * This module defines nodes used to define types and validations for objects and interfaces.
 */
// tslint:disable:no-shadowed-variable prefer-for-of

export type CheckerFunc = (value: any, ctx: Context) => boolean;

// TODO: Rename to "Context". Have fast and complete impl.
export class Context {
  public message: string = "hello";
  public fail(relPath: string|number|null, message: string|null): false {
    return false;
  }
  public clone() {
    return this;
  }
  public addUnion(ctx: Context) {
    // do nothing
  }
}

/** Base Node. */
export class TNode {}

/** Node that represents a type. */
export abstract class TType extends TNode {
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
  public _failMsg: string;
  constructor(public name: string) { super(); this._failMsg = `is not a ${name}`; }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    return getNamedType(suite, this.name).getChecker(suite, strict);
  }
}

/**
 * Defines a literal value, e.g. lit('hello') or lit(123).
 */
export function lit(value: any): TLiteral { return new TLiteral(value); }
export class TLiteral extends TType {
  private _failMsg: string;
  constructor(public value: any) { super(); this._failMsg = `is not ${JSON.stringify(value)}`; }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    return (value: any, ctx: Context) => (value === this.value) ? true : ctx.fail(null, this._failMsg);
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
    return (value: any, ctx: Context) => {
      if (!Array.isArray(value)) { return ctx.fail(null, "is not an array"); }
      for (let i = 0; i < value.length; i++) {
        const ok = itemChecker(value[i], ctx);
        if (!ok) { return ctx.fail(i, null); }
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
    const checker = (value: any, ctx: Context) => {
      if (!Array.isArray(value)) { return ctx.fail(null, "is not an array"); }
      for (let i = 0; i < itemCheckers.length; i++) {
        const ok = itemCheckers[i](value[i], ctx);
        if (!ok) { return ctx.fail(i, null); }
      }
      return true;
    };

    if (!strict) { return checker; }

    return (value: any, ctx: Context) => {
      if (!checker(value, ctx)) { return false; }
      return value.length <= itemCheckers.length ? true :
        ctx.fail(itemCheckers.length, "is extraneous");
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
  constructor(public ttypes: TType[]) { super(); }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    const itemCheckers = this.ttypes.map((t) => t.getChecker(suite, strict));
    return (value: any, ctx: Context) => {
      for (let i = 0; i < itemCheckers.length; i++) {
        const uctx = ctx.clone();
        const ok = itemCheckers[i](value, ctx);
        if (ok) { return true; }
        ctx.addUnion(uctx);
      }
      return ctx.fail(null, "has no match");
    };
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

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    const baseCheckers = this.bases.map((b) => getNamedType(suite, b).getChecker(suite, strict));
    const propCheckers = this.props.map((prop) => prop.ttype.getChecker(suite, strict));
    const checker = (value: any, ctx: Context) => {
      if (typeof value !== "object" || value === null) { return ctx.fail(null, "is not an object"); }
      for (let i = 0; i < baseCheckers.length; i++) {
        if (!baseCheckers[i](value, ctx)) { return false; }
      }
      for (let i = 0; i < propCheckers.length; i++) {
        const p = this.props[i];
        const v = value[p.name];
        if (!p.isOpt || v !== undefined) {
          const ok = propCheckers[i](v, ctx);
          if (!ok) { return ctx.fail(p.name, v === undefined ? "is missing" : null); }
        }
      }
      return true;
    };

    if (!strict) { return checker; }

    // In strict mode, check also for unknown enumerable properties.
    return (value: any, ctx: Context) => {
      if (!checker(value, ctx)) { return false; }
      for (const prop in value) {
        if (!this.propSet.has(prop)) {
          return ctx.fail(prop, "is extraneous");
        }
      }
      return true;
    };
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

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    return (value: any, ctx: Context) => {
      return typeof value === "function" ? true : ctx.fail(null, "is not a function");
    };
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

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    const itemCheckers = this.params.map((t) => t.ttype.getChecker(suite, strict));
    const checker = (value: any, ctx: Context) => {
      if (!Array.isArray(value)) { return ctx.fail(null, "is not an array"); }
      for (let i = 0; i < itemCheckers.length; i++) {
        const ok = itemCheckers[i](value[i], ctx);
        if (!ok) { return ctx.fail(this.params[i].name, null); }
      }
      return true;
    };

    if (!strict) { return checker; }

    return (value: any, ctx: Context) => {
      if (!checker(value, ctx)) { return false; }
      return value.length <= itemCheckers.length ? true :
        ctx.fail(itemCheckers.length, "is extraneous");
    };
  }
}

/**
 * Single TType implementation for all basic built-in types.
 */
class BasicType extends TType {
  constructor(public validator: (value: any) => boolean, private message: string) { super(); }

  public getChecker(suite: ITypeSuite, strict: boolean): CheckerFunc {
    return (value: any, ctx: Context) => this.validator(value) ? true : ctx.fail(null, this.message);
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
