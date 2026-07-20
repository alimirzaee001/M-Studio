import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { createMediaSchema, normalizeClickableMedia, reorderSchema } from '../validation/schemas';
import { processImageUpload, processMediaFile, deleteUploadedFile } from '../services/mediaProcessor';
import { serializeMedia } from '../utils/serializers';
import { getParamId } from '../utils/params';

type UploadedFiles = {
  media_file?: Express.Multer.File[];
  target_media_file?: Express.Multer.File[];
};

export async function createMedia(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sectionId = getParamId(req.params.section_id);
    const files = req.files as UploadedFiles | undefined;

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      throw new AppError(404, 'Section not found');
    }

    const body = {
      media_type: req.body.media_type ?? 'image',
      media_url: req.body.media_url,
      title: req.body.title,
      body: req.body.body,
      size: req.body.size !== undefined && req.body.size !== '' ? Number(req.body.size) : undefined,
      color: req.body.color || undefined,
      is_clickable: req.body.is_clickable === 'true' || req.body.is_clickable === true,
      target_media_url: req.body.target_media_url,
      sort_order: req.body.sort_order !== undefined ? Number(req.body.sort_order) : undefined,
    };

    const data = createMediaSchema.parse(body);
    const normalized = normalizeClickableMedia(data);

    let mediaUrl = normalized.media_url ?? '';
    let targetMediaUrl = normalized.target_media_url ?? null;
    let isClickable = normalized.is_clickable ?? false;
    const title = normalized.title?.trim() || null;
    const paragraphBody = normalized.body?.trim() || null;
    const size = normalized.size ?? null;
    const color = normalized.color ?? null;

    if (data.media_type === 'image') {
      const mediaFile = files?.media_file?.[0];
      if (!mediaFile) {
        throw new AppError(400, 'media_file is required for image uploads');
      }

      const targetFile = files?.target_media_file?.[0];

      if (normalized.is_clickable && !targetFile && !normalized.target_media_url) {
        throw new AppError(
          400,
          'target_media_file is required when is_clickable is true for image uploads',
        );
      }

      const processed = await processMediaFile(mediaFile.path, targetFile?.path);
      mediaUrl = processed.mediaUrl;
      targetMediaUrl = normalized.is_clickable ? processed.targetMediaUrl : null;

      if (normalized.is_clickable && !targetMediaUrl) {
        throw new AppError(
          400,
          'target_media_file is required when is_clickable is true for image uploads',
        );
      }
    } else if (data.media_type === 'black_rectangle') {
      const mediaFile = files?.media_file?.[0];
      if (!mediaFile) {
        throw new AppError(400, 'media_file is required for black_rectangle');
      }

      mediaUrl = await processImageUpload(mediaFile.path, {
        maxWidth: 3840,
        quality: 90,
      });
      isClickable = true;
      targetMediaUrl = null;
    } else if (data.media_type === 'white_rectangle') {
      mediaUrl = '';
      isClickable = false;
      targetMediaUrl = null;
    } else if (data.media_type === 'paragraph') {
      mediaUrl = '';
      isClickable = false;
      targetMediaUrl = null;
    }

    let sortOrder = normalized.sort_order;
    if (sortOrder === undefined) {
      const lastMedia = await prisma.media.findFirst({
        where: { sectionId },
        orderBy: { sortOrder: 'desc' },
      });
      sortOrder = lastMedia ? lastMedia.sortOrder + 1 : 0;
    }

    const media = await prisma.media.create({
      data: {
        sectionId,
        mediaType: normalized.media_type ?? 'image',
        mediaUrl,
        title,
        body: paragraphBody,
        size,
        color,
        isClickable,
        targetMediaUrl,
        sortOrder,
      },
    });

    res.status(201).json(serializeMedia(media));
  } catch (err) {
    next(err);
  }
}

export async function reorderMedia(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const mediaId = getParamId(req.params.media_id);
    const { items } = reorderSchema.parse(req.body);

    const mediaItem = await prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!mediaItem) {
      throw new AppError(404, 'Media not found');
    }

    const sectionId = mediaItem.sectionId;
    const mediaIds = items.map((item) => item.id);

    const mediaItems = await prisma.media.findMany({
      where: { id: { in: mediaIds }, sectionId },
    });

    if (mediaItems.length !== mediaIds.length) {
      throw new AppError(400, 'One or more media items do not belong to this section');
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.media.update({
          where: { id: item.id },
          data: { sortOrder: item.sort_order },
        }),
      ),
    );

    const updatedMedia = await prisma.media.findMany({
      where: { sectionId },
      orderBy: { sortOrder: 'asc' },
    });

    res.json(updatedMedia.map(serializeMedia));
  } catch (err) {
    next(err);
  }
}

export async function deleteMedia(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const mediaId = getParamId(req.params.media_id);

    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      throw new AppError(404, 'Media not found');
    }

    deleteUploadedFile(media.mediaUrl);
    deleteUploadedFile(media.targetMediaUrl);

    await prisma.media.delete({
      where: { id: mediaId },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
