import request from 'supertest';
import app from '../app';
import prisma from '../utils/prisma';

// Mock prisma for unit tests
jest.mock('../utils/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  queue: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  job: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  }
}));

describe('Authentication API', () => {
  it('should register a new user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'test-id', email: 'test@example.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('userId');
  });

  it('should not register if user exists', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'test-id' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(400);
  });
});
