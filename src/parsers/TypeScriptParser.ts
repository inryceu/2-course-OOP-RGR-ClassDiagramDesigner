import { BaseParser } from './IParser.js';
import { ClassDiagram, ClassInfo, Field, Method, Parameter, Visibility, Relationship, RelationType } from '../models/ClassDiagram.js';

export class TypeScriptParser extends BaseParser {
  constructor() {
    super();
    this.supportedExtensions = ['ts', 'tsx', 'js', 'jsx'];
  }

  parse(sourceCode: string, fileName?: string): ClassDiagram {
    const diagram = new ClassDiagram();
    const cleanCode = this.removeComments(sourceCode, '//', '/*', '*/');
    this.parseClasses(cleanCode, diagram);
    this.parseInterfaces(cleanCode, diagram);
    this.parseRelationships(cleanCode, diagram);
    return diagram;
  }

  private parseClasses(code: string, diagram: ClassDiagram): void {
    const classPattern = /(export\s+)?(abstract\s+)?class\s+(\w+)(\s+extends\s+(\w+))?(\s+implements\s+([\w\s,]+))?\s*\{/g;

    let match;
    while ((match = classPattern.exec(code)) !== null) {
      const isAbstract = !!match[2];
      const className = match[3];
      const extendsClass = match[5];
      const implementsInterfaces = match[7];
      const classStartIndex = match.index + match[0].length;
      const classBody = this.extractBalancedBraces(code, classStartIndex);

      if (classBody === null) {
        console.warn(`Не вдалося знайти тіло класу ${className}`);
        continue;
      }

      const classInfo = new ClassInfo(className, false, isAbstract);
      this.parseMethods(classBody, classInfo);
      this.parseFields(classBody, classInfo);
      diagram.addClass(classInfo);

      if (extendsClass) {
        diagram.addRelationship(new Relationship(
          className,
          extendsClass,
          RelationType.INHERITANCE,
          undefined,
          'extends'
        ));
      }

      if (implementsInterfaces) {
        const interfaces = implementsInterfaces.split(',').map(i => i.trim());
        interfaces.forEach(interfaceName => {
          diagram.addRelationship(new Relationship(
            className,
            interfaceName,
            RelationType.IMPLEMENTATION,
            undefined,
            'implements'
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
    let inTemplate = false;
    let templateDepth = 0;

    while (i < code.length && braceCount > 0) {
      const char = code[i];
      const prevChar = i > 0 ? code[i - 1] : '';
      const nextChar = i < code.length - 1 ? code[i + 1] : '';

      if (!inString && !inTemplate && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        i++;
        continue;
      }

      if (inString) {
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
          stringChar = '';
        }
        i++;
        continue;
      }

      if (!inTemplate && char === '`') {
        inTemplate = true;
        i++;
        continue;
      }

      if (inTemplate) {
        if (char === '{' && prevChar === '$') {
          templateDepth++;
        } else if (char === '}' && templateDepth > 0) {
          templateDepth--;
        } else if (char === '`' && prevChar !== '\\' && templateDepth === 0) {
          inTemplate = false;
        }
        i++;
        continue;
      }

      if (char === '/' && nextChar === '/') {
        while (i < code.length && code[i] !== '\n') {
          i++;
        }
        continue;
      }

      if (char === '/' && nextChar === '*') {
        i += 2;
        while (i < code.length - 1 && !(code[i] === '*' && code[i + 1] === '/')) {
          i++;
        }
        i += 2;
        continue;
      }

      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
      }

      i++;
    }

    if (braceCount === 0) {
      return code.substring(startIndex, i - 1);
    }

    return null;
  }

  private parseInterfaces(code: string, diagram: ClassDiagram): void {
    const interfacePattern = /(export\s+)?interface\s+(\w+)(\s+extends\s+([\w\s,]+))?\s*\{/g;

    let match;
    while ((match = interfacePattern.exec(code)) !== null) {
      const interfaceName = match[2];
      const extendsInterfaces = match[4];
      const interfaceStartIndex = match.index + match[0].length;
      const interfaceBody = this.extractBalancedBraces(code, interfaceStartIndex);

      if (interfaceBody === null) {
        console.warn(`Не вдалося знайти тіло інтерфейсу ${interfaceName}`);
        continue;
      }

      const classInfo = new ClassInfo(interfaceName, true, false);
      this.parseInterfaceProperties(interfaceBody, classInfo);
      this.parseInterfaceMethods(interfaceBody, classInfo);
      diagram.addClass(classInfo);

      if (extendsInterfaces) {
        const interfaces = extendsInterfaces.split(',').map(i => i.trim());
        interfaces.forEach(parentInterface => {
          diagram.addRelationship(new Relationship(
            interfaceName,
            parentInterface,
            RelationType.INHERITANCE,
            undefined,
            'extends'
          ));
        });
      }
    }
  }

  private parseFields(classBody: string, classInfo: ClassInfo): void {
    const statements = this.getTopLevelStatements(classBody);
    const typedFieldRegex = /^(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(readonly)\s+)?(\w+)(\?)?\s*:\s*([^=;]+?)(?:\s*=\s*([^;]+))?;$/;
    const simpleFieldRegex = /^(?:(public|private|protected)\s+)?(?:(static)\s+)?(\w+)\s*=\s*([^;]+);$/;

    statements.forEach(statement => {
      const trimmed = statement.trim();

      if (trimmed.startsWith('constructor(')) {
        this.extractConstructorParams(trimmed, classInfo);
        return;
      }

      let match = typedFieldRegex.exec(trimmed);
      if (match) {
        const visibility = this.parseVisibility(match[1] || 'public');
        const isStatic = !!match[2];
        const isReadonly = !!match[3];
        const fieldName = match[4];
        const isOptional = !!match[5];
        const rawType = match[6];
        const defaultValue = match[7]?.trim();
        const fieldType = isOptional ? `${this.cleanString(rawType)}?` : this.cleanString(rawType);
        classInfo.addField(new Field(fieldName, visibility, fieldType, isStatic, isReadonly, defaultValue));
        return;
      }

      match = simpleFieldRegex.exec(trimmed);
      if (match) {
        const visibility = this.parseVisibility(match[1] || 'public');
        const isStatic = !!match[2];
        const fieldName = match[3];
        const defaultValue = match[4]?.trim();
        classInfo.addField(new Field(fieldName, visibility, 'any', isStatic, false, defaultValue));
      }
    });

    this.parseConstructorAssignments(classBody, classInfo);
  }

  private getTopLevelStatements(content: string): string[] {
    const statements: string[] = [];
    let current = '';
    let i = 0;
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    let templateDepth = 0;

    while (i < content.length) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';
      const nextChar = i < content.length - 1 ? content[i + 1] : '';

      if (!inString && !inTemplate && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        current += char;
        i++;
        continue;
      }

      if (inString) {
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
          stringChar = '';
        }
        current += char;
        i++;
        continue;
      }

      if (!inTemplate && char === '`') {
        inTemplate = true;
        current += char;
        i++;
        continue;
      }

      if (inTemplate) {
        if (char === '{' && prevChar === '$') {
          templateDepth++;
        } else if (char === '}' && templateDepth > 0) {
          templateDepth--;
        } else if (char === '`' && prevChar !== '\\' && templateDepth === 0) {
          inTemplate = false;
        }
        current += char;
        i++;
        continue;
      }

      if (char === '{') {
        if (depth === 0) {
          const trimmed = current.trim();
          if (trimmed) {
            statements.push(trimmed);
          }
          const nextIndex = this.skipBlock(content, i);
          i = nextIndex;
          current = '';
          continue;
        }
        depth++;
        current += char;
        i++;
        continue;
      }

      if (char === '}') {
        if (depth > 0) {
          depth--;
        }
        current += char;
        i++;
        continue;
      }

      if (char === ';' && depth === 0) {
        current += char;
        const trimmed = current.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        current = '';
        i++;
        continue;
      }

      if (char === '/' && nextChar === '/') {
        while (i < content.length && content[i] !== '\n') {
          i++;
        }
        continue;
      }

      if (char === '/' && nextChar === '*') {
        i += 2;
        while (i < content.length - 1 && !(content[i] === '*' && content[i + 1] === '/')) {
          i++;
        }
        i += 2;
        continue;
      }

      current += char;
      i++;
    }

    const trimmed = current.trim();
    if (trimmed) {
      statements.push(trimmed);
    }

    return statements;
  }

  private skipBlock(content: string, startIndex: number): number {
    let depth = 0;
    let i = startIndex;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    let templateDepth = 0;

    while (i < content.length) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';

      if (!inString && !inTemplate && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        i++;
        continue;
      }

      if (inString) {
        if (char === stringChar && prevChar !== '\\') {
          inString = false;
          stringChar = '';
        }
        i++;
        continue;
      }

      if (!inTemplate && char === '`') {
        inTemplate = true;
        i++;
        continue;
      }

      if (inTemplate) {
        if (char === '{' && prevChar === '$') {
          templateDepth++;
        } else if (char === '}' && templateDepth > 0) {
          templateDepth--;
        } else if (char === '`' && prevChar !== '\\' && templateDepth === 0) {
          inTemplate = false;
        }
        i++;
        continue;
      }

      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i + 1;
        }
      }

      i++;
    }

    return content.length;
  }

  private parseMethods(classBody: string, classInfo: ClassInfo): void {
    const statements = this.getTopLevelStatements(classBody);
    const methodRegex = /^(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(abstract)\s+)?(?:(async)\s+)?(?:(get|set)\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{;]+))?$/;

    statements.forEach(statement => {
      const trimmed = statement.trim();

      if (trimmed.startsWith('constructor(')) {
        this.addConstructor(trimmed, classInfo);
        return;
      }

      const match = methodRegex.exec(trimmed);
      if (!match) {
        return;
      }

      const visibility = this.parseVisibility(match[1] || 'public');
      const isStatic = !!match[2];
      const isAbstract = !!match[3];
      const accessor = match[5];
      const methodNameCore = match[6];
      const paramsStr = match[7];
      const returnTypeRaw = match[8];
      const methodName = accessor ? `${accessor} ${methodNameCore}` : methodNameCore;
      const returnType = returnTypeRaw ? this.cleanString(returnTypeRaw) : 'void';

      if (methodNameCore === 'constructor') {
        this.addConstructor(trimmed, classInfo);
        return;
      }

      if (['if', 'for', 'while', 'switch', 'catch'].includes(methodNameCore)) {
        return;
      }

      const parameters = this.parseParameters(paramsStr);
      classInfo.addMethod(new Method(methodName, visibility, returnType, parameters, isStatic, isAbstract));
    });
  }

