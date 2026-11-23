# O-1A Visa Vetting Agent

**🥉 Third Place | [Anything Applied Agentic Hackathon](https://luma.com/gap48i1m)**  
San Francisco · 7 November 2026

**🎥 [Watch our original hackathon submission demo](https://www.loom.com/share/c5d85f5988e8424caace7a379dfa6ac8)**
It's the original, slightly rushed version shown to the judges.

> This is the demo we submitted to the hackathon. It was recorded under a tight deadline, so it's a little rough around the edges, but it shows the workflow we built and presented.

## Overview

An experimental **multi-agent O-1A visa vetting system** that helps immigration teams review applicants' achievements and supporting evidence.

Applicants complete a structured intake form covering the eight O-1A evidentiary criteria. Research agents cross-check claims against public sources, highlight inconsistencies and gaps, ask targeted follow up questions, and assemble an evidence backed dossier for attorney review.

## What it does

- **Structured applicant intake:** Collects evidence of awards, memberships, press coverage, judging, original contributions, scholarly work, critical roles and remuneration.
- **Parallel research agents:** Dedicated agents investigate **Devpost, LinkedIn, GitHub, OpenAlex and press/web sources**, recording supporting links.
- **Evidence reconciliation:** Combines findings into an evidence ledger, distinguishing corroborated, partially verified, unverified and contradicted claims.
- **Precedent-aware investigation:** An optional Python RAG stage checks potential evidence weaknesses against published US Administrative Appeals Office (AAO) decisions, with follow-up investigation of flagged issues.
- **Applicant follow-up:** Generates targeted clarification questions and processes replies.
- **Case dossier and scoring:** Creates a printable, source-linked dossier and a deterministic, heuristic assessment of the evidence.

## How it works

```text
Applicant intake
      |
      +--> Devpost agent -----+
      +--> LinkedIn agent ----+
      +--> GitHub agent ------+--> Reconciler --> Evidence ledger
      +--> OpenAlex agent ----+
      +--> Press agent -------+
                                       |
                             Optional AAO RAG checks
                                       |
                          Clarification and follow-up
                                       |
                         Case dossier + heuristic score
```

Research agents are orchestrated with **Mastra**, with **Zod** schemas used for structured hand-offs. Their activity is displayed in a live *war room* dashboard. The current dossier builder uses a deterministic template, and the scorer is rule-based rather than a trained approval-prediction model.


## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 16, React, TypeScript, Tailwind CSS |
| Agents and orchestration | Mastra, Anthropic models, Zod |
| Research integrations | Exa, Apify, Devpost, GitHub REST API, OpenAlex |
| Legal precedent analysis | Python, retrieval-augmented generation using published AAO decisions |
| Data | SQLite/libSQL, Drizzle ORM |
| Output | Printable case dossier, deterministic scoring |


## Repository structure

| Path | Purpose |
| --- | --- |
| `src/app/apply/` | Multi-step application form |
| `src/mastra/agents/` | Research, reconciliation and follow-up agents |
| `src/mastra/workflows/o1-pipeline.ts` | Vetting and investigation orchestration |
| `src/mastra/tools/` | Research integrations |
| `rag/` | AAO precedent retrieval and analysis |
| `src/components/war-room/` | Dashboard, evidence ledger and agent activity |
| `src/lib/case-template.ts` | Structured case dossier implementation |
| `src/scorer/index.ts` | Deterministic, heuristic scoring |
| `replays/demo.json` | Fictional dashboard replay |
