import { ClassDiagram, ClassInfo, Relationship, RelationType } from '../models/ClassDiagram.js';

interface ClassPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RenderConfig {
  classWidth: number;
  minClassHeight: number;
  lineHeight: number;
  padding: number;
  fontSize: number;
  fontFamily: string;
  headerHeight: number;
  sectionPadding: number;
  
  backgroundColor: string;
  classBoxColor: string;
  classBorderColor: string;
  textColor: string;
  headerColor: string;
  interfaceColor: string;
  abstractColor: string;
  
  lineColor: string;
  lineWidth: number;
  arrowSize: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;
  private classPositions: Map<string, ClassPosition>;

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = canvasElement;
    const context = this.canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Не вдалося отримати 2D контекст canvas');
    }
    
    this.ctx = context;
    this.classPositions = new Map();
    
    this.config = {
      classWidth: 320,
      minClassHeight: 120,
      lineHeight: 22, 
      padding: 12,
      fontSize: 14,
      fontFamily: 'Arial, sans-serif',
      headerHeight: 45, 
      sectionPadding: 8, 
      
      backgroundColor: '#f8f9ff',
      classBoxColor: '#ffffff',
      classBorderColor: '#667eea',
      textColor: '#333333',
      headerColor: '#667eea',
      interfaceColor: '#4CAF50',
      abstractColor: '#FF9800',
      
      lineColor: '#667eea',
      lineWidth: 2,
      arrowSize: 10
    };
  }

  render(diagram: ClassDiagram): void {
    const classes = diagram.getClasses();
    const relationships = diagram.getRelationships();
    
    this.currentRelationships = relationships;
    
    this.calculatePositions(classes);
    
    this.setupCanvas();
    
    this.clearCanvas();
    
    this.drawRelationships(relationships);
    
    classes.forEach(classInfo => {
      this.drawClass(classInfo);
    });
    
    console.log('Ієрархія класів:');
    const hierarchy = this.buildHierarchy(classes);
    hierarchy.forEach((level, index) => {
      console.log(`  Рівень ${index}: ${level.map(c => c.name).join(', ')}`);
    });
  }

  private calculatePositions(classes: ClassInfo[]): void {
    this.classPositions.clear();
    
    if (classes.length === 0) return;
    
    const hierarchy = this.buildHierarchy(classes);
    
    console.log('Побудована ієрархія:');
    hierarchy.forEach((level, i) => {
      console.log(`  Рівень ${i}: ${level.map(c => c.name).join(', ')}`);
    });

    const maxClassesInLevel = Math.max(...hierarchy.map(level => level.length));
    
    const horizontalGap = 120;
    const verticalGap = 120;
    const margin = 40;
    
    const maxLevelWidth = maxClassesInLevel * this.config.classWidth + (maxClassesInLevel - 1) * horizontalGap;
    
    let currentY = margin;
    
    hierarchy.forEach((level) => {
      let maxHeight = 0;
      level.forEach(classInfo => {
        const height = this.calculateClassHeight(classInfo);
        maxHeight = Math.max(maxHeight, height);
      });
      
      const levelWidth = level.length * this.config.classWidth + (level.length - 1) * horizontalGap;
      
      let currentX = margin + (maxLevelWidth - levelWidth) / 2;
      
      level.forEach((classInfo) => {
        const height = this.calculateClassHeight(classInfo);
        
        this.classPositions.set(classInfo.name, {
          x: currentX,
          y: currentY,
          width: this.config.classWidth,
          height
        });
        
        console.log(`  Позиція ${classInfo.name}: x=${currentX}, y=${currentY}`);
        
        currentX += this.config.classWidth + horizontalGap;
      });
      
      currentY += maxHeight + verticalGap;
    });
  }
  
  private buildHierarchy(classes: ClassInfo[]): ClassInfo[][] {
    const hierarchy: ClassInfo[][] = [];
    const processed = new Set<string>();
    const classMap = new Map<string, ClassInfo>();
    
    classes.forEach(cls => classMap.set(cls.name, cls));
    
    const relationships = this.getCurrentRelationships();
    const children = new Map<string, Set<string>>();
    const parents = new Map<string, Set<string>>();
    
    relationships.forEach(rel => {
      if (rel.type === RelationType.INHERITANCE) {
        if (!children.has(rel.to)) {
          children.set(rel.to, new Set());
        }
        children.get(rel.to)!.add(rel.from);
        
        if (!parents.has(rel.from)) {
          parents.set(rel.from, new Set());
        }
        parents.get(rel.from)!.add(rel.to);
      }
    });
    
    const rootClasses = classes.filter(cls => !parents.has(cls.name) || parents.get(cls.name)!.size === 0);
    
    if (rootClasses.length > 0) {
      hierarchy.push(rootClasses);
      rootClasses.forEach(cls => processed.add(cls.name));
    }
    
    let currentLevel = 0;
    while (processed.size < classes.length && currentLevel < 10) {
      const previousLevel = hierarchy[currentLevel];
      if (!previousLevel || previousLevel.length === 0) break;
      
      const nextLevel: ClassInfo[] = [];
      
      previousLevel.forEach(parentClass => {
        const childNames = children.get(parentClass.name);
        if (childNames) {
          childNames.forEach(childName => {
            if (!processed.has(childName)) {
              const childClass = classMap.get(childName);
              if (childClass) {
                const classParents = parents.get(childName);
                let allParentsProcessed = true;
                if (classParents) {
                  classParents.forEach(parentName => {
                    if (!processed.has(parentName)) {
                      allParentsProcessed = false;
                    }
                  });
                }
                
                if (allParentsProcessed) {
                  nextLevel.push(childClass);
                  processed.add(childName);
                }
              }
            }
          });
        }
      });
      
      if (nextLevel.length > 0) {
        hierarchy.push(nextLevel);
      }
      
      currentLevel++;
    }
    
    const remaining = classes.filter(cls => !processed.has(cls.name));
    if (remaining.length > 0) {
      console.log(`Класи без зв'язків наслідування: ${remaining.map(c => c.name).join(', ')}`);
      
      const interfaces = remaining.filter(c => c.isInterface);
      const abstractClasses = remaining.filter(c => c.isAbstract && !c.isInterface);
      const regularClasses = remaining.filter(c => !c.isInterface && !c.isAbstract);
      
      if (interfaces.length > 0 && hierarchy.length > 0) {
        hierarchy[0] = [...interfaces, ...hierarchy[0]];
        interfaces.forEach(cls => processed.add(cls.name));
      } else if (interfaces.length > 0) {
        hierarchy.push(interfaces);
        interfaces.forEach(cls => processed.add(cls.name));
      }

      const remainingOthers = [...abstractClasses, ...regularClasses];
      if (remainingOthers.length > 0) {
        for (let i = 0; i < remainingOthers.length; i += 3) {
          hierarchy.push(remainingOthers.slice(i, i + 3));
        }
      }
    }
    
    console.log(`Загальна кількість рівнів: ${hierarchy.length}`);
    
    return hierarchy;
  }

  private currentRelationships: Relationship[] = [];
  
  private getCurrentRelationships(): Relationship[] {
    return this.currentRelationships;
  }

  private calculateClassHeight(classInfo: ClassInfo): number {
    const headerHeight = this.config.headerHeight;
    const fieldsHeight = classInfo.fields.length * this.config.lineHeight + this.config.sectionPadding * 2;
    const methodsHeight = classInfo.methods.length * this.config.lineHeight + this.config.sectionPadding * 2;
    
    return Math.max(
      this.config.minClassHeight,
      headerHeight + fieldsHeight + methodsHeight + this.config.padding * 2
    );
  }

  private setupCanvas(): void {
    let maxX = 0;
    let maxY = 0;
    let minX = Infinity;
    let minY = Infinity;
    
    this.classPositions.forEach(pos => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height);
    });

    const margin = 40;
    this.canvas.width = maxX + margin;
    this.canvas.height = maxY + margin;
    
    console.log(`Розмір canvas: ${this.canvas.width}x${this.canvas.height}`);
    
    this.ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`;
    this.ctx.textBaseline = 'middle';
  }

  private clearCanvas(): void {
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawClass(classInfo: ClassInfo): void {
    const pos = this.classPositions.get(classInfo.name);
    if (!pos) return;
    
    const { x, y, width, height } = pos;
    
    this.ctx.fillStyle = this.config.classBoxColor;
    this.ctx.fillRect(x, y, width, height);
    
    this.ctx.strokeStyle = this.config.classBorderColor;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, height);
    
    this.drawClassHeader(classInfo, x, y, width);
    
    let currentY = y + this.config.headerHeight;
    currentY = this.drawFields(classInfo, x, currentY, width);
    
    this.drawMethods(classInfo, x, currentY, width);
  }

  private drawClassHeader(classInfo: ClassInfo, x: number, y: number, width: number): void {
    let headerColor = this.config.headerColor;
    if (classInfo.isInterface) {
      headerColor = this.config.interfaceColor;
    } else if (classInfo.isAbstract) {
      headerColor = this.config.abstractColor;
    }
    
    this.ctx.fillStyle = headerColor;
    this.ctx.fillRect(x, y, width, this.config.headerHeight);
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `italic ${this.config.fontSize - 2}px ${this.config.fontFamily}`;
    this.ctx.textAlign = 'center';
    
    if (classInfo.isInterface) {
      this.ctx.fillText('«interface»', x + width / 2, y + 12);
    } else if (classInfo.isAbstract) {
      this.ctx.fillText('«abstract»', x + width / 2, y + 12);
    }
    
    this.ctx.font = `bold ${this.config.fontSize + 2}px ${this.config.fontFamily}`;
    this.ctx.fillText(classInfo.name, x + width / 2, y + 28);

    this.ctx.strokeStyle = this.config.classBorderColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + this.config.headerHeight);
    this.ctx.lineTo(x + width, y + this.config.headerHeight);
    this.ctx.stroke();
  }

  private drawFields(classInfo: ClassInfo, x: number, startY: number, width: number): number {
    if (classInfo.fields.length === 0) {
      return startY;
    }
    
    let currentY = startY + this.config.sectionPadding;
    
    this.ctx.textAlign = 'left';
    
    const ownFields = classInfo.fields.filter(f => !f.isInherited);
    const inheritedFields = classInfo.fields.filter(f => f.isInherited);
    
    ownFields.forEach(field => {
      this.ctx.fillStyle = this.config.textColor;
      this.ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`;
      const text = `${field.visibility}${field.name}: ${this.shortenType(field.type)}`;
      this.ctx.fillText(text, x + this.config.padding, currentY + this.config.lineHeight / 2);
      currentY += this.config.lineHeight;
    });
    
    if (inheritedFields.length > 0) {
      inheritedFields.forEach(field => {
        this.ctx.fillStyle = '#888888';
        this.ctx.font = `italic ${this.config.fontSize}px ${this.config.fontFamily}`;
        const text = `${field.visibility}${field.name}: ${this.shortenType(field.type)} ← ${field.inheritedFrom}`;
        this.ctx.fillText(text, x + this.config.padding, currentY + this.config.lineHeight / 2);
        currentY += this.config.lineHeight;
      });
    }
    
    currentY += this.config.sectionPadding;
    
    this.ctx.strokeStyle = this.config.classBorderColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, currentY);
    this.ctx.lineTo(x + width, currentY);
    this.ctx.stroke();
    
    return currentY;
  }

  private drawMethods(classInfo: ClassInfo, x: number, startY: number, width: number): void {
    if (classInfo.methods.length === 0) {
      return;
    }
    
    let currentY = startY + this.config.sectionPadding;
    
    this.ctx.textAlign = 'left';
    
    const ownMethods = classInfo.methods.filter(m => !m.isInherited);
    const inheritedMethods = classInfo.methods.filter(m => m.isInherited);
    
    const maxWidth = width - this.config.padding * 2;
    
    ownMethods.forEach(method => {
      this.ctx.fillStyle = this.config.textColor;
      this.ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`;

      const params = method.parameters.map(p => {
        if (p.type && p.type !== 'void' && p.type !== 'any') {
          return `${p.name}: ${this.shortenType(p.type)}`;
        }
        return p.name;
      }).join(', ');
      
      const returnType = method.returnType && method.returnType !== 'void' 
        ? `: ${this.shortenType(method.returnType)}` 
        : '';
      const text = `${method.visibility}${method.name}(${params})${returnType}`;
      
      const truncatedText = this.truncateText(text, maxWidth);
      this.ctx.fillText(truncatedText, x + this.config.padding, currentY + this.config.lineHeight / 2);
      currentY += this.config.lineHeight;
    });
    
    if (inheritedMethods.length > 0) {
      inheritedMethods.forEach(method => {
        this.ctx.fillStyle = '#888888';
        this.ctx.font = `italic ${this.config.fontSize}px ${this.config.fontFamily}`;

        const params = method.parameters.map(p => {
          if (p.type && p.type !== 'void' && p.type !== 'any') {
            return `${p.name}: ${this.shortenType(p.type)}`;
          }
          return p.name;
        }).join(', ');
        
        const returnType = method.returnType && method.returnType !== 'void'
          ? `: ${this.shortenType(method.returnType)}` 
          : '';
        const text = `${method.visibility}${method.name}(${params})${returnType} ← ${method.inheritedFrom}`;
        
        const truncatedText = this.truncateText(text, maxWidth);
        this.ctx.fillText(truncatedText, x + this.config.padding, currentY + this.config.lineHeight / 2);
        currentY += this.config.lineHeight;
      });
    }
  }

  private drawRelationships(relationships: Relationship[]): void {
    relationships.forEach(rel => {
      const fromPos = this.classPositions.get(rel.from);
      const toPos = this.classPositions.get(rel.to);
      
      if (!fromPos || !toPos) {
        console.warn(`Не знайдено позиції для зв'язку ${rel.from} -> ${rel.to}`);
        return;
      }
      
      this.drawConnection(fromPos, toPos, rel);
    });
  }

  private drawConnection(from: ClassPosition, to: ClassPosition, rel: Relationship): void {
    const { type, label, inheritanceModifier } = rel;

    this.ctx.strokeStyle = this.config.lineColor;
    this.ctx.lineWidth = this.config.lineWidth;
    
    if (type === RelationType.IMPLEMENTATION || type === RelationType.DEPENDENCY) {
      this.ctx.setLineDash([5, 5]);
    } else {
      this.ctx.setLineDash([]);
    }
    
    const points = this.calculateOrthogonalPath(from, to);
    
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    
    this.ctx.stroke();
    
    const lastPoint = points[points.length - 1];
    const prevPoint = points[points.length - 2];
    this.drawArrow(prevPoint, lastPoint, type);
    
    this.ctx.setLineDash([]);
    
    const midIndex = Math.floor(points.length / 2);
    const midPoint = points[midIndex];
    
    const displayLabel = inheritanceModifier || this.getRelationshipLabel(type);
    this.drawLabel(midPoint.x + 10, midPoint.y - 10, `«${displayLabel}»`);

    if (label) {
      this.drawLabel(midPoint.x + 10, midPoint.y + 10, label);
    }
  }
  
  private calculateOrthogonalPath(from: ClassPosition, to: ClassPosition): Array<{x: number, y: number}> {
    const fromCenterX = from.x + from.width / 2;
    const fromCenterY = from.y + from.height / 2;
    const toCenterX = to.x + to.width / 2;
    const toCenterY = to.y + to.height / 2;
    
    const points: Array<{x: number, y: number}> = [];
    
    const isBelow = to.y > from.y + from.height;
    const isAbove = to.y + to.height < from.y;
    const isRight = to.x > from.x + from.width;
    const isLeft = to.x + to.width < from.x;
    
    if (isBelow) {
      const startX = fromCenterX;
      const startY = from.y + from.height;
      points.push({ x: startX, y: startY });
      
      const midY = (startY + to.y) / 2;
      points.push({ x: startX, y: midY });

      points.push({ x: toCenterX, y: midY });
      
      points.push({ x: toCenterX, y: to.y });
    }
    else if (isAbove) {
      const startX = fromCenterX;
      const startY = from.y;
      points.push({ x: startX, y: startY });
      
      const midY = (startY + to.y + to.height) / 2;
      points.push({ x: startX, y: midY });

      points.push({ x: toCenterX, y: midY });
      
      points.push({ x: toCenterX, y: to.y + to.height });
    }
    else if (isRight || isLeft) {
      const startX = isRight ? from.x + from.width : from.x;
      const startY = fromCenterY;
      const endX = isRight ? to.x : to.x + to.width;
      const endY = toCenterY;
      
      points.push({ x: startX, y: startY });
      
      const midX = (startX + endX) / 2;
      points.push({ x: midX, y: startY });
      
      points.push({ x: midX, y: endY });
      
      points.push({ x: endX, y: endY });
    }

    else {
      points.push({ x: fromCenterX, y: from.y + from.height });
      points.push({ x: toCenterX, y: to.y });
    }
    
    return points;
  }
  
