/*
 * Ambil ulang screenshot panduan Rincian item invoice (video/rincian-invoice/screens/*.webp) bila UI berubah.
 * 1. DB QC yang sama dengan video/capture/debit-note.js (PT BCB contoh, klien fiktif PT. CONTOH BINA SAMUDRA;
 *    template BCB mencetak Perihal, ATTENTION, dan keterangan item).
 * 2. Server: php artisan serve --host=127.0.0.1 --port=8031.
 * 3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/rincian-invoice.js (ubah ROOT bila perlu).
 * 4. python video/capture/to-webp.py rincian-invoice, lalu salin koordinat hasilnya ke video/rincian-invoice/shots.ts.
 * Skrip ini MENYIMPAN 1 draft invoice (paket speed boat pulang-pergi + bongkar muat berharga bersen) di DB QC.
 * Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8031';
  const COMPANY = 'bahtera-cipta-bersama';
  const ROOT = '/Users/alexjanuar/orca/workspaces/finance-management/nusa-lintas-armada/';
  const OUT = ROOT + 'video/rincian-invoice/screens/';
  const CLIENT = 'PT. CONTOH BINA SAMUDRA';
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
  /** Gulir <main> ke posisi tetap (px) agar layar sebelum/sesudah mengetik berimpit untuk efek "diketik". */
  const scrollTo = async (p, y) => {
    await p.evaluate((top) => document.querySelector('main').scrollTo({ top, behavior: 'instant' }), y);
    await p.waitForTimeout(300);
  };
  const offsetOf = (loc) => loc.first().evaluate((el) => el.getBoundingClientRect().top + document.querySelector('main').scrollTop);
  const drawer = (p) => p.getByRole('dialog').first();
  const up = (loc, n = 1) => loc.locator('xpath=' + Array(n).fill('..').join('/'));
  const typeMoney = async (p, loc, text) => {
    await loc.click();
    await p.keyboard.press('ControlOrMeta+A');
    await p.keyboard.type(text);
  };

  let id = null;
  try {
    const s = await open('staff.bcb@mitragroup.id');
    await s.goto(url('/invoices/create'));
    await s.getByRole('button', { name: 'Klien', exact: true }).click();
    await s.getByRole('option', { name: CLIENT }).click();
    const subject = s.getByRole('textbox', { name: 'Perihal' });
    const attention = s.getByRole('textbox', { name: 'Untuk perhatian (ATTENTION)' });
    const detailTargets = () => ({
      client: s.getByRole('button', { name: 'Klien', exact: true }),
      subject,
      attention,
      attentionHint: s.getByText('Kosong = PIC di data klien.'),
    });
    const detailTop = (await offsetOf(s.getByRole('button', { name: 'Klien', exact: true }))) - 140;
    await scrollTo(s, detailTop);
    await snap(s, 'staff-detail-empty', detailTargets());
    await subject.fill('Invoice speed boat MV. CONTOH JAYA');
    await attention.fill('Direktur Finance & Accounting');
    await s.keyboard.press('Tab');
    await scrollTo(s, detailTop);
    await snap(s, 'staff-detail', detailTargets());

    /* ── Satu harga untuk beberapa perjalanan: satu baris + keterangan ── */
    const items = s.getByRole('region', { name: /^Item/ });
    await s.getByLabel('Layanan baris 1', { exact: true }).fill('Transportasi speed boat pulang-pergi');
    await s.keyboard.press('Escape');
    await s.getByLabel('Satuan baris 1').fill('paket');
    await s.keyboard.press('Escape');
    await typeMoney(s, s.locator('#price-0'), '7500000');
    await s.keyboard.press('Tab');
    const itemsTop = (await offsetOf(items)) - 90;
    const row1 = () => items.getByRole('listitem').first();
    const itemTargets = () => ({
      items,
      row1: row1(),
      name1: s.getByLabel('Layanan baris 1', { exact: true }),
      qty1: s.getByLabel('Qty baris 1'),
      unit1: s.getByLabel('Satuan baris 1'),
      price1: s.locator('#price-0'),
      addDesc: row1().getByRole('button', { name: 'Tambah keterangan' }),
      desc1: row1().locator('textarea'),
    });
    await scrollTo(s, itemsTop);
    await snap(s, 'staff-package', itemTargets());
    await row1().getByRole('button', { name: 'Tambah keterangan' }).click();
    await row1().locator('textarea').fill('1. Dari darat ke MV. CONTOH JAYA, 15 Mei 2026\n2. Dari MV. CONTOH JAYA ke darat, 20 Mei 2026');
    await s.keyboard.press('Tab');
    await scrollTo(s, itemsTop);
    await snap(s, 'staff-package-desc', itemTargets());

    /* ── Harga satuan bersen ── */
    await s.getByRole('button', { name: /Tambah baris/ }).click();
    await s.getByLabel('Layanan baris 2', { exact: true }).fill('Jasa bongkar muat');
    await s.keyboard.press('Escape');
    await s.getByLabel('Qty baris 2').fill('1250');
    await s.getByLabel('Satuan baris 2').fill('MT');
    await s.keyboard.press('Escape');
    const row2 = () => items.getByRole('listitem').nth(1);
    await typeMoney(s, s.locator('#price-1'), '4350,75');
    await s.keyboard.press('Tab');
    const row2Top = (await offsetOf(row2())) - 300;
    await scrollTo(s, row2Top);
    await snap(s, 'staff-decimal', {
      row1: row1(),
      row2: row2(),
      qty2: s.getByLabel('Qty baris 2'),
      price2: s.locator('#price-1'),
      subtotal2: row2().getByText(/^Rp [\d.]+$/).first(),
    });

    await scrollTo(s, 0);
    await s.getByRole('button', { name: 'Simpan draft' }).click();
    await s.waitForURL(/#invoice\/\d+/);
    id = Number(s.url().match(/#invoice\/(\d+)/)[1]);
    await s.goto(url(`/invoices?open=${id}#invoice/${id}`));
    await drawer(s).getByRole('heading', { name: 'Riwayat' }).waitFor();
    await s.waitForTimeout(500);
    await snap(s, 'staff-drawer', {
      items: drawer(s).locator('table').first(),
      row1: drawer(s).locator('tbody tr').first(),
      row2: drawer(s).locator('tbody tr').nth(1),
    });
  } catch (e) {
    log.push('ERROR ' + e.message.split('\n')[0]);
  }
  for (const c of contexts) await c.close();
  return { id, shots, log };
}
