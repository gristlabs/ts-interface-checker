"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Error thrown by validation. Besides an informative message, it includes the path to the
 * property which triggered the failure.
 */
class VError extends Error {
    constructor(path, message) {
        super(message);
        this.path = path;
    }
}
exports.VError = VError;
/**
 * Fast implementation of IContext used for first-pass validation. If that fails, we can validate
 * using DetailContext to collect error messages. That's faster for the common case when messages
 * normally pass validation.
 */
class NoopContext {
    fail(relPath, message, score) {
        return false;
    }
    unionResolver() { return this; }
    createContext() { return this; }
    resolveUnion(ur) { }
}
exports.NoopContext = NoopContext;
/**
 * Complete implementation of IContext that collects meaningfull errors.
 */
class DetailContext {
    constructor() {
        // Stack of property names and associated messages for reporting helpful error messages.
        this._propNames = [""];
        this._messages = [null];
        // Score is used to choose the best union member whose DetailContext to use for reporting.
        // Higher score means better match (or rather less severe mismatch).
        this._score = 0;
    }
    fail(relPath, message, score) {
        this._propNames.push(relPath);
        this._messages.push(message);
        this._score += score;
        return false;
    }
    unionResolver() {
        return new DetailUnionResolver();
    }
    resolveUnion(unionResolver) {
        const u = unionResolver;
        let best = null;
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
    getError() {
        let path = "value";
        const msgParts = [];
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
exports.DetailContext = DetailContext;
class DetailUnionResolver {
    constructor() {
        this.contexts = [];
    }
    createContext() {
        const ctx = new DetailContext();
        this.contexts.push(ctx);
        return ctx;
    }
}
