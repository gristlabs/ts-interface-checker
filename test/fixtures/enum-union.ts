export enum ShapeKind { Square, Rectangle, Circle };

export interface Shape {
  kind: ShapeKind;
}

export interface Square extends Shape {
  kind: ShapeKind.Square;
  size: number;
}

export interface Rectangle extends Shape {
  kind: ShapeKind.Rectangle;
  width: number;
  height: number;
}

export interface Circle extends Shape {
  kind: ShapeKind.Circle;
  radius: number;
}
