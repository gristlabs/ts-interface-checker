import {ITypeSuite, TType} from "./types";

/**
 * Error thrown by validation. Besides an informative message, it includes the path to the
 * property which triggered the failure.
 */
export class VError extends Error {
  constructor(public path: string, message: string) {
    super(message);
  }
}

export interface ICheckFailReporter {
  ctxFailMessage(): string|null;
}

function getMessage(message: string|ICheckFailReporter|null): string|null {
  return typeof message === "string" || !message ? message : message.ctxFailMessage();
}

/**
 * VContext maintains the context of validations, including the stack of property names being
 * visited, to allow reporing errors with object paths like ".foo.bar[3]". It also detects
 * and disallows cyclical references.
 */
export class VContext {
  public readonly strict: boolean;

  // Mapping of type names to types used to resolve named types.
  private _suite: ITypeSuite;

  // Stack of objects being validated, for detecting cycles.
  private _cycleStack: Set<any> = new Set();

  // Stack of property names and associated messages for reporting helpful error messages.
  private _propNames: Array<string|number> = [""];
  private _messages: Array<string|ICheckFailReporter|null> = [null];

  constructor(suite: ITypeSuite, strict: boolean) {
    this.strict = strict;
    this._suite = suite;
  }

  /** Returns the TType named in this context's type suite. */
  public getNamedType(name: string): TType {
    const ttype = this._suite[name];
    if (!ttype) { throw new Error(`Unknown type "${name}"`); }
    return ttype;
  }

  /** Returns a new VContext with the same parameters as the current one. */
  public makeNew(): VContext {
    return new VContext(this._suite, this.strict);
  }

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
  public setMessage(message: string|ICheckFailReporter): void {
    const len = this._messages.length;
    if (len > 0) {
      this._messages[len - 1] = message;
    }
  }
  public propPop(): void {
    this._propNames.pop();
    this._messages.pop();
  }
  public assert(condition: boolean, message: string|ICheckFailReporter): void {
    if (!condition) {
      this.fail(message);
    }
  }
  public fail(message: string|ICheckFailReporter): never {
    let path: string = "";
    const msgParts: string[] = [];
    for (let i = 0; i < this._propNames.length; i++) {
      const p = this._propNames[i];
      path += (typeof p === "number") ? `[${p}]` : (p ? `.${p}` : "");
      const m: string|null = getMessage(this._messages[i]);
      if (m) {
        msgParts.push(`${path || "value"} ${m}`);
      }
    }
    const msg: string|null = getMessage(message);
    if (msg) {
      msgParts.push(`${path || "value"} ${msg}`);
    }
    throw new VError(path, msgParts.join(", "));
  }
}
