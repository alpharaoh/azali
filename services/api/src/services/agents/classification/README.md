# Classification agent

Classifies one product — one shipment line item — into its 10-digit HTSUS
statistical suffix with an audit-ready reasoning chain. Under the Customs
Modernization Act the importer bears a "reasonable care" burden, so the
deliverable is not a code: it is a defensible chain of GRI analysis, binding
Section/Chapter Notes, CROSS precedent, and named residual risk, grounded
entirely in lookups made during the run.

## Where it sits

The agent is invoked per line by the
[`classifyShipment`](../../../inngest/functions/classifyShipment/index.ts)
Inngest workflow (event `shipment/classify.requested`, emitted after
document ingest, after the email-intake window closes, or on-demand
re-classify). Lines run through a pool of 3:

1. **Product memory first.** If the line's product already carries a trusted
   code (`source: "broker"`, or agent confidence ≥ 0.95), it is reused and
   the agent never runs — recorded as `classification_reused` with
   `reusedFromProduct: true` on the line.
2. Otherwise `ClassificationAgentService.classify(...)` runs fresh.
3. Any fresh line under **0.95** routes the shipment to broker review
   (`reviewType: "classification"`, 6-hour deadline); the lowest-confidence
   line becomes the review headline. A fully confident shipment rides
   autopilot and its verdicts are indexed to Pinecone as precedent.

Classification is per-*product* and cacheable. PGA screening — the next
stage — is per-*shipment* and runs even for reused lines; see the
[PGA agent README](../pga/README.md).

## The run

`ClassificationAgentService.classify` ([`service.ts`](./service.ts)) builds
a **dossier** (line facts, shipment context, per-document extracted fields —
with the supplier-declared code explicitly framed as a hypothesis to
verify), then drives a `ToolLoopAgent`:

- **Model**: `claude-opus-4-8` with adaptive summarized thinking; two
  overloads in a row switch to `claude-sonnet-4-6` (8k thinking budget).
  Max 40 steps, 24k output tokens, 15-minute total deadline.
- **The answer is a tool call.** `submitClassification` takes the full zod
  result schema and ends the run (`hasToolCall` stop condition). This keeps
  the text channel free for narration — constrained output was where
  placeholder answers came from.
- **Everything is audited live.** The stream is consumed part-by-part and
  every reasoning block, tool call, and tool result lands in
  `agent_runs` / `agent_run_items` via `AgentRunRecorder` the moment it
  happens — a crashed run still has its partial record.

### Research tools

| Tool | Source | Role |
|---|---|---|
| `searchHts` | USITC (live) | Establish/verify candidate headings, rates, Chapter 99 overlay flags |
| `getChapterNotes` | USITC (live) | The legally binding Section/Chapter Notes — they include and exclude by force of law |
| `browseHtsHeading` | USITC (live) | Full 4-digit subtree for GRI 6 and the exact statistical line |
| `searchRulings` / `getRuling` | CBP CROSS (live) | Binding-ruling precedent; read the strongest hits, prefer HQ over NY |
| `searchPriorClassifications` | Pinecone | The brokerage's verified verdicts — strongest precedent |
| `searchKnowledge` | Pinecone | This importer's document record, for product facts |
| `webSearch` | Anthropic provider-side | Product facts and essential-character evidence — the law comes from HTSUS/CROSS |

## Calibration — the anchored rubric

Every submission declares a confidence band, and the score must sit inside
it ([`schema.ts`](./schema.ts)):

| Band | Range |
|---|---|
| `effectively_settled` | 0.93–0.98 |
| `clear_after_full_investigation` | 0.83–0.92 |
| `favored_with_named_risk` | 0.68–0.82 |
| `genuinely_contested` | 0.50–0.67 |
| `insufficient_evidence` | < 0.50 |

`calibrationViolations()` enforces the hard rules deterministically:

- Score inside the declared band.
- ≥ 0.83 ⇒ no `resolvable_unresolved` residual risks (research them or
  lower the score), no uninvestigated load-bearing premises, and every
  rejected alternate ≤ 0.05 (a live alternate means the primary is inflated;
  a defeated one scores ≤ 0.03 — no smearing probability to look humble).
- `genuinely_contested` ⇒ a recommendation (conservative filing code,
  binding-ruling decision, duty-recovery strategy) — the decisiveness lives
  there, not in an inflated score.
- Research tier 3 ⇒ a documented counter-case search against the leading
  candidate.
- `insufficient_evidence` ⇒ clarifying questions for the importer.

The result also carries the ordered GRI path, the Notes applied, rejected
alternates with duty deltas, verbatim citations, Chapter 99 overlays
(Section 301/232) assessed against the shipment's origin, and the one-line
effective duty picture.

## Guard rails

1. **Verification turn** — a run that answered with zero research lookups is
   sent back with the checklist; memory is not reasonable care.
2. **Repair turn** — no submission, an invalid code, or rubric violations
   trigger one `generateText` turn with forced `toolChoice` on
   `submitClassification` (research still in context, thinking disabled).
   Told to fix the calibration accounting, not to change the answer.
3. **Residual violations** after repair are non-fatal but recorded on the
   audit trail for the broker.
4. **Overload handling** — mid-stream 529s restart the pass with backoff;
   the second consecutive overload swaps in the fallback model.

A run that still lacks a valid code after all of this throws — the workflow
records a processing failure rather than filing a guess.

## Outputs & downstream

- **`agent_runs` + `agent_run_items`** — the canonical audit record
  (prompt name/version, dossier, every step, token usage, final result).
- **Line snapshot** — code, description, confidence, duty, alternates
  frozen on `shipment_line_items` (entry integrity: stays as-filed even if
  the product is later reclassified).
- **Product memory** — the product's current code/confidence/attributes,
  reused by future shipments once trusted.
- **Rationale memo** ([`memo.ts`](./memo.ts)) — the contemporaneous
  reasonable-care memo (facts, GRI analysis, notes, precedent, risks,
  duty), emitted as a timeline event in the broker-memo format.
- **Review loop** — broker approval/correction marks products
  `source: "broker"`, indexes the verdict to Pinecone, logs the calibration
  outcome, and triggers PGA screening on the way into compliance.

## Prompts

System prompt is Langfuse-managed (`shipment-classification-system-prompt`,
label `latest`) with the code fallback in [`prompt.ts`](./prompt.ts);
`scripts/sync-langfuse-prompts.ts` uploads missing prompts. The prompt
encodes the research-tier ladder (routine → standard → deep), the
exhaust-resolvable-uncertainty policy, and the calibration rubric the
schema enforces.
