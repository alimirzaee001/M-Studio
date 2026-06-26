import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { createSectionSchema, reorderSchema } from '../validation/schemas';
import { serializeSection } from '../utils/serializers';
import { getParamId } from '../utils/params';
import { deleteUploadedFile } from '../services/mediaProcessor';

export async function createSection(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = createSectionSchema.parse(req.body);
    const projectId = getParamId(req.params.id);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new AppError(404, 'Project not found');
    }

    let sortOrder = data.sort_order;
    if (sortOrder === undefined) {
      const lastSection = await prisma.section.findFirst({
        where: { projectId },
        orderBy: { sortOrder: 'desc' },
      });
      sortOrder = lastSection ? lastSection.sortOrder + 1 : 0;
    }

    const section = await prisma.section.create({
      data: {
        projectId,
        title: data.title,
        sortOrder,
      },
      include: {
        media: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.status(201).json(serializeSection(section));
  } catch (err) {
    next(err);
  }
}

export async function reorderSections(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sectionId = getParamId(req.params.section_id);
    const { items } = reorderSchema.parse(req.body);

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      throw new AppError(404, 'Section not found');
    }

    const projectId = section.projectId;
    const sectionIds = items.map((item) => item.id);

    const sections = await prisma.section.findMany({
      where: { id: { in: sectionIds }, projectId },
    });

    if (sections.length !== sectionIds.length) {
      throw new AppError(400, 'One or more sections do not belong to this project');
    }

    await prisma.$transaction(
      items.map((item) =>
        prisma.section.update({
          where: { id: item.id },
          data: { sortOrder: item.sort_order },
        }),
      ),
    );

    const updatedSections = await prisma.section.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
      include: {
        media: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.json(updatedSections.map(serializeSection));
  } catch (err) {
    next(err);
  }
}

export async function updateSection(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sectionId = getParamId(req.params.section_id);
    const data = createSectionSchema.partial().parse(req.body);

    const existing = await prisma.section.findUnique({
      where: { id: sectionId },
    });

    if (!existing) {
      throw new AppError(404, 'Section not found');
    }

    const section = await prisma.section.update({
      where: { id: sectionId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.sort_order !== undefined && { sortOrder: data.sort_order }),
      },
      include: {
        media: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    res.json(serializeSection(section));
  } catch (err) {
    next(err);
  }
}

export async function deleteSection(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sectionId = getParamId(req.params.section_id);

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { media: true },
    });

    if (!section) {
      throw new AppError(404, 'Section not found');
    }

    for (const item of section.media) {
      deleteUploadedFile(item.mediaUrl);
      deleteUploadedFile(item.targetMediaUrl);
    }

    await prisma.section.delete({
      where: { id: sectionId },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
