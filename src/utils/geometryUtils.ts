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

export function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

export function calculateAngle(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function doRectanglesOverlap(r1: Rectangle, r2: Rectangle, margin: number = 0): boolean {
  return !(r1.x + r1.width + margin < r2.x ||
           r1.x > r2.x + r2.width + margin ||
           r1.y + r1.height + margin < r2.y ||
           r1.y > r2.y + r2.height + margin);
}

export function getRectangleCenter(rect: Rectangle): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
}

export function isPointInRectangle(point: Point, rect: Rectangle, margin: number = 0): boolean {
  return point.x >= rect.x - margin &&
         point.x <= rect.x + rect.width + margin &&
         point.y >= rect.y - margin &&
         point.y <= rect.y + rect.height + margin;
}

export function getBoundingBox(rectangles: Rectangle[]): Rectangle {
  if (rectangles.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  
  const minX = Math.min(...rectangles.map(r => r.x));
  const minY = Math.min(...rectangles.map(r => r.y));
  const maxX = Math.max(...rectangles.map(r => r.x + r.width));
  const maxY = Math.max(...rectangles.map(r => r.y + r.height));
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export function expandRectangle(rect: Rectangle, margin: number): Rectangle {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2
  };
}

