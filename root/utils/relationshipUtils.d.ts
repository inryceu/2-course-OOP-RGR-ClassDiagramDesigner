import { Relationship, RelationType } from '../models/ClassDiagram.js';
import { Rectangle } from './geometryUtils.js';
export interface RelationshipGroup {
    target: string;
    type: RelationType;
    relationships: Relationship[];
}
export declare function groupRelationships(relationships: Relationship[], classPositions: Map<string, Rectangle>): RelationshipGroup[];
export declare function getConnectionsForClass(className: string, relationships: Relationship[], direction: 'parent' | 'child' | 'all'): string[];
export declare function countConnectionsForClass(className: string, relationships: Relationship[]): number;
export declare function countCrossings(items: {
    name: string;
}[], idx1: number, idx2: number, relationships: Relationship[], classPositions: Map<string, Rectangle>): number;
export declare function optimizeClassOrdering(hierarchy: {
    name: string;
}[][], relationships: Relationship[]): void;
export declare function calculateOptimizedXPosition(className: string, defaultX: number, classWidth: number, relationships: Relationship[], classPositions: Map<string, Rectangle>, pullStrength?: number): number;
//# sourceMappingURL=relationshipUtils.d.ts.map