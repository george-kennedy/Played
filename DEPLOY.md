# Deploy

Played is a Next.js site. The production process is:

```bash
npm ci
npm run build
npm start
```

`npm start` listens on port 3000 unless `PORT` is set.

## Launch checklist

Do these once before public traffic:

1. Put the app behind **HTTPS** (Caddy, nginx, Traefik, or a platform load balancer). Session cookies are `Secure` in production; plain HTTP silently drops every login.
2. Mount a **persistent volume** for SQLite (`PLAYED_DB` or `/app/data` in Docker).
3. Copy `.env.example` and set:
   - `RESEND_API_KEY` + `RESEND_FROM` (real mail for verify / reset)
   - `BOOKING_ENABLED=1` (Book / Call for public courses with data)
   - `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (create the site in Plausible first)
4. Confirm `GET /api/health` returns `{ "ok": true }` through the proxy.
5. Sign up once, confirm the email arrives, mark a course, open Share, and check a course window shows Book or Call when expected.

Golf Canada connect stays closed until partner credentials exist and the score feed is wired. That is not required for launch.

## HTTPS

Session cookies are `Secure` in production: the app must sit behind a
TLS-terminating reverse proxy. Serving it over plain HTTP silently breaks every session — logins
will appear to succeed and then immediately drop.

If the proxy sets `X-Forwarded-For` / `X-Forwarded-Proto` / `X-Forwarded-Host`, strip client-supplied copies of those headers so rate limits and share URLs stay honest.

## Database

The SQLite file is created on first start and filled from `data/facilities.json`. Put it on a persistent volume. The default path is `data/played.sqlite` inside the working directory. Set `PLAYED_DB` to an absolute path on that volume when the process working directory is ephemeral.

## Environment

| Variable | Role |
| --- | --- |
| `PLAYED_DB` | Absolute path to the SQLite file. Optional when `data/played.sqlite` already lives on a persistent disk. |
| `RESEND_API_KEY` | Sends the email confirmation and password-reset links. |
| `RESEND_FROM` | From address for those messages. Both Resend variables are required for mail to leave the server. Without them, the link is shown on the next screen. |
| `GOLFCANADA_CLIENT_ID` | Partner client id. Live score pulls stay closed until both Golf Canada variables are set, and the score feed itself is not connected yet. |
| `GOLFCANADA_CLIENT_SECRET` | Partner client secret. Played does not ask golfers for a Golf Canada password. |
| `BOOKING_ENABLED` | Set to `1` to show Book or Call when a public course has that switch on in `data/reach.json`. Off otherwise. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Plausible site domain. The analytics script is not loaded when empty. |

See `.env.example` for a copy-paste template.

## Container

The `Dockerfile` uses `node:22-slim`, runs `npm ci` and `npm run build`, and declares `/app/data` as a volume. Mount a persistent disk there, or set `PLAYED_DB` to a path on another mounted volume. On start, the entrypoint copies `facilities.json`, `reach.json`, `reach-trouble.json`, and `rankings.json` onto that volume when each file is missing, so the first start can seed the database and Book/Call data.

```bash
docker build -t played .
docker run --rm -p 3000:3000 \
  -e BOOKING_ENABLED=1 \
  -e RESEND_API_KEY=... \
  -e RESEND_FROM=... \
  -e NEXT_PUBLIC_PLAUSIBLE_DOMAIN=played.example.com \
  -v played-data:/app/data \
  played
```

Health check hits `/api/health`. The image installs `python3`, `make`, `g++`, and `fonts-dejavu-core` so `better-sqlite3` and share PNG rendering work.
