# Rate-My-GroupMates
hiii
Rate your teammates after a group project, then reveal the (very unofficial) team awards.

## How it works

1. **Sign in with Google.**
2. **Create a group:** name, course, and your teammates' emails. You get an **invite link** and a 6-character **invite code**.
3. **Teammates join:** they open the link, sign in with the Google account for the email you invited, and enter the code.
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

## Setting up Google sign-in (once)

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project, then **APIs & Services → OAuth consent
   screen** (External; add yourselves as test users while it's in "Testing").
2. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.**
   Under **Authorized JavaScript origins** add every frontend URL: `http://localhost:5173`,
   `https://rmg-bjty.vercel.app` (no redirect URIs needed).
3. Put the client ID in the backend env as `GOOGLE_CLIENT_ID`. The frontend fetches it from the API.

If the Google button says the origin isn't allowed, the URL you're on is missing from step 2.

## Running locally

```bash
# backend – copy .env.example to .env and fill in MONGODB_URI (+ GOOGLE_CLIENT_ID if you have one)
cd backend && npm install
npm run seed     # demo accounts + "Group 16" with reviews open
                 #   --demo   adds fake peer reviews   --reset  deletes its reviews and old pre-login playtest teams
npm run dev      # http://localhost:5000/api

cd frontend && npm install && npm run dev     # http://localhost:5173
```

With `DEV_LOGIN=true` in `backend/.env` the login page also has a **test login** (any email, no Google), so you can
play several people in different browser profiles, e.g. the seeded `zahi@example.com`. It is always off in production.

## API

All `/teams` routes need `Authorization: Bearer <token>` (from the login routes). Errors are `{ message }`.

| Method | Path                               | Notes                                                             |
| ------ | ---------------------------------- | ----------------------------------------------------------------- |
| GET    | `/api/health`                      | `{ status, db }`                                                  |
| GET    | `/api/auth/config`                 | `{ googleClientId, devLogin }`                                    |
| POST   | `/api/auth/google`                 | `{ credential }` (Google ID token) → `{ token, user }`            |
| POST   | `/api/auth/dev`                    | `{ email, name? }` → `{ token, user }`. Local dev only            |
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
  `CLIENT_ORIGIN=https://<frontend>.vercel.app`, `GOOGLE_CLIENT_ID`, and `JWT_SECRET` (a long random string, e.g.
  `openssl rand -hex 32`; changing it signs everyone out).

In MongoDB Atlas, allow access from Vercel (Network Access → `0.0.0.0/0`, since Vercel IPs are dynamic).
