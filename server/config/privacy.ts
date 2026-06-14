/**
 * Privacy Mode — local-only processing enforcement.
 *
 * GAEA_PRIVACY=strict  →  all cloud calls blocked, local providers only
 * GAEA_PRIVACY=standard (default) → normal operation
 */

export type PrivacyMode = 'strict' | 'standard';

const PRIVACY_ENV = 'GAEA_PRIVACY';

export function getPrivacyMode(): PrivacyMode {
  const val = process.env[PRIVACY_ENV];
  if (val === 'strict') return 'strict';
  return 'standard';
}

export function isStrictPrivacy(): boolean {
  return getPrivacyMode() === 'strict';
}

export function isProviderLocalOnly(provider: string): boolean {
  return provider === 'ollama' || provider === 'lmstudio';
}

export function requireLocalProvider(provider: string): void {
  if (isStrictPrivacy() && !isProviderLocalOnly(provider)) {
    throw new Error(
      `[Privacy] Strict mode active (GAEA_PRIVACY=strict). ` +
      `Cloud provider "${provider}" is blocked. Use ollama or lmstudio.`
    );
  }
}

export function requireNotStrict(operation: string): void {
  if (isStrictPrivacy()) {
    throw new Error(
      `[Privacy] Strict mode: "${operation}" is blocked — it sends data to cloud services.`
    );
  }
}

export function listActiveCloudProviders(): string[] {
  try {
    const { loadKeys } = require('./keys');
    const keys = loadKeys();
    const providers: string[] = [];
    if (keys.DEEPSEEK_API_KEY) providers.push('deepseek');
    return providers;
  } catch {
    return [];
  }
}
