import { BaseParser } from './IParser.js';
import { ClassDiagram, ClassInfo, Field, Method, Parameter, Visibility, Relationship, RelationType } from '../models/ClassDiagram.js';

/**
 * Парсер для C#
 */
export class CSharpParser extends BaseParser {
  constructor() {
    super();
    this.supportedExtensions = ['cs'];
  }

  parse(sourceCode: string, fileName?: string): ClassDiagram {
    const diagram = new ClassDiagram();
    
    // Видаляємо коментарі
    const cleanCode = this.removeComments(sourceCode, '//', '/*', '*/');
    
    // Шукаємо всі класи та інтерфейси
    this.parseClasses(cleanCode, diagram);
    this.parseInterfaces(cleanCode, diagram);
    
    return diagram;
  }

  private parseClasses(code: string, diagram: ClassDiagram): void {
    // Регулярний вираз для пошуку класів
    const classRegex = /(public|internal|protected|private)?\s*(abstract|sealed|static)?\s*class\s+(\w+)(?:\s*:\s*([\w\s,]+))?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    
    let match;
    while ((match = classRegex.exec(code)) !== null) {
      const modifier = match[2];
      const className = match[3];
      const inheritanceStr = match[4];
      const classBody = match[5];
      
      const isAbstract = modifier === 'abstract';
      const classInfo = new ClassInfo(className, false, isAbstract);
      
      // Парсимо поля
      this.parseFields(classBody, classInfo);
      
      // Парсимо властивості (properties)
      this.parseProperties(classBody, classInfo);
      
      // Парсимо методи
      this.parseMethods(classBody, classInfo);
      
      diagram.addClass(classInfo);
      
      // Парсимо наслідування та інтерфейси
      if (inheritanceStr) {
        this.parseInheritance(className, inheritanceStr, diagram);
      }
    }
  }

  private parseInterfaces(code: string, diagram: ClassDiagram): void {
    // Регулярний вираз для пошуку інтерфейсів
    const interfaceRegex = /(public|internal)?\s*interface\s+(\w+)(?:\s*:\s*([\w\s,]+))?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    
    let match;
    while ((match = interfaceRegex.exec(code)) !== null) {
      const interfaceName = match[2];
      const inheritanceStr = match[3];
      const interfaceBody = match[4];
      
      const classInfo = new ClassInfo(interfaceName, true, false);
      
      // Парсимо властивості інтерфейсу
      this.parseInterfaceProperties(interfaceBody, classInfo);
      
      // Парсимо методи інтерфейсу
      this.parseInterfaceMethods(interfaceBody, classInfo);
      
      diagram.addClass(classInfo);
      
      // Парсимо наслідування інтерфейсів
      if (inheritanceStr) {
        const interfaces = inheritanceStr.split(',').map(i => i.trim());
        interfaces.forEach(parentInterface => {
          diagram.addRelationship(new Relationship(
            interfaceName,
            parentInterface,
            RelationType.INHERITANCE
          ));
        });
      }
    }
  }

  private parseFields(classBody: string, classInfo: ClassInfo): void {
    // Регулярний вираз для полів класу
    const fieldRegex = /(public|private|protected|internal)?\s*(static|readonly|const)?\s*(readonly|const)?\s*([\w<>\[\]]+)\s+(\w+)(?:\s*=\s*([^;]+))?;/g;
    
    let match;
    while ((match = fieldRegex.exec(classBody)) !== null) {
      // Перевіряємо, що це не метод
      if (match[0].includes('(') && match[0].includes(')')) continue;
      
      const visibilityStr = match[1] || 'private';
      const modifier1 = match[2] || '';
      const modifier2 = match[3] || '';
      const fieldType = match[4];
      const fieldName = match[5];
      const defaultValue = match[6]?.trim();
      
      const isStatic = modifier1 === 'static' || modifier2 === 'static';
      const isReadonly = modifier1 === 'readonly' || modifier2 === 'readonly' || 
                        modifier1 === 'const' || modifier2 === 'const';
      
      const visibility = this.parseVisibility(visibilityStr);
      
      const field = new Field(fieldName, visibility, fieldType, isStatic, isReadonly, defaultValue);
      classInfo.addField(field);
    }
  }

  private parseProperties(classBody: string, classInfo: ClassInfo): void {
    // Регулярний вираз для властивостей (properties) - більш гнучкий
    // Формати: 
    // public int Value { get; set; }
    // public int Value { get; }
    // public int Value { get; set; } = 10;
    // public int Value { get; private set; }
    const propertyRegex = /(public|private|protected|internal)?\s*(static)?\s*(virtual|override|abstract|readonly)?\s*([\w<>\[\]]+)\s+(\w+)\s*\{[^}]*\}/g;
    
