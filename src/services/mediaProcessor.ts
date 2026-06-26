import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// Prevent sharp/libvips from holding open file handles, which on Windows
// causes EPERM errors when deleting the original upload afterwards.
sharp.cache(false);

// Disable the libvips operation cache so it never keeps source files open.
sharp.cache(false);

const uploadsDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export type ProcessedMedia = {
  mediaUrl: string;
  targetMediaUrl: string | null;
};

async function processToWebP(
  inputPath: string,
  options: { maxWidth: number; quality: number },
): Promise<string> {
  const filename = `${path.basename(inputPath, path.extname(inputPath))}-${Date.now()}.webp`;
  const outputPath = path.join(uploadsDir, filename);

  // Read into a buffer so sharp/libvips doesn't keep the source file open.
  // On Windows an open handle makes the later unlink fail with EPERM.
  const inputBuffer = await fs.promises.readFile(inputPath);

  await sharp(inputBuffer)
    .resize({ width: options.maxWidth, withoutEnlargement: true })
    .webp({ quality: options.quality })
    .toFile(outputPath);

  await fs.promises.unlink(inputPath);

  return `/uploads/${filename}`;
}

export async function processImageUpload(
  inputPath: string,
  options: { maxWidth: number; quality: number },
): Promise<string> {
  return processToWebP(inputPath, options);
}

export async function processMediaFile(
  mediaFilePath: string,
  targetMediaFilePath?: string,
): Promise<ProcessedMedia> {
  const mediaUrl = await processToWebP(mediaFilePath, {
    maxWidth: 1200,
    quality: 80,
  });

  let targetMediaUrl: string | null = null;
  if (targetMediaFilePath) {
    targetMediaUrl = await processToWebP(targetMediaFilePath, {
      maxWidth: 3840,
      quality: 90,
    });
  }

  return { mediaUrl, targetMediaUrl };
}

export function deleteUploadedFile(url: string | null | undefined): void {
  if (!url || !url.startsWith('/uploads/')) return;

  const filePath = path.join(process.cwd(), url);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
