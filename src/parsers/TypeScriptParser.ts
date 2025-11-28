import { BaseParser } from './IParser.js';
import { ClassDiagram, ClassInfo, Field, Method, Parameter, Visibility, Relationship, RelationType } from '../models/ClassDiagram.js';
import { cleanString, cleanName, extractContentBetweenAngles } from '../utils/stringUtils.js';
import { 
  removeComments, 
  extractBalancedBraces, 
  getTopLevelStatements
} from '../utils/parsingUtils.js';
import {
  parseVisibility,
  parseTypeScriptParameters,
  parseJavaScriptParameters,
  extractConstructorParams,
  filterControlFlowKeywords
} from '../utils/parserHelpers.js';

export class TypeScriptParser extends BaseParser {
  constructor() {
    super();
    this.supportedExtensions = ['ts', 'tsx', 'js', 'jsx'];
  }

  parse(sourceCode: string, fileName?: string): ClassDiagram {
    console.log(`[TypeScriptParser] Starting parse of ${fileName || 'unknown file'}`);
    console.log(`[TypeScriptParser] Source code length: ${sourceCode.length} characters`);
    
    const diagram = new ClassDiagram();
    return this.parseStreaming(sourceCode, diagram, fileName);
  }

  private parseStreaming(sourceCode: string, diagram: ClassDiagram, fileName?: string): ClassDiagram {
    const cleanCode = removeComments(sourceCode, { supportRegex: true, supportTemplates: true });
    console.log(`[TypeScriptParser] After comment removal: ${cleanCode.length} characters`);
    
    const classMatches = this.findClassMatchesStreaming(cleanCode);
    const interfaceMatches = this.findInterfaceMatchesStreaming(cleanCode);
    
    console.log(`[TypeScriptParser] Found ${classMatches.length} classes and ${interfaceMatches.length} interfaces`);
    
    for (const match of classMatches) {
      this.processClassMatch(cleanCode, match, diagram);
    }
    
    for (const match of interfaceMatches) {
      this.processInterfaceMatch(cleanCode, match, diagram);
    }
    
    this.parseRelationships(cleanCode, diagram);
    
    console.log(`[TypeScriptParser] Parse complete. Found ${diagram.getClasses().length} classes/interfaces`);
    diagram.getClasses().forEach(cls => {
      const type = cls.isInterface ? 'interface' : cls.isAbstract ? 'abstract class' : 'class';
      console.log(`  - ${type}: ${cls.name} (${cls.fields.length} fields, ${cls.methods.length} methods)`);
    });
    
    return diagram;
  }

