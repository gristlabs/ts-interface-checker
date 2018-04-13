"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const util_1 = require("./util");
/**
 * Export functions used to define interfaces.
 */
var types_2 = require("./types");
exports.TArray = types_2.TArray;
exports.TFunc = types_2.TFunc;
exports.TIface = types_2.TIface;
exports.TLiteral = types_2.TLiteral;
exports.TName = types_2.TName;
exports.TOptional = types_2.TOptional;
exports.TParam = types_2.TParam;
exports.TParamList = types_2.TParamList;
exports.TProp = types_2.TProp;
exports.TTuple = types_2.TTuple;
exports.TType = types_2.TType;
exports.TUnion = types_2.TUnion;
exports.array = types_2.array;
exports.func = types_2.func;
exports.iface = types_2.iface;
exports.lit = types_2.lit;
exports.name = types_2.name;
exports.opt = types_2.opt;
exports.param = types_2.param;
exports.tuple = types_2.tuple;
exports.union = types_2.union;
exports.BasicType = types_2.BasicType;
/**
 * Takes one of more type suites (e.g. a module generated by `ts-interface-builder`), and combines
 * them into a suite of interface checkers. If a type is used by name, that name should be present
 * among the passed-in type suites.
 *
 * The returned object maps type names to Checker objects.
 */
function createCheckers(...typeSuite) {
    const fullSuite = Object.assign({}, types_1.basicTypes, ...typeSuite);
    const checkers = {};
    for (const suite of typeSuite) {
        for (const name of Object.keys(suite)) {
            checkers[name] = new Checker(fullSuite, suite[name]);
        }
    }
    return checkers;
}
exports.createCheckers = createCheckers;
/**
 * Checker implements validation of objects, and also includes accessors to validate method calls.
 * Checkers should be created using `createCheckers()`.
 */
class Checker {
    // Create checkers by using `createCheckers()` function.
    constructor(suite, ttype) {
        this.suite = suite;
        this.ttype = ttype;
        this.props = new Map();
        if (ttype instanceof types_1.TIface) {
            for (const p of ttype.props) {
                this.props.set(p.name, p.ttype);
            }
        }
        this.checkerPlain = this.ttype.getChecker(suite, false);
        this.checkerStrict = this.ttype.getChecker(suite, true);
    }
    /**
     * Check that the given value satisfies this checker's type, or throw Error.
     */
    check(value) { return this._doCheck(this.checkerPlain, value); }
    /**
     * A fast check for whether or not the given value satisfies this Checker's type. This returns
     * true or false, does not produce an error message, and is fast both on success and on failure.
     */
    test(value) {
        return this.checkerPlain(value, new util_1.NoopContext());
    }
    /**
     * Check that the given value satisfies this checker's type strictly. This checks that objects
     * and tuples have no extra members. Note that this prevents backward compatibility, so usually
     * a plain check() is more appropriate.
     */
    strictCheck(value) { return this._doCheck(this.checkerStrict, value); }
    /**
     * A fast strict check for whether or not the given value satisfies this Checker's type. Returns
     * true or false, does not produce an error message, and is fast both on success and on failure.
     */
    strictTest(value) {
        return this.checkerStrict(value, new util_1.NoopContext());
    }
    /**
     * If this checker is for an interface, returns a Checker for the type required for the given
     * property of this interface.
     */
    getProp(prop) {
        const ttype = this.props.get(prop);
        if (!ttype) {
            throw new Error(`Type has no property ${prop}`);
        }
        return new Checker(this.suite, ttype);
    }
    /**
     * If this checker is for an interface, returns a Checker for the argument-list required to call
     * the given method of this interface. E.g. if this Checker is for the interface:
     *    interface Foo {
     *      find(s: string, pos?: number): number;
     *    }
     * Then methodArgs("find").check(...) will succeed for ["foo"] and ["foo", 3], but not for [17].
     */
    methodArgs(methodName) {
        const tfunc = this._getMethod(methodName);
        return new Checker(this.suite, tfunc.paramList);
    }
    /**
     * If this checker is for an interface, returns a Checker for the return value of the given
     * method of this interface.
     */
    methodResult(methodName) {
        const tfunc = this._getMethod(methodName);
        return new Checker(this.suite, tfunc.result);
    }
    /**
     * If this checker is for a function, returns a Checker for its argument-list.
     */
    getArgs() {
        if (!(this.ttype instanceof types_1.TFunc)) {
            throw new Error("getArgs() applied to non-function");
        }
        return new Checker(this.suite, this.ttype.paramList);
    }
    /**
     * If this checker is for a function, returns a Checker for its result.
     */
    getResult() {
        if (!(this.ttype instanceof types_1.TFunc)) {
            throw new Error("getResult() applied to non-function");
        }
        return new Checker(this.suite, this.ttype.result);
    }
    /**
     * Return the type for which this is a checker.
     */
    getType() {
        return this.ttype;
    }
    /**
     * Actual implementation of check() and strictCheck().
     */
    _doCheck(checkerFunc, value) {
        const noopCtx = new util_1.NoopContext();
        if (!checkerFunc(value, noopCtx)) {
            const detailCtx = new util_1.DetailContext();
            checkerFunc(value, detailCtx);
            throw detailCtx.getError();
        }
    }
    _getMethod(methodName) {
        const ttype = this.props.get(methodName);
        if (!ttype) {
            throw new Error(`Type has no property ${methodName}`);
        }
        if (!(ttype instanceof types_1.TFunc)) {
            throw new Error(`Property ${methodName} is not a method`);
        }
        return ttype;
    }
}
exports.Checker = Checker;
