# TalentLens — AI Resume Screening POC

Screen resumes against a job description and get an HR-readable report in seconds. The AI reads and compares; the **score and recommendation are calculated in code**, so the same resume always gets the same verdict. HR then records the final decision, and everything is saved to the database of your choice (SQLite by default).

> **Proof of concept.** Demo credentials are hard-coded and there is no multi-user support. Do not expose it to the internet. See [Limitations](#limitations).

## Features

- **One simple Home page** — add a job description, add one resume or many, press **Screen**. You get a ranked shortlist with Accept / Talk / Reject buttons on each row.
- **Saved jobs** — pick a saved job description from a dropdown instead of pasting it again. It opens with its requirements and the shortlist screened so far; pasting the same text twice reuses the saved job.
- **Mandatory skills (the gate)** — click a skill to make it mandatory. A candidate missing one is flagged **Not eligible** whatever their score, and sinks below everyone eligible. Changing the list re-checks everyone already screened.
- **Shortlist filters** — filter by AI suggestion (Accept / Talk / Reject / Not eligible) or by your decision, and sort by match, name or newest.
- **Duplicate detection** — the exact same resume file on the same job is not screened twice (the earlier result is shown). The same email or full name elsewhere is flagged **Seen before**, with links to the other records.
- **HR decisions** — *Accept → L1/L2*, *Talk to candidate*, or *Reject*, with a note and status history.
- **Candidates register** — search and filter by status, job, date and eligibility; export to CSV.
- **Overview charts** — screened per week (split by outcome), accept rate, average time to decision, and where everyone stands. Each chart has a table view.
- **Activity log** — who did what and when: screenings, decisions, mandatory-skill changes, deletions and settings changes (never the secrets). Filter, search and export to CSV.
- **Your choice of AI** — **OpenAI**, **Anthropic**, Google **Gemini** or **Ollama** (fully local, e.g. Qwen). Pick from a dropdown in Settings.
- **PDF, DOCX and TXT** resumes supported.
- **Your choice of database** — **SQLite** (built in, zero setup), **PostgreSQL**, **MySQL / MariaDB** or **SQL Server**. Pick it in Settings and test the connection before saving.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Zod · `unpdf` + `mammoth` for parsing

## Getting started

Requires **Node.js 22.13+** (the built-in SQLite needs it).

```bash
git clone https://github.com/vipinvishal/Resume_scanner_POC.git
cd Resume_scanner_POC
npm install
npm run dev            # http://localhost:3000
```

For a smoother demo (faster, no dev overlay):

```bash
npm run build
npm start
```

Sign in with ID **`demo`** / password **`demo`** (defined in [lib/auth.ts](lib/auth.ts)).

### Try it fast

On **Home**, click **Try with sample data**. The sample JD and resumes are in [public/samples](public/samples).

## Settings: AI model and database

Open **Settings**. Everything there is a dropdown plus a **Test connection** button, so nothing is saved until it works.

**AI model**

| Provider | What to do |
|---|---|
| **OpenAI** | Paste your API key → **Fetch models** → choose one → **Test connection** → **Save**. |
| **Anthropic** | Same as above with your Anthropic key. |
| **Google Gemini** | Same as above with your Gemini key. |
| **Ollama (local)** | Run `ollama serve` and pull a model (e.g. `ollama pull qwen3:8b`) → **Fetch models** → pick it → **Save**. Default address is `http://localhost:11434`. |

OpenAI and Anthropic also have an *Advanced* box to use a different API address, for companies that route AI traffic through their own gateway (any OpenAI-compatible service works).

**Database**

| Type | What you enter |
|---|---|
| **SQLite (built in)** | Nothing — a file (`data/talentlens.db`) is created for you. Good for a quick start. |
| **PostgreSQL** / **MySQL / MariaDB** / **SQL Server** | Server address, port (optional), database name, user and password. If the database doesn't exist yet, TalentLens **creates it for you** (the login needs permission to create databases — for PostgreSQL that is usually `postgres`) and sets up its own tables inside it, all named `tl_…`, so it can sit next to other data. If the login isn't allowed to create databases, the screen says so in plain words and you can ask your admin to create an empty one. |

When you press **Save**, the connection is tested first. A setting that doesn't work is refused, so you can't lock yourself out. Switching to a different database starts with an empty list; records already saved stay in the old one.

**Upgrading from the JSON version:** the first time an empty database is connected, jobs, candidates and decisions from the old `data/screening.json` are imported automatically, and the file is renamed `screening.json.migrated`.

## How scoring works

The LLM extracts and compares facts. A deterministic formula turns them into a score:

| Component | Weight | Notes |
|---|---|---|
| Skills match | 70% | Must-have skills count 3×, nice-to-have 1×; present = full credit, partial = half |
| Experience fit | 20% | |
| Education fit | 10% | |

Default recommendation levels (adjustable in Settings):

| Score | Recommendation |
|---|---|
| 75+ | **Accept** |
| 50–74 | **Talk to candidate** |
| below 50 | **Reject** |

The HR decision is stored separately from the AI recommendation, so you can always see where a person overrode the AI.

## How it works

```
Resume (PDF/DOCX/TXT) ─▶ lib/parse.ts ─▶ text
Job description ────────────────────────▶ LLM extracts requirements (stored with the job)
text + requirements ─▶ LLM compares ─▶ validated JSON (Zod, one auto-retry)
                                      └▶ lib/analyze.ts computes score + verdict
                                          └▶ saved to the chosen database ─▶ report + HR decision
```

Local models are sloppier than the cloud ones at structured output, so responses are normalised (e.g. `"partially"` → `partial`) and validated before use.

## Project structure

```
app/
  (app)/          Signed-in pages: home, candidates, settings
  api/            Route handlers: analyze, candidates (+ CSV export), jobs, settings, stats, auth
  signin/         Sign-in page
components/       Shell, report, decision panel, inputs, UI primitives
lib/
  llm/            Provider adapters (openai, anthropic, gemini, ollama) + JSON extraction/validation
  analyze.ts      Prompts, schemas and the scoring formula
  db.ts           Jobs, candidates and history, stored through whichever database is selected
  store/          One small driver per database (sqlite, postgres, mysql, mssql) and the shared table layout
  settings.ts     Settings file (data/settings.json): AI provider, database connection, thresholds
  parse.ts        PDF / DOCX / TXT text extraction
  auth.ts         Demo session handling
public/samples/   Sample job description and resumes
```

## Data and privacy

- Candidates, job descriptions and decisions are stored in the database chosen in Settings. Back them up the way you back up that database; for SQLite, copy `data/talentlens.db`.
- Settings are in `data/settings.json` (git-ignored, readable only by you). It holds **your AI API keys and database password in plain text**, so keep the machine secure.
- With **Ollama**, resume text never leaves your machine. With **OpenAI**, **Anthropic** or **Gemini**, resume and job description text is sent to that company's API.

## Limitations

- The activity log lives in the same database as the candidates, and records the one demo user until real logins exist. It starts when this version is first run; earlier work isn't back-filled.
- "Not eligible" counts a mandatory skill as lacking only when the AI found no evidence at all ("missing"); "partial" still passes.
- "Same person" is judged by identical file, same email, or same full name — a shared name can be two different people, so a name match is only a hint.
- "Time to decision" is measured to the latest decision, and the charts show the last 8 weeks.
- Scanned (image-only) PDFs are not supported — no OCR yet.
- Single hard-coded demo login; no roles, no per-user audit trail.
- API keys and the database password are stored unencrypted in `data/settings.json`.
- Database connections with SSL turned on accept internal/self-signed certificates.
- No automatic copying of records between databases when you switch.
- Resumes are screened one at a time (gentle on cloud rate limits and local models).
- Local models can take 30–90 s per resume; use a smaller model if it is too slow.

## Contributing note

This project uses Next.js 16, which has breaking changes from earlier versions. See [AGENTS.md](AGENTS.md) before changing framework-level code.
