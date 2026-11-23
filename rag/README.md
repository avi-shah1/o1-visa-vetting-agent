# Sceptic RAG

A Python pipeline that checks an applicant's evidence against published US Administrative Appeals Office (AAO) decisions on O-1A petitions. For each piece of evidence it asks: *has the AAO rejected evidence like this before, and why?* The answers (called failure modes) become a queue that the TypeScript app investigates and turns into follow-up questions.

It is optional. Without it the app skips the investigation phase, and verification and follow-up questions still run.

## How it works

The corpus is already built and committed under `data/`, so you only need the last two stages to try it.

| Stage | Script | What it does |
| --- | --- | --- |
| 0a | `src/download.py` | Lists and downloads the AAO non-precedent O-1 decision PDFs from uscis.gov |
| 0b | `src/extract_text.py` | PDF to text with `pdfplumber`, falling back to OCR (`tesseract`) for scanned pages |
| 1 | `src/preprocess.py` | One fast-model call per decision produces a case card (outcome, criteria claimed and found not met) and slices the decision into per-criterion sections |
| 2 | `src/filter.py` | Deterministic: ranks case cards by criteria overlap with the applicant and keeps the top K. No model call |
| 3 | `src/judge.py` | A stronger model judges each piece of evidence against the retrieved decisions, then a citation check drops any precedent quote that does not appear verbatim in the source text |

`src/run.py` runs stages 2 and 3 for one applicant: applicant JSON in, queue JSON out.

Committed data:

- `data/manifest.json` — source URL for each decision PDF (642 entries)
- `data/cases.json` — structured record for each of the 641 decisions
- `data/cards.json` — the 216 non-procedural O-1A decisions used for retrieval
- `data/preprocessed/` — the cached stage 1 output, one file per decision

The PDFs and extracted text (`data/raw/`, `data/text/`) are not committed. They are regenerable and large.

## Setup

Python 3.10 or newer.

```bash
cd rag
python -m venv .venv
source .venv/bin/activate        # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Model access

Model calls go through the [Claude Code](https://claude.com/claude-code) CLI in headless mode (`claude -p`, see `src/llm.py`). There is no API key to set. You need Claude Code installed and logged in, with `claude` on your `PATH` (or set `CLAUDE_BIN`).

Optional environment variables: `RAG_FAST_MODEL`, `RAG_STRONG_MODEL`, `RAG_FAST_EFFORT`, `RAG_STRONG_EFFORT`, `RAG_WORKERS` (parallel calls, default 6) and `RAG_CALL_TIMEOUT` (seconds per call, default 900).

## Run it

```bash
python src/run.py input/applicant_test_01.json
```

This writes `out/queue_test_01.json`. The two test applicants in `input/` are fictional, and their expected queues are committed in `out/` for comparison.

An applicant file lists the evidence for each criterion (see `src/schemas.py` for the exact shape). The queue holds, per criterion, any failure modes found, with the precedent (decision ID and a verbatim quote), the reasoning, and a question to put to the applicant.

When the main app runs with this folder present, it calls `python src/run.py` itself. `SCEPTIC_RAG_DIR`, `SCEPTIC_PYTHON` and `SCEPTIC_MODE` in the root `.env.example` control how.

## Rebuilding the corpus

Only needed to refresh it with newer decisions.

```bash
pip install -r requirements-corpus.txt   # plus the Tesseract OCR binary
python src/download.py
python src/extract_text.py
python src/preprocess.py                 # --limit N, --since YEAR, --ids ... are available
```

Stage 1 makes one model call per decision, so a full rebuild is slow.

## Limits

- The corpus is the AAO's published non-precedent decisions, which are a sample, and a lopsided one: 574 of the 641 are dismissed appeals and only 10 were sustained. The queue shows what has been rejected before, not how likely a petition is to succeed.
- Retrieval matches on which criteria were claimed, not on field. Most failure modes in the corpus do not depend on field, but some do.
- Output comes from a language model. The citation check guards against invented quotes, not against a wrong reading of a real one. It is a screening aid for an attorney, not legal advice.
- Real applicant files and queues are gitignored. Only the `test_` fixtures are tracked.
