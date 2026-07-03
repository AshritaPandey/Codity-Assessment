import 'dotenv/config';
import app from './app';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { logger } from './utils/logger';
// import { connectRedis } from './utils/redis';
import prisma from './utils/prisma';
import { WorkerService } from './services/worker.service';

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL');

    // await connectRedis(); // Disabled for deployment since it's unused

    const httpServer = createServer(app);
    const io = new Server(httpServer, {
      cors: { origin: '*' }
    });

    io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);
      socket.on('disconnect', () => logger.info(`Client disconnected: ${socket.id}`));
    });

    // Spin up 4 workers to handle the 4 shards
    for (let i = 1; i <= 4; i++) {
      const worker = new WorkerService(io, i);
      worker.start();
    }

    httpServer.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });
  } catch (error: any) {
    logger.error(error, 'Failed to start server:');
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
