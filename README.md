# Rate-My-GroupMates
hiii
Rate your teammates after a group project, then reveal the (very unofficial) team awards.

## How it works

1. **Create an account** with your name, email and a password (8+ characters), or sign in.
2. **Create a group:** name, course, and your teammates' emails. You get an **invite link** and a 6-character **invite code**.
3. **Teammates join:** they open the link, sign up or sign in with the email you invited, and enter the code.
   They can also decline. While the group is waiting, the creator can invite more people, cancel invites, make a new
   code or delete the group; members can leave.
4. **Reviews unlock once everyone has accepted.** From then on membership is locked, and the rating + awards flow opens.

```
rate-my-groupmates/
├── frontend/          React + TypeScript (Vite)
│   └── src/
│       ├── pages/         Login, Groups (/), CreateGroup (/groups/new), Join (/join/:id),
│       │                  Rate (/groups/:id), Awards (/groups/:id/awards)
│       ├── components/    layout/, auth/, groups/ (waiting room), rating/, awards/, common/
│       ├── context/       AuthProvider (session), ReviewProvider (one group + its reviews; drafts in localStorage)
│       ├── lib/           ratingCore (scoring + award rules), teams, emails, storage
│       ├── services/      api (fetch client), session (token)
│       └── types/
└── backend/           Express + Mongoose + TypeScript
    ├── api/index.ts       Vercel serverless entry
    └── src/
        ├── config/        constants (env), db (cached Mongo connection)
        ├── controllers/   health, auth, team (groups + invites), review
        ├── middleware/    auth (session token), errorHandler, requireDB, validate
        ├── models/        User, Team, Review
        ├── scripts/       seed – demo accounts + group + peer reviews
        └── routes/
```

## Accounts

- Passwords are stored as bcrypt hashes and never sent back by the API.
- 10 wrong passwords for an email within 15 minutes lock it for 15 minutes.
- Signed-in users can change their password on the **Account** page; that signs out their other devices.
- **Forgot password:** there are no reset emails. Someone with the database connection string runs
  `npm run reset-password -- their@email.com a-new-password` in `backend/` and tells them the new password.
