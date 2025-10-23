/**
 * Перелік типів видимості членів класу
 */
export enum Visibility {
  PUBLIC = '+',
  PRIVATE = '-',
  PROTECTED = '#',
  PACKAGE = '~'
}

/**
 * Перелік типів відношень між класами
 */
export enum RelationType {
  INHERITANCE = 'inheritance',       // Успадкування
  IMPLEMENTATION = 'implementation', // Реалізація інтерфейсу
  COMPOSITION = 'composition',       // Композиція
  AGGREGATION = 'aggregation',       // Агрегація
  ASSOCIATION = 'association',       // Асоціація
  DEPENDENCY = 'dependency'          // Залежність
}

/**
 * Представляє параметр методу
 */
export class Parameter {
  constructor(
    public name: string,
    public type: string,
    public defaultValue?: string
  ) {}

  toString(): string {
    let result = `${this.name}: ${this.type}`;
    if (this.defaultValue) {
      result += ` = ${this.defaultValue}`;
    }
    return result;
  }
}

/**
 * Представляє метод класу
 */
export class Method {
  constructor(
    public name: string,
    public visibility: Visibility,
    public returnType: string,
    public parameters: Parameter[] = [],
    public isStatic: boolean = false,
    public isAbstract: boolean = false,
    public isInherited: boolean = false,
    public inheritedFrom?: string
  ) {}

  toString(): string {
    const modifiers = [];
    if (this.isStatic) modifiers.push('static');
    if (this.isAbstract) modifiers.push('abstract');
    
    const params = this.parameters.map(p => p.toString()).join(', ');
    const signature = `${this.name}(${params}): ${this.returnType}`;
    
    return modifiers.length > 0 
      ? `${this.visibility}${modifiers.join(' ')} ${signature}`
      : `${this.visibility}${signature}`;
  }
}

/**
 * Представляє поле/властивість класу
 */
export class Field {
  constructor(
    public name: string,
    public visibility: Visibility,
    public type: string,
    public isStatic: boolean = false,
    public isReadonly: boolean = false,
    public defaultValue?: string,
    public isInherited: boolean = false,
    public inheritedFrom?: string
  ) {}

  toString(): string {
    const modifiers = [];
    if (this.isStatic) modifiers.push('static');
    if (this.isReadonly) modifiers.push('readonly');
    
    let result = `${this.visibility}${this.name}: ${this.type}`;
    
    if (modifiers.length > 0) {
      result = `${this.visibility}${modifiers.join(' ')} ${this.name}: ${this.type}`;
    }
    
    if (this.defaultValue) {
      result += ` = ${this.defaultValue}`;
    }
    
    return result;
  }
}

/**
 * Представляє клас або інтерфейс
 */
export class ClassInfo {
  public fields: Field[] = [];
  public methods: Method[] = [];

  constructor(
    public name: string,
    public isInterface: boolean = false,
    public isAbstract: boolean = false
  ) {}

  addField(field: Field): void {
    this.fields.push(field);
  }

  addMethod(method: Method): void {
    this.methods.push(method);
  }

  getType(): string {
    if (this.isInterface) return 'interface';
    if (this.isAbstract) return 'abstract class';
    return 'class';
  }
}

/**
 * Представляє відношення між класами
 */
export class Relationship {
  constructor(
    public from: string,
    public to: string,
    public type: RelationType,
    public label?: string,
    public inheritanceModifier?: string // public, protected, private, virtual, тощо
  ) {}

  toString(): string {
    const labelStr = this.label ? ` : ${this.label}` : '';
    const modifierStr = this.inheritanceModifier ? ` (${this.inheritanceModifier})` : '';
    return `${this.from} ${this.type} ${this.to}${modifierStr}${labelStr}`;
  }
}

/**
 * Представляє повну діаграму класів
 */
export class ClassDiagram {
  private classes: Map<string, ClassInfo> = new Map();
  private relationships: Relationship[] = [];

  addClass(classInfo: ClassInfo): void {
    this.classes.set(classInfo.name, classInfo);
  }

  addRelationship(relationship: Relationship): void {
    this.relationships.push(relationship);
  }

  getClasses(): ClassInfo[] {
    return Array.from(this.classes.values());
  }

  getRelationships(): Relationship[] {
    return this.relationships;
  }

  getClass(name: string): ClassInfo | undefined {
    return this.classes.get(name);
  }

  hasClass(name: string): boolean {
    return this.classes.has(name);
  }

  clear(): void {
    this.classes.clear();
    this.relationships = [];
  }
  
  /**
   * Копіює поля та методи від батьківських класів до нащадків
   * Додає позначку про те, що вони успадковані
   */
  inheritMembersFromParents(): void {
    // Створюємо мапу батьків для кожного класу
    const parentMap = new Map<string, string[]>();
    
    this.relationships.forEach(rel => {
      if (rel.type === RelationType.INHERITANCE || rel.type === RelationType.IMPLEMENTATION) {
        if (!parentMap.has(rel.from)) {
          parentMap.set(rel.from, []);
        }
        parentMap.get(rel.from)!.push(rel.to);
      }
    });
    
    // Для кожного класу копіюємо члени від батьків
    this.classes.forEach((classInfo, className) => {
      const parents = parentMap.get(className);
      if (!parents || parents.length === 0) return;
      
      parents.forEach(parentName => {
        const parentClass = this.classes.get(parentName);
        if (!parentClass) return;
        
        // Копіюємо поля від батька (крім private)
        parentClass.fields.forEach(field => {
          if (field.visibility !== Visibility.PRIVATE) {
            // Перевіряємо, чи поле вже не перевизначене
            const alreadyExists = classInfo.fields.some(f => 
              f.name === field.name && !f.isInherited
            );
            
            if (!alreadyExists) {
              // Створюємо копію поля з позначкою про успадкування
              const inheritedField = new Field(
                field.name,
                field.visibility,
                field.type,
                field.isStatic,
                field.isReadonly,
                field.defaultValue,
                true, // isInherited
                parentName // inheritedFrom
              );
              classInfo.addField(inheritedField);
            }
          }
        });
        
        // Копіюємо методи від батька (крім private)
        parentClass.methods.forEach(method => {
          if (method.visibility !== Visibility.PRIVATE) {
            // Перевіряємо, чи метод вже не перевизначений (override)
            const alreadyExists = classInfo.methods.some(m => 
              m.name === method.name && !m.isInherited
            );
            
            if (!alreadyExists) {
              // Створюємо копію методу з позначкою про успадкування
              const inheritedMethod = new Method(
                method.name,
                method.visibility,
                method.returnType,
                [...method.parameters], // копія параметрів
                method.isStatic,
                method.isAbstract,
                true, // isInherited
                parentName // inheritedFrom
              );
              classInfo.addMethod(inheritedMethod);
            }
          }
        });
      });
    });
  }
}

