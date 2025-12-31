/**
 * From:
 *   https://stest29-prod-cme7l40wy000-34wyy9n1q-shuchangs-projects.vercel.app
 * To:
 *  https:// stest29-prod-cme7l40wy000.vercel.app
 *
 * TODO: It's not working for personal vercel accounts,
 * for personal vercel accounts, the domain is like:
 * https://prod-cmgxcz30t000.vercel.app
 */
export function toBaseVercelHost(url: string): string {
  if (process.env.NODE_ENV !== 'development') {
    return url;
  }
  const parsed = new URL(url);
  const parts = parsed.hostname.split('-');

  // Always keep first 3 segments, then add correct base domain
  const hostPrefix = parts.slice(0, 3).join('-');
  const baseDomain = 'vercel.app';

  return `${parsed.protocol}//${hostPrefix}.${baseDomain}`;
}

/**
 * Normalizes environment settings to handle both old (flat) and new (preview/production) structures
 * @param envSettings The environment settings object from document.meta.envSettings
 * @param environment The target environment ('preview' or 'production'), defaults to 'preview'
 * @returns A flat object with environment variables
 */
export function normalizeEnvSettings(
  envSettings: any,
  environment: 'preview' | 'production' = 'preview'
): Record<string, any> {
  if (!envSettings || typeof envSettings !== 'object') {
    return {};
  }

  // Check if using new structure (has preview or production keys)
  if (envSettings.preview || envSettings.production) {
    const targetEnv = envSettings[environment] || {};

    return targetEnv;
  }

  // Old structure: flat key-value pairs (treat as preview)
  if (environment === 'preview') {
    return envSettings;
  } else {
    return {};
  }
}
