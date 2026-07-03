# Entity-Relationship (ER) Diagram

This diagram represents the core data models supporting our Job Scheduler architecture, including multi-tenant isolation (Organizations, Users), Sharding, and Workflow Dependencies (parentJob/childJobs).

```mermaid
classDiagram
    direction LR
    
    User "1" --> "*" OrganizationUser : belongs to
    Organization "1" --> "*" OrganizationUser : has members
    Organization "1" --> "*" Project : owns
    Project "1" --> "*" Queue : contains
    Queue "1" --> "*" Job : processes
    Job "1" --> "*" JobExecution : has executions
    Job "1" --> "*" Job : child dependencies
    Worker "1" --> "*" JobExecution : executes

    class User {
        +String id [PK]
        +String email
        +String password
        +Role role
        +DateTime createdAt
    }

    class Organization {
        +String id [PK]
        +String name
        +DateTime createdAt
    }

    class Project {
        +String id [PK]
        +String name
        +String organizationId [FK]
    }

    class Queue {
        +String id [PK]
        +String name
        +String projectId [FK]
        +Int priority
        +Int concurrencyLimit
        +Int maxRetries
        +String retryStrategy
        +Boolean isPaused
    }

    class Job {
        +String id [PK]
        +String queueId [FK]
        +String type
        +JobStatus status
        +Json payload
        +Int priority
        +Int attempts
        +String cron
        +Int shardKey
        +String parentJobId [FK]
        +DateTime runAt
        +DateTime createdAt
    }

    class JobExecution {
        +String id [PK]
        +String jobId [FK]
        +String workerId [FK]
        +String status
        +String errorMessage
        +DateTime startedAt
        +DateTime finishedAt
    }

    class Worker {
        +String id [PK]
        +WorkerStatus status
        +DateTime lastHeartbeat
    }
```
