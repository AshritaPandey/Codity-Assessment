# Database Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ OrganizationUser : "belongs to"
    Organization ||--o{ OrganizationUser : "has"
    Organization ||--o{ Project : "owns"
    Project ||--o{ Queue : "contains"
    Queue ||--o{ Job : "processes"
    Job ||--o{ JobExecution : "has"
    JobExecution ||--o{ JobLog : "generates"
    Worker ||--o{ JobExecution : "executes"

    User {
        String id PK
        String email
        String passwordHash
        Role role
    }
    Queue {
        String id PK
        String projectId FK
        Int concurrencyLimit
        String retryStrategy
        Int maxRetries
    }
    Job {
        String id PK
        String queueId FK
        String type
        Json payload
        JobStatus status
        DateTime runAt
        Int attempts
    }
    Worker {
        String id PK
        WorkerStatus status
        DateTime lastHeartbeat
    }
```

## Key Considerations
- **Indexing:** Indexes on `Job(status, runAt, priority)` for extremely fast polling queries.
- **Normalization:** Proper relationships prevent data duplication. Deleting a queue cascades and deletes its jobs.
- **Concurrency Control:** `SELECT ... FOR UPDATE SKIP LOCKED` ensures jobs aren't claimed twice, leveraging PostgreSQL's robust MVCC and row-level locks.
