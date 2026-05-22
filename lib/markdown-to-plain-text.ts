export function markdownToPlainText(markdown: string): string {
  if (!markdown) return ''

  let text = markdown
    .replace(/\r\n/g, '\n')
    // fenced code blocks
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, '').trim())
    // inline code
    .replace(/`([^`]+)`/g, '$1')
    // images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // headings
    .replace(/^#{1,6}\s+/gm, '')
    // blockquotes
    .replace(/^>\s?/gm, '')
    // bold / italic / strikethrough
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    // unordered / ordered list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // table separators and markdown pipes
    .replace(/^\|?[\s:-]+\|[\s|:-]*$/gm, '')
    .replace(/\|/g, ' ')
    // horizontal rules
    .replace(/^\s*([-*_]){3,}\s*$/gm, '')

  // Normalize whitespace
  text = text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text
}
