# Design Decisions & Major Trade-offs

Building a production-ready, distributed SaaS Job Scheduler requires balancing strict data consistency against raw performance. Below are the major architectural decisions and their corresponding trade-offs.

## 1. Concurrency Control: PostgreSQL `SKIP LOCKED` vs Redis Queues
*   **Decision:** We utilized PostgreSQL's `FOR UPDATE SKIP LOCKED` feature to handle job distribution and concurrency, rather than relying on a separate Redis queue instance (like BullMQ).
*   **Trade-off:** Redis operates in-memory and is inherently faster for pure queue operations. However, using PostgreSQL for both storage and locking guarantees **ACID compliance** and completely eliminates the "split-brain" problem (where an in-memory queue and the persistent database fall out of sync during a crash). The trade-off is slightly higher database CPU usage in exchange for absolute data integrity and exactly-once execution.

## 2. Worker Architecture: Application-Level Sharding
*   **Decision:** Rather than having all workers poll a single monolithic queue, we implemented a 4-way Sharding Architecture. Jobs are assigned a `shardKey` upon creation, and individual Node.js worker processes are booted up to exclusively poll their assigned shard.
*   **Trade-off:** This massively reduces database lock contention, as workers are no longer fighting over the same database rows. The trade-off is the potential for minor "head-of-line blocking." If Shard 1 receives a batch of extremely long-running tasks, it may lag behind Shard 2, requiring the frontend to intelligently load-balance jobs during creation.

## 3. Real-Time Data: REST Polling vs WebSocket Broadcasts
*   **Decision:** The frontend Dashboard fetches real-time updates using optimized REST interval polling (`/api/jobs/stats`) rather than a continuous global WebSocket stream.
*   **Trade-off:** WebSockets offer sub-millisecond push updates, which is great for single-user apps. However, in a **Multi-Tenant SaaS** environment, broadcasting data over WebSockets requires highly complex "room" management to ensure organizations don't accidentally receive each other's data. Polling standard REST endpoints leverages our existing JWT Authentication and Prisma filtering, guaranteeing 100% secure data isolation at the cost of slightly higher HTTP network overhead.

## 4. DAG Workflows: Application Logic vs Database Triggers
*   **Decision:** Resolving Workflow Dependencies (promoting a child job from `DEPENDENCY_WAITING` to `QUEUED` when a parent finishes) is handled in the Node.js application code rather than using raw PostgreSQL Triggers.
*   **Trade-off:** Using a database trigger would be marginally faster as it happens directly on the database server. However, managing business logic inside DB triggers creates "invisible code" that is difficult to debug, test, and version-control. We traded a few milliseconds of latency to keep all business logic strictly inside the TypeScript codebase for maximum maintainability.
