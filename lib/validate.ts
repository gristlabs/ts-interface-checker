/**
 * Usage:
 *  const vsuite = new SuiteValidator(suite);
 *  const validateMyType = vsuite.getValidator("MyType");
 *  validateMyType(myObj);
 */

// TODO: We don"t yet handle cyclical structures well at all.
// Need to have tests for cyclical types (like for linked lists).
// And tests for cyclical objects to validate, with cyclical types, and with non-cyclical. We
// should handle them at least as well as Json-schema validators handle them.

import {Suite, TArg, TArray, TFunc, TIface, TLiteral,
        TName, TProp, TTuple, TType, TUnion} from "./types";
import {TNodeProcessor} from "./types";

export interface Validator {
  validate(value: any): void;
  // If args is not null, validates args only; else validates result only.
  validateCall?(method: string, args: any[]|null, result?: any): void;
}

export class VError extends Error {
  constructor(public path: string, message: string) {
    super(message);
  }
}

export class SuiteValidator extends TNodeProcessor<CtxValidator> {
  private _suite: Suite;
  private _typeValidators: {[name: string]: CtxValidator} = {};

  constructor(suite: Suite) {
    super();
    this._suite = suite;
    for (const name in this._suite) {
      if (this._suite.hasOwnProperty(name)) {
        this._typeValidators[name] = this.dispatch(this._suite[name], name);
      }
    }
  }
  public getValidator(typeName: string): Validator {
    const v: CtxValidator = this._typeValidators[typeName];
    if (!v) {
      throw new Error(`Unknown type ${typeName}`);
    }
    const checkCall = v.checkCall;
    const ret: Validator = {
      validate: (value: any): void => v(new VContext(), value),
    };
    if (checkCall) {
      ret.validateCall = (method, args, res) => checkCall(new VContext(), method, args, res);
    }
    return ret;
  }

  protected _procTArg(t: TArg): CtxValidator {
    const ttype: TType = t.isOpt ? new TUnion([t.ttype, new TName("undefined")]) : t.ttype;
    const validator = this.dispatch(ttype);
    const name = t.name;
    return function(this: void, ctx: VContext, value: any): void {
      ctx.propPush(name);
      validator(ctx, value);
      ctx.propPop();
    };
  }
  protected _procTArray(t: TArray): CtxValidator {
    const validator: CtxValidator = this.dispatch(t.ttype);
    return function(this: void, ctx: VContext, value: any): void {
      ctx.assert(Array.isArray(value), "is not an array");
      ctx.cyclePush(value);
      ctx.propPush(0);
      for (let i = 0; i < value.length; i++) {
        ctx.propSet(i);
        validator(ctx, value[i]);
      }
      ctx.propPop();
      ctx.cyclePop(value);
    };
  }
  protected _procTFunc(t: TFunc, name?: string): CtxValidator {
    // Note that the main checker just checks if the value is a method. We can"t check argument
    // types at run-time, so we just check that it"s a function. More helpfull, we include
    // .checkCall methods.
    const v: CtxValidator = function(this: void, ctx: VContext, value: any): void {
      ctx.assert(typeof value === "function", "is not a method");
    };
    const argValidators: CtxValidator[] = t.args.map(a => this._procTArg(a));
    const resultValidator: CtxValidator = this.dispatch(t.result);
    const callName = name ? `${name}()` : "()";
    v.checkCall = function(ctx: VContext, method: string, args: any[]|null, result: any): void {
      ctx.propPush(callName);
      ctx.setMessage("bad call");
      if (args === null) {
        resultValidator(ctx, result);
      } else {
        for (let i = 0; i < argValidators.length; i++) {
          argValidators[i](ctx, args[i]);
        }
      }
      ctx.propPop();
    };
    return v;
  }
  protected _procTIface(tiface: TIface, name?: string): CtxValidator {
    const propValidators = tiface.props.map(p => this._procTProp(p));
    const message = name ? `is not a ${name}` : null;
    const validator: CtxValidator = function(this: void, ctx: VContext, value: any): void {
      if (message) {
        ctx.setMessage(message);
      }
      ctx.assert(value !== null && typeof value === "object", "is not an object");
      ctx.cyclePush(value);
      for (const v of propValidators) {
        v(ctx, value);
      }
      // We don"t check here that has no unknown properties. Such strict checks are not
      // recommended anyway, as they preclude backward-compatibility.
      ctx.cyclePop(value);
    };

    const methodCheckers: {[name: string]: CheckCall} = {};
    tiface.props.forEach((p, i) => {
      const v = propValidators[i];
      if (v.checkCall) {
        methodCheckers[p.name] = v.checkCall;
      }
    });
    validator.checkCall = (ctx: VContext, method: string, args: any[]|null, res: any): void => {
      ctx.assert(methodCheckers.hasOwnProperty(method), "unknown method");
      methodCheckers[method](ctx, method, args, res);
    };
    return validator;
  }
  protected _procTLiteral(t: TLiteral): CtxValidator {
    const tvalue = t.value;
    const message = `is not ${JSON.stringify(tvalue)}`;
    return function(this: void, ctx: VContext, value: any): void {
      ctx.assert(value === tvalue, message);
    };
  }
  protected _procTName(t: TName): CtxValidator {
    if (this._typeValidators.hasOwnProperty(t.name)) {
      return this._typeValidators[t.name];
    }
    if (isBasicType.hasOwnProperty(t.name)) {
      const checker: (value: any) => boolean = isBasicType[t.name];
      const message = `is not a ${t.name}`;
      return function(this: void, ctx: VContext, value: any): void {
        ctx.assert(checker(value), message);
      };
    }
    throw new Error(`Unknown type ${t.name}`);
  }
  protected _procTProp(tprop: TProp): CtxValidator {
    const validator: CtxValidator = (tprop.ttype instanceof TFunc) ?
      this._procTFunc(tprop.ttype, tprop.name) : this.dispatch(tprop.ttype);
    const name = tprop.name;
    let ret: CtxValidator;
    if (tprop.isOpt) {
      ret = function(this: void, ctx: VContext, value: any): void {
        if (value.hasOwnProperty(name)) {
          ctx.propPush(name);
          validator(ctx, value[name]);
          ctx.propPop();
        }
      };
    } else {
      ret = function(this: void, ctx: VContext, value: any): void {
        ctx.propPush(name);
        ctx.assert(value.hasOwnProperty(name), "is missing");
        validator(ctx, value[name]);
        ctx.propPop();
      };
    }
    ret.checkCall = validator.checkCall;
    return ret;
  }
  protected _procTTuple(t: TTuple): CtxValidator {
    const validators: CtxValidator[] = t.ttypes.map(item => this.dispatch(item));
    return function(this: void, ctx: VContext, value: any): void {
      ctx.assert(Array.isArray(value), "is not an array");
      ctx.cyclePush(value);
      ctx.propPush(0);
      for (let i = 0; i < validators.length; i++) {
        ctx.propSet(i);
        validators[i](ctx, value[i]);
      }
      ctx.cyclePop(value);
      ctx.propPop();
    };
  }
  protected _procTUnion(t: TUnion): CtxValidator {
    const validators: CtxValidator[] = t.ttypes.map(item => this.dispatch(item));
    if (validators.length === 0) {
      throw new Error("Invalid union type with no members");
    }
    return function(this: void, ctx: VContext, value: any): void {
      let message = "has no match";
      for (const v of validators) {
        try {
          // We start a new context here for two reasons. One is to get shorter message (relative
          // to union"s path), which we"ll concatenate. More importantly, we avoid `finally`
          // clauses throughout, assuming that we can have incinsistent state after a thrown
          // error. But if the error is caught, inoinsistent step will bite us.
          return v(new VContext(), value);
        } catch (e) {
          message += ", " + e.message;
        }
      }
      ctx.assert(false, message);
    };
  }
}

