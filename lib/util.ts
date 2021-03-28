/**
 * Error thrown by validation. Besides an informative message, it includes the path to the
 * property which triggered the failure.
 */
export class VError extends Error {
  constructor(public path: string, message: string) {
    super(message);
    // See https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work for info about this workaround.
    Object.setPrototypeOf(this, VError.prototype);
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
  fork(): IContext;
  more(): boolean;
}

/**
 * This helper class is used to collect error messages reported while validating unions.
 */
export interface IUnionResolver {
  createContext(): IContext;
}

/**
 * IErrorDetail describes errors as returned by the validate() and validateStrict() methods.
 */
export interface IErrorDetail {
  path: string;
  message: string;
  nested?: IErrorDetail[];
}

/**
 * Fast implementation of IContext used for first-pass validation. If that fails, we can validate
 * using DetailContext to collect error messages. That's faster for the common case when messages
 * normally pass validation.
 */
export class NoopContext implements IContext, IUnionResolver {
  private _more: boolean = true;

  public fail(relPath: string|number|null, message: string|null, score: number): false {
    this._more = false;
    return false;
  }

  public fork(): IContext {
    this._more = true;
    return this;
  }

  public more(): boolean {
    return this._more;
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
  private _propNames: Array<string|number|null> = [];
  private _messages: Array<string|null> = [];
  private _forks: Array<DetailContext> = [];

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

  public getError(path: string): VError {
    const fullMessage = this.getErrorDetails(path)
        .map(d => `${d.path} ${d.message}`)
        .join("; ");
    return new VError(path, fullMessage);
  }

  public getErrorDetail(path: string): IErrorDetail {
    return this.getErrorDetails(path)[0]
  }

  private getErrorDetails(path: string): IErrorDetail[] {
    let detail: IErrorDetail|null = null;
    let nested: IErrorDetail|null = null;
    const details: IErrorDetail[] = [];
    for (let i = this._propNames.length - 1; i >= 0; i--) {
      const p = this._propNames[i];
      path += (typeof p === "number") ? `[${p}]` : (p ? `.${p}` : "");
      const message = this._messages[i];
      if (message) {
        nested = {path, message}
        if (detail) {
          detail.nested = [nested]
        }
        detail = nested
        details.push(detail);
      }
    }
    return details;
  }

  public fork(): IContext {
    const ctx = new DetailContext();
    this._forks.push(ctx);
    return ctx;
  }

  public more(): boolean {
    const fork = this._forks[this._forks.length - 1];
    if (fork._propNames.length) {
      this._propNames.push(...fork._propNames);
      this._messages.push(...fork._messages);
      this._score += fork._score;
      return false;
    }
    return true;
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
