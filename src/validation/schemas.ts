import { z } from 'zod';

export const mediaTypeEnum = z.enum(['image', 'video_link']);

export const createProjectSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
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
  is_clickable: z.boolean().default(false),
  target_media_url: z.string().url().max(2048).optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
});

export const createMediaSchema = baseMediaSchema.superRefine((data, ctx) => {
  if (data.media_type === 'video_link' && !data.media_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'media_url is required for video_link type',
      path: ['media_url'],
    });
  }
});

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
