/*
 * Ambil ulang screenshot tutorial Layanan (video/services/screens/*.webp, lewat to-webp.py) bila UI berubah.
 * 1. Jalankan server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8012
 * 2. Jalankan file ini lewat Playwright MCP (browser_run_code_unsafe, filename: video/capture/services.js).
 * 3. python video/capture/to-webp.py services, lalu salin koordinat dari hasilnya ke video/services/shots.ts.
 * Skrip ini menambah beberapa layanan contoh di DB QC (dilewati bila sudah ada) dan membuat ulang
 * "Laporan SPT Tahunan Badan". Tidak menyimpan invoice/template apa pun. Jangan jalankan di DB utama.
 */
async (page) => {
 const contexts = [];
 try {
  const BASE = 'http://127.0.0.1:8012';
  const OUT = 'D:/Laravel/finance-management/video/services/screens/';
  const browser = page.context().browser();
  const shots = {};
  const log = [];

  const open = async (email) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
    contexts.push(ctx);
    ctx.setDefaultTimeout(60000);
    await ctx.addInitScript(() => {
      // Matikan HMR Vite: file yang disimpan agent/editor lain memicu reload penuh di tengah capture.
      const RealWS = window.WebSocket;
      const FakeWS = function (url, protocols) {
        const p = [].concat(protocols ?? []);
        if (p.includes('vite-hmr') || p.includes('vite-ping')) return { readyState: 0, send() {}, close() {}, addEventListener() {}, removeEventListener() {} };
        return new RealWS(url, protocols);
      };
      Object.assign(FakeWS, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3, prototype: RealWS.prototype });
      window.WebSocket = FakeWS;
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
    await p.waitForURL(/dashboard/, { timeout: 90000 });
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
  // Popover Combobox juga ber-role dialog; form layanan = dialog yang memuat field Nama Layanan.
  const sheet = (p) => p.getByRole('dialog').filter({ has: p.getByLabel('Nama Layanan *') });
  const row = (p, name) => p.getByRole('row', { name: new RegExp(name) });
  const list = async (p) => {
    await p.goto(BASE + '/services?per_page=10');
    await p.getByRole('button', { name: 'Tambah Layanan' }).waitFor();
    // Efek pencarian (debounce 300 ms) memicu satu kunjungan ulang setelah halaman dimuat; tunggu selesai.
    await p.waitForTimeout(700);
    await p.waitForLoadState('networkidle');
  };
  const fill = async (p, name, type, price) => {
    await sheet(p).getByLabel('Nama Layanan *').fill(name);
    await sheet(p).getByRole('button', { name: /^Kategori/ }).click();
    await p.getByRole('option', { name: type, exact: true }).click();
    await sheet(p).getByLabel('Harga *').click();
    await sheet(p).getByLabel('Harga *').fill('');
    await p.keyboard.type(String(price));
  };

  /* ── Admin: data contoh (dilewati bila sudah ada) ── */
  const a = await open('admin@gmail.com');
  await list(a);
  const seed = [
    ['Pendaftaran Merek Dagang', 'Perizinan', 4000000],
    ['Pengurusan NIB & OSS', 'Perizinan', 2500000],
    ['Kelola Media Sosial Bulanan', 'Digital Marketing', 3000000],
    ['Pembukuan & Lapor Pajak Bulanan', 'Administrasi Perpajakan', 1500000],
  ];
  for (const [name, type, price] of seed) {
    await a.goto(BASE + '/services?search=' + encodeURIComponent(name));
    await a.getByRole('button', { name: 'Tambah Layanan' }).waitFor();
    await a.waitForTimeout(700);
    await a.waitForLoadState('networkidle');
    if (await a.getByRole('cell', { name, exact: true }).count()) continue;
    await a.getByRole('button', { name: 'Tambah Layanan' }).click();
    await fill(a, name, type, price);
    await sheet(a).getByRole('button', { name: 'Simpan Layanan' }).click();
    await a.getByRole('cell', { name, exact: true }).waitFor();
  }
  // Contoh utama dibuat ulang oleh Finance manager di bawah.
  await a.goto(BASE + '/services?search=' + encodeURIComponent('Laporan SPT Tahunan Badan'));
  await a.getByRole('button', { name: 'Tambah Layanan' }).waitFor();
  await a.waitForTimeout(700);
  await a.waitForLoadState('networkidle');
  while (await a.getByRole('cell', { name: 'Laporan SPT Tahunan Badan', exact: true }).count()) {
    await row(a, 'Laporan SPT Tahunan Badan').first().getByRole('button').nth(1).click();
    await top(a).getByRole('button', { name: 'Hapus Layanan' }).click();
    await a.waitForTimeout(800);
    await a.waitForLoadState('networkidle');
  }

  /* ── Finance manager: tambah & ubah ── */
  const m = await open('fm@qc.test');
  await list(m);
  await snap(m, 'fm-list', {
    create: m.getByRole('button', { name: 'Tambah Layanan' }),
    stats: m.getByText('Total Layanan', { exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
    search: m.getByPlaceholder('Cari layanan...'),
    table: m.locator('table'),
  });

  await m.getByRole('button', { name: 'Tambah Layanan' }).click();
  await sheet(m).getByLabel('Nama Layanan *').waitFor();
  const form = () => ({
    dialog: sheet(m),
    name: sheet(m).getByLabel('Nama Layanan *'),
    category: sheet(m).getByRole('button', { name: /^Kategori/ }),
    price: sheet(m).getByLabel('Harga *'),
    cancel: sheet(m).getByRole('button', { name: 'Batal' }),
    submit: sheet(m).getByRole('button', { name: /Simpan Layanan|Perbarui Layanan/ }),
  });
  await snap(m, 'fm-form-empty', form());
  await sheet(m).getByLabel('Nama Layanan *').fill('Laporan SPT Tahunan Badan');
  await snap(m, 'fm-form-name', form());
  await sheet(m).getByRole('button', { name: /^Kategori/ }).click();
  await m.getByRole('option', { name: 'Administrasi Perpajakan', exact: true }).waitFor();
  await snap(m, 'fm-form-category', { ...form(), option: m.getByRole('option', { name: 'Administrasi Perpajakan', exact: true }), list: m.getByRole('listbox') });
  if (!(await m.getByRole('option', { name: 'Administrasi Perpajakan', exact: true }).isVisible())) await sheet(m).getByRole('button', { name: /^Kategori/ }).click();
  await m.getByRole('option', { name: 'Administrasi Perpajakan', exact: true }).click();
  await m.getByRole('listbox').waitFor({ state: 'detached' }).catch(() => {});
  await snap(m, 'fm-form-category-set', form());
  await sheet(m).getByLabel('Harga *').click();
  await sheet(m).getByLabel('Harga *').fill('');
  await m.keyboard.type('3000000');
  await snap(m, 'fm-form-filled', form());
  await sheet(m).getByRole('button', { name: 'Simpan Layanan' }).click();
  await m.getByRole('cell', { name: 'Laporan SPT Tahunan Badan', exact: true }).waitFor();
  await m.waitForTimeout(400);
  await snap(m, 'fm-list-added', {
    row: row(m, 'Laporan SPT Tahunan Badan'),
    stats: m.getByText('Total Layanan', { exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
    actions: row(m, 'Laporan SPT Tahunan Badan').getByRole('button').first().locator('xpath=..'),
    edit: row(m, 'Laporan SPT Tahunan Badan').getByRole('button').nth(0),
    remove: row(m, 'Laporan SPT Tahunan Badan').getByRole('button').nth(1),
    toast: m.locator('[data-sonner-toast]'),
  });

  await row(m, 'Laporan SPT Tahunan Badan').getByRole('button').nth(0).click();
  await sheet(m).getByLabel('Nama Layanan *').waitFor();
  await snap(m, 'fm-edit-open', form());
  await sheet(m).getByLabel('Harga *').click();
  await sheet(m).getByLabel('Harga *').fill('');
  await m.keyboard.type('3500000');
  await snap(m, 'fm-edit', form());
  await sheet(m).getByRole('button', { name: 'Perbarui Layanan' }).click();
  await m.getByRole('cell', { name: /3\.500\.000/ }).first().waitFor();
  await m.waitForTimeout(400);
  await snap(m, 'fm-list-updated', {
    row: row(m, 'Laporan SPT Tahunan Badan'),
    price: row(m, 'Laporan SPT Tahunan Badan').getByRole('cell').nth(2),
  });

  /* ── Staff: lihat katalog + pakai di invoice ── */
  const s = await open('staff@qc.test');
  await list(s);
  await snap(s, 'staff-list', {
    create: s.getByRole('button', { name: 'Tambah Layanan' }),
    stats: s.getByText('Total Layanan', { exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
    search: s.getByPlaceholder('Cari layanan...'),
    typeFilter: s.getByRole('button', { name: /Semua Kategori/ }),
    table: s.locator('table'),
  });
  await s.getByPlaceholder('Cari layanan...').fill('lapor');
  await s.waitForURL(/search=lapor/);
  await s.getByRole('cell', { name: 'Laporan SPT Tahunan Badan', exact: true }).waitFor();
  await snap(s, 'staff-search', {
    search: s.getByPlaceholder('Cari layanan...'),
    table: s.locator('table'),
    count: s.getByText(/\d+–\d+ dari \d+/),
  });

  const catalog = async (p, prefix) => {
    await p.goto(BASE + '/invoices/create');
    const pick = p.getByRole('button', { name: 'Pilih layanan baris 1 dari katalog' });
    await pick.waitFor();
    await snap(p, prefix + '-invoice', {
      item: p.getByLabel('Layanan baris 1'),
      pick,
      items: p.locator('section[aria-labelledby="inv-items"]'),
    });
    await pick.click();
    await p.getByLabel('Cari layanan').waitFor();
    await p.getByLabel('Cari layanan').fill('SPT');
    const opt = p.getByRole('button', { name: /Laporan SPT Tahunan Badan/ });
    await opt.waitFor();
    await snap(p, prefix + '-invoice-catalog', {
      pick,
      popover: p.getByLabel('Cari layanan').locator('xpath=ancestor::*[@data-radix-popper-content-wrapper][1]'),
      option: opt,
    });
    await opt.click();
    await snap(p, prefix + '-invoice-picked', {
      item: p.getByLabel('Layanan baris 1'),
      price: p.locator('#price-0'),
      row: p.getByLabel('Layanan baris 1').locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
    });
  };
  await catalog(s, 'staff');

  /* ── Admin: hapus + jejak di modul lain ── */
  await list(a);
  await snap(a, 'admin-list', {
    create: a.getByRole('button', { name: 'Tambah Layanan' }),
    row: row(a, 'Laporan SPT Tahunan Badan'),
    remove: row(a, 'Laporan SPT Tahunan Badan').getByRole('button').nth(1),
  });
  await row(a, 'Laporan SPT Tahunan Badan').getByRole('button').nth(1).click();
  await top(a).getByRole('button', { name: 'Hapus Layanan' }).waitFor();
  await snap(a, 'admin-delete', {
    dialog: top(a),
    confirm: top(a).getByRole('button', { name: 'Hapus Layanan' }),
    cancel: top(a).getByRole('button', { name: 'Batal' }),
  });
  await top(a).getByRole('button', { name: 'Batal' }).click();

  await catalog(a, 'admin');

  await a.goto(BASE + '/recurring-invoices/templates/create');
  const lookup = a.getByTitle('Pilih dari katalog layanan').first();
  await lookup.waitFor();
  await lookup.click();
  await a.getByPlaceholder('Cari layanan...').last().waitFor();
  await snap(a, 'admin-template-lookup', {
    lookup,
    popover: a.getByPlaceholder('Cari layanan...').last().locator('xpath=ancestor::*[@data-radix-popper-content-wrapper][1]'),
    items: a.getByText('Item Invoice', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]'),
  });

  return JSON.stringify({ log, shots });
 } finally {
  for (const ctx of contexts) await ctx.close();
 }
}
