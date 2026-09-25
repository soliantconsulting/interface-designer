---
description: Build a pitch demo for the Rapid GenAI Assessment program - replicate a client's existing FileMaker or Salesforce interface in React from screenshots, then overlay suggested AWS AI implementations as a guided tour. Use when preparing a GenAI opportunity pitch for an existing client; for a normal design mock use /interface-designer:new.
---

# Interface Designer — GenAI Demo

**Arguments:** `$ARGUMENTS`

**Format:** `{project-name} [--screenshots {path}] [--context {slug}] [--source filemaker|salesforce] [--opportunities {path}]`

| Argument | Required | Description |
|----------|----------|-------------|
| `project-name` | Yes | Folder name under `design/`. Convention: `{client}-genai` |
| `--screenshots` | No | Folder or zip of interface screenshots. If omitted, ask. |
| `--context` | No | project-context bank slug (e.g. `kieffersc`). If omitted, infer from the project name and confirm. |
| `--source` | No | What is being replicated. Default `filemaker`. |
| `--opportunities` | No | Path to a pre-written `aiOpportunities.ts` from the AWS team. If omitted, the command drafts one. |

**Examples:**
```
/interface-designer:genai-demo kieffers-genai --screenshots ~/Downloads/Kieffers.zip --context kieffersc
/interface-designer:genai-demo acme-genai --source salesforce --opportunities ./acme-ai.ts
```

---

## What this produces

A self-contained React app used to pitch AWS GenAI work to an existing client. It has two layers:

1. **A replica of the client's current system**, built from screenshots, as visually faithful as achievable. The client must recognise it instantly as their own software.
2. **A demo overlay** that spotlights points in that interface and explains a suggested AWS AI implementation at each one, sourced from the client's real pain points.

The pitch works because the client sees their own screens, not a generic mockup, with AI proposals attached to the exact places where their work hurts today.

This supports the **Rapid GenAI Assessment** ($7,500, 21-28 business days). The overlay content maps onto the engagement's deliverables: use case discovery, data readiness, business value, and the phased roadmap.

## Non-negotiable: fidelity first

The single most common failure is producing something that looks like a modern MUI app wearing a FileMaker hat. **Resemblance to the source system outranks visual polish, accessibility niceties, responsive behaviour, and house style.** If the original has a cramped 24px row with a hairline border and 11px text, reproduce that. Do not improve it. Do not round the corners. Do not add whitespace.

The interface-designer agent's normal MUI conventions **do not apply to the replica layer**. They do apply to the overlay layer, which is intentionally modern so it reads as commentary on top of the old system.

---

## Step 1: Gather inputs

1. **Screenshots.** If `--screenshots` points at a zip, extract to a temp dir. Ignore `__MACOSX`. List what you found and confirm the count with the user.

2. **Read every screenshot.** Do not skim. For each one, record in a scratch file `docs/fidelity-spec.md`:
   - Screen name and its role (list view, detail form, report, menu, dashboard)
   - Window chrome present (title bar text, traffic lights)
   - Header bar contents left to right
   - Every column header, in order, with alignment and any colour coding
   - Field labels and their positions
   - Tab names, in order, and which is active
   - Row height, font size, border weight, as closely as you can judge
   - Every colour you can name, as hex estimates
   - Status/badge text and its colour
   - Record counts, totals, and footer content

3. **Project context.** Read the context bank at `~/.claude/project-context/{slug}/`:
   - `digest.md` first
   - `jira-projects/*/summary.md` for the pain points and their evidence
   - `docs/` and `meetings/` for client-stated priorities and direct quotes
   - `gotchas/` if present

   If no bank exists, ask the user for context and proceed with what they give. Say clearly in the final report that opportunities were drafted without a context bank and are therefore weaker.

4. **Source system.** Confirm FileMaker or Salesforce. This selects the skin in Step 3.

## Step 2: Scaffold

Follow `/interface-designer:new` Steps 1 through 5 with these changes:

- Project folder: `design/{project-name}`
- **Do not** copy `templates/scaffold/src/theme/theme.ts`. Use the skin from Step 3 instead.
- **Do not** copy `templates/scaffold/src/routes/index.tsx`; the first replica screen becomes `src/routes/index.tsx`.
- Copy `templates/scaffold/src/routes/__root.tsx` but reduce its component to a bare `<Outlet />`. The window chrome comes from the skin, not the MUI AppBar.
- Also create: `mkdir -p src/{ai,components/fm,routes,services,types}`

## Step 3: Install the skin

Copy the whole of `${CLAUDE_PLUGIN_ROOT}/templates/genai-skin/src/` into the project's `src/`.

For `--source filemaker` this gives:
- `theme/filemakerTheme.ts` — the palette, type scale and density
- `components/fm/` — `FMWindow`, `FMHeader`, `FMGrid`, `FMField`, `FMTabs`, `FMPortal`, `FMToolbarButton`

For `--source salesforce`, use `theme/salesforceTheme.ts` and the `components/sf/` set instead.

**Then tune the skin to the actual screenshots.** The templates are a starting point calibrated to a typical FileMaker 19+ solution. Compare against the real screenshots and adjust the palette constants, row height and font sizes until they match. This tuning is expected, not optional.

## Step 4: Build the screens

One route file per screenshot under `src/routes/` (`index.tsx` for the home or menu screen, `orders.tsx` for `/orders`, and so on). Build them in the order the user would navigate them, starting with whatever screen acts as the menu or home.

Rules:

