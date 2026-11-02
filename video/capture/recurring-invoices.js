/*
 * Ambil ulang screenshot tutorial Invoice Berulang (video/recurring-invoices/screens/*.webp, lewat to-webp.py) bila UI berubah.
 * 1. Jalankan server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8012
 * 2. Jalankan video/capture/services.js dulu (butuh layanan "Pembukuan & Lapor Pajak Bulanan" dan "Kelola Media Sosial Bulanan").
 * 3. Jalankan file ini lewat Playwright MCP (browser_run_code_unsafe, filename: video/capture/recurring-invoices.js).
 * 4. python video/capture/to-webp.py recurring-invoices, lalu salin koordinat dari hasilnya ke video/recurring-invoices/shots.ts.
 * Skrip ini membuat 2 template (bulanan & triwulanan), men-generate draft Oktober 2026, dan mem-publish satu draft
 * (= 1 invoice draft baru di modul Invoice). Untuk mengulang, hapus dulu data itu dari DB QC. Jangan jalankan di DB utama.
 */
async (page) => {
 const contexts = [];
 try {
  const BASE = 'http://127.0.0.1:8012';
  const OUT = 'D:/Laravel/finance-management/video/recurring-invoices/screens/';
  const MONTHLY = BASE + '/recurring-invoices?tab=monthly&month=10&year=2026';
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
  const parentOf = (loc) => loc.locator('xpath=..');
  const pickDate = async (p, label, iso) => {
    await p.getByRole('button', { name: new RegExp('^' + label) }).click();
    const cell = p.locator(`td[data-day="${iso}"]:not([data-outside]) button`);
    for (let i = 0; i < 24 && !(await cell.isVisible()); i++) {
      const shown = await p.locator('td[data-day]:not([data-outside])').first().getAttribute('data-day');
      await p.getByRole('button', { name: shown > iso ? 'Bulan sebelumnya' : 'Bulan berikutnya' }).click();
    }
    await cell.click();
  };
  const json = (p, method, url, body) =>
    p.evaluate(async ([method, url, body]) => {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, body: await res.json() };
    }, [method, url, body]);

  /* ── Finance manager: template ── */
  const m = await open('fm@qc.test');
  await m.goto(BASE + '/recurring-invoices');
  await m.getByRole('button', { name: 'Buat Template' }).first().waitFor();
  await snap(m, 'fm-index', {
    create: m.getByRole('button', { name: 'Buat Template' }).first(),
    tabs: m.getByRole('button', { name: 'Analitik' }).locator('xpath=..'),
    stats: m.getByText('Total Template', { exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
  });

  await m.getByRole('button', { name: 'Buat Template' }).first().click();
  await m.getByLabel('Nama Template *').waitFor();
  const tpl = () => ({
    detail: m.getByText('Detail Template', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]'),
    name: m.getByLabel('Nama Template *'),
    client: m.getByRole('button', { name: 'Klien *', exact: true }),
    start: m.getByRole('button', { name: /^Tanggal Mulai/ }),
    end: m.getByRole('button', { name: /^Tanggal Berakhir/ }),
    frequency: m.getByRole('button', { name: 'Bulanan', exact: true }).locator('xpath=..'),
    items: m.getByText('Item Invoice', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]'),
    lookup1: m.getByTitle('Pilih dari katalog layanan').first(),
    row1: m.locator('table tbody tr').nth(0),
    row2: m.locator('table tbody tr').nth(1),
    addItem: m.getByRole('button', { name: 'Tambah Item' }),
    summary: m.getByText('Laba Kotor', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded")][2]'),
    submit: m.getByRole('button', { name: 'Simpan Template' }),
  });
  await snap(m, 'fm-tpl-empty', tpl());

  await m.getByLabel('Nama Template *').fill('Retainer Pembukuan Bulanan');
  await snap(m, 'fm-tpl-name', tpl());

  await m.getByRole('button', { name: 'Klien *', exact: true }).click();
  const clientOpt = m.getByRole('option', { name: 'PT. Global Solusi Prima' });
  await clientOpt.waitFor();
  await snap(m, 'fm-tpl-client', { ...tpl(), option: clientOpt, list: m.getByRole('listbox') });
  await clientOpt.click();

  await m.getByRole('button', { name: /^Tanggal Mulai/ }).click();
  await m.locator('td[data-day]:not([data-outside])').first().waitFor();
  await m.getByRole('button', { name: 'Bulan sebelumnya' }).click();
  await snap(m, 'fm-tpl-start', { ...tpl(), calendar: m.locator('td[data-day]:not([data-outside])').first().locator('xpath=ancestor::*[@data-radix-popper-content-wrapper][1]'), day: m.locator('td[data-day="2026-09-01"] button') });
  await m.locator('td[data-day="2026-09-01"]:not([data-outside]) button').click();
  await pickDate(m, 'Tanggal Berakhir', '2027-09-01');
  await snap(m, 'fm-tpl-dates', tpl());

  await m.getByTitle('Pilih dari katalog layanan').first().click();
  const svc1 = m.getByRole('button', { name: /Pembukuan & Lapor Pajak Bulanan/ });
  await svc1.waitFor();
  await snap(m, 'fm-tpl-lookup', { ...tpl(), popover: svc1.locator('xpath=ancestor::*[@data-radix-popper-content-wrapper][1]'), option: svc1 });
  await svc1.click();
  const row = (i) => m.locator('table tbody tr').nth(i);
  await row(0).getByPlaceholder('satuan').fill('bulan');
  await row(0).getByPlaceholder('0').nth(1).fill('400000');
  await m.getByLabel('Nama Template *').click();
  await snap(m, 'fm-tpl-item1', tpl());

  await m.getByRole('button', { name: 'Tambah Item' }).click();
  await m.getByTitle('Pilih dari katalog layanan').nth(1).click();
  await m.getByRole('button', { name: /^Maintenance website/ }).click();
  await row(1).getByPlaceholder('satuan').fill('bulan');
  await row(1).getByPlaceholder('0').nth(1).fill('100000');
  await m.getByLabel('Nama Template *').click();
  await snap(m, 'fm-tpl-filled', tpl());

  await m.getByRole('button', { name: 'Simpan Template' }).click();
  await m.waitForURL(/\/recurring-invoices$/);
  const card = (p, name) => p.getByRole('heading', { name, exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
  await card(m, 'Retainer Pembukuan Bulanan').waitFor();

  // Template kedua (triwulanan) dibuat cepat tanpa screenshot.
  const q = await json(m, 'POST', BASE + '/recurring-invoices/templates', {
    template_name: 'Kelola Media Sosial Triwulanan',
    client_id: 2,
    start_date: '2026-07-01',
    end_date: '2027-06-30',
    frequency: 'quarterly',
    items: [{ client_id: 2, service_name: 'Kelola Media Sosial Bulanan', quantity: 3, unit: 'bulan', unit_price: 3000000, cogs_amount: 3600000, is_tax_deposit: false }],
    discount_type: 'fixed',
    discount_value: 0,
    discount_reason: '',
  });
  log.push('quarterly ' + q.status);
  await m.goto(BASE + '/recurring-invoices');
  await card(m, 'Kelola Media Sosial Triwulanan').waitFor();
  await snap(m, 'fm-templates', {
    card: card(m, 'Retainer Pembukuan Bulanan'),
    card2: card(m, 'Kelola Media Sosial Triwulanan'),
    progress: card(m, 'Retainer Pembukuan Bulanan').getByText(/\/\d+ invoice/).locator('xpath=../..'),
    edit: card(m, 'Retainer Pembukuan Bulanan').getByRole('button').nth(0),
    remove: card(m, 'Retainer Pembukuan Bulanan').getByRole('button').nth(1),
    stats: m.getByText('Total Template', { exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
  });

  /* ── Finance manager: bulanan ── */
  await m.goto(MONTHLY);
  await m.getByRole('button', { name: 'Generate Otomatis' }).waitFor();
  await snap(m, 'fm-monthly-empty', {
    month: m.getByText('Oktober 2026', { exact: true }).locator('xpath=..'),
    generate: m.getByRole('button', { name: 'Generate Otomatis' }),
    manual: m.getByRole('button', { name: 'Buat Manual' }).first(),
    stats: m.getByText('Total Revenue', { exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
  });
  await m.getByRole('button', { name: 'Generate Otomatis' }).click();
  await top(m).getByRole('button', { name: 'Generate Sekarang' }).waitFor();
  await snap(m, 'fm-generate', {
    dialog: top(m),
    issue: top(m).getByRole('button', { name: /^Tanggal Terbit/ }),
    due: top(m).getByRole('button', { name: /^Jatuh Tempo/ }),
    confirm: top(m).getByRole('button', { name: 'Generate Sekarang' }),
  });
  await top(m).getByRole('button', { name: 'Generate Sekarang' }).click();
  const rowOf = (p, name) => p.getByRole('row', { name: new RegExp(name) });
  await rowOf(m, 'Retainer Pembukuan Bulanan').waitFor();
  await m.waitForTimeout(400);
  await snap(m, 'fm-monthly', {
    table: m.locator('table'),
    row: rowOf(m, 'Retainer Pembukuan Bulanan'),
    row2: rowOf(m, 'Kelola Media Sosial Triwulanan'),
    publish: rowOf(m, 'Retainer Pembukuan Bulanan').getByTitle('Publish'),
    edit: rowOf(m, 'Retainer Pembukuan Bulanan').getByTitle('Edit'),
    remove: rowOf(m, 'Retainer Pembukuan Bulanan').getByTitle('Hapus'),
    stats: m.getByText('Total Revenue', { exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
    toast: m.locator('[data-sonner-toast]'),
  });

  await rowOf(m, 'Retainer Pembukuan Bulanan').getByTitle('Edit').click();
  await top(m).getByRole('button', { name: 'Simpan Perubahan' }).waitFor();
  await snap(m, 'fm-monthly-edit', {
    dialog: top(m),
    dates: top(m).getByRole('button', { name: /^Tanggal Terjadwal/ }).locator('xpath=../../..'),
    items: top(m).getByText('Item Invoice', { exact: true }).locator('xpath=..'),
    save: top(m).getByRole('button', { name: 'Simpan Perubahan' }),
  });
  await top(m).getByRole('button', { name: 'Batal' }).click();
  await m.waitForTimeout(500);

  await rowOf(m, 'Retainer Pembukuan Bulanan').getByTitle('Publish').click();
  await top(m).getByRole('button', { name: 'Publish', exact: true }).waitFor();
  await snap(m, 'fm-publish', {
    dialog: top(m),
    note: top(m).getByText(/menjadi invoice permanen/),
    issue: top(m).getByRole('button', { name: /^Tanggal Terbit/ }),
    due: top(m).getByRole('button', { name: /^Jatuh Tempo/ }),
    confirm: top(m).getByRole('button', { name: 'Publish', exact: true }),
  });
  await top(m).getByRole('button', { name: 'Publish', exact: true }).click();
  const link = rowOf(m, 'Retainer Pembukuan Bulanan').getByRole('link');
  await link.waitFor();
  const invoiceId = Number((await link.getAttribute('href')).match(/invoice\/(\d+)/)[1]);
  await m.waitForTimeout(400);
  await snap(m, 'fm-published', {
    row: rowOf(m, 'Retainer Pembukuan Bulanan'),
    status: rowOf(m, 'Retainer Pembukuan Bulanan').getByText('Published', { exact: true }),
    link,
    toast: m.locator('[data-sonner-toast]'),
  });

  await rowOf(m, 'Kelola Media Sosial Triwulanan').getByRole('checkbox').click();
  await m.getByText(/invoice dipilih/).waitFor();
  await snap(m, 'fm-bulk', {
    checkbox: rowOf(m, 'Kelola Media Sosial Triwulanan').getByRole('checkbox'),
    bar: m.getByText(/invoice dipilih/).locator('xpath=..'),
  });

  await m.goto(BASE + '/recurring-invoices?tab=analytics&analytics_year=2026');
  await m.getByText('Performa Template', { exact: true }).waitFor();
  await m.waitForTimeout(1500);
  await snap(m, 'fm-analytics', {
    kpi: m.getByText('Pertumbuhan', { exact: true }).locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
    chart: m.getByText(/^Revenue Bulanan/).locator('xpath=ancestor::div[contains(@class,"rounded")][1]'),
    performance: m.getByText('Performa Template', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]'),
    breakdown: m.getByText('Breakdown Status', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]'),
  });

  /* ── Admin: jejak di modul Invoice + arsip/hapus ── */
  const a = await open('admin@gmail.com');
  await a.goto(`${MONTHLY}&open=${invoiceId}#invoice/${invoiceId}`);
  await a.getByRole('heading', { name: 'Riwayat' }).waitFor();
  await snap(a, 'admin-invoice-drawer', {
    drawer: a.getByRole('dialog').first(),
    status: a.getByRole('dialog').first().getByText('Draft', { exact: true }).first(),
    send: a.getByRole('dialog').first().getByRole('button', { name: /Kirim invoice/ }).first(),
    history: parentOf(a.getByRole('heading', { name: 'Riwayat' })),
  });

  await a.goto(BASE + '/invoices?status=draft&search=' + encodeURIComponent('Global Solusi'));
  await a.getByRole('region', { name: 'Daftar invoice' }).waitFor();
  await a.waitForTimeout(800);
  await snap(a, 'admin-invoices', {
    list: a.getByRole('region', { name: 'Daftar invoice' }),
    statusFilter: a.getByRole('group', { name: 'Filter status' }),
    row: a.getByRole('region', { name: 'Daftar invoice' }).getByRole('row', { name: /Global Solusi/ }).first(),
  });

  await a.goto(BASE + '/recurring-invoices');
  await card(a, 'Retainer Pembukuan Bulanan').waitFor();
  await card(a, 'Retainer Pembukuan Bulanan').getByRole('button').nth(1).click();
  await top(a).getByText(/akan diarsipkan/).waitFor();
  await snap(a, 'admin-archive', {
    dialog: top(a),
    text: top(a).getByText(/akan diarsipkan/),
    cancel: top(a).getByRole('button', { name: 'Batal' }),
  });
  await top(a).getByRole('button', { name: 'Batal' }).click();
  await a.waitForTimeout(400);
  await card(a, 'Kelola Media Sosial Triwulanan').getByRole('button').nth(1).click();
  await top(a).getByText(/dihapus permanen/).waitFor();
  await snap(a, 'admin-delete-template', {
    dialog: top(a),
    text: top(a).getByText(/dihapus permanen/),
    cancel: top(a).getByRole('button', { name: 'Batal' }),
  });
  await top(a).getByRole('button', { name: 'Batal' }).click();

  return JSON.stringify({ invoiceId, log, shots });
 } finally {
  for (const ctx of contexts) await ctx.close();
 }
}
