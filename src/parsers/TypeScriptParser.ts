import { BaseParser } from './IParser.js';
import { ClassDiagram, ClassInfo, Field, Method, Parameter, Visibility, Relationship, RelationType } from '../models/ClassDiagram.js';

interface ParseChunk {
  content: string;
  start: number;
  end: number;
}

export class TypeScriptParser extends BaseParser {
  private readonly CHUNK_SIZE = 50000;
  
  constructor() {
    super();
    this.supportedExtensions = ['ts', 'tsx', 'js', 'jsx'];
  }

  parse(sourceCode: string, fileName?: string): ClassDiagram {
    console.log(`[TypeScriptParser] Starting parse of ${fileName || 'unknown file'}`);
    console.log(`[TypeScriptParser] Source code length: ${sourceCode.length} characters`);
    
    const diagram = new ClassDiagram();
    
    // Always use the streaming/state-machine approach as it is now the most robust
    // way to handle complex files, including this parser itself.
    return this.parseStreaming(sourceCode, diagram, fileName);
  }

  private parseStreaming(sourceCode: string, diagram: ClassDiagram, fileName?: string): ClassDiagram {
    // 1. Remove comments safely (respecting strings and regex)
    const cleanCode = this.removeCommentsStreaming(sourceCode);
    console.log(`[TypeScriptParser] After comment removal: ${cleanCode.length} characters`);
    
    // 2. Find Classes and Interfaces
    const classMatches = this.findClassMatchesStreaming(cleanCode);
    const interfaceMatches = this.findInterfaceMatchesStreaming(cleanCode);
    
    console.log(`[TypeScriptParser] Found ${classMatches.length} classes and ${interfaceMatches.length} interfaces`);
    
    // 3. Process matches
    for (const match of classMatches) {
      this.processClassMatch(cleanCode, match, diagram);
    }
    
    for (const match of interfaceMatches) {
      this.processInterfaceMatch(cleanCode, match, diagram);
    }
    
    // 4. Resolve Relationships
    this.parseRelationships(cleanCode, diagram);
    
    console.log(`[TypeScriptParser] Parse complete. Found ${diagram.getClasses().length} classes/interfaces`);
    diagram.getClasses().forEach(cls => {
      console.log(`  - ${cls.getType()}: ${cls.name} (${cls.fields.length} fields, ${cls.methods.length} methods)`);
    });
    
    return diagram;
  }

  // =========================================================================
  // CORE PARSING HELPERS (The "Inception" Fixes)
  // =========================================================================

  private isRegexStart(code: string, index: number): boolean {
    let i = index - 1;
    // Skip whitespace backwards
    while (i >= 0 && /\s/.test(code[i])) i--;
    if (i < 0) return true;

    const char = code[i];
    
    // Symbols that generally precede a regex literal
    if (['=', ':', '(', ',', '[', '?', '!', '&', '|', '{', ';', '^', '~', '*', '+', '-', '/'].includes(char)) {
      return true;
    }

    // specific check for keywords like "return /.../" or "throw /.../"
    let word = '';
    while (i >= 0 && /[a-zA-Z0-9_$]/.test(code[i])) {
      word = code[i] + word;
      i--;
    }
    
    const keywords = ['return', 'throw', 'case', 'yield', 'typeof', 'void', 'delete', 'await', 'in', 'of', 'else'];
    return keywords.includes(word);
  }

  private skipRegex(code: string, index: number): number {
    let i = index + 1; // Start after the opening /
    let inCharClass = false; // To track [...]

    while (i < code.length) {
      const char = code[i];
      
      // Handle escaped characters (works in regex and char class)
      if (char === '\\' && i + 1 < code.length) {
        i += 2;
        continue;
      }

      if (inCharClass) {
        if (char === ']') inCharClass = false;
      } else {
        if (char === '[') inCharClass = true;
        else if (char === '/') return i + 1; // Found end of regex
      }
      
      if (char === '\n') return i; // Safety break for newlines (regex literals can't span lines unless flag)
      i++;
    }
    return i;
  }

