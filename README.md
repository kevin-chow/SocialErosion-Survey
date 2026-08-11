# Workplace Vignette Study

A Next.js survey for a 32-condition workplace AI vignette study with 500
planned participants. Each participant receives eight counterbalanced
vignettes, answers the same six questions in a fixed order, and saves one
long-format row per vignette to Cloud SQL (Postgres).

## Study flow

```text
Consent → Participant ID → timed background reading → 6 counterbalanced
vignettes → 5 required questions per vignette → completion
```

The consent page embeds the full informed consent form in a scrollable
panel; participants must scroll to the end and check agreement before
continuing. Background is shown across multiple illustrated pages with
brief comprehension questions between sections. The
background timer starts only after PID registration and counts time while
introduction pages are visible. Each Save and continue click validates
all six answers, confirms the save, and advances only after Postgres
confirms the write.

## Editable configuration

- `config/study.json` — study size and assignment mode
- `config/consent.json` — consent-page copy and full embedded consent form
- `config/background.json` — background-page and dialog content
- `config/vignettes.json` — vignette text and factor metadata
- `config/questions.json` — the five shared questions and response scale
- `config/counterbalance.json` — all 500 eight-vignette assignment orders
- `public/aise_consent_form.pdf` — archived PDF copy of the consent form

All five shared questions have confirmed wording. See
[`docs/ADDING_OR_EDITING_VIGNETTES.md`](docs/ADDING_OR_EDITING_VIGNETTES.md).

The assignment table gives every vignette exactly 125 exposures. Every
participant receives two vignettes from each task type, all eight binary
factor combinations (one complementary pair per task type), and a 4/4
split on each binary factor. Vignette positions differ by at most one
exposure. Regenerate and validate the table with
`npm run generate:counterbalance`.

## Local setup

Local Postgres runs via Docker Compose.

```bash
npm install
docker compose up -d
```

Copy `.env.example` to `.env.local`:

```bash
DATABASE_URL=postgresql://vignette:vignette@127.0.0.1:5432/vignette_survey
```

`DATABASE_URL` is server-only. Never rename it with a `NEXT_PUBLIC_`
prefix or commit `.env.local`.

Start the website:

```bash
npm run dev
```

Open `http://localhost:3000`. Schema init (`db/schema.sql`) creates:

- `participants` — one row per PID (Prolific ID when recruited via Prolific), plus optional `prolific_study_id` / `prolific_session_id`
- `vignette_responses` — one row per PID and vignette
- `analysis_responses` — a view with analyst-friendly column labels
- `register_participant` — concurrent-safe counterbalance slot assignment

### Prolific study URL

Use this study link format in Prolific so IDs are captured automatically:

```text
https://YOUR-CLOUD-RUN-URL/?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
```

`PROLIFIC_PID` is captured from the study link and used as `participants.pid` (no confirmation screen). `STUDY_ID` and `SESSION_ID` are stored on the same row. The `/participant` page remains only as a manual fallback when the link has no Prolific params.

Redirects after the vignette portal (`config/redirects.json`):

- **Completed all vignettes** → Qualtrics post-study survey, with `PROLIFIC_PID`, `STUDY_ID`, and `SESSION_ID` appended
- **Incorrect comprehension question** → review the prior background page and retry (up to 3 total incorrect attempts, then the Prolific session ends)

Reset the local database:

```bash
docker compose down -v
docker compose up -d
```

## Validation

```bash
npm run lint
npm test
npm run build
```

## Google Cloud (Cloud Run + Cloud SQL)

Production runs as a container on **Cloud Run**, with study data in
**Cloud SQL for PostgreSQL**. Browser clients never receive database
credentials; all writes go through validated Next.js API routes.

### 1. Create Cloud SQL

```bash
export GCP_PROJECT=your-project-id
export GCP_REGION=us-east1
export CLOUD_SQL_INSTANCE=vignette-survey-db

gcloud config set project "$GCP_PROJECT"

gcloud sql instances create "$CLOUD_SQL_INSTANCE" \
  --database-version=POSTGRES_17 \
  --tier=db-f1-micro \
  --region="$GCP_REGION" \
  --storage-size=10GB \
  --storage-auto-increase

gcloud sql databases create vignette_survey \
  --instance="$CLOUD_SQL_INSTANCE"

gcloud sql users create vignette_app \
  --instance="$CLOUD_SQL_INSTANCE" \
  --password='choose-a-strong-password'
```

Apply the schema (Cloud SQL Auth Proxy is recommended):

```bash
# In another terminal:
# cloud-sql-proxy "$GCP_PROJECT:$GCP_REGION:$CLOUD_SQL_INSTANCE"

psql "postgresql://vignette_app:PASSWORD@127.0.0.1:5432/vignette_survey" \
  -f db/schema.sql
```

### 2. Deploy the app

For Cloud Run, use the Unix socket form of `DATABASE_URL`:

```bash
export DATABASE_URL="postgresql://vignette_app:PASSWORD@/vignette_survey?host=/cloudsql/${GCP_PROJECT}:${GCP_REGION}:${CLOUD_SQL_INSTANCE}"

chmod +x scripts/deploy-gcp.sh
./scripts/deploy-gcp.sh
```

The script builds the image with Cloud Build, deploys to Cloud Run, and
attaches the Cloud SQL instance. Prefer Secret Manager for the password
in long-lived environments instead of embedding it in shell history.

### 3. Export analysis data

```bash
psql "$DATABASE_URL" -c '\copy (select * from analysis_responses) to stdout with csv header' \
  > analysis_export.csv
```
