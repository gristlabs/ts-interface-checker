"use strict";
/**
 * This module defines nodes used to define types and validations for objects and interfaces.
 */
// tslint:disable:no-shadowed-variable prefer-for-of
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("./util");
/** Node that represents a type. */
class TType {
}
exports.TType = TType;
/** Parses a type spec into a TType node. */
function parseSpec(typeSpec) {
    return typeof typeSpec === "string" ? name(typeSpec) : typeSpec;
}
function getNamedType(suite, name) {
    const ttype = suite[name];
    if (!ttype) {
        throw new Error(`Unknown type ${name}`);
    }
    return ttype;
}
/**
 * Defines a type name, either built-in, or defined in this suite. It can typically be included in
 * the specs as just a plain string.
 */
function name(value) { return new TName(value); }
exports.name = name;
class TName extends TType {
    constructor(name) {
        super();
        this.name = name;
        this._failMsg = `is not a ${name}`;
    }
    getChecker(suite, strict) {
        const ttype = getNamedType(suite, this.name);
        const checker = ttype.getChecker(suite, strict);
        if (ttype instanceof BasicType || ttype instanceof TName) {
            return checker;
        }
        // For complex types, add an additional "is not a <Type>" message on failure.
        return (value, ctx) => checker(value, ctx) ? true : ctx.fail(null, this._failMsg, 0);
    }
}
exports.TName = TName;
/**
 * Defines a literal value, e.g. lit('hello') or lit(123).
 */
function lit(value) { return new TLiteral(value); }
exports.lit = lit;
class TLiteral extends TType {
    constructor(value) {
        super();
        this.value = value;
        this.name = JSON.stringify(value);
        this._failMsg = `is not ${this.name}`;
    }
    getChecker(suite, strict) {
        return (value, ctx) => (value === this.value) ? true : ctx.fail(null, this._failMsg, -1);
    }
}
exports.TLiteral = TLiteral;
/**
 * Defines an array type, e.g. array('number').
 */
function array(typeSpec) { return new TArray(parseSpec(typeSpec)); }
exports.array = array;
class TArray extends TType {
    constructor(ttype) {
        super();
        this.ttype = ttype;
    }
    getChecker(suite, strict) {
        const itemChecker = this.ttype.getChecker(suite, strict);
        return (value, ctx) => {
            if (!Array.isArray(value)) {
                return ctx.fail(null, "is not an array", 0);
            }
            for (let i = 0; i < value.length; i++) {
                const ok = itemChecker(value[i], ctx);
                if (!ok) {
                    return ctx.fail(i, null, 1);
                }
            }
            return true;
        };
    }
}
exports.TArray = TArray;
/**
 * Defines a tuple type, e.g. tuple('string', 'number').
 */
function tuple(...typeSpec) {
    return new TTuple(typeSpec.map((t) => parseSpec(t)));
}
exports.tuple = tuple;
class TTuple extends TType {
    constructor(ttypes) {
        super();
        this.ttypes = ttypes;
    }
    getChecker(suite, strict) {
        const itemCheckers = this.ttypes.map((t) => t.getChecker(suite, strict));
        const checker = (value, ctx) => {
            if (!Array.isArray(value)) {
                return ctx.fail(null, "is not an array", 0);
            }
            for (let i = 0; i < itemCheckers.length; i++) {
                const ok = itemCheckers[i](value[i], ctx);
                if (!ok) {
                    return ctx.fail(i, null, 1);
                }
            }
            return true;
        };
        if (!strict) {
            return checker;
        }
        return (value, ctx) => {
            if (!checker(value, ctx)) {
                return false;
            }
            return value.length <= itemCheckers.length ? true :
                ctx.fail(itemCheckers.length, "is extraneous", 2);
        };
    }
}
exports.TTuple = TTuple;
/**
 * Defines a union type, e.g. union('number', 'null').
 */