- **Mock data must look real.** Pull actual-looking values from the screenshots themselves: real customer names, real model numbers, real addresses, real totals. A demo full of "Acme Corp" and "Lorem ipsum" reads as a toy. Where a screenshot shows 20 rows, generate 20 rows.
- **Reproduce the record counts and totals** shown in the original ("Found 64 of 144188", "323 Item(s)", "1,280 Trade Partners"). These sell the impression of a live system.
- **Make navigation work** between the screens you built. A pitch demo that cannot be clicked through is a slide deck.
- Non-functional controls should look enabled, not disabled. They just do nothing on click, or show the tour.
- Put every screen on the same window chrome so the app looks like one system.

Add `data-ai="..."` attributes to every element an AI opportunity will point at. Name them for what they are, not for the opportunity: `data-ai="order-report-grid"`, not `data-ai="opportunity-3"`.

## Step 5: Draft the AI opportunities

If `--opportunities` was supplied, copy that file to `src/ai/aiOpportunities.ts` and skip the drafting.

Otherwise derive them. Each opportunity must be **traceable to evidence in the project context**, not invented. Work from:

- Recurring bug clusters (the same failure appearing across years)
- Manual processes described in meeting notes
- Explicit client asks, especially anything they repeated
- Reports the client requested and never got
- Any place the context shows a human doing pattern-matching, transcription, classification or lookup

For each candidate, write one entry against the schema in `src/ai/aiOpportunities.ts`:

| Field | Content |
|-------|---------|
| `ref` | `AI-01`, `AI-02`, ... |
| `phase` | `Quick Win`, `Phase 2`, or `Horizon` |
| `title` | Short, in the client's vocabulary |
| `painPoint` | What is broken today, in one or two sentences |
| `evidence` | The citation. Ticket key, meeting date, or doc name. **Never leave this empty.** |
| `proposal` | What we would build, concretely |
| `awsServices` | The AWS services involved. Bedrock for generative work, Textract for documents, Rekognition for images, Comprehend for text classification, and so on. Be specific and be correct. |
| `businessValue` | The measurable effect. Use the client's own numbers from the context where they exist. |
| `dataReadiness` | `Ready`, `Needs work`, or `Unknown`, with a short reason |
| `effort` | `S`, `M`, `L`, `XL` |
| `route` | The screen to navigate to |
| `highlights` | The `data-ai` targets to spotlight, each with a sentence |

Aim for **6 to 10 opportunities**. The brief promises "2-3 prioritized opportunities" as the assessment deliverable, so present more than that here and let the pitch narrow it down.

Order them so the first two are the most obviously valuable. The pitch often does not reach the end.

**Accuracy rules.** Do not state a cost saving the context does not support. Do not claim an AWS service does something it does not. Do not imply anything is already built. Mark anything speculative as such in `businessValue`. The AWS team will review this file, and wrong claims are worse than thin ones.

## Step 6: Wire the overlay

Copy `${CLAUDE_PLUGIN_ROOT}/templates/genai-tour/src/ai/` into `src/ai/`, keeping the `aiOpportunities.ts` you just wrote.

Mount in `src/main.tsx`, around the existing `RouterProvider`. The overlay sits outside the router, so it navigates through the router instance rather than a hook:

```tsx
<AIProvider>
    <RouterProvider router={router} />
    <AILauncher />
    <AIOverlay navigate={(to) => void router.navigate({ href: to })} />
</AIProvider>
```

The overlay:
- Dims the app, spotlights the target element, and shows a card with the opportunity
- Navigates to the opportunity's `route` before spotlighting
- Steps through highlights within an opportunity, then to the next opportunity
- Shows `AI-03 of 8` style progress and a jump menu
- Is visually modern and clearly AWS-branded, so it reads as an overlay on top of the legacy system rather than part of it

## Step 7: Verify fidelity

This is the step that decides whether the demo works.

1. `pnpm build` must pass.
2. Screenshot every built screen at the same viewport as the source screenshots.
3. **Put each screenshot side by side with its original** and compare specifically:
   - Header bar colour and height
   - Column order and header text, exactly
   - Row height and density
   - Font size and weight
   - Border colour and weight
   - Any colour coding (status text, highlighted columns, alternating rows)
4. Fix every mismatch you find, then re-screenshot.
5. Run the tour end to end. Every highlight must resolve to a real element. A spotlight on nothing is an obvious failure in front of a client.
6. Check the console is clean.

Show the user the side-by-side comparisons, not just the new screenshots.

## Step 8: Package for the pitch

1. Write `docs/ai-opportunities.md`: the same opportunities in readable form, for the AWS team to review and for the leave-behind.
2. Write `docs/fidelity-spec.md` if not already written in Step 1.
3. `CHANGELOG.md` entry.
4. Commit. Push if a remote is configured.
5. Report to the user:
   - Screens built, with the side-by-side comparisons
   - The opportunity list with refs, titles, services and phases
   - Anything in the screenshots you could not reproduce and why
   - **Which opportunities are weakest on evidence**, so the AWS team knows where to focus review

---

## Iteration

After the first build the user will refine. Typical asks and what they mean:

- "This does not look like FileMaker" — go back to Step 3, retune the skin against the screenshots, do not patch individual screens
- "Add an opportunity about X" — add to `aiOpportunities.ts` only, with evidence
- "The AWS team rewrote the opportunities" — replace `src/ai/aiOpportunities.ts` wholesale and re-verify every highlight target still resolves

## Important

- **Fidelity outranks polish.** Reread that sentence before every screen.
- **Every opportunity needs a citation.** No evidence, no opportunity.
- **Never claim something is built.** This is a proposal, and the client's real system is the thing in the screenshots.
- The client's data in screenshots is real business data. Keep it inside the demo. Do not send it anywhere.
- Mock data only. No backend, no live connection to the client's system. The brief is explicit that assessment prototypes use static, isolated data.
- Always screenshot and compare. Always update CHANGELOG.md. Always commit.
