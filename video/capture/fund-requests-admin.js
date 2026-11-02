/*
 * Screenshot Admin + dampak pencairan untuk tutorial Permintaan Dana (hanya membaca; dialog hapus dibatalkan).
 * Jalankan SETELAH fund-requests.js (butuh "Konsumsi & ATK pelatihan pajak klien" yang sudah Disbursed).
 * Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8015
 * Playwright MCP: browser_run_code_unsafe, filename: video/capture/fund-requests-admin.js, lalu python video/capture/to-webp.py fund-requests
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8015';
  const OUT = 'D:/Laravel/finance-management/video/fund-requests/screens/';
  const TITLE = 'Konsumsi & ATK pelatihan pajak klien';
  const browser = page.context().browser();
  const contexts = [];
  const shots = {};
  const log = [];

  const open = async (email, collapsed = false) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
    contexts.push(ctx);
    // Tabel Permintaan Dana lebih lebar dari layar 1280 bila navigasi terbuka: ciutkan untuk FM/Admin agar kolom Aksi terlihat.
    await ctx.addInitScript((c) => {
      try { localStorage.setItem('sidebar.collapsed', String(c)); } catch {}
    }, collapsed);
    await ctx.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = 'button[aria-label="Kirim Feedback"],[data-sonner-toaster]{display:none!important}';
        document.head.appendChild(s);
      });
    });
    const p = await ctx.newPage();
    await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await p.locator('input[type=email]').fill(email);
    await p.locator('input[type=password]').fill('password');
    await p.getByRole('button', { name: 'Masuk ke Dasbor' }).click();
    await p.waitForURL(/dashboard/, { timeout: 15000 }).catch(async () => {
      await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
      await p.locator('input[type=email]').fill(email);
      await p.locator('input[type=password]').fill('password');
      await p.getByRole('button', { name: 'Masuk ke Dasbor' }).click();
      await p.waitForURL(/dashboard/);
    });
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
  const top = (p) => p.getByRole('dialog').last();
  const up = (loc) => loc.locator('xpath=..');
  const row = (p, title) => p.getByRole('row', { name: new RegExp(title.replace(/[&]/g, '.')) });

  try {
    /* ── Admin ── */
    const a = await open('admin@gmail.com', true);
    await a.goto(BASE + '/fund-requests');
    await row(a, TITLE).first().waitFor();
    await snap(a, 'admin-list', {
      tabs: a.getByRole('button', { name: 'Semua Pengajuan' }).locator('xpath=..'),
      row: row(a, TITLE),
      remove: row(a, TITLE).getByRole('button').last(),
    });
    await row(a, TITLE).getByRole('button').last().click();
    await top(a).getByRole('button', { name: 'Hapus' }).waitFor();
    await snap(a, 'admin-delete', { dialog: top(a), confirm: top(a).getByRole('button', { name: 'Hapus' }) });
    await top(a).getByRole('button', { name: 'Batal' }).click();

    await a.goto(BASE + '/bank-accounts');
    await snap(a, 'admin-bank', {
      account: a.getByRole('button', { name: /BCA - Ope/ }),
      expense: a.getByText('Pengeluaran', { exact: true }).nth(1).locator('xpath=../..'),
    });
    await a.goto(BASE + '/cash-flow/expenses');
    const exp = a.getByRole('row', { name: /Pencairan Dana: Konsumsi/ });
    await exp.first().waitFor();
    await snap(a, 'admin-expenses', {
      row1: exp.nth(0),
      row2: exp.nth(1),
      total: a.getByText('Total pengeluaran', { exact: false }).locator('xpath=..'),
    });
    await a.goto(BASE + '/reports/profit-loss');
    const opex = a.getByText('Beban Operasional', { exact: true }).last();
    await opex.waitFor();
    await opex.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await a.mouse.wheel(0, -110);
    await snap(a, 'admin-pl', {
      heading: opex,
      makan: a.getByText('MAKAN MINUM', { exact: true }).first(),
      ops: a.getByText('OPERASIONAL', { exact: true }).first(),
    });
  } catch (e) {
    log.push('ERROR ' + e.message.split('\n')[0]);
    for (const [i, ctx] of contexts.entries()) for (const pg of ctx.pages()) await pg.screenshot({ path: OUT + `../debug-${i}.png` }).catch(() => {});
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
  return JSON.stringify({ log, shots });
}
