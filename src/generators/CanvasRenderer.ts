import { ClassDiagram, ClassInfo, Relationship, RelationType } from '../models/ClassDiagram.js';
import { Rectangle } from '../utils/geometryUtils.js';
import { 
  resolveOverlaps, 
  calculateConnectionDensity, 
  centerElementsHorizontally,
  minimizeCrossings,
  buildClassHierarchy,
} from '../utils/layoutUtils.js';
import { 
  drawArrowByType, 
  drawLabel, 
  findBestLabelPosition,
  drawStartPoint,
  getRelationshipLabel,
  RenderConfig as BaseRenderConfig
} from '../utils/renderingUtils.js';
import {
  drawClassBox,
  drawClassHeader,
  drawFields,
  drawMethods,
  calculateClassHeight,
  setupCanvas,
  DrawConfig
} from '../utils/canvasDrawingUtils.js';
import {
  calculateOrthogonalPath,
  findObstructionBetween,
  PathSegment
} from '../utils/pathUtils.js';
import {
  groupRelationships,
  getConnectionsForClass,
  countConnectionsForClass,
  countCrossings,
  optimizeClassOrdering,
  calculateOptimizedXPosition
} from '../utils/relationshipUtils.js';

interface ClassPosition extends Rectangle {}

interface RenderConfig extends BaseRenderConfig, DrawConfig {
  classWidth: number;
  minClassHeight: number;
  classBoxColor: string;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;
  private classPositions: Map<string, ClassPosition>;
  private labelPositions: Array<Rectangle>;
  private usedPaths: PathSegment[];
  private currentRelationships: Relationship[] = [];

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = canvasElement;
    const context = this.canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Failed to get 2D canvas context');
    }
    
    this.ctx = context;
    this.classPositions = new Map();
    this.labelPositions = [];
    this.usedPaths = [];
    
    this.config = {
      classWidth: 260,
      minClassHeight: 85,
      lineHeight: 17, 
      padding: 7,
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      headerHeight: 36, 
      sectionPadding: 5, 
      
      backgroundColor: '#f8f9ff',
      classBoxColor: '#ffffff',
      classBorderColor: '#667eea',
      textColor: '#333333',
      headerColor: '#667eea',
      interfaceColor: '#4CAF50',
      abstractColor: '#FF9800',
      
      lineColor: '#667eea',
      lineWidth: 2.2,
      arrowSize: 11
    };
  }

  render(diagram: ClassDiagram): void {
    const classes = diagram.getClasses();
    const relationships = diagram.getRelationships();
    
    this.currentRelationships = relationships;
    this.labelPositions = [];
    this.usedPaths = [];
    
    this.calculatePositions(classes);
    setupCanvas(this.canvas, this.ctx, this.classPositions, this.config.fontSize, this.config.fontFamily);
    this.clearCanvas();
    this.drawRelationships(relationships);
    
    classes.forEach(classInfo => {
      this.drawClass(classInfo);
    });
  }

  private calculatePositions(classes: ClassInfo[]): void {
    this.classPositions.clear();
    
    if (classes.length === 0) return;
    
    let hierarchy = buildClassHierarchy(classes, this.currentRelationships);
    
    const horizontalGap = 110;
    const baseVerticalGap = 100;
    const margin = 80;
    
    const orderedHierarchy = hierarchy.map(level => 
      this.sortLevelByConnections(level)
    );
    
    optimizeClassOrdering(orderedHierarchy, this.currentRelationships);
    
    const maxClassesInLevel = Math.max(...orderedHierarchy.map(level => level.length));
    const maxLevelWidth = maxClassesInLevel * this.config.classWidth + (maxClassesInLevel - 1) * horizontalGap;
    
    let currentY = margin;
    
    orderedHierarchy.forEach((level, levelIndex) => {
      let maxHeight = 0;
      level.forEach(classInfo => {
        const height = calculateClassHeight(
          classInfo,
          this.config.headerHeight,
          this.config.lineHeight,
          this.config.sectionPadding,
          this.config.padding,
          this.config.minClassHeight
        );
        maxHeight = Math.max(maxHeight, height);
      });
      
      const levelWidth = level.length * this.config.classWidth + (level.length - 1) * horizontalGap;
      let startX = margin + (maxLevelWidth - levelWidth) / 2;
      
      level.forEach((classInfo, index) => {
        const height = calculateClassHeight(
          classInfo, 
          this.config.headerHeight,
          this.config.lineHeight,
          this.config.sectionPadding,
          this.config.padding,
          this.config.minClassHeight
        );
        
        const baseX = startX + index * (this.config.classWidth + horizontalGap);
        const optimizedX = levelIndex === 0 ? baseX : calculateOptimizedXPosition(
          classInfo.name,
          baseX,
          this.config.classWidth,
          this.currentRelationships,
          this.classPositions
        );
        
        this.classPositions.set(classInfo.name, {
          x: optimizedX,
          y: currentY,
          width: this.config.classWidth,
          height
        });
      });
      
      resolveOverlaps(this.classPositions, level.map(c => c.name), horizontalGap);
      
      const connectionDensity = calculateConnectionDensity(level.map(c => c.name), this.currentRelationships);
      const adaptiveGap = baseVerticalGap + Math.min(connectionDensity * 10, 40);
      
      currentY += maxHeight + adaptiveGap;
    });
    
    orderedHierarchy.forEach(level => {
      centerElementsHorizontally(this.classPositions, level.map(c => c.name), maxLevelWidth, margin);
    });
  }

  private sortLevelByConnections(level: ClassInfo[]): ClassInfo[] {
    if (level.length <= 1) return level;
    
    const sorted = [...level].sort((a, b) => {
      const aParents = getConnectionsForClass(a.name, this.currentRelationships, 'parent');
      const bParents = getConnectionsForClass(b.name, this.currentRelationships, 'parent');
      
      const aChildren = getConnectionsForClass(a.name, this.currentRelationships, 'child');
      const bChildren = getConnectionsForClass(b.name, this.currentRelationships, 'child');
      
      const aTotal = countConnectionsForClass(a.name, this.currentRelationships);
      const bTotal = countConnectionsForClass(b.name, this.currentRelationships);
      
      if (aParents.length !== bParents.length) {
        return bParents.length - aParents.length;
      }
      
      if (aChildren.length !== bChildren.length) {
        return bChildren.length - aChildren.length;
      }
      
      if (aTotal !== bTotal) {
        return bTotal - aTotal;
      }
      
      if (a.isInterface !== b.isInterface) return a.isInterface ? -1 : 1;
      if (a.isAbstract !== b.isAbstract) return a.isAbstract ? -1 : 1;
      
      return a.name.localeCompare(b.name);
    });
    
    return minimizeCrossings(sorted, (items, i, j) => 
      countCrossings(items, i, j, this.currentRelationships, this.classPositions)
    );
  }

  private clearCanvas(): void {
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawClass(classInfo: ClassInfo): void {
    const pos = this.classPositions.get(classInfo.name);
    if (!pos) return;
    
    const { x, y, width, height } = pos;
    
    drawClassBox(this.ctx, x, y, width, height, this.config.classBoxColor, this.config.classBorderColor);
    drawClassHeader(this.ctx, classInfo, x, y, width, this.config);
    
    let currentY = y + this.config.headerHeight;
    currentY = drawFields(this.ctx, classInfo.fields, x, currentY, width, this.config);
    
    drawMethods(this.ctx, classInfo.methods, x, currentY, width, this.config);
  }

  private drawRelationships(relationships: Relationship[]): void {
    const grouped = groupRelationships(relationships, this.classPositions);
    const drawn = new Set<string>();
    
    grouped.forEach(group => {
      if (group.relationships.length > 1) {
        this.drawGroupedConnections(group);
        group.relationships.forEach(rel => {
          drawn.add(`${rel.from}-${rel.to}-${rel.type}`);
        });
      }
    });
    
    relationships.forEach(rel => {
      const key = `${rel.from}-${rel.to}-${rel.type}`;
      if (!drawn.has(key)) {
        const fromPos = this.classPositions.get(rel.from);
        const toPos = this.classPositions.get(rel.to);
        
        if (!fromPos || !toPos) {
          return;
        }
        
        this.drawConnection(fromPos, toPos, rel);
      }
    });
  }

  private drawGroupedConnections(group: {target: string, type: RelationType, relationships: Relationship[]}): void {
    const targetPos = this.classPositions.get(group.target);
    if (!targetPos) return;
    
    const sources = group.relationships
      .map(rel => ({rel, pos: this.classPositions.get(rel.from)}))
      .filter(item => item.pos !== undefined) as Array<{rel: Relationship, pos: ClassPosition}>;
    
    if (sources.length < 2) return;
    
    sources.sort((a, b) => a.pos.x - b.pos.x);
    
    const targetCenterX = targetPos.x + targetPos.width / 2;
    const targetY = targetPos.y + targetPos.height;
    
    const sourceXs = sources.map(s => s.pos.x + s.pos.width / 2);
    const leftMostX = Math.min(...sourceXs);
    const rightMostX = Math.max(...sourceXs);
    const mergeX = (leftMostX + rightMostX) / 2;
    
    const sourceYs = sources.map(s => s.pos.y);
    const maxSourceY = Math.max(...sourceYs);
    const verticalGap = 20;
    const mergeY = maxSourceY - verticalGap;
    
    this.ctx.save();
    this.ctx.strokeStyle = this.config.lineColor;
    this.ctx.lineWidth = this.config.lineWidth;
    
    if (group.type === RelationType.IMPLEMENTATION || group.type === RelationType.DEPENDENCY) {
      this.ctx.setLineDash([5, 5]);
    } else {
      this.ctx.setLineDash([]);
    }
    
    sources.forEach(source => {
      const startX = source.pos.x + source.pos.width / 2;
      const startY = source.pos.y;
      
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(startX, mergeY);
      this.ctx.stroke();
      
      drawStartPoint(this.ctx, startX, startY, this.config.lineColor);
    });
    
    this.ctx.beginPath();
    this.ctx.moveTo(leftMostX, mergeY);
    this.ctx.lineTo(rightMostX, mergeY);
    this.ctx.stroke();
    
    const obstruction = findObstructionBetween(mergeX, mergeY, targetCenterX, targetY, targetPos, this.classPositions);
    let midY: number;
    
    if (obstruction) {
      midY = obstruction.y - 35;
    } else {
      midY = mergeY + (targetY - mergeY) * 0.5;
    }
    
    this.ctx.beginPath();
    this.ctx.moveTo(mergeX, mergeY);
    
    if (Math.abs(mergeX - targetCenterX) > 5) {
      this.ctx.lineTo(mergeX, midY);
      this.ctx.lineTo(targetCenterX, midY);
      this.ctx.lineTo(targetCenterX, targetY);
    } else {
      this.ctx.lineTo(mergeX, targetY);
    }
    
    this.ctx.stroke();
    this.ctx.restore();
    
    const arrowStartY = Math.abs(mergeX - targetCenterX) > 5 ? midY : mergeY + 10;
    drawArrowByType(
      this.ctx,
      {x: targetCenterX, y: arrowStartY}, 
      {x: targetCenterX, y: targetY}, 
      group.type,
      this.config
    );
    
    const displayLabel = getRelationshipLabel(group.type);
    const labelX = Math.abs(mergeX - targetCenterX) > 5 ? (mergeX + targetCenterX) / 2 : targetCenterX + 15;
    const labelY = Math.abs(mergeX - targetCenterX) > 5 ? midY : (mergeY + targetY) / 2;
    const labelPos = findBestLabelPosition(labelX, labelY, this.labelPositions, Array.from(this.classPositions.values()));
    this.drawLabelWithCheck(labelPos.x, labelPos.y, `«${displayLabel}»`);
  }

  private drawConnection(from: ClassPosition, to: ClassPosition, rel: Relationship): void {
    const { type } = rel;
    
    const points = calculateOrthogonalPath(from, to, type, this.classPositions, this.usedPaths);
    
    this.ctx.save();
    this.ctx.strokeStyle = this.config.lineColor;
    this.ctx.lineWidth = this.config.lineWidth;
    
    if (type === RelationType.IMPLEMENTATION || type === RelationType.DEPENDENCY) {
      this.ctx.setLineDash([5, 5]);
    } else {
      this.ctx.setLineDash([]);
    }
    
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    
    this.ctx.stroke();
    this.ctx.restore();
    
    const lastPoint = points[points.length - 1];
    const prevPoint = points[points.length - 2];
    drawArrowByType(this.ctx, prevPoint, lastPoint, type, this.config);
    
    drawStartPoint(this.ctx, points[0].x, points[0].y, this.config.lineColor);
    
    const midIndex = Math.floor(points.length / 2);
    const midPoint = points[midIndex];
    
    const displayLabel = getRelationshipLabel(type);
    const labelPos = findBestLabelPosition(midPoint.x, midPoint.y, this.labelPositions, Array.from(this.classPositions.values()));
    this.drawLabelWithCheck(labelPos.x, labelPos.y, `«${displayLabel}»`);
  }

  private drawLabelWithCheck(x: number, y: number, text: string): void {
    this.ctx.font = `${this.config.fontSize - 2}px ${this.config.fontFamily}`;
    const textWidth = this.ctx.measureText(text).width;
    const padding = 5;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = 18;

    this.labelPositions.push({
      x: x - boxWidth / 2,
      y: y - boxHeight / 2,
      width: boxWidth,
      height: boxHeight
    });

    drawLabel(this.ctx, x, y, text, this.config);
  }

  exportToPNG(): Blob | null {
    return new Promise<Blob | null>((resolve) => {
      this.canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    }) as any;
  }

  exportToSVG(): string {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', this.canvas.width.toString());
    svg.setAttribute('height', this.canvas.height.toString());
    
    const image = document.createElementNS(svgNS, 'image');
    image.setAttribute('width', this.canvas.width.toString());
    image.setAttribute('height', this.canvas.height.toString());
    image.setAttribute('href', this.canvas.toDataURL('image/png'));
    
    svg.appendChild(image);
    
    return new XMLSerializer().serializeToString(svg);
  }
}