  private removeCommentsStreaming(code: string): string {
    let result = '';
    let i = 0;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;

    while (i < code.length) {
      const char = code[i];
      const nextChar = i < code.length - 1 ? code[i + 1] : '';

      // 1. Strings
      if (!inString && !inTemplate && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        result += char;
        i++;
        continue;
      }

      if (inString) {
        result += char;
        if (char === '\\' && i + 1 < code.length) {
          i++;
          result += code[i];
        } else if (char === stringChar) {
          inString = false;
        }
        i++;
        continue;
      }

      // 2. Template Literals
      if (!inString && !inTemplate && char === '`') {
        inTemplate = true;
        result += char;
        i++;
        continue;
      }

      if (inTemplate) {
        result += char;
        if (char === '\\' && i + 1 < code.length) {
          i++;
          result += code[i];
        } else if (char === '`') {
           inTemplate = false;
        }
        i++;
        continue;
      }

      // 3. Regex Literals
      if (!inString && !inTemplate && char === '/' && this.isRegexStart(code, i)) {
        const nextSlash = this.skipRegex(code, i);
        if (nextSlash > i) {
          result += code.substring(i, nextSlash);
          i = nextSlash;
          continue;
        }
      }

      // 4. Line Comments
      if (!inString && !inTemplate && char === '/' && nextChar === '/') {
        while (i < code.length && code[i] !== '\n') i++;
        result += '\n'; // Preserve line count
        i++;
        continue;
      }

      // 5. Block Comments
      if (!inString && !inTemplate && char === '/' && nextChar === '*') {
        i += 2;
        while (i < code.length - 1) {
          if (code[i] === '*' && code[i + 1] === '/') {
            i += 2;
            break;
          }
          i++;
        }
        result += ' '; // Replace with space
        continue;
      }

      result += char;
      i++;
    }

    return result;
  }

  private extractBalancedBracesOptimized(code: string, startIndex: number, maxLength: number = 500000): string | null {
    let braceCount = 1; // We assume we are starting *after* the opening brace
    let i = startIndex;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    let templateDepth = 0;
    const endLimit = Math.min(startIndex + maxLength, code.length);

    while (i < endLimit && braceCount > 0) {
      const char = code[i];
      const nextChar = i < code.length - 1 ? code[i + 1] : '';

      // Strings
      if (!inString && !inTemplate && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        i++;
        continue;
      }
      
      if (inString) {
        if (char === '\\' && i + 1 < code.length) {
          i += 2;
          continue;
        }
        if (char === stringChar) {
          inString = false;
        }
        i++;
        continue;
      }

      // Template Literals
      if (!inTemplate && !inString && char === '`') {
        inTemplate = true;
        templateDepth = 0;
        i++;
        continue;
      }
      
      if (inTemplate) {
        if (char === '\\' && i + 1 < code.length) {
          i += 2;
          continue;
        }
        
        if (char === '$' && nextChar === '{') {
          templateDepth++;
          i += 2;
          continue;
        }
        
        if (char === '{' && templateDepth > 0) {
          templateDepth++;
          i++;
          continue;
        }
        
        if (char === '}' && templateDepth > 0) {
          templateDepth--;
          i++;
          continue;
        }
        
        if (char === '`' && templateDepth === 0) {
          inTemplate = false;
        }
        i++;
        continue;
      }

      // Regex Literals (The Critical Fix)
      if (!inString && !inTemplate && char === '/' && this.isRegexStart(code, i)) {
         const nextI = this.skipRegex(code, i);
         if (nextI > i) {
             i = nextI;
             continue;
         }
      }

      // Ignore Comments (in case they weren't fully cleaned)
      if (!inString && !inTemplate && char === '/' && nextChar === '/') {
        while (i < endLimit && code[i] !== '\n') i++;
        i++;
        continue;
      }
      
      if (!inString && !inTemplate && char === '/' && nextChar === '*') {
        i += 2;
        while (i < endLimit - 1) {
          if (code[i] === '*' && code[i + 1] === '/') {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }

      // Structural Braces
      if (!inString && !inTemplate) {
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
    
    console.warn(`[extractBalancedBraces] Failed to find matching braces. Started at ${startIndex}, braceCount=${braceCount}`);
    return null;
  }

  // =========================================================================
  // MATCH FINDERS
  // =========================================================================

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

  // =========================================================================
  // PROCESSORS
  // =========================================================================

  private processClassMatch(code: string, match: any, diagram: ClassDiagram): void {
    console.log(`[TypeScriptParser] Processing class: ${match.className}`);
    
    const classStartIndex = match.index + match.matchLength;
    const classBody = this.extractBalancedBracesOptimized(code, classStartIndex);
    
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
      const cleanParent = this.cleanType(match.extendsClass);
      diagram.addRelationship(new Relationship(
        match.className,
        cleanParent,
        RelationType.INHERITANCE,
        undefined,
        undefined,
        undefined,
        'extends'
      ));
    }
    
    if (match.implementsInterfaces) {
      const interfaces = match.implementsInterfaces.split(',').map((i: string) => i.trim());
      interfaces.forEach((interfaceName: string) => {
        const cleanInterface = this.cleanType(interfaceName);
        diagram.addRelationship(new Relationship(
          match.className,
          cleanInterface,
          RelationType.IMPLEMENTATION,
          undefined,
          undefined,
          undefined,
          'implements'
        ));
      });
    }
  }

  private processInterfaceMatch(code: string, match: any, diagram: ClassDiagram): void {
    console.log(`[TypeScriptParser] Processing interface: ${match.interfaceName}`);
    
    const interfaceStartIndex = match.index + match.matchLength;
    const interfaceBody = this.extractBalancedBracesOptimized(code, interfaceStartIndex);
    
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
        const cleanParent = this.cleanType(parentInterface);
        diagram.addRelationship(new Relationship(
          match.interfaceName,
          cleanParent,
          RelationType.INHERITANCE,
          undefined,
          undefined,
          undefined,
          'extends'
        ));
      });
    }
  }

