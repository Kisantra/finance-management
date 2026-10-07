# Playbook: web apps in a browser

For Laravel/Blade, Inertia, React, or any browser-delivered UI. Uses the
Chrome DevTools MCP tools when available (`mcp__chrome-devtools__*`); the
principles hold with any driver.

## Why the browser and not curl

The same reason as mobile: calling endpoints tests the endpoints. Rules enforced
only in the client, broken states that only appear after hydration, and forms
that submit the wrong payload are all invisible to API-level testing.

Test through the UI, then separately probe the same rule via the API to see
which layer actually enforces it. That pairing is what the `Lapisan` column in
the test case table exists to record.

## Loop per step

1. `navigate_page` / `click` / `fill_form` — perform the action
2. `take_snapshot` — the accessibility tree; use it to find elements by role and
   name rather than guessing CSS selectors, which break on every redesign
3. `take_screenshot` — the evidence for this step
4. `list_console_messages` — check for errors the UI swallowed silently
5. Verify the outcome in the database

Snapshot before screenshot: the snapshot gives stable element identifiers for
the *next* action, and confirms the page actually reached the expected state
before you spend a screenshot on it.

## Evidence

Same rule as everywhere: one screenshot per meaningful step, named
`<CASE-ID>-<step>.png`, with a caption saying what it proves.

For full-page state use a full-page screenshot; for a specific validation
message, screenshot the region so the reader does not have to hunt for it.

Set a consistent viewport at the start of a module, and record it in the report
— layout-dependent findings are meaningless without it.

### Capture at device scale 2×, and never downscale

Desktop evidence is captured at a 1366×900 viewport with `deviceScaleFactor: 2`,
giving 2732 px wide PNGs. A plain `resize_page` keeps the scale at 1×, which is
not enough once the image is placed in a report. With Playwright, open a
dedicated context for the module and screenshot with `scale: 'device'`:

```js
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.screenshot({ path: 'shots/<modul>/N01-1.png', scale: 'device' });
```

A new context has no cookies — log in again inside it. Set `"shots_per_row": 1`
in the manifest so the report gives each step its own full-width row.

### Wait for the evidence, then shoot

```js
await p.getByRole('button', { name: 'Simpan' }).click();
await p.getByText('Rekening tujuan wajib dipilih').waitFor({ state: 'visible' });
await p.screenshot({ path: 'shots/<modul>/A06-1.png', scale: 'device' });
```

`waitForTimeout(1500)` followed by a screenshot is how a spinner ends up as
"proof" of an error message. Wait on the element the caption describes. Toasts
disappear on their own — wait for them and shoot immediately.

### Recapturing "before" screens after a fix

If evidence has to be retaken once bugs are fixed: copy the fixed files aside and
record their sha256, restore the pre-fix versions (`git show HEAD:path > path`),
rebuild, reseed the QA database, re-run the flow for the "before" shots, restore
the fixed files, **verify the hashes match**, rebuild, and capture the "after"
shots. Re-running is legitimate evidence; pasting an old picture under a new
caption is not. Say in the report that a re-run happened and on what date.

## Things worth testing that mobile QA forgets

- **Console errors on every page.** A page can look perfect and be throwing on
  each render. `list_console_messages` after each step catches it.
- **Server-side validation with JS disabled or bypassed.** Submit the form
  directly with `curl` and the session cookie. Client-only rules will show up
  immediately.
- **Authorization by URL.** Log in as a low-privilege user and navigate straight
  to a privileged route. Hidden menu items are not access control.
- **Back button and re-submit.** Browser back after a POST, then resubmit —
  duplicate records are a classic web-only bug with no mobile equivalent.
- **Session expiry mid-form.** Long forms plus a short session equal lost work;
  confirm the app fails gracefully instead of silently discarding input.
- **Network failure at submit**, via DevTools offline emulation — the web
  counterpart of the mobile no-connection case.

## Verifying in the database

Same discipline as mobile — the screen saying "saved" is a claim.

```bash
DB_DATABASE=myapp_qc php artisan tinker --execute="
  \$r = App\Models\LeaveRequest::latest('id')->first();
  echo \$r->id.' '.\$r->status.' '.(\$r->attachment_path ?: '-').PHP_EOL;
"
```

Check the record, its related rows, and that side effects which should *not*
have fired, didn't.

## Probing the layer

After the UI rejects something, confirm the server does too:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/login \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"email":"staff@example.com","password":"password","device_name":"qc"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

curl -s -X POST http://localhost:8000/api/v1/leave/request \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: application/json' \
  -F 'type=sick' -F 'start_date=2026-07-26' -F 'reason=tanpa lampiran'
```

If the client blocked it and the API accepts it, that is a finding — record it
as `FE+BE` with the backend failing, not as a pass.

## Reporting environment problems

As with mobile, browser/tooling failures are not application defects. A hung
dev server, an MCP connection that dropped, a page that failed to load because
Vite was rebuilding — note them in the test-tooling section, never in findings.
