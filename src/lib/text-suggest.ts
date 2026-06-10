// Lightweight, no-AI contextual suggestion helpers.
// Smart title-casing that respects Portuguese small words ("de", "da", "do",
// "e", etc.), Roman numerals, common acronyms, and parentheticals.

const PT_STOPWORDS = new Set([
  "a", "as", "o", "os", "à", "às", "ao", "aos",
  "de", "da", "do", "das", "dos", "del",
  "e", "em", "no", "na", "nos", "nas", "num", "numa",
  "por", "pra", "para", "com", "sem",
  "ou", "se", "que", "of", "the", "and", "in", "on", "of",
]);

const ROMAN = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;

export function smartTitleCase(input: string): string {
  if (!input) return input;
  // Collapse whitespace, trim
  const s = input.replace(/\s+/g, " ").trim();
  const words = s.split(" ");
  return words
    .map((w, i) => {
      const lower = w.toLocaleLowerCase("pt-BR");
      // Preserve fully uppercase short tokens (acronyms / Roman numerals)
      if (w.length <= 4 && w === w.toUpperCase() && /[A-Z]/.test(w)) return w;
      if (ROMAN.test(w)) return w.toUpperCase();
      if (i !== 0 && i !== words.length - 1 && PT_STOPWORDS.has(lower)) return lower;
      // Handle hyphenated and apostrophe words
      return lower.replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase("pt-BR"));
    })
    .join(" ");
}

// "MACHADO DE ASSIS" -> "Machado de Assis"; "machado, j." -> "Machado, J."
export function smartAuthorCase(input: string): string {
  if (!input) return input;
  return input
    .split(/(\s*[;,]\s*|\s+e\s+)/i)
    .map((part) => (/^\s*[;,]\s*|\s+e\s+$/i.test(part) ? part : smartTitleCase(part)))
    .join("");
}

// Returns a suggestion only if it differs meaningfully from input.
export function suggestTitle(input: string): string | null {
  const s = smartTitleCase(input);
  return s && s !== input.trim() ? s : null;
}
export function suggestAuthor(input: string): string | null {
  const s = smartAuthorCase(input);
  return s && s !== input.trim() ? s : null;
}
