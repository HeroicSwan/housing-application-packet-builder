export const secretPatterns = [
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["Cerebras API key", /\bcsk-[A-Za-z0-9]{20,}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ["Google API key", /\b(?:AIza|AQ\.)[A-Za-z0-9_-]{20,}\b/],
  ["Groq API key", /\bgsk_[A-Za-z0-9]{20,}\b/],
  ["Mistral API key", /\bMISTRAL_API_KEY\s*[:=]\s*["']?[A-Za-z0-9_-]{24,}/i],
  ["OpenAI-style API key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["SambaNova API key", /\bSAMBANOVA_API_KEY\s*[:=]\s*["']?[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
];

const credentialAssignment = /["']?([A-Z][A-Z0-9_]*(?:API_KEY|SECRET|PASSWORD|TOKEN|ACCESS_KEY|ENCRYPTION_KEY))["']?\s*[:=]\s*["']?([^"'\s,;}#]+)/g;
const safeAssignmentValue = /^(?:\$|\\|<|replace[-_]|your[-_]|example[-_]|demo-only[-_]|build-only[-_]|ci-session[-_]|synthetic[-_]|test[-_]|dummy[-_]|not-a[-_]|change-?me|process\.|Buffer\.|crypto\.|z\.|input\.|env\.)/i;

export function findSecretCategories(line) {
  const categories = new Set(secretPatterns.filter(([, pattern]) => pattern.test(line)).map(([category]) => category));
  for (const match of line.matchAll(credentialAssignment)) {
    const [, variable, value] = match;
    if (value.length >= 16 && !safeAssignmentValue.test(value)) categories.add(`${variable} assignment`);
  }
  return [...categories];
}
