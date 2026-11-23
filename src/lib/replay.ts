/**
 * Server-side loader for replays/<id>.json (used by /case/[id]?replay=1).
 * Record a replay with: npm run replay:save -- --id <id>
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CaseBundle, Score } from "./schemas";
import { ReplayFileSchema, SAFE_CASE_ID, type ReplayFile, type ReplayLoad } from "./war-room";

export async function loadReplay(id: string): Promise<ReplayLoad> {
  if (!SAFE_CASE_ID.test(id)) return { ok: false, error: `“${id}” isn't a valid replay name.` };
  const file = path.join(process.cwd(), "replays", `${id}.json`);

  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return {
      ok: false,
      error: `No replay saved for case “${id}”. Record one with:`,
      command: `npm run replay:save -- --id ${id}`,
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: `replays/${id}.json is not valid JSON.` };
  }

  const parsed = ReplayFileSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `replays/${id}.json doesn't match the replay format (${issue.path.join(".")}: ${issue.message}).`,
    };
  }
  return { ok: true, file: parsed.data };
}

/**
 * Rebuild the dossier inputs (bundle + score) from a replay file, so the printable
 * dossier can be shown without a database. Mirrors loadCaseBundle() + getLatestCaseAndScore().
 */
export function bundleFromReplay(file: ReplayFile): { bundle: CaseBundle; score: Score | null } | null {
  const newest = <T extends { createdAt: string }>(rows: T[]) =>
    rows.reduce<T | null>((best, r) => (best === null || r.createdAt >= best.createdAt ? r : best), null);

  const caseRow = newest(file.cases);
  if (!caseRow) return null;
  const score = newest(file.scores.filter((s) => s.caseId === caseRow.id));

  // Newest finding per claim (a claim can be re-verified).
  const latest = new Map<string, (typeof file.findings)[number]>();
  for (const f of [...file.findings].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) latest.set(f.claimId, f);

  // Replays record only what the war room shows, so the applicant's contact details and each
  // claim's raw form entry (`payload`) are not in the file. The dossier reads neither, so
  // they are filled with placeholders here instead of failing CaseBundleSchema.
  const bundle = {
    applicant: {
      email: "demo@example.com",
      consentToCall: false,
      usWorkPlan: "",
      ...file.applicant,
      links: file.applicant.links ?? {},
      phone: null,
      cvText: null,
      additionalInfo: null,
    },
    claims: file.claims.map((c) => ({ ...c, applicantId: file.applicant.id, payload: {}, createdAt: file.applicant.createdAt })),
    findings: [...latest.values()],
    discrepancies: file.discrepancies,
    hypotheses: file.hypotheses,
    case: caseRow,
  } as unknown as CaseBundle;
  return { bundle, score };
}
