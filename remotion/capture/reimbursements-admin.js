/*
 * Screenshot "dampak pembayaran" untuk video admin (hanya membaca, tidak mengubah data).
 * Jalankan SETELAH reimbursements.js (butuh pengajuan "Taksi ke kantor PT Sinar Jaya" yang sudah lunas).
 * Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8001
 * Playwright MCP: browser_run_code_unsafe, filename: remotion/capture/reimbursements-admin.js, lalu python remotion/capture/to-webp.py
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8001';
  const OUT = 'D:/Laravel/finance-management/remotion/reimbursements/screens/';
  const TITLE = /Reimbursement: Taksi ke kantor PT Sinar Jaya/;
  const browser = page.context().browser();
  const shots = {};
  const log = [];

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = 'button[aria-label="Kirim Feedback"]{display:none!important}';
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
  const snap = async (name, targets) => {
    await settle();
    await p.screenshot({ path: OUT + name + '.png' });
    const boxes = {};
    for (const [k, loc] of Object.entries(targets)) {
      boxes[k] = await box(loc);
      if (!boxes[k]) log.push(`${name}.${k} not found`);
    }
    shots[name] = boxes;
  };

  /* Rekening bank: saldo & total pengeluaran rekening sumber. */
  await p.goto(BASE + '/bank-accounts');
  await snap('admin-bank', {
    account: p.getByRole('button', { name: /BCA - Ope/ }),
    expense: p.getByText('Pengeluaran', { exact: true }).nth(1).locator('xpath=../..'),
    total: p.getByText('Ringkasan total', { exact: false }).locator('xpath=..'),
  });

  /* Arus kas › Pengeluaran. */
  await p.goto(BASE + '/cash-flow/expenses');
  const row = p.getByRole('row', { name: TITLE });
  await row.first().waitFor();
  await snap('admin-expenses', {
    row,
    description: row.getByText(TITLE),
    category: row.getByText('OPERASIONAL', { exact: true }),
    amount: row.getByText(/Rp\s?185\.000/),
    total: p.getByText('Total pengeluaran', { exact: false }).locator('xpath=..'),
  });

  /* Laba rugi: baris kategori di Beban Operasional. */
  await p.goto(BASE + '/reports/profit-loss');
  const opex = p.getByText('Beban Operasional', { exact: true }).last();
  await opex.waitFor();
  await opex.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await p.mouse.wheel(0, -60);
  await snap('admin-pl', {
    heading: opex,
    section: opex.locator('xpath=..'),
    line: p.getByText('OPERASIONAL', { exact: true }).first(),
  });

  await ctx.close();
  return JSON.stringify({ log, shots });
}
