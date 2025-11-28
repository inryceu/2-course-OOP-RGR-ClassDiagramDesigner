import { ClassInfo, Field, Method, Visibility } from '../models/ClassDiagram.js';
import { shortenType, truncateText } from './stringUtils.js';

export interface DrawConfig {
  fontSize: number;
  fontFamily: string;
  padding: number;
  lineHeight: number;
  sectionPadding: number;
  headerHeight: number;
  textColor: string;
  headerColor: string;
  interfaceColor: string;
  abstractColor: string;
  classBorderColor: string;
}

export function drawClassBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: string,
  borderColor: string
): void {
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, width, height);
  
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
}

export function drawClassHeader(
  ctx: CanvasRenderingContext2D,
  classInfo: ClassInfo,
  x: number,
  y: number,
  width: number,
  config: DrawConfig
): void {
  let headerColor = config.headerColor;
  if (classInfo.isInterface) {
    headerColor = config.interfaceColor;
  } else if (classInfo.isAbstract) {
    headerColor = config.abstractColor;
  }
  
  ctx.fillStyle = headerColor;
  ctx.fillRect(x, y, width, config.headerHeight);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = `italic ${config.fontSize - 2}px ${config.fontFamily}`;
  ctx.textAlign = 'center';
  
  if (classInfo.isInterface) {
    ctx.fillText('«interface»', x + width / 2, y + 9);
  } else if (classInfo.isAbstract) {
    ctx.fillText('«abstract»', x + width / 2, y + 9);
  }
  
  ctx.font = `bold ${config.fontSize + 1}px ${config.fontFamily}`;
  ctx.fillText(classInfo.name, x + width / 2, y + 22);

  ctx.strokeStyle = config.classBorderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + config.headerHeight);
  ctx.lineTo(x + width, y + config.headerHeight);
  ctx.stroke();
}

export function drawFields(
  ctx: CanvasRenderingContext2D,
  fields: Field[],
  x: number,
  startY: number,
  width: number,
  config: DrawConfig
): number {
  if (fields.length === 0) {
    return startY;
  }
  
  let currentY = startY + config.sectionPadding;
  ctx.textAlign = 'left';
  
  const ownFields = fields.filter(f => !f.isInherited);
  const inheritedFields = fields.filter(f => f.isInherited);
  
  ownFields.forEach(field => {
    ctx.fillStyle = config.textColor;
    ctx.font = `${config.fontSize}px ${config.fontFamily}`;
    const text = `${field.visibility}${field.name}: ${shortenType(field.type)}`;
    ctx.fillText(text, x + config.padding, currentY + config.lineHeight / 2);
    currentY += config.lineHeight;
  });
  
  if (inheritedFields.length > 0) {
    inheritedFields.forEach(field => {
      ctx.fillStyle = '#888888';
      ctx.font = `italic ${config.fontSize}px ${config.fontFamily}`;
      const text = `${field.visibility}${field.name}: ${shortenType(field.type)} ← ${field.inheritedFrom}`;
      ctx.fillText(text, x + config.padding, currentY + config.lineHeight / 2);
      currentY += config.lineHeight;
    });
  }
  
  currentY += config.sectionPadding;
  
  ctx.strokeStyle = config.classBorderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, currentY);
  ctx.lineTo(x + width, currentY);
  ctx.stroke();
  
  return currentY;
}

export function drawMethods(
  ctx: CanvasRenderingContext2D,
  methods: Method[],
  x: number,
  startY: number,
  width: number,
  config: DrawConfig
): void {
  if (methods.length === 0) {
    return;
  }
  
  let currentY = startY + config.sectionPadding;
  ctx.textAlign = 'left';
  
  const ownMethods = methods.filter(m => !m.isInherited);
  const inheritedMethods = methods.filter(m => m.isInherited);
  
  const maxWidth = width - config.padding * 2;
  
  ownMethods.forEach(method => {
    ctx.fillStyle = config.textColor;
    ctx.font = `${config.fontSize}px ${config.fontFamily}`;

    const params = method.parameters.map(p => {
      if (p.type && p.type !== 'void' && p.type !== 'any') {
        return `${p.name}: ${shortenType(p.type)}`;
      }
      return p.name;
    }).join(', ');
    
    const returnType = method.returnType && method.returnType !== 'void' 
      ? `: ${shortenType(method.returnType)}` 
      : '';
    const text = `${method.visibility}${method.name}(${params})${returnType}`;
    
    const truncatedText = truncateText(ctx, text, maxWidth);
    ctx.fillText(truncatedText, x + config.padding, currentY + config.lineHeight / 2);
    currentY += config.lineHeight;
  });
  
  if (inheritedMethods.length > 0) {
    inheritedMethods.forEach(method => {
      ctx.fillStyle = '#888888';
      ctx.font = `italic ${config.fontSize}px ${config.fontFamily}`;

      const params = method.parameters.map(p => {
        if (p.type && p.type !== 'void' && p.type !== 'any') {
          return `${p.name}: ${shortenType(p.type)}`;
        }
        return p.name;
      }).join(', ');
      
      const returnType = method.returnType && method.returnType !== 'void'
        ? `: ${shortenType(method.returnType)}` 
        : '';
      const text = `${method.visibility}${method.name}(${params})${returnType} ← ${method.inheritedFrom}`;
      
      const truncatedText = truncateText(ctx, text, maxWidth);
      ctx.fillText(truncatedText, x + config.padding, currentY + config.lineHeight / 2);
      currentY += config.lineHeight;
    });
  }
}

export function calculateClassHeight(
  classInfo: ClassInfo,
  headerHeight: number,
  lineHeight: number,
  sectionPadding: number,
  padding: number,
  minHeight: number
): number {
  const fieldsHeight = classInfo.fields.length * lineHeight + sectionPadding * 2;
  const methodsHeight = classInfo.methods.length * lineHeight + sectionPadding * 2;
  
  return Math.max(
    minHeight,
    headerHeight + fieldsHeight + methodsHeight + padding * 2
  );
}

export function setupCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  positions: Map<string, { x: number, y: number, width: number, height: number }>,
  fontSize: number,
  fontFamily: string
): void {
  let maxX = 0;
  let maxY = 0;
  let minX = Infinity;
  let minY = Infinity;
  
  positions.forEach(pos => {
    const offsetMargin = 30;
    minX = Math.min(minX, pos.x - offsetMargin);
    minY = Math.min(minY, pos.y - offsetMargin);
    maxX = Math.max(maxX, pos.x + pos.width + offsetMargin);
    maxY = Math.max(maxY, pos.y + pos.height + offsetMargin);
  });

  const horizontalMargin = 50;
  const verticalMargin = 70;
  
  const finalWidth = maxX + horizontalMargin - Math.min(0, minX);
  const finalHeight = maxY + verticalMargin - Math.min(0, minY);
  
  canvas.width = Math.max(finalWidth, 800);
  canvas.height = Math.max(finalHeight, 600);
  
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'middle';
}

