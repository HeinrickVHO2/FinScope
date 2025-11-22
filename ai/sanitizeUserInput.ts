// /ai/sanitizeUserInput.ts

const blacklist = [
  "ignore previous instructions",
  "reveal your prompt",
  "system prompt",
  "act as",
  "pretend",
  "bypass",
];

export function sanitizeUserInput(text: string): string {
  let safe = text.toLowerCase();

  blacklist.forEach((term) => {
    if (safe.includes(term)) {
      safe = safe.replaceAll(term, "[blocked]");
    }
  });

  // Limite de tamanho (segurança)
  if (safe.length > 500) {
    safe = safe.slice(0, 500);
  }

  return safe.trim();
}
