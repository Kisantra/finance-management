/*
 * Screenshot pratinjau cetak + "dampak pembayaran invoice" untuk video admin (hanya membaca, tidak mengubah data).
 * Jalankan SETELAH invoices.js dan `python video/capture/invoices-pdf.py` (butuh out/invoices/invoice.png).
 * Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8011
 * Playwright MCP: browser_run_code_unsafe, filename: video/capture/invoices-admin.js, lalu python video/capture/to-webp.py invoices
 * ID = invoice buatan invoices.js (lihat hasil `id` skrip itu).
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8011';
  const OUT = 'D:/Laravel/finance-management/video/invoices/screens/';
  const PDF_PNG = 'D:/Laravel/finance-management/out/invoices/invoice.png';
  const ID = 14;
  const NUMBER = '001/INV/KSN-GSP/X/2026';
  const browser = page.context().browser();
  const shots = {};
  const log = [];

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
  await ctx.routeWebSocket(/:5173/, () => {});
  // Penampil PDF Chromium headless kosong: tampilkan halaman 1 PDF asli (hasil unduhan) sebagai gambar.
  await ctx.route(/\/invoice\/\d+\/preview/, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#fff"><img src="/__capture/invoice.png" style="width:100%;display:block"></body></html>' }),
  );
  await ctx.route(/\/__capture\/invoice\.png/, (route) => route.fulfill({ path: PDF_PNG, contentType: 'image/png' }));
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = 'button[aria-label="Kirim Feedback"],[data-sonner-toaster]{display:none!important}';
      document.head.appendChild(s);
    });
  });
  const p = await ctx.newPage();
  await p.goto(BASE + '/login');
  await p.locator('input[type=email]').fill('admin@gmail.com');
  await p.locator('input[type=password]').fill('password');
  await p.getByRole('button', { name: 'Masuk ke Dasbor' }).click();
  await p.waitForURL(/dashboard/);

  const settle = async () => {
    await p.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => log.push('networkidle timeout'));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 6000 }).catch(() => log.push('animation timeout'));
    await p.mouse.move(0, 719);
    await p.waitForTimeout(400);
  };
  const box = async (loc) => {
    const b = await loc.first().boundingBox().catch(() => null);
    return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
  };
  const snap = async (name, targets = {}) => {
    await settle();
    await p.screenshot({ path: OUT + name + '.png' });
    const boxes = {};
    for (const [k, loc] of Object.entries(targets)) {
      boxes[k] = await box(loc);
      if (!boxes[k]) log.push(`${name}.${k} not found`);
    }
    shots[name] = boxes;
  };
  const top = () => p.getByRole('dialog').last();
  const drawer = () => p.getByRole('dialog').first();
  const parentOf = (loc) => loc.locator('xpath=..');
  const openDrawer = async (tag) => {
    await p.goto(`${BASE}/invoices?open=${tag}#invoice/${ID}`);
    await drawer().getByRole('heading', { name: 'Riwayat' }).waitFor();
  };

  /* Daftar invoice (admin). */
  await p.goto(BASE + '/invoices');
  await p.getByRole('region', { name: 'Daftar invoice' }).locator('tbody tr').first().waitFor();
  await snap('admin-list', {
    summary: p.getByRole('region', { name: 'Ringkasan invoice' }),
    paidStat: p.getByText('Sudah dibayar', { exact: true }).locator('xpath=..'),
    list: p.getByRole('region', { name: 'Daftar invoice' }),
  });

  /* Cetak: dialog + pratinjau PDF. */
  await openDrawer('print');
  await drawer().getByRole('button', { name: 'Cetak' }).click();
  await top().getByRole('button', { name: 'Unduh PDF' }).waitFor();
  await top().getByRole('radio', { name: 'Penuh', exact: true }).click();
  await p.waitForTimeout(1500);
  await snap('print-dialog', {
    dialog: top(),
    type: top().getByRole('radiogroup', { name: 'Jenis tagihan' }),
    typeBlock: parentOf(top().getByText('Jenis tagihan', { exact: true })),
    summary: top().getByText('Total invoice').locator('xpath=../..'),
    templates: top().getByRole('radiogroup', { name: 'Template' }),
    download: top().getByRole('button', { name: 'Unduh PDF' }),
    open: top().getByRole('button', { name: 'Buka PDF' }),
    preview: top().locator('iframe').last(),
  });
  await p.keyboard.press('Escape');

  /* Hapus invoice yang sudah dibayar → ditolak; hapus pembayaran → saldo turun. */
  await openDrawer('del');
  await drawer().getByRole('button', { name: 'Aksi lain' }).click();
  await p.getByRole('menuitem', { name: /Hapus invoice/ }).click();
  await top().getByText(/sudah punya pembayaran/).waitFor();
  await snap('admin-delete-blocked', {
    dialog: top(),
    text: top().getByText(/sudah punya pembayaran/),
  });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  await drawer().getByRole('button', { name: /^Hapus pembayaran/ }).click();
  await top().getByText(/saldo rekening ikut berkurang/).waitFor();
  await snap('admin-payment-delete', {
    dialog: top(),
    text: top().getByText(/saldo rekening ikut berkurang/),
  });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);

  /* Drawer setelah dibayar sebagian (tanpa toast) + tab Pratinjau cetak. */
  await openDrawer('paid');
  await snap('admin-drawer-partial', {
    metrics: parentOf(parentOf(drawer().getByText('Sisa tagihan', { exact: true }).first())),
    payments: parentOf(drawer().getByRole('heading', { name: /^Pembayaran/ })),
    history: parentOf(drawer().getByRole('heading', { name: 'Riwayat' })),
    profit: parentOf(drawer().getByText('Laba kotor', { exact: true })),
    editPay: drawer().getByRole('button', { name: /^Edit pembayaran/ }),
    delPay: drawer().getByRole('button', { name: /^Hapus pembayaran/ }),
    tabs: drawer().getByRole('radiogroup', { name: 'Tampilan detail' }),
  });

  /* Rekening bank: saldo BCA - Operasional. */
  await p.goto(BASE + '/bank-accounts');
  await snap('admin-bank', {
    account: p.getByRole('button', { name: /BCA - Ope/ }),
    income: p.getByText('Pemasukan', { exact: true }).first().locator('xpath=../..'),
  });

  /* Arus kas › Pemasukan. */
  await p.goto(BASE + '/cash-flow/income');
  const row = p.getByRole('row', { name: new RegExp(NUMBER.replace(/\//g, '\\/')) });
  await row.first().waitFor().catch(() => log.push('income row missing'));
  await snap('admin-income', {
    row,
    number: row.getByText(NUMBER),
    amount: row.getByText(/2\.700\.000/),
    total: p.getByText(/Total pemasukan/i).first().locator('xpath=..'),
  });

  /* Laba rugi bulan ini: pendapatan invoice (kas) & HPP cost-recovery. */
  await p.goto(BASE + '/reports/profit-loss');
  await p.getByRole('button', { name: 'Bulan ini', exact: true }).click();
  const apply = p.getByRole('button', { name: 'Terapkan' });
  if (await apply.isEnabled().catch(() => false)) await apply.click();
  await p.waitForTimeout(800);
  const revenue = p.getByText('Pendapatan dari Invoice (kas)');
  await revenue.waitFor();
  await revenue.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await snap('admin-pl', {
    period: p.getByText(/^Periode:/),
    revenue: revenue.locator('xpath=..'),
    cogs: p.getByText('HPP Invoice (cost-recovery)').locator('xpath=..'),
    gross: p.getByText(/^Laba Kotor/).first().locator('xpath=..'),
    unclassified: p.getByText(/Perlu Diklasifikasi/).first().locator('xpath=../../..'),
  });

  /* Ringkasan (dashboard). */
  await p.goto(BASE + '/dashboard');
  await snap('admin-dashboard', {
    income: p.getByText(/Pemasukan/).first().locator('xpath=../..'),
  });

  await ctx.close();
  return JSON.stringify({ log, shots });
}
