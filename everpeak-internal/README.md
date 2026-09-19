# EverPeak Internal System

A private internal booking/CRM system that runs entirely on Cloudflare Workers + D1.
No framework, no build step — plain JS/HTML/CSS served straight from the Worker.

**Anyone without a valid logged-in session gets a plain `404`** for every route
except `/login`, `/accept-invite`, and the public `/booking` calendar. There is
no public sign-up — accounts are only created by a Manager sending an email invite,
or by you via a one-time CLI bootstrap script.

## Roles

- **Manager** — full read/write on bookings, clients, payments, availability; can invite/disable users.
- **Client Information Representative** — read-only on bookings, clients, payments; can add notes for managers to act on. Cannot create, edit, or delete records, and cannot manage users.

## 1. Prerequisites

```bash
npm install -g wrangler
wrangler login
```

You'll need a Cloudflare account with the domain (`everpeakvisuals.com`) already
added, and Node.js 18+ installed locally.

## 2. Get the code onto GitHub

This project is already a git repo. Create an empty repo on GitHub, then:

```bash
cd everpeak-internal
git add .
git commit -m "Initial commit: EverPeak internal system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/everpeak-internal.git
git push -u origin main
```

## 3. Install dependencies

```bash
npm install
```

## 4. Create the D1 database

```bash
wrangler d1 create everpeak-internal-db
```

Copy the `database_id` it prints into `wrangler.toml` (replace
`REPLACE_WITH_YOUR_D1_DATABASE_ID`).

Then load the schema:

```bash
npm run db:init
```

## 5. Set your secrets

Never put these in `wrangler.toml` or commit them to GitHub. Set them as encrypted
Worker secrets:

```bash
wrangler secret put GMAIL_USER
wrangler secret put GMAIL_APP_PASSWORD
```

### Setting up Gmail SMTP (App Password)

Gmail will not accept your normal account password for SMTP — you need a
16-character **App Password**:

1. Go to your Google Account → **Security**.
2. Turn on **2-Step Verification** if it isn't already on (required for App Passwords).
3. Go to **Security → 2-Step Verification → App passwords**
   (direct link: https://myaccount.google.com/apppasswords).
4. Choose "Other (Custom name)", name it `EverPeak Internal`, click **Generate**.
5. Copy the 16-character password Google shows you (spaces don't matter).
6. When prompted by `wrangler secret put GMAIL_USER`, enter your full Gmail address
   (e.g. `you@gmail.com`).
7. When prompted by `wrangler secret put GMAIL_APP_PASSWORD`, paste the app password.

That's it — the Worker connects directly to `smtp.gmail.com:465` over TLS using
these credentials (via the `worker-mailer` library, which uses Cloudflare's raw
TCP socket support since Workers can't use Node's `net`/`nodemailer` directly).

**Gmail sending limits:** a normal Gmail account can send ~500 emails/day, which
is more than enough for staff invites. If you outgrow that, swap `sendMail()` in
`src/lib/email.js` for a transactional provider (Resend, Postmark, SES) later —
everything else in the app stays the same.

## 6. Create your first Manager account

There's no open sign-up page on purpose. Generate the SQL for your own account:

```bash
node scripts/create-admin.mjs you@yourdomain.com "A very-strong-P@ssw0rd!23"
```

It prints a `wrangler d1 execute` command — run it exactly as shown. That's your
first Manager login. From then on, invite everyone else from inside the app
(**Team / Invites** tab), which emails them a secure, single-use, 24-hour link
to set their own password.

## 7. Deploy

```bash
npm run deploy
```

Wrangler will bind the route in `wrangler.toml`
(`int.everpeakvisuals.com/*`) automatically as long as that zone
(`everpeakvisuals.com`) is active on your Cloudflare account. If you'd rather
manage the route by hand, delete the `[[routes]]` block from `wrangler.toml`
and attach a custom domain from the Cloudflare dashboard under
**Workers & Pages → everpeak-internal → Settings → Domains & Routes**.

## 8. Using it

- `https://int.everpeakvisuals.com/login` — staff sign-in.
- `https://int.everpeakvisuals.com/admin` — the dashboard (404 to anyone not logged in).
- `https://int.everpeakvisuals.com/booking` — public read-only availability calendar,
  with an "Admin Login" button top-right. Anyone can view it; only Managers can
  edit hours (from the admin panel's **Availability** tab).

## Security design notes

- **Passwords**: PBKDF2-SHA256, 210,000 iterations, random 16-byte salt per user. Never stored or logged in plaintext.
- **Sessions**: random 256-bit token in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. Only a SHA-256 hash of the token is stored server-side (in D1), so a database leak alone can't be replayed as a live session. Sessions expire after 12 hours.
- **CSRF**: double-submit token required as an `X-CSRF-Token` header on every state-changing request, checked against both the cookie and the server-side session record.
- **Brute-force protection**: failed logins are rate-limited per email+IP, with a lockout window after repeated failures.
- **RBAC enforced server-side**: every API route re-checks the caller's role from the database session — the read-only role can never write, no matter what the client sends.
- **Invites, not open sign-up**: accounts can only be created via a Manager-issued, single-use, time-limited (24h) emailed link, or the local bootstrap script. There is no public registration endpoint.
- **Default-deny routing**: every path other than `/login`, `/accept-invite`, and `/booking` requires a valid session or returns an identical, generic `404` — an outsider can't distinguish "wrong password" from "this page doesn't exist."
- **Security headers** on every response: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, `Referrer-Policy: no-referrer`, and `Cache-Control: no-store` so nothing sensitive gets cached.
- **Parameterized SQL** everywhere via D1's `.bind()` — no string-concatenated queries, so no SQL injection surface.
- The public `/booking` page and its API only ever return open time ranges — never client names, payment info, or booking IDs.

## Local development

```bash
wrangler d1 execute everpeak-internal-db --local --file=./schema.sql
wrangler dev
```

`wrangler dev` runs against a local D1 replica; use `.dev.vars` (gitignored) for
local secrets if you want to test email sending locally:

```
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=your16charapppassword
```

## Project structure

```
wrangler.toml            Worker + D1 binding + route config
schema.sql                D1 database schema
scripts/create-admin.mjs  Generates your first Manager account
src/index.js              Router — gates every request, returns 404 by default
src/lib/auth.js           Sessions, CSRF, login rate-limiting
src/lib/crypto.js         Password hashing, tokens
src/lib/email.js          Gmail SMTP sending + invite email template
src/lib/htmlShell.js      Shared HTML/CSS shell + security headers
src/lib/pages/            Server-rendered pages (login, 404, admin SPA, booking calendar, invite)
src/routes/authRoutes.js  /api/auth/* (login, logout, accept-invite)
src/routes/apiRoutes.js   /api/* authenticated CRUD (bookings, clients, payments, notes, availability, users, invites)
src/routes/publicRoutes.js /api/public/availability — public calendar data only
```
