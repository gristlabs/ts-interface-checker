/**
 * This module provides a concise way to define types of objects and interfaces, to be available
 * at runtime, from which we build validation functions.
 */
// tslint:disable:max-classes-per-file

// TODO: Return values of methods for APIs would normally be Promises. We need to either mark them
// explicitly when defining an interface, or (as seems better) generate promises by default when
// generating Typescript. Validations would run on resolved values, so don't matter.
// TODO: For RPC, we'd need to add a type alias `nowait` = `void`, which would NOT be turned into
// a promise, so that RPC can treat it as a void method. (That's a poor name, maybe just call it
// "nowait" method.)

/**
 * A suite is parsed into a tree consisting of the following nodes that represent the types.
 */
export abstract class TNode {
  public parent: TNode;
}
export abstract class TType extends TNode {
}
export class TName extends TType {
  constructor(public name: string) { super(); }
}
export class TLiteral extends TType {
  constructor(public value: any) { super(); }
}
export class TIface extends TType {
  constructor(public bases: string[], public props: TProp[]) { super(); }
}
export class TProp extends TNode {
  constructor(public name: string, public ttype: TType, public isOpt: boolean = false) { super(); }
}
export class TFunc extends TType {
  constructor(public args: TArg[], public result: TType) { super(); }
}
export class TArg extends TNode {
  constructor(public name: string, public ttype: TType, public isOpt: boolean, public defl?: any) {
    super();
  }
}
export class TTuple extends TType {
  constructor(public ttypes: TType[]) { super(); }
}
export class TArray extends TType {
  constructor(public ttype: TType) { super(); }
}
export class TUnion extends TType {
  constructor(public ttypes: TType[]) { super(); }
}


/**
 * Defines a type name, either built-in, or defined in this suite.
 */
export function name(value: string): TName {
  return new TName(value);
}

/**
 * Defines a literal value, e.g. lit('hello') or lit(123).
 */
export function lit(value: any): TLiteral {
  return new TLiteral(value);
}

/**
 * Defines an array type, e.g. array('number').
 */
export function array(typeSpec: any): TArray {
  const ttype = parseSpec(typeSpec);
  return _setAsParent(new TArray(ttype), ttype);
}

/**
 * Defines a tuple type, e.g. tuple('string', 'number').
 */
export function tuple(...typeSpec: any[]): TTuple {
  const ttypes = typeSpec.map(t => parseSpec(t));
  return _setAsParent(new TTuple(ttypes), ...ttypes);
}

/**
 * Defines a union type, e.g. union('number', 'null').
 */
export function union(...typeSpec: any[]): TUnion {
  const ttypes = typeSpec.map(t => parseSpec(t));
  return _setAsParent(new TUnion(ttypes), ...ttypes);
}






export interface Suite {
  [name: string]: TType;
}

/**
 * suite() declares a set of types. Note that a suite should include all types referenced inside
 * it. E.g. if the suite lists an interface 'Foo' which refers to type 'Bar', then type 'Bar'
 * should also be included in the suite.
 */
export function suite(props: {[name: string]: any}): Suite {
  const ret: Suite = {};
  for (const name in props) {
    ret[name] = parseSpec(props[name]);
  }
  return ret;
}

/**
 * Defines an interface that extends one or more other interfaces, passed in as an array in the
 * first argument. If there is nothing to extend, an interface is specified with just an object.
 */
export function iface(bases: string[], props: {[key: string]: any}): TIface {
  return _iface(bases, props);
}

/**
 * Defines a function. The arguments declare the function's parameters, as {argName: argType}
 * (e.g. {price: 'number'}). The last argument declares the function's return value, and must be
 * in the form {'=>': returnType}, i.e. the key must be the literal string '=>'.
 */
export function func(argSpecObjs: Array<{[name: string]: any}>, resultSpec: any): TFunc {
  // const argSpecs = argSpecObjs.map(obj => argSpecParse(obj));
  const result = parseSpec(resultSpec);
  const args: TArg[] = []; // argSpecs.map(a => _funcArg(a));
  return _setAsParent(new TFunc(args, result), result, ...args);
}

// Parses a type spec (programmer-friendly object) into a tree node.
function parseSpec(typeSpec: any): TType {
  if (typeSpec instanceof TNode) {
    return typeSpec;
  }
  if (typeof typeSpec === 'string') {
    return new TName(typeSpec);
  }
  if (typeSpec && typeof typeSpec === 'object' && typeSpec.constructor === Object) {
    return _iface([], typeSpec);
  }
  throw new Error(`Invalid type spec: ${typeSpec}`);
}

// Function args, for conciseness, are specified as `{argName: argType}`. We convert them to
// ArgSpecs during internal processing.
/*
interface ArgSpec {
  name: string;
  value: any;
  isOpt: boolean;
  defl: any;
}
*/

// Parses arg specs of the form {argName: argType}, e.g. {price: 'number'}.
/*
function argSpecParse(obj): ArgSpec {
  if (!obj || typeof obj !== 'object') {
    throw new Error(`func arg spec not an object: ${obj}`);
  }
  const defl = obj._defl;
  let count = 0;
  let name: string|null = null;
  for (const k in obj) {
    if (k !== '_defl') { name = k; count++; }
  }
  if (!name || count !== 1) {
    throw new Error(`func args spec should have a single prop: ${obj}`);
  }
  const isOpt = obj.hasOwnProperty('_defl') || name.endsWith('?');
  return {name: trimRight(name, '?'), value: obj[name], isOpt, defl};
}
*/

function trimRight(str: string, suffix: string): string {
  return str.endsWith(suffix) ? str.slice(0, -suffix.length) : str;
}

// Helper for function arguments.
/*
function _funcArg(obj: ArgSpec) {
  const ttype = parseSpec(obj.value);
  return _setAsParent(new TArg(obj.name, ttype, obj.isOpt, obj.defl), ttype);
}
*/

// Helper for interfaces.
function _iface(bases: string[], props: {[key: string]: any}): TIface {
  const tprops: TProp[] = [];
  for (const key in props) {
    const isOpt = key.endsWith('?');
    tprops.push(new TProp(trimRight(key, '?'), parseSpec(props[key]), isOpt));
  }
  return _setAsParent(new TIface(bases, tprops), ...tprops.map(p => p.ttype));
}

// Helper that returns the given node after setting it as the parent to all the given children.
function _setAsParent<T extends TNode>(node: T, ...children: TNode[]): T {
  children.forEach(c => { c.parent = node; });
  return node;
}

/**
 * Processors for TNodes can extend TNodeProcessor and implement all declared methods to process
 * all types of TNodes. This allows TypeScript to verify that you haven't forgotten anything, and
 * you get the `dispatch(tnode)` method which will call one of your `_proc*` methods.
 */
export abstract class TNodeProcessor<T> {
  protected dispatch(t: TNode, arg?: any): T {
    const method = (this as any)['_proc' + t.constructor.name];
    if (typeof method !== 'function') {
      throw new Error(`Unknown TNode ${t}`);
    }
    return method.call(this, t, arg);
  }
  protected abstract _procTArg(t: TArg): T;
  protected abstract _procTArray(t: TArray): T;
  protected abstract _procTFunc(t: TFunc): T;
  protected abstract _procTIface(t: TIface): T;
  protected abstract _procTLiteral(t: TLiteral): T;
  protected abstract _procTName(t: TName): T;
  protected abstract _procTProp(t: TProp): T;
  protected abstract _procTTuple(t: TTuple): T;
  protected abstract _procTUnion(t: TUnion): T;
}
