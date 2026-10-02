# TalentLens — Resume screening POC

Compare resumes against a job description, get an HR-readable report, and record the decision
(**Accept → L1/L2**, **Talk to candidate**, or **Reject**). Everything is saved to a local SQLite file.

## Run it

Needs **Node.js 20+**.

```bash
npm install
npm run dev            # http://localhost:3000
```

For a smoother demo (faster, no dev overlay):

```bash
npm run build
npm start              # http://localhost:3000
```

Sign in with ID `demo` / password `demo` (hard-coded in `lib/auth.ts`).

## Choose the AI engine (Settings page)

| Where you are | Pick | What to do |
|---|---|---|
| Personal laptop | **Gemini** | Paste your API key, click **Fetch models**, choose one, **Test connection**, **Save**. |
| Office laptop | **Ollama** | Make sure Ollama is running (`ollama serve`) and the model is pulled (e.g. `ollama pull qwen3:8b`). Click **Fetch models** — your installed models appear in the dropdown — pick Qwen, **Test connection**, **Save**. |

The engine and model currently in use are always shown at the bottom of the sidebar.

## Where the data lives

`data/screening.db` — a single SQLite file, created automatically on first run. No server, no cost.
Back it up or move it by copying that file. **Delete it to reset the demo.** It is git-ignored.
It contains candidate data (and your Gemini key, in plain text), so keep it on the laptop.

## How the score works

The LLM only *reads and compares*; the score and recommendation are calculated in code, so the same
resume always gets the same verdict:

- Skills match — 70% (must-have skills count 3×, nice-to-have 1×; present = full, partial = half)
- Experience fit — 20%
- Education fit — 10%

Default levels: **75+ Accept**, **50–74 Talk to candidate**, **below 50 Reject**. Change them in Settings.

## Try it fast

On *Instant analysis* or *Bulk upload*, click **Fill with sample data** (files are in `public/samples`).

## Notes / limits

- PDF, DOCX and TXT are supported. Scanned (image-only) PDFs are not (no OCR yet).
- Bulk mode screens resumes one at a time — gentle on Gemini rate limits and on a local model.
- Local models can take 30–90 s per resume depending on the laptop; use a smaller model if it is too slow.
- Next.js 16: see `AGENTS.md` before changing framework-level code.
