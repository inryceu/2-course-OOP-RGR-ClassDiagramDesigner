export function cleanString(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function shortenType(type: string, maxLength: number = 25): string {
  if (type.length > maxLength) {
    return type.substring(0, maxLength - 3) + '...';
  }
  return type;
}

export function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const width = ctx.measureText(text).width;
  if (width <= maxWidth) {
    return text;
  }
  
  let truncated = text;
  while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  
  return truncated + '...';
}

export function cleanType(type: string, modifiers: string[] = []): string {
  let result = type;
  modifiers.forEach(mod => {
    const regex = new RegExp(`\\b${mod}\\b`, 'g');
    result = result.replace(regex, '');
  });
  return cleanString(result);
}

export function cleanName(name: string): string {
  return name.replace(/[?;!]/g, '').trim();
}

export function extractContentBetweenAngles(str: string): string | null {
  const start = str.indexOf('<');
  const end = str.lastIndexOf('>');
  if (start !== -1 && end !== -1 && end > start) {
    return str.substring(start + 1, end);
  }
  return null;
}

