import { ClassInfo, Field, Method } from '../models/ClassDiagram.js';
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
export declare function drawClassBox(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, fillColor: string, borderColor: string): void;
export declare function drawClassHeader(ctx: CanvasRenderingContext2D, classInfo: ClassInfo, x: number, y: number, width: number, config: DrawConfig): void;
export declare function drawFields(ctx: CanvasRenderingContext2D, fields: Field[], x: number, startY: number, width: number, config: DrawConfig): number;
export declare function drawMethods(ctx: CanvasRenderingContext2D, methods: Method[], x: number, startY: number, width: number, config: DrawConfig): void;
export declare function calculateClassHeight(classInfo: ClassInfo, headerHeight: number, lineHeight: number, sectionPadding: number, padding: number, minHeight: number): number;
export declare function setupCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, positions: Map<string, {
    x: number;
    y: number;
    width: number;
    height: number;
}>, fontSize: number, fontFamily: string): void;
//# sourceMappingURL=canvasDrawingUtils.d.ts.map