  private addConstructor(statement: string, classInfo: ClassInfo): void {
    const constructorRegex = /^constructor\s*\(([^)]*)\)/;
    const match = constructorRegex.exec(statement);
    if (!match) {
      return;
    }
    const paramsStr = match[1];
    const parameters = this.parseParameters(paramsStr);
    const exists = classInfo.methods.some(m => m.name === 'constructor');
    if (!exists) {
      classInfo.addMethod(new Method('constructor', Visibility.PUBLIC, 'void', parameters));
    }
  }

  private extractConstructorParams(statement: string, classInfo: ClassInfo): void {
    const params = statement.substring(statement.indexOf('(') + 1, statement.lastIndexOf(')'));
    if (!params.trim()) {
      return;
    }

    const parts = params.split(',');
    parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) {
        return;
      }

      const paramMatch = /^(?:(public|private|protected)\s+)?(readonly\s+)?(\w+)(\?)?\s*:\s*([^,)]+)/.exec(trimmed);
      if (!paramMatch) {
        return;
      }

      const visibilityToken = paramMatch[1];
      const readonlyToken = paramMatch[2];
      const fieldName = paramMatch[3];
      const isOptional = !!paramMatch[4];
      const fieldTypeRaw = paramMatch[5];

      if (!visibilityToken && !readonlyToken) {
        return;
      }

      const visibility = visibilityToken ? this.parseVisibility(visibilityToken) : Visibility.PUBLIC;
      const isReadonly = !!readonlyToken;
      const fieldType = isOptional ? `${this.cleanString(fieldTypeRaw)}?` : this.cleanString(fieldTypeRaw);
      const exists = classInfo.fields.some(f => f.name === fieldName);
      if (!exists) {
        classInfo.addField(new Field(fieldName, visibility, fieldType, false, isReadonly));
      }
    });
  }

  private parseConstructorAssignments(classBody: string, classInfo: ClassInfo): void {
    const constructorBodyPattern = /constructor\s*\(([^)]*)\)\s*\{/g;
    let match;
    while ((match = constructorBodyPattern.exec(classBody)) !== null) {
      const bodyStart = match.index + match[0].length;
      const body = this.extractBalancedBraces(classBody, bodyStart);
      if (!body) {
        continue;
      }
      const assignmentRegex = /this\.(\w+)\s*=\s*([^;]+);/g;
      let assignmentMatch;
      while ((assignmentMatch = assignmentRegex.exec(body)) !== null) {
        const fieldName = assignmentMatch[1];
        const defaultValue = assignmentMatch[2]?.trim();
        const exists = classInfo.fields.some(f => f.name === fieldName);
        if (!exists) {
          classInfo.addField(new Field(fieldName, Visibility.PUBLIC, 'any', false, false, defaultValue));
        }
      }
    }
  }

  private parseJavaScriptParameters(paramsStr: string): Parameter[] {
    if (!paramsStr || paramsStr.trim() === '') {
      return [];
    }

    const parameters: Parameter[] = [];
    const params = paramsStr.split(',');

    for (const param of params) {
      const trimmed = param.trim();
      if (!trimmed) {
        continue;
      }
      const parts = trimmed.split('=');
      const paramName = parts[0].trim();
      const defaultValue = parts.length > 1 ? parts[1].trim() : undefined;
      parameters.push(new Parameter(paramName, 'any', defaultValue));
    }

    return parameters;
  }

  private parseInterfaceProperties(interfaceBody: string, classInfo: ClassInfo): void {
    const propRegex = /(\w+)(\?)?:\s*([^;]+);/g;

    let match;
    while ((match = propRegex.exec(interfaceBody)) !== null) {
      if (match[3].includes('=>') || match[3].includes('(')) {
        continue;
      }

      const propName = match[1];
      const isOptional = !!match[2];
      const propType = this.cleanString(match[3]);
      const type = isOptional ? `${propType}?` : propType;
      classInfo.addField(new Field(propName, Visibility.PUBLIC, type));
    }
  }

  private parseInterfaceMethods(interfaceBody: string, classInfo: ClassInfo): void {
    const methodRegex = /(\w+)\s*\(([^)]*)\)\s*:\s*([^;]+);/g;

    let match;
    while ((match = methodRegex.exec(interfaceBody)) !== null) {
      const methodName = match[1];
      const paramsStr = match[2];
      const returnType = this.cleanString(match[3]);
      const parameters = this.parseParameters(paramsStr);
      classInfo.addMethod(new Method(methodName, Visibility.PUBLIC, returnType, parameters));
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
      if (!trimmed) {
        continue;
      }
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
      } else {
        const jsParams = this.parseJavaScriptParameters(trimmed);
        jsParams.forEach(param => parameters.push(param));
      }
    }

    return parameters;
  }

  private parseVisibility(visibilityStr: string): Visibility {
    const lower = visibilityStr.toLowerCase();
    if (lower === 'private') {
      return Visibility.PRIVATE;
    }
    if (lower === 'protected') {
      return Visibility.PROTECTED;
    }
    return Visibility.PUBLIC;
  }

  private parseRelationships(code: string, diagram: ClassDiagram): void {
    const classes = diagram.getClasses();

    for (const classInfo of classes) {
      for (const field of classInfo.fields) {
        const fieldType = field.type.replace(/[\[\]?]/g, '').trim();

        if (diagram.hasClass(fieldType) && fieldType !== classInfo.name) {
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
