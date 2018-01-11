import * as t from "../../lib/types";
// tslint:disable:object-literal-key-quotes

export const Greeter = t.iface([], {
  "greet": t.func("string", t.param("name", "string")),
});

const exportedTypeSuite: t.ITypeSuite = {
  Greeter,
};
export default exportedTypeSuite;
