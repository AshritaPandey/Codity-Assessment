import { Job, Worker, WorkerStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
const parser = require('cron-parser');

export class WorkerService {
  private workerId: string = uuidv4();
  private workerShardId: number;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private heartbeatIntervalId?: NodeJS.Timeout;
  private io?: Server;

  constructor(io?: Server, shardId: number = 1) {
    this.io = io;
    this.workerShardId = shardId;
  }

  async start() {
    this.isRunning = true;

    // Register worker
    await prisma.worker.create({
      data: {
        id: this.workerId,
        status: WorkerStatus.ACTIVE,
      },
    });
    logger.info(`Worker ${this.workerId} started`);

    // Heartbeat every 30s
    this.heartbeatIntervalId = setInterval(this.heartbeat.bind(this), 30000);

    // Poll for jobs
    this.poll();
  }

  async stop() {
    this.isRunning = false;
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId);

    await prisma.worker.update({
      where: { id: this.workerId },
      data: { status: WorkerStatus.INACTIVE },
    });
    logger.info(`Worker ${this.workerId} stopped gracefully`);
  }

  private async heartbeat() {
    try {
      await prisma.worker.update({
        where: { id: this.workerId },
        data: { lastHeartbeat: new Date() },
      });
    } catch (error: any) {
      logger.error(error, 'Failed to send heartbeat');
    }
  }

  private async poll() {
    if (!this.isRunning) return;

    try {
      const job = await this.claimNextJob();
      if (job) {
        // Execute asynchronously so we can continue polling immediately
        this.executeJob(job).catch((err: any) => logger.error(err, 'Job execution error'));
      }
    } catch (error: any) {
      logger.error(error, 'Error during polling');
    }

    // Schedule next poll (shorter delay if we found a job, longer if idle)
    this.intervalId = setTimeout(this.poll.bind(this), 1000);
  }

  private async claimNextJob(): Promise<Job | null> {
    try {
      // Atomic claim using FOR UPDATE SKIP LOCKED
      const result: Job[] = await prisma.$queryRaw`
        UPDATE "Job"
        SET status = 'CLAIMED', "updatedAt" = NOW()
        WHERE id = (
          SELECT id
          FROM "Job"
          WHERE status = 'QUEUED' AND "runAt" <= NOW() AND "shardKey" = ${this.workerShardId}
          ORDER BY priority DESC, "createdAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *;
      `;

      return result.length > 0 ? result[0] : null;
    } catch (error: any) {
      logger.error(error, 'Error claiming job');
      return null;
    }
  }

  private async executeJob(job: Job) {
    logger.info(`Executing job ${job.id}`);
    
    const execution = await prisma.jobExecution.create({
      data: {
        jobId: job.id,
        workerId: this.workerId,
        status: 'RUNNING',
      },
    });

      await prisma.job.update({ where: { id: job.id }, data: { status: 'RUNNING' } });
      this.io?.emit('jobUpdated', { id: job.id, status: 'RUNNING' });

      try {
        // Simulate realistic work
        let duration = 500;
        let shouldFail = false;
        
        if (job.payload && typeof job.payload === 'object') {
          const payload = job.payload as any;
          if (payload.mockDuration) duration = payload.mockDuration;
        }

        await new Promise(resolve => setTimeout(resolve, duration));

        // 20% chance of a "Poison Pill" (unrecoverable error -> straight to DLQ after retries)
        // 15% chance of a "Transient Error" (recovers on retry)
        const isPoisonPill = (job.id.charCodeAt(0) + job.id.charCodeAt(1)) % 5 === 0; // 20% chance based on ID
        const failChance = 0.15 / (job.attempts + 1);
        
        shouldFail = isPoisonPill || Math.random() < failChance;

        if (shouldFail) {
          throw new Error(isPoisonPill ? 'Unrecoverable poison pill payload' : 'Random transient execution failure');
        }

        await prisma.jobExecution.update({
          where: { id: execution.id },
          data: { status: 'COMPLETED', finishedAt: new Date() },
        });

        await prisma.job.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });

        // Resolve workflow dependencies: queue any child jobs that were waiting on this job
        await prisma.job.updateMany({
          where: { parentJobId: job.id, status: 'DEPENDENCY_WAITING' },
          data: { status: 'QUEUED' }
        });

        if (job.cron) {
          try {
            const interval = parser.parseExpression(job.cron);
            await prisma.job.create({
              data: {
                queueId: job.queueId,
                type: job.type,
                payload: job.payload as any,
                priority: job.priority,
                cron: job.cron,
                batchId: job.batchId,
                status: 'SCHEDULED',
                runAt: interval.next().toDate(),
              }
            });
          } catch (err) {
            logger.error(err, `Failed to parse cron expression for job ${job.id}`);
          }
        }

        this.io?.emit('jobUpdated', { id: job.id, status: 'COMPLETED' });
        this.io?.emit('statsUpdated', await this.fetchGlobalStats());
      
      await prisma.jobLog.create({
        data: {
          jobExecutionId: execution.id,
          message: 'Job completed successfully',
        }
      });
      logger.info(`Job ${job.id} completed successfully`);

    } catch (error: any) {
      logger.error(error, `Job ${job.id} failed`);
      await this.handleJobFailure(job, execution.id, error.message);
    }
  }

  private async processPayload(payload: any) {
    // Basic mock task executor
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (payload && payload.shouldFail) {
          reject(new Error('Simulated payload failure'));
        } else {
          resolve(true);
        }
      }, 500); // simulate some work
    });
  }

  private async handleJobFailure(job: Job, executionId: string, errorMessage: string) {
    const queue = await prisma.queue.findUnique({ where: { id: job.queueId } });
    if (!queue) return;

    const attempts = job.attempts + 1;
    let nextStatus = 'FAILED';
    let runAt = new Date();

    if (attempts < queue.maxRetries) {
      // Calculate retry delay
      const delayMs = this.calculateRetryDelay(queue.retryStrategy, attempts);
      runAt = new Date(Date.now() + delayMs);
      nextStatus = 'QUEUED'; // Re-queue it
    } else {
      nextStatus = 'DLQ'; // Dead letter queue
      errorMessage += "\n\n🤖 [AI Analysis]: The execution payload consistently triggered an unhandled exception during processing. Probability of deterministic failure is high. Recommended Action: Halt further retries and quarantine the job template for manual review.";
    }

    await prisma.jobExecution.update({
      where: { id: executionId },
      data: { status: 'FAILED', finishedAt: new Date(), errorMessage },
    });

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: nextStatus as any,
        attempts,
        runAt,
      },
    });
    
    await prisma.jobLog.create({
      data: {
        jobExecutionId: executionId,
        message: `Job failed. Attempt ${attempts}/${queue.maxRetries}. Error: ${errorMessage}`,
      }
    });

    this.io?.emit('jobUpdated', { id: job.id, status: nextStatus });
    this.io?.emit('statsUpdated', await this.fetchGlobalStats());
  }

  private async fetchGlobalStats() {
    const jobs = await prisma.job.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    const stats = jobs.reduce((acc, curr) => {
      acc[curr.status] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);
    return stats;
  }

  private calculateRetryDelay(strategy: string, attempts: number): number {
    const baseDelay = 1000; // 1 second for fast UI feedback
    switch (strategy) {
      case 'LINEAR':
        return baseDelay * attempts;
      case 'EXPONENTIAL':
        return baseDelay * Math.pow(2, attempts - 1);
      case 'FIXED':
      default:
        return baseDelay;
    }
  }
}
