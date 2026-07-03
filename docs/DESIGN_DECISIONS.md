# Design Decisions & Trade-offs

## 1. Database-backed Queue vs. Redis/RabbitMQ
**Decision:** We chose to use PostgreSQL (relational database) as the primary queue store rather than an in-memory datastore like Redis or a message broker like RabbitMQ.
**Trade-offs:**
- *Pros:* Simplifies the stack by removing the need for additional infrastructure. Guarantees ACID compliance for job creation and state changes. Makes complex querying (like searching for jobs by specific attributes or filtering by project) trivial.
- *Cons:* Polling PostgreSQL is generally slower and more resource-intensive than popping from a Redis list. High throughput might cause lock contention.

## 2. Atomic Claiming Strategy
**Decision:** We use the SQL `FOR UPDATE SKIP LOCKED` clause in our worker polling logic.
**Trade-offs:**
- *Pros:* This is the industry-standard way to use a relational database as a queue. It ensures that multiple worker nodes polling simultaneously will not fetch the same job, thus preventing duplicate execution.
- *Cons:* Can lead to minor polling overhead. We mitigate this by having workers implement a backoff when idle.

## 3. Real-time Communication
**Decision:** Implemented Socket.io (WebSockets) for real-time dashboard updates instead of HTTP Long Polling or Server-Sent Events (SSE).
**Trade-offs:**
- *Pros:* Bi-directional, low latency. Easy to scale horizontally if paired with a Redis adapter.
- *Cons:* Slightly more complex to host (requires sticky sessions or a pub/sub backplane) compared to simple stateless HTTP endpoints.

## 4. Cron Processing
**Decision:** Cron parsing logic runs on the worker *after* a successful execution to spawn the next instance, rather than a central scheduler checking for upcoming cron jobs every second.
**Trade-offs:**
- *Pros:* Distributed and decentralized. No single point of failure for the scheduler loop.
- *Cons:* If the initial cron job is never run (or deleted), the sequence stops. We mitigate this by ensuring robust DLQ (Dead Letter Queue) and alert mechanisms.
