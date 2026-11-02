/*
 * Ambil ulang screenshot tutorial Invoice (video/invoices/screens/*.webp) bila UI berubah.
 * 1. Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8011
 * 2. Playwright MCP: browser_run_code_unsafe, filename: video/capture/invoices.js
 * Toast disembunyikan agar tidak menutupi tombol aksi.
 * 3. python video/capture/invoices-pdf.py  (PDF unduhan → gambar untuk pratinjau cetak)
 * 4. Playwright MCP: filename video/capture/invoices-admin.js
 * 5. python video/capture/to-webp.py invoices, lalu salin koordinat ke video/invoices/shots.ts.
 * Skrip ini membuat 1 invoice baru di DB QC (staff → draft, finance manager → terbit + bayar 50%). Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8011';
  const OUT = 'D:/Laravel/finance-management/video/invoices/screens/';
  const PDF = 'D:/Laravel/finance-management/out/invoices/invoice.pdf';
  const CLIENT = 'PT. Global Solusi Prima';
  const browser = page.context().browser();
  const contexts = [];
  const shots = {};
  const log = [];

  const open = async (email) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID', acceptDownloads: true });
    contexts.push(ctx);
    // Server Vite dev dipakai bersama: putus HMR agar edit file lain tidak memuat ulang halaman di tengah capture.
    await ctx.routeWebSocket(/:5173/, () => {});
    await ctx.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = 'button[aria-label="Kirim Feedback"],[data-sonner-toaster]{display:none!important}';
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
    await p.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => log.push('networkidle timeout'));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 6000 }).catch(() => log.push('animation timeout'));
    await p.mouse.move(0, 719);
    await p.waitForTimeout(300);
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
  const drawer = (p) => p.getByRole('dialog').first();
  const parentOf = (loc) => loc.locator('xpath=..');
  const openDrawer = async (p, id, extra = '') => {
    await p.goto(`${BASE}/invoices?open=${id}${extra}#invoice/${id}`);
    await drawer(p).getByRole('heading', { name: 'Riwayat' }).waitFor();
  };
  const typeMoney = async (p, loc, digits) => {
    await loc.click();
    await p.keyboard.press('Control+A');
    await p.keyboard.type(digits);
  };

  /* ── Staff: menyusun invoice & simpan draft ── */
  const s = await open('staff@qc.test');
  await s.goto(BASE + '/invoices/create');
  const editor = () => ({
    back: s.getByRole('link', { name: 'Kembali' }),
    number: s.getByText('nomor diberikan saat terbit'),
    client: s.getByRole('button', { name: 'Klien', exact: true }),
    issueDate: s.getByRole('button', { name: 'Tanggal invoice' }),
    dueDate: s.getByRole('button', { name: /^Jatuh tempo/ }),
    multi: s.getByText('Tagih ke beberapa klien'),
    detail: s.getByRole('region', { name: 'Detail invoice' }),
    items: s.getByRole('region', { name: /^Item/ }),
    row1: s.getByRole('listitem').filter({ has: s.getByLabel('Layanan baris 1', { exact: true }) }),
    row2: s.getByRole('listitem').filter({ has: s.getByLabel('Layanan baris 2', { exact: true }) }),
    name1: s.getByLabel('Layanan baris 1', { exact: true }),
    catalog1: s.getByRole('button', { name: 'Pilih layanan baris 1 dari katalog' }),
    qty1: s.getByLabel('Qty baris 1'),
    price1: s.locator('#price-0'),
    unit1: s.getByLabel('Satuan baris 1'),
    cogs1: s.locator('#cogs-0'),
    name2: s.getByLabel('Layanan baris 2', { exact: true }),
    price2: s.locator('#price-1'),
    cogs2: s.locator('#cogs-1'),
    tax1: s.getByText('Titipan pajak').first(),
    addRow: s.getByRole('button', { name: /Tambah baris/ }),
    preview: s.getByRole('button', { name: 'Pratinjau', exact: true }),
    draft: s.getByRole('button', { name: 'Simpan draft' }),
    publish: s.getByRole('button', { name: /Simpan & terbitkan/ }),
  });
  await snap(s, 'staff-create-empty', editor());

  await s.getByRole('button', { name: 'Klien', exact: true }).click();
  const clientOpt = s.getByRole('option', { name: CLIENT });
  await clientOpt.waitFor();
  await snap(s, 'staff-create-client', { ...editor(), option: clientOpt, list: s.getByRole('listbox') });
  await clientOpt.click();

  await s.getByRole('button', { name: 'Pilih layanan baris 1 dari katalog' }).click();
  const svc = s.getByRole('button', { name: /^Website company profile/ });
  await svc.waitFor();
  await snap(s, 'staff-create-catalog', { ...editor(), option: svc, popover: parentOf(parentOf(svc)) });
  await svc.click();
  await s.getByLabel('Satuan baris 1').fill('paket');
  await typeMoney(s, s.locator('#cogs-0'), '1500000');
  await snap(s, 'staff-create-item1', editor());

  await s.getByRole('button', { name: /Tambah baris/ }).click();
  await s.getByLabel('Layanan baris 2', { exact: true }).fill('Domain & hosting 1 tahun');
  await s.getByLabel('Qty baris 2').fill('1');
  await typeMoney(s, s.locator('#price-1'), '900000');
  await s.getByLabel('Satuan baris 2').fill('tahun');
  await typeMoney(s, s.locator('#cogs-1'), '600000');
  await snap(s, 'staff-create-item2', editor());

  const totals = s.getByRole('region', { name: 'Penyesuaian dan total' });
  await totals.evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await s.mouse.wheel(0, 40);
  await snap(s, 'staff-create-totals', {
    totals,
    discount: s.getByRole('button', { name: /Tambah diskon/ }),
    total: totals.getByText('Total', { exact: true }),
    profit: totals.getByText(/Laba kotor/),
    items: s.getByRole('region', { name: /^Item/ }),
  });
  await s.evaluate(() => window.scrollTo(0, 0));

  await s.getByRole('button', { name: 'Simpan draft' }).click();
  await s.waitForURL(/#invoice\/\d+/);
  const id = Number(s.url().match(/#invoice\/(\d+)/)[1]);
  await drawer(s).getByRole('heading', { name: 'Riwayat' }).waitFor();
  const drawerTargets = (p) => ({
    drawer: drawer(p),
    number: drawer(p).getByText(/belum bernomor|\/INV\//).first(),
    status: drawer(p).locator('.rounded-full', { hasText: /^(Draft|Terkirim|Sebagian|Lunas)$/ }).first(),
    metrics: parentOf(parentOf(drawer(p).getByText('Sisa tagihan', { exact: true }).first())),
    items: drawer(p).locator('table').first(),
    history: parentOf(drawer(p).getByRole('heading', { name: 'Riwayat' })),
    payments: parentOf(drawer(p).getByRole('heading', { name: /^Pembayaran/ })),
    send: drawer(p).getByRole('button', { name: 'Kirim invoice' }),
    pay: drawer(p).getByRole('button', { name: 'Catat pembayaran' }),
    print: drawer(p).getByRole('button', { name: 'Cetak' }),
    more: drawer(p).getByRole('button', { name: 'Aksi lain' }),
    tabs: drawer(p).getByRole('radiogroup', { name: 'Tampilan detail' }),
  });
  await snap(s, 'staff-drawer-draft', drawerTargets(s));

  /* ── Finance manager: terbitkan & catat pembayaran ── */
  const m = await open('fm@qc.test');
  await m.goto(BASE + '/invoices?status=draft');
  await snap(m, 'fm-list-draft', {
    statusFilter: m.getByRole('group', { name: 'Filter status' }),
    row: m.getByRole('row', { name: new RegExp(CLIENT.replace('.', '\\.')) }).first(),
    summary: m.getByRole('region', { name: 'Ringkasan invoice' }),
  });

  await openDrawer(m, id);
  await snap(m, 'fm-drawer-draft', drawerTargets(m));

  await drawer(m).getByRole('button', { name: 'Kirim invoice' }).click();
  await top(m).getByLabel('Nomor invoice').waitFor();
  await snap(m, 'fm-send', {
    dialog: top(m),
    number: top(m).getByLabel('Nomor invoice'),
    hint: top(m).getByText(/Nomor berikutnya sesuai format/),
    confirm: top(m).getByRole('button', { name: 'Kirim invoice' }),
    sub: top(m).getByText(/Klien tidak menerima email otomatis/),
  });
  const number = await top(m).getByLabel('Nomor invoice').inputValue();
  await top(m).getByRole('button', { name: 'Kirim invoice' }).click();
  await drawer(m).getByRole('button', { name: 'Catat pembayaran' }).waitFor();
  await m.waitForTimeout(500);
  await snap(m, 'fm-drawer-sent', drawerTargets(m));

  await drawer(m).getByRole('button', { name: 'Aksi lain' }).click();
  await m.getByRole('menuitem', { name: /Kembalikan ke draft/ }).waitFor();
  await snap(m, 'fm-menu', {
    more: drawer(m).getByRole('button', { name: 'Aksi lain' }),
    menu: m.getByRole('menu'),
    edit: m.getByRole('menuitem', { name: /Edit invoice/ }),
    rollback: m.getByRole('menuitem', { name: /Kembalikan ke draft/ }),
    remove: m.getByRole('menuitem', { name: /Hapus invoice/ }),
  });
  await m.keyboard.press('Escape');

  // PDF asli (jenis Penuh) untuk pratinjau cetak di invoices-admin.js.
  await drawer(m).getByRole('button', { name: 'Cetak' }).click();
  await top(m).getByRole('button', { name: 'Unduh PDF' }).waitFor();
  const [download] = await Promise.all([m.waitForEvent('download'), top(m).getByRole('button', { name: 'Unduh PDF' }).click()]);
  await download.saveAs(PDF);
  await m.keyboard.press('Escape');
  await m.waitForTimeout(400);

  await drawer(m).getByRole('button', { name: 'Catat pembayaran' }).click();
  await top(m).getByRole('button', { name: 'Rekening tujuan' }).waitFor();
  const pay = () => ({
    dialog: top(m),
    amount: parentOf(top(m).getByText('Jumlah', { exact: true })),
    chips: parentOf(top(m).getByRole('button', { name: 'Sisa penuh' })),
    date: top(m).getByRole('button', { name: 'Tanggal' }),
    account: top(m).getByRole('button', { name: 'Rekening tujuan' }),
    method: top(m).getByRole('radiogroup', { name: 'Metode' }),
    reference: top(m).getByLabel('Nomor referensi'),
    upload: top(m).getByText(/Bukti transfer/),
    confirm: top(m).getByRole('button', { name: 'Simpan pembayaran' }),
  });
  await snap(m, 'fm-pay-empty', pay());
  await top(m).getByRole('button', { name: '50%' }).click();
  await top(m).getByRole('button', { name: 'Rekening tujuan' }).click();
  await m.getByRole('option', { name: /BCA - Operasional/ }).click();
  await top(m).getByLabel('Nomor referensi').fill('TRF-GSP-1012');
  await snap(m, 'fm-pay-filled', pay());
  await top(m).getByRole('button', { name: 'Simpan pembayaran' }).click();
  await drawer(m).getByText('Sebagian').first().waitFor();
  await m.waitForTimeout(600);
  await snap(m, 'fm-drawer-partial', drawerTargets(m));

  await m.goto(BASE + '/invoices?status=overdue');
  await snap(m, 'fm-overdue', {
    overdue: m.getByRole('button', { name: /Perlu ditagih/ }).last(),
    overdueStat: m.getByRole('button', { name: /Perlu ditagih/ }).first(),
    list: m.getByRole('region', { name: 'Daftar invoice' }),
    firstRow: m.getByRole('region', { name: 'Daftar invoice' }).locator('tbody tr').first(),
  });

  await m.goto(BASE + '/invoices');
  await m.getByRole('button', { name: 'Ekspor' }).click();
  await m.getByRole('menuitem', { name: /Rekap Excel/ }).waitFor();
  await snap(m, 'fm-export', {
    export: m.getByRole('button', { name: 'Ekspor' }),
    menu: m.getByRole('menu'),
    filters: m.getByRole('region', { name: 'Daftar invoice' }).locator('form').locator('xpath=../..'),
  });

  /* ── Staff: daftar (diambil terakhir agar berisi invoice tadi) ── */
  await s.goto(BASE + '/invoices');
  await snap(s, 'staff-list', {
    create: s.getByRole('link', { name: /Buat Invoice/ }).first(),
    export: s.getByRole('button', { name: 'Ekspor' }),
    summary: s.getByRole('region', { name: 'Ringkasan invoice' }),
    list: s.getByRole('region', { name: 'Daftar invoice' }),
    statusFilter: s.getByRole('group', { name: 'Filter status' }),
    overdue: s.getByRole('button', { name: /Perlu ditagih/ }).last(),
    row: s.getByRole('row', { name: new RegExp(CLIENT.replace('.', '\\.')) }).first(),
    period: s.getByRole('button', { name: /Oktober 2026/ }),
  });

  for (const ctx of contexts) await ctx.close();
  return JSON.stringify({ id, number, log, shots });
}
