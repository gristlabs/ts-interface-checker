interface Wheels {
  numWheels: number
}

interface Doors {
  numDoors: number
}

export type Car = Wheels & Doors

export type House = Doors & {
  numRooms: number
}
