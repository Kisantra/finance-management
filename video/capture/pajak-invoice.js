/*
 * Ambil ulang screenshot panduan PPN & PPh 23 (video/pajak-invoice/screens/*.webp) bila UI berubah.
 * 1. DB QC terisolasi: `php artisan migrate:fresh --seed` (perusahaan demo Kisantra, klien PT. Global Solusi Prima),
 *    nama pengguna manager@gmail.com = "Fina Manager", staff@gmail.com = "Staf Uji". Profil Kisantra awalnya
 *    BUKAN PKP dan tanpa PPh 23 (bawaan seeder): skrip ini menyalakannya lewat halaman Profil perusahaan.
 * 2. Server: php artisan serve --host=127.0.0.1 --port=8031.
 * 3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/pajak-invoice.js (ubah ROOT bila perlu).
 * 4. python video/capture/to-webp.py pajak-invoice, lalu salin koordinat hasilnya ke video/pajak-invoice/shots.ts.
 * Skrip ini MENGUBAH profil Kisantra (PKP + PPN 11% + PPh 23 2%) dan MENERBITKAN 1 invoice Rp 10.000.000 di DB QC.
 * Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8031';
  const COMPANY = 'kisantra';
  const ROOT = '/Users/alexjanuar/orca/workspaces/finance-management/nusa-lintas-armada/';
  const OUT = ROOT + 'video/pajak-invoice/screens/';
  const CLIENT = 'PT. Global Solusi Prima';
  const url = (path) => `${BASE}/c/${COMPANY}${path}`;
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
        s.textContent = 'button[aria-label="Kirim Masukan"],[data-sonner-toaster]{display:none!important}';
        document.head.appendChild(s);
      });
    });
    const p = await ctx.newPage();
    await p.goto(BASE + '/login');
    await p.locator('input[type=email]').fill(email);
    await p.locator('input[type=password]').fill('password');
    await p.getByRole('button', { name: 'Masuk', exact: true }).click();
    await p.waitForURL(/dashboard/);
    await p.waitForLoadState('networkidle');
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
  const reveal = async (loc, block = 'center') => {
    await loc.first().evaluate((el, b) => el.scrollIntoView({ block: b, behavior: 'instant' }), block);
    await loc.page().waitForTimeout(400);
  };
  const top = (p) => p.getByRole('dialog').filter({ hasNot: p.locator('[cmdk-root]') }).last();
  const drawer = (p) => p.getByRole('dialog').first();
  const up = (loc, n = 1) => loc.locator('xpath=' + Array(n).fill('..').join('/'));
  const typeMoney = async (p, loc, text) => {
    await loc.click();
    await p.keyboard.press('ControlOrMeta+A');
    await p.keyboard.type(text);
  };

  let id = null;
  try {
    /* ── Admin: PKP & PPh 23 di Profil perusahaan ── */
    const a = await open('admin@gmail.com');
    await a.goto(url('/settings/company'));
    const heading = a.getByRole('heading', { name: 'Status PKP & Pajak', exact: true });
    await heading.waitFor();
    const pkp = a.getByText('Perusahaan adalah').first();
    const pph = a.getByText('Klien memotong').first();
    const taxTargets = () => ({
      heading,
      pkp: up(pkp, 1),
      npwp: a.getByLabel('NPWP'),
      ppnRate: a.getByLabel(/Tarif PPN/),
      pph: up(pph, 1),
      pphRate: a.getByLabel(/Tarif PPh 23 bawaan/),
    });
    await reveal(heading, 'start');
    await a.evaluate(() => document.querySelector('main').scrollBy(0, -24));
    await snap(a, 'admin-tax-off', taxTargets());
    await up(pkp, 1).click();
    await a.getByLabel('NPWP').fill('01.234.567.8-901.000');
    await up(pph, 1).click();
    await a.getByLabel(/Tarif PPh 23 bawaan/).fill('2');
    await reveal(heading, 'start');
    await a.evaluate(() => document.querySelector('main').scrollBy(0, -24));
    await snap(a, 'admin-tax-on', taxTargets());
    const save = a.getByRole('button', { name: 'Simpan Perubahan' });
    await save.click();
    await a.waitForLoadState('networkidle');
    await a.waitForTimeout(800);

    /* ── Staff: invoice ber-PPN & dipotong PPh 23 ── */
    const s = await open('staff@gmail.com');
    await s.goto(url('/invoices/create'));
    await s.getByRole('button', { name: 'Klien', exact: true }).click();
    await s.getByRole('option', { name: CLIENT }).click();
    const items = s.getByRole('region', { name: /^Item/ });
    await s.getByLabel('Layanan baris 1', { exact: true }).fill('Jasa konsultasi pajak November 2026');
    await s.keyboard.press('Escape');
    await typeMoney(s, s.locator('#price-0'), '10000000');
    await s.keyboard.press('Tab');
    const totals = s.getByRole('region', { name: 'Penyesuaian dan total' });
    const totalTargets = () => ({
      totals,
      ppn: up(totals.getByRole('switch', { name: /Tagih PPN/ }), 1),
      ppnSwitch: totals.getByRole('switch', { name: /Tagih PPN/ }),
      faktur: totals.getByRole('textbox', { name: 'Nomor faktur pajak' }),
      pph: up(totals.getByRole('switch', { name: /PPh 23/ }), 1),
      pphSwitch: totals.getByRole('switch', { name: /PPh 23/ }),
      pphRate: totals.getByRole('textbox', { name: 'Tarif PPh 23' }),
      summary: up(totals.getByText('Total', { exact: true }), 2),
      total: up(totals.getByText('Total', { exact: true }), 1),
    });
    await reveal(totals, 'end');
    await snap(s, 'staff-tax', totalTargets());
    await totals.getByRole('textbox', { name: 'Nomor faktur pajak' }).fill('010.000-26.00000123');
    await s.keyboard.press('Tab');
    await reveal(totals, 'end');
    await snap(s, 'staff-faktur', totalTargets());
    await totals.getByRole('switch', { name: /PPh 23/ }).click();
    await s.waitForTimeout(300);
    await reveal(totals, 'end');
    await snap(s, 'staff-pph-off', totalTargets());
    await totals.getByRole('switch', { name: /PPh 23/ }).click();
    await s.waitForTimeout(300);

    await reveal(s.getByRole('heading', { level: 1 }), 'start');
    await s.getByRole('button', { name: 'Simpan & terbitkan' }).click();
    await top(s).getByRole('button', { name: /Terbitkan/ }).last().waitFor();
    await top(s).getByRole('button', { name: /Terbitkan/ }).last().click();
    await s.waitForURL(/#invoice\/\d+/);
    id = Number(s.url().match(/#invoice\/(\d+)/)[1]);
    await s.goto(url(`/invoices?open=${id}#invoice/${id}`));
    await drawer(s).getByRole('heading', { name: 'Riwayat' }).waitFor();
    await s.waitForTimeout(500);
    await snap(s, 'staff-drawer', {
      metrics: up(up(drawer(s).getByText('Sisa tagihan', { exact: true }).first())),
      items: drawer(s).locator('table').first(),
      totals: up(drawer(s).getByText('Total', { exact: true }).last(), 2),
    });

    await s.goto(url('/invoices'));
    await s.locator('table').first().waitFor();
    await snap(s, 'staff-list', {
      summary: s.getByRole('region', { name: 'Ringkasan invoice' }),
      ppnCard: up(s.getByText('PPN', { exact: true }).first(), 1),
    });
  } catch (e) {
    log.push('ERROR ' + e.message.split('\n')[0]);
  }
  for (const c of contexts) await c.close();
  return { id, shots, log };
}
