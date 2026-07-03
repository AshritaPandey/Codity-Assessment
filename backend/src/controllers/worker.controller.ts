import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getWorkers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const workers = await prisma.worker.findMany({
      orderBy: { lastHeartbeat: 'desc' },
    });
    res.json(workers);
  } catch (error) {
    next(error);
  }
};
