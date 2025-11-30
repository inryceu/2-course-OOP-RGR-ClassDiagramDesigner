import { Field, Method, Parameter, Visibility } from '../models/ClassDiagram.js';
import { cleanString } from './stringUtils.js';
export function parseVisibility(visibilityStr, defaultVisibility = Visibility.PUBLIC) {
    const lower = visibilityStr.toLowerCase();
    if (lower === 'private')
        return Visibility.PRIVATE;
    if (lower === 'protected')
        return Visibility.PROTECTED;
    if (lower === 'internal' || lower === 'package')
        return Visibility.PACKAGE;
    return defaultVisibility;
}
export function parseTypeScriptParameters(paramsStr) {
    if (!paramsStr.trim())
        return [];
    const parameters = [];
    const paramParts = paramsStr.split(',');
    for (const part of paramParts) {
        const trimmed = part.trim();
        if (!trimmed)
            continue;
        const paramMatch = /(\w+)(\?)?:\s*([^=]+)(?:\s*=\s*(.+))?/.exec(trimmed);
        if (paramMatch) {
            const paramName = paramMatch[1];
            const isOptional = !!paramMatch[2];
            let paramType = cleanString(paramMatch[3]);
            const defaultValue = paramMatch[4]?.trim();
            if (isOptional)
                paramType += '?';
            parameters.push(new Parameter(paramName, paramType, defaultValue));
        }
        else {
            const jsParams = parseJavaScriptParameters(trimmed);
            jsParams.forEach(param => parameters.push(param));
        }
    }
    return parameters;
}
export function parseJavaScriptParameters(paramsStr) {
    if (!paramsStr || paramsStr.trim() === '')
        return [];
    const parameters = [];
    const params = paramsStr.split(',');
    for (const param of params) {
        const trimmed = param.trim();
        if (!trimmed)
            continue;
        const parts = trimmed.split('=');
        const paramName = parts[0].trim();
        const defaultValue = parts.length > 1 ? parts[1].trim() : undefined;
        parameters.push(new Parameter(paramName, 'any', defaultValue));
    }
    return parameters;
}
export function parseCppParameters(paramsStr) {
    if (!paramsStr.trim()) {
        return [];
    }
    const parameters = [];
    const paramParts = paramsStr.split(',');
    for (const part of paramParts) {
        const trimmed = part.trim();
        if (!trimmed)
            continue;
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
export function parseCSharpParameters(paramsStr) {
    if (!paramsStr.trim()) {
        return [];
    }
    const parameters = [];
    const paramParts = paramsStr.split(',');
    for (const part of paramParts) {
        const trimmed = part.trim();
        if (!trimmed) {
            continue;
        }
        const paramMatch = /(ref|out|in|params)?\s*([\w<>\[\],\s]+?)\s+(\w+)(?:\s*=\s*(.+))?/.exec(trimmed);
        if (paramMatch) {
            const modifier = paramMatch[1];
            const typePart = cleanString(paramMatch[2]);
            const paramType = modifier ? `${modifier} ${typePart}` : typePart;
            const paramName = paramMatch[3];
            const defaultValue = paramMatch[4]?.trim();
            parameters.push(new Parameter(paramName, paramType, defaultValue));
        }
    }
    return parameters;
}
export function addConstructorToClass(paramsStr, visibility, classInfo, parseParams) {
    const exists = classInfo.methods.some(m => m.name === classInfo.name || m.name === 'constructor');
    if (exists) {
        return;
    }
    const parameters = parseParams(paramsStr);
    classInfo.addMethod(new Method(classInfo.name, visibility, '', parameters));
}
export function extractConstructorParams(statement, classInfo) {
    const params = statement.substring(statement.indexOf('(') + 1, statement.lastIndexOf(')'));
    if (!params.trim())
        return;
    const parts = params.split(',');
    parts.forEach(part => {
        const trimmed = part.trim();
        if (!trimmed)
            return;
        const paramMatch = /^(?:(public|private|protected)\s+)?(readonly\s+)?(\w+)(\?)?\s*:\s*([^,)]+)/.exec(trimmed);
        if (!paramMatch)
            return;
        const visibilityToken = paramMatch[1];
        const readonlyToken = paramMatch[2];
        const fieldName = paramMatch[3];
        const isOptional = !!paramMatch[4];
        const fieldTypeRaw = paramMatch[5];
        if (!visibilityToken && !readonlyToken)
            return;
        const visibility = visibilityToken ? parseVisibility(visibilityToken) : Visibility.PUBLIC;
        const isReadonly = !!readonlyToken;
        const fieldType = isOptional ? `${cleanString(fieldTypeRaw)}?` : cleanString(fieldTypeRaw);
        const exists = classInfo.fields.some(f => f.name === fieldName);
        if (!exists) {
            classInfo.addField(new Field(fieldName, visibility, fieldType, false, isReadonly));
        }
    });
}
export function splitFieldDeclarations(fieldsStr) {
    const fields = [];
    let currentField = '';
    let depth = 0;
    for (let i = 0; i < fieldsStr.length; i++) {
        const char = fieldsStr[i];
        if (char === '(' || char === '<') {
            depth++;
        }
        else if (char === ')' || char === '>') {
            depth--;
        }
        else if (char === ',' && depth === 0) {
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
export function parseFieldDeclaration(fieldDecl) {
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
export function shouldSkipMethod(methodName, parentName) {
    const normalized = methodName.toLowerCase();
    return methodName === parentName ||
        methodName === `~${parentName}` ||
        normalized === 'constructor' ||
        normalized === 'destructor';
}
export function filterControlFlowKeywords(methodName) {
    return ['if', 'for', 'while', 'switch', 'catch', 'get', 'set'].includes(methodName);
}
//# sourceMappingURL=parserHelpers.js.map