import { IParser } from './IParser.js';
import { TypeScriptParser } from './TypeScriptParser.js';
import { CppParser } from './CppParser.js';
import { CSharpParser } from './CSharpParser.js';
import { ClassDiagram } from '../models/ClassDiagram.js';

/**
 * Перелік підтримуваних мов програмування
 */
export enum Language {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  CPP = 'cpp',
  CSHARP = 'csharp',
  AUTO = 'auto'
}

/**
 * Фабрика для створення парсерів
 */
export class ParserFactory {
  private parsers: Map<Language, IParser>;

  constructor() {
    this.parsers = new Map();
    this.initializeParsers();
  }

  private initializeParsers(): void {
    const tsParser = new TypeScriptParser();
    this.parsers.set(Language.TYPESCRIPT, tsParser);
    this.parsers.set(Language.JAVASCRIPT, tsParser); // JS і TS використовують один парсер
    this.parsers.set(Language.CPP, new CppParser());
    this.parsers.set(Language.CSHARP, new CSharpParser());
  }

  /**
   * Отримує парсер для вказаної мови
   */
  getParser(language: Language): IParser | null {
    if (language === Language.AUTO) {
      return null; // Для автовизначення використовується інша логіка
    }
    return this.parsers.get(language) || null;
  }

  /**
   * Автоматично визначає мову програмування за розширенням файлу
   */
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
        throw new Error(`Непідтримуване розширення файлу: ${extension}`);
    }
  }

  /**
   * Парсить файл, автоматично визначаючи мову
   */
  parseFile(fileName: string, sourceCode: string, language: Language = Language.AUTO): ClassDiagram {
    let targetLanguage = language;
    
    if (language === Language.AUTO) {
      targetLanguage = this.detectLanguage(fileName);
    }
    
    const parser = this.getParser(targetLanguage);
    if (!parser) {
      throw new Error(`Парсер для мови ${targetLanguage} не знайдено`);
    }
    
    return parser.parse(sourceCode, fileName);
  }

  /**
   * Парсить декілька файлів та об'єднує їх у одну діаграму
   */
  parseMultipleFiles(files: Array<{ name: string; content: string }>, language: Language = Language.AUTO): ClassDiagram {
    const combinedDiagram = new ClassDiagram();
    
    for (const file of files) {
      try {
        const diagram = this.parseFile(file.name, file.content, language);
        
        // Додаємо класи з поточного файлу
        const classes = diagram.getClasses();
        for (const classInfo of classes) {
          combinedDiagram.addClass(classInfo);
        }
        
        // Додаємо відношення з поточного файлу
        const relationships = diagram.getRelationships();
        for (const relationship of relationships) {
          combinedDiagram.addRelationship(relationship);
        }
      } catch (error) {
        console.warn(`Помилка при парсингу файлу ${file.name}:`, error);
      }
    }
    
    return combinedDiagram;
  }
}

