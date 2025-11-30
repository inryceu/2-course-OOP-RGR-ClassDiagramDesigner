import { BaseParser } from './IParser.js';
import { ClassDiagram } from '../models/ClassDiagram.js';
export declare class CppParser extends BaseParser {
    constructor();
    parse(sourceCode: string): ClassDiagram;
    private parseClasses;
    private extractBalancedBraces;
    private parseClassBody;
    private splitByVisibility;
    private parseFields;
    private parseMethods;
    private parseInheritance;
}
//# sourceMappingURL=CppParser.d.ts.map