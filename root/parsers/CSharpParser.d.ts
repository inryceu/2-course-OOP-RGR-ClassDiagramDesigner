import { BaseParser } from './IParser.js';
import { ClassDiagram } from '../models/ClassDiagram.js';
export declare class CSharpParser extends BaseParser {
    constructor();
    parse(sourceCode: string): ClassDiagram;
    private parseClasses;
    private parseInterfaces;
    private extractBalancedBraces;
    private parseFields;
    private parseProperties;
    private parseMethods;
    private parseInterfaceProperties;
    private parseInterfaceMethods;
    private parseInheritance;
}
//# sourceMappingURL=CSharpParser.d.ts.map