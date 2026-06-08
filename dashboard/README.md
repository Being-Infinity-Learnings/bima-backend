# BIMA Admin Dashboard

React + Vite admin panel for the **Being Infinity Mobile App (BIMA)** platform.

---

## Quick Start

### 1. Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- A running BIMA Node.js backend (`/admin/users`, `/groups`, etc.)
- A Firebase project with Email/Password authentication enabled

### 2. Install dependencies

```bash
cd bima-admin
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to find it |
|---|---|
| `VITE_API_BASE_URL` | Your backend URL, e.g. `http://localhost:3000` |
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | same |
| `VITE_FIREBASE_PROJECT_ID` | same |
| `VITE_FIREBASE_STORAGE_BUCKET` | same |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | same |
| `VITE_FIREBASE_APP_ID` | same |

### 4. Run in development

```bash
npm run dev
```

Vite starts a dev server at **http://localhost:5173** by default.

### 5. Build for production

```bash
npm run build
# output is in dist/
```

---

## Branding / Theming

All app identity is in a **single file**:

```
src/config/app.config.js
```

Change `name`, `fullName`, `org`, `logoSymbol`, and the entire `theme` object to rebrand the dashboard for any client. No hunting through component files needed.

---

## Directory Structure

```
bima-admin/
├── src/
│   ├── config/
│   │   ├── app.config.js        ← branding & theme (edit this to rebrand)
│   │   └── firebase.config.js   ← Firebase init
│   ├── context/
│   │   └── AuthContext.jsx      ← Firebase auth + backend profile/role state
│   ├── services/
│   │   └── api.service.js       ← all backend API calls (admin, groups, auth)
│   ├── components/
│   │   ├── ui/
│   │   │   └── index.jsx        ← Button, Badge, Card, Input, Modal, etc.
│   │   ├── layout/
│   │   │   ├── AppLayout.jsx    ← main shell (sidebar + outlet)
│   │   │   └── Sidebar.jsx      ← nav, user footer, sign out
│   │   └── auth/
│   │       └── RouteGuard.jsx   ← ProtectedRoute, PublicRoute
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx    ← login, signup, password reset
│   │   │   └── NoAccessPage.jsx ← shown to STUDENT role
│   │   ├── dashboard/
│   │   │   └── DashboardPage.jsx
│   │   ├── users/
│   │   │   └── UsersPage.jsx    ← list, approve, block, unblock, grant admin
│   │   ├── groups/
│   │   │   └── GroupsPage.jsx   ← CRUD groups, add/remove members
│   │   └── placeholder/
│   │       └── PlaceholderPages.jsx  ← Quizzes, Notifications, Analytics stubs
│   ├── App.jsx                  ← router + route guards
│   ├── main.jsx
│   └── index.css
├── .env.example
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

---

## Implemented Features

| Feature | Status |
|---|---|
| Firebase Email/Password login & signup | ✅ |
| Password reset via email | ✅ |
| Role-based route protection (ADMIN / AUTHOR / STUDENT) | ✅ |
| Student role → no-access page | ✅ |
| Author role → limited sidebar (no Users / Notifications) | ✅ |
| View all users with status/role | ✅ |
| Approve / Block / Unblock users | ✅ |
| Grant Admin role to any user (search by email) | ✅ |
| List all groups | ✅ |
| Create / edit / delete groups | ✅ |
| Add / remove members from groups | ✅ |
| Quizzes page (stub) | 🚧 |
| Notifications page (stub) | 🚧 |
| Analytics page (stub) | 🚧 |

---

## Backend API expected

The dashboard calls these endpoints (matching your `admin.routes.js` and `group.routes.js`):

```
GET    /auth/me                       → { user: { id, email, fullName, role, ... } }

GET    /admin/users                   → { users: [...] }
GET    /admin/pending-users           → { users: [...] }
POST   /admin/users/:id/approve
POST   /admin/users/:id/block
POST   /admin/users/:id/unblock
POST   /admin/users/:id/grant-admin   ← add this if not yet present

GET    /groups
GET    /groups/:groupId
POST   /groups/create
PATCH  /groups/:groupId
DELETE /groups/:groupId
GET    /groups/:groupId/users
POST   /groups/:groupId/users/:userId
DELETE /groups/:groupId/users/:userId
```

All requests include `Authorization: Bearer <firebase_id_token>`.

---

## Notes

- **`/auth/me`** – this endpoint is assumed to exist on your backend; it receives the Firebase Bearer token, verifies it with Firebase Admin SDK, and returns the user's profile including `role`. Adjust the path in `src/services/api.service.js` if yours is different (e.g. `/users/me` or `/profile`).
- **Grant Admin** – calls `POST /admin/users/:id/grant-admin`. Add this endpoint to your backend if it doesn't exist yet, or update `src/services/api.service.js → rolesApi.grantAdmin` to match your actual endpoint.
