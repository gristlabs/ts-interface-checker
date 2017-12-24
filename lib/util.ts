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
  private _messages: Array<string|null> = [null];

  constructor(suite: ITypeSuite, strict: boolean) {
    this.strict = strict;
    this._suite = suite;
  }

  /** Returns the TType named in this context's type suite. */
  public getNamedType(name: string): TType {
    const ttype = this._suite[name];
    if (!ttype) { throw new Error(`Unknown type ${name}`); }
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
    this._propNames[len - 1] = name;
  }
  public setMessage(message: string): void {
    const len = this._messages.length;
    this._messages[len - 1] = message;
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
    let path: string = "value";
    const msgParts: string[] = [];
    for (let i = 0; i < this._propNames.length; i++) {
      const p = this._propNames[i];
      path += (typeof p === "number") ? `[${p}]` : (p ? `.${p}` : "");
      const overrideMsg = (i === this._propNames.length - 1) ? message : null;
      const m = overrideMsg || this._messages[i];
      if (m) {
        msgParts.push(`${path} ${m}`);
      }
    }
    throw new VError(path, msgParts.join(", "));
  }
}
