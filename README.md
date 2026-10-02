# TalentLens — AI Resume Screening POC

Screen resumes against a job description and get an HR-readable report in seconds. The AI reads and compares; the **score and recommendation are calculated in code**, so the same resume always gets the same verdict. HR then records the final decision, and everything is saved to a local JSON file.

> **Proof of concept.** Demo credentials are hard-coded and there is no multi-user support. Do not expose it to the internet. See [Limitations](#limitations).

## Features

- **Instant analysis** — one job description, one resume, full report (ideal for a walk-in or referral).
- **Bulk upload** — one job description, many resumes, ranked shortlist; decide candidate by candidate.
- **HR decisions** — *Accept → L1/L2*, *Talk to candidate*, or *Reject*, with a note and status history.
- **Candidates register** — search and filter by status, job and date; export to CSV.
- **Two AI engines** — Google **Gemini** (cloud) or **Ollama** (fully local, e.g. Qwen). Switch in Settings.
- **PDF, DOCX and TXT** resumes supported.
- **Local-first** — all data lives in one JSON file, with no database or native modules to install on your machine.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Zod · `unpdf` + `mammoth` for parsing

## Getting started

Requires **Node.js 20+**.

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

On *Instant analysis* or *Bulk upload*, click **Fill with sample data**. The sample JD and resumes are in [public/samples](public/samples).

## Choose the AI engine

Open **Settings**. The active engine and model are always shown at the bottom of the sidebar.

| Where you are | Pick | What to do |
|---|---|---|
| Personal laptop | **Gemini** | Paste your API key → **Fetch models** → choose one → **Test connection** → **Save**. |
| Office / offline | **Ollama** | Run `ollama serve` and pull a model (e.g. `ollama pull qwen3:8b`) → **Fetch models** → pick it → **Test connection** → **Save**. Default URL is `http://localhost:11434`. |

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
                                          └▶ saved to data/screening.json ─▶ report + HR decision
```

Local models are sloppier than Gemini at structured output, so responses are normalised (e.g. `"partially"` → `partial`) and validated before use.

## Project structure

```
app/
  (app)/          Signed-in pages: home, analyze, bulk, candidates, settings
  api/            Route handlers: analyze, candidates (+ CSV export), jobs, settings, stats, auth
  signin/         Sign-in page
components/       Shell, report, decision panel, inputs, UI primitives
lib/
  llm/            Provider adapters (gemini.ts, ollama.ts) + JSON extraction/validation
  analyze.ts      Prompts, schemas and the scoring formula
  db.ts           JSON-file storage (jobs, candidates, history, settings)
  parse.ts        PDF / DOCX / TXT text extraction
  auth.ts         Demo session handling
public/samples/   Sample job description and resumes
```

## Data and privacy

- Data is stored in `data/screening.json`, created automatically on first run. Copy the file to back it up; **delete it to reset the demo**.
- It is **git-ignored**. It contains candidate data **and your Gemini API key in plain text**, so keep it on the laptop.
- With **Ollama**, resume text never leaves your machine. With **Gemini**, resume and JD text is sent to Google's API.

## Limitations

- Scanned (image-only) PDFs are not supported — no OCR yet.
- Single hard-coded demo login; no roles, no per-user audit trail.
- API key is stored unencrypted in the JSON data file.
- Bulk mode screens resumes one at a time (gentle on Gemini rate limits and local models).
- Local models can take 30–90 s per resume; use a smaller model if it is too slow.

## Contributing note

This project uses Next.js 16, which has breaking changes from earlier versions. See [AGENTS.md](AGENTS.md) before changing framework-level code.