- **Google sign-in (optional, off):** set `GOOGLE_CLIENT_ID` on the backend to show a "Sign in with Google" button.
  Create a Web OAuth client at https://console.cloud.google.com/auth/clients with your frontend URLs as
  Authorized JavaScript origins. Accounts with the same email are linked. For production, see
  [Turning on Google sign-in in production](#turning-on-google-sign-in-in-production).

## Running locally

```bash
# backend – copy .env.example to .env and fill in MONGODB_URI
cd backend && npm install
npm run seed     # demo accounts + "Group 16" with reviews open
                 #   --demo   adds fake peer reviews   --reset  deletes its reviews and old pre-login playtest teams
npm run dev      # http://localhost:5000/api

cd frontend && npm install && npm run dev     # http://localhost:5173
```

The seeded demo accounts (`kent@example.com`, `omar@example.com`, `qitai@example.com`, `zahi@example.com`) all use
the password `groupmates16`.

## Tests

End-to-end tests drive the real app in a real browser (Chromium): sign-in, creating groups, invite links + codes,
declining/leaving/deleting, reviews unlocking only when everyone has joined, rating, awards, and permission checks
straight against the API. Each run starts its own throwaway database, backend and frontend, so it never touches your
`.env` or your Atlas data.

```bash
cd backend && npm install && cd ../frontend && npm install && cd ../e2e
npm install      # also downloads Chromium for the tests
npm test         # first run also downloads a MongoDB server (~100 MB, once); ~2 minutes total
npm run test:headed   # same, but watch the browser
```

If something fails, the backend and frontend output is saved in `e2e/.logs/`.
Needs Node.js 20.19+ (22 LTS recommended). Works on Windows, macOS and Linux.

## API

All `/teams` routes need `Authorization: Bearer <token>` (from the login routes). Errors are `{ message }`.

| Method | Path                               | Notes                                                             |
| ------ | ---------------------------------- | ----------------------------------------------------------------- |
| GET    | `/api/health`                      | `{ status, db }`                                                  |
| GET    | `/api/auth/config`                 | `{ googleClientId }` (null = Google off)                          |
| POST   | `/api/auth/register`               | `{ name, email, password }` → `{ token, user }`                   |
| POST   | `/api/auth/login`                  | `{ email, password }` → `{ token, user }`; 429 while locked       |
| POST   | `/api/auth/password`               | `{ currentPassword, newPassword }` → new `{ token, user }`        |
| POST   | `/api/auth/google`                 | `{ credential }` → `{ token, user }`. Only if GOOGLE_CLIENT_ID set |
| GET    | `/api/auth/me`                     | The signed-in user                                                |
| GET    | `/api/teams`                       | Your groups and invitations, each with `todo: accept/review/null` |
| POST   | `/api/teams`                       | `{ name, course, emails[] }`; you're added as the creator         |
| GET    | `/api/teams/:teamId`               | `inviteCode` only included for members who accepted               |
| DELETE | `/api/teams/:teamId`               | Creator, while waiting                                            |
| POST   | `/api/teams/:teamId/accept`        | `{ code }`                                                        |
| POST   | `/api/teams/:teamId/leave`         | Decline an invite, or leave while waiting (not the creator)       |
| POST   | `/api/teams/:teamId/invites`       | `{ emails[] }`. Creator, while waiting                            |
| DELETE | `/api/teams/:teamId/members/:id`   | Cancel a pending invite. Creator, while waiting                   |
| POST   | `/api/teams/:teamId/code`          | New invite code. Creator, while waiting                           |
| GET    | `/api/teams/:teamId/reviews`       | Once reviews are open. Anonymous reviewer ids hidden except your own |
| POST   | `/api/teams/:teamId/reviews`       | `{ reviews: [{ targetId, rating, scores, text?, anonymous? }] }` – upserts |

## Deploying to Vercel

Create **two** Vercel projects from this repo:

- **frontend** – Root Directory `frontend`. Env var `VITE_API_URL=https://<backend>.vercel.app/api`.
- **backend** – Root Directory `backend`. Env vars `MONGODB_URI`, `MONGODB_DB_NAME`,
  `CLIENT_ORIGIN=https://<frontend>.vercel.app`, optionally `JWT_SECRET` (a long random string; without it the
  backend derives one from `MONGODB_URI`, so changing the database password signs everyone out). `GOOGLE_CLIENT_ID` is optional.

In MongoDB Atlas, allow access from Vercel (Network Access → `0.0.0.0/0`, since Vercel IPs are dynamic).

### Turning on Google sign-in in production

Spec: [`specs/auth/google-sign-in-prod/SPEC.md`](specs/auth/google-sign-in-prod/SPEC.md). No code changes needed, only settings:

1. **Google Cloud** (https://console.cloud.google.com):
   - **Branding / OAuth consent screen:** External, app name "Rate My Groupmates", support email, and links to
     your live home page, `/privacy` and `/terms`. Scopes: only `openid`, `email`, `profile`.
   - **Audience:** click **Publish app** so it's "In production". In "Testing", only listed test users can sign in.
   - **Clients → Create client → Web application.** Authorized JavaScript origins: your exact frontend URL(s),
     e.g. `https://<frontend>.vercel.app` (no trailing slash), plus `http://localhost:5173` for local dev.
     Leave redirect URIs empty. Copy the client ID.
2. **MongoDB Atlas:** Network Access has `0.0.0.0/0`; the Database Access user has `readWrite` on your database.
   Nothing else to set up: the `users` indexes are built automatically, and `npm run check:prod` confirms it.
3. **Vercel, backend project:** set `GOOGLE_CLIENT_ID`, `CLIENT_ORIGIN=https://<frontend>.vercel.app` and a
   `JWT_SECRET`, then **redeploy**. The frontend needs nothing new.
4. **Check it:** put the same production values in `backend/.env` and run, in `backend/`:

   ```bash
   npm run check:prod -- --fix --api https://<backend>.vercel.app/api
   ```

   It checks the settings, connects to Atlas, creates any missing index (`--fix`; it never touches user
   data), and confirms the live backend has Google on and accepts your frontend. "Ready for Google sign-in" means done.

Google sign-in won't work on Vercel preview URLs unless you add each one as an origin in Google Cloud.
