import { ClassInfo, Relationship } from '../models/ClassDiagram.js';
import { Rectangle } from './geometryUtils.js';
export declare function resolveOverlaps(positions: Map<string, Rectangle>, classNames: string[], minGap: number, maxIterations?: number): void;
export declare function calculateConnectionDensity(classNames: string[], relationships: Relationship[]): number;
export declare function areClassesOnSameLevel(positions: Map<string, Rectangle>, classNames: string[], threshold?: number): boolean;
export declare function centerElementsHorizontally(positions: Map<string, Rectangle>, classNames: string[], targetWidth: number, offsetX?: number): void;
export declare function minimizeCrossings<T extends {
    name: string;
}>(items: T[], getCrossings: (items: T[], i: number, j: number) => number, maxIterations?: number): T[];
export declare function buildClassHierarchy(classes: ClassInfo[], relationships: Relationship[]): ClassInfo[][];
//# sourceMappingURL=layoutUtils.d.ts.map