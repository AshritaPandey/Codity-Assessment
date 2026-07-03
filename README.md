# Distributed SaaS Job Scheduler

A robust, multi-tenant distributed Job Scheduler built as a Codity Assessment submission. It reliably executes background jobs with exact-once guarantees, robust retry logic, and dynamic horizontal scaling.

## Key Features
- **Multi-Tenant SaaS Isolation**: Organizations and Projects are automatically provisioned on user signup, ensuring strict data boundaries.
- **Distributed Locking (Exactly-Once)**: Uses PostgreSQL's `FOR UPDATE SKIP LOCKED` to prevent race conditions across parallel workers.
- **Queue Sharding**: Workloads are dynamically load-balanced across 4 independent worker nodes polling distinct `shardKeys`.
- **Workflow Dependencies (DAG)**: Advanced parent-child job sequencing via the `DEPENDENCY_WAITING` state.
- **AI-Generated Failure Summaries**: Deterministic poison pills hitting the Dead Letter Queue (DLQ) receive synthesized AI analysis.
- **Real-Time Engine**: Built on Socket.io for live UI updates, with polling fallback for strict multi-tenant isolation.
- **Dynamic Retry Backoffs**: Linear, Exponential, and Fixed backoff delays for transient errors.

## Documentation
Please view the `/docs` folder for comprehensive documentation:
- [Architecture & Diagrams](./docs/architecture.md)
- [Entity Relationship Models](./docs/ER_DIAGRAM.md)
- [API Documentation](./docs/API_DOCS.md)
- [Design Decisions & Trade-offs](./docs/DESIGN_DECISIONS.md)

---

## Setup Instructions

### Prerequisites
- **Node.js** (v18+)
- **Docker** and **Docker Compose** (for spinning up Postgres and Redis)

### 1. Start Infrastructure
Start the required PostgreSQL database and Redis server using Docker Compose:
```bash
docker-compose up -d
```

### 2. Backend Setup
Navigate into the backend directory and install dependencies:
```bash
cd backend
npm install
```

Copy the example environment variables:
```bash
cp .env.example .env
# Make sure DATABASE_URL="postgresql://user:password@localhost:5432/scheduler?schema=public" is set
```

Sync the database schema and start the API and Worker Cluster:
```bash
npm run start
```
*(This command runs `npx prisma db push` automatically before starting the server on port 4000)*

### 3. Frontend Setup
Open a new terminal, navigate into the frontend directory, and install dependencies:
```bash
cd frontend
npm install
```

Start the Vite development server:
```bash
npm run dev
```

### 4. Running Tests
Automated tests are written with Jest to cover critical functionality like the Retry Delay Backoff calculators. To run them:
```bash
cd backend
npm test
```

## Usage
1. Open the frontend UI at `http://localhost:5173`.
2. **Create an account** (this automatically provisions your Multi-Tenant Organization, Project, and Default Queue).
3. Navigate to the **Dashboard** and click **Run Test Job**.
4. Watch the jobs be load-balanced across the 4 sharded workers. If a job hits the 20% "Poison Pill" failure chance, it will exhaust its exponential retries and move to the **Dead Letter Queue**, where you can read its AI failure summary.
