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

  /**
   * Used only in checkers of types that may record multiple
   * parallel failures for a single object. After calling fork(), a checker must:
   *
   *
   * - Use the returned forked context instead of the original context for (potential) failures,
   *    whether it's in a deeper checker or when calling fail().
   * - After using the fork to check one 'thing' (e.g. a property or a base class), write:
   *
   *       if (!ctx.completeFork()) {
   *         return false;
   *       }
   *
   *    Always call completeFork(), regardless of whether there was a failure.
   *    Do this instead of returning directly after a failure as is done with non-forked type checkers.
   * - Once you're done checking, `return !ctx.failed()`
   *    to check whether any failures were gathered along the way in forks.
   */
  fork(): IContext;

  /**
   * Must always be called after a call to fork() on the same context.
   *
   * Indicates that the checker is done with the current fork and any subsequent
   * checks on the current object will be done on a new fork.
   *
   * Returns true if the checker should keep checking the current object,
   * or false if enough failures have been noted and the checker should return now.
   */
  completeFork(): boolean;

  /**
   * Returns true if any failures were recorded in this context.
   */
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

  /** Contexts created by fork() which have completed and contain failures */
  private _failedForks: Array<DetailContext> = [];

  /**
   * Maximum number of errors recorded at one level for an object,
   * i.e. the maximum length of Checker.validate() or IErrorDetail.nested.
   */
  // If _failedForks has this length then completeFork() should return false
  // so that the checker stops making more forks.
  public static maxForks = 3;

  /**
   * Contains the context returned by fork() which should be checked until
   * completeFork() is called.
   * Will be reused for the next fork() if there are no failures.
   */
  private _currentFork: DetailContext|null = null;

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
      this._failedForks.push(...best._failedForks);
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

    // As checkers call fail() and return to their parent checkers,
    // the deepest failures are recorded first.
    // Go through failures in reverse to start from the root type
    for (let i = this._propNames.length - 1; i >= 0; i--) {
      const p = this._propNames[i];
      path += (typeof p === "number") ? `[${p}]` : (p ? `.${p}` : "");
      const message = this._messages[i];
      if (!message) {
        continue;
      }

      nested = {path, message}
      if (detail) {
        detail.nested = [nested]
      } else {
        // This is the root failure, so it will be returned
        details.push(nested);
      }
      detail = nested
    }

    const forkErrors = flatten(this._failedForks.map(fork => fork.getErrorDetails(path)));
    if (detail && forkErrors.length) {  // don't put an empty array in detail.nested
      detail.nested = forkErrors;
    } else {
      details.push(...forkErrors);
    }

    return details;
  }

  public fork(): IContext {
    if (this._currentFork == null) {
      this._currentFork = new DetailContext();
    }
    return this._currentFork;
  }

  public completeFork(): boolean {
    const fork = this._currentFork!;
    if (fork._failed()) {
      this._failedForks.push(fork);
      this._currentFork = null;

      // To preserve old behaviour, use the score of the first failure
      // Might want to revise this
      if (this._failedForks.length === 1) {
        this._score = fork._score;
      }

    }
    return this._failedForks.length < DetailContext.maxForks;
  }

  // failed() is the public interface,
  // it gets monkeypatched to ensure correct usage in checkers.
  // _failed() may be called internally
  // in ways which would fail the monkeypatched assertions.

  public failed(): boolean {
    return this._failed();
  }

  private _failed(): boolean {
    return this._propNames.length + this._failedForks.length > 0;
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

/**
 * Returns lines of a message describing `error`.
 * The lines should be newline separated in the final message.
 * Only returns multiple lines if `error` or a descendant
 * has multiple errors in its `.nested` array.
 * Simple paths of nested errors anywhere in the tree
 * are collapsed into a single line until a branch is reached.
 */
const errorLines = (error: IErrorDetail): string[] => {
  const rootMessage = `${error.path} ${error.message}`;
  const nestedErrors = error.nested || [];
  const nestedLines = flatten(nestedErrors.map(errorLines));
  if (nestedErrors.length == 1) {
    // Single nested errors are collapsed into the first line,
    // but they may have branches deeper down leading to more lines
    // which are already indented
    const [first, ...rest] = nestedLines;
    return [
      `${rootMessage}; ${first}`,
      ...rest,
    ];
  } else {
    // Indent messages from nested errors
    // or just return [rootMessage] if there are no nested errors
    return [
      rootMessage,
      ...nestedLines.map(line => "    " + line)
    ];
  }
}

/** Shallow flatten a 2D array into a 1D array */
function flatten<T>(arr: T[][]): T[] {
  return ([] as T[]).concat(...arr);
}