function union(...typeSpec) {
    return new TUnion(typeSpec.map((t) => parseSpec(t)));
}
exports.union = union;
class TUnion extends TType {
    constructor(ttypes) {
        super();
        this.ttypes = ttypes;
        const names = ttypes.map((t) => t instanceof TName || t instanceof TLiteral ? t.name : null)
            .filter((n) => n);
        const otherTypes = ttypes.length - names.length;
        if (names.length) {
            if (otherTypes > 0) {
                names.push(`${otherTypes} more`);
            }
            this._failMsg = `is none of ${names.join(", ")}`;
        }
        else {
            this._failMsg = `is none of ${otherTypes} types`;
        }
    }
    getChecker(suite, strict) {
        const itemCheckers = this.ttypes.map((t) => t.getChecker(suite, strict));
        return (value, ctx) => {
            const ur = ctx.unionResolver();
            for (let i = 0; i < itemCheckers.length; i++) {
                const ok = itemCheckers[i](value, ur.createContext());
                if (ok) {
                    return true;
                }
            }
            ctx.resolveUnion(ur);
            return ctx.fail(null, this._failMsg, 0);
        };
    }
}
exports.TUnion = TUnion;
function makeIfaceProps(props) {
    return Object.keys(props).map((name) => makeIfaceProp(name, props[name]));
}
function makeIfaceProp(name, prop) {
    return prop instanceof TOptional ?
        new TProp(name, prop.ttype, true) :
        new TProp(name, parseSpec(prop), false);
}
/**
 * Defines an interface. The first argument is an array of interfaces that it extends, and the
 * second is an array of properties.
 */
function iface(bases, props) {
    return new TIface(bases, makeIfaceProps(props));
}
exports.iface = iface;
class TIface extends TType {
    constructor(bases, props) {
        super();
        this.bases = bases;
        this.props = props;
        this.propSet = new Set(props.map((p) => p.name));
    }
    getChecker(suite, strict) {
        const baseCheckers = this.bases.map((b) => getNamedType(suite, b).getChecker(suite, strict));
        const propCheckers = this.props.map((prop) => prop.ttype.getChecker(suite, strict));
        const testCtx = new util_1.NoopContext();
        const isPropRequired = this.props.map((prop, i) => !prop.isOpt && !propCheckers[i](undefined, testCtx));
        const checker = (value, ctx) => {
            if (typeof value !== "object" || value === null) {
                return ctx.fail(null, "is not an object", 0);
            }
            for (let i = 0; i < baseCheckers.length; i++) {
                if (!baseCheckers[i](value, ctx)) {
                    return false;
                }
            }
            for (let i = 0; i < propCheckers.length; i++) {
                const name = this.props[i].name;
                const v = value[name];
                if (v === undefined) {
                    if (isPropRequired[i]) {
                        return ctx.fail(name, "is missing", 1);
                    }
                }
                else {
                    const ok = propCheckers[i](v, ctx);
                    if (!ok) {
                        return ctx.fail(name, null, 1);
                    }
                }
            }
            return true;
        };
        if (!strict) {
            return checker;
        }
        // In strict mode, check also for unknown enumerable properties.
        return (value, ctx) => {
            if (!checker(value, ctx)) {
                return false;
            }
            for (const prop in value) {
                if (!this.propSet.has(prop)) {
                    return ctx.fail(prop, "is extraneous", 2);
                }
            }
            return true;
        };
    }
}
exports.TIface = TIface;
/**
 * Defines an optional property on an interface.
 */
function opt(typeSpec) { return new TOptional(parseSpec(typeSpec)); }
exports.opt = opt;
class TOptional {
    constructor(ttype) {
        this.ttype = ttype;
    }
}
exports.TOptional = TOptional;
/**
 * Defines a property in an interface.
 */
