/*
 * Ambil ulang screenshot tutorial Ringkasan (video/dashboard/screens/*.webp, lewat to-webp.py) bila UI berubah.
 * 1. Jalankan server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8017
 * 2. Jalankan file ini lewat Playwright MCP (browser_run_code_unsafe, filename: video/capture/dashboard.js).
 * 3. python video/capture/to-webp.py dashboard, lalu salin koordinat dari hasilnya ke video/dashboard/shots.ts.
 * Hanya membaca data (tidak menyimpan apa pun). Angka di layar mengikuti isi DB QC saat diambil.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8017';
  const OUT = 'D:/Laravel/finance-management/video/dashboard/screens/';
  const browser = page.context().browser();
  const shots = {};
  const log = [];
  const contexts = [];

  const open = async (email) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
    contexts.push(ctx);
    // Server Vite dipakai bersama agent lain: putus HMR agar perubahan file lain tidak memuat ulang halaman di tengah capture.
    await ctx.routeWebSocket(/:5173/, () => {});
    ctx.setDefaultTimeout(60000);
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
    await p.waitForURL(/dashboard|cash-flow/);
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
    const b = await loc.first().boundingBox({ timeout: 1500 }).catch(() => null);
    return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
  };
  const snap = async (p, name, targets = {}, { keepMouse = false } = {}) => {
    if (keepMouse) {
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(400);
    } else {
      await settle(p);
    }
    await p.screenshot({ path: OUT + name + '.png' });
    const boxes = {};
    for (const [k, loc] of Object.entries(targets)) {
      boxes[k] = await box(loc);
      if (!boxes[k]) log.push(`${name}.${k} not found`);
    }
    shots[name] = boxes;
  };
  const scrollMain = async (p, top) => {
    await p.evaluate((t) => document.querySelector('main').scrollTo({ top: t, behavior: 'instant' }), top);
    await p.waitForTimeout(600);
  };
  const scrollTo = async (p, loc) => {
    await loc.first().evaluate((el) => el.scrollIntoView({ block: 'end', behavior: 'instant' }));
    await p.waitForTimeout(600);
  };

  const region = (p, name) => p.getByRole('region', { name, exact: false });
  const category = (p) => p.locator('section').filter({ has: p.getByRole('group', { name: 'Rincian per kategori' }) });
  const topTargets = (p) => ({
    header: p.getByRole('heading', { name: 'Ringkasan', level: 1 }).locator('xpath=../..'),
    tutorial: p.getByRole('button', { name: 'Tutorial' }),
    createInvoice: p.getByRole('link', { name: 'Buat Invoice' }),
    cashflow: region(p, 'Arus Kas').first(),
    balance: region(p, 'Arus Kas').first().getByText(/^Rp /).first(),
    balanceBlock: region(p, 'Arus Kas').first().getByText(/Total saldo/).locator('xpath=..'),
    month: region(p, 'Arus Kas').first().locator('dl'),
    periods: p.getByRole('group', { name: /Periode grafik/ }),
    account: region(p, 'Arus Kas').first().getByRole('button', { name: /rekening|·/ }).last(),
    chart: region(p, 'Arus Kas').first().locator('svg').last(),
    calendar: region(p, 'Periode Arus Kas'),
    calendarSummary: region(p, 'Periode Arus Kas').getByText(/Pilih tanggal awal|hari|klik/).first().locator('xpath=../..'),
    bell: p.getByRole('button', { name: 'Notifikasi' }),
  });
  const midTargets = (p) => ({
    category: category(p),
    categoryTabs: p.getByRole('group', { name: 'Rincian per kategori' }),
    donut: category(p).locator('svg').first(),
    biggest: category(p).getByText(/^Terbesar/),
    invoices: region(p, 'Invoice Belum Dibayar'),
    invoiceRow: region(p, 'Invoice Belum Dibayar').locator('li').first(),
    invoiceMore: region(p, 'Invoice Belum Dibayar').getByRole('link', { name: /Lihat semua/ }),
    expenseLink: category(p).getByRole('link', { name: /Lihat (pengeluaran|pemasukan)/ }),
  });
  const bottomTargets = (p) => ({
    accounts: region(p, 'Rekening'),
    accountRow: region(p, 'Rekening').locator('li').first(),
    accountsLink: region(p, 'Rekening').getByRole('link', { name: /Semua rekening/ }),
    recent: region(p, 'Transaksi Terbaru'),
    recentRow: region(p, 'Transaksi Terbaru').locator('li').first(),
    recentLink: region(p, 'Transaksi Terbaru').getByRole('link', { name: /Lihat arus kas/ }),
    allTime: region(p, 'Sepanjang waktu'),
    profitLoss: region(p, 'Sepanjang waktu').getByRole('link', { name: /Laporan Laba Rugi/ }),
  });
  const ready = async (p) => {
    await region(p, 'Arus Kas').first().locator('svg').last().waitFor();
  };

  try {
  /* ── Staff: membaca & mengatur grafik ── */
  const s = await open('staff@qc.test');
  await s.goto(BASE + '/dashboard');
  await ready(s);
  await snap(s, 'staff-top', topTargets(s));

  await s.getByRole('button', { name: 'Mingguan' }).click();
  await settle(s);
  await snap(s, 'staff-weekly', topTargets(s));
  await s.getByRole('button', { name: 'Bulanan' }).click();
  await s.waitForURL(/chart_period=monthly/);
  await settle(s);
  await s.waitForTimeout(1000);

  // Kalender rentang: klik awal, arahkan ke akhir (pratinjau), klik akhir.
  const cal = region(s, 'Periode Arus Kas');
  const day = (label) => cal.getByRole('button', { name: new RegExp(`${label}$`) });
  await day('Kamis, 1 Oktober 2026').click();
  await cal.getByText(/pilih tanggal akhir/).waitFor();
  await day('Senin, 12 Oktober 2026').hover();
  await snap(s, 'staff-range-first', { ...topTargets(s), first: day('Kamis, 1 Oktober 2026'), last: day('Senin, 12 Oktober 2026') }, { keepMouse: true });
  await day('Senin, 12 Oktober 2026').click();
  await s.getByRole('button', { name: 'Kembali ke Bulanan' }).waitFor();
  await snap(s, 'staff-range', { ...topTargets(s), back: s.getByRole('button', { name: 'Kembali ke Bulanan' }), badge: cal.getByText('Dipakai grafik') });
  await s.getByRole('button', { name: 'Kembali ke Bulanan' }).click();
  await settle(s);

  await region(s, 'Arus Kas').first().getByRole('button', { name: 'Semua rekening' }).click();
  await s.getByRole('option').nth(1).waitFor();
  await snap(s, 'staff-account-open', { ...topTargets(s), list: s.getByRole('listbox'), option: s.getByRole('option').nth(1) });
  const optName = (await s.getByRole('option').nth(1).textContent()).trim();
  await s.getByRole('option').nth(1).click();
  await settle(s);
  await snap(s, 'staff-account', { ...topTargets(s), note: region(s, 'Arus Kas').first().getByText(/grafik:/) });
  await region(s, 'Arus Kas').first().getByRole('button', { name: optName }).click();
  await s.getByRole('option', { name: 'Semua rekening' }).click();
  await settle(s);
  await region(s, 'Arus Kas').first().getByText(/grafik:/).waitFor({ state: 'detached' });

  await scrollTo(s, region(s, 'Invoice Belum Dibayar'));
  await snap(s, 'staff-mid', midTargets(s));
  await s.getByRole('group', { name: 'Rincian per kategori' }).getByRole('button', { name: 'Pemasukan' }).click();
  await scrollTo(s, region(s, 'Invoice Belum Dibayar'));
  await snap(s, 'staff-mid-income', midTargets(s));
  await s.getByRole('group', { name: 'Rincian per kategori' }).getByRole('button', { name: 'Pengeluaran' }).click();

  await scrollMain(s, 100000);
  await snap(s, 'staff-bottom', bottomTargets(s));

  await scrollTo(s, region(s, 'Invoice Belum Dibayar'));
  await region(s, 'Invoice Belum Dibayar').locator('li a').first().click();
  await s.getByRole('dialog').last().waitFor();
  await s.waitForTimeout(800);
  await snap(s, 'staff-invoice', { dialog: s.getByRole('dialog').last() });

  /* ── Finance manager: tautan lanjut ── */
  const m = await open('fm@qc.test');
  await m.goto(BASE + '/dashboard');
  await ready(m);
  await snap(m, 'fm-top', topTargets(m));
  await scrollTo(m, region(m, 'Invoice Belum Dibayar'));
  await snap(m, 'fm-mid', midTargets(m));
  await scrollMain(m, 100000);
  await snap(m, 'fm-bottom', bottomTargets(m));

  /* ── Admin: asal angka + izin ── */
  const a = await open('admin@gmail.com');
  await a.goto(BASE + '/dashboard');
  await ready(a);
  await snap(a, 'admin-top', topTargets(a));
  await scrollMain(a, 100000);
  await snap(a, 'admin-bottom', bottomTargets(a));

  await a.goto(BASE + '/bank-accounts');
  await a.waitForLoadState('networkidle');
  await a.waitForTimeout(800);
  await snap(a, 'admin-bank', {
    heading: a.getByRole('heading', { level: 1 }).first(),
    main: a.locator('main'),
  });

  await a.goto(BASE + '/admin/permissions');
  await a.getByText('staff', { exact: true }).first().click();
  await a.getByPlaceholder('Cari permission...').fill('dashboard');
  await a.waitForTimeout(500);
  await snap(a, 'admin-permissions', {
    role: a.getByText('staff', { exact: true }).first().locator('xpath=ancestor::*[self::button or self::div][1]'),
    permission: a.locator('label').filter({ hasText: 'view dashboard' }),
    search: a.getByPlaceholder('Cari permission...'),
  });

  // Yang dilihat Staff bila izin Ringkasan dicabut: dialihkan ke Pengeluaran yang juga tidak boleh ia buka.
  await s.goto(BASE + '/cash-flow/expenses');
  await s.waitForTimeout(800);
  await snap(s, 'staff-forbidden', { main: s.locator('body') });

  } finally {
    for (const ctx of contexts) await ctx.close();
  }
  return JSON.stringify({ log, shots });
}
