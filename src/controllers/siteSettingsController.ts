import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { updateSiteSettingsSchema } from '../validation/schemas';
import { serializeSiteSettings } from '../utils/serializers';
import { resolveLocale, Locale } from '../utils/locale';

async function getOrCreateSettings(locale: Locale) {
  return prisma.siteSettings.upsert({
    where: { locale },
    create: { id: locale, locale, aboutHtml: '', contactHtml: '' },
    update: {},
  });
}

export async function getSiteSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const locale = resolveLocale(req);
    const settings = await getOrCreateSettings(locale);
    res.json(serializeSiteSettings(settings));
  } catch (err) {
    next(err);
  }
}

export async function updateSiteSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = updateSiteSettingsSchema.parse(req.body);
    const locale = resolveLocale(req, { fromBody: true });

    const settings = await prisma.siteSettings.upsert({
      where: { locale },
      create: {
        id: locale,
        locale,
        aboutHtml: data.about_html ?? '',
        contactHtml: data.contact_html ?? '',
      },
      update: {
        ...(data.about_html !== undefined ? { aboutHtml: data.about_html } : {}),
        ...(data.contact_html !== undefined ? { contactHtml: data.contact_html } : {}),
      },
    });

    res.json(serializeSiteSettings(settings));
  } catch (err) {
    next(err);
  }
}
