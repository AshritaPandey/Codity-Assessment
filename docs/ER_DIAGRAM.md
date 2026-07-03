# Entity-Relationship (ER) Diagram

This diagram represents the core data models supporting our Job Scheduler architecture, including multi-tenant isolation (Organizations, Users), Sharding, and Workflow Dependencies (parentJob/childJobs).

```mermaid
erDiagram
    User ||--o{ OrganizationUser : "belongs to"
    Organization ||--o{ OrganizationUser : "has members"
    Organization ||--o{ Project : "owns"
    Project ||--o{ Queue : "contains"
    Queue ||--o{ Job : "processes"
    Job ||--o{ JobExecution : "has executions"
    JobExecution ||--o{ JobLog : "generates logs"
    Job ||--o{ Job : "child dependencies (parentJobId)"
    Worker ||--o{ JobExecution : "executes"

    User {
        String id PK
        String email
        String password
        Role role
        DateTime createdAt
    }

    Organization {
        String id PK
        String name
        DateTime createdAt
    }

    Project {
        String id PK
        String name
        String organizationId FK
    }

    Queue {
        String id PK
        String name
        String projectId FK
        Int priority
        Int concurrencyLimit
        Int maxRetries
        String retryStrategy
        Boolean isPaused
    }

    Job {
        String id PK
        String queueId FK
        String type
        JobStatus status
        Json payload
        Int priority
        Int attempts
        String cron
        Int shardKey
        String parentJobId FK
        DateTime runAt
        DateTime createdAt
    }

    JobExecution {
        String id PK
        String jobId FK
        String workerId FK
        String status
        String errorMessage
        DateTime startedAt
        DateTime finishedAt
    }

    Worker {
        String id PK
        WorkerStatus status
        DateTime lastHeartbeat
    }
```