    let match;
    while ((match = propertyRegex.exec(classBody)) !== null) {
      const fullMatch = match[0];
      
      // Перевіряємо, чи це справді property (має get або set)
      if (!fullMatch.includes('get') && !fullMatch.includes('set')) {
        continue;
      }
      
      const visibilityStr = match[1] || 'private';
      const isStatic = !!match[2];
      const modifier = match[3];
      const propertyType = match[4];
      const propertyName = match[5];
      
      const visibility = this.parseVisibility(visibilityStr);
      const isReadonly = modifier === 'readonly' || (fullMatch.includes('{ get; }') && !fullMatch.includes('set'));
      
      // Властивості в C# можна представити як поля з getter/setter
      const field = new Field(propertyName, visibility, propertyType, isStatic, isReadonly);
      classInfo.addField(field);
    }
  }

  private parseMethods(classBody: string, classInfo: ClassInfo): void {
    const processedMethods = new Set<string>();
    
    // Регулярний вираз для методів з тілом: method() { } або method();
    const methodRegex = /(public|private|protected|internal)?\s*(static)?\s*(virtual|override|abstract|async)?\s*([\w<>\[\]]+)\s+(\w+)\s*\(([^)]*)\)\s*[{;]/g;
    
    let match;
    while ((match = methodRegex.exec(classBody)) !== null) {
      const visibilityStr = match[1] || 'private';
      const isStatic = !!match[2];
      const modifier = match[3];
      const returnType = match[4];
      const methodName = match[5];
      const paramsStr = match[6];
      
      // Пропускаємо властивості (get, set) та ключові слова
      if (methodName === 'get' || methodName === 'set' || 
          methodName === 'if' || methodName === 'for' || methodName === 'while') {
        continue;
      }
      
      // Пропускаємо конструктори (обробляються окремо)
      if (methodName === classInfo.name) {
        continue;
      }
      
      const visibility = this.parseVisibility(visibilityStr);
      const parameters = this.parseParameters(paramsStr);
      const isAbstract = modifier === 'abstract';
      
      const method = new Method(methodName, visibility, returnType, parameters, isStatic, isAbstract);
      classInfo.addMethod(method);
      processedMethods.add(methodName);
    }
    
    // Окремо шукаємо конструктори
    const escapedClassName = classInfo.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const constructorRegex = new RegExp(`(public|private|protected|internal)?\\s*${escapedClassName}\\s*\\(([^)]*)\\)`, 'g');
    let constructorMatch;
    while ((constructorMatch = constructorRegex.exec(classBody)) !== null) {
      const visibilityStr = constructorMatch[1] || 'public';
      const paramsStr = constructorMatch[2];
      
      const visibility = this.parseVisibility(visibilityStr);
      const parameters = this.parseParameters(paramsStr);
      
      // Перевіряємо, чи конструктор ще не доданий
      const exists = classInfo.methods.some(m => m.name === classInfo.name);
      if (!exists) {
        const constructor = new Method(classInfo.name, visibility, '', parameters);
        classInfo.addMethod(constructor);
      }
    }
  }

  private parseInterfaceProperties(interfaceBody: string, classInfo: ClassInfo): void {
    // Регулярний вираз для властивостей інтерфейсу
    const propertyRegex = /([\w<>\[\]]+)\s+(\w+)\s*\{\s*get;?\s*(?:set;?)?\s*\}/g;
    
    let match;
    while ((match = propertyRegex.exec(interfaceBody)) !== null) {
      const propertyType = match[1];
      const propertyName = match[2];
      
      const field = new Field(propertyName, Visibility.PUBLIC, propertyType);
      classInfo.addField(field);
    }
  }

  private parseInterfaceMethods(interfaceBody: string, classInfo: ClassInfo): void {
    // Регулярний вираз для методів інтерфейсу
    const methodRegex = /([\w<>\[\]]+)\s+(\w+)\s*\(([^)]*)\)\s*;/g;
    
    let match;
    while ((match = methodRegex.exec(interfaceBody)) !== null) {
      const returnType = match[1];
      const methodName = match[2];
      const paramsStr = match[3];
      
      // Пропускаємо властивості
      if (methodName === 'get' || methodName === 'set') continue;
      
      const parameters = this.parseParameters(paramsStr);
      const method = new Method(methodName, Visibility.PUBLIC, returnType, parameters);
      classInfo.addMethod(method);
    }
  }

  private parseParameters(paramsStr: string): Parameter[] {
    if (!paramsStr.trim()) {
      return [];
    }
    
    const parameters: Parameter[] = [];
    const paramParts = paramsStr.split(',');
    
    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      // Парсимо параметр: [modifier] type name [= defaultValue]
      const paramMatch = /(ref|out|in|params)?\s*([\w<>\[\]]+)\s+(\w+)(?:\s*=\s*(.+))?/.exec(trimmed);
      if (paramMatch) {
        const modifier = paramMatch[1];
        const paramType = modifier ? `${modifier} ${paramMatch[2]}` : paramMatch[2];
        const paramName = paramMatch[3];
        const defaultValue = paramMatch[4]?.trim();
        
        parameters.push(new Parameter(paramName, paramType, defaultValue));
      }
    }
    
    return parameters;
  }

  private parseVisibility(visibilityStr: string): Visibility {
    switch (visibilityStr.toLowerCase()) {
      case 'private':
        return Visibility.PRIVATE;
      case 'protected':
        return Visibility.PROTECTED;
      case 'internal':
        return Visibility.PACKAGE;
      case 'public':
      default:
        return Visibility.PUBLIC;
    }
  }

  private parseInheritance(className: string, inheritanceStr: string, diagram: ClassDiagram): void {
    const parts = inheritanceStr.split(',').map(p => p.trim());
    
    for (const part of parts) {
      // Перший елемент після ':' може бути базовим класом або інтерфейсом
      // В C# інтерфейси зазвичай починаються з 'I'
      const isInterface = part.startsWith('I') && part.length > 1 && part[1] === part[1].toUpperCase();
      const relationType = isInterface ? RelationType.IMPLEMENTATION : RelationType.INHERITANCE;
      const modifier = isInterface ? 'implements' : 'extends'; // C# синтаксис подібний
      
      diagram.addRelationship(new Relationship(
        className,
        part,
        relationType,
        undefined,
        modifier
      ));
    }
  }
}

