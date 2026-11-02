---
name: qa-evidence
description: Run disciplined, evidence-backed QA/QC on an app before release — design test cases, set up an isolated test environment, execute them against real UI, capture step-by-step screenshot proof, verify results in the database, fix the bugs found, and produce a report that an outsider can audit. Use this skill whenever the user mentions QA, QC, testing before release, test cases, regression testing, "uji", "pengujian", "test dulu sebelum rilis", "cek semua fitur", quality control, acceptance testing, or asks whether an app is ready to publish to an app store. Also use it when the user asks for a testing report, bug report with evidence, or wants to know what still breaks — even if they never say the word "QA".
---

# QA with Evidence

Most QA output is worthless because nobody can check it. "Tested, works fine" is
a claim, not evidence. This skill produces QA that a skeptical outsider can
audit: every test case has a written expectation, a recorded execution, visual
proof of each step, and a verdict traced back to observed state.

The output is not a green checkmark. The output is **a record someone else can
re-walk**.

## Non-negotiable: never test against production

QA deliberately submits garbage, spams actions, fakes locations, and breaks
fixtures. Against a production database that means real employees' attendance,
leave, or payroll records get polluted with test junk that is painful to clean.

Before running a single test case, confirm the app points at an isolated
environment. If you cannot confirm it, stop and ask — do not guess from a
hostname that "looks like staging".

Typical isolation: a separate database, seeded fresh, with the API base URL
overridden via env var so the real config file is never touched.

```bash
# Laravel example — DB name overridden per-command, .env untouched
php artisan tinker --execute="DB::statement('CREATE DATABASE IF NOT EXISTS myapp_qc')"
DB_DATABASE=myapp_qc php artisan migrate:fresh --seed --force
DB_DATABASE=myapp_qc php artisan serve --host=0.0.0.0 --port=8000
```

Record the exact environment (database, host, device, app version) in the
report. A result nobody can locate is a result nobody can trust.

## The loop

Work **one module at a time and finish it completely** before starting the next.
Interleaving modules produces a report where nothing is conclusive and coverage
is impossible to state honestly.

1. **Design** test cases for the module → `references/test-case-format.md`
2. **Isolate** the environment (above)
3. **Execute** each case, capturing evidence per step
4. **Verify** the outcome in the database, not only on screen
5. **Fix** what breaks, add a regression test, re-run the failed case
6. **Report** the module → `references/report-format.md`

## Designing test cases

Split every module into three groups. The split matters because each group
catches a different class of defect, and mixing them hides gaps:

