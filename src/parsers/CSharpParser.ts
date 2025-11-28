import { BaseParser } from './IParser.js';
import { ClassDiagram, ClassInfo, Field, Method, Parameter, Visibility, Relationship, RelationType } from '../models/ClassDiagram.js';
import { cleanType } from '../utils/stringUtils.js';
import {
  parseVisibility,
  parseCSharpParameters,
  addConstructorToClass,
  filterControlFlowKeywords
} from '../utils/parserHelpers.js';
import { getTopLevelStatements, skipBlock } from '../utils/parsingUtils.js';

export class CSharpParser extends BaseParser {
  constructor() {
    super();
    this.supportedExtensions = ['cs'];
  }

  parse(sourceCode: string, fileName?: string): ClassDiagram {
    const diagram = new ClassDiagram();
    const cleanCode = this.removeComments(sourceCode, '//', '/*', '*/');
    this.parseClasses(cleanCode, diagram);
    this.parseInterfaces(cleanCode, diagram);
    return diagram;
  }

  private parseClasses(code: string, diagram: ClassDiagram): void {
    const classPattern = /(public|internal|protected|private)?\s*(abstract|sealed|static)?\s*class\s+(\w+)(?:\s*:\s*([^{]+))?\s*\{/g;

    let match;
    while ((match = classPattern.exec(code)) !== null) {
      const modifier = match[2];
      const className = match[3];
      const inheritanceStr = match[4];
      const bodyStart = match.index + match[0].length;
      const classBody = this.extractBalancedBraces(code, bodyStart);

      if (classBody === null) {
        continue;
      }

      const classInfo = new ClassInfo(className, false, modifier === 'abstract');
      this.parseFields(classBody, classInfo);
      this.parseProperties(classBody, classInfo);
      this.parseMethods(classBody, classInfo);
      diagram.addClass(classInfo);

      if (inheritanceStr) {
        this.parseInheritance(className, inheritanceStr, diagram);
      }
    }
  }

  private parseInterfaces(code: string, diagram: ClassDiagram): void {
    const interfacePattern = /(public|internal)?\s*interface\s+(\w+)(?:\s*:\s*([^{]+))?\s*\{/g;

    let match;
    while ((match = interfacePattern.exec(code)) !== null) {
      const interfaceName = match[2];
      const inheritanceStr = match[3];
      const bodyStart = match.index + match[0].length;
      const interfaceBody = this.extractBalancedBraces(code, bodyStart);

      if (interfaceBody === null) {
        continue;
      }

      const classInfo = new ClassInfo(interfaceName, true, false);
      this.parseInterfaceProperties(interfaceBody, classInfo);
      this.parseInterfaceMethods(interfaceBody, classInfo);
      diagram.addClass(classInfo);

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

  private extractBalancedBraces(code: string, startIndex: number): string | null {
    let braceCount = 1;
    let i = startIndex;
    let inString = false;
    let stringChar = '';
    let inVerbatimString = false;

    while (i < code.length && braceCount > 0) {
      const char = code[i];
      const nextChar = i < code.length - 1 ? code[i + 1] : '';

      if (!inString && !inVerbatimString && char === '@' && nextChar === '"') {
        inVerbatimString = true;
        i += 2;
        continue;
      }

      if (inVerbatimString) {
        if (char === '"' && nextChar === '"') {
          i += 2;
          continue;
        }
        if (char === '"') {
          inVerbatimString = false;
        }
        i++;
        continue;
      }

      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        i++;
        continue;
      }

      if (inString) {
        if (char === stringChar && code[i - 1] !== '\\') {
          inString = false;
          stringChar = '';
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

  private parseFields(classBody: string, classInfo: ClassInfo): void {
    const statements = getTopLevelStatements(classBody);
    const fieldRegex = /^(?:(public|private|protected|internal)\s+)?((?:static|readonly|const)\s+)*([\w<>\[\],\s]+?)\s+(\w+)(?:\s*=\s*([^;]+))?;$/;

    statements.forEach(statement => {
      const trimmed = statement.trim();
      if (!trimmed.endsWith(';')) {
        return;
      }
      if (trimmed.includes('(')) {
        return;
      }

      const match = fieldRegex.exec(trimmed);
      if (!match) {
        return;
      }

      const visibility = parseVisibility(match[1] || 'private', Visibility.PRIVATE);
      const typeRaw = match[3];
      const fieldName = match[4];
      const defaultValue = match[5]?.trim();
      const isStatic = /\bstatic\b/.test(trimmed);
      const isReadonly = /\breadonly\b/.test(trimmed) || /\bconst\b/.test(trimmed);
      const fieldType = cleanType(typeRaw, ['static', 'readonly', 'const']);

      classInfo.addField(new Field(fieldName, visibility, fieldType, isStatic, isReadonly, defaultValue));
    });
  }

  private parseProperties(classBody: string, classInfo: ClassInfo): void {
    const propertyPattern = /(public|private|protected|internal)?\s*(?:static|virtual|override|abstract|readonly|sealed)?\s*([\w<>\[\],\s]+?)\s+(\w+)\s*\{/g;

    let match;
    while ((match = propertyPattern.exec(classBody)) !== null) {
      const header = match[0];
      const bodyStart = match.index + match[0].length;
      const body = this.extractBalancedBraces(classBody, bodyStart);
      if (body === null) {
        continue;
      }

      if (!body.includes('get') && !body.includes('set')) {
        continue;
      }

      const visibility = parseVisibility(match[1] || 'private', Visibility.PRIVATE);
      const propertyType = cleanType(match[2]);
      const propertyName = match[3];
      const isStatic = /\bstatic\b/.test(header);
      const bodyContent = body.trim();
      const hasSetter = /set\s*;/.test(bodyContent);
      const isReadonly = !hasSetter;

      classInfo.addField(new Field(propertyName, visibility, propertyType, isStatic, isReadonly));
    }
  }

  private parseMethods(classBody: string, classInfo: ClassInfo): void {
    const statements = getTopLevelStatements(classBody);
    const methodRegex = /^((?:public|private|protected|internal)\s+)?((?:static|virtual|override|abstract|async|sealed|extern|partial)\s+)*([\w<>\[\],\s]+?)\s+(\w+)\s*\(([^)]*)\)\s*(?:;)?$/;
    const constructorRegex = new RegExp(`^((?:public|private|protected|internal)\\s+)?${this.escapeRegex(classInfo.name)}\\s*\\(([^)]*)\\)`);
    const processed = new Set<string>();

    statements.forEach(statement => {
      const trimmed = statement.trim();
      const constructorMatch = constructorRegex.exec(trimmed);
      if (constructorMatch) {
        const visibilityStr = constructorMatch[1] ? constructorMatch[1].trim() : 'public';
        const visibility = parseVisibility(visibilityStr);
        addConstructorToClass(constructorMatch[2], visibility, classInfo, parseCSharpParameters);
        return;
      }

      const destructorRegex = new RegExp(`^~${this.escapeRegex(classInfo.name)}\\s*\\(([^)]*)\\)`);
      const destructorMatch = destructorRegex.exec(trimmed);
      if (destructorMatch) {
        const parameters = parseCSharpParameters(destructorMatch[1] || '');
        classInfo.addMethod(new Method(`~${classInfo.name}`, Visibility.PUBLIC, '', parameters));
        return;
      }

      const match = methodRegex.exec(trimmed);
      if (!match) {
        return;
      }

      const visibility = parseVisibility((match[1] || 'private').trim(), Visibility.PRIVATE);
      const returnTypeRaw = match[3];
      const methodName = match[4];
      const paramsStr = match[5];
      const isStatic = /\bstatic\b/.test(trimmed);
      const isAbstract = /\babstract\b/.test(trimmed);
      const returnType = cleanType(returnTypeRaw, ['static', 'virtual', 'override', 'abstract', 'async', 'sealed', 'extern', 'partial']);

      if (filterControlFlowKeywords(methodName)) {
        return;
      }

      if (processed.has(methodName)) {
        return;
      }

      const parameters = parseCSharpParameters(paramsStr);
      classInfo.addMethod(new Method(methodName, visibility, returnType, parameters, isStatic, isAbstract));
      processed.add(methodName);
    });
  }

  private parseInterfaceProperties(interfaceBody: string, classInfo: ClassInfo): void {
    const propertyRegex = /([\w<>\[\],\s]+?)\s+(\w+)\s*\{\s*get;?\s*(?:set;?)?\s*\}/g;

    let match;
    while ((match = propertyRegex.exec(interfaceBody)) !== null) {
      const propertyType = cleanType(match[1]);
      const propertyName = match[2];
      classInfo.addField(new Field(propertyName, Visibility.PUBLIC, propertyType));
    }
  }

  private parseInterfaceMethods(interfaceBody: string, classInfo: ClassInfo): void {
    const methodRegex = /([\w<>\[\],\s]+?)\s+(\w+)\s*\(([^)]*)\)\s*;/g;

    let match;
    while ((match = methodRegex.exec(interfaceBody)) !== null) {
      const returnType = cleanType(match[1]);
      const methodName = match[2];
      const paramsStr = match[3];

      if (filterControlFlowKeywords(methodName)) {
        continue;
      }

      const parameters = parseCSharpParameters(paramsStr);
      classInfo.addMethod(new Method(methodName, Visibility.PUBLIC, returnType, parameters));
    }
  }

  private parseInheritance(className: string, inheritanceStr: string, diagram: ClassDiagram): void {
    const parts = inheritanceStr.split(',').map(p => p.trim()).filter(Boolean);

    for (const part of parts) {
      const isInterface = part.startsWith('I') && part.length > 1 && part[1] === part[1].toUpperCase();
      const relationType = isInterface ? RelationType.IMPLEMENTATION : RelationType.INHERITANCE;

      diagram.addRelationship(new Relationship(
        className,
        part,
        relationType
      ));
    }
  }
}
