# Scoring

How a built case turns into an approval-likelihood score, an RFE-risk score and a routing decision.

The scorer is deliberately simple: it is a **rule-based heuristic**, not a trained model. It cannot predict what USCIS will do. It turns what the verification and investigation stages found into numbers a reviewer can read, and it explains every point in plain English.

- Entry point: [`src/scorer/index.ts`](../src/scorer/index.ts), which exports `scoreCase(bundle)`
- Routing decision: [`src/lib/decision.ts`](../src/lib/decision.ts), a pure function shared by the pipeline, scorer, dashboard and dossier

## Where it runs

1. Vetting finishes: five source agents verify the claims, the reconciler builds the evidence ledger, the sceptic RAG checks it against past AAO denials, and seven investigators measure each failure mode it raises. A resolver settles each one, and the questioner merges everything into one list of follow-up questions.
2. The applicant answers the follow-up questions.
3. **Build case** (on the dashboard) writes the dossier, saves the case, assembles a `CaseBundle` and calls `scoreCase(bundle)`.
4. The result is validated, saved to the `scores` table and shown on the dashboard's score card.
5. The printable dossier (`/case/<id>/dossier`) opens with the score, the routing decision and the precedent check.

You can also re-run the scorer by hand on a saved case with `npm run score <applicantId>`.

## The lax rule

Wrongly passing a weak case costs an attorney a few minutes. Wrongly dropping a strong one loses a client. So evidence is **dropped only on high-confidence proof that it is invalid**:

- verification found the claim *contradicted*, with `identityConfidence >= 0.8` (a cited source shows it is false, and it is about this person), or
- the investigation *confirmed* a sceptic failure mode using a sourced measurement at `identityConfidence >= 0.8` (for example, zero forward citations on Google Patents for a patent claimed as impactful).

Everything else still counts. Doubtful but unconfirmed evidence passes "with caution": it raises the RFE risk and appears as an open point in the dossier.

A criterion **counts** if at least one of its evidence items passes. It is *clear* if one of those has nothing open, *open* otherwise, and *flagged* if every item was dropped. Three or more counted criteria routes the case to an attorney (`to_lawyer`); fewer means `needs_more_evidence`.

## Input: `CaseBundle`

Defined as `CaseBundleSchema` in [`src/lib/schemas.ts`](../src/lib/schemas.ts), which is the source of truth for every field. `GET /api/cases/<id>/bundle` returns a real one.

| Field | What it holds |
|---|---|
| `applicant` | Name and alternate names, field, current role and organisation, planned US work, profile links, CV text |
| `claims[]` | One per achievement on the intake form: its `criterion` (one of the eight O-1A criteria), a one-line `summary`, and the raw form entry |
| `findings[]` | The latest verdict per claim: `corroborated`, `partial`, `unverified` or `contradicted`, with `identityConfidence` (0-1), sources and reasoning |
| `discrepancies[]` | Questions raised during vetting, and how each was settled: `open`, `amended`, `substantiated`, `reframed` or `escalated` |
| `hypotheses[]` | Failure modes the sceptic found in past AAO denials, each investigated and marked `cleared`, `confirmed` or `still_unknown`, with the precedent and the measurements behind the result |
| `case` | The built case: criteria argued (with strength), criteria not argued, unresolved issues, suggested letter writers and the dossier as Markdown |

## Output: `ScoreInput`

```ts
{
  approvalLikelihood: number; // 0-100
  rfeRisk: number;            // 0-100, risk of a Request for Evidence
  reasoning: string;          // shown on the score card
}
```

The app validates the result, then adds `id`, `caseId` and `createdAt` before saving it. Returning `null` means "can't score yet": nothing is saved and the card shows "Awaiting score". An out-of-range number or a thrown error is caught and nothing is saved.

On the score card, `approvalLikelihood >= 70` reads as "Strong case" and `>= 45` as "Borderline"; `rfeRisk < 34` reads as "Low" and `< 60` as "Elevated".

## How the default scorer works

It calls `decide()` and converts the result to numbers with a single `WEIGHTS` table, so every adjustment is visible in one place:

- **Approval likelihood** starts at 50 with exactly three counted criteria, adds a bonus for each extra counted criterion and each criterion with nothing open, and subtracts for each contradiction, each cautioned item and each open follow-up question. Below three criteria it is capped low and scales with how many count.
- **RFE risk** starts from a base and rises with each open criterion, cautioned item, open question and contradiction. A case resting on exactly three criteria gets an extra bump, because one failure would sink it.

It makes no API calls, so the same bundle always gets the same score.

## Trying it locally

```bash
npm install
cp .env.example .env.local
npm run db:push
npm run seed:followup     # a test case with findings and open questions; no paid API calls
npm run dev               # answer the questions at /case/<id>/followup, then click "Build case"
npm run score <applicantId>
```

Each `npm run score` saves a new score, and the dashboard shows the latest.

## Replacing the scorer

`scoreCase` can be swapped for anything that returns a `ScoreInput`. An LLM-based version could look like this:

```ts
import { Agent } from "@mastra/core/agent";
import { ScoreInputSchema, type CaseBundle, type ScoreInput } from "../lib/schemas";

const scorer = new Agent({
  id: "scorer",
  name: "Scorer",
  model: "anthropic/claude-opus-5-5",
  instructions: "You are an experienced O-1A attorney. Estimate approval likelihood and RFE risk from the case bundle.",
});

export async function scoreCase(bundle: CaseBundle): Promise<ScoreInput | null> {
  const result = await scorer.generate(JSON.stringify(bundle), { structuredOutput: { schema: ScoreInputSchema } });
  return result.object;
}
```

A scorer in another language can run as its own service: `scoreCase` posts the bundle as JSON and reads back the three fields. If you replace the default, keep the lax rule above so that strong cases are not dropped on weak evidence.
