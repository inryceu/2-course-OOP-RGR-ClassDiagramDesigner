import { ClassDiagram } from '../models/ClassDiagram.js';
export declare class CanvasRenderer {
    private canvas;
    private ctx;
    private config;
    private classPositions;
    private labelPositions;
    private usedPaths;
    private currentRelationships;
    constructor(canvasElement: HTMLCanvasElement);
    render(diagram: ClassDiagram): void;
    private calculatePositions;
    private sortLevelByConnections;
    private clearCanvas;
    private drawClass;
    private drawRelationships;
    private drawGroupedConnections;
    private drawConnection;
    private drawLabelWithCheck;
    exportToPNG(): Blob | null;
    exportToSVG(): string;
}
//# sourceMappingURL=CanvasRenderer.d.ts.map