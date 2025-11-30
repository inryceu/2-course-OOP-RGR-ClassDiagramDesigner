import { BaseParser } from './IParser.js';
import { ClassDiagram } from '../models/ClassDiagram.js';
export declare class TypeScriptParser extends BaseParser {
    constructor();
    parse(sourceCode: string, fileName?: string): ClassDiagram;
    private parseStreaming;
    private findClassMatchesStreaming;
    private findInterfaceMatchesStreaming;
    private processClassMatch;
    private processInterfaceMatch;
    private parseFields;
    private parseMethods;
    private addConstructor;
    private parseConstructorAssignments;
    private parseInterfaceProperties;
    private parseInterfaceMethods;
    private parseRelationships;
    private extractTypesFromGeneric;
    private cleanTypeSimple;
}
//# sourceMappingURL=TypeScriptParser.d.ts.map