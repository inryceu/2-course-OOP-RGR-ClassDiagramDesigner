import { cleanString, escapeRegex } from '../utils/stringUtils.js';
export class BaseParser {
    constructor() {
        this.supportedExtensions = [];
    }
    canParse(fileName) {
        const extension = fileName.toLowerCase().split('.').pop() || '';
        return this.supportedExtensions.includes(extension);
    }
    removeComments(code, singleLinePrefix, multiLineStart, multiLineEnd) {
        const multiLineRegex = new RegExp(`${escapeRegex(multiLineStart)}[\\s\\S]*?${escapeRegex(multiLineEnd)}`, 'g');
        code = code.replace(multiLineRegex, '');
        const singleLineRegex = new RegExp(`${escapeRegex(singleLinePrefix)}.*$`, 'gm');
        code = code.replace(singleLineRegex, '');
        return code;
    }
    escapeRegex(str) {
        return escapeRegex(str);
    }
    cleanString(str) {
        return cleanString(str);
    }
}
//# sourceMappingURL=IParser.js.map