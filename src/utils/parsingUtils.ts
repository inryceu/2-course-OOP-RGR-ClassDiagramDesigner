export function isRegexStart(code: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && /\s/.test(code[i])) i--;
  if (i < 0) return true;

  const char = code[i];
  
  if (['=', ':', '(', ',', '[', '?', '!', '&', '|', '{', ';', '^', '~', '*', '+', '-', '/'].includes(char)) {
    return true;
  }

  let word = '';
  while (i >= 0 && /[a-zA-Z0-9_$]/.test(code[i])) {
    word = code[i] + word;
    i--;
  }
  
  const keywords = ['return', 'throw', 'case', 'yield', 'typeof', 'void', 'delete', 'await', 'in', 'of', 'else'];
  return keywords.includes(word);
}

export function skipRegex(code: string, index: number): number {
  let i = index + 1;
  let inCharClass = false;

  while (i < code.length) {
    const char = code[i];
    
    if (char === '\\' && i + 1 < code.length) {
      i += 2;
      continue;
    }

    if (inCharClass) {
      if (char === ']') inCharClass = false;
    } else {
      if (char === '[') inCharClass = true;
      else if (char === '/') return i + 1;
    }
    
    if (char === '\n') return i;
    i++;
  }
  return i;
}

export function removeComments(code: string, options: {
  supportRegex?: boolean;
  supportTemplates?: boolean;
} = {}): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;

  while (i < code.length) {
    const char = code[i];
    const nextChar = i < code.length - 1 ? code[i + 1] : '';

    if (!inString && !inTemplate && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      result += char;
      i++;
      continue;
    }

    if (inString) {
      result += char;
      if (char === '\\' && i + 1 < code.length) {
        i++;
        result += code[i];
      } else if (char === stringChar) {
        inString = false;
      }
      i++;
      continue;
    }

    if (options.supportTemplates && !inString && !inTemplate && char === '`') {
      inTemplate = true;
      result += char;
      i++;
      continue;
    }

    if (inTemplate) {
      result += char;
      if (char === '\\' && i + 1 < code.length) {
        i++;
        result += code[i];
      } else if (char === '`') {
         inTemplate = false;
      }
      i++;
      continue;
    }

    if (options.supportRegex && !inString && !inTemplate && char === '/' && isRegexStart(code, i)) {
      const nextSlash = skipRegex(code, i);
      if (nextSlash > i) {
        result += code.substring(i, nextSlash);
        i = nextSlash;
        continue;
      }
    }

    if (!inString && !inTemplate && char === '/' && nextChar === '/') {
      while (i < code.length && code[i] !== '\n') i++;
      result += '\n';
      i++;
      continue;
    }

    if (!inString && !inTemplate && char === '/' && nextChar === '*') {
      i += 2;
      while (i < code.length - 1) {
        if (code[i] === '*' && code[i + 1] === '/') {
          i += 2;
          break;
        }
        i++;
      }
      result += ' ';
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

export function extractBalancedBraces(
  code: string, 
  startIndex: number, 
  options: {
    maxLength?: number;
    supportRegex?: boolean;
    supportTemplates?: boolean;
  } = {}
): string | null {
  let braceCount = 1;
  let i = startIndex;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let templateDepth = 0;
  const endLimit = options.maxLength ? Math.min(startIndex + options.maxLength, code.length) : code.length;

  while (i < endLimit && braceCount > 0) {
    const char = code[i];
    const nextChar = i < code.length - 1 ? code[i + 1] : '';

    if (!inString && !inTemplate && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      i++;
      continue;
    }
    
    if (inString) {
      if (char === '\\' && i + 1 < code.length) {
        i += 2;
        continue;
      }
      if (char === stringChar) {
        inString = false;
      }
      i++;
      continue;
    }

    if (options.supportTemplates && !inTemplate && !inString && char === '`') {
      inTemplate = true;
      templateDepth = 0;
      i++;
      continue;
    }
    
    if (inTemplate) {
      if (char === '\\' && i + 1 < code.length) {
        i += 2;
        continue;
      }
      
      if (char === '$' && nextChar === '{') {
        templateDepth++;
        i += 2;
        continue;
      }
      
      if (char === '{' && templateDepth > 0) {
        templateDepth++;
        i++;
        continue;
      }
      
      if (char === '}' && templateDepth > 0) {
        templateDepth--;
        i++;
        continue;
      }
      
      if (char === '`' && templateDepth === 0) {
        inTemplate = false;
      }
      i++;
      continue;
    }

    if (options.supportRegex && !inString && !inTemplate && char === '/' && isRegexStart(code, i)) {
       const nextI = skipRegex(code, i);
       if (nextI > i) {
           i = nextI;
           continue;
       }
    }

    if (!inString && !inTemplate && char === '/' && nextChar === '/') {
      while (i < endLimit && code[i] !== '\n') i++;
      i++;
      continue;
    }
    
    if (!inString && !inTemplate && char === '/' && nextChar === '*') {
      i += 2;
      while (i < endLimit - 1) {
        if (code[i] === '*' && code[i + 1] === '/') {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }

    if (!inString && !inTemplate) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
        }
    }

    i++;
  }

  if (braceCount === 0) {
    return code.substring(startIndex, i - 1);
  }
  
  return null;
}

export function getTopLevelStatements(content: string, options: {
  supportRegex?: boolean;
} = {}): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;

  while (i < content.length) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';

    if (!inString && !inTemplate && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      current += char;
      i++;
      continue;
    }
    if (inString) {
      if (char === stringChar && prevChar !== '\\') inString = false;
      current += char;
      i++;
      continue;
    }

    if (!inTemplate && !inString && char === '`') {
      inTemplate = true;
      current += char;
      i++;
      continue;
    }
    if (inTemplate) {
      if (char === '`' && prevChar !== '\\') inTemplate = false;
      current += char;
      i++;
      continue;
    }

    if (options.supportRegex && char === '/' && !inString && !inTemplate && isRegexStart(content, i)) {
       const nextI = skipRegex(content, i);
       current += content.substring(i, nextI);
       i = nextI;
       continue;
    }

    if (char === '/' && i + 1 < content.length && (content[i+1] === '/' || content[i+1] === '*')) {
       if (content[i+1] === '/') {
           while(i < content.length && content[i] !== '\n') i++;
       } else {
           i += 2;
           while(i < content.length - 1 && !(content[i] === '*' && content[i+1] === '/')) i++;
           i += 2;
       }
       continue;
    }

    if (char === '{') {
      if (depth === 0) {
        const trimmed = current.trim();
        if (trimmed) statements.push(trimmed);
        const blockEnd = skipBlock(content, i);
        i = blockEnd;
        current = '';
        continue;
      }
      depth++;
    } else if (char === '}') {
      if (depth > 0) depth--;
    }

    if (char === ';' && depth === 0) {
      current += char;
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);

  return statements;
}

export function skipBlock(content: string, startIndex: number): number {
  let depth = 0;
  let i = startIndex;
  while (i < content.length) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
        depth--;
        if (depth === 0) return i + 1;
    }
    i++;
  }
  return content.length;
}
