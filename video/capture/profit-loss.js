/*
 * Ambil ulang screenshot tutorial Laba Rugi (video/profit-loss/screens/*.webp, lewat to-webp.py) bila UI berubah.
 * 1. Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8014
 * 2. Jalankan SETELAH video/capture/cash-flow.js: butuh pemasukan "Sewa ruang rapat lantai 3 ..." berkategori
 *    "Sewa Ruang Rapat" yang grup L/R-nya masih kosong (muncul di panel Perlu Diklasifikasi).
 * 3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/profit-loss.js
 * 4. python video/capture/to-webp.py profit-loss, lalu salin koordinat dari hasilnya ke video/profit-loss/shots.ts.
 * Skrip ini MENGUBAH grup L/R kategori "Sewa Ruang Rapat" (milik data contoh) menjadi Pendapatan Lain. Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8014';
  const OUT = 'D:/Laravel/finance-management/video/profit-loss/screens/';
  const browser = page.context().browser();
  const contexts = [];
  const shots = {};
  const log = [];

  const open = async (email) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
    contexts.push(ctx);
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
    await p.waitForLoadState('networkidle');
    return p;
  };
  const settle = async (p) => {
    await p.waitForLoadState('networkidle');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    await p.mouse.move(0, 719);
    await p.waitForTimeout(300);
  };
  const box = async (loc) => {
    const b = await loc.first().boundingBox({ timeout: 3000 }).catch(() => null);
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
  const up = (loc, n = 1) => loc.locator('xpath=' + Array(n).fill('..').join('/'));
  const doc = (p) => p.locator('article').first();
  const line = (p, text) => up(doc(p).getByText(text, { exact: true }).first());
  const scrollTo = async (p, loc, offset = -90) => {
    await loc.first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await p.mouse.wheel(0, offset);
    await p.waitForTimeout(400);
  };
  const header = (p) => ({
    pdf: p.getByRole('button', { name: 'Unduh PDF' }),
    presets: up(p.getByRole('button', { name: 'Bulan ini' })),
    range: up(p.getByRole('button', { name: 'Terapkan' })),
    doc: doc(p),
    period: doc(p).getByText(/^Periode/),
    panelHead: up(p.getByText(/^Perlu Diklasifikasi/).first(), 2),
  });

  try {
    // Bagian yang sudah berhasil bisa dilewati saat mengulang: 'fm' (mengubah grup L/R!), 'admin'.
    const SKIP = [];
    if (!SKIP.includes('fm')) {
    /* ── Finance manager: membaca laporan + mengklasifikasi ── */
    const m = await open('fm@qc.test');
    await m.goto(BASE + '/reports/profit-loss');
    await doc(m).getByText('Laba Bersih', { exact: true }).waitFor();
    const card = () => up(m.getByText('Sewa Ruang Rapat', { exact: true }).last(), 3);
    await snap(m, 'fm-pl-top', {
      ...header(m),
      revenueSection: up(doc(m).getByText('Pendapatan dari Invoice (kas)', { exact: true }), 2),
      invoiceRevenue: line(m, 'Pendapatan dari Invoice (kas)'),
      totalRevenue: line(m, 'Total Pendapatan'),
      cogsInvoice: line(m, 'HPP Invoice (cost-recovery)'),
      card: card(),
    });

    await scrollTo(m, doc(m).getByText('Laba Kotor', { exact: true }));
    await snap(m, 'fm-pl-doc-bottom', {
      grossProfit: line(m, 'Laba Kotor'),
      opexTitle: doc(m).getByText('Beban Operasional', { exact: true }),
      opexTotal: line(m, 'Total Beban Operasional'),
      operatingProfit: line(m, 'Laba Usaha'),
      preTax: line(m, 'Laba Sebelum Pajak'),
      net: line(m, 'Laba Bersih'),
      footer: doc(m).locator('footer'),
    });

    await m.evaluate(() => window.scrollTo(0, 0));
    await card().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await m.waitForTimeout(400);
    await snap(m, 'fm-pl-panel', {
      panelHead: up(m.getByText(/^Perlu Diklasifikasi/).first(), 2),
      card: card(),
      select: card().getByRole('button'),
    });
    await card().getByRole('button').click();
    await m.getByRole('option', { name: 'Pendapatan Lain' }).waitFor();
    await snap(m, 'fm-pl-classify-open', {
      card: card(),
      select: card().getByRole('button'),
      option: m.getByRole('option', { name: 'Pendapatan Lain' }),
      list: m.getByRole('listbox'),
    });
    await m.getByRole('option', { name: 'Pendapatan Lain' }).click();
    await doc(m).getByText('Pendapatan & Beban Lain', { exact: true }).waitFor();
    await m.waitForTimeout(600);
    await scrollTo(m, doc(m).getByText('Laba Usaha', { exact: true }), -60);
    await snap(m, 'fm-pl-classified', {
      section: up(doc(m).getByText('Pendapatan & Beban Lain', { exact: true }), 1),
      meetingRoom: line(m, 'Sewa Ruang Rapat'),
      operatingProfit: line(m, 'Laba Usaha'),
      net: line(m, 'Laba Bersih'),
      panelHead: up(m.getByText(/^Perlu Diklasifikasi/).first(), 2),
    });

    await m.evaluate(() => window.scrollTo(0, 0));
    await m.getByRole('button', { name: 'Bulan ini' }).click();
    await m.waitForURL(/start_date=/);
    await doc(m).getByText('Laba Bersih', { exact: true }).waitFor();
    await snap(m, 'fm-pl-month', header(m));
    }

    /* ── Admin: dari mana angka-angkanya (hanya membaca) ── */
    const a = await open('admin@gmail.com');
    if (!SKIP.includes('admin')) {
    await a.goto(BASE + '/reports/profit-loss');
    await doc(a).getByText('Laba Bersih', { exact: true }).waitFor();
    await snap(a, 'admin-pl-top', {
      ...header(a),
      invoiceRevenue: line(a, 'Pendapatan dari Invoice (kas)'),
      cogsInvoice: line(a, 'HPP Invoice (cost-recovery)'),
      totalRevenue: line(a, 'Total Pendapatan'),
    });

    await a.goto(BASE + '/cash-flow/income');
    await a.locator('table').first().waitFor();
    await snap(a, 'admin-income', {
      invoiceRow: a.locator('tbody tr').filter({ hasText: 'Invoice' }).first(),
      directRow: a.locator('tbody tr').filter({ hasText: 'Langsung' }).first(),
      sourceCol: a.locator('thead th').nth(2),
    });

    }
    await a.goto(BASE + '/transaction-categories');
    await a.getByText('Grup L/R', { exact: true }).first().waitFor();
    const opexRow = a.locator('tbody tr').filter({ hasText: 'Beban Operasional' }).first();
    await snap(a, 'admin-categories', {
      groupCol: a.getByText('Grup L/R', { exact: true }).first(),
      opexRow,
      opexGroup: opexRow.getByText('Beban Operasional', { exact: true }),
      unclassified: up(a.getByText(/^Belum diklasifikasi$/i).first(), 3),
    });
  } catch (e) {
    log.push('ERROR ' + String(e).slice(0, 600));
  } finally {
    for (const ctx of contexts) await ctx.close().catch(() => {});
  }
  return JSON.stringify({ log, shots });
}
