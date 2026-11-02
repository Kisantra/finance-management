/*
 * Ambil ulang screenshot tutorial Piutang (video/receivables/screens/*.webp) bila UI berubah — bagian 1/4: form staff.
 * 1. Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8016
 * 2. Butuh data contoh: piutang CV. Karya Bersama (aktif, 1 cicilan transfer) & kasbon Fina Manager (lunas, potong gaji).
 * 3. Playwright MCP browser_run_code_unsafe, filename: video/capture/receivables.js — form diisi lalu Batal (tidak disimpan).
 *    Per Okt 2026 Simpan Draft & Setujui & Cairkan gagal 500 (lihat docs/module/receivables.md › Panduan & video tutorial),
 *    jadi draft & persetujuan dibuat terpisah di DB QC, lalu lanjut ke receivables-review.js → receivables-after.js
 *    → receivables-admin.js.
 * 4. python video/capture/to-webp.py receivables, lalu salin koordinat ke video/receivables/shots.ts.
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
    /* ── Staff: buat kasbon & ajukan ── */
    const s = await open('staff@qc.test');
    await s.goto(BASE + '/receivables');
    await s.getByRole('row', { name: /CV. Karya Bersama/ }).waitFor();
    await snap(s, 'staff-list', {
      create: s.getByRole('button', { name: 'Tambah Piutang' }),
      stats: parentOf(parentOf(parentOf(parentOf(s.getByText('Total Piutang', { exact: true }))))),
      table: s.locator('table'),
    });

    await s.getByRole('button', { name: 'Tambah Piutang' }).first().click();
    const f = () => top(s);
    await f().getByLabel('Jumlah Pokok *').waitFor();
    const fields = () => ({
      sheet: f(),
      type: parentOf(f().getByRole('button', { name: 'Pinjaman Karyawan' })),
      debtor: f().getByRole('button', { name: /Pilih karyawan|Staf Uji/ }),
      amount: f().getByLabel('Jumlah Pokok *'),
      interestType: parentOf(f().getByRole('button', { name: 'Persentase (%)' })),
      rate: f().getByLabel('Suku Bunga (%)'),
      months: f().getByLabel('Jumlah Cicilan (bulan) *'),
      date: parentOf(f().getByText('Tanggal Pinjaman *', { exact: true })),
      save: f().getByRole('button', { name: 'Simpan Draft' }),
    });
    await snap(s, 'staff-form-empty', fields());
    const debtorBtn = f().getByRole('button', { name: 'Pilih karyawan...' });
    await debtorBtn.click();
    const me = s.getByRole('option', { name: 'Staf Uji' });
    await me.waitFor();
    await snap(s, 'staff-form-debtor', { ...fields(), option: me, list: s.getByRole('listbox') });
    await pick(s, debtorBtn, 'Staf Uji');
    await f().getByLabel('Jumlah Pokok *').click();
    await s.keyboard.type('6000000');
    await snap(s, 'staff-form-amount', fields());
    await f().getByLabel('Suku Bunga (%)').click();
    await s.keyboard.type('0');
    await f().getByLabel('Jumlah Cicilan (bulan) *').click();
    await s.keyboard.type('6');
    await snap(s, 'staff-form-months', fields());

    const lower = () => ({
      sheet: f(),
      disbursement: f().getByLabel('Rekening/Cara Pencairan *'),
      purpose: f().getByLabel('Tujuan *'),
      notes: f().getByLabel('Catatan'),
      upload: f().getByText('Dokumen Kontrak', { exact: true }),
      save: f().getByRole('button', { name: 'Simpan Draft' }),
    });
    await f().getByLabel('Rekening/Cara Pencairan *').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await f().getByLabel('Rekening/Cara Pencairan *').click();
    await s.keyboard.type('BCA 0123456789 a.n. Staf Uji');
    await snap(s, 'staff-form-disbursement', lower());
    await f().getByLabel('Tujuan *').fill('Biaya rawat inap orang tua di RS Hermina');
    await f().getByLabel('Catatan').fill('Mohon dicicil lewat potong gaji mulai November.');
    await snap(s, 'staff-form-filled', lower());
    await f().getByRole('button', { name: 'Batal' }).click();

    return JSON.stringify({ log, shots });
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
}
