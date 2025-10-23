import { ClassDiagram, ClassInfo, Relationship, RelationType, Visibility } from '../models/ClassDiagram.js';

/**
 * Позиція класу на canvas
 */
interface ClassPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Конфігурація стилів
 */
interface RenderConfig {
  classWidth: number;
  minClassHeight: number;
  lineHeight: number;
  padding: number;
  fontSize: number;
  fontFamily: string;
  headerHeight: number;
  sectionPadding: number;
  
  // Кольори
  backgroundColor: string;
  classBoxColor: string;
  classBorderColor: string;
  textColor: string;
  headerColor: string;
  interfaceColor: string;
  abstractColor: string;
  
  // Лінії
  lineColor: string;
  lineWidth: number;
  arrowSize: number;
}

/**
 * Canvas рендерер для діаграм класів
 */
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
    
    // Налаштування стилів
    this.config = {
      classWidth: 320, // Збільшено з 250
      minClassHeight: 120, // Збільшено з 100
      lineHeight: 22, // Збільшено з 20
      padding: 12, // Збільшено з 10
      fontSize: 14,
      fontFamily: 'Arial, sans-serif',
      headerHeight: 45, // Збільшено з 40
      sectionPadding: 8, // Збільшено з 5
      
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

  /**
   * Рендерить діаграму класів
   */
  render(diagram: ClassDiagram): void {
    const classes = diagram.getClasses();
    const relationships = diagram.getRelationships();
    
    // Зберігаємо зв'язки для використання в buildHierarchy
    this.currentRelationships = relationships;
    
    // Розраховуємо позиції класів (ієрархічно)
    this.calculatePositions(classes);
    
    // Налаштовуємо розмір canvas
    this.setupCanvas();
    
    // Очищаємо canvas
    this.clearCanvas();
    
    // Малюємо зв'язки (спочатку, щоб вони були під класами)
    this.drawRelationships(relationships);
    
    // Малюємо класи
    classes.forEach(classInfo => {
      this.drawClass(classInfo);
    });
    
    // Виводимо інформацію про ієрархію
    console.log('Ієрархія класів:');
    const hierarchy = this.buildHierarchy(classes);
    hierarchy.forEach((level, index) => {
      console.log(`  Рівень ${index}: ${level.map(c => c.name).join(', ')}`);
    });
  }

  /**
   * Розраховує позиції класів на canvas (ієрархічне розміщення)
   */
  private calculatePositions(classes: ClassInfo[]): void {
    this.classPositions.clear();
    
    if (classes.length === 0) return;
    
    // Визначаємо ієрархію класів
    const hierarchy = this.buildHierarchy(classes);
    
    console.log('Побудована ієрархія:');
    hierarchy.forEach((level, i) => {
      console.log(`  Рівень ${i}: ${level.map(c => c.name).join(', ')}`);
    });
    
    // Знаходимо максимальну кількість класів в одному рівні
    const maxClassesInLevel = Math.max(...hierarchy.map(level => level.length));
    
    // Налаштування для компактного відображення
    const horizontalGap = 60; // Зменшено відступ між класами
    const verticalGap = 100; // Відступ між рівнями (достатньо для стрілок)
    const margin = 40;
    
    // Розраховуємо загальну ширину canvas на основі найширшого рівня
    const maxLevelWidth = maxClassesInLevel * this.config.classWidth + (maxClassesInLevel - 1) * horizontalGap;
    const totalCanvasWidth = maxLevelWidth + margin * 2;
    
    let currentY = margin;
    
    hierarchy.forEach((level, levelIndex) => {
      // Розраховуємо максимальну висоту в рівні
      let maxHeight = 0;
      level.forEach(classInfo => {
        const height = this.calculateClassHeight(classInfo);
        maxHeight = Math.max(maxHeight, height);
      });
      
      // Розраховуємо ширину поточного рівня
      const levelWidth = level.length * this.config.classWidth + (level.length - 1) * horizontalGap;
      
      // Центруємо класи в рівні відносно загальної ширини
      let currentX = margin + (maxLevelWidth - levelWidth) / 2;
      
      level.forEach((classInfo, index) => {
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
  
  /**
   * Будує ієрархію класів за рівнями
   */
  private buildHierarchy(classes: ClassInfo[]): ClassInfo[][] {
    const hierarchy: ClassInfo[][] = [];
    const processed = new Set<string>();
    const classMap = new Map<string, ClassInfo>();
    
    // Створюємо мапу класів для швидкого доступу
    classes.forEach(cls => classMap.set(cls.name, cls));
    
    // Знаходимо всі зв'язки наслідування
    const relationships = this.getCurrentRelationships();
    const children = new Map<string, Set<string>>();
    const parents = new Map<string, Set<string>>();
    
    relationships.forEach(rel => {
      if (rel.type === RelationType.INHERITANCE) {
        // rel.from наслідує rel.to
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
    
    // Рівень 0: класи без батьків (базові класи)
    const rootClasses = classes.filter(cls => !parents.has(cls.name) || parents.get(cls.name)!.size === 0);
    
    if (rootClasses.length > 0) {
      hierarchy.push(rootClasses);
      rootClasses.forEach(cls => processed.add(cls.name));
    }
    
    // Наступні рівні: наслідники
    let currentLevel = 0;
    while (processed.size < classes.length && currentLevel < 10) { // Максимум 10 рівнів для безпеки
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
                // Перевіряємо, що всі батьки цього класу вже оброблені
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
    
    // Додаємо класи без зв'язків наслідування
    const remaining = classes.filter(cls => !processed.has(cls.name));
    if (remaining.length > 0) {
      console.log(`Класи без зв'язків наслідування: ${remaining.map(c => c.name).join(', ')}`);
      
      // Якщо є інтерфейси або абстрактні класи без зв'язків, ставимо їх на початок
      const interfaces = remaining.filter(c => c.isInterface);
      const abstractClasses = remaining.filter(c => c.isAbstract && !c.isInterface);
      const regularClasses = remaining.filter(c => !c.isInterface && !c.isAbstract);
      
      // Вставляємо інтерфейси на початок, якщо є
      if (interfaces.length > 0 && hierarchy.length > 0) {
        hierarchy[0] = [...interfaces, ...hierarchy[0]];
        interfaces.forEach(cls => processed.add(cls.name));
      } else if (interfaces.length > 0) {
        hierarchy.push(interfaces);
        interfaces.forEach(cls => processed.add(cls.name));
      }
      
      // Додаємо решту в кінець
      const remainingOthers = [...abstractClasses, ...regularClasses];
      if (remainingOthers.length > 0) {
        // Розбиваємо на рівні по 3-4 класи для компактності
        for (let i = 0; i < remainingOthers.length; i += 3) {
          hierarchy.push(remainingOthers.slice(i, i + 3));
        }
      }
    }
    
    console.log(`Загальна кількість рівнів: ${hierarchy.length}`);
    
    return hierarchy;
  }
  
  /**
   * Зберігає поточні зв'язки для використання в buildHierarchy
   */
  private currentRelationships: Relationship[] = [];
  
  private getCurrentRelationships(): Relationship[] {
    return this.currentRelationships;
  }

  /**
   * Розраховує висоту класу
   */
  private calculateClassHeight(classInfo: ClassInfo): number {
    const headerHeight = this.config.headerHeight;
    const fieldsHeight = classInfo.fields.length * this.config.lineHeight + this.config.sectionPadding * 2;
    const methodsHeight = classInfo.methods.length * this.config.lineHeight + this.config.sectionPadding * 2;
    
    return Math.max(
      this.config.minClassHeight,
      headerHeight + fieldsHeight + methodsHeight + this.config.padding * 2
    );
  }

  /**
   * Налаштовує розмір canvas
   */
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
    
    // Додаємо відступи
    const margin = 40;
    this.canvas.width = maxX + margin;
    this.canvas.height = maxY + margin;
    
    console.log(`Розмір canvas: ${this.canvas.width}x${this.canvas.height}`);
    
    // Налаштовуємо стилі тексту
    this.ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`;
    this.ctx.textBaseline = 'middle';
  }

  /**
   * Очищає canvas
   */
  private clearCanvas(): void {
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Малює клас
   */
  private drawClass(classInfo: ClassInfo): void {
    const pos = this.classPositions.get(classInfo.name);
    if (!pos) return;
    
    const { x, y, width, height } = pos;
    
    // Малюємо тіло класу
    this.ctx.fillStyle = this.config.classBoxColor;
    this.ctx.fillRect(x, y, width, height);
    
    // Малюємо рамку
    this.ctx.strokeStyle = this.config.classBorderColor;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, height);
    
    // Малюємо заголовок
    this.drawClassHeader(classInfo, x, y, width);
    
    // Малюємо поля
    let currentY = y + this.config.headerHeight;
    currentY = this.drawFields(classInfo, x, currentY, width);
    
    // Малюємо методи
    this.drawMethods(classInfo, x, currentY, width);
  }

  /**
   * Малює заголовок класу
   */
  private drawClassHeader(classInfo: ClassInfo, x: number, y: number, width: number): void {
    // Фон заголовка
    let headerColor = this.config.headerColor;
    if (classInfo.isInterface) {
      headerColor = this.config.interfaceColor;
    } else if (classInfo.isAbstract) {
      headerColor = this.config.abstractColor;
    }
    
    this.ctx.fillStyle = headerColor;
    this.ctx.fillRect(x, y, width, this.config.headerHeight);
    
    // Стереотип
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `italic ${this.config.fontSize - 2}px ${this.config.fontFamily}`;
    this.ctx.textAlign = 'center';
    
    if (classInfo.isInterface) {
      this.ctx.fillText('«interface»', x + width / 2, y + 12);
    } else if (classInfo.isAbstract) {
      this.ctx.fillText('«abstract»', x + width / 2, y + 12);
    }
    
    // Назва класу
    this.ctx.font = `bold ${this.config.fontSize + 2}px ${this.config.fontFamily}`;
    this.ctx.fillText(classInfo.name, x + width / 2, y + 28);
    
    // Лінія під заголовком
    this.ctx.strokeStyle = this.config.classBorderColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + this.config.headerHeight);
    this.ctx.lineTo(x + width, y + this.config.headerHeight);
    this.ctx.stroke();
  }

  /**
   * Малює поля класу
   */
  private drawFields(classInfo: ClassInfo, x: number, startY: number, width: number): number {
    if (classInfo.fields.length === 0) {
      return startY;
    }
    
    let currentY = startY + this.config.sectionPadding;
    
    this.ctx.textAlign = 'left';
    
    // Спочатку малюємо власні поля, потім успадковані
    const ownFields = classInfo.fields.filter(f => !f.isInherited);
    const inheritedFields = classInfo.fields.filter(f => f.isInherited);
    
    // Власні поля (звичайний шрифт)
    ownFields.forEach(field => {
      this.ctx.fillStyle = this.config.textColor;
      this.ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`;
      const text = `${field.visibility}${field.name}: ${this.shortenType(field.type)}`;
      this.ctx.fillText(text, x + this.config.padding, currentY + this.config.lineHeight / 2);
      currentY += this.config.lineHeight;
    });
    
    // Успадковані поля (курсив + сірий колір + позначка)
    if (inheritedFields.length > 0) {
      inheritedFields.forEach(field => {
        this.ctx.fillStyle = '#888888'; // Сірий колір
        this.ctx.font = `italic ${this.config.fontSize}px ${this.config.fontFamily}`;
        const text = `${field.visibility}${field.name}: ${this.shortenType(field.type)} ← ${field.inheritedFrom}`;
        this.ctx.fillText(text, x + this.config.padding, currentY + this.config.lineHeight / 2);
        currentY += this.config.lineHeight;
      });
    }
    
    currentY += this.config.sectionPadding;
    
    // Лінія після полів
    this.ctx.strokeStyle = this.config.classBorderColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, currentY);
    this.ctx.lineTo(x + width, currentY);
    this.ctx.stroke();
    
    return currentY;
  }

  /**
   * Малює методи класу
   */
  private drawMethods(classInfo: ClassInfo, x: number, startY: number, width: number): void {
    if (classInfo.methods.length === 0) {
      return;
    }
    
    let currentY = startY + this.config.sectionPadding;
    
    this.ctx.textAlign = 'left';
    
    // Спочатку малюємо власні методи, потім успадковані
    const ownMethods = classInfo.methods.filter(m => !m.isInherited);
    const inheritedMethods = classInfo.methods.filter(m => m.isInherited);
    
    const maxWidth = width - this.config.padding * 2;
    
    // Власні методи (звичайний шрифт)
    ownMethods.forEach(method => {
      this.ctx.fillStyle = this.config.textColor;
      this.ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`;
      
      // UML формат параметрів: name: type
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
    
    // Успадковані методи (курсив + сірий колір + позначка)
    if (inheritedMethods.length > 0) {
      inheritedMethods.forEach(method => {
        this.ctx.fillStyle = '#888888'; // Сірий колір
        this.ctx.font = `italic ${this.config.fontSize}px ${this.config.fontFamily}`;
        
        // UML формат параметрів: name: type
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

  /**
   * Малює зв'язки між класами
   */
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

  /**
   * Малює з'єднання між двома класами
   */
  private drawConnection(from: ClassPosition, to: ClassPosition, rel: Relationship): void {
    const { type, label, inheritanceModifier } = rel;
    
    // Налаштовуємо стиль лінії
    this.ctx.strokeStyle = this.config.lineColor;
    this.ctx.lineWidth = this.config.lineWidth;
    
    // Штрихована лінія для реалізації та залежності
    if (type === RelationType.IMPLEMENTATION || type === RelationType.DEPENDENCY) {
      this.ctx.setLineDash([5, 5]);
    } else {
      this.ctx.setLineDash([]);
    }
    
    // Малюємо ортогональну лінію (під прямими кутами)
    const points = this.calculateOrthogonalPath(from, to);
    
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    
    this.ctx.stroke();
    
    // Малюємо стрілку на останньому сегменті
    const lastPoint = points[points.length - 1];
    const prevPoint = points[points.length - 2];
    this.drawArrow(prevPoint, lastPoint, type);
    
    // Скидаємо штрихування
    this.ctx.setLineDash([]);
    
    // Малюємо підпис типу відношення
    // Знаходимо середину шляху
    const midIndex = Math.floor(points.length / 2);
    const midPoint = points[midIndex];
    
    // Якщо є модифікатор наслідування, показуємо його замість generic типу
    const displayLabel = inheritanceModifier || this.getRelationshipLabel(type);
    this.drawLabel(midPoint.x + 10, midPoint.y - 10, `«${displayLabel}»`);
    
    // Малюємо додатковий підпис, якщо є (назва поля)
    if (label) {
      this.drawLabel(midPoint.x + 10, midPoint.y + 10, label);
    }
  }
  
  /**
   * Розраховує ортогональний шлях між двома класами
   */
  private calculateOrthogonalPath(from: ClassPosition, to: ClassPosition): Array<{x: number, y: number}> {
    const fromCenterX = from.x + from.width / 2;
    const fromCenterY = from.y + from.height / 2;
    const toCenterX = to.x + to.width / 2;
    const toCenterY = to.y + to.height / 2;
    
    const points: Array<{x: number, y: number}> = [];
    
    // Визначаємо, чи клас нижче чи вище
    const isBelow = to.y > from.y + from.height;
    const isAbove = to.y + to.height < from.y;
    const isRight = to.x > from.x + from.width;
    const isLeft = to.x + to.width < from.x;
    
    // Для вертикальної ієрархії (to нижче from)
    if (isBelow) {
      // Починаємо з низу батьківського класу
      const startX = fromCenterX;
      const startY = from.y + from.height;
      points.push({ x: startX, y: startY });
      
      // Вертикально вниз на половину відстані
      const midY = (startY + to.y) / 2;
      points.push({ x: startX, y: midY });
      
      // Горизонтально до центру дочірнього класу
      points.push({ x: toCenterX, y: midY });
      
      // Вертикально до верху дочірнього класу
      points.push({ x: toCenterX, y: to.y });
    }
    // Для зворотної ієрархії (to вище from)
    else if (isAbove) {
      // Починаємо з верху нащадка
      const startX = fromCenterX;
      const startY = from.y;
      points.push({ x: startX, y: startY });
      
      // Вертикально вгору на половину відстані
      const midY = (startY + to.y + to.height) / 2;
      points.push({ x: startX, y: midY });
      
      // Горизонтально до центру батьківського класу
      points.push({ x: toCenterX, y: midY });
      
      // Вертикально до низу батьківського класу
      points.push({ x: toCenterX, y: to.y + to.height });
    }
    // Горизонтальні зв'язки
    else if (isRight || isLeft) {
      const startX = isRight ? from.x + from.width : from.x;
      const startY = fromCenterY;
      const endX = isRight ? to.x : to.x + to.width;
      const endY = toCenterY;
      
      points.push({ x: startX, y: startY });
      
      // Горизонтально на половину відстані
      const midX = (startX + endX) / 2;
      points.push({ x: midX, y: startY });
      
      // Вертикально
      points.push({ x: midX, y: endY });
      
      // Горизонтально до кінця
      points.push({ x: endX, y: endY });
    }
    // Якщо класи перекриваються (рідко)
    else {
      // Проста пряма лінія
      points.push({ x: fromCenterX, y: from.y + from.height });
      points.push({ x: toCenterX, y: to.y });
    }
    
    return points;
  }
  
  /**
   * Повертає текстову назву типу відношення
   */
  private getRelationshipLabel(type: RelationType): string {
    switch (type) {
      case RelationType.INHERITANCE:
        return '«наслідування»';
      case RelationType.IMPLEMENTATION:
        return '«реалізація»';
      case RelationType.COMPOSITION:
        return '«композиція»';
      case RelationType.AGGREGATION:
        return '«агрегація»';
      case RelationType.ASSOCIATION:
        return '«асоціація»';
      case RelationType.DEPENDENCY:
        return '«залежність»';
      default:
        return '';
    }
  }

  /**
   * Знаходить точку на краю прямокутника (оптимізовано для вертикального розміщення)
   */
  private findEdgePoint(box: ClassPosition, targetPoint: { x: number; y: number }): { x: number; y: number } {
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    const dx = targetPoint.x - centerX;
    const dy = targetPoint.y - centerY;
    
    // Для вертикального розміщення переважно використовуємо верх/низ
    if (Math.abs(dy) > Math.abs(dx) * 0.5) {
      // Вертикальна сторона (верх або низ)
      const x = centerX + (dx / Math.abs(dy)) * box.height / 2;
      const y = dy > 0 ? box.y + box.height : box.y; // Низ або верх
      return { 
        x: Math.max(box.x + 5, Math.min(box.x + box.width - 5, x)), 
        y 
      };
    } else {
      // Горизонтальна сторона (ліворуч або праворуч)
      const x = dx > 0 ? box.x + box.width : box.x;
      const y = centerY + (dy / Math.abs(dx)) * box.width / 2;
      return { 
        x, 
        y: Math.max(box.y + 5, Math.min(box.y + box.height - 5, y))
      };
    }
  }

  /**
   * Малює стрілку
   */
  private drawArrow(from: { x: number; y: number }, to: { x: number; y: number }, type: RelationType): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const arrowSize = this.config.arrowSize;
    
    this.ctx.fillStyle = this.config.lineColor;
    this.ctx.strokeStyle = this.config.lineColor;
    
    switch (type) {
      case RelationType.INHERITANCE:
      case RelationType.IMPLEMENTATION:
        // Порожня стрілка (трикутник)
        this.drawTriangleArrow(to, angle, true);
        break;
      
      case RelationType.COMPOSITION:
        // Заповнений ромб
        this.drawDiamondArrow(to, angle, true);
        break;
      
      case RelationType.AGGREGATION:
        // Порожній ромб
        this.drawDiamondArrow(to, angle, false);
        break;
      
      default:
        // Звичайна стрілка
        this.drawSimpleArrow(to, angle);
        break;
    }
  }

  /**
   * Малює трикутну стрілку
   */
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

  /**
   * Малює ромбічну стрілку
   */
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

  /**
   * Малює просту стрілку
   */
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

  /**
   * Малює підпис на лінії
   */
  private drawLabel(x: number, y: number, text: string): void {
    // Розраховуємо ширину тексту
    this.ctx.font = `${this.config.fontSize - 2}px ${this.config.fontFamily}`;
    const textWidth = this.ctx.measureText(text).width;
    const padding = 5;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = 18;
    
    // Малюємо білий фон з рамкою для кращої читабельності
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight);
    
    this.ctx.strokeStyle = this.config.lineColor;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight);
    
    // Малюємо текст
    this.ctx.fillStyle = this.config.textColor;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y);
  }

  /**
   * Скорочує тип для відображення
   */
  private shortenType(type: string): string {
    if (type.length > 25) {
      return type.substring(0, 22) + '...';
    }
    return type;
  }

  /**
   * Обрізає текст до максимальної ширини
   */
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

  /**
   * Експортує canvas як PNG
   */
  exportToPNG(): Blob | null {
    return new Promise<Blob | null>((resolve) => {
      this.canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    }) as any;
  }

  /**
   * Експортує canvas як SVG (через серіалізацію canvas у SVG image)
   */
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

