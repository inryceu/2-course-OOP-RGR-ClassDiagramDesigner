import { ClassDiagram } from '../models/ClassDiagram.js';

/**
 * Базовий інтерфейс для всіх парсерів мов програмування
 */
export interface IParser {
  /**
   * Парсить вихідний код та створює діаграму класів
   * @param sourceCode Вихідний код для парсингу
   * @param fileName Назва файлу (опціонально)
   * @returns Діаграма класів
   */
  parse(sourceCode: string, fileName?: string): ClassDiagram;

  /**
   * Перевіряє, чи може цей парсер обробити даний файл
   * @param fileName Назва файлу
   * @returns true, якщо парсер може обробити файл
   */
  canParse(fileName: string): boolean;
}

/**
 * Абстрактний базовий клас для парсерів
 */
export abstract class BaseParser implements IParser {
  protected supportedExtensions: string[] = [];

  abstract parse(sourceCode: string, fileName?: string): ClassDiagram;

  canParse(fileName: string): boolean {
    const extension = fileName.toLowerCase().split('.').pop() || '';
    return this.supportedExtensions.includes(extension);
  }

  /**
   * Видаляє коментарі з коду
   */
  protected removeComments(code: string, singleLinePrefix: string, multiLineStart: string, multiLineEnd: string): string {
    // Видаляємо багаторядкові коментарі
    const multiLineRegex = new RegExp(`${this.escapeRegex(multiLineStart)}[\\s\\S]*?${this.escapeRegex(multiLineEnd)}`, 'g');
    code = code.replace(multiLineRegex, '');
    
    // Видаляємо однорядкові коментарі
    const singleLineRegex = new RegExp(`${this.escapeRegex(singleLinePrefix)}.*$`, 'gm');
    code = code.replace(singleLineRegex, '');
    
    return code;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Очищає рядок від зайвих пробілів
   */
  protected cleanString(str: string): string {
    return str.trim().replace(/\s+/g, ' ');
  }
}

