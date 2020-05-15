export interface Wheels {
  numWheels: number
}

export interface Doors {
  numDoors: number
}

export type Car = Wheels & Doors

export type House = Doors & {numRooms: number} & object;

export type MixedLiteral = ( 1 | 2 ) & ( 2 | 3 )

export type SameKeyTypeA = {
  x: {
    foo: string
  }
}

export type SameKeyTypeB = {
  x: {
    bar: number
    optional?: number
  }
}

export type SameKeyIntersection = SameKeyTypeA & SameKeyTypeB

export type Tuples = [string, string|null] & string[];