private getRelationshipLabel(type: RelationType): string {
    switch (type) {
      case RelationType.INHERITANCE:
        return 'наслідування';
      case RelationType.IMPLEMENTATION:
        return 'реалізація';
      case RelationType.COMPOSITION:
        return 'композиція';
      case RelationType.AGGREGATION:
        return 'агрегація';
      case RelationType.ASSOCIATION:
        return 'асоціація';
      case RelationType.DEPENDENCY:
        return 'залежність';
      default:
        return '';
    }
  }

  private drawArrow(from: { x: number; y: number }, to: { x: number; y: number }, type: RelationType): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowSize = this.config.arrowSize;
    
    this.ctx.fillStyle = this.config.lineColor;
    this.ctx.strokeStyle = this.config.lineColor;
    
    switch (type) {
      case RelationType.INHERITANCE:
      case RelationType.IMPLEMENTATION:
        this.drawTriangleArrow(to, angle, true);
        break;
      
      case RelationType.COMPOSITION:
        this.drawDiamondArrow(to, angle, true);
        break;
      
      case RelationType.AGGREGATION:
        this.drawDiamondArrow(to, angle, false);
        break;
      
      default:
        this.drawSimpleArrow(to, angle);
        break;
    }
  }

  private drawTriangleArrow(point: { x: number; y: number }, angle: number, filled: boolean): void {
    const size = this.config.arrowSize;
    
    this.ctx.beginPath();
    this.ctx.moveTo(point.x, point.y);
    this.ctx.lineTo(
      point.x - size * Math.cos(angle - Math.PI / 6),
      point.y - size * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      point.x - size * Math.cos(angle + Math.PI / 6),
      point.y - size * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    
    if (filled) {
      this.ctx.fill();
    } else {
      this.ctx.fillStyle = this.config.backgroundColor;
      this.ctx.fill();
      this.ctx.stroke();
    }
  }

  private drawDiamondArrow(point: { x: number; y: number }, angle: number, filled: boolean): void {
    const size = this.config.arrowSize;
    
    this.ctx.beginPath();
    this.ctx.moveTo(point.x, point.y);
    this.ctx.lineTo(
      point.x - size * Math.cos(angle - Math.PI / 4),
      point.y - size * Math.sin(angle - Math.PI / 4)
    );
    this.ctx.lineTo(
      point.x - size * 1.5 * Math.cos(angle),
      point.y - size * 1.5 * Math.sin(angle)
    );
    this.ctx.lineTo(
      point.x - size * Math.cos(angle + Math.PI / 4),
      point.y - size * Math.sin(angle + Math.PI / 4)
    );
    this.ctx.closePath();
    
    if (filled) {
      this.ctx.fill();
    } else {
      this.ctx.fillStyle = this.config.backgroundColor;
      this.ctx.fill();
      this.ctx.stroke();
    }
  }

  private drawSimpleArrow(point: { x: number; y: number }, angle: number): void {
    const size = this.config.arrowSize;
    
    this.ctx.beginPath();
    this.ctx.moveTo(point.x, point.y);
    this.ctx.lineTo(
      point.x - size * Math.cos(angle - Math.PI / 6),
      point.y - size * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.moveTo(point.x, point.y);
    this.ctx.lineTo(
      point.x - size * Math.cos(angle + Math.PI / 6),
      point.y - size * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.stroke();
  }

  private drawLabel(x: number, y: number, text: string): void {
    this.ctx.font = `${this.config.fontSize - 2}px ${this.config.fontFamily}`;
    const textWidth = this.ctx.measureText(text).width;
    const padding = 5;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = 18;
    
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight);
    
    this.ctx.strokeStyle = this.config.lineColor;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight);
    
    this.ctx.fillStyle = this.config.textColor;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y);
  }

  private shortenType(type: string): string {
    if (type.length > 25) {
      return type.substring(0, 22) + '...';
    }
    return type;
  }

  private truncateText(text: string, maxWidth: number): string {
    const width = this.ctx.measureText(text).width;
    if (width <= maxWidth) {
      return text;
    }
    
    let truncated = text;
    while (this.ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    
    return truncated + '...';
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

