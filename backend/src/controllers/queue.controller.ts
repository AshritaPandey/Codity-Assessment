import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

const createQueueSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  priority: z.number().int().default(0),
  concurrencyLimit: z.number().int().min(1).default(10),
  maxRetries: z.number().int().min(0).default(3),
  retryStrategy: z.enum(['FIXED', 'LINEAR', 'EXPONENTIAL']).default('EXPONENTIAL'),
});

const updateQueueSchema = z.object({
  priority: z.number().int().optional(),
  concurrencyLimit: z.number().int().min(1).optional(),
  maxRetries: z.number().int().min(0).optional(),
  retryStrategy: z.enum(['FIXED', 'LINEAR', 'EXPONENTIAL']).optional(),
  isPaused: z.boolean().optional(),
});

export const createQueue = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createQueueSchema.parse(req.body);

    const queue = await prisma.queue.create({
      data,
    });

    res.status(201).json(queue);
  } catch (error) {
    next(error);
  }
};

export const getQueues = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;

    let userOrgs = await prisma.organizationUser.findMany({ where: { userId: req.user?.id } });
    
    // Auto-provision for existing accounts that don't have an organization yet
    if (userOrgs.length === 0 && req.user?.id) {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user) {
        await prisma.$transaction(async (tx) => {
          const org = await tx.organization.create({
            data: { name: `${user.email.split('@')[0]}'s Organization` }
          });
          await tx.organizationUser.create({
            data: { organizationId: org.id, userId: user.id, role: 'ADMIN' }
          });
          const project = await tx.project.create({
            data: { name: 'Default Project', organizationId: org.id }
          });
          await tx.queue.create({
            data: { name: 'default', projectId: project.id }
          });
        });
        userOrgs = await prisma.organizationUser.findMany({ where: { userId: req.user.id } });
      }
    }

    const orgIds = userOrgs.map(o => o.organizationId);

    const where: any = {
      project: { organizationId: { in: orgIds } }
    };
    if (projectId) {
      where.projectId = String(projectId);
    }

    const queues = await prisma.queue.findMany({ where });
    res.json(queues);
  } catch (error) {
    next(error);
  }
};

export const updateQueue = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = updateQueueSchema.parse(req.body);

    const queue = await prisma.queue.update({
      where: { id: String(id) },
      data,
    });

    res.json(queue);
  } catch (error) {
    next(error);
  }
};

export const getQueueStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const jobs = await prisma.job.groupBy({
      by: ['status'],
      where: { queueId: String(id) },
      _count: {
        id: true,
      },
    });

    const stats = jobs.reduce((acc: any, curr: any) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    res.json(stats);
  } catch (error) {
    next(error);
  }
};
