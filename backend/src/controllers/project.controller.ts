import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

const createProjectSchema = z.object({
  name: z.string().min(1),
  organizationId: z.string().uuid(),
});

export const createProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, organizationId } = createProjectSchema.parse(req.body);

    const project = await prisma.project.create({
      data: {
        name,
        organizationId,
      },
    });

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
};

export const getProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.query;

    const projects = await prisma.project.findMany({
      where: organizationId ? { organizationId: String(organizationId) } : undefined,
    });

    res.json(projects);
  } catch (error) {
    next(error);
  }
};
