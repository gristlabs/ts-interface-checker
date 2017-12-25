// This is a simplified version of the TypeScript declarations produced by protobufjs from its
// benchmark file (https://github.com/dcodeIO/protobuf.js/blob/master/bench/data/bench.proto).

interface ITest {
  string?: (string|null);
  uint32?: (number|null);
  inner?: (IInner|null);
  float?: (number|null);
}

interface IInner {
  int32?: (number|null);
  innerInner?: (IInnerInner|null);
  outer?: (IOuter|null);
}

interface IInnerInner {
  long?: (number|Long|null);
  "enum"?: (Enum|null);
  sint32?: (number|null);
}

// We do not yet support enums, but can emulate with a union.
// enum Enum {
//   ONE = 0,
//   TWO = 1,
//   THREE = 2,
//   FOUR = 3,
//   FIVE = 4,
// }
type Enum = 0 | 1 | 2 | 3 | 4;

export interface IOuter {
  bool?: (boolean[]|null);
  double?: (number|null);
}

export interface Long {
  low: number;
  high: number;
  unsigned: boolean;
}
