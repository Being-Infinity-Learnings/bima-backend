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

Create `backend/.env`:

```dotenv
PORT=3000
DATABASE_URL="postgresql://bima:bima@localhost:5432/bima?schema=public"
REDIS_URL="redis://127.0.0.1:6379"

# Firebase Admin (from the service account JSON)
FIREBASE_TYPE="service_account"
FIREBASE_PROJECT_ID=""
FIREBASE_PRIVATE_KEY_ID=""
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=""
FIREBASE_CLIENT_ID=""
FIREBASE_AUTH_URI="https://accounts.google.com/o/oauth2/auth"
FIREBASE_TOKEN_URI="https://oauth2.googleapis.com/token"
FIREBASE_AUTH_PROVIDER_X509_CERT_URL="https://www.googleapis.com/oauth2/v1/certs"
FIREBASE_CLIENT_X509_CERT_URL=""
FIREBASE_UNIVERSE_DOMAIN="googleapis.com"

# AWS S3
AWS_REGION=""
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_S3_BUCKET=""
```

Then install, migrate and start:

```bash
cd backend
npm install
npx prisma migrate deploy
npm run dev
```

The API runs at http://localhost:3000. API docs are at [/api-docs](http://localhost:3000/api-docs), and the health check is at [/health](http://localhost:3000/health).

### Dashboard

Create `dashboard/.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
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
