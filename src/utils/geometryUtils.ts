export interface Point {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateAngle(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}