  // =========================================================================
  // MEMBER PARSING (Methods & Fields)
  // =========================================================================

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

    // We reuse the skip logic here to safely split by semicolons
    while (i < content.length) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';

      if (!inString && !inTemplate && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
        current += char;
        i++;
        continue;
      }
      if (inString) {
        if (char === stringChar && prevChar !== '\\') inString = false;
        current += char;
        i++;
        continue;
      }

      if (!inTemplate && !inString && char === '`') {
        inTemplate = true;
        current += char;
        i++;
        continue;
      }
      if (inTemplate) {
        if (char === '`' && prevChar !== '\\') inTemplate = false;
        current += char;
        i++;
        continue;
      }

      // Skip Regex
      if (char === '/' && !inString && !inTemplate && this.isRegexStart(content, i)) {
         const nextI = this.skipRegex(content, i);
         current += content.substring(i, nextI);
         i = nextI;
         continue;
      }

      // Skip Comments
      if (char === '/' && i + 1 < content.length && (content[i+1] === '/' || content[i+1] === '*')) {
         // Naive skip for internal statement parsing, usually already stripped by removeComments
         // But kept for safety if run on raw code
         if (content[i+1] === '/') {
             while(i < content.length && content[i] !== '\n') i++;
         } else {
             i += 2;
             while(i < content.length - 1 && !(content[i] === '*' && content[i+1] === '/')) i++;
             i += 2;
         }
         continue;
      }

      if (char === '{') {
        if (depth === 0) {
          const trimmed = current.trim();
          if (trimmed) statements.push(trimmed);
          // Fast-forward over the block
          const blockEnd = this.skipBlock(content, i);
          // We don't add the block content to statements, we reset
          i = blockEnd;
          current = '';
          continue;
        }
        depth++;
      } else if (char === '}') {
        if (depth > 0) depth--;
      }

      if (char === ';' && depth === 0) {
        current += char;
        const trimmed = current.trim();
        if (trimmed) statements.push(trimmed);
        current = '';
        i++;
        continue;
      }

