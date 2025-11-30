import { RelationType } from '../models/ClassDiagram.js';
import { Point, Rectangle } from './geometryUtils.js';
export interface RenderConfig {
    backgroundColor: string;
    lineColor: string;
    textColor: string;
    lineWidth: number;
    arrowSize: number;
    fontSize: number;
    fontFamily: string;
}
export declare function drawTriangleArrow(ctx: CanvasRenderingContext2D, point: Point, angle: number, size: number, filled: boolean, fillColor: string, strokeColor: string, backgroundColor: string): void;
export declare function drawDiamondArrow(ctx: CanvasRenderingContext2D, point: Point, angle: number, size: number, filled: boolean, fillColor: string, strokeColor: string, backgroundColor: string): void;
export declare function drawSimpleArrow(ctx: CanvasRenderingContext2D, point: Point, angle: number, size: number): void;
export declare function drawArrowByType(ctx: CanvasRenderingContext2D, from: Point, to: Point, type: RelationType, config: RenderConfig): void;
export declare function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, config: RenderConfig): void;
export declare function findBestLabelPosition(x: number, y: number, existingLabels: Rectangle[], existingBoxes: Rectangle[]): Point;
export declare function drawStartPoint(ctx: CanvasRenderingContext2D, x: number, y: number, lineColor: string): void;
export declare function getRelationshipLabel(type: RelationType): string;
export declare function getRelationshipTypeOffset(type: RelationType): number;
//# sourceMappingURL=renderingUtils.d.ts.map