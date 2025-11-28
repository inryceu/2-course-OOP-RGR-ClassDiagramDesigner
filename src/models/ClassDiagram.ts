import { shouldSkipMethod } from '../utils/parserHelpers.js';

export enum Visibility {
  PUBLIC = '+',
  PRIVATE = '-',
  PROTECTED = '#',
  PACKAGE = '~'
}

export enum RelationType {
  INHERITANCE = 'inheritance',
  IMPLEMENTATION = 'implementation',
  COMPOSITION = 'composition',
  AGGREGATION = 'aggregation',
  ASSOCIATION = 'association',
  DEPENDENCY = 'dependency'
}

export class Parameter {
  constructor(
    public name: string,
    public type: string,
    public defaultValue?: string
  ) {}
}

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
}

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
}

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
}

export class Relationship {
  constructor(
    public from: string,
    public to: string,
    public type: RelationType
  ) {}
}

export class ClassDiagram {
  private classes: Map<string, ClassInfo> = new Map();
  private relationships: Relationship[] = [];

  addClass(classInfo: ClassInfo): void {
    this.classes.set(classInfo.name, classInfo);
  }

  addRelationship(relationship: Relationship): void {
    const exists = this.relationships.some(r => 
      r.from === relationship.from && 
      r.to === relationship.to && 
      r.type === relationship.type
    );
    if (!exists) {
      this.relationships.push(relationship);
    }
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
  
  inheritMembersFromParents(): void {
    const parentMap = this.buildParentMap();

    this.classes.forEach((classInfo, className) => {
      const parents = parentMap.get(className);
      if (!parents || parents.length === 0) return;

      parents.forEach(parentName => {
        const parentClass = this.classes.get(parentName);
        if (!parentClass) return;

        this.inheritFields(classInfo, parentClass, parentName);
        this.inheritMethods(classInfo, parentClass, parentName);
      });
    });
  }

  private buildParentMap(): Map<string, string[]> {
    const parentMap = new Map<string, string[]>();
    this.relationships.forEach(rel => {
      if (rel.type === RelationType.INHERITANCE || rel.type === RelationType.IMPLEMENTATION) {
        if (!parentMap.has(rel.from)) {
          parentMap.set(rel.from, []);
        }
        parentMap.get(rel.from)!.push(rel.to);
      }
    });
    return parentMap;
  }

  private inheritFields(classInfo: ClassInfo, parentClass: ClassInfo, parentName: string): void {
    parentClass.fields.forEach(field => {
      if (field.visibility !== Visibility.PRIVATE) {
        const alreadyExists = classInfo.fields.some(f => 
          f.name === field.name && !f.isInherited
        );
        if (!alreadyExists) {
          const inheritedField = new Field(
            field.name,
            field.visibility,
            field.type,
            field.isStatic,
            field.isReadonly,
            field.defaultValue,
            true,
            parentName
          );
          classInfo.addField(inheritedField);
        }
      }
    });
  }

  private inheritMethods(classInfo: ClassInfo, parentClass: ClassInfo, parentName: string): void {
    parentClass.methods.forEach(method => {
      if (method.visibility !== Visibility.PRIVATE && !shouldSkipMethod(method.name, parentName)) {
        const alreadyExists = classInfo.methods.some(m => 
          m.name === method.name && !m.isInherited
        );
        if (!alreadyExists) {
          const inheritedMethod = new Method(
            method.name,
            method.visibility,
            method.returnType,
            [...method.parameters],
            method.isStatic,
            method.isAbstract,
            true,
            parentName
          );
          classInfo.addMethod(inheritedMethod);
        }
      }
    });
  }
}
