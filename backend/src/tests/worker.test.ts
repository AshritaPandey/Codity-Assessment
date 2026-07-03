import { WorkerService } from '../services/worker.service';
import { Server } from 'socket.io';

describe('WorkerService Critical Logic', () => {
  let worker: any;

  beforeEach(() => {
    worker = new WorkerService({} as Server, 1);
  });

  describe('calculateRetryDelay', () => {
    it('should calculate LINEAR backoff correctly', () => {
      expect(worker.calculateRetryDelay('LINEAR', 1)).toBe(1000); // 1000 * 1
      expect(worker.calculateRetryDelay('LINEAR', 3)).toBe(3000); // 1000 * 3
    });

    it('should calculate EXPONENTIAL backoff correctly', () => {
      expect(worker.calculateRetryDelay('EXPONENTIAL', 1)).toBe(1000); // 1000 * 2^0
      expect(worker.calculateRetryDelay('EXPONENTIAL', 3)).toBe(4000); // 1000 * 2^2
      expect(worker.calculateRetryDelay('EXPONENTIAL', 4)).toBe(8000); // 1000 * 2^3
    });

    it('should calculate FIXED backoff correctly', () => {
      expect(worker.calculateRetryDelay('FIXED', 1)).toBe(1000);
      expect(worker.calculateRetryDelay('FIXED', 5)).toBe(1000);
    });
  });
});
