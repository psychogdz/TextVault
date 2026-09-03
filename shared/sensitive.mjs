// Sensitive-content detection (shared main/renderer/tests).
//
// This is a privacy AID, not a guarantee (SECURITY.md §21): detection is
// deliberately conservative, produces false positives/negatives, and never
// destroys or blocks data — it only flags items so the UI can warn and the
// retention/privacy settings can react. No content ever leaves the device.

const PATTERNS = [
  { kind: 'private-key', re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/ },
  { kind: 'api-key', re: /\b(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/ },
  { kind: 'bearer-token', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/ },
  { kind: 'credential', re: /\b(?:password|passwd|pwd)\b\s*[:=]\s*\S{6,}/i },
  { kind: 'auth-header', re: /\bAuthorization\s*:\s*\S{10,}/i },
];

/**
 * Detect potentially sensitive content.
 * @param {string} text
 * @returns {{ sensitive: boolean, kinds: string[] }}
 */
export function detectSensitive(text = '') {
  const s = String(text);
  const kinds = [];
  for (const { kind, re } of PATTERNS) {
    if (re.test(s)) kinds.push(kind);
  }
  return { sensitive: kinds.length > 0, kinds };
}

/** Test-only hook: inspect the active pattern kinds (never the matched text). */
export function sensitiveKinds() {
  return PATTERNS.map((p) => p.kind);
}
