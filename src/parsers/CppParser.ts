import { BaseParser } from './IParser.js';
import { ClassDiagram, ClassInfo, Field, Method, Parameter, Visibility, Relationship, RelationType } from '../models/ClassDiagram.js';

export class CppParser extends BaseParser {
  constructor() {
    super();
    this.supportedExtensions = ['cpp', 'cc', 'cxx', 'h', 'hpp', 'hxx'];
  }

  parse(sourceCode: string, fileName?: string): ClassDiagram {
    const diagram = new ClassDiagram();
    const cleanCode = this.removeComments(sourceCode, '//', '/*', '*/');
    this.parseClasses(cleanCode, diagram);
    return diagram;
  }

  private parseClasses(code: string, diagram: ClassDiagram): void {
    const classPattern = /class\s+(\w+)(?:\s*final)?(?:\s*:\s*([^{]+))?\s*\{/g;

    let match;
    while ((match = classPattern.exec(code)) !== null) {
      const className = match[1];
      const inheritanceStr = match[2];
      const classStartIndex = match.index + match[0].length;
      const classBody = this.extractBalancedBraces(code, classStartIndex);

      if (classBody === null) {
        console.warn(`Не вдалося знайти тіло класу ${className}`);
        continue;
      }

      const classInfo = new ClassInfo(className, false, false);
      this.parseClassBody(classBody, classInfo);
      diagram.addClass(classInfo);
      console.log(`C++ клас знайдено: ${className}, полів: ${classInfo.fields.length}, методів: ${classInfo.methods.length}`);

      if (inheritanceStr) {
        this.parseInheritance(className, inheritanceStr.trim(), diagram);
      }
    }

    const structPattern = /struct\s+(\w+)(?:\s*:\s*([^{]+))?\s*\{/g;

    while ((match = structPattern.exec(code)) !== null) {
      const structName = match[1];
      const inheritanceStr = match[2];
      const structStartIndex = match.index + match[0].length;
      const structBody = this.extractBalancedBraces(code, structStartIndex);

      if (structBody === null) {
        console.warn(`Не вдалося знайти тіло структури ${structName}`);
        continue;
      }

      const classInfo = new ClassInfo(structName, false, false);
      this.parseClassBody(structBody, classInfo);
      diagram.addClass(classInfo);
      console.log(`C++ struct знайдено: ${structName}, полів: ${classInfo.fields.length}, методів: ${classInfo.methods.length}`);

      if (inheritanceStr) {
        this.parseInheritance(structName, inheritanceStr.trim(), diagram);
      }
    }
  }

  private extractBalancedBraces(code: string, startIndex: number): string | null {
    let braceCount = 1;
    let i = startIndex;
    let inString = false;
    let stringChar = '';
    let inComment = false;

    while (i < code.length && braceCount > 0) {
      const char = code[i];
      const nextChar = i < code.length - 1 ? code[i + 1] : '';
      const prevChar = i > 0 ? code[i - 1] : '';

      if (!inString && char === '/' && nextChar === '/') {
        while (i < code.length && code[i] !== '\n') {
          i++;
        }
        continue;
      }

      if (!inString && char === '/' && nextChar === '*') {
        inComment = true;
        i += 2;
        continue;
      }

      if (inComment && char === '*' && nextChar === '/') {
        inComment = false;
        i += 2;
        continue;
      }

      if (inComment) {
        i++;
        continue;
      }

      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }

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

  private parseClassBody(body: string, classInfo: ClassInfo): void {
    const sections = this.splitByVisibility(body);

    for (const section of sections) {
      const visibility = section.visibility;
      this.parseMethods(section.content, classInfo, visibility);
      this.parseFields(section.content, classInfo, visibility);
    }
  }

  private splitByVisibility(body: string): Array<{ visibility: Visibility; content: string }> {
    const sections: Array<{ visibility: Visibility; content: string }> = [];
    let currentVisibility = Visibility.PRIVATE;
    let currentContent = '';

    const lines = body.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('public:')) {
        if (currentContent) {
          sections.push({ visibility: currentVisibility, content: currentContent });
          currentContent = '';
        }
        currentVisibility = Visibility.PUBLIC;
      } else if (trimmed.startsWith('protected:')) {
        if (currentContent) {
          sections.push({ visibility: currentVisibility, content: currentContent });
          currentContent = '';
        }
        currentVisibility = Visibility.PROTECTED;
      } else if (trimmed.startsWith('private:')) {
        if (currentContent) {
          sections.push({ visibility: currentVisibility, content: currentContent });
          currentContent = '';
        }
        currentVisibility = Visibility.PRIVATE;
      } else {
        currentContent += line + '\n';
      }
    }

    if (currentContent.trim()) {
      sections.push({ visibility: currentVisibility, content: currentContent });
    }

    return sections;
  }

  private getTopLevelStatements(content: string): string[] {
    const statements: string[] = [];
    let current = '';
    let i = 0;

    while (i < content.length) {
      const char = content[i];

      if (char === '{') {
        const trimmed = current.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        const nextIndex = this.skipBlock(content, i);
        i = nextIndex;
        current = '';
        continue;
      }

      if (char === ';') {
        current += char;
        const trimmed = current.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        current = '';
        i++;
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

    while (i < content.length) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';

      if (!inString && (char === '"' || char === "'")) {
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

  private parseFields(content: string, classInfo: ClassInfo, visibility: Visibility): void {
    const statements = this.getTopLevelStatements(content);
    const fieldPattern = /(static\s+)?(const\s+)?(\w+(?:\s*::\s*\w+)*(?:\s*<[^>]+>)?)\s+(\**)([\w\s,=*&()]+);/g;
    const methodPattern = new RegExp(`(virtual\\s+)?(static\\s+)?(\\w+(?:\\s*::\\s*\\w+)*(?:\\s*<[^>]+>)?)\\s+(\\**)(\\w+)\\s*\\(([^)]*)\\)`, 'g');

    for (const statement of statements) {
      if (!statement.endsWith(';')) {
        continue;
      }

      methodPattern.lastIndex = 0;
      if (methodPattern.test(statement)) {
        continue;
      }

      fieldPattern.lastIndex = 0;
      let match;
      while ((match = fieldPattern.exec(statement)) !== null) {
        const fullMatch = match[0];
        if (fullMatch.includes('(') && fullMatch.includes(')') && !fullMatch.match(/=\s*[^;]*\([^)]*\)/)) {
          continue;
        }

        const isStatic = !!match[1];
        const isConst = !!match[2];
        let fieldType = match[3].trim();
        const pointers = match[4];
        const fieldsStr = match[5];

        if (pointers) {
          fieldType += pointers;
        }

        const fieldDeclarations = this.splitFieldDeclarations(fieldsStr);

        fieldDeclarations.forEach(fieldDecl => {
          const { name, defaultValue, extraPointers } = this.parseFieldDeclaration(fieldDecl);
          if (name) {
            let finalType = fieldType;
            if (extraPointers) {
              finalType += extraPointers;
            }
            const field = new Field(name, visibility, finalType, isStatic, isConst, defaultValue);
            classInfo.addField(field);
          }
        });
      }
    }
  }

  private splitFieldDeclarations(fieldsStr: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let depth = 0;

    for (let i = 0; i < fieldsStr.length; i++) {
      const char = fieldsStr[i];

      if (char === '(' || char === '<') {
        depth++;
      } else if (char === ')' || char === '>') {
        depth--;
      } else if (char === ',' && depth === 0) {
        if (currentField.trim()) {
          fields.push(currentField.trim());
        }
        currentField = '';
        continue;
      }

      currentField += char;
    }

    if (currentField.trim()) {
      fields.push(currentField.trim());
    }

    return fields;
  }

  private parseFieldDeclaration(fieldDecl: string): { name: string; defaultValue?: string; extraPointers?: string } {
    let decl = fieldDecl.trim();
    let extraPointers = '';
    let i = 0;
    while (i < decl.length && (decl[i] === '*' || decl[i] === '&')) {
      extraPointers += decl[i];
      i++;
    }
    decl = decl.substring(i).trim();

    const equalIndex = decl.indexOf('=');
    if (equalIndex !== -1) {
      const name = decl.substring(0, equalIndex).trim();
      const defaultValue = decl.substring(equalIndex + 1).trim();
      return { name, defaultValue, extraPointers };
    }

    return { name: decl, extraPointers };
  }

  private parseMethods(content: string, classInfo: ClassInfo, visibility: Visibility): void {
    const statements = this.getTopLevelStatements(content);
    const methodPatternString = '(virtual\\s+)?(static\\s+)?(\\w+(?:\\s*::\\s*\\w+)*(?:\\s*<[^>]+>)?)\\s+(\\**)(\\w+)\\s*\\(([^)]*)\\)\\s*(const)?(?:\\s*(?:override|final|noexcept))*\\s*(=\\s*0)?';
    const constructorPattern = `(explicit\\s+)?${this.escapeRegex(classInfo.name)}\\s*\\(([^)]*)\\)(?:\\s*=\\s*(default|delete))?`;
    const destructorPattern = `(virtual\\s+)?~${this.escapeRegex(classInfo.name)}\\s*\\(\\)(?:\\s*(?:override|final))?`;

    for (const statement of statements) {
      const sanitizedStatement = statement
        .replace(/\b(?:override|final|override final|noexcept)\b/g, '')
        .replace(/\s*;\s*$/, ';')
        .replace(/\s+/g, ' ')
        .trim();

      const methodRegex = new RegExp(methodPatternString, 'g');
      let match;
      while ((match = methodRegex.exec(sanitizedStatement)) !== null) {
        const isStatic = !!match[2];
        let returnType = match[3].trim();
        const pointers = match[4];
        const methodName = match[5];
        const paramsStr = match[6];
        const trailingToken = match[8] ? match[8].trim() : '';
        const trailingTokens = trailingToken ? trailingToken.split(/\s+/).filter(Boolean) : [];
        const hasPureVirtual = !!match[8];

        if (methodName === classInfo.name || methodName.startsWith('~')) {
          continue;
        }

        if (pointers) {
          returnType += pointers;
        }

        const parameters = this.parseParameters(paramsStr);
        const method = new Method(methodName, visibility, returnType, parameters, isStatic, hasPureVirtual);
        classInfo.addMethod(method);
      }

      const constructorRegex = new RegExp(constructorPattern, 'g');
      let constructorMatch;
      while ((constructorMatch = constructorRegex.exec(sanitizedStatement)) !== null) {
        const paramsStr = constructorMatch[2];
        const isDefaultOrDelete = constructorMatch[3];

        if (!isDefaultOrDelete || isDefaultOrDelete === 'default') {
          const parameters = this.parseParameters(paramsStr);
          const constructor = new Method(classInfo.name, visibility, '', parameters);
          classInfo.addMethod(constructor);
        }
      }

      const destructorRegex = new RegExp(destructorPattern, 'g');
      let destructorMatch;
      while ((destructorMatch = destructorRegex.exec(sanitizedStatement)) !== null) {
        const destructor = new Method(`~${classInfo.name}`, visibility, '', []);
        classInfo.addMethod(destructor);
      }
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

      const paramMatch = /(\w+(?:\s*::\s*\w+)*(?:\s*<[^>]+>)?)\s+(&|\**)?(\w+)(?:\s*=\s*(.+))?/.exec(trimmed);
      if (paramMatch) {
        const pointerPart = paramMatch[2] || '';
        const paramType = paramMatch[1].trim() + pointerPart;
        const paramName = paramMatch[3];
        const defaultValue = paramMatch[4]?.trim();

        parameters.push(new Parameter(paramName, paramType, defaultValue));
      }
    }

    return parameters;
  }

  private parseInheritance(className: string, inheritanceStr: string, diagram: ClassDiagram): void {
    const baseClasses = inheritanceStr.split(',');

    for (const baseClass of baseClasses) {
      const trimmed = baseClass.trim();
      const fullMatch = /^((?:virtual\s+)?(?:public|protected|private)?(?:\s+virtual)?)\s*(\w+)$/.exec(trimmed);

      if (fullMatch) {
        const modifiers = fullMatch[1].trim();
        const baseClassName = fullMatch[2];
        const inheritanceModifier = modifiers || 'private';

        diagram.addRelationship(new Relationship(
          className,
          baseClassName,
          RelationType.INHERITANCE,
          undefined,
          inheritanceModifier
        ));
      }
    }
  }
}

