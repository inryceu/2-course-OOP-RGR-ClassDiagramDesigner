import { TypeScriptParser } from './TypeScriptParser.js';
import { CppParser } from './CppParser.js';
import { CSharpParser } from './CSharpParser.js';
import { ClassDiagram } from '../models/ClassDiagram.js';
export var Language;
(function (Language) {
    Language["TYPESCRIPT"] = "typescript";
    Language["JAVASCRIPT"] = "javascript";
    Language["CPP"] = "cpp";
    Language["CSHARP"] = "csharp";
    Language["AUTO"] = "auto";
})(Language || (Language = {}));
export class ParserFactory {
    constructor() {
        this.parsers = new Map();
        this.initializeParsers();
    }
    initializeParsers() {
        const tsParser = new TypeScriptParser();
        this.parsers.set(Language.TYPESCRIPT, tsParser);
        this.parsers.set(Language.JAVASCRIPT, tsParser);
        this.parsers.set(Language.CPP, new CppParser());
        this.parsers.set(Language.CSHARP, new CSharpParser());
    }
    getParser(language) {
        if (language === Language.AUTO) {
            return null;
        }
        return this.parsers.get(language) || null;
    }
    detectLanguage(fileName) {
        const extension = fileName.toLowerCase().split('.').pop() || '';
        switch (extension) {
            case 'ts':
            case 'tsx':
                return Language.TYPESCRIPT;
            case 'js':
            case 'jsx':
                return Language.JAVASCRIPT;
            case 'cpp':
            case 'cc':
            case 'cxx':
            case 'h':
            case 'hpp':
            case 'hxx':
                return Language.CPP;
            case 'cs':
                return Language.CSHARP;
            default:
                throw new Error(`Unsupported file extension: ${extension}`);
        }
    }
    parseFile(fileName, sourceCode, language = Language.AUTO) {
        let targetLanguage = language;
        if (language === Language.AUTO) {
            targetLanguage = this.detectLanguage(fileName);
        }
        const parser = this.getParser(targetLanguage);
        if (!parser) {
            throw new Error(`Parser for language ${targetLanguage} not found`);
        }
        return parser.parse(sourceCode, fileName);
    }
    parseMultipleFiles(files, language = Language.AUTO) {
        const combinedDiagram = new ClassDiagram();
        for (const file of files) {
            try {
                const diagram = this.parseFile(file.name, file.content, language);
                const classes = diagram.getClasses();
                for (const classInfo of classes) {
                    combinedDiagram.addClass(classInfo);
                }
                const relationships = diagram.getRelationships();
                for (const relationship of relationships) {
                    combinedDiagram.addRelationship(relationship);
                }
            }
            catch (error) {
                console.warn(`Error parsing file ${file.name}:`, error);
            }
        }
        return combinedDiagram;
    }
}
//# sourceMappingURL=ParserFactory.js.map