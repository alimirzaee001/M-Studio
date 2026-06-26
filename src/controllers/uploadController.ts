import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { processImageUpload } from '../services/mediaProcessor';

export async function uploadImage(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError(400, 'No image file provided');
    }

    const url = await processImageUpload(req.file.path, {
      maxWidth: 1920,
      quality: 85,
    });

    res.status(201).json({ url });
  } catch (err) {
    next(err);
  }
}
