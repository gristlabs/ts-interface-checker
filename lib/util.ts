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
 * IContext is used during validation to collect error messages. There is a "noop" fast
 * implementation that does not pay attention to messages, and a full implementation that does.
 */
export interface IContext {
  fail(relPath: string|number|null, message: string|null, score: number): false;
  unionResolver(): IUnionResolver;
  resolveUnion(ur: IUnionResolver): void;
}

/**
 * This helper class is used to collect error messages reported while validating unions.
 */
export interface IUnionResolver {
  createContext(): IContext;
}

/**
 * Fast implementation of IContext used for first-pass validation. If that fails, we can validate
 * using DetailContext to collect error messages. That's faster for the common case when messages
 * normally pass validation.
 */
export class NoopContext implements IContext, IUnionResolver {
  public fail(relPath: string|number|null, message: string|null, score: number): false {
    return false;
  }
  public unionResolver(): IUnionResolver { return this; }
  public createContext(): IContext { return this; }
  public resolveUnion(ur: IUnionResolver): void { /* noop */ }
}

/**
 * Complete implementation of IContext that collects meaningfull errors.
 */
export class DetailContext implements IContext {
  // Stack of property names and associated messages for reporting helpful error messages.
  private _propNames: Array<string|number|null> = [""];
  private _messages: Array<string|null> = [null];

  // Score is used to choose the best union member whose DetailContext to use for reporting.
  // Higher score means better match (or rather less severe mismatch).
  private _score: number = 0;

  public fail(relPath: string|number|null, message: string|null, score: number): false {
    this._propNames.push(relPath);
    this._messages.push(message);
    this._score += score;
    return false;
  }
  public unionResolver(): IUnionResolver {
    return new DetailUnionResolver();
  }
  public resolveUnion(unionResolver: IUnionResolver): void {
    const u = unionResolver as DetailUnionResolver;
    let best: DetailContext|null = null;
    for (const ctx of u.contexts) {
      if (!best || ctx._score >= best._score) {
        best = ctx;
      }
    }
    if (best && best._score > 0) {
      this._propNames.push(...best._propNames);
      this._messages.push(...best._messages);
    }
  }

  public getError(): VError {
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
    return new VError(path, msgParts.join("; "));
  }
}

class DetailUnionResolver implements IUnionResolver {
  public contexts: DetailContext[] = [];
  public createContext(): DetailContext {
    const ctx = new DetailContext();
    this.contexts.push(ctx);
    return ctx;
  }
}
