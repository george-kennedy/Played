# Deploy

Played is a Next.js site. The production process is:

```bash
npm ci
npm run build
npm start
```

`npm start` listens on port 3000 unless `PORT` is set.

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

## Container

The `Dockerfile` uses `node:22-slim`, runs `npm ci` and `npm run build`, and declares `/app/data` as a volume. Mount a persistent disk there, or set `PLAYED_DB` to a path on another mounted volume. On start, the entrypoint copies `data/facilities.json` onto that volume when the file is missing, so the first start can seed the database.

```bash
docker build -t played .
docker run --rm -p 3000:3000 -v played-data:/app/data played
```

The image installs `python3`, `make`, and `g++` so `better-sqlite3` can compile when a prebuilt binary is not available for that platform.
