import { RelationType } from '../models/ClassDiagram.js';
import { calculateAngle } from './geometryUtils.js';
export function drawTriangleArrow(ctx, point, angle, size, filled, fillColor, strokeColor, backgroundColor) {
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x - size * Math.cos(angle - Math.PI / 6), point.y - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(point.x - size * Math.cos(angle + Math.PI / 6), point.y - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    if (filled) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
    else {
        ctx.fillStyle = backgroundColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
    }
}
export function drawDiamondArrow(ctx, point, angle, size, filled, fillColor, strokeColor, backgroundColor) {
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x - size * Math.cos(angle - Math.PI / 4), point.y - size * Math.sin(angle - Math.PI / 4));
    ctx.lineTo(point.x - size * 1.5 * Math.cos(angle), point.y - size * 1.5 * Math.sin(angle));
    ctx.lineTo(point.x - size * Math.cos(angle + Math.PI / 4), point.y - size * Math.sin(angle + Math.PI / 4));
    ctx.closePath();
    if (filled) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
    else {
        ctx.fillStyle = backgroundColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
    }
}
export function drawSimpleArrow(ctx, point, angle, size) {
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x - size * Math.cos(angle - Math.PI / 6), point.y - size * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x - size * Math.cos(angle + Math.PI / 6), point.y - size * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
}
export function drawArrowByType(ctx, from, to, type, config) {
    const angle = calculateAngle(from, to);
    ctx.save();
    ctx.fillStyle = config.lineColor;
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = config.lineWidth;
    ctx.setLineDash([]);
    switch (type) {
        case RelationType.INHERITANCE:
        case RelationType.IMPLEMENTATION:
            drawTriangleArrow(ctx, to, angle, config.arrowSize, true, config.lineColor, config.lineColor, config.backgroundColor);
            break;
        case RelationType.COMPOSITION:
            drawDiamondArrow(ctx, to, angle, config.arrowSize, true, config.lineColor, config.lineColor, config.backgroundColor);
            break;
        case RelationType.AGGREGATION:
            drawDiamondArrow(ctx, to, angle, config.arrowSize, false, config.lineColor, config.lineColor, config.backgroundColor);
            break;
        default:
            drawSimpleArrow(ctx, to, angle, config.arrowSize);
            break;
    }
    ctx.restore();
}
export function drawLabel(ctx, x, y, text, config) {
    ctx.font = `${config.fontSize - 2}px ${config.fontFamily}`;
    const textWidth = ctx.measureText(text).width;
    const padding = 5;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = 18;
    ctx.fillStyle = config.backgroundColor;
    ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight);
    ctx.strokeStyle = config.lineColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight);
    ctx.fillStyle = config.textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
}
export function findBestLabelPosition(x, y, existingLabels, existingBoxes) {
    const offsets = [
        { dx: 15, dy: -15 },
        { dx: 15, dy: 15 },
        { dx: -15, dy: -15 },
        { dx: -15, dy: 15 },
        { dx: 25, dy: 0 },
        { dx: -25, dy: 0 },
        { dx: 0, dy: -25 },
        { dx: 0, dy: 25 },
        { dx: 30, dy: -10 },
        { dx: 30, dy: 10 },
        { dx: -30, dy: -10 },
        { dx: -30, dy: 10 }
    ];
    for (const offset of offsets) {
        const testX = x + offset.dx;
        const testY = y + offset.dy;
        if (!isLabelOverlapping(testX, testY, 100, 20, existingLabels, existingBoxes)) {
            return { x: testX, y: testY };
        }
    }
    return { x: x + 15, y: y - 15 };
}
function isLabelOverlapping(x, y, width, height, existingLabels, existingBoxes) {
    const newLabel = {
        x: x - width / 2,
        y: y - height / 2,
        width,
        height
    };
    for (const existing of existingLabels) {
        if (!(newLabel.x + newLabel.width < existing.x ||
            newLabel.x > existing.x + existing.width ||
            newLabel.y + newLabel.height < existing.y ||
            newLabel.y > existing.y + existing.height)) {
            return true;
        }
    }
    const margin = 10;
    for (const pos of existingBoxes) {
        if (!(newLabel.x + newLabel.width < pos.x - margin ||
            newLabel.x > pos.x + pos.width + margin ||
            newLabel.y + newLabel.height < pos.y - margin ||
            newLabel.y > pos.y + pos.height + margin)) {
            return true;
        }
    }
    return false;
}
export function drawStartPoint(ctx, x, y, lineColor) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}
export function getRelationshipLabel(type) {
    switch (type) {
        case RelationType.INHERITANCE:
            return 'inheritance';
        case RelationType.IMPLEMENTATION:
            return 'implementation';
        case RelationType.COMPOSITION:
            return 'composition';
        case RelationType.AGGREGATION:
            return 'aggregation';
        case RelationType.ASSOCIATION:
            return 'association';
        case RelationType.DEPENDENCY:
            return 'dependency';
        default:
            return '';
    }
}
export function getRelationshipTypeOffset(type) {
    switch (type) {
        case RelationType.INHERITANCE:
            return 0;
        case RelationType.IMPLEMENTATION:
            return 6;
        case RelationType.COMPOSITION:
            return -6;
        case RelationType.AGGREGATION:
            return 12;
        case RelationType.ASSOCIATION:
            return -12;
        case RelationType.DEPENDENCY:
            return 18;
        default:
            return 0;
    }
}
//# sourceMappingURL=renderingUtils.js.map