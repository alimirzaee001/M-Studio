import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { createProjectSchema, updateProjectSchema } from '../validation/schemas';
import {
  serializeProjectAdmin,
  serializeProjectDetail,
  serializeProjectListItem,
} from '../utils/serializers';
import { getParamId } from '../utils/params';
import { resolveLocale } from '../utils/locale';

export async function listProjects(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const locale = resolveLocale(req);
    const projects = await prisma.project.findMany({
      where: { locale },
      orderBy: { createdAt: 'desc' },
    });
    res.json(projects.map(serializeProjectListItem));
  } catch (err) {
    next(err);
  }
}

export async function getProjectById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = getParamId(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' },
          include: {
            media: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!project) {
      throw new AppError(404, 'Project not found');
    }

    res.json(serializeProjectDetail(project));
  } catch (err) {
    next(err);
  }
}

export async function createProject(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = createProjectSchema.parse(req.body);
    const locale = data.locale ?? resolveLocale(req, { fromBody: true });

    const project = await prisma.project.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        headerImageUrl: data.header_image_url,
        locale,
      },
    });

    res.status(201).json(serializeProjectAdmin(project));
  } catch (err) {
    next(err);
  }
}

export async function updateProject(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = getParamId(req.params.id);
    const data = updateProjectSchema.parse(req.body);

    const existing = await prisma.project.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(404, 'Project not found');
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.header_image_url !== undefined && {
          headerImageUrl: data.header_image_url,
        }),
        ...(data.locale !== undefined && { locale: data.locale }),
      },
    });

    res.json(serializeProjectAdmin(project));
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = getParamId(req.params.id);
    const existing = await prisma.project.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(404, 'Project not found');
    }

    await prisma.project.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
