import { ClassDiagram } from '../models/ClassDiagram.js';
export interface IParser {
    parse(sourceCode: string, fileName?: string): ClassDiagram;
    canParse(fileName: string): boolean;
}
export declare abstract class BaseParser implements IParser {
    protected supportedExtensions: string[];
    abstract parse(sourceCode: string, fileName?: string): ClassDiagram;
    canParse(fileName: string): boolean;
    protected removeComments(code: string, singleLinePrefix: string, multiLineStart: string, multiLineEnd: string): string;
    protected escapeRegex(str: string): string;
    protected cleanString(str: string): string;
}
//# sourceMappingURL=IParser.d.ts.map