class TProp {
    constructor(name, ttype, isOpt) {
        this.name = name;
        this.ttype = ttype;
        this.isOpt = isOpt;
    }
}
exports.TProp = TProp;
/**
 * Defines a function. The first argument declares the function's return type, the rest declare
 * its parameters.
 */
function func(resultSpec, ...params) {
    return new TFunc(new TParamList(params), parseSpec(resultSpec));
}
exports.func = func;
class TFunc extends TType {
    constructor(paramList, result) {
        super();
        this.paramList = paramList;
        this.result = result;
    }
    getChecker(suite, strict) {
        return (value, ctx) => {
            return typeof value === "function" ? true : ctx.fail(null, "is not a function", 0);
        };
    }
}
exports.TFunc = TFunc;
/**
 * Defines a function parameter.
 */
function param(name, typeSpec, isOpt) {
    return new TParam(name, parseSpec(typeSpec), Boolean(isOpt));
}
exports.param = param;
class TParam {
    constructor(name, ttype, isOpt) {
        this.name = name;
        this.ttype = ttype;
        this.isOpt = isOpt;
    }
}
exports.TParam = TParam;
/**
 * Defines a function parameter list.
 */
class TParamList extends TType {
    constructor(params) {
        super();
        this.params = params;
    }
    getChecker(suite, strict) {
        const itemCheckers = this.params.map((t) => t.ttype.getChecker(suite, strict));
        const testCtx = new util_1.NoopContext();
        const isParamRequired = this.params.map((param, i) => !param.isOpt && !itemCheckers[i](undefined, testCtx));
        const checker = (value, ctx) => {
            if (!Array.isArray(value)) {
                return ctx.fail(null, "is not an array", 0);
            }
            for (let i = 0; i < itemCheckers.length; i++) {
                const p = this.params[i];
                if (value[i] === undefined) {
                    if (isParamRequired[i]) {
                        return ctx.fail(p.name, "is missing", 1);
                    }
                }
                else {
                    const ok = itemCheckers[i](value[i], ctx);
                    if (!ok) {
                        return ctx.fail(p.name, null, 1);
                    }
                }
            }
            return true;
        };
        if (!strict) {
            return checker;
        }
        return (value, ctx) => {
            if (!checker(value, ctx)) {
                return false;
            }
            return value.length <= itemCheckers.length ? true :
                ctx.fail(itemCheckers.length, "is extraneous", 2);
        };
    }
}
exports.TParamList = TParamList;
/**
 * Single TType implementation for all basic built-in types.
 */
class BasicType extends TType {
    constructor(validator, message) {
        super();
        this.validator = validator;
        this.message = message;
    }
    getChecker(suite, strict) {
        return (value, ctx) => this.validator(value) ? true : ctx.fail(null, this.message, 0);
    }
}
exports.BasicType = BasicType;
/**
 * Defines the suite of basic types.
 */
exports.basicTypes = {
    any: new BasicType((v) => true, "is invalid"),
    number: new BasicType((v) => (typeof v === "number"), "is not a number"),
    object: new BasicType((v) => (typeof v === "object" && v), "is not an object"),
    boolean: new BasicType((v) => (typeof v === "boolean"), "is not a boolean"),
    string: new BasicType((v) => (typeof v === "string"), "is not a string"),
    symbol: new BasicType((v) => (typeof v === "symbol"), "is not a symbol"),
    void: new BasicType((v) => (v == null), "is not void"),
    undefined: new BasicType((v) => (v === undefined), "is not undefined"),
    null: new BasicType((v) => (v === null), "is not null"),
    never: new BasicType((v) => false, "is unexpected"),
};
if (typeof Buffer !== "undefined") {
    exports.basicTypes.Buffer = new BasicType((v) => Buffer.isBuffer(v), "is not a Buffer");
}
// Support typed arrays of various flavors
for (const array of [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array, ArrayBuffer]) {
    exports.basicTypes[array.name] = new BasicType((v) => (v instanceof array), `is not a ${array.name}`);
}
