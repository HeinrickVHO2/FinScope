const DANGEROUS_PATTERNS = [
  /ignore\s+(instruções|instrucoes|previous|anteriores|tudo)/i,
  /revele?\s+(seu\s+)?prompt/i,
  /finja\s+que\s+(você\s+)?[ée]/i,
  /você\s+agora\s+[ée]/i,
  /esqueça\s+(tudo|instruções|instrucoes)/i,
  /system\s*[:]\s*/i,
  /assistant\s*[:]\s*/i,
  /new\s+instructions/i,
  /desconsidera?\s+(as\s+)?regras/i,
  /não\s+siga\s+as\s+regras/i,
];

const MAX_INPUT_LENGTH = 500;

export function sanitizeUserInput(input: string): { clean: string; isDangerous: boolean; reason?: string } {
  // Trim whitespace
  let clean = input.trim();

  // Check length
  if (clean.length > MAX_INPUT_LENGTH) {
    clean = clean.substring(0, MAX_INPUT_LENGTH);
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        clean,
        isDangerous: true,
        reason: "prompt_injection_attempt"
      };
    }
  }

  return {
    clean,
    isDangerous: false
  };
}

export function generateSafeRejectionMessage(): string {
  const messages = [
    "Desculpe, não consigo processar essa solicitação. Posso ajudar com alguma questão financeira?",
    "Essa mensagem parece fugir do meu escopo. Como posso ajudar com suas finanças?",
    "Sou especializado em finanças pessoais e empresariais. Como posso auxiliar nisso?",
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}
