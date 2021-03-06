import {assert} from "chai";
import {DetailContext, IErrorDetail, NoopContext} from "../lib/util";

/**
 * Replace the method called `name` of `cls`
 * with a patched method that calls `replacement`.
 *
 * `replacement` gets two arguments:
 * - `instance` is the instance of `cls` whose method is being called, i.e. `this`.
 * - `original` is the original method that was patched, with all arguments bound.
 *      You must call it with no arguments and return its result.
 *
 * The same method can be patched multiple times and each successive patch
 * will call the previous patch as expected.
 */
const patchMethod = (
  cls: any,
  name: string,
  replacement: (instance: any, original: Function) => void
): void => {
  const originalMethod: Function = cls.prototype[name];
  cls.prototype[name] = function () {
    const original = originalMethod.bind(this, ...Array.from(arguments));
    return replacement(this, original);
  }
};

const originalPrototypes = {
  NoopContext: {...NoopContext.prototype},
  DetailContext: {...DetailContext.prototype},
}

export const removePatches = () => {
  (NoopContext as any).prototype = originalPrototypes.NoopContext;
  (DetailContext as any).prototype = originalPrototypes.DetailContext;
}

export const applyPatches = () => {
  /* In fork() and in failed(),
   * assert that the user shouldn't have returned due to previous failure(s).
   */

  const message = "This context has failed too much, " +
    "you should have returned already after a call to fail() or completeFork()."
  const notFailedNoop = (ctx: any, original: Function) => {
    assert.isFalse(ctx._failed, message);
    return original();
  };
  patchMethod(NoopContext, "fork", notFailedNoop);
  patchMethod(NoopContext, "failed", notFailedNoop);

  const notFailedDetail = (ctx: any, original: Function) => {
    assert.isEmpty(ctx._propNames, message);
    assert.isEmpty(ctx._messages, message);
    assert.isBelow(ctx._failedForks.length, DetailContext.maxForks, message);
    return original();
  };
  patchMethod(DetailContext, "fork", notFailedDetail);
  patchMethod(DetailContext, "failed", notFailedDetail);

  // The remaining assertions only apply to DetailContext
  // We can't assert much about NoopContext because it returns itself
  // instead of creating new contexts when forked

  /* Assert that fork() and completeFork() are called in pairs,
   * and that the forked context is used between instead of the original.
   */

  patchMethod(DetailContext, "fork", (ctx, original) => {
    assert.isNotTrue(
      ctx._activeFork,
      "There's already an active fork, did you use the original context instead of the fork? " +
      "Or did you miss a call to completeFork()?"
    );
    ctx._activeFork = true;
    return original();
  });

  patchMethod(DetailContext, "completeFork", (ctx, original) => {
    assert.isTrue(
      ctx._activeFork,
      "There's no active fork, did you miss a call to fork()?"
    );
    ctx._activeFork = false;
    return original();
  });

  patchMethod(DetailContext, "fail", (ctx, original) => {
    assert.isNotTrue(
      ctx._activeFork,
      "There's still an active fork, did you use the original context instead of the fork? " +
      "Or did you miss a call to completeFork()?"
    );
    return original();
  });

  const shouldCallFailedMessage = "Called ctx.fail() after ctx.completeFork() returned true " +
      "without an intervening call to ctx.failed(). " +
      "Once a checker starts forking its context, " +
      "it mustn't call fail() directly on that context or pass it to other checkers, " +
      "and it must return !ctx.failed() at the end."

  patchMethod(DetailContext, "completeFork", (ctx, original) => {
    const result = original();
    ctx._shouldCallFailed = result;
    return result;
  });

  patchMethod(DetailContext, "failed", (ctx, original) => {
    ctx._shouldCallFailed = false;
    return original();
  });

  patchMethod(DetailContext, "fail", (ctx, original) => {
    assert.isNotTrue(ctx._shouldCallFailed, shouldCallFailedMessage);
    return original();
  });

  /* Sanity checks on error details and messages
   */

  /** Ensure there are no empty strings or arrays */
  const checkErrorDetails = (errors: IErrorDetail[]) => {
    assert.isNotEmpty(errors, "There shouldn't be any empty arrays of errors anywhere");
    errors.forEach(error => {
      assert.isNotEmpty(error.path);
      assert.isNotEmpty(error.message);
      if (error.nested) {
        checkErrorDetails(error.nested);
      }
    })
  }

  patchMethod(DetailContext, "getErrorDetails", (ctx, original) => {
    const result = original();
    assert.isTrue(ctx._failed(), "getErrorDetails() should only be called after a NoopContext failed");
    checkErrorDetails(result);
    if (ctx._messages.length) {
      assert.equal(
        result.length,
        1,
        "Plain failures should produce 1 error at the top level"
      );
    } else {
      assert.equal(result.length, ctx._failedForks.length);
    }
    return result;
  });

  patchMethod(DetailContext, "getError", (ctx, original) => {
    assert.isTrue(ctx._failed(), "getError() should only be called after a NoopContext failed");
    const result = original();
    assert.isNotEmpty(result.path);
    assert.isNotEmpty(result.message);
    return result;
  });

  /* Things that should always be true for DetailContext
   */

  const always = (ctx: any, original: Function) => {
    assert.equal(ctx._propNames.length, ctx._messages.length);

    assert.isAtMost(ctx._failedForks.length, DetailContext.maxForks);
    ctx._failedForks.forEach((fork: any) => {
      assert.isTrue(fork._failed());
    });

    const forkFailed = ctx._currentFork?._failed();

    const result = original();

    // ctx._currentFork._failed() may be true when completeFork() is called,
    // but then ctx._currentFork should be set to null
    assert.isNotTrue(ctx._currentFork?._failed());
    if (forkFailed) {
      assert.isNull(ctx._currentFork);
    }

    return result;
  }

  "getError getErrorDetails fail failed fork completeFork unionResolver resolveUnion"
    .split(" ")
    .forEach(name => {
      patchMethod(DetailContext, name, always);
    });
}
