/**
 * Error thrown by validation. Besides an informative message, it includes the path to the
 * property which triggered the failure.
 */
export class VError extends Error {
  constructor(public path: string, message: string) {
    super(message);
  }
}

export interface IUnionResolver {
  addMember(c: Context): void;
}

const noopUR: IUnionResolver = {
  addMember(c: Context): void { /* noop */ },
};

// TODO: Rename to "Context". Have fast and complete impl.
export class Context {
  public message: string = "hello";
  public fail(relPath: string|number|null, message: string|null, score: number = 0): false {
    return false;
  }
  public clone(): Context {
    return this;
  }
  public unionResolver(): IUnionResolver {
    return noopUR;
  }
  public resolveUnion(ur: IUnionResolver): void {
    // do nothing
  }
  public getErrorMessage() {
    return this.message;
  }
}

export const NoopContext = Context;
// TODO: Define all context versions in one file.
export class ErrorContext extends Context {
  // Stack of property names and associated messages for reporting helpful error messages.
  private _propNames: Array<string|number|null> = [""];
  private _messages: Array<string|null> = [null];
  private _score: number = 0;

  public fail(relPath: string|number|null, message: string|null, score: number = 0): false {
    this._propNames.push(relPath);
    this._messages.push(message);
    this._score += score ? -score : (relPath ? 1 : 0);
    return false;
  }
  public clone() {
    return new ErrorContext();
  }
  public unionResolver(): IUnionResolver {
    return new UR();
  }
  public resolveUnion(ur: IUnionResolver): void {
    const u = ur as UR;
    if (u.best) {
      this._propNames.push(...u.best._propNames);
      this._messages.push(...u.best._messages);
    }
  }
  public getErrorMessage() {
    let path: string = "value";
    const msgParts: string[] = [];
    for (let i = this._propNames.length - 1; i >= 0; i--) {
      const p = this._propNames[i];
      path += (typeof p === "number") ? `[${p}]` : (p ? `.${p}` : "");
      const m = this._messages[i];
      if (m) {
        msgParts.push(`${path} ${m}`);
      }
    }
    return msgParts.join(", ");
  }
  public score(): number {
    return this._score;
  }
}

class UR implements IUnionResolver {
  public best: ErrorContext;
  public addMember(c: Context): void {
    const ctx = c as ErrorContext;
    if (!this.best || ctx.score() >= this.best.score()) {
      this.best = ctx;
    }
  }
}
