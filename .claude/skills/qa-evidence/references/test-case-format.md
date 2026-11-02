# Test case format

One file per module, named to match the feature documentation so the two can be
diffed against each other (`docs/fitur/cuti.md` → `test-cases/cuti.md`). When a
feature doc changes, its test case file is the next thing to review.

## Header

Every file opens with the technical source, a link to the QA README (environment
setup), and any prerequisite the tester must arrange before starting.

```markdown
# Test Case — Cuti (tab Ajuan → CUTI)

Sumber teknis: [`docs/fitur/cuti.md`](../fitur/cuti.md).
Cara baca tabel & kolom **Lapisan**: lihat [`README.md`](./README.md).

**Ingat**: jalankan di backend lokal/staging, bukan production. Butuh akun
dummy dengan rantai persetujuan sudah dikonfigurasi di departemennya.
```

State prerequisites explicitly. A case that silently needs a second account with
a specific role will otherwise be marked "blocked" by whoever runs it next.

## The table

```markdown
| ID | Skenario | Langkah | Hasil Diharapkan | Lapisan | Hasil Aktual | Status |
|---|---|---|---|---|---|---|
```

| Column | Contains |
|---|---|
| **ID** | `N01` normal, `A01` abnormal/edge, `C01` chained. Stable forever — reports reference these |
| **Skenario** | One line: what is being tested |
| **Langkah** | Concrete input values, not "fill the form". `type=sick, start=today-8d, no attachment` |
| **Hasil Diharapkan** | Observable outcome. If an error is expected, quote the message the user should see |
| **Lapisan** | `FE`, `BE`, or `FE+BE` — which layer must enforce it |
| **Hasil Aktual** | Filled during execution. Quote real messages and real IDs |
| **Status** | See vocabulary below |

## Why "Lapisan" earns its column

It forces the question *who actually enforces this rule*. A date picker that
prevents selecting yesterday is convenient, but if the server accepts yesterday
when called directly, the rule does not exist. Cases marked `FE+BE` must be
checked twice: once through the UI, once by calling the endpoint directly.

This column is how the session that produced this skill found a real bug — the
client blocked sick leave without a doctor's note, the API happily accepted it,
and the same hole existed in the web app.

## Status vocabulary

| Status | Meaning |
|---|---|
| `Pass` | Executed, behaved as expected |
| `Fail` | Executed, did not behave as expected. Needs a bug entry |
| `Blocked` | Could not run — missing account, unreachable prerequisite, broken environment |
| `Belum diuji` / `Not run` | Not attempted yet. Never leave blank, and never round up to Pass |

A case that passed only after a fix is still `Pass`, but the Hasil Aktual must
carry the history:

> Awalnya GAGAL (BUG-03: form terkunci date picker di Android). **Setelah
> diperbaiki**: form terbuka bersih, pengajuan berhasil → muncul di daftar
> sebagai "Cuti tahunan 28 Jul · Menunggu · Level 1/2".

## Grouping

```markdown
## A. Kondisi Normal
## B. Kondisi Tidak Normal / Edge Case
## C. Alur Berantai (lintas aktor)
```

Chained cases need a note explaining who performs each action and where, since
they usually require switching accounts:

```markdown
Aksi approve/reject bisa dilakukan dari mobile (sub-tab PERSETUJUAN) atau dari
web. Yang diuji di sini: perilaku app di sisi PENGAJU setelah tiap transisi.
```

## Coverage checklist per module

Work through these when designing; most modules need most of them.

**Normal**
- The primary happy path, end to end
- Each distinct variant (leave type, request mode, role)
- Reading back what was created — does the list reflect it correctly
- Cancelling / undoing, where allowed

**Abnormal**
- Every validation rule, tested at the boundary and one step past it
  (7 days back allowed → test 7 *and* 8)
- Required field omitted entirely — this is where non-implicit validation rules
  silently skip, a classic Laravel Closure-rule bug
- Value too long / too short
- Action attempted in a state that forbids it (cancel something already approved)
- Missing configuration (no approval chain, no schedule)
- Broken configuration (approver deleted from the system)
- Legacy data shapes still present in production
- No network at submit — and confirm the form contents survive

**Chained**
- Multi-step approval advancing level by level
- Final approval and its side effects (balance decremented, status settled)
- Rejection with reason, visible back on the submitter's screen
- Submitter cancels midway — the remaining steps must *not* advance
- Cross-module consequences (approved leave blocks check-in that day)

## Keep it re-runnable

Prefer relative dates ("tomorrow", "today − 8 days") over hardcoded ones, so the
file still works next month. When a case needs a fixture that must be created
directly in the database, say so in Langkah and note that it has to be restored
afterward.
