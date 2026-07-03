# API Documentation

The backend exposes RESTful endpoints with standard HTTP status codes and JSON payloads. Authentication is required via `Authorization: Bearer <token>`.

## Authentication

### `POST /api/auth/register`
Creates a new user.
- **Body:** `{ "email": "user@example.com", "password": "password" }`
- **Response:** `201 Created`

### `POST /api/auth/login`
Authenticates a user and returns a JWT.
- **Body:** `{ "email": "user@example.com", "password": "password" }`
- **Response:** `200 OK` `{ "token": "jwt...", "user": { ... } }`

## Projects

### `POST /api/projects`
Creates a new project.
- **Body:** `{ "name": "My Project", "organizationId": "<uuid>" }`
- **Response:** `201 Created`

### `GET /api/projects`
Lists all projects (optionally filtered by `organizationId`).
- **Response:** `200 OK`

## Queues

### `POST /api/queues`
Creates a new job queue with configuration policies.
- **Body:** `{ "projectId": "<uuid>", "name": "email-queue", "priority": 1, "concurrencyLimit": 5, "retryStrategy": "EXPONENTIAL" }`
- **Response:** `201 Created`

### `PATCH /api/queues/:id`
Updates a queue configuration (e.g., pausing it).
- **Body:** `{ "isPaused": true }`

### `GET /api/queues/:id/stats`
Retrieves execution statistics for a given queue (grouped by status).
- **Response:** `200 OK` `{ "COMPLETED": 120, "FAILED": 5, "RUNNING": 2 }`

## Jobs

### `POST /api/jobs`
Schedules a new job into a queue.
- **Body:** `{ "queueId": "<uuid>", "type": "IMMEDIATE", "payload": { "taskId": 123 }, "priority": 10 }`
- **Response:** `201 Created`

### `GET /api/jobs`
Lists jobs with pagination and filtering.
- **Query Params:** `queueId`, `status`, `page`, `limit`
- **Response:** `200 OK` with pagination metadata.

### `POST /api/jobs/:id/retry`
Manually resets a `FAILED` or `DLQ` job back to `QUEUED`.
- **Response:** `200 OK`
