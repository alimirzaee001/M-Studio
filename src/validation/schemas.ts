import { z } from 'zod';

export const mediaTypeEnum = z.enum([
  'image',
  'video_link',
  'black_rectangle',
  'white_rectangle',
  'paragraph',
]);

export const mediaColorEnum = z.enum(['black', 'white']);

export const localeEnum = z.enum(['fa', 'en']);

export const createProjectSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  locale: localeEnum.optional().default('fa'),
  header_image_url: z
    .string()
    .min(1)
    .max(2048)
    .refine((val) => val.startsWith('/') || z.string().url().safeParse(val).success, {
      message: 'Must be a valid URL or a path starting with /',
    }),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createSectionSchema = z.object({
  title: z.string().min(1).max(255),
  sort_order: z.number().int().min(0).optional(),
});

export const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sort_order: z.number().int().min(0),
      }),
    )
    .min(1),
});

const baseMediaSchema = z.object({
  media_type: mediaTypeEnum.default('image'),
  media_url: z.string().url().max(2048).optional(),
  title: z.string().max(255).optional().nullable(),
  body: z.string().max(10000).optional().nullable(),
  size: z.number().int().min(20).max(600).optional().nullable(),
  color: mediaColorEnum.optional().nullable(),
  is_clickable: z.boolean().default(false),
  target_media_url: z.string().url().max(2048).optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
});

function refineMediaFields(
  data: z.infer<typeof baseMediaSchema>,
  ctx: z.RefinementCtx,
) {
  const isRectangle =
    data.media_type === 'black_rectangle' || data.media_type === 'white_rectangle';

  if (isRectangle) {
    if (!data.title?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'title is required for rectangle media',
        path: ['title'],
      });
    }
    if (data.size == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'size is required for rectangle media',
        path: ['size'],
      });
    }
  }

  if (data.media_type === 'paragraph') {
    if (!data.body?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'body is required for paragraph media',
        path: ['body'],
      });
    }
    if (data.size == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'size is required for paragraph media',
        path: ['size'],
      });
    }
    if (!data.color) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'color is required for paragraph media',
        path: ['color'],
      });
    }
  }

  if (data.media_type === 'video_link' && !data.media_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'media_url is required for video_link type',
      path: ['media_url'],
    });
  }
}

export const createMediaSchema = baseMediaSchema.superRefine(refineMediaFields);

export const updateMediaSchema = baseMediaSchema.partial().superRefine((data, ctx) => {
  if (data.is_clickable === true && !data.target_media_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'target_media_url is required when is_clickable is true',
      path: ['target_media_url'],
    });
  }
});

export function normalizeClickableMedia<T extends { is_clickable?: boolean; target_media_url?: string | null }>(
  data: T,
): T & { target_media_url: string | null } {
  const isClickable = data.is_clickable ?? false;
  return {
    ...data,
    is_clickable: isClickable,
    target_media_url: isClickable ? (data.target_media_url ?? null) : null,
  };
}

/** Admin-authored HTML for About / Contact pages (rendered as-is on the public site). */
export const updateSiteSettingsSchema = z
  .object({
    locale: localeEnum.optional(),
    about_html: z.string().max(200000).optional(),
    contact_html: z.string().max(200000).optional(),
  })
  .refine((data) => data.about_html !== undefined || data.contact_html !== undefined, {
    message: 'At least one of about_html or contact_html is required',
  });
