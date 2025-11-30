import { IParser } from './IParser.js';
import { ClassDiagram } from '../models/ClassDiagram.js';
export declare enum Language {
    TYPESCRIPT = "typescript",
    JAVASCRIPT = "javascript",
    CPP = "cpp",
    CSHARP = "csharp",
    AUTO = "auto"
}
export declare class ParserFactory {
    private parsers;
    constructor();
    private initializeParsers;
    getParser(language: Language): IParser | null;
    detectLanguage(fileName: string): Language;
    parseFile(fileName: string, sourceCode: string, language?: Language): ClassDiagram;
    parseMultipleFiles(files: Array<{
        name: string;
        content: string;
    }>, language?: Language): ClassDiagram;
}
//# sourceMappingURL=ParserFactory.d.ts.map