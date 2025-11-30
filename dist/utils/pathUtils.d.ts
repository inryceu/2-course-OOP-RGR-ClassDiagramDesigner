import { Point, Rectangle } from './geometryUtils.js';
import { RelationType } from '../models/ClassDiagram.js';
export interface PathSegment {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}
export declare function calculateOrthogonalPath(from: Rectangle, to: Rectangle, relType: RelationType, classPositions: Map<string, Rectangle>, usedPaths: PathSegment[]): Point[];
export declare function adjustVerticalLineX(x: number, y1: number, y2: number, relatedClass: Rectangle, classPositions: Map<string, Rectangle>): number;
export declare function findBestHorizontalY(startX: number, endX: number, startY: number, endY: number, from: Rectangle, to: Rectangle, obstructing: Rectangle[], classPositions: Map<string, Rectangle>, usedPaths: PathSegment[]): number;
export declare function findObstructingClasses(minX: number, maxX: number, minY: number, maxY: number, from: Rectangle, to: Rectangle, classPositions: Map<string, Rectangle>): Rectangle[];
export declare function findObstructionBetween(x1: number, y1: number, x2: number, y2: number, target: Rectangle, classPositions: Map<string, Rectangle>): Rectangle | null;
//# sourceMappingURL=pathUtils.d.ts.map