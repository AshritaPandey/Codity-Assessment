# API Documentation

All API endpoints are prefixed with `/api`. Most endpoints require a valid JWT token passed in the `Authorization` header as a Bearer token.

## Authentication
`POST /auth/register`
- **Body:** `{ "email": "user@example.com", "password": "password" }`
- **Response:** `{ "message": "User registered successfully", "userId": "..." }`

`POST /auth/login`
- **Body:** `{ "email": "user@example.com", "password": "password" }`
- **Response:** `{ "token": "...", "user": { ... } }`

## Queues
`GET /queues`
- **Query Params:** `?projectId=xyz` (optional)
- **Response:** Array of Queue objects.

`POST /queues`
- **Body:** `{ "projectId": "...", "name": "Video Processing", "concurrencyLimit": 5 }`
- **Response:** Created Queue object.

## Jobs
`GET /jobs`
- **Query Params:** `?queueId=xyz&status=RUNNING&page=1&limit=10`
- **Response:** `{ "data": [...], "pagination": { ... } }`

`POST /jobs`
- **Body:**
```json
{
  "queueId": "0000-...",
  "type": "IMMEDIATE",
  "payload": { "videoId": 123 },
  "cron": "0 * * * *" // optional
}
```
- **Response:** Created Job object.

`POST /jobs/:id/retry`
- **Description:** Forces a retry on a `FAILED` or `DLQ` job.
- **Response:** Updated Job object set back to `QUEUED`.

## Workers
`GET /workers`
- **Response:** Array of active and dead worker nodes with their last heartbeat timestamps.
