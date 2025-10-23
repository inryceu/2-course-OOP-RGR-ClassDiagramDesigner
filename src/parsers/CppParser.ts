import { BaseParser } from './IParser.js';
import { ClassDiagram, ClassInfo, Field, Method, Parameter, Visibility, Relationship, RelationType } from '../models/ClassDiagram.js';

/**
 * Парсер для C++
 */
export class CppParser extends BaseParser {
  constructor() {
    super();
    this.supportedExtensions = ['cpp', 'cc', 'cxx', 'h', 'hpp', 'hxx'];
  }

  parse(sourceCode: string, fileName?: string): ClassDiagram {
    const diagram = new ClassDiagram();
    
    // Видаляємо коментарі
    const cleanCode = this.removeComments(sourceCode, '//', '/*', '*/');
    
    // Шукаємо всі класи та структури
    this.parseClasses(cleanCode, diagram);
    
    return diagram;
  }

  private parseClasses(code: string, diagram: ClassDiagram): void {
    // Більш надійний підхід - знаходимо класи та витягуємо їх тіла
    const classPattern = /class\s+(\w+)(?:\s*final)?(?:\s*:\s*([^{]+))?\s*\{/g;
    
    let match;
    while ((match = classPattern.exec(code)) !== null) {
      const className = match[1];
      const inheritanceStr = match[2];
      const classStartIndex = match.index + match[0].length;
      
      // Знаходимо відповідну закриваючу дужку
      const classBody = this.extractBalancedBraces(code, classStartIndex);
      
      if (classBody === null) {
        console.warn(`Не вдалося знайти тіло класу ${className}`);
        continue;
      }
      
      const classInfo = new ClassInfo(className, false, false);
      
      // Парсимо тіло класу
      this.parseClassBody(classBody, classInfo);
      
      diagram.addClass(classInfo);
      console.log(`C++ клас знайдено: ${className}, полів: ${classInfo.fields.length}, методів: ${classInfo.methods.length}`);
      
      // Парсимо наслідування
      if (inheritanceStr) {
        this.parseInheritance(className, inheritanceStr.trim(), diagram);
      }
    }
    
    // Також шукаємо структури (struct)
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
      
      // Парсимо тіло структури
      this.parseClassBody(structBody, classInfo);
      
      diagram.addClass(classInfo);
      console.log(`C++ struct знайдено: ${structName}, полів: ${classInfo.fields.length}, методів: ${classInfo.methods.length}`);
      
      // Парсимо наслідування
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
      
      // Пропускаємо коментарі
      if (!inString && char === '/' && nextChar === '/') {
        // Однорядковий коментар - пропускаємо до кінця рядка
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
      
      // Обробка рядків
      if ((char === '"' || char === "'") && prevChar !== '\\') {
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

  private parseClassBody(body: string, classInfo: ClassInfo): void {
    // Розбиваємо тіло на секції за видимістю
    const sections = this.splitByVisibility(body);
    
    for (const section of sections) {
      const visibility = section.visibility;
      
      // Парсимо поля
      this.parseFields(section.content, classInfo, visibility);
      
      // Парсимо методи
      this.parseMethods(section.content, classInfo, visibility);
    }
  }

  private splitByVisibility(body: string): Array<{ visibility: Visibility; content: string }> {
    const sections: Array<{ visibility: Visibility; content: string }> = [];
    let currentVisibility = Visibility.PRIVATE; // За замовчуванням для class
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

  private parseFields(content: string, classInfo: ClassInfo, visibility: Visibility): void {
    // Регулярний вираз для рядків з оголошенням полів (може бути кілька в одному рядку)
    const fieldLineRegex = /(static\s+)?(const\s+)?(\w+(?:\s*::\s*\w+)*(?:\s*<[^>]+>)?)\s+(\**)([\w\s,=*&()]+);/g;
    
    let match;
    while ((match = fieldLineRegex.exec(content)) !== null) {
      // Перевіряємо, що це не метод (не має круглих дужок для виклику функції)
      const fullMatch = match[0];
      if (fullMatch.includes('(') && fullMatch.includes(')') && 
          !fullMatch.match(/=\s*[^;]*\([^)]*\)/)) { // Але дозволяємо ініціалізацію через конструктор
        continue;
      }
      
      const isStatic = !!match[1];
      const isConst = !!match[2];
      let fieldType = match[3].trim();
      const pointers = match[4];
      const fieldsStr = match[5]; // Може містити кілька полів: "x, y, z" або "name = "default""
      
      // Додаємо вказівники до типу
      if (pointers) {
        fieldType += pointers;
      }
      
      // Розбиваємо на окремі поля (через кому)
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
  
  /**
   * Розбиває рядок з оголошеннями полів на окремі поля
   * Наприклад: "x, y, z" -> ["x", "y", "z"]
   * Або: "x = 0, y = 1" -> ["x = 0", "y = 1"]
   */
  private splitFieldDeclarations(fieldsStr: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let depth = 0; // Глибина дужок для ігнорування ком всередині
    
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
  
  /**
   * Парсить окреме оголошення поля
   * Наприклад: "x" -> {name: "x", defaultValue: undefined}
   * Або: "*ptr = nullptr" -> {name: "ptr", extraPointers: "*", defaultValue: "nullptr"}
   */
  private parseFieldDeclaration(fieldDecl: string): { name: string; defaultValue?: string; extraPointers?: string } {
    // Видаляємо зайві пробіли
    fieldDecl = fieldDecl.trim();
    
    // Шукаємо вказівники та посилання на початку
    let extraPointers = '';
    let i = 0;
    while (i < fieldDecl.length && (fieldDecl[i] === '*' || fieldDecl[i] === '&')) {
      extraPointers += fieldDecl[i];
      i++;
    }
    fieldDecl = fieldDecl.substring(i).trim();
    
    // Шукаємо значення за замовчуванням
    const equalIndex = fieldDecl.indexOf('=');
    if (equalIndex !== -1) {
      const name = fieldDecl.substring(0, equalIndex).trim();
      const defaultValue = fieldDecl.substring(equalIndex + 1).trim();
      return { name, defaultValue, extraPointers };
    }
    
    return { name: fieldDecl, extraPointers };
  }

  private parseMethods(content: string, classInfo: ClassInfo, visibility: Visibility): void {
    // Покращений регулярний вираз для методів з урахуванням final, override, const
    const methodRegex = /(virtual\s+)?(static\s+)?(\w+(?:\s*::\s*\w+)*(?:\s*<[^>]+>)?)\s+(\**)(\w+)\s*\(([^)]*)\)\s*(const)?\s*(override|final|noexcept)*\s*(=\s*0)?/g;
    
    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      const isVirtual = !!match[1];
      const isStatic = !!match[2];
      let returnType = match[3].trim();
      const pointers = match[4];
      const methodName = match[5];
      const paramsStr = match[6];
      const isConst = !!match[7];
      const modifiers = match[8] || '';
      const isPureVirtual = !!match[9];
      
      // Пропускаємо конструктори та деструктори у визначенні класу
      if (methodName === classInfo.name || methodName.startsWith('~')) {
        continue;
      }
      
      // Додаємо вказівники до типу
      if (pointers) {
        returnType += pointers;
      }
      
      const parameters = this.parseParameters(paramsStr);
      const isAbstract = isPureVirtual;
      
      const method = new Method(methodName, visibility, returnType, parameters, isStatic, isAbstract);
      classInfo.addMethod(method);
    }
    
    // Окремо шукаємо конструктори (включаючи explicit, default, delete)
    const constructorRegex = new RegExp(`(explicit\\s+)?${this.escapeRegex(classInfo.name)}\\s*\\(([^)]*)\\)(?:\\s*=\\s*(default|delete))?`, 'g');
    let constructorMatch;
    while ((constructorMatch = constructorRegex.exec(content)) !== null) {
      const paramsStr = constructorMatch[2];
      const isDefaultOrDelete = constructorMatch[3];
      
      if (!isDefaultOrDelete || isDefaultOrDelete === 'default') {
        const parameters = this.parseParameters(paramsStr);
        const constructor = new Method(classInfo.name, visibility, '', parameters);
        classInfo.addMethod(constructor);
      }
    }
    
    // Шукаємо деструктори (з virtual, override, final)
    const destructorRegex = new RegExp(`(virtual\\s+)?~${this.escapeRegex(classInfo.name)}\\s*\\(\\)(?:\\s*(override|final))?`, 'g');
    let destructorMatch;
    while ((destructorMatch = destructorRegex.exec(content)) !== null) {
      const destructor = new Method(`~${classInfo.name}`, visibility, '', []);
      classInfo.addMethod(destructor);
    }
  }
  
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      
      // Парсимо параметр: type name = defaultValue
      const paramMatch = /(\w+(?:\s*::\s*\w+)*(?:\s*<[^>]+>)?)\s+(&|\**)(\w+)(?:\s*=\s*(.+))?/.exec(trimmed);
      if (paramMatch) {
        const paramType = paramMatch[1].trim() + (paramMatch[2] || '');
        const paramName = paramMatch[3];
        const defaultValue = paramMatch[4]?.trim();
        
        parameters.push(new Parameter(paramName, paramType, defaultValue));
      }
    }
    
    return parameters;
  }

  private parseInheritance(className: string, inheritanceStr: string, diagram: ClassDiagram): void {
    // Парсимо список базових класів
    const baseClasses = inheritanceStr.split(',');
    
    for (const baseClass of baseClasses) {
      const trimmed = baseClass.trim();
      
      // Парсимо модифікатори та ім'я класу
      // Приклади: "public Base", "virtual public Base", "protected virtual Base"
      const fullMatch = /^((?:virtual\s+)?(?:public|protected|private)?(?:\s+virtual)?)\s*(\w+)$/.exec(trimmed);
      
      if (fullMatch) {
        const modifiers = fullMatch[1].trim();
        const baseClassName = fullMatch[2];
        
        // Формуємо рядок модифікатора (якщо є)
        const inheritanceModifier = modifiers || 'private'; // За замовчуванням private для class в C++
        
        console.log(`  Зв'язок наслідування: ${className} -> ${baseClassName} (${inheritanceModifier})`);
        
        diagram.addRelationship(new Relationship(
          className,
          baseClassName,
          RelationType.INHERITANCE,
          undefined, // label
          inheritanceModifier
        ));
      }
    }
  }
}

