import { Relationship, RelationType } from '../models/ClassDiagram.js';
import { Rectangle } from './geometryUtils.js';
import { areClassesOnSameLevel } from './layoutUtils.js';

export interface RelationshipGroup {
  target: string;
  type: RelationType;
  relationships: Relationship[];
}

export function groupRelationships(
  relationships: Relationship[],
  classPositions: Map<string, Rectangle>
): RelationshipGroup[] {
  const targetGroups = new Map<string, Relationship[]>();
  
  relationships.forEach(rel => {
    const key = `to:${rel.to}-${rel.type}`;
    if (!targetGroups.has(key)) {
      targetGroups.set(key, []);
    }
    targetGroups.get(key)!.push(rel);
  });
  
  const result: RelationshipGroup[] = [];
  targetGroups.forEach((rels, key) => {
    if (rels.length > 1) {
      const allFromSameLevel = areClassesOnSameLevel(classPositions, rels.map(r => r.from));
      if (allFromSameLevel) {
        result.push({
          target: rels[0].to,
          type: rels[0].type,
          relationships: rels
        });
      }
    }
  });
  
  return result;
}

export function getConnectionsForClass(
  className: string,
  relationships: Relationship[],
  direction: 'parent' | 'child' | 'all'
): string[] {
  if (direction === 'parent') {
    return relationships
      .filter(rel => rel.from === className)
      .map(rel => rel.to);
  }
  
  if (direction === 'child') {
    return relationships
      .filter(rel => rel.to === className)
      .map(rel => rel.from);
  }
  
  return relationships
    .filter(rel => rel.from === className || rel.to === className)
    .map(rel => rel.from === className ? rel.to : rel.from);
}

export function countConnectionsForClass(
  className: string,
  relationships: Relationship[]
): number {
  return relationships.filter(rel => 
    rel.from === className || rel.to === className
  ).length;
}

export function countCrossings(
  items: { name: string }[],
  idx1: number,
  idx2: number,
  relationships: Relationship[],
  classPositions: Map<string, Rectangle>
): number {
  let crossings = 0;
  const class1 = items[idx1].name;
  const class2 = items[idx2].name;
  
  const connections1 = relationships.filter(rel => 
    rel.from === class1 || rel.to === class1
  );
  const connections2 = relationships.filter(rel => 
    rel.from === class2 || rel.to === class2
  );
  
  connections1.forEach(conn1 => {
    const target1Pos = classPositions.get(conn1.from === class1 ? conn1.to : conn1.from);
    if (!target1Pos) return;
    
    connections2.forEach(conn2 => {
      const target2Pos = classPositions.get(conn2.from === class2 ? conn2.to : conn2.from);
      if (!target2Pos) return;
      
      const x1 = idx1;
      const x2 = idx2;
      const y1 = target1Pos.x;
      const y2 = target2Pos.x;
      
      if ((x1 < x2 && y1 > y2) || (x1 > x2 && y1 < y2)) {
        crossings++;
      }
    });
  });
  
  return crossings;
}

export function optimizeClassOrdering(
  hierarchy: { name: string }[][],
  relationships: Relationship[]
): void {
  for (let levelIdx = 1; levelIdx < hierarchy.length; levelIdx++) {
    const level = hierarchy[levelIdx];
    const parentLevel = hierarchy[levelIdx - 1];
    
    const parentMap = new Map<string, number>();
    parentLevel.forEach((cls, idx) => parentMap.set(cls.name, idx));
    
    level.sort((a, b) => {
      const aParents = relationships
        .filter(rel => rel.from === a.name && parentMap.has(rel.to))
        .map(rel => parentMap.get(rel.to)!);
      const bParents = relationships
        .filter(rel => rel.from === b.name && parentMap.has(rel.to))
        .map(rel => parentMap.get(rel.to)!);
      
      if (aParents.length === 0 && bParents.length === 0) return 0;
      if (aParents.length === 0) return 1;
      if (bParents.length === 0) return -1;
      
      const aAvg = aParents.reduce((sum, idx) => sum + idx, 0) / aParents.length;
      const bAvg = bParents.reduce((sum, idx) => sum + idx, 0) / bParents.length;
      
      return aAvg - bAvg;
    });
  }
}

export function calculateOptimizedXPosition(
  className: string,
  defaultX: number,
  classWidth: number,
  relationships: Relationship[],
  classPositions: Map<string, Rectangle>,
  pullStrength: number = 0.45
): number {
  const parentPositions: number[] = [];
  
  relationships.forEach(rel => {
    if (rel.from === className) {
      const parentPos = classPositions.get(rel.to);
      if (parentPos) {
        parentPositions.push(parentPos.x + parentPos.width / 2);
      }
    }
  });
  
  if (parentPositions.length > 0) {
    const avgParentX = parentPositions.reduce((sum, x) => sum + x, 0) / parentPositions.length;
    const targetX = avgParentX - classWidth / 2;
    
    return defaultX + (targetX - defaultX) * pullStrength;
  }
  
  return defaultX;
}
