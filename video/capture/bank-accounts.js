/*
 * Ambil ulang screenshot tutorial Rekening Bank (video/bank-accounts/screens/*.webp) bila UI berubah.
 * 1. Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8013
 * 2. Playwright MCP: browser_run_code_unsafe, filename: video/capture/bank-accounts.js
 * 3. python video/capture/to-webp.py bank-accounts, lalu salin koordinat hasilnya ke video/bank-accounts/shots.ts.
 * Jalankan SEBELUM video/capture/transaction-categories.js (kategori "Langganan Software" & "Biaya Langganan (lama)" dibuat di sini).
 * Membuat di DB QC: 2 rekening (BRI - Proyek Klien, Jago - Kas Kecil), 2 kategori pengeluaran, 2 pengeluaran,
 * 1 pemasukan, 1 transfer. Bila rekening BRI sudah ada, langkah pembuatan data dilewati (hanya screenshot).
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8013';
  const OUT = 'D:/Laravel/finance-management/video/bank-accounts/screens/';
  const FIX = 'D:/Laravel/finance-management/video/capture/fixtures/';
  const browser = page.context().browser();
  const shots = {};
  const log = [];
  const contexts = [];

  const open = async (email) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
    contexts.push(ctx);
    // Vite HMR milik dev server bersama bisa memuat ulang halaman di tengah pengisian form: putuskan websocket-nya.
    await ctx.routeWebSocket(/.*/, () => {});
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
    await p.waitForTimeout(300);
  };
  const box = async (loc) => {
    const b = await loc.first().boundingBox().catch(() => null);
    return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
  };
  const snap = async (p, name, targets = {}, keepMouse = false) => {
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
  const top = (p) => p.getByRole('dialog').last();
  const parentOf = (loc) => loc.locator('xpath=..');
  const pick = async (p, trigger, option) => {
    await trigger.click();
    const opt = p.getByRole('option', { name: option }).first();
    await opt.waitFor();
    await opt.click();
  };
  const typeMoney = async (p, input, digits) => {
    await input.click();
    await p.keyboard.press('Control+A');
    await p.keyboard.type(digits);
  };
  const accountBtn = (p, name) => p.getByRole('button', { name: new RegExp(name) }).first();
  /** Gulir daftar rekening di sidebar agar rekening `name` terlihat (daftar punya scroll sendiri). */
  const reveal = (p, name) => accountBtn(p, name).evaluate((el) => {
    const c = el.parentElement;
    c.scrollTop += el.getBoundingClientRect().top - c.getBoundingClientRect().top - 8;
  });
  const noToast = (p) => p.locator('[data-sonner-toast]').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

  try {
  const m = await open('fm@qc.test');
  await m.goto(BASE + '/bank-accounts?account=1');
  const header = () => ({
    create: m.getByRole('button', { name: 'Tambah Rekening' }).first(),
    tutorial: m.getByRole('button', { name: 'Tutorial' }),
    sidebar: parentOf(parentOf(m.getByRole('heading', { name: 'Rekening', exact: true }))),
    accountList: m.getByRole('heading', { name: 'Rekening', exact: true }).locator('xpath=../..'),
    total: parentOf(m.getByRole('heading', { name: 'Ringkasan Total' })),
    actions: parentOf(m.getByRole('button', { name: 'Pengeluaran', exact: true })),
    expense: m.getByRole('button', { name: 'Pengeluaran', exact: true }),
    income: m.getByRole('button', { name: 'Pemasukan', exact: true }),
    transfer: m.getByRole('button', { name: 'Transfer', exact: true }),
    month: m.getByRole('button', { name: /Semua bulan|Okt/ }).first(),
    stats: parentOf(m.getByText('Arus Bersih').last().locator('xpath=../../..')),
    chart: parentOf(parentOf(m.getByRole('heading', { name: 'Pemasukan vs Pengeluaran' }))),
    breakdown: parentOf(parentOf(m.getByRole('heading', { name: 'Breakdown Kategori' }))),
  });
  await snap(m, 'fm-overview', header());

  /* ── Tambah rekening (bertahap untuk efek ketik) ── */
  const exists = (await m.getByRole('button', { name: /BRI - Proyek Klien/ }).count()) > 0;
  await m.getByRole('button', { name: 'Tambah Rekening' }).first().click();
  const acc = () => ({
    dialog: top(m),
    name: top(m).getByPlaceholder('Mis. PT Kisantra Solidaritas'),
    number: top(m).getByPlaceholder('1234567890'),
    bank: top(m).getByPlaceholder('BCA, Mandiri, BNI...'),
    branch: top(m).getByPlaceholder('Cabang Sudirman'),
    initial: top(m).getByLabel('Saldo Awal *'),
    submit: top(m).getByRole('button', { name: 'Tambah Rekening' }),
    cancel: top(m).getByRole('button', { name: 'Batal' }),
  });
  await top(m).getByPlaceholder('1234567890').waitFor();
  await snap(m, 'fm-account-empty', acc());
  await top(m).getByPlaceholder('Mis. PT Kisantra Solidaritas').fill('BRI - Proyek Klien');
  await snap(m, 'fm-account-name', acc());
  await top(m).getByPlaceholder('1234567890').fill('082101005566308');
  await top(m).getByPlaceholder('BCA, Mandiri, BNI...').fill('Bank Rakyat Indonesia');
  await snap(m, 'fm-account-bank', acc());
  await top(m).getByPlaceholder('Cabang Sudirman').fill('KCP Kuningan');
  await typeMoney(m, top(m).getByLabel('Saldo Awal *'), '25000000');
  await snap(m, 'fm-account-filled', acc());

  if (!exists) {
    await top(m).getByRole('button', { name: 'Tambah Rekening' }).click();
    await m.getByRole('heading', { name: 'BRI - Proyek Klien' }).waitFor();
    await m.getByRole('button', { name: 'Tambah Rekening' }).first().click();
    await top(m).getByPlaceholder('Mis. PT Kisantra Solidaritas').fill('Jago - Kas Kecil');
    await top(m).getByPlaceholder('1234567890').fill('102938475610');
    await top(m).getByPlaceholder('BCA, Mandiri, BNI...').fill('Bank Jago');
    await typeMoney(m, top(m).getByLabel('Saldo Awal *'), '2000000');
    await top(m).getByRole('button', { name: 'Tambah Rekening' }).click();
    await m.getByRole('heading', { name: 'Jago - Kas Kecil' }).waitFor();
  } else {
    await top(m).getByRole('button', { name: 'Batal' }).click();
  }

  const accountsJson = await (await m.request.get(BASE + '/api/bank-accounts')).json();
  const idOf = (name) => accountsJson.find((o) => o.label.startsWith(name)).value;
  const briId = idOf('BRI - Proyek Klien');
  const jagoId = idOf('Jago - Kas Kecil');
  const has = async (search) => {
    const r = await m.request.get(`${BASE}/bank-accounts/transactions?account=${briId}&search=${encodeURIComponent(search)}`, { headers: { Accept: 'application/json' } });
    return ((await r.json()).data ?? []).length > 0;
  };
  const made = { expense: await has('Google Workspace'), zoom: await has('Zoom Pro'), income: await has('Sewa ruang rapat'), transfer: await has('kas kecil proyek') };

  await m.goto(`${BASE}/bank-accounts?account=${briId}`);
  await m.getByRole('heading', { name: 'BRI - Proyek Klien' }).waitFor();
  await reveal(m, 'BRI - Proyek Klien');
  await snap(m, 'fm-account-new', { ...header(), selected: accountBtn(m, 'BRI - Proyek Klien'), title: parentOf(parentOf(m.getByRole('heading', { name: 'BRI - Proyek Klien' }))) });

  /* ── Catat pengeluaran ── */
  await m.getByRole('button', { name: 'Pengeluaran', exact: true }).click();
  await top(m).getByText('Catat Pengeluaran').waitFor();
  const tx = () => ({
    dialog: top(m),
    account: top(m).getByLabel('Rekening *'),
    category: parentOf(parentOf(top(m).getByText('Kategori *', { exact: true }))),
    categoryTrigger: parentOf(top(m).getByText('Kategori *', { exact: true })).locator('xpath=following-sibling::*[1]//button').first(),
    quickAdd: top(m).getByRole('button', { name: 'Tambah', exact: true }),
    amount: top(m).getByLabel('Jumlah *'),
    date: top(m).getByLabel('Tanggal *'),
    description: top(m).getByLabel('Deskripsi *'),
    reference: top(m).getByLabel('Nomor Referensi'),
    upload: parentOf(top(m).locator('input[type=file]')),
    submit: top(m).getByRole('button', { name: /Simpan (Pengeluaran|Pemasukan)/ }),
    close: top(m).getByRole('button', { name: 'Tutup' }),
  });
  await snap(m, 'fm-expense-empty', tx());

  const catTrigger = () => parentOf(top(m).getByText('Kategori *', { exact: true })).locator('xpath=following-sibling::*[1]//button').first();
  const hasCat = async (label) => {
    await catTrigger().click();
    const n = await m.getByRole('option', { name: label }).count();
    await m.keyboard.press('Escape');
    return n > 0;
  };

  if (!(await hasCat('Langganan Software'))) {
    await top(m).getByRole('button', { name: 'Tambah', exact: true }).click();
    await top(m).getByText('Kelompok Kategori *').waitFor();
    await pick(m, top(m).getByLabel('Kelompok Kategori *'), 'Operational Expenses');
    await top(m).getByLabel('Nama Kategori *').fill('Langganan Software');
    await snap(m, 'fm-quick-category', {
      dialog: top(m),
      mode: parentOf(top(m).getByRole('button', { name: 'Sub Kategori' })),
      group: top(m).getByLabel('Kelompok Kategori *'),
      name: top(m).getByLabel('Nama Kategori *'),
      save: top(m).getByRole('button', { name: 'Tambah', exact: true }),
    });
    await top(m).getByRole('button', { name: 'Tambah', exact: true }).click();
    await top(m).getByText('Catat Pengeluaran').waitFor();
    await m.waitForTimeout(500);
  } else {
    log.push('Langganan Software sudah ada: fm-quick-category dilewati');
    await pick(m, catTrigger(), 'Langganan Software');
  }
  await snap(m, 'fm-expense-category', tx());

  await typeMoney(m, top(m).getByLabel('Jumlah *'), '1188000');
  await snap(m, 'fm-expense-amount', tx());
  await top(m).getByLabel('Deskripsi *').fill('Langganan Google Workspace Oktober 2026 (12 pengguna)');
  await top(m).getByLabel('Nomor Referensi').fill('GWS-2026-10');
  await top(m).locator('input[type=file]').setInputFiles(FIX + 'invoice-langganan-workspace.jpg');
  await snap(m, 'fm-expense-filled', tx());

  if (!made.expense) {
    await top(m).getByRole('button', { name: 'Simpan Pengeluaran' }).click();
    await m.getByText('Pengeluaran berhasil dicatat').first().waitFor();
    await m.waitForTimeout(600);
    await snap(m, 'fm-expense-saved', tx());
  }
  if (!made.zoom) {

    // Pengeluaran kedua dengan kategori lama (dipakai untuk demo "Pindahkan & Hapus" di modul kategori).
    await top(m).getByRole('button', { name: 'Tambah', exact: true }).click();
    await top(m).getByText('Kelompok Kategori *').waitFor();
    await pick(m, top(m).getByLabel('Kelompok Kategori *'), 'Operational Expenses');
    await top(m).getByLabel('Nama Kategori *').fill('Biaya Langganan (lama)');
    await top(m).getByRole('button', { name: 'Tambah', exact: true }).click();
    await top(m).getByText('Catat Pengeluaran').waitFor();
    await m.waitForTimeout(500);
    await typeMoney(m, top(m).getByLabel('Jumlah *'), '2250000');
    await top(m).getByLabel('Deskripsi *').fill('Perpanjangan Zoom Pro tahunan');
    await top(m).getByRole('button', { name: 'Simpan Pengeluaran' }).click();
    await m.getByText('Pengeluaran berhasil dicatat').first().waitFor();
    await m.waitForTimeout(400);
  }
  await top(m).getByRole('button', { name: 'Tutup' }).click();
  await m.waitForTimeout(500);

  /* ── Catat pemasukan ── */
  await m.getByRole('button', { name: 'Pemasukan', exact: true }).click();
  await top(m).getByText('Catat Pemasukan').waitFor();
  await pick(m, catTrigger(), 'Sewa Ruang Rapat');
  await typeMoney(m, top(m).getByLabel('Jumlah *'), '750000');
  await top(m).getByLabel('Deskripsi *').fill('Sewa ruang rapat oleh PT Arunika Media, 2 hari');
  await top(m).getByLabel('Nomor Referensi').fill('INV-SR-0912');
  await snap(m, 'fm-income-filled', tx());
  if (!made.income) {
    await top(m).getByRole('button', { name: 'Simpan Pemasukan' }).click();
    await m.getByText('Pemasukan berhasil dicatat').first().waitFor();
    await m.waitForTimeout(400);
  }
  await top(m).getByRole('button', { name: 'Tutup' }).click();
  await m.waitForTimeout(500);

  /* ── Transfer ── */
  await noToast(m);
  await m.getByRole('button', { name: 'Transfer', exact: true }).click();
  await top(m).getByText('Transfer Antar Rekening').waitFor();
  const tf = () => ({
    dialog: top(m),
    flow: parentOf(top(m).getByText('Dari', { exact: true }).locator('xpath=..')),
    from: top(m).getByLabel('Rekening Sumber *'),
    to: top(m).getByLabel('Rekening Tujuan *'),
    category: top(m).getByLabel('Kategori *'),
    date: top(m).getByLabel('Tanggal *'),
    amount: top(m).getByLabel('Jumlah Transfer *'),
    fee: top(m).getByLabel('Biaya Admin'),
    description: top(m).getByLabel('Deskripsi *'),
    upload: parentOf(top(m).locator('input[type=file]')),
    summary: parentOf(top(m).getByText('Total Debit', { exact: true }).locator('xpath=../..')),
    submit: top(m).getByRole('button', { name: 'Lakukan Transfer' }),
  });
  await snap(m, 'fm-transfer-empty', tf());
  await pick(m, top(m).getByLabel('Rekening Tujuan *'), /Jago - Kas Kecil/);
  await pick(m, top(m).getByLabel('Kategori *'), 'Pindah Dana Antar Rekening');
  await snap(m, 'fm-transfer-accounts', tf());
  await typeMoney(m, top(m).getByLabel('Jumlah Transfer *'), '1500000');
  await snap(m, 'fm-transfer-amount', tf());
  await top(m).getByLabel('Deskripsi *').fill('Isi kas kecil proyek Oktober');
  await snap(m, 'fm-transfer-filled', tf());
  await top(m).getByRole('button', { name: 'Lakukan Transfer' }).evaluate((el) => el.closest('form')?.scrollIntoView({ block: 'end' }));
  await top(m).getByText('Total Debit', { exact: true }).scrollIntoViewIfNeeded();
  await snap(m, 'fm-transfer-submit', tf());
  if (!made.transfer) {
    await top(m).getByRole('button', { name: 'Lakukan Transfer' }).click();
    await m.getByText('Transfer berhasil dicatat').first().waitFor();
  } else {
    await top(m).getByRole('button', { name: 'Batal' }).click();
  }

  /* ── Hasil di rekening ── */
  await m.goto(`${BASE}/bank-accounts?account=${briId}&open=1`);
  await m.getByRole('heading', { name: 'BRI - Proyek Klien' }).waitFor();
  await m.getByRole('row', { name: /Transfer \+ Admin Fee/ }).first().waitFor();
  await reveal(m, 'BRI - Proyek Klien');
  await snap(m, 'fm-account-after', { ...header(), selected: accountBtn(m, 'BRI - Proyek Klien') });

  const table = m.getByRole('table').first();
  await table.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await m.mouse.wheel(0, -120);
  await snap(m, 'fm-transactions', {
    tabs: parentOf(m.getByRole('button', { name: 'Pembayaran', exact: true })),
    filters: m.getByPlaceholder('Cari deskripsi atau referensi...').locator('xpath=ancestor::div[3]'),
    table,
    transferRow: m.getByRole('row', { name: /Transfer \+ Admin Fee/ }),
    expenseRow: m.getByRole('row', { name: /Google Workspace/ }),
    incomeRow: m.getByRole('row', { name: /Sewa ruang rapat/ }),
    deleteIcon: m.getByRole('row', { name: /Google Workspace/ }).getByTitle('Hapus'),
  });

  await table.evaluate((el) => { el.parentElement.scrollLeft = el.parentElement.scrollWidth; });
  await snap(m, 'fm-transactions-right', {
    table,
    expenseRow: m.getByRole('row', { name: /Google Workspace/ }),
    deleteIcon: m.getByRole('row', { name: /Google Workspace/ }).getByTitle('Hapus'),
    amountHead: m.getByRole('columnheader', { name: /Jumlah/ }),
  });
  await m.getByRole('row', { name: /Google Workspace/ }).getByTitle('Hapus').click();
  await top(m).getByText('Hapus transaksi?').waitFor();
  await snap(m, 'fm-tx-delete', { dialog: top(m), confirm: top(m).getByRole('button', { name: 'Hapus', exact: true }), cancel: top(m).getByRole('button', { name: 'Batal' }) });
  await top(m).getByRole('button', { name: 'Batal' }).click();

  /* ── Tab Pembayaran (rekening BCA, ada pembayaran invoice) ── */
  await m.goto(`${BASE}/bank-accounts?account=1`);
  await m.getByRole('button', { name: 'Pembayaran', exact: true }).click();
  await m.waitForLoadState('networkidle');
  const ptable = m.getByRole('table').first();
  await ptable.waitFor();
  await m.getByRole('button', { name: 'Pembayaran', exact: true }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await m.mouse.wheel(0, -90);
  await snap(m, 'fm-payments', { tabs: parentOf(m.getByRole('button', { name: 'Pembayaran', exact: true })), table: ptable });
  await m.getByRole('button', { name: 'Transaksi', exact: true }).click();

  /* ── Menu ••• (edit / export / hapus) di rekening BRI ── */
  await m.goto(`${BASE}/bank-accounts?account=${briId}&menu=1`);
  await m.getByRole('heading', { name: 'BRI - Proyek Klien' }).waitFor();
  await reveal(m, 'BRI - Proyek Klien');
  const more = parentOf(m.getByRole('button', { name: 'Transfer', exact: true })).locator('button').last();
  await more.click();
  await m.getByRole('menuitem', { name: 'Hapus Rekening' }).waitFor();
  await snap(m, 'fm-menu', {
    more,
    menu: m.getByRole('menu'),
    edit: m.getByRole('menuitem', { name: 'Edit Rekening' }),
    exportPdf: m.getByRole('menuitem', { name: 'Export PDF' }),
    remove: m.getByRole('menuitem', { name: 'Hapus Rekening' }),
  });
  await m.getByRole('menuitem', { name: 'Edit Rekening' }).click();
  await top(m).getByText('Edit Rekening Bank').waitFor();
  await top(m).getByLabel('Saldo Awal *').focus();
  await snap(m, 'fm-account-edit', { dialog: top(m), initial: top(m).getByLabel('Saldo Awal *'), hint: top(m).getByText('Mengubah saldo awal akan menggeser saldo total.'), submit: top(m).getByRole('button', { name: 'Simpan Perubahan' }) });
  await top(m).getByRole('button', { name: 'Batal' }).click();
  await m.waitForTimeout(400);
  await more.click();
  await m.getByRole('menuitem', { name: 'Hapus Rekening' }).click();
  await top(m).getByText('Hapus rekening?').waitFor();
  await snap(m, 'fm-account-delete', { dialog: top(m), confirm: top(m).getByRole('button', { name: 'Hapus', exact: true }), cancel: top(m).getByRole('button', { name: 'Batal' }) });
  await top(m).getByRole('button', { name: 'Batal' }).click();

  /* ── Admin: jejak di modul lain ── */
  const a = await open('admin@gmail.com');
  await a.goto(`${BASE}/bank-accounts?account=${briId}`);
  await a.getByRole('heading', { name: 'BRI - Proyek Klien' }).waitFor();
  await reveal(a, 'BRI - Proyek Klien');
  await snap(a, 'admin-account', {
    selected: accountBtn(a, 'BRI - Proyek Klien'),
    jago: accountBtn(a, 'Jago - Kas Kecil'),
    total: parentOf(a.getByRole('heading', { name: 'Ringkasan Total' })),
    stats: parentOf(a.getByText('Arus Bersih').last().locator('xpath=../../..')),
    breakdown: parentOf(parentOf(a.getByRole('heading', { name: 'Breakdown Kategori' }))),
  });

  await a.goto(BASE + '/cash-flow/expenses?search=Google%20Workspace');
  const erow = a.getByRole('row', { name: /Google Workspace/ }).first();
  await erow.waitFor();
  await snap(a, 'admin-expenses', { row: erow, category: erow.getByText('Langganan Software'), amount: erow.getByText(/1\.188\.000/) });

  await a.goto(BASE + '/cash-flow/income?search=Sewa%20ruang%20rapat');
  const irow = a.getByRole('row', { name: /PT Arunika Media/ }).first();
  await irow.waitFor();
  await snap(a, 'admin-income', { row: irow });

  await a.goto(BASE + '/cash-flow/transfers?search=kas%20kecil');
  const trow = a.getByRole('row', { name: /kas kecil proyek/i }).first();
  await noToast(a);
  await trow.waitFor();
  await snap(a, 'admin-transfers', { row: trow, fee: trow.getByText(/2\.500/) });

  await a.goto(BASE + '/reports/profit-loss');
  await a.getByText('Perlu Diklasifikasi').first().waitFor();
  await snap(a, 'admin-pl', {
    unclassified: parentOf(parentOf(a.getByText('Perlu Diklasifikasi').first())),
    software: a.getByText('Langganan Software').first(),
  });

  return JSON.stringify({ briId, jagoId, exists, made, log, shots });
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
}
