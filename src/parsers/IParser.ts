import { ClassDiagram } from '../models/ClassDiagram.js';

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
    const multiLineRegex = new RegExp(`${this.escapeRegex(multiLineStart)}[\\s\\S]*?${this.escapeRegex(multiLineEnd)}`, 'g');
    code = code.replace(multiLineRegex, '');
    const singleLineRegex = new RegExp(`${this.escapeRegex(singleLinePrefix)}.*$`, 'gm');
    code = code.replace(singleLineRegex, '');
    return code;
  }

  protected escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  protected cleanString(str: string): string {
    return str.trim().replace(/\s+/g, ' ');
  }
}

