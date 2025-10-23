import { BaseParser } from './IParser.js';
import { ClassDiagram, ClassInfo, Field, Method, Parameter, Visibility, Relationship, RelationType } from '../models/ClassDiagram.js';

/**
 * Парсер для TypeScript та JavaScript
 */
export class TypeScriptParser extends BaseParser {
  constructor() {
    super();
    this.supportedExtensions = ['ts', 'tsx', 'js', 'jsx'];
  }

  parse(sourceCode: string, fileName?: string): ClassDiagram {
    const diagram = new ClassDiagram();
    
    // Видаляємо коментарі
    const cleanCode = this.removeComments(sourceCode, '//', '/*', '*/');
    
    // Шукаємо всі класи та інтерфейси
    this.parseClasses(cleanCode, diagram);
    this.parseInterfaces(cleanCode, diagram);
    
    // Шукаємо відношення між класами
    this.parseRelationships(cleanCode, diagram);
    
    return diagram;
  }

  private parseClasses(code: string, diagram: ClassDiagram): void {
    // Більш надійний підхід - знаходимо класи та витягуємо їх тіла
    const classPattern = /(export\s+)?(abstract\s+)?class\s+(\w+)(\s+extends\s+(\w+))?(\s+implements\s+([\w\s,]+))?\s*\{/g;
    
    let match;
    while ((match = classPattern.exec(code)) !== null) {
      const isAbstract = !!match[2];
      const className = match[3];
      const extendsClass = match[5];
      const implementsInterfaces = match[7];
      const classStartIndex = match.index + match[0].length;
      
      // Знаходимо відповідну закриваючу дужку
      const classBody = this.extractBalancedBraces(code, classStartIndex);
      
      if (classBody === null) {
        console.warn(`Не вдалося знайти тіло класу ${className}`);
        continue;
      }
      
      const classInfo = new ClassInfo(className, false, isAbstract);
      
      // Парсимо поля
      this.parseFields(classBody, classInfo);
      
      // Парсимо методи
      this.parseMethods(classBody, classInfo);
      
      diagram.addClass(classInfo);
      
      // Додаємо відношення наслідування
      if (extendsClass) {
        diagram.addRelationship(new Relationship(
          className,
          extendsClass,
          RelationType.INHERITANCE,
          undefined,
          'extends' // TypeScript/JavaScript модифікатор
        ));
      }
      
      // Додаємо відношення реалізації інтерфейсів
      if (implementsInterfaces) {
        const interfaces = implementsInterfaces.split(',').map(i => i.trim());
        interfaces.forEach(interfaceName => {
          diagram.addRelationship(new Relationship(
            className,
            interfaceName,
            RelationType.IMPLEMENTATION,
            undefined,
            'implements' // TypeScript/JavaScript модифікатор
          ));
        });
      }
    }
  }
  
  private extractBalancedBraces(code: string, startIndex: number): string | null {
    let braceCount = 1;
    let i = startIndex;
    let inString = false;
    let stringChar = '';
    
    while (i < code.length && braceCount > 0) {
      const char = code[i];
      const prevChar = i > 0 ? code[i - 1] : '';
      
      // Обробка рядків
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }
      
      // Рахуємо дужки тільки поза рядками
      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
        }
      }
      
