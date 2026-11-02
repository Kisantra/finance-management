/*
 * Screenshot SETELAH data tersimpan (lanjutan video/capture/loans.js): daftar & detail sesudah simpan,
 * jejak di Rekening Bank & Arus Kas, dan konfirmasi hapus (dibatalkan). Hanya membaca, tidak mengubah data.
 * Butuh: pinjaman "PT BPR Dana Makmur" (Rp 50.000.000 ke BCA - Operasional) + angsuran ke-3 Mandiri (ref KMK-261012).
 * Playwright MCP: browser_run_code_unsafe, filename: video/capture/loans-after.js, lalu python video/capture/to-webp.py loans
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
    const bpr = m.getByRole('row', { name: /PT BPR Dana Makmur/ });
    await bpr.waitFor();
    const mandiri = m.getByRole('row', { name: /PT Bank Mandiri/ });
    await snap(m, 'fm-list-after', {
      stats: parentOf(parentOf(parentOf(parentOf(m.getByText('Total Pinjaman', { exact: true }))))),
      row: bpr,
      mandiri,
      mandiriRemaining: mandiri.locator('td').nth(7),
    });
    await mandiri.locator('td').nth(1).click();
    await top(m).getByText('Progres Pembayaran Pokok').waitFor();
    await snap(m, 'fm-detail-after', {
      dialog: top(m),
      progress: parentOf(top(m).getByText('Progres Pembayaran Pokok')).locator('xpath=..'),
    });

    const a = await open('admin@gmail.com');
    await a.goto(BASE + '/loans');
    const abpr = a.getByRole('row', { name: /PT BPR Dana Makmur/ });
    await abpr.waitFor();
    await snap(a, 'admin-list', {
      row: abpr,
      actions: abpr.locator('td').nth(9),
      paidRow: a.getByRole('row', { name: /KSP Mitra Usaha/ }),
    });
    await abpr.getByTitle('Hapus').click();
    await a.getByRole('alertdialog').or(a.getByRole('dialog')).last().getByText('Hapus Pinjaman?').waitFor();
    const conf = a.getByRole('alertdialog').or(a.getByRole('dialog')).last();
    await snap(a, 'admin-delete', { dialog: conf });
    await conf.getByRole('button', { name: 'Batal' }).click();

    /* Rekening Bank: mutasi otomatis di BCA - Operasional. */
    await a.goto(BASE + '/bank-accounts');
    await a.getByRole('button', { name: /BCA - Ope/ }).first().click();
    const search = a.getByPlaceholder('Cari deskripsi atau referensi...');
    await search.waitFor();
    await search.fill('pinjaman');
    await a.getByText('Penerimaan pinjaman dari PT BPR Dana Makmur').first().waitFor();
    await search.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await a.mouse.wheel(0, -70);
    const rowOf = (t) => a.getByRole('row', { name: t });
    await snap(a, 'admin-bank', {
      account: a.getByRole('button', { name: /BCA - Ope/ }),
      search,
      credit: rowOf(/Penerimaan pinjaman dari PT BPR/),
      principal: rowOf(/Pembayaran pokok pinjaman - PT Bank Mandiri/),
      interest: rowOf(/Pembayaran bunga pinjaman - PT Bank Mandiri/),
    });

    /* Arus Kas › Pengeluaran: hanya bunga (kategori beban) yang tampil. */
    await a.goto(BASE + '/cash-flow/expenses?search=' + encodeURIComponent('pinjaman'));
    const exp = a.getByRole('row', { name: /bunga pinjaman - PT Bank Mandiri/ });
    await exp.first().waitFor();
    await snap(a, 'admin-expenses', {
      row: exp,
      table: a.locator('table').first(),
    });

    return JSON.stringify({ log, shots });
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
}
