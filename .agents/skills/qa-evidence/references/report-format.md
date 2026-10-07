# Report format

The report answers four questions for someone who was not there:

1. What was tested, and against what environment
2. What broke, why, and what was done about it
3. How many attempts each case needed — and what happened in the failed ones
4. What the reader should still be suspicious of

One report per module. Store it in the repository next to the test cases.

## Structure

```
1. Title + one-paragraph scope (what, which environment, which accounts)
2. Scoreboard      — 4 numbers, computed from the source document
3. Summary         — the headline finding in plain language
4. Bugs found & fixed  — one block per bug
5. Results table   — every case, with attempt history
6. Visual evidence — per test case, step by step
7. Additional notes — findings outside the test case scope
8. Test tooling problems — clearly separated from real defects
9. Honesty note    — what to double-check independently
```

## Scoreboard

Four numbers, always computed by script from the test case file — never counted
by hand. A scoreboard that disagrees with the table below it destroys the
reader's trust in everything else.

```
21  test cases executed
21  eventually passed
 3  failed on first attempt
 3  bugs fixed
```

If some cases did not run, say so here: `17 executed, 4 not run`. Never round up.

## Bug block

One per bug, same six rows every time so they can be scanned:

| Row | Contains |
|---|---|
| **SIFAT** | Severity in plain words — "release blocker for Android", "high", "low" |
| **MENGGAGALKAN** | Which test case IDs this bug caused to fail. This is the link between the bug and the evidence |
| **GEJALA** | What the user sees. Quote the real message |
| **SEBAB** | The actual mechanism — not "a bug in the picker" but why it behaves that way |
| **CAKUPAN** | Everywhere else the same root cause reaches. Usually wider than where it was found |
| **PERBAIKAN** | What changed, where, and how it was verified |

CAKUPAN earns its place: the picker bug found in one form was breaking three
forms and eight components. Without that row the reader thinks it was a
one-line fix in one screen.

## Results table

```
| ID | Skenario | Percobaan | Catatan: kenapa gagal & apa perbaikannya | Status |
```

**Percobaan** is a row of coloured squares, one per attempt:

- red — attempt failed because of an application defect
- grey — attempt aborted by a test tooling problem, **not** an app defect
- green — attempt passed

`fp` renders red→green: failed once, passed after the fix. `p` is a single
green: passed first time. `tp` is grey→green: the first run was ruined by the
harness, which is honest and visibly different from a real failure.

The Catatan column carries the story: what failed, what the fix was, what
passing looked like. This is the column a reader actually reads.

## Visual evidence

Per test case, numbered screenshots with a caption each. The layout depends on
what was captured, and is set by `shots_per_row` in the manifest.

**Desktop / web — one step per row (`"shots_per_row": 1`).** The caption sits on
top, the image below it at the full content width. The image must never extend
past the left and right page margins, and a caption must never be separated from
its image by a page break. A full-page capture taller than the page is scaled
down to fit rather than split. This is the required layout for any screen that
carries tables or figures — a reader has to be able to read the amounts.

```
## N01 · Index Februari 2026: tabel & statistik — Pass

**1.** Kondisi awal `/invoices`: bulan berjalan kosong karena seed berisi Jan–Mar.

<img src="../evidence/invoices/N01-1.png" width="100%">

**2.** Setelah pilih Februari 2026: 2 baris, Pendapatan Rp 6.000.000 — cocok dengan seed.

<img src="../evidence/invoices/N01-2.png" width="100%">
```

**Phone, portrait — grid (default, `shots_per_row` omitted or 4).** Tall narrow
captures stay readable four to a row on A4, and a grid shows a flow at a glance.

```
## N01 · Ajukan cuti tahunan valid — Pass (percobaan ke-2)

| # | Langkah & yang terlihat | Layar |
|---|---|---|
| 1 | Kondisi awal: daftar pengajuan yang sudah ada.        | <img src="..." width="200"> |
| 2 | Tekan Ajukan Cuti — form terbuka.                     | <img src="..." width="200"> |
```

Mark comparison shots in the caption itself — start with **SEBELUM:** /
**SESUDAH:** — so a reader skimming one row knows which side of the fix it is.

Captions describe **what the screen shows and why it matters**, not what was
clicked. "Tanggal 28 ke bawah abu-abu: aturan H-1 sudah ditegakkan di picker"
is evidence. "Tapped the date field" is narration.

For cases with no UI flow, say so explicitly and show the API response instead.
Never invent a screenshot sequence for something executed via API.

## Additional notes

Findings outside the test case scope — real, but not what was being tested.
Give them IDs so they can be tracked (`BUG-04`, `UX-01`). Say why they were not
fixed: out of module scope, needs backend work, awaiting a decision.

These are often the most valuable part of the report, because nobody was looking
for them.

## Test tooling problems

A short list of what went wrong with the harness: a crashed dev server, a wedged
emulator, an automation keystroke that closed a modal. Prefix the section with a
sentence stating that none of these are counted as test failures.

Omitting this section makes gaps in the record look like carelessness.
Including it makes the record credible.

## Honesty note

Close with what the reader should verify independently. Be specific — a generic
disclaimer is noise.

> Sebagian besar kode yang diuji di sini ditulis oleh asisten yang sama yang
> menjalankan pengujian, sehingga ada risiko pengujian mengikuti asumsi yang
> sama dengan asumsi saat menulis kodenya. Disarankan memeriksa ulang beberapa
> hasil secara acak — terutama memastikan tanda tangan approver dari mobile
> benar-benar tampil sebagai gambar di halaman detail versi web, bukan sekadar
> tersimpan dengan format yang benar.

Name one concrete thing a human should check. That single sentence does more for
the report's credibility than the entire summary.

## Environment footer

```
Lingkungan uji: database attendance_qc, backend lokal 192.168.1.41:8000,
emulator Pixel 6 (Android 14), Expo Go SDK 54.
```

A result nobody can locate is a result nobody can reproduce.
