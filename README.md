# Rate-My-GroupMates
hi
Rate your teammates after a group project, then reveal the (very unofficial) team awards.

```
rate-my-groupmates/
├── frontend/          React + TypeScript (Vite)
│   └── src/
│       ├── pages/         RatePage (/), AwardsPage (/awards)
│       ├── components/    layout/, rating/, awards/, common/
│       ├── context/       ReviewProvider – loads team + reviews from the API, drafts in localStorage
│       ├── hooks/         useReviews
│       ├── lib/           ratingCore – pure scoring + award rules
│       ├── services/      api – fetch client for the backend
│       └── types/
└── backend/           Express + Mongoose + TypeScript
    ├── api/index.ts       Vercel serverless entry
    └── src/
        ├── config/        constants (env), db (cached Mongo connection)
        ├── controllers/   health, team, review
        ├── middleware/    errorHandler, requireDB, validate
        ├── models/        Team, Review
        ├── scripts/       seed – demo team + peer reviews
        └── routes/        /api/health, /api/teams, /api/teams/:teamId/reviews
```

## Running locally

```bash
# backend – fill in MONGODB_URI in backend/.env first (see .env.example)
cd backend && npm install
npm run seed     # creates the team; prints VITE_TEAM_ID
                 #   --demo  adds fake peer reviews   --reset  deletes the team's reviews
npm run dev      # http://localhost:5000/api

# frontend – put VITE_TEAM_ID from `npm run seed` in frontend/.env
# Each person picks "who are you?" on first visit (remembered per browser).
cd frontend && npm install && npm run dev     # http://localhost:5173
```

## API

| Method | Path                          | Notes                                                   |
| ------ | ----------------------------- | ------------------------------------------------------- |
| GET    | `/api/health`                 | `{ status, db }`                                        |
| GET    | `/api/teams`                  | List teams                                              |
| POST   | `/api/teams`                  | `{ name, course, members: [{ name, color? }] }`         |
| GET    | `/api/teams/:teamId`          | One team                                                |
| GET    | `/api/teams/:teamId/reviews`  | Anonymous reviewer ids are hidden, except your own with `?viewerId=` |
| POST   | `/api/teams/:teamId/reviews`  | `{ reviewerId, reviews: [{ targetId, rating, scores, text?, anonymous? }] }` – upserts |

## Deploying to Vercel

Create **two** Vercel projects from this repo:

- **frontend** – Root Directory `frontend`. Env var `VITE_API_URL=https://<backend>.vercel.app/api`.
- **backend** – Root Directory `backend`. Env vars `MONGODB_URI`, `MONGODB_DB_NAME`, `CLIENT_ORIGIN=https://<frontend>.vercel.app`.

In MongoDB Atlas, allow access from Vercel (Network Access → `0.0.0.0/0`, since Vercel IPs are dynamic).