      current += char;
      i++;
    }

    const trimmed = current.trim();
    if (trimmed) statements.push(trimmed);

    return statements;
  }

  private skipBlock(content: string, startIndex: number): number {
    let depth = 0;
    let i = startIndex;
    // Uses simplified logic just to get past the block
    while (i < content.length) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') {
          depth--;
          if (depth === 0) return i + 1;
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
      if (!match) return;

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

      if (['if', 'for', 'while', 'switch', 'catch'].includes(methodNameCore)) return;

      const parameters = this.parseParameters(paramsStr);
      classInfo.addMethod(new Method(methodName, visibility, returnType, parameters, isStatic, isAbstract));
    });
  }

  private addConstructor(statement: string, classInfo: ClassInfo): void {
    const constructorRegex = /^constructor\s*\(([^)]*)\)/;
    const match = constructorRegex.exec(statement);
    if (!match) return;
    const paramsStr = match[1];
    const parameters = this.parseParameters(paramsStr);
    const exists = classInfo.methods.some(m => m.name === 'constructor');
    if (!exists) {
      classInfo.addMethod(new Method('constructor', Visibility.PUBLIC, 'void', parameters));
    }
  }

  private extractConstructorParams(statement: string, classInfo: ClassInfo): void {
    const params = statement.substring(statement.indexOf('(') + 1, statement.lastIndexOf(')'));
    if (!params.trim()) return;

    const parts = params.split(',');
    parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;

      const paramMatch = /^(?:(public|private|protected)\s+)?(readonly\s+)?(\w+)(\?)?\s*:\s*([^,)]+)/.exec(trimmed);
      if (!paramMatch) return;

      const visibilityToken = paramMatch[1];
      const readonlyToken = paramMatch[2];
      const fieldName = paramMatch[3];
      const isOptional = !!paramMatch[4];
      const fieldTypeRaw = paramMatch[5];

      if (!visibilityToken && !readonlyToken) return;

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
      const body = this.extractBalancedBracesOptimized(classBody, bodyStart);
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

  private parseJavaScriptParameters(paramsStr: string): Parameter[] {
    if (!paramsStr || paramsStr.trim() === '') return [];

    const parameters: Parameter[] = [];
    const params = paramsStr.split(',');

    for (const param of params) {
      const trimmed = param.trim();
      if (!trimmed) continue;
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
      if (match[3].includes('=>') || match[3].includes('(')) continue;
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
    if (!paramsStr.trim()) return [];
    const parameters: Parameter[] = [];
    const paramParts = paramsStr.split(',');

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const paramMatch = /(\w+)(\?)?:\s*([^=]+)(?:\s*=\s*(.+))?/.exec(trimmed);
      if (paramMatch) {
        const paramName = paramMatch[1];
        const isOptional = !!paramMatch[2];
        let paramType = this.cleanString(paramMatch[3]);
        const defaultValue = paramMatch[4]?.trim();
        if (isOptional) paramType += '?';
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
    if (lower === 'private') return Visibility.PRIVATE;
    if (lower === 'protected') return Visibility.PROTECTED;
    return Visibility.PUBLIC;
  }

  // =========================================================================
  // RELATIONSHIP PARSING
  // =========================================================================

  private parseRelationships(code: string, diagram: ClassDiagram): void {
    const classes = diagram.getClasses();

    for (const classInfo of classes) {
      // 1. Fields
      for (const field of classInfo.fields) {
        const extractedTypes = this.extractTypesFromGeneric(field.type);

        extractedTypes.forEach(extracted => {
          if (diagram.hasClass(extracted.typeName) && extracted.typeName !== classInfo.name) {
            let relationType = RelationType.ASSOCIATION;
            let targetMultiplicity = '1';

            if (extracted.isCollection) {
              relationType = RelationType.AGGREGATION;
              targetMultiplicity = '0..*';
            } else if (!field.type.includes('?') && !field.type.includes('| null')) {
              relationType = RelationType.COMPOSITION;
              targetMultiplicity = '1';
            } else {
              relationType = RelationType.ASSOCIATION;
              targetMultiplicity = '0..1';
            }

            diagram.addRelationship(new Relationship(
              classInfo.name,
              extracted.typeName,
              relationType,
              field.name,
              undefined,
              targetMultiplicity
            ));
          }
        });
      }

      // 2. Methods
      for (const method of classInfo.methods) {
        // Params
        for (const param of method.parameters) {
          const paramTypes = this.extractTypesFromGeneric(param.type);
          paramTypes.forEach(extracted => {
             if (diagram.hasClass(extracted.typeName) && extracted.typeName !== classInfo.name) {
               diagram.addRelationship(new Relationship(
                 classInfo.name,
                 extracted.typeName,
                 RelationType.DEPENDENCY,
                 `use(${param.name})`
               ));
             }
          });
        }

        // Returns
        const returnTypes = this.extractTypesFromGeneric(method.returnType);
        returnTypes.forEach(extracted => {
           if (diagram.hasClass(extracted.typeName) && extracted.typeName !== classInfo.name) {
             diagram.addRelationship(new Relationship(
               classInfo.name,
               extracted.typeName,
               RelationType.DEPENDENCY,
               'return'
             ));
           }
        });
      }
    }
  }

  private extractTypesFromGeneric(typeStr: string): { typeName: string, isCollection: boolean }[] {
    const results: { typeName: string, isCollection: boolean }[] = [];
    const normalized = this.cleanString(typeStr);
    
    if (normalized.startsWith('Map<') || normalized.startsWith('WeakMap<')) {
      const inside = this.extractContentBetweenAngles(normalized);
      if (inside) {
        const parts = inside.split(',').map(s => s.trim());
        if (parts.length >= 2) {
          results.push({ typeName: this.cleanName(parts[1]), isCollection: true }); 
        }
      }
      return results;
    }

    if (normalized.endsWith('[]')) {
      const baseType = normalized.substring(0, normalized.length - 2);
      results.push({ typeName: this.cleanName(baseType), isCollection: true });
      return results;
    }
    
    if (normalized.startsWith('Array<') || normalized.startsWith('Set<') || normalized.startsWith('List<')) {
      const inside = this.extractContentBetweenAngles(normalized);
      if (inside) {
        results.push({ typeName: this.cleanName(inside), isCollection: true });
      }
      return results;
    }

    if (normalized.startsWith('Promise<')) {
      const inside = this.extractContentBetweenAngles(normalized);
      if (inside) {
        results.push({ typeName: this.cleanName(inside), isCollection: false });
      }
      return results;
    }

    results.push({ typeName: this.cleanName(normalized), isCollection: false });
    return results;
  }

  private extractContentBetweenAngles(str: string): string | null {
    const start = str.indexOf('<');
    const end = str.lastIndexOf('>');
    if (start !== -1 && end !== -1 && end > start) {
      return str.substring(start + 1, end);
    }
    return null;
  }

  private cleanName(name: string): string {
    return name.replace(/[?;!]/g, '').trim();
  }
  
  private cleanType(type: string): string {
    return type.split('<')[0].replace(/\[\]/g, '').trim();
  }
}