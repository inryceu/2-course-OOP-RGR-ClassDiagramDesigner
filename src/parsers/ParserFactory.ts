import { IParser } from './IParser.js';
import { TypeScriptParser } from './TypeScriptParser.js';
import { CppParser } from './CppParser.js';
import { CSharpParser } from './CSharpParser.js';
import { ClassDiagram } from '../models/ClassDiagram.js';

export enum Language {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  CPP = 'cpp',
  CSHARP = 'csharp',
  AUTO = 'auto'
}

export class ParserFactory {
  private parsers: Map<Language, IParser>;

  constructor() {
    this.parsers = new Map();
    this.initializeParsers();
  }

  private initializeParsers(): void {
    const tsParser = new TypeScriptParser();
    this.parsers.set(Language.TYPESCRIPT, tsParser);
    this.parsers.set(Language.JAVASCRIPT, tsParser);
    this.parsers.set(Language.CPP, new CppParser());
    this.parsers.set(Language.CSHARP, new CSharpParser());
  }

  getParser(language: Language): IParser | null {
    if (language === Language.AUTO) {
      return null;
    }
    return this.parsers.get(language) || null;
  }

  detectLanguage(fileName: string): Language {
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

  parseFile(fileName: string, sourceCode: string, language: Language = Language.AUTO): ClassDiagram {
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

  parseMultipleFiles(files: Array<{ name: string; content: string }>, language: Language = Language.AUTO): ClassDiagram {
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
      } catch (error) {
        console.warn(`Error parsing file ${file.name}:`, error);
      }
    }

    return combinedDiagram;
  }
}
