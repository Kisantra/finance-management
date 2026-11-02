/*
 * Tutorial Piutang — bagian 2/4: staff mengajukan, finance manager meninjau. MENYIMPAN data QC lewat UI.
 * Butuh: 2 draft kasbon milik "Staf Uji" (Rp 6.000.000 / 6 bln dan Rp 15.000.000 / 12 bln).
 * Staff mengajukan keduanya; FM mengisi dialog Setujui & Cairkan untuk yang pertama (dibatalkan) dan menolak yang kedua.
 * Playwright MCP browser_run_code_unsafe, filename: video/capture/receivables-review.js
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8016';
  const OUT = 'D:/Laravel/finance-management/video/receivables/screens/';
  const FIX = 'D:/Laravel/finance-management/video/capture/fixtures/';
  const browser = page.context().browser();
  const shots = {};
  const log = [];
  const contexts = [];

  const open = async (email) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
    contexts.push(ctx);
    // Putus HMR Vite: edit file oleh orang lain tidak lagi memuat ulang halaman di tengah capture.
    await ctx.routeWebSocket(/./, () => {});
    await ctx.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = 'button[aria-label="Kirim Feedback"]{display:none!important}';
        document.head.appendChild(s);
      });
    });
    const p = await ctx.newPage();
    await p.goto(BASE + '/login');
    await p.locator('input[type=email]').fill(email);
    await p.locator('input[type=password]').fill('password');
    await p.getByRole('button', { name: 'Masuk ke Dasbor' }).click();
    await p.waitForURL(/dashboard/);
    return p;
  };
  const settle = async (p) => {
    await p.waitForLoadState('networkidle');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    await p.mouse.move(0, 719);
    await p.waitForTimeout(250);
  };
  const box = async (loc) => {
    const b = await loc.first().boundingBox().catch(() => null);
    return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
  };
  const snap = async (p, name, targets = {}) => {
    await settle(p);
    await p.screenshot({ path: OUT + name + '.png' });
    const boxes = {};
    for (const [k, loc] of Object.entries(targets)) {
      boxes[k] = await box(loc);
      if (!boxes[k]) log.push(`${name}.${k} not found`);
    }
    shots[name] = boxes;
  };
  const top = (p) => p.getByRole('dialog').last();
  const parentOf = (loc) => loc.locator('xpath=..');
  /** Pilih opsi Combobox; buka ulang bila popover sempat tertutup (mis. setelah snap). */
  const pick = async (p, btn, name) => {
    const opt = p.getByRole('option', { name });
    if (!(await opt.first().isVisible().catch(() => false))) await btn.click();
    await opt.first().click();
  };

  try {
    const s = await open('staff@qc.test');
    const top_s = () => top(s);
    await s.goto(BASE + '/receivables');
    const draftRow = s.getByRole('row', { name: /Staf Uji.*6\.000\.000/ });
    await draftRow.first().waitFor();
    await s.waitForTimeout(800);
    await snap(s, 'staff-list-draft', {
      row: draftRow,
      status: draftRow.getByText('Draft', { exact: true }),
      submit: draftRow.getByTitle('Ajukan'),
      actions: draftRow.locator('td').nth(8),
    });
    await draftRow.getByTitle('Ajukan').click();
    const conf = top_s();
    await conf.getByText('Ajukan Piutang?').waitFor();
    await snap(s, 'staff-submit-confirm', {
      dialog: conf,
      confirm: conf.getByRole('button', { name: 'Hapus' }),
    });
    await conf.getByRole('button', { name: 'Hapus' }).click();
    await draftRow.getByText('Menunggu', { exact: true }).waitFor();
    await s.waitForTimeout(800);
    await snap(s, 'staff-list-pending', {
      row: draftRow,
      status: draftRow.getByText('Menunggu', { exact: true }),
    });

    const row2 = s.getByRole('row', { name: /Staf Uji.*15\.000\.000/ });
    await row2.getByTitle('Ajukan').click();
    await top(s).getByText('Ajukan Piutang?').waitFor();
    await top(s).getByRole('button', { name: 'Hapus' }).click();
    await row2.getByText('Menunggu', { exact: true }).waitFor();

    /* ── Finance manager: tinjau ── */
    const m = await open('fm@qc.test');
    await m.goto(BASE + '/receivables?status=pending_approval');
    const mRow = m.getByRole('row', { name: /Staf Uji.*6\.000\.000/ });
    await mRow.first().waitFor();
    await snap(m, 'fm-list-pending', {
      filter: m.getByRole('button', { name: /Menunggu Persetujuan/ }),
      stats: parentOf(parentOf(parentOf(parentOf(m.getByText('Total Piutang', { exact: true }))))),
      row: mRow,
      process: mRow.getByTitle('Proses Persetujuan'),
    });
    await mRow.locator('td').nth(2).click();
    await top(m).getByRole('button', { name: 'Proses' }).waitFor();
    await snap(m, 'fm-detail-pending', {
      dialog: top(m),
      process: top(m).getByRole('button', { name: 'Proses' }),
    });
    await top(m).getByRole('button', { name: 'Proses' }).click();
    const d = () => top(m);
    await d().getByText('Rekening Pencairan *').waitFor();
    const approve = () => ({
      dialog: d(),
      summary: parentOf(parentOf(d().getByText('Peminjam', { exact: true }))),
      choice: parentOf(d().getByRole('button', { name: /Setujui/ }).first()),
      bank: parentOf(d().getByText('Rekening Pencairan *', { exact: true })),
      notes: d().locator('textarea'),
      confirm: d().getByRole('button', { name: /Setujui & Cairkan/ }),
    });
    await snap(m, 'fm-approve-empty', approve());
    await pick(m, d().getByRole('button', { name: 'Pilih rekening...' }), /BCA - Operasional/);
    await d().locator('textarea').fill('Disetujui, potong gaji mulai November');
    await snap(m, 'fm-approve-filled', approve());
    await d().getByRole('button', { name: 'Batal' }).click();
    await m.waitForTimeout(400);

    const r2 = m.getByRole('row', { name: /Staf Uji.*15\.000\.000/ });
    await r2.getByTitle('Proses Persetujuan').click();
    await d().getByText('Rekening Pencairan *').waitFor();
    await d().getByRole('button', { name: /Tolak/ }).first().click();
    await d().locator('textarea').fill('Nominal melebihi batas kasbon karyawan. Ajukan maksimal Rp 9.000.000.');
    await snap(m, 'fm-reject', {
      dialog: d(),
      choice: parentOf(d().getByRole('button', { name: /Tolak/ }).first()),
      notes: d().locator('textarea'),
      confirm: d().getByRole('button', { name: 'Tolak', exact: true }),
    });
    await d().getByRole('button', { name: 'Tolak', exact: true }).click();
    await m.waitForTimeout(1500);

    return JSON.stringify({ log, shots });
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
}