- **Normal (N##)** — the happy path a real user walks daily
- **Abnormal / edge (A##)** — bad input, boundary values, missing prerequisites,
  no network, states the UI should prevent
- **Chained (C##)** — flows that cross actors or modules (submitter → approver →
  back to submitter; leave approved → attendance blocked). These find the bugs
  single-actor testing never sees, because the bug lives in the handoff.

Every case names the **layer** it exercises (frontend, backend, or both).
A rule enforced only in the client is not enforced at all — someone will call
the API directly. When a case says "rejected", check *who* rejected it.

Full table format, status vocabulary, and worked examples:
`references/test-case-format.md`.

## Executing

**Drive the real UI.** Calling the API in a loop tests the API, not the app. The
release blocker found in the session this skill came from — every submission
form unusable on Android — was invisible to API tests and to iOS testing, and
would have shipped.

**Verify each captured screenshot before moving to the next step.** Blind
automation produces confident-looking evidence of the wrong screen. Look at what
you actually captured; if it shows a splash screen or the previous page, the
step did not happen.

**Wait for the thing you are proving, not for a timer.** A fixed sleep captures
the spinner as often as the result. Before each screenshot, wait until the
element the caption talks about is visible — the error text, the new status
badge, the toast — and only then shoot. A capture of a button mid-spin under a
caption that says "error shown" is a false exhibit, and it is the tester's bug.

**Confirm the outcome in the database.** The UI showing "Cancelled" and the
record actually being cancelled are different claims. Check status, related rows,
counters, and — critically — that side effects that should *not* have run,
didn't. When cancelling a request mid-approval, assert the remaining approval
step stayed `pending` rather than advancing.

**Some conditions are unreachable from the UI.** A broken approval chain or a
legacy status can only be created by editing data directly. Those are legitimate
tests: create the fixture, run the case, **restore the fixture afterward**, and
say plainly in the report that this case was verified at API/DB level rather
than through the screen. Never fabricate a screenshot flow that did not happen.

Platform playbooks — read the one matching the target before automating:

- Mobile (React Native / Expo, Android emulator): `references/mobile-expo.md`
- Web (browser via Chrome DevTools MCP): `references/web-browser.md`

Both contain traps that will silently corrupt your evidence if you don't know
them in advance.

## Evidence

Capture **one screenshot per meaningful step**, not just the final result. A
gallery of end states proves nothing about how you got there and cannot be
re-walked by anyone else.

Name files `<CASE-ID>-<step>.<ext>` (`N01-1.jpg`, `N01-2.jpg`). Write a caption
per step describing what the screen shows and why it matters — the caption is
what makes the image evidence rather than decoration.

### Resolution — legibility beats file size

Evidence nobody can read is not evidence. Pick the capture size by target:

| Target | Capture | Commit as |
|---|---|---|
| **Desktop / web** (tables, numbers, forms) | 1366×900 viewport at **device scale 2×** → 2732 px wide PNG | As captured. **Never downscale.** ~250–550 KB each |
| **Phone, portrait** | Native device screenshot | Downscale to ~420 px wide (~30 KB) — still readable, and full-res captures only bloat the repo |

Two traps, both learned the hard way:

- **Downscaling a desktop capture destroys it and saves almost nothing.** Going
  from 1366 px to 720 px made every rupiah amount unreadable while files only
  shrank ~35% — resampling turns flat UI colour into anti-aliased noise that PNG
  compresses badly. Going *up* to 2732 px cost only ~4× for 4× the pixels.
- **Never resize in place.** Resize a copy, or don't resize. Overwriting the
  originals means the only way back is re-running the whole module — including
  temporarily restoring pre-fix code to recapture every "before" screen.

Keep PNG for anything with figures in it; JPEG artifacts on small digits defeat
the purpose.

### Placement — one step, one row

For desktop captures set `"shots_per_row": 1` in the manifest. Each step then
gets its own row: numbered caption on top, the image below it spanning the
content width and **never past the page margins**, caption and image kept on the
same page. The four-per-row grid is for phone captures only; applied to a
desktop page it shrinks a 1366 px screen into a 30 mm thumbnail.

### Review before you call it done

Run `scripts/contact_sheet.py` on the manifest and read every sheet next to its
captions. This is mandatory, not optional polish: it is how a wrong screenshot
gets caught by you instead of by the reader. Look for a spinner or loading
state, a dialog that had not opened yet, a message that had not appeared yet,
and two steps showing the same picture. It also surfaces things you were not
looking for — a "before" screenshot that contradicts one of your own bug claims
is a finding, and the claim must be corrected, not the picture.

Store evidence and reports **inside the project repository**, so they travel with
the code and stay reviewable later.

## When a test fails

A failure is the point of testing, not an accident. Handle it fully:

1. Reproduce and identify the actual cause — not the first plausible guess
2. Check whether the same root cause affects other places (one broken date
   picker was breaking three separate forms, eight components in total)
3. Fix it, including the equivalent fix in any sibling codebase (mobile *and*
   web often share a validation bug)
4. Add a regression test so it cannot come back silently
5. Re-run the failed case and record the attempt history: failed → fixed → passed

The attempt history is valuable and must survive into the report. "Passed on the
second attempt after BUG-03 was fixed" is far more informative than "Pass".

## Honesty rules

These are what separate a useful report from a reassuring one. Violating them
makes the whole document worthless, because the reader can no longer tell which
parts to trust.

- **Never count your own tooling failure as an application defect.** If your
  automation sent a key that closed the dialog, that is your bug. Record it as a
  test-tooling problem, visibly separated from real findings.
- **Never count an untested case as passed.** If four cases did not run, the
  report says 17 tested, not 21.
- **Compute counts programmatically** from the source document. Hand-counted
  scoreboards drift from the table beneath them, and a reader who spots one
  wrong number stops believing the rest.
- **Distinguish verified-by-execution from verified-by-reading-the-code.** Both
  are legitimate; conflating them is not. Say which one applies.
- **Disclose self-testing bias.** When the same agent wrote the code and tested
  it, the tests inherit the author's blind spots. Say so, and name a specific
  thing a human should spot-check independently.
- **Report environment failures openly** — a crashed dev server, a wedged
  emulator, a reload that ate the form. Hiding them makes unexplained gaps look
  like negligence; disclosing them makes the record credible.

## Deliverables per module

- `test-cases/<module>.md` — cases + actual results + status, with per-step
  visual evidence embedded
- `evidence/<module>/` — the screenshots
- `report/` — the compiled report (markdown, and PDF via
  `scripts/build_report.py`)

Report structure, scoreboard, bug blocks, and the attempt-history visual:
`references/report-format.md`.

## Bundled scripts

Driven by a JSON manifest so they work in any project — no editing required.
See `scripts/README.md` for the manifest schema.

| Script | Purpose |
|---|---|
| `scripts/build_evidence.py` | Copy the used screenshots into the repo and generate the per-case evidence markdown |
| `scripts/build_report.py` | Compile the manifest into a PDF report |
| `scripts/contact_sheet.py` | Lay every referenced screenshot onto labelled sheets for the mandatory pre-delivery review |
| `scripts/check_links.py` | Verify every relative link and image in the docs resolves |

## Language

Match the project's existing documentation language. If the repository's docs
and UI copy are in Indonesian, write test cases, captions, and the report in
Indonesian too; if English, use English. Consistency with the codebase matters
more than any default.
