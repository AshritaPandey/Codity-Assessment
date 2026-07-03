import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

const createJobSchema = z.object({
  queueId: z.string().uuid(),
  type: z.enum(['IMMEDIATE', 'SCHEDULED', 'RECURRING', 'BATCH']).default('IMMEDIATE'),
  payload: z.any(), // JSON
  priority: z.number().int().default(0),
  runAt: z.string().datetime().optional(),
  cron: z.string().optional(),
  batchId: z.string().optional(),
});

export const createJob = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createJobSchema.parse(req.body);

    const queue = await prisma.queue.findFirst({
      where: {
        id: data.queueId,
        project: {
          organization: {
            users: { some: { userId: req.user?.id } }
          }
        }
      }
    });

    if (!queue) {
      return res.status(403).json({ error: 'Not authorized to create jobs in this queue' });
    }

    const job = await prisma.job.create({
      data: {
        ...data,
        status: data.runAt || data.cron ? 'SCHEDULED' : 'QUEUED',
      },
    });

    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
};

export const getJobs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { queueId, status, page = '1', limit = '10' } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const userOrgs = await prisma.organizationUser.findMany({ where: { userId: req.user?.id } });
    const orgIds = userOrgs.map(o => o.organizationId);

    const where: any = {
      queue: { project: { organizationId: { in: orgIds } } }
    };
    
    if (queueId) where.queueId = String(queueId);
    if (status) where.status = String(status);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          executions: {
            orderBy: { startedAt: 'desc' },
            take: 1,
          }
        }
      }),
      prisma.job.count({ where }),
    ]);

    res.json({
      data: jobs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const retryJob = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({ where: { id: String(id) } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'FAILED' && job.status !== 'DLQ') {
      return res.status(400).json({ error: 'Only FAILED or DLQ jobs can be retried' });
    }

    const updatedJob = await prisma.job.update({
      where: { id: String(id) },
      data: {
        status: 'QUEUED',
        attempts: 0,
        runAt: new Date(),
      },
    });

    res.json(updatedJob);
  } catch (error) {
    next(error);
  }
};

export const getJobStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userOrgs = await prisma.organizationUser.findMany({ where: { userId: req.user?.id } });
    const orgIds = userOrgs.map(o => o.organizationId);

    const jobs = await prisma.job.groupBy({
      by: ['status'],
      where: { queue: { project: { organizationId: { in: orgIds } } } },
      _count: { id: true }
    });

    const stats = jobs.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    res.json(stats);
  } catch (error) {
    next(error);
  }
};
