/*
 * Ambil ulang screenshot panduan Tagihan USD (video/tagihan-usd/screens/*.webp) bila UI berubah.
 * 1. DB QC yang sama dengan video/capture/debit-note.js (PT BCB contoh: Tagihan USD menyala, rekening profil
 *    Rupiah + USD berisi nomor contoh, rekening Kas & Bank "Mandiri Operasional").
 * 2. Server: php artisan serve --host=127.0.0.1 --port=8031.
 * 3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/tagihan-usd.js (ubah ROOT bila perlu).
 * 4. python video/capture/to-webp.py tagihan-usd, lalu salin koordinat hasilnya ke video/tagihan-usd/shots.ts.
 * Skrip ini MENERBITKAN 1 invoice USD (20.000 MT × USD 0,82, kurs 18.300, tanpa PPN & PPh) dan MENCATAT
 * pembayarannya (USD 16.400 dengan kurs 18.400, oleh fm.bcb = Finance manager) di DB QC. Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8031';
  const COMPANY = 'bahtera-cipta-bersama';
  const ROOT = '/Users/alexjanuar/orca/workspaces/finance-management/nusa-lintas-armada/';
  const OUT = ROOT + 'video/tagihan-usd/screens/';
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
  const reveal = async (loc, block = 'center') => {
    await loc.first().evaluate((el, b) => el.scrollIntoView({ block: b, behavior: 'instant' }), block);
    await loc.page().waitForTimeout(400);
  };
  const top = (p) => p.getByRole('dialog').filter({ hasNot: p.locator('[cmdk-root]') }).last();
  const drawer = (p) => p.getByRole('dialog').first();
  const up = (loc, n = 1) => loc.locator('xpath=' + Array(n).fill('..').join('/'));
  // Mengulang setelah gagal di bagian pembayaran: isi id invoice USD yang sudah terbit agar tidak membuat invoice baru.
  const RESUME_ID = null;
  const typeMoney = async (p, loc, text) => {
    await loc.click();
    await p.keyboard.press('ControlOrMeta+A');
    await p.keyboard.type(text);
  };

  let id = RESUME_ID;
  const s = await open('staff.bcb@mitragroup.id');
  try {
  if (!RESUME_ID) {
  /* ── Admin: menyalakan Tagihan USD + rekening USD ── */
  const a = await open('admin.bcb@mitragroup.id');
  await a.goto(url('/settings/company'));
  const usdCheck = a.getByText('Perusahaan ini bisa').first();
  await usdCheck.waitFor();
  await reveal(usdCheck, 'center');
  await snap(a, 'admin-usd', {
    heading: a.getByRole('heading', { name: 'Tagihan USD', exact: true }),
    check: up(usdCheck, 1),
  });
  const currency = a.getByText('Mata uang rekening').nth(1);
  await reveal(currency, 'center');
  await snap(a, 'admin-bank', {
    heading: a.getByRole('heading', { name: 'Rekening Pembayaran', exact: true }),
    currency: up(currency, 1),
    branch: up(a.getByText('Cabang', { exact: true }).nth(1), 1),
    swift: up(a.getByText('Kode Swift', { exact: true }).nth(1), 1),
  });

  /* ── Staff: invoice USD ── */
  await s.goto(url('/invoices/create'));
  await s.getByRole('radiogroup', { name: 'Mata uang tagihan' }).waitFor();
  const detail = () => ({
    currency: s.getByRole('radiogroup', { name: 'Mata uang tagihan' }),
    usd: s.getByRole('radio', { name: 'USD' }),
    rate: s.getByRole('textbox', { name: 'Kurs (Rp per 1 USD)' }),
    rateBlock: up(s.getByRole('textbox', { name: 'Kurs (Rp per 1 USD)' }), 3),
    info: s.getByText(/Klien berutang dalam USD/),
    client: s.getByRole('button', { name: 'Klien', exact: true }),
  });
  await snap(s, 'staff-new', detail());
  await s.getByRole('radio', { name: 'USD' }).click();
  await s.getByRole('textbox', { name: 'Kurs (Rp per 1 USD)' }).waitFor();
  await s.getByRole('textbox', { name: 'Kurs (Rp per 1 USD)' }).fill('');
  await snap(s, 'staff-usd', detail());
  await typeMoney(s, s.getByRole('textbox', { name: 'Kurs (Rp per 1 USD)' }), '18300');
  await s.keyboard.press('Tab');
  await snap(s, 'staff-rate', detail());

  await s.getByRole('button', { name: 'Klien', exact: true }).click();
  await s.getByRole('option', { name: CLIENT }).click();
  const items = s.getByRole('region', { name: /^Item/ });
  await s.getByLabel('Layanan baris 1', { exact: true }).fill('Jasa stevedoring MV. CONTOH JAYA');
  await s.keyboard.press('Escape');
  await s.getByLabel('Qty baris 1').fill('20000');
  await s.getByLabel('Satuan baris 1').fill('MT');
  await s.keyboard.press('Escape');
  await reveal(items, 'center');
  await snap(s, 'staff-item-rp', {
    row1: items.getByRole('listitem').first(),
    usdSwitch: items.getByRole('switch', { name: 'Harga USD' }).first(),
    usdToggle: up(items.getByRole('switch', { name: 'Harga USD' }).first(), 1),
    price1: s.locator('#price-0'),
  });
  await items.getByRole('switch', { name: 'Harga USD' }).first().click();
  await typeMoney(s, s.locator('#price-0'), '0,82');
  await s.keyboard.press('Tab');
  await reveal(items, 'center');
  await snap(s, 'staff-item', {
    row1: items.getByRole('listitem').first(),
    usdToggle: up(items.getByRole('switch', { name: 'Harga USD' }).first(), 1),
    price1: s.locator('#price-0'),
    qty1: s.getByLabel('Qty baris 1'),
    hint: items.getByText(/Harga USD × kurs/),
    subtotal: items.getByText(/^Rp [\d.]+$/).first(),
  });

  const totals = s.getByRole('region', { name: 'Penyesuaian dan total' });
  await reveal(totals, 'end');
  for (const name of [/Tagih PPN/, /PPh 23/]) {
    const sw = totals.getByRole('switch', { name });
    if ((await sw.getAttribute('aria-checked')) === 'true') await sw.click();
  }
  await s.waitForTimeout(300);
  await reveal(totals, 'end');
  await snap(s, 'staff-totals', {
    totals,
    ppn: up(totals.getByRole('switch', { name: /Tagih PPN/ }), 1),
    pph: up(totals.getByRole('switch', { name: /PPh 23/ }), 1),
    summary: up(totals.getByText('Total', { exact: true }), 2),
    usdLine: up(totals.getByText(/Tagihan USD/), 1),
  });

  await reveal(s.getByRole('heading', { level: 1 }), 'start');
  await s.getByRole('button', { name: 'Simpan & terbitkan' }).click();
  await top(s).getByRole('button', { name: /Terbitkan/ }).last().waitFor();
  await top(s).getByRole('button', { name: /Terbitkan/ }).last().click();
  await s.waitForURL(/#invoice\/\d+/);
  id = Number(s.url().match(/#invoice\/(\d+)/)[1]);
  await drawer(s).getByRole('heading', { name: 'Riwayat' }).waitFor();
  await s.waitForTimeout(500);
  await snap(s, 'staff-drawer', {
    drawer: drawer(s),
    status: drawer(s).locator('.rounded-full', { hasText: /^(Draft|Terbit|Sebagian|Lunas)$/ }).first(),
    metrics: up(up(drawer(s).getByText('Sisa tagihan', { exact: true }).first())),
    items: drawer(s).locator('table').first(),
    pay: drawer(s).getByRole('button', { name: 'Catat pembayaran' }),
  });

  }
  // Pembayaran oleh Finance manager: Staff tidak punya izin view bank-accounts, jadi daftar Rekening tujuan
  // (/api/bank-accounts) tidak bisa dimuat untuknya.
  const m = await open('fm.bcb@mitragroup.id');
  await m.goto(url(`/invoices?open=${id}#invoice/${id}`));
  await drawer(m).getByRole('heading', { name: 'Riwayat' }).waitFor();

  /* ── Pembayaran USD dengan kurs saat diterima ── */
  await drawer(m).getByRole('button', { name: 'Catat pembayaran' }).click();
  const pay = m.getByRole('dialog', { name: 'Catat pembayaran' });
  await pay.getByText('Diterima (USD)').first().waitFor();
  const payTargets = () => ({
    dialog: pay,
    received: pay.getByRole('textbox', { name: 'Diterima (USD)' }),
    rate: pay.getByRole('textbox', { name: 'Kurs saat diterima (Rp per 1 USD)' }),
    rateHint: pay.getByText(/^Kurs invoice/).first(),
    result: pay.getByText(/Masuk ke rekening/).first(),
    account: pay.getByRole('button', { name: 'Rekening tujuan' }),
    journal: pay.locator('section[aria-label="Jurnal"]'),
  });
  await snap(m, 'fm-pay', payTargets());
  await typeMoney(m, pay.getByRole('textbox', { name: 'Kurs saat diterima (Rp per 1 USD)' }), '18400');
  await pay.getByRole('button', { name: 'Rekening tujuan' }).click();
  await m.getByRole('option', { name: /Mandiri Operasional/ }).click();
  await m.waitForTimeout(300);
  await snap(m, 'fm-pay-rate', payTargets());
  await reveal(pay.locator('section[aria-label="Jurnal"]'), 'center');
  await snap(m, 'fm-pay-journal', payTargets());
  await pay.getByRole('button', { name: 'Simpan pembayaran' }).click();
  await drawer(m).locator('.rounded-full', { hasText: /^Lunas$/ }).first().waitFor({ timeout: 8000 }).catch(() => log.push('not paid'));
  await m.waitForTimeout(600);
  await snap(m, 'fm-paid', {
    status: drawer(m).locator('.rounded-full', { hasText: /^(Draft|Terbit|Sebagian|Lunas)$/ }).first(),
    metrics: up(up(drawer(m).getByText('Sisa tagihan', { exact: true }).first())),
    payments: up(drawer(m).getByText('Pembayaran', { exact: true }).last(), 2),
  });

  } catch (e) {
    log.push('ERROR ' + e.message.split('\n')[0]);
  }
  for (const c of contexts) await c.close();
  return { id, shots, log };
}