  private findClassMatchesStreaming(code: string): Array<{
    index: number;
    isAbstract: boolean;
    className: string;
    extendsClass?: string;
    implementsInterfaces?: string;
    matchLength: number;
  }> {
    const matches: Array<any> = [];
    const classPattern = /(export\s+)?(abstract\s+)?class\s+(\w+)(\s+extends\s+(\w+))?(\s+implements\s+([\w\s,<>]+))?\s*\{/g;
    
    let match;
    while ((match = classPattern.exec(code)) !== null) {
      matches.push({
        index: match.index,
        isAbstract: !!match[2],
        className: match[3],
        extendsClass: match[5],
        implementsInterfaces: match[7],
        matchLength: match[0].length
      });
    }
    
    return matches;
  }

  private findInterfaceMatchesStreaming(code: string): Array<{
    index: number;
    interfaceName: string;
    extendsInterfaces?: string;
    matchLength: number;
  }> {
    const matches: Array<any> = [];
    const interfacePattern = /(export\s+)?interface\s+(\w+)(\s+extends\s+([\w\s,<>]+))?\s*\{/g;
    
    let match;
    while ((match = interfacePattern.exec(code)) !== null) {
      matches.push({
        index: match.index,
        interfaceName: match[2],
        extendsInterfaces: match[4],
        matchLength: match[0].length
      });
    }
    
    return matches;
  }

  private processClassMatch(code: string, match: any, diagram: ClassDiagram): void {
    console.log(`[TypeScriptParser] Processing class: ${match.className}`);
    
    const classStartIndex = match.index + match.matchLength;
    const classBody = extractBalancedBraces(code, classStartIndex, { 
      maxLength: 500000, 
      supportRegex: true, 
      supportTemplates: true 
    });
    
    if (classBody === null) {
      console.warn(`[TypeScriptParser] Could not find body for class ${match.className}`);
      return;
    }
    
    const classInfo = new ClassInfo(match.className, false, match.isAbstract);
    
    try {
      this.parseMethods(classBody, classInfo);
      this.parseFields(classBody, classInfo);
    } catch (e) {
      console.error(`[TypeScriptParser] Error parsing members for class ${match.className}:`, e);
    }
    
    diagram.addClass(classInfo);
    
    if (match.extendsClass) {
      const cleanParent = this.cleanTypeSimple(match.extendsClass);
      diagram.addRelationship(new Relationship(
        match.className,
        cleanParent,
        RelationType.INHERITANCE
      ));
    }
    
    if (match.implementsInterfaces) {
      const interfaces = match.implementsInterfaces.split(',').map((i: string) => i.trim());
      interfaces.forEach((interfaceName: string) => {
        const cleanInterface = this.cleanTypeSimple(interfaceName);
        diagram.addRelationship(new Relationship(
          match.className,
          cleanInterface,
          RelationType.IMPLEMENTATION
        ));
      });
    }
  }

  private processInterfaceMatch(code: string, match: any, diagram: ClassDiagram): void {
    console.log(`[TypeScriptParser] Processing interface: ${match.interfaceName}`);
    
    const interfaceStartIndex = match.index + match.matchLength;
    const interfaceBody = extractBalancedBraces(code, interfaceStartIndex, { 
      maxLength: 500000, 
      supportRegex: true, 
      supportTemplates: true 
    });
    
    if (interfaceBody === null) {
      console.warn(`[TypeScriptParser] Could not find body for interface ${match.interfaceName}`);
      return;
    }
    
    const classInfo = new ClassInfo(match.interfaceName, true, false);
    this.parseInterfaceProperties(interfaceBody, classInfo);
    this.parseInterfaceMethods(interfaceBody, classInfo);
    diagram.addClass(classInfo);
    
    if (match.extendsInterfaces) {
      const interfaces = match.extendsInterfaces.split(',').map((i: string) => i.trim());
      interfaces.forEach((parentInterface: string) => {
        const cleanParent = this.cleanTypeSimple(parentInterface);
        diagram.addRelationship(new Relationship(
          match.interfaceName,
          cleanParent,
          RelationType.INHERITANCE
        ));
      });
    }
  }

  private parseFields(classBody: string, classInfo: ClassInfo): void {
    const statements = getTopLevelStatements(classBody, { supportRegex: true });
    const typedFieldRegex = /^(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(readonly)\s+)?(\w+)(\?)?\s*:\s*([^=;]+?)(?:\s*=\s*([^;]+))?;$/;
    const simpleFieldRegex = /^(?:(public|private|protected)\s+)?(?:(static)\s+)?(\w+)\s*=\s*([^;]+);$/;

    statements.forEach(statement => {
      const trimmed = statement.trim();

      if (trimmed.startsWith('constructor(')) {
        extractConstructorParams(trimmed, classInfo);
        return;
      }

      let match = typedFieldRegex.exec(trimmed);
      if (match) {
        const visibility = parseVisibility(match[1] || 'public');
        const isStatic = !!match[2];
        const isReadonly = !!match[3];
        const fieldName = match[4];
        const isOptional = !!match[5];
        const rawType = match[6];
        const defaultValue = match[7]?.trim();
        const fieldType = isOptional ? `${cleanString(rawType)}?` : cleanString(rawType);
        classInfo.addField(new Field(fieldName, visibility, fieldType, isStatic, isReadonly, defaultValue));
        return;
      }

      match = simpleFieldRegex.exec(trimmed);
      if (match) {
        const visibility = parseVisibility(match[1] || 'public');
        const isStatic = !!match[2];
        const fieldName = match[3];
        const defaultValue = match[4]?.trim();
        classInfo.addField(new Field(fieldName, visibility, 'any', isStatic, false, defaultValue));
      }
    });

    this.parseConstructorAssignments(classBody, classInfo);
  }

  private parseMethods(classBody: string, classInfo: ClassInfo): void {
    const statements = getTopLevelStatements(classBody, { supportRegex: true });
    const methodRegex = /^(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(abstract)\s+)?(?:(async)\s+)?(?:(get|set)\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{;]+))?$/;

    statements.forEach(statement => {
      const trimmed = statement.trim();
      if (trimmed.startsWith('constructor(')) {
        this.addConstructor(trimmed, classInfo);
        return;
      }

      const match = methodRegex.exec(trimmed);
      if (!match) return;

      const visibility = parseVisibility(match[1] || 'public');
      const isStatic = !!match[2];
      const isAbstract = !!match[3];
      const accessor = match[5];
      const methodNameCore = match[6];
      const paramsStr = match[7];
      const returnTypeRaw = match[8];
      const methodName = accessor ? `${accessor} ${methodNameCore}` : methodNameCore;
      const returnType = returnTypeRaw ? cleanString(returnTypeRaw) : 'void';

      if (methodNameCore === 'constructor') {
        this.addConstructor(trimmed, classInfo);
        return;
      }

      if (filterControlFlowKeywords(methodNameCore)) return;

      const parameters = parseTypeScriptParameters(paramsStr);
      classInfo.addMethod(new Method(methodName, visibility, returnType, parameters, isStatic, isAbstract));
    });
  }

  private addConstructor(statement: string, classInfo: ClassInfo): void {
    const constructorRegex = /^constructor\s*\(([^)]*)\)/;
    const match = constructorRegex.exec(statement);
    if (!match) return;
    const paramsStr = match[1];
    const parameters = parseTypeScriptParameters(paramsStr);
    const exists = classInfo.methods.some(m => m.name === 'constructor');
    if (!exists) {
      classInfo.addMethod(new Method('constructor', Visibility.PUBLIC, 'void', parameters));
    }
  }

