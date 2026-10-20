export function escapeMarkdown(value: string): string {
  const escaped = value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/\r?\n/gu, ' ');
  const markdownCharacters = new Set(['\\', '`', '*', '_', '{', '}', '[', ']', '(', ')', '#', '+', '.', '!', '|', '>', '~', '-']);
  return Array.from(escaped, (character) => markdownCharacters.has(character) ? `\\${character}` : character).join('');
}
