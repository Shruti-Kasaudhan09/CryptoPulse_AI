# Deployment (Phase 22)

Three free services, deployed in this order:

```
Supabase (PostgreSQL)  ◄──  Render (FastAPI, Docker)  ◄──  Vercel (React)
                                    ▲
                    GitHub Actions: daily sentiment + redeploy
```

Total time: about 30 minutes. Push the repo to GitHub first.

---

## 1. Database — Supabase

1. Create a project at [supabase.com](https://supabase.com). Pick the **Mumbai
   (ap-south-1)** region and save the database password.
2. **Project Settings → Database → Connection string → URI**. Choose the
   **Session pooler** string (works on free plans and from Render).
3. Replace `[YOUR-PASSWORD]` in it. It looks like:
   ```
   postgresql://postgres.abcd:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
   ```
   The backend accepts this as-is (it rewrites `postgres://` / `postgresql://`
   to the SQLAlchemy driver form automatically).

Tables are created automatically on the backend's first start — no SQL needed.

## 2. Backend — Render

1. [render.com](https://render.com) → **New + → Blueprint** → select your repo.
   Render reads `render.yaml` and creates the `cryptopulse-api` service.
2. When prompted, set:
   - `DATABASE_URL` = the Supabase string from step 1
   - `CORS_ORIGINS` = leave as `http://localhost:5173` for now (updated in step 3)
3. Deploy. On boot `start.sh` downloads prices, trains the models (LSTM is
   skipped — TensorFlow is too big for the free tier), syncs the database
   and starts the API. **First boot takes ~5 minutes.**
4. Check `https://<your-service>.onrender.com/api/health` →
   `{"status":"ok","data_ready":true,...}`
5. **Settings → Deploy Hook** → copy the URL (used in step 4).

> Free Render services sleep after 15 minutes idle and take ~1 minute to wake.
> Open the API URL a few minutes before your demo.

## 3. Frontend — Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
2. **Root Directory**: `frontend/cryptopulse-dashboard` (framework: Vite is detected).
3. **Environment Variables**: `VITE_API_URL` = `https://<your-service>.onrender.com`
4. Deploy, then copy your Vercel URL.
5. Back in Render → Environment → set `CORS_ORIGINS` to your Vercel URL
   (e.g. `https://cryptopulse-ai.vercel.app`). Preview deployments on
   `*.vercel.app` are already allowed.

## 4. Daily refresh — GitHub Actions

In GitHub → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `DATABASE_URL` | the Supabase string |
| `RENDER_DEPLOY_HOOK` | the Render deploy hook URL |

`.github/workflows/daily-refresh.yml` then runs every day at 05:50 IST:
it scores the day's headlines with FinBERT, stores the result in Supabase
(so sentiment history survives redeploys), and triggers a Render redeploy
so prices and models are refreshed. Run it once by hand from the **Actions**
tab to check it works.

`.github/workflows/ci.yml` runs all tests and the frontend build on every push.

## Running with Docker locally

```bash
docker build -f backend/Dockerfile -t cryptopulse-api .
docker run -p 8000:8000 -e DATABASE_URL="postgresql://..." cryptopulse-api
```

Without `DATABASE_URL` it uses a SQLite file inside the container.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard: "Can't reach the CryptoPulse API" | Render is asleep (wait a minute) or `VITE_API_URL` is wrong — it must not end in `/` |
| Browser console: CORS error | Your Vercel URL isn't in `CORS_ORIGINS` on Render |
| `503 data_not_ready` | Pipeline failed on boot (usually Yahoo Finance). Check Render logs, then redeploy |
| Supabase connection refused | Use the **Session pooler** connection string, not the direct one |
| Sentiment card says "No sentiment logged yet" | Run the daily-refresh workflow once from the Actions tab |
