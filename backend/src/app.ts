import express from 'express';
import cors from 'cors';
import { errorHandler } from './middlewares/error.middleware';
import authRoutes from './routes/auth.routes';
import projectRoutes from './routes/project.routes';
import queueRoutes from './routes/queue.routes';
import jobRoutes from './routes/job.routes';
import workerRoutes from './routes/worker.routes';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/workers', workerRoutes);

// Error handling
app.use(errorHandler);

export default app;
