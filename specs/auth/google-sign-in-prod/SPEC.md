---
id: auth.google-sign-in-prod
title: Google Sign-In in Production
status: draft
owner: "[draft] PM name"
intent: "Let students sign in to the live Rate My Groupmates site with their Google account instead of creating yet another password."
depends_on: []
---

# Google Sign-In in Production

## Intent

Students reviewing their groupmates have to create an email + password account first. That's friction at the
exact moment we need them to act (they've just been invited to a group). Most students already have a Google
account, often their school account. The Google sign-in code already exists in the app but is switched off in
production, so the button never appears. This slice turns it on for real users on the live site, backed by the
production MongoDB Atlas database, and makes sure it behaves correctly for both new and existing accounts.

**Current state (as-built, verified in code):**
- The backend verifies Google ID tokens and creates or links users (`POST /api/auth/google`).
- The frontend shows the Google button only when `GET /api/auth/config` returns a non-null `googleClientId`.
- The `users` collection schema already has a `googleId` field with a unique, sparse index declared.
  Mongoose builds declared indexes automatically on first connection (autoIndex is on by default and not
  overridden in this codebase).
- Public privacy and terms pages exist for Google's consent screen to link to.
- No change to the sign-in behavior is needed. The work is configuration in Google Cloud, Vercel and MongoDB Atlas,
  plus verification.

**Built for this slice:**
- `npm run check:prod` in `backend/` checks the production settings, Atlas connection and `users` indexes
  (creates missing ones with `--fix`) and, with `--api <url>`, the live backend. This covers the
  "Production database readiness" criteria.
- `e2e/tests/google.test.ts` proves the acceptance criteria against the real backend and a real database,
  using test-signed Google tokens. Everything is covered except the live consent screen and the database-unavailable case.

## Mini-requirements

### Target Personas
- **Primary**: Student invited to rate groupmates, arriving on the login page on desktop or phone.
- **Secondary**: Student who already has an email + password account and now clicks "Sign in with Google".
- **Secondary**: The app owner/operator who configures and monitors the production environment.

### User Stories
- As an invited student, I want to sign in with Google in one click, so that I can start rating my groupmates without making a password.
- As a student with an existing email + password account, I want Google sign-in with the same email to land me in my existing account, so that I keep my groups and reviews.
- As the operator, I want to confirm from Atlas and the live site that Google sign-in is working, so that I know it's safe to tell students about it.

### Acceptance Criteria

#### Login page
- GIVEN the production frontend is open on the login page
  WHEN the page finishes loading
  THEN a "Sign in with Google" button is shown alongside email + password sign-in
- GIVEN the production backend
  WHEN anyone requests `/api/auth/config`
  THEN it returns the production Google client ID (not `null`)
- GIVEN a browser whose ad or tracker blocker blocks `accounts.google.com`
  WHEN the login page loads
  THEN email + password sign-in still works and a message explains Google sign-in couldn't load

#### New user via Google
- GIVEN a student with a verified Google email that has never been used on the site
  WHEN they complete Google sign-in on the production site
  THEN they are signed in, land in the app, and see their Google first name as their display name
- GIVEN that sign-in just happened
  WHEN the operator views the production `users` collection in Atlas
  THEN exactly one new user document exists for that email, carrying a Google account ID
- GIVEN a student who signed up through Google
  WHEN they sign in with Google again on another device
  THEN they land in the same account (same groups and reviews), and no duplicate user is created

#### Existing email + password user
- GIVEN a student who already registered with email + password using `x@school.edu`
  WHEN they sign in with Google as `x@school.edu`
  THEN they land in their existing account with all their groups and reviews
- GIVEN that student has linked Google this way
  WHEN they later sign in with their email + password
  THEN password sign-in still works — [draft] confirm we want both methods to keep working
- GIVEN a student whose account was created through Google only
  WHEN they try email + password sign-in
  THEN they see "This account was set up with Google sign-in"

#### Invites
- GIVEN a student was invited to a group by email
  WHEN they first sign in with Google using that same email
  THEN the invitation shows up for them, just as it would after email + password registration

#### Rejections
- GIVEN a Google account whose email isn't verified with Google
  WHEN the student tries Google sign-in
  THEN they are not signed in and are told to verify their email with Google first
- GIVEN the production database is unreachable
  WHEN a student tries Google sign-in
  THEN they see a "Database unavailable" style error instead of a hang or blank screen

#### Consent screen
- GIVEN a Google user who isn't the developer or a listed test user
  WHEN they click "Sign in with Google" on the production site
  THEN they can complete sign-in (the Google app is published to production, not stuck in Testing)
- GIVEN the Google consent or account-chooser screen
  WHEN the student views it
  THEN the app name reads "Rate My Groupmates" and links to our live privacy policy and terms — [draft] confirm whether we also want the logo shown, which requires Google brand verification

#### Production database readiness (operator-observable)
- GIVEN the production Atlas database
  WHEN the operator opens the `users` collection's Indexes tab
  THEN it shows a `googleId` index marked unique and sparse, and an `email` index marked unique
- GIVEN the production Atlas cluster
  WHEN the backend on Vercel connects
  THEN the connection succeeds from Vercel's dynamic IPs, using a database user that can read, write and build indexes in the app's database only — [draft] confirm least-privilege user vs. existing broad user

### Business Rules
1. Google sign-in only shows when the production backend has a Google client ID configured. If it's missing, the site silently offers email + password only.
2. An account is matched by Google account ID first, then by email. The same email always means the same person and the same account.
3. Only Google emails that Google marks as verified can sign in or link to an existing account. This is what makes rule 2 safe.
4. Each Google account can belong to only one user, and each email to only one user. The database enforces both.
5. Email matching ignores letter case and surrounding spaces.
6. On every Google sign-in, the user's name and full name are refreshed from Google. — [draft] confirm it's fine that this overwrites a name the student typed at registration
7. Users who never used Google have no Google ID stored at all (the field is absent, not empty). That's how many users can share "no Google account" without breaking uniqueness.
8. Sessions are the same 30-day sessions as email + password sign-in. Rotating the production DB password signs everyone out if `JWT_SECRET` isn't set separately.
9. Google sign-in works only on origins registered with Google. Vercel preview URLs aren't registered, so they won't have working Google sign-in. — [draft] confirm acceptable

### Scope

#### In Scope
- Turning on Google sign-in on the production frontend + backend.
- Google Cloud project, published consent screen (non-sensitive scopes only: openid, email, profile), and a Web OAuth client ID with the production frontend origin(s).
- Production backend environment configuration on Vercel (client ID, allowed frontend origin, session secret).
- Production MongoDB Atlas readiness: network access from Vercel, a database user with suitable permissions, the correct database name, and the `users` indexes present.
- Verifying the acceptance criteria above against the live site and Atlas.

#### Explicitly Out of Scope
- Other providers (Microsoft, Apple, GitHub, school SSO/SAML).
- Restricting sign-in to specific school domains.
- Unlinking Google from an account, or merging two different accounts.
- Google sign-in on Vercel preview deployments.
- Requesting any Google scopes beyond openid, email and profile (Drive, Calendar and so on).
- Static egress IPs or private networking between Vercel and Atlas.
- Google brand verification (logo on consent screen), unless the PM confirms it below.
- Any change to the email + password flow.

### Open Questions
- [ ] Which exact production frontend URL(s) must work: the `*.vercel.app` URL, a custom domain, or both (with/without `www`)?
- [ ] Do we want our logo on Google's consent screen? That needs Google brand verification and verified domain ownership, which isn't possible on a `vercel.app` domain we don't own. A custom domain would be needed.
- [ ] Should linked accounts keep working with their password too (current behavior), or should Google take over?
- [ ] Is overwriting the student's typed name with their Google name on each sign-in OK?
- [ ] Use a dedicated least-privilege Atlas database user for production, or keep the current one?
- [ ] Should sign-in be limited to school Google accounts? (Currently out of scope.)
- [ ] Who owns the Google Cloud project long term, and which support email shows on the consent screen?

## Proof contract

- [ ] On the live production site, the login page shows "Sign in with Google", and `/api/auth/config` returns a non-null client ID.
- [ ] A Google account that isn't a test user and has never used the site signs in successfully and sees their first name.
- [ ] Atlas shows exactly one new `users` document for that email, with a Google ID.
- [ ] Signing in again with the same Google account, from a second browser, lands in the same account, and Atlas still shows one document.
- [ ] An existing email + password account signs in with Google using the same email and still sees its groups and reviews. Atlas still shows one document for that email.
- [ ] The Atlas `users` Indexes tab shows `googleId` unique + sparse and `email` unique.
- [ ] With a blocker blocking `accounts.google.com`, email + password sign-in still works on the live site.