      i++;
    }
    
    if (braceCount === 0) {
      return code.substring(startIndex, i - 1);
    }
    
    return null;
  }

  private parseInterfaces(code: string, diagram: ClassDiagram): void {
    // Більш надійний підхід для інтерфейсів
    const interfacePattern = /(export\s+)?interface\s+(\w+)(\s+extends\s+([\w\s,]+))?\s*\{/g;
    
    let match;
    while ((match = interfacePattern.exec(code)) !== null) {
      const interfaceName = match[2];
      const extendsInterfaces = match[4];
      const interfaceStartIndex = match.index + match[0].length;
      
      // Знаходимо відповідну закриваючу дужку
      const interfaceBody = this.extractBalancedBraces(code, interfaceStartIndex);
      
      if (interfaceBody === null) {
        console.warn(`Не вдалося знайти тіло інтерфейсу ${interfaceName}`);
        continue;
      }
      
      const classInfo = new ClassInfo(interfaceName, true, false);
      
      // Парсимо властивості інтерфейсу
      this.parseInterfaceProperties(interfaceBody, classInfo);
      
      // Парсимо методи інтерфейсу
      this.parseInterfaceMethods(interfaceBody, classInfo);
      
      diagram.addClass(classInfo);
      
      // Додаємо відношення наслідування інтерфейсів
      if (extendsInterfaces) {
        const interfaces = extendsInterfaces.split(',').map(i => i.trim());
        interfaces.forEach(parentInterface => {
          diagram.addRelationship(new Relationship(
            interfaceName,
            parentInterface,
            RelationType.INHERITANCE,
            undefined,
            'extends' // Інтерфейси також extends
          ));
        });
      }
    }
  }

  private parseFields(classBody: string, classInfo: ClassInfo): void {
    // 1. TypeScript-style fields: field: type
    const fieldRegex = /(public|private|protected)?\s*(static)?\s*(readonly)?\s*(\w+)(\?)?:\s*([^=;]+)(?:\s*=\s*([^;]+))?;/g;
    
    let match;
    while ((match = fieldRegex.exec(classBody)) !== null) {
      const visibilityStr = match[1] || 'public';
      const isStatic = !!match[2];
      const isReadonly = !!match[3];
      const fieldName = match[4];
      const isOptional = !!match[5];
      const fieldType = this.cleanString(match[6]);
      const defaultValue = match[7]?.trim();
      
      const visibility = this.parseVisibility(visibilityStr);
      const type = isOptional ? `${fieldType}?` : fieldType;
      
      const field = new Field(fieldName, visibility, type, isStatic, isReadonly, defaultValue);
      classInfo.addField(field);
    }
    
    // 2. JavaScript-style fields in constructor: this.field = value
    const jsFieldRegex = /this\.(\w+)\s*=\s*([^;]+);/g;
    while ((match = jsFieldRegex.exec(classBody)) !== null) {
      const fieldName = match[1];
      const defaultValue = match[2]?.trim();
      
      // Перевіряємо, чи поле ще не додане (може бути з TypeScript синтаксису)
      const exists = classInfo.fields.some(f => f.name === fieldName);
      if (!exists) {
        const field = new Field(fieldName, Visibility.PUBLIC, 'any', false, false, defaultValue);
        classInfo.addField(field);
      }
    }
    
    // 3. Constructor parameters with modifiers (TypeScript) - become fields
    const constructorRegex = /constructor\s*\(([^)]*)\)/g;
    let constructorMatch;
    while ((constructorMatch = constructorRegex.exec(classBody)) !== null) {
      const paramsStr = constructorMatch[1];
      
      // Шукаємо параметри з модифікаторами: public name: type
      const paramWithModifierRegex = /(public|private|protected|readonly)\s+(\w+):\s*([^,)]+)/g;
      let paramMatch;
      while ((paramMatch = paramWithModifierRegex.exec(paramsStr)) !== null) {
        const visibilityStr = paramMatch[1];
        const fieldName = paramMatch[2];
        const fieldType = this.cleanString(paramMatch[3]);
        
        const visibility = this.parseVisibility(visibilityStr);
        const isReadonly = visibilityStr === 'readonly';
        
        // Перевіряємо, чи поле ще не додане
        const exists = classInfo.fields.some(f => f.name === fieldName);
        if (!exists) {
          const field = new Field(fieldName, visibility, fieldType, false, isReadonly);
          classInfo.addField(field);
        }
      }
    }
  }

  private parseMethods(classBody: string, classInfo: ClassInfo): void {
    const processedMethods = new Set<string>();
    
    // 1. TypeScript-style methods with return type: method(): type
    const tsMethodRegex = /(public|private|protected)?\s*(static)?\s*(abstract)?\s*(async)?\s*(\w+)\s*\(([^)]*)\)\s*:\s*([^{;]+)/g;
    
    let match;
    while ((match = tsMethodRegex.exec(classBody)) !== null) {
      const visibilityStr = match[1] || 'public';
      const isStatic = !!match[2];
      const isAbstract = !!match[3];
      const methodName = match[5];
      const paramsStr = match[6];
      const returnType = this.cleanString(match[7]);
      
      const visibility = this.parseVisibility(visibilityStr);
      const parameters = this.parseParameters(paramsStr);
      
      const method = new Method(methodName, visibility, returnType, parameters, isStatic, isAbstract);
      classInfo.addMethod(method);
      processedMethods.add(methodName);
    }
    
    // 2. JavaScript-style methods without return type: method() { or method(params) {
    const jsMethodRegex = /(static)?\s*(\w+)\s*\(([^)]*)\)\s*\{/g;
    while ((match = jsMethodRegex.exec(classBody)) !== null) {
      const isStatic = !!match[1];
      const methodName = match[2];
      const paramsStr = match[3];
      
      // Пропускаємо конструктор (обробляється окремо) та вже додані методи
      if (methodName === 'constructor' || processedMethods.has(methodName)) {
        continue;
      }
      
      // Пропускаємо ключові слова
      if (['if', 'for', 'while', 'switch', 'catch'].includes(methodName)) {
        continue;
      }
      
      const parameters = this.parseJavaScriptParameters(paramsStr);
      const method = new Method(methodName, Visibility.PUBLIC, 'void', parameters, isStatic, false);
      classInfo.addMethod(method);
      processedMethods.add(methodName);
    }
    
    // 3. Constructor
    const constructorRegex = /constructor\s*\(([^)]*)\)/g;
    let constructorMatch;
    while ((constructorMatch = constructorRegex.exec(classBody)) !== null) {
      const paramsStr = constructorMatch[1];
      const parameters = this.parseParameters(paramsStr);
      
      // Перевіряємо, чи конструктор ще не доданий
      const exists = classInfo.methods.some(m => m.name === 'constructor');
      if (!exists) {
        const constructor = new Method('constructor', Visibility.PUBLIC, 'void', parameters);
        classInfo.addMethod(constructor);
      }
    }
  }
  
  /**
   * Парсить параметри JavaScript (без типів)
   */
  private parseJavaScriptParameters(paramsStr: string): Parameter[] {
    if (!paramsStr || paramsStr.trim() === '') {
      return [];
    }
    
    const parameters: Parameter[] = [];
    const params = paramsStr.split(',');
    
    for (const param of params) {
      const trimmed = param.trim();
      if (trimmed) {
        // Може бути з default value: param = defaultValue
        const parts = trimmed.split('=');
        const paramName = parts[0].trim();
        const defaultValue = parts.length > 1 ? parts[1].trim() : undefined;
        
        parameters.push(new Parameter(paramName, 'any', defaultValue));
      }
    }
    
    return parameters;
  }

  private parseInterfaceProperties(interfaceBody: string, classInfo: ClassInfo): void {
    // Регулярний вираз для властивостей інтерфейсу
    const propRegex = /(\w+)(\?)?:\s*([^;]+);/g;
    
    let match;
    while ((match = propRegex.exec(interfaceBody)) !== null) {
      // Перевіряємо, чи це не метод
      if (match[3].includes('=>') || match[3].includes('(')) {
        continue;
      }
      
      const propName = match[1];
      const isOptional = !!match[2];
      const propType = this.cleanString(match[3]);
      
      const type = isOptional ? `${propType}?` : propType;
      const field = new Field(propName, Visibility.PUBLIC, type);
      classInfo.addField(field);
    }
  }

  private parseInterfaceMethods(interfaceBody: string, classInfo: ClassInfo): void {
    // Регулярний вираз для методів інтерфейсу
    const methodRegex = /(\w+)\s*\(([^)]*)\)\s*:\s*([^;]+);/g;
    
    let match;
    while ((match = methodRegex.exec(interfaceBody)) !== null) {
      const methodName = match[1];
      const paramsStr = match[2];
      const returnType = this.cleanString(match[3]);
      
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
      
      // Парсимо параметр: name: type = defaultValue
      const paramMatch = /(\w+)(\?)?:\s*([^=]+)(?:\s*=\s*(.+))?/.exec(trimmed);
      if (paramMatch) {
        const paramName = paramMatch[1];
        const isOptional = !!paramMatch[2];
        let paramType = this.cleanString(paramMatch[3]);
        const defaultValue = paramMatch[4]?.trim();
        
        if (isOptional) {
          paramType += '?';
        }
        
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
      case 'public':
      default:
        return Visibility.PUBLIC;
    }
  }

  private parseRelationships(code: string, diagram: ClassDiagram): void {
    // Шукаємо композицію та агрегацію через типи полів
    const classes = diagram.getClasses();
    
    for (const classInfo of classes) {
      for (const field of classInfo.fields) {
        // Перевіряємо, чи тип поля є іншим класом з діаграми
        const fieldType = field.type.replace(/[\[\]?]/g, '').trim();
        
        if (diagram.hasClass(fieldType) && fieldType !== classInfo.name) {
          // Якщо поле є масивом, це агрегація, інакше - композиція
          const isArray = field.type.includes('[') || field.type.toLowerCase().includes('array');
          const relationType = isArray ? RelationType.AGGREGATION : RelationType.COMPOSITION;
          
          diagram.addRelationship(new Relationship(
            classInfo.name,
            fieldType,
            relationType,
            field.name
          ));
        }
      }
    }
  }
}