  private parseConstructorAssignments(classBody: string, classInfo: ClassInfo): void {
    const constructorBodyPattern = /constructor\s*\(([^)]*)\)\s*\{/g;
    let match;
    while ((match = constructorBodyPattern.exec(classBody)) !== null) {
      const bodyStart = match.index + match[0].length;
      const body = extractBalancedBraces(classBody, bodyStart, { 
        maxLength: 500000, 
        supportRegex: true, 
        supportTemplates: true 
      });
      if (!body) continue;
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

  private parseInterfaceProperties(interfaceBody: string, classInfo: ClassInfo): void {
    const propRegex = /(\w+)(\?)?:\s*([^;]+);/g;
    let match;
    while ((match = propRegex.exec(interfaceBody)) !== null) {
      if (match[3].includes('=>') || match[3].includes('(')) continue;
      const propName = match[1];
      const isOptional = !!match[2];
      const propType = cleanString(match[3]);
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
      const returnType = cleanString(match[3]);
      const parameters = parseTypeScriptParameters(paramsStr);
      classInfo.addMethod(new Method(methodName, Visibility.PUBLIC, returnType, parameters));
    }
  }

  private parseRelationships(code: string, diagram: ClassDiagram): void {
    const classes = diagram.getClasses();

    for (const classInfo of classes) {
      for (const field of classInfo.fields) {
        const extractedTypes = this.extractTypesFromGeneric(field.type);

        extractedTypes.forEach(extracted => {
          if (diagram.hasClass(extracted.typeName) && extracted.typeName !== classInfo.name) {
            let relationType = RelationType.ASSOCIATION;

            if (extracted.isCollection) {
              relationType = RelationType.AGGREGATION;
            } else if (!field.type.includes('?') && !field.type.includes('| null')) {
              relationType = RelationType.COMPOSITION;
            } else {
              relationType = RelationType.ASSOCIATION;
            }

            diagram.addRelationship(new Relationship(
              classInfo.name,
              extracted.typeName,
              relationType
            ));
          }
        });
      }

      for (const method of classInfo.methods) {
        for (const param of method.parameters) {
          const paramTypes = this.extractTypesFromGeneric(param.type);
          paramTypes.forEach(extracted => {
             if (diagram.hasClass(extracted.typeName) && extracted.typeName !== classInfo.name) {
               diagram.addRelationship(new Relationship(
                 classInfo.name,
                 extracted.typeName,
                 RelationType.DEPENDENCY
               ));
             }
          });
        }

        const returnTypes = this.extractTypesFromGeneric(method.returnType);
        returnTypes.forEach(extracted => {
           if (diagram.hasClass(extracted.typeName) && extracted.typeName !== classInfo.name) {
             diagram.addRelationship(new Relationship(
               classInfo.name,
               extracted.typeName,
               RelationType.DEPENDENCY
             ));
           }
        });
      }
    }
  }

  private extractTypesFromGeneric(typeStr: string): { typeName: string, isCollection: boolean }[] {
    const results: { typeName: string, isCollection: boolean }[] = [];
    const normalized = cleanString(typeStr);
    
    if (normalized.startsWith('Map<') || normalized.startsWith('WeakMap<')) {
      const inside = extractContentBetweenAngles(normalized);
      if (inside) {
        const parts = inside.split(',').map(s => s.trim());
        if (parts.length >= 2) {
          results.push({ typeName: cleanName(parts[1]), isCollection: true }); 
        }
      }
      return results;
    }

    if (normalized.endsWith('[]')) {
      const baseType = normalized.substring(0, normalized.length - 2);
      results.push({ typeName: cleanName(baseType), isCollection: true });
      return results;
    }
    
    if (normalized.startsWith('Array<') || normalized.startsWith('Set<') || normalized.startsWith('List<')) {
      const inside = extractContentBetweenAngles(normalized);
      if (inside) {
        results.push({ typeName: cleanName(inside), isCollection: true });
      }
      return results;
    }

    if (normalized.startsWith('Promise<')) {
      const inside = extractContentBetweenAngles(normalized);
      if (inside) {
        results.push({ typeName: cleanName(inside), isCollection: false });
      }
      return results;
    }

    results.push({ typeName: cleanName(normalized), isCollection: false });
    return results;
  }
  
  private cleanTypeSimple(type: string): string {
    return type.split('<')[0].replace(/\[\]/g, '').trim();
  }
}
