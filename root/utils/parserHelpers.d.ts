import { Parameter, Visibility, ClassInfo } from '../models/ClassDiagram.js';
export declare function parseVisibility(visibilityStr: string, defaultVisibility?: Visibility): Visibility;
export declare function parseTypeScriptParameters(paramsStr: string): Parameter[];
export declare function parseJavaScriptParameters(paramsStr: string): Parameter[];
export declare function parseCppParameters(paramsStr: string): Parameter[];
export declare function parseCSharpParameters(paramsStr: string): Parameter[];
export declare function addConstructorToClass(paramsStr: string, visibility: Visibility, classInfo: ClassInfo, parseParams: (params: string) => Parameter[]): void;
export declare function extractConstructorParams(statement: string, classInfo: ClassInfo): void;
export declare function splitFieldDeclarations(fieldsStr: string): string[];
export declare function parseFieldDeclaration(fieldDecl: string): {
    name: string;
    defaultValue?: string;
    extraPointers?: string;
};
export declare function shouldSkipMethod(methodName: string, parentName: string): boolean;
export declare function filterControlFlowKeywords(methodName: string): boolean;
//# sourceMappingURL=parserHelpers.d.ts.map