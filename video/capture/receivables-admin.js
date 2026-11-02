/*
 * Tutorial Piutang — bagian 4/4 (video Admin): jejak pencairan & cicilan di Rekening Bank dan Arus Kas. Hanya membaca.
 * Butuh: RCV-00003 (kasbon Staf Uji) sudah dicairkan dari BCA - Operasional + 1 cicilan potong gaji,
 * dan cicilan transfer CV. Karya Bersama (ref TRF-KB-1012) ke BCA - Operasional.
 * Playwright MCP browser_run_code_unsafe, filename: video/capture/receivables-admin.js, lalu python video/capture/to-webp.py receivables
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
    const a = await open('admin@gmail.com');
    await a.goto(BASE + '/receivables');
    const row = a.getByRole('row', { name: /RCV-00003/ });
    await row.waitFor();
    await snap(a, 'admin-list', {
      table: a.locator('table'),
      row,
      rejected: a.getByRole('row', { name: /RCV-00004/ }),
    });
    await row.locator('td').nth(2).click();
    await top(a).getByText('Progres Pembayaran').waitFor();
    await snap(a, 'admin-detail-after', {
      dialog: top(a),
      progress: parentOf(top(a).getByText('Progres Pembayaran')).locator('xpath=..'),
    });

    /* Rekening Bank: pencairan & cicilan transfer di BCA - Operasional. */
    await a.goto(BASE + '/bank-accounts');
    await a.getByRole('button', { name: /BCA - Ope/ }).first().click();
    const search = a.getByPlaceholder('Cari deskripsi atau referensi...');
    await search.waitFor();
    await search.fill('piutang');
    await a.getByText(/Piutang diberikan: RCV-00003/).first().waitFor();
    await search.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await a.mouse.wheel(0, -70);
    const rowOf = (t) => a.getByRole('row', { name: t });
    await snap(a, 'admin-bank', {
      account: a.getByRole('button', { name: /BCA - Ope/ }),
      search,
      disburse: rowOf(/Piutang diberikan: RCV-00003/),
      principal: rowOf(/Pembayaran piutang pokok: RCV-00001/).first(),
      interest: rowOf(/Pembayaran bunga piutang: RCV-00001/).first(),
    });

    /* Arus Kas › Pemasukan: hanya bunga (kategori pendapatan) yang tampil. */
    await a.goto(BASE + '/cash-flow/income?search=' + encodeURIComponent('piutang'));
    const inc = a.getByRole('row', { name: /bunga piutang: RCV-00001/ });
    await inc.first().waitFor();
    await snap(a, 'admin-income', {
      row: inc.first(),
      table: a.locator('table').first(),
    });

    return JSON.stringify({ log, shots });
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
}
