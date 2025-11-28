import { ClassDiagram } from '../models/ClassDiagram.js';
import { cleanString, escapeRegex } from '../utils/stringUtils.js';
import { removeComments } from '../utils/parsingUtils.js';

export interface IParser {
  parse(sourceCode: string, fileName?: string): ClassDiagram;
  canParse(fileName: string): boolean;
}

export abstract class BaseParser implements IParser {
  protected supportedExtensions: string[] = [];

  abstract parse(sourceCode: string, fileName?: string): ClassDiagram;

  canParse(fileName: string): boolean {
    const extension = fileName.toLowerCase().split('.').pop() || '';
    return this.supportedExtensions.includes(extension);
  }

  protected removeComments(code: string, singleLinePrefix: string, multiLineStart: string, multiLineEnd: string): string {
    const multiLineRegex = new RegExp(`${escapeRegex(multiLineStart)}[\\s\\S]*?${escapeRegex(multiLineEnd)}`, 'g');
    code = code.replace(multiLineRegex, '');
    const singleLineRegex = new RegExp(`${escapeRegex(singleLinePrefix)}.*$`, 'gm');
    code = code.replace(singleLineRegex, '');
    return code;
  }

  protected escapeRegex(str: string): string {
    return escapeRegex(str);
  }

  protected cleanString(str: string): string {
    return cleanString(str);
  }
}