type CheckCall = (ctx: VContext, method: string, args: any[]|null, result: any) => void;

export interface CtxValidator {
  (ctx: VContext, value: any): void;
  checkCall?(ctx: VContext, method: string, args: any[]|null, result: any): void;
}


export class VContext {
  private _propNames: Array<string|number> = [""];
  private _messages: Array<string|null> = [null];
  private _cycleStack: Set<any> = new Set();

  public cyclePush(value: any): void {
    this.assert(!this._cycleStack.has(value), "is cyclical reference");
    this._cycleStack.add(value);
  }
  public cyclePop(value: any): void {
    this._cycleStack.delete(value);
  }
  public propPush(name: string|number): void {
    this._propNames.push(name);
    this._messages.push(null);
  }
  public propSet(name: string|number): void {
    const len = this._propNames.length;
    if (len > 0) {
      this._propNames[len - 1] = name;
    }
  }
  public setMessage(message: string): void {
    const len = this._messages.length;
    if (len > 0) {
      this._messages[len - 1] = message;
    }
  }
  public propPop(): void {
    this._propNames.pop();
    this._messages.pop();
  }
  public assert(condition: boolean, message: string): void {
    if (!condition) {
      this.fail(message);
    }
  }
  public fail(message: string): never {
    let path: string = "";
    const msgParts: string[] = [];
    for (let i = 0; i < this._propNames.length; i++) {
      const p = this._propNames[i];
      path += (typeof p === "number") ? `[${p}]` : (p ? `.${p}` : "");
      const m = this._messages[i];
      if (m) {
        msgParts.push(`${path || "value"} ${m}`);
      }
    }
    if (message) {
      msgParts.push(`${path || "value"} ${message}`);
    }
    throw new VError(path, msgParts.join(", "));
  }
}

const isBasicType: {[name: string]: (obj: any) => boolean} = {
  string(obj: any): boolean { return typeof obj === "string"; },
  number(obj: any): boolean { return typeof obj === "number"; },
  boolean(obj: any): boolean { return typeof obj === "boolean"; },
  undefined(obj: any): boolean { return obj === undefined; },
  null(obj: any): boolean { return obj === null; },
  void(obj: any): boolean { return obj == null; },
  any(obj: any): boolean { return true; },
};
