# Design Decisions & Trade-offs

## 1. PostgreSQL as the Message Broker
**Decision:** We utilized PostgreSQL tables to manage the job queue instead of a dedicated message broker like RabbitMQ or SQS.
**Trade-offs:** 
- *Pros:* Simplifies architecture by avoiding an extra infrastructure component. `SELECT ... FOR UPDATE SKIP LOCKED` allows highly concurrent and lock-free polling which is robust and battle-tested for queues. It guarantees ACID properties for job states and easily maintains complex relationships (projects, queues).
- *Cons:* At massive scale (10k+ jobs/sec), a relational database might become a bottleneck compared to specialized in-memory message brokers.

## 2. Incorporating Redis
**Decision:** Added Redis to handle distributed locking, caching, and rate-limiting.
**Trade-offs:**
- *Pros:* Unloads high-frequency operations from the PostgreSQL database, resulting in a much stronger, production-ready architecture. Essential for real-time WebSocket pub/sub notifications for the dashboard in the future.
- *Cons:* Requires deploying and maintaining a Redis instance, increasing operational complexity.

## 3. Worker Polling Strategy
**Decision:** The Worker Service uses short-polling with dynamic intervals (backing off when idle).
**Trade-offs:**
- *Pros:* Easy to implement and robust. If a worker dies, it just stops polling. Heartbeat tracking naturally prunes dead workers.
- *Cons:* Polling adds load to the database even when there are no jobs. Long-polling or pub/sub pushes (via PostgreSQL `LISTEN/NOTIFY`) would be more efficient but are slightly more complex to manage reliably under failure conditions.

## 4. Job Execution Extensibility
**Decision:** Jobs payloads are generic JSON.
**Trade-offs:**
- *Pros:* Keeps the scheduler decoupled from business logic. The executor can simply fire a webhook or run a mock simulated delay, meeting the requirements without being overly opinionated.
