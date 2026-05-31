const SECRET_PATTERNS = [
  /Authorization:\s*Bearer\s+[A-Za-z0-9_\-+=/.]+/gi,
  /\b(ed25519-private\/)[a-f0-9]{64}\b/gi,
  /\b((?:mnemonic|seed phrase|recovery phrase)\s*[:=]\s*)(['"]?)[a-z]+(?:\s+[a-z]+){11,23}/gi,
  /\b(0x)?[a-f0-9]{64}\b/gi,
  /\b(FIBER_SECRET_KEY_PASSWORD=)(['"])[^'"]+\2/gi,
  /\b(FIBER_SECRET_KEY_PASSWORD=)(['"]?)[^'"\s]+/gi,
];

export function redactSecrets(input: string): string {
  return SECRET_PATTERNS.reduce((value, pattern) => value.replace(pattern, redactMatch), input);
}

function redactMatch(match: string, ...args: unknown[]): string {
  const captures = args.slice(0, -2);
  const prefix = typeof captures[0] === "string" ? captures[0] : "";
  const quote = typeof captures[1] === "string" ? captures[1] : "";

  if (prefix) {
    return quote ? `${prefix}${quote}[REDACTED]${quote}` : `${prefix}[REDACTED]`;
  }

  if (/^Authorization:/i.test(match)) {
    return "Authorization: Bearer [REDACTED]";
  }

  return "[REDACTED]";
}
