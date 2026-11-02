/*
 * Ambil ulang screenshot tutorial Pinjaman (video/loans/screens/*.webp, lewat to-webp.py) bila UI berubah.
 * 1. Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8016
 * 2. Butuh data contoh: pinjaman "PT Bank Mandiri (Persero) Tbk" (aktif, 2 angsuran) & "KSP Mitra Usaha Mandiri" (lunas).
 * 3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/loans.js → form diisi tapi TIDAK disimpan.
 * 4. Data hasil simpan (pinjaman PT BPR Dana Makmur + angsuran ke-3 Mandiri) lalu dibuat, kemudian jalankan loans-after.js.
 *    Catatan: per Okt 2026 Simpan Pinjaman / Simpan Pembayaran gagal 500 (lookup kategori `code`), lihat docs/module/loans.md.
 * 5. python video/capture/to-webp.py loans, lalu salin koordinat ke video/loans/shots.ts.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8016';
  const OUT = 'D:/Laravel/finance-management/video/loans/screens/';
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
    const m = await open('fm@qc.test');
    await m.goto(BASE + '/loans');
    const mandiriRow = m.getByRole('row', { name: /PT Bank Mandiri/ });
    await mandiriRow.waitFor();
    await snap(m, 'fm-list', {
      create: m.getByRole('button', { name: 'Tambah Pinjaman' }),
      stats: parentOf(parentOf(parentOf(m.getByText('Total Pinjaman', { exact: true })))),
      table: m.locator('table'),
      row: mandiriRow,
      remaining: mandiriRow.locator('td').nth(7),
      actions: mandiriRow.locator('td').nth(9),
    });

    await m.getByRole('button', { name: 'Tambah Pinjaman' }).first().click();
    const f = () => top(m);
    await f().getByLabel('Pemberi Pinjaman *').waitFor();
    const fields = () => ({
      sheet: f(),
      number: f().getByLabel('Nomor Pinjaman *'),
      lender: f().getByLabel('Pemberi Pinjaman *'),
      amount: f().getByLabel('Jumlah Pokok *'),
      interestType: parentOf(f().getByRole('button', { name: 'Persentase (% p.a.)' })),
      rate: f().getByLabel('Suku Bunga (% p.a.)'),
      tenor: f().getByLabel('Tenor (bulan) *'),
      start: parentOf(f().getByText('Tanggal Mulai *', { exact: true })),
      maturity: parentOf(f().getByText('Jatuh Tempo *', { exact: true })),
      save: f().getByRole('button', { name: 'Simpan Pinjaman' }),
    });
    const nextNumber = await f().getByLabel('Nomor Pinjaman *').inputValue();
    await snap(m, 'fm-form-empty', fields());

    await f().getByLabel('Pemberi Pinjaman *').click();
    await m.keyboard.type('PT BPR Dana Makmur');
    await snap(m, 'fm-form-lender', fields());

    await f().getByLabel('Jumlah Pokok *').click();
    await m.keyboard.type('50000000');
    await snap(m, 'fm-form-amount', fields());

    await f().getByLabel('Suku Bunga (% p.a.)').click();
    await m.keyboard.type('12');
    await snap(m, 'fm-form-rate', fields());

    await f().getByLabel('Tenor (bulan) *').click();
    await m.keyboard.type('12');
    await snap(m, 'fm-form-tenor', fields());

    const bankBtn = f().getByRole('button', { name: 'Pilih rekening...' });
    await bankBtn.scrollIntoViewIfNeeded();
    await f().getByText('Rekening Penerima', { exact: true }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await bankBtn.click();
    const bcaOpt = m.getByRole('option', { name: /BCA - Operasional/ });
    await bcaOpt.waitFor();
    await snap(m, 'fm-form-bank', {
      sheet: f(),
      section: parentOf(f().getByText('Rekening Penerima', { exact: true })),
      bank: bankBtn,
      option: bcaOpt,
      list: m.getByRole('listbox'),
    });
    await pick(m, bankBtn, /BCA - Operasional/);

    await f().getByLabel('Tujuan Pinjaman').fill('Modal kerja proyek digitalisasi arsip PT Sinar Jaya');
    await f().locator('input[type=file]').setInputFiles(FIX + 'kontrak-pinjaman-bpr.pdf');
    await f().getByLabel('Tujuan Pinjaman').evaluate((el) => el.closest('[class*=overflow]')?.scrollTo({ top: 99999 }));
    await snap(m, 'fm-form-filled', {
      sheet: f(),
      bank: f().getByRole('button', { name: /BCA - Operasional/ }),
      purpose: f().getByLabel('Tujuan Pinjaman'),
      upload: parentOf(f().locator('input[type=file]')),
      cancel: f().getByRole('button', { name: 'Batal' }),
      save: f().getByRole('button', { name: 'Simpan Pinjaman' }),
    });
    await f().getByRole('button', { name: 'Batal' }).click();
    await m.waitForTimeout(500);

    /* Detail & bayar angsuran Mandiri (tidak disimpan). */
    await mandiriRow.locator('td').nth(1).click();
    await top(m).getByText('Progres Pembayaran Pokok').waitFor();
    await snap(m, 'fm-detail', {
      dialog: top(m),
      progress: parentOf(top(m).getByText('Progres Pembayaran Pokok')).locator('xpath=..'),
      pay: top(m).getByRole('button', { name: 'Catat Pembayaran' }),
    });
    await top(m).getByRole('button', { name: 'Catat Pembayaran' }).click();
    await m.getByRole('dialog').getByText('Sisa Pokok').waitFor();
    const d = () => top(m);
    const payFields = () => ({
      dialog: d(),
      summary: parentOf(parentOf(d().getByText('Sisa Pokok', { exact: true }))),
      bank: parentOf(d().getByText('Rekening Pembayaran *', { exact: true })),
      date: parentOf(d().getByText('Tanggal Pembayaran *', { exact: true })),
      principal: d().getByLabel(/Pembayaran Pokok/),
      interest: d().getByLabel(/Pembayaran Bunga/),
      reference: d().getByLabel('Nomor Referensi'),
      notes: d().getByLabel('Catatan'),
      save: d().getByRole('button', { name: 'Simpan Pembayaran' }),
    });
    await snap(m, 'fm-pay-empty', payFields());
    await pick(m, d().getByRole('button', { name: 'Pilih rekening...' }), /BCA - Operasional/);
    await d().getByLabel(/Pembayaran Pokok/).click();
    await m.keyboard.type('10000000');
    await snap(m, 'fm-pay-principal', payFields());
    await d().getByLabel(/Pembayaran Bunga/).click();
    await m.keyboard.type('1000000');
    await d().getByLabel('Nomor Referensi').fill('KMK-261012');
    await d().getByLabel('Catatan').fill('Angsuran ke-3');
    await snap(m, 'fm-pay-filled', payFields());
    await d().evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await snap(m, 'fm-pay-save', payFields());

    return JSON.stringify({ nextNumber, log, shots });
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
}
