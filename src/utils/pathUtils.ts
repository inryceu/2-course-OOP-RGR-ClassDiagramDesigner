import { Point, Rectangle } from './geometryUtils.js';
import { RelationType } from '../models/ClassDiagram.js';
import { getRelationshipTypeOffset } from './renderingUtils.js';

export interface PathSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function calculateOrthogonalPath(
  from: Rectangle,
  to: Rectangle,
  relType: RelationType,
  classPositions: Map<string, Rectangle>,
  usedPaths: PathSegment[]
): Point[] {
  const margin = 35;
  const points: Point[] = [];
  
  let lowerClass = from;
  let upperClass = to;
  
  if (from.y < to.y) {
    lowerClass = to;
    upperClass = from;
  }
  
  const typeOffset = getRelationshipTypeOffset(relType);
  const lowerCenterX = lowerClass.x + lowerClass.width / 2 + typeOffset;
  const upperCenterX = upperClass.x + upperClass.width / 2 + typeOffset;
  
  const startX = lowerCenterX;
  const startY = lowerClass.y;
  const endX = upperCenterX;
  const endY = upperClass.y + upperClass.height;
  
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  
  let bestMidY = startY + (endY - startY) / 2;
  
  const obstructingClasses = findObstructingClasses(
    minX - margin, 
    maxX + margin, 
    Math.min(startY, endY), 
    Math.max(startY, endY), 
    lowerClass, 
    upperClass,
    classPositions
  );
  
  if (obstructingClasses.length > 0) {
    bestMidY = findBestHorizontalY(
      startX, 
      endX, 
      startY, 
      endY, 
      lowerClass, 
      upperClass, 
      obstructingClasses,
      classPositions,
      usedPaths
    );
    bestMidY = bestMidY - 25 + typeOffset * 0.5;
  }
  
  const finalStartX = adjustVerticalLineX(startX, startY, bestMidY, lowerClass, classPositions);
  const finalEndX = adjustVerticalLineX(endX, bestMidY, endY, upperClass, classPositions);
  
  points.push({ x: finalStartX, y: startY });
  points.push({ x: finalStartX, y: bestMidY });
  points.push({ x: finalEndX, y: bestMidY });
  points.push({ x: finalEndX, y: endY });
  
  usedPaths.push(
    { x1: finalStartX, y1: startY, x2: finalStartX, y2: bestMidY },
    { x1: finalStartX, y1: bestMidY, x2: finalEndX, y2: bestMidY },
    { x1: finalEndX, y1: bestMidY, x2: finalEndX, y2: endY }
  );
  
  return points;
}

export function adjustVerticalLineX(
  x: number, 
  y1: number, 
  y2: number, 
  relatedClass: Rectangle,
  classPositions: Map<string, Rectangle>
): number {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const margin = 35;
  
  for (const pos of classPositions.values()) {
    if (pos === relatedClass) continue;
    
    const classMinY = pos.y;
    const classMaxY = pos.y + pos.height;
    
    if (!(maxY < classMinY || minY > classMaxY)) {
      if (Math.abs(x - pos.x) < margin && x < pos.x) {
        return pos.x - margin;
      }
      if (Math.abs(x - (pos.x + pos.width)) < margin && x > pos.x + pos.width) {
        return pos.x + pos.width + margin;
      }
    }
  }
  
  return x;
}

export function findBestHorizontalY(
  startX: number, 
  endX: number, 
  startY: number, 
  endY: number, 
  from: Rectangle, 
  to: Rectangle, 
  obstructing: Rectangle[],
  classPositions: Map<string, Rectangle>,
  usedPaths: PathSegment[]
): number {
  const minX = Math.min(startX, endX);
  const maxX = Math.max(startX, endX);
  const minY = Math.min(startY, endY);
  const maxY = Math.max(startY, endY);
  const margin = 40;
  
  const candidates: number[] = [];
  
  obstructing.forEach(cls => {
    candidates.push(cls.y - margin);
    candidates.push(cls.y - margin * 1.5);
    candidates.push(cls.y + cls.height + margin);
  });
  
  for (let i = 1; i <= 4; i++) {
    candidates.push(minY + ((maxY - minY) * i) / 5);
  }
  
  let bestY = minY + (maxY - minY) / 2;
  let minScore = Infinity;
  
  for (const candidateY of candidates) {
    if (candidateY <= minY + 15 || candidateY >= maxY - 15) continue;
    
    const score = calculatePathScore(
      candidateY,
      minX,
      maxX,
      minY,
      maxY,
      from,
      to,
      margin,
      classPositions,
      usedPaths
    );
    
    if (score < minScore) {
      minScore = score;
      bestY = candidateY;
      if (score === 0) break;
    }
  }
  
  return bestY;
}

function calculatePathScore(
  candidateY: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  from: Rectangle,
  to: Rectangle,
  margin: number,
  classPositions: Map<string, Rectangle>,
  usedPaths: PathSegment[]
): number {
  let score = 0;
  
  for (const pos of classPositions.values()) {
    if (pos === from || pos === to) continue;
    
    const horizontalOverlap = !(pos.x > maxX + margin || pos.x + pos.width < minX - margin);
    const verticalHit = candidateY >= pos.y - margin && candidateY <= pos.y + pos.height + margin;
    
    if (horizontalOverlap && verticalHit) {
      score += 1000;
    } else if (horizontalOverlap && Math.abs(candidateY - pos.y) < margin) {
      score += 50;
    } else if (horizontalOverlap && Math.abs(candidateY - (pos.y + pos.height)) < margin) {
      score += 50;
    }
  }
  
  for (const path of usedPaths) {
    if (Math.abs(path.y1 - candidateY) < 20 && path.y1 === path.y2) {
      const pathMinX = Math.min(path.x1, path.x2);
      const pathMaxX = Math.max(path.x1, path.x2);
      if (!(maxX < pathMinX || minX > pathMaxX)) {
        score += 30;
      }
    }
  }
  
  return score;
}

export function findObstructingClasses(
  minX: number, 
  maxX: number, 
  minY: number, 
  maxY: number, 
  from: Rectangle, 
  to: Rectangle,
  classPositions: Map<string, Rectangle>
): Rectangle[] {
  const obstructing: Rectangle[] = [];
  const margin = 15;
  
  classPositions.forEach((pos) => {
    if (pos === from || pos === to) return;
    
    const hasHorizontalOverlap = !(pos.x - margin > maxX || pos.x + pos.width + margin < minX);
    const hasVerticalOverlap = !(pos.y - margin > maxY || pos.y + pos.height + margin < minY);
    
    if (hasHorizontalOverlap && hasVerticalOverlap) {
      obstructing.push(pos);
    }
  });
  
  return obstructing;
}

export function findObstructionBetween(
  x1: number, 
  y1: number, 
  x2: number, 
  y2: number, 
  target: Rectangle,
  classPositions: Map<string, Rectangle>
): Rectangle | null {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const margin = 25;
  
  for (const [name, pos] of classPositions) {
    if (pos === target) continue;
    
    const horizontalOverlap = !(pos.x > maxX + margin || pos.x + pos.width < minX - margin);
    const verticalOverlap = !(pos.y > maxY || pos.y + pos.height < minY);
    
    if (horizontalOverlap && verticalOverlap) {
      return pos;
    }
  }
  
  return null;
}

