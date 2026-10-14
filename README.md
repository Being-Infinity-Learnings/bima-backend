# BIMA — Being Infinity

BIMA is the backend and admin dashboard for **Being Infinity**, a platform for live, scheduled quizzes. Students join quizzes from the mobile app, which lives in a separate repo. Admins and authors use the dashboard to manage users, groups, questions, quizzes and push notifications.

```
backend/     Node.js + Express API, Socket.IO live-quiz server, BullMQ worker
dashboard/   React + Vite admin dashboard
```

## Architecture

```
 Dashboard ──┐                                 ┌──▶ PostgreSQL (Prisma)
             ├── REST / Socket.IO ──▶ Backend ─┼──▶ Redis (live state, queues, socket adapter)
 Mobile app ─┘    (Firebase ID token)          ├──▶ AWS S3 (images)
                                               └──▶ Firebase Admin (token verify, FCM push)
```

- **Auth:** Users sign in through Firebase Phone OTP. The backend verifies the Firebase ID token and loads the user's role from Postgres. Roles are `ADMIN` > `AUTHOR` > `STUDENT`, and only admins and authors can use the dashboard.
- **Live quizzes:** BullMQ jobs start each quiz on schedule and move it through its phases. Redis holds the quiz state, and Socket.IO pushes updates to clients. The Redis adapter lets the backend run as several instances.
- **Notifications:** Push notifications are sent through Firebase Cloud Messaging. Scheduled notifications are checked and sent every minute.

## Running locally

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- A Firebase project with Phone sign-in enabled, a Web app config, and a service account key
- An AWS S3 bucket for image uploads

To start Postgres and Redis with Docker:

```bash
docker run -d -p 5432:5432 -e POSTGRES_USER=bima -e POSTGRES_PASSWORD=bima -e POSTGRES_DB=bima postgres:16
docker run -d -p 6379:6379 redis:7
```

### Backend

Copy the example env file and fill in your values:

```bash
cp backend/.env.example backend/.env
```

[backend/.env.example](backend/.env.example) lists every variable the backend reads: the Postgres and Redis URLs, the Firebase Admin service account fields (from the service account JSON), and the AWS S3 credentials and bucket. With the Docker containers above, use:

```dotenv
DATABASE_URL="postgresql://bima:bima@localhost:5432/bima?schema=public"
REDIS_URL="redis://127.0.0.1:6379"
```

Then install and start:

```bash
cd backend
npm install
npm run dev
```

If the database is fresh (no tables yet, e.g. the Docker container above), create the tables before starting:

```bash
npx prisma migrate deploy
```

Skip this if `DATABASE_URL` points to an existing database that already has the tables.

The API runs at http://localhost:3000. API docs are at [/api-docs](http://localhost:3000/api-docs), and the health check is at [/health](http://localhost:3000/health).

### Dashboard

Copy the example env file and fill in your Firebase Web app config (Firebase Console → Project Settings → Your apps):

```bash
cp dashboard/.env.example dashboard/.env
```

Then install and start:

```bash
cd dashboard
npm install
npm run dev     # http://localhost:5173
```

### First admin

New users sign up as `STUDENT`. To get dashboard access, sign in once, then promote yourself in the database:

```sql
UPDATE "User" SET role = 'ADMIN', approved = true WHERE phone = '+91XXXXXXXXXX';
```

After that, you can manage roles for other users from the dashboard's **Users** page.

> To log in locally without real SMS, add test phone numbers in Firebase Console → Authentication → Phone.

> Never commit real `.env` files. Only the `.env.example` templates are tracked in git.
