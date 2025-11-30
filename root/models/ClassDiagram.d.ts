export declare enum Visibility {
    PUBLIC = "+",
    PRIVATE = "-",
    PROTECTED = "#",
    PACKAGE = "~"
}
export declare enum RelationType {
    INHERITANCE = "inheritance",
    IMPLEMENTATION = "implementation",
    COMPOSITION = "composition",
    AGGREGATION = "aggregation",
    ASSOCIATION = "association",
    DEPENDENCY = "dependency"
}
export declare class Parameter {
    name: string;
    type: string;
    defaultValue?: string | undefined;
    constructor(name: string, type: string, defaultValue?: string | undefined);
}
export declare class Method {
    name: string;
    visibility: Visibility;
    returnType: string;
    parameters: Parameter[];
    isStatic: boolean;
    isAbstract: boolean;
    isInherited: boolean;
    inheritedFrom?: string | undefined;
    constructor(name: string, visibility: Visibility, returnType: string, parameters?: Parameter[], isStatic?: boolean, isAbstract?: boolean, isInherited?: boolean, inheritedFrom?: string | undefined);
}
export declare class Field {
    name: string;
    visibility: Visibility;
    type: string;
    isStatic: boolean;
    isReadonly: boolean;
    defaultValue?: string | undefined;
    isInherited: boolean;
    inheritedFrom?: string | undefined;
    constructor(name: string, visibility: Visibility, type: string, isStatic?: boolean, isReadonly?: boolean, defaultValue?: string | undefined, isInherited?: boolean, inheritedFrom?: string | undefined);
}
export declare class ClassInfo {
    name: string;
    isInterface: boolean;
    isAbstract: boolean;
    fields: Field[];
    methods: Method[];
    constructor(name: string, isInterface?: boolean, isAbstract?: boolean);
    addField(field: Field): void;
    addMethod(method: Method): void;
}
export declare class Relationship {
    from: string;
    to: string;
    type: RelationType;
    constructor(from: string, to: string, type: RelationType);
}
export declare class ClassDiagram {
    private classes;
    private relationships;
    addClass(classInfo: ClassInfo): void;
    addRelationship(relationship: Relationship): void;
    getClasses(): ClassInfo[];
    getRelationships(): Relationship[];
    getClass(name: string): ClassInfo | undefined;
    hasClass(name: string): boolean;
    clear(): void;
    inheritMembersFromParents(): void;
    private buildParentMap;
    private inheritFields;
    private inheritMethods;
}
//# sourceMappingURL=ClassDiagram.d.ts.map