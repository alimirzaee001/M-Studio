import { Request } from 'express';

export const LOCALES = ['fa', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fa';

export function isLocale(value: unknown): value is Locale {
  return value === 'fa' || value === 'en';
}

/** Resolve locale from query (?locale=), body.locale, or default fa. */
export function resolveLocale(
  req: Request,
  options: { fromBody?: boolean } = {},
): Locale {
  const fromQuery = req.query.locale;
  if (typeof fromQuery === 'string' && isLocale(fromQuery)) {
    return fromQuery;
  }

  if (options.fromBody) {
    const fromBody = (req.body as { locale?: unknown } | undefined)?.locale;
    if (isLocale(fromBody)) {
      return fromBody;
    }
  }

  return DEFAULT_LOCALE;
}
