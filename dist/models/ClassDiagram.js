import { shouldSkipMethod } from '../utils/parserHelpers.js';
export var Visibility;
(function (Visibility) {
    Visibility["PUBLIC"] = "+";
    Visibility["PRIVATE"] = "-";
    Visibility["PROTECTED"] = "#";
    Visibility["PACKAGE"] = "~";
})(Visibility || (Visibility = {}));
export var RelationType;
(function (RelationType) {
    RelationType["INHERITANCE"] = "inheritance";
    RelationType["IMPLEMENTATION"] = "implementation";
    RelationType["COMPOSITION"] = "composition";
    RelationType["AGGREGATION"] = "aggregation";
    RelationType["ASSOCIATION"] = "association";
    RelationType["DEPENDENCY"] = "dependency";
})(RelationType || (RelationType = {}));
export class Parameter {
    constructor(name, type, defaultValue) {
        this.name = name;
        this.type = type;
        this.defaultValue = defaultValue;
    }
}
export class Method {
    constructor(name, visibility, returnType, parameters = [], isStatic = false, isAbstract = false, isInherited = false, inheritedFrom) {
        this.name = name;
        this.visibility = visibility;
        this.returnType = returnType;
        this.parameters = parameters;
        this.isStatic = isStatic;
        this.isAbstract = isAbstract;
        this.isInherited = isInherited;
        this.inheritedFrom = inheritedFrom;
    }
}
export class Field {
    constructor(name, visibility, type, isStatic = false, isReadonly = false, defaultValue, isInherited = false, inheritedFrom) {
        this.name = name;
        this.visibility = visibility;
        this.type = type;
        this.isStatic = isStatic;
        this.isReadonly = isReadonly;
        this.defaultValue = defaultValue;
        this.isInherited = isInherited;
        this.inheritedFrom = inheritedFrom;
    }
}
export class ClassInfo {
    constructor(name, isInterface = false, isAbstract = false) {
        this.name = name;
        this.isInterface = isInterface;
        this.isAbstract = isAbstract;
        this.fields = [];
        this.methods = [];
    }
    addField(field) {
        this.fields.push(field);
    }
    addMethod(method) {
        this.methods.push(method);
    }
}
export class Relationship {
    constructor(from, to, type) {
        this.from = from;
        this.to = to;
        this.type = type;
    }
}
export class ClassDiagram {
    constructor() {
        this.classes = new Map();
        this.relationships = [];
    }
    addClass(classInfo) {
        this.classes.set(classInfo.name, classInfo);
    }
    addRelationship(relationship) {
        const exists = this.relationships.some(r => r.from === relationship.from &&
            r.to === relationship.to &&
            r.type === relationship.type);
        if (!exists) {
            this.relationships.push(relationship);
        }
    }
    getClasses() {
        return Array.from(this.classes.values());
    }
    getRelationships() {
        return this.relationships;
    }
    getClass(name) {
        return this.classes.get(name);
    }
    hasClass(name) {
        return this.classes.has(name);
    }
    clear() {
        this.classes.clear();
        this.relationships = [];
    }
    inheritMembersFromParents() {
        const parentMap = this.buildParentMap();
        this.classes.forEach((classInfo, className) => {
            const parents = parentMap.get(className);
            if (!parents || parents.length === 0)
                return;
            parents.forEach(parentName => {
                const parentClass = this.classes.get(parentName);
                if (!parentClass)
                    return;
                this.inheritFields(classInfo, parentClass, parentName);
                this.inheritMethods(classInfo, parentClass, parentName);
            });
        });
    }
    buildParentMap() {
        const parentMap = new Map();
        this.relationships.forEach(rel => {
            if (rel.type === RelationType.INHERITANCE || rel.type === RelationType.IMPLEMENTATION) {
                if (!parentMap.has(rel.from)) {
                    parentMap.set(rel.from, []);
                }
                parentMap.get(rel.from).push(rel.to);
            }
        });
        return parentMap;
    }
    inheritFields(classInfo, parentClass, parentName) {
        parentClass.fields.forEach(field => {
            if (field.visibility !== Visibility.PRIVATE) {
                const alreadyExists = classInfo.fields.some(f => f.name === field.name && !f.isInherited);
                if (!alreadyExists) {
                    const inheritedField = new Field(field.name, field.visibility, field.type, field.isStatic, field.isReadonly, field.defaultValue, true, parentName);
                    classInfo.addField(inheritedField);
                }
            }
        });
    }
    inheritMethods(classInfo, parentClass, parentName) {
        parentClass.methods.forEach(method => {
            if (method.visibility !== Visibility.PRIVATE && !shouldSkipMethod(method.name, parentName)) {
                const alreadyExists = classInfo.methods.some(m => m.name === method.name && !m.isInherited);
                if (!alreadyExists) {
                    const inheritedMethod = new Method(method.name, method.visibility, method.returnType, [...method.parameters], method.isStatic, method.isAbstract, true, parentName);
                    classInfo.addMethod(inheritedMethod);
                }
            }
        });
    }
}
//# sourceMappingURL=ClassDiagram.js.map