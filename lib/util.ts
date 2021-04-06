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
  completeFork(): boolean;
  failed(): boolean;
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
  private _failed: boolean = false;

  public fail(relPath: string|number|null, message: string|null, score: number): false {
    this._failed = true;
    return false;
  }

  public fork(): IContext {
    return this;
  }

  public completeFork(): boolean {
    return !this._failed;
  }

  public failed(): boolean {
    return this._failed;
  }

  public unionResolver(): IUnionResolver { return this; }
  public createContext(): IContext {
    this._failed = false;
    return this;
  }
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
  private _maxForks = 3;

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
      this._forks.push(...best._forks);
    }
  }

  public getError(path: string): VError {
    const fullMessage = flatten(this.getErrorDetails(path).map(errorLines))
        .join("\n");
    return new VError(path, fullMessage);
  }

  public getErrorDetails(path: string): IErrorDetail[] {
    let detail: IErrorDetail|null = null;
    let nested: IErrorDetail;
    const details: IErrorDetail[] = [];
    for (let i = this._propNames.length - 1; i >= 0; i--) {
      const p = this._propNames[i];
      path += (typeof p === "number") ? `[${p}]` : (p ? `.${p}` : "");
      const message = this._messages[i];
      if (message) {
        nested = {path, message}
        if (detail) {
          detail.nested = [nested]
        } else {
          details.push(nested);
        }
        detail = nested
      }
    }
    if (this._forks.length) {
      const forkErrors = flatten(this._forks.map(fork => fork.getErrorDetails(path)));
      if (detail) {
        detail.nested = forkErrors;
      } else {
        details.push(...forkErrors);
      }
    }

    return details;
  }

  public fork(): IContext {
    const ctx = new DetailContext();
    this._forks.push(ctx);
    return ctx;
  }

  public completeFork(): boolean {
    const fork = this._forks[this._forks.length - 1];
    if (fork.failed()) {
      // To preserve old behaviour, use the score of the first failure
      // Might want to revise this
      if (this._forks.length == 1) {
        this._score = fork._score;
      }
    } else {
      this._forks.pop();
    }
    return this._forks.length < this._maxForks;
  }

  public failed(): boolean {
    return this._propNames.length + this._forks.length > 0;
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

const errorLines = (error: IErrorDetail): string[] => {
  const rootMessage = `${error.path} ${error.message}`;
  const nestedErrors = error.nested || [];
  const nestedLines = flatten(nestedErrors.map(errorLines));
  if (nestedErrors.length == 1) {
    const [first, ...rest] = nestedLines;
    return [
      `${rootMessage}; ${first}`,
      ...rest,
    ];
  } else {
    return [
      rootMessage,
      ...nestedLines.map(line => "    " + line)
    ];
  }
}

function flatten<T>(arr: T[][]): T[] {
  return ([] as T[]).concat(...arr);
}
