export declare function isRegexStart(code: string, index: number): boolean;
export declare function skipRegex(code: string, index: number): number;
export declare function removeComments(code: string, options?: {
    supportRegex?: boolean;
    supportTemplates?: boolean;
}): string;
export declare function extractBalancedBraces(code: string, startIndex: number, options?: {
    maxLength?: number;
    supportRegex?: boolean;
    supportTemplates?: boolean;
}): string | null;
export declare function getTopLevelStatements(content: string, options?: {
    supportRegex?: boolean;
}): string[];
export declare function skipBlock(content: string, startIndex: number): number;
//# sourceMappingURL=parsingUtils.d.ts.map