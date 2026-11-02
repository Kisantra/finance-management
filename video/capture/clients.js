/*
 * Ambil ulang screenshot tutorial Klien (video/clients/screens/*.webp) bila UI berubah.
 * 1. Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8015
 * 2. Playwright MCP: browser_run_code_unsafe, filename: video/capture/clients.js
 * 3. python video/capture/to-webp.py clients, lalu salin koordinat hasilnya ke video/clients/shots.ts.
 * Membuat 1 klien baru "PT Sinar Mitra Logistik" di DB QC (tidak dihapus; hapus dulu bila menjalankan ulang).
 * Halaman invoice & arus kas hanya dibaca. Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8015';
  const OUT = 'D:/Laravel/finance-management/video/clients/screens/';
  const NAME = 'PT Sinar Mitra Logistik';
  const BIG = 'Budi Santoso';
  const BIG_ID = 4;
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
        s.textContent = 'button[aria-label="Kirim Feedback"],[data-sonner-toaster]{display:none!important}';
        document.head.appendChild(s);
      });
    });
    const p = await ctx.newPage();
    await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
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
  const up = (loc) => loc.locator('xpath=..');
  const row = (p, name) => p.getByRole('row', { name: new RegExp(name.replace(/\./g, '\\.')) });

  try {
    /* ── Staff (Finance manager sama persis): lihat, tambah, ubah ── */
    const s = await open('staff@qc.test');
    await s.goto(BASE + '/clients');
    await row(s, BIG).first().waitFor();
    await snap(s, 'staff-list', {
      create: s.getByRole('button', { name: 'Tambah Klien' }),
      stats: up(up(up(s.getByText('Total Klien', { exact: true })))).locator('xpath=..'),
      search: s.getByRole('textbox', { name: 'Cari nama, email, NPWP...' }),
      filters: up(s.getByRole('button', { name: 'Semua Tipe' })).locator('xpath=..'),
      table: s.getByRole('table'),
      bigRow: row(s, BIG),
      invoiceCell: row(s, BIG).getByRole('cell').nth(4),
      finance: row(s, BIG).getByRole('cell').nth(5),
      actions: row(s, BIG).getByRole('cell').nth(6),
    });

    await s.getByRole('button', { name: 'Tambah Klien' }).click();
    const d = () => s.getByRole('dialog', { name: 'Tambah Klien' });
    const fields = () => ({
      dialog: d(),
      name: d().getByRole('textbox', { name: 'Nama Klien *' }),
      type: up(d().getByRole('button', { name: 'Perusahaan' })),
      status: up(d().getByRole('button', { name: 'Tidak Aktif' })),
      email: d().getByRole('textbox', { name: 'Email' }),
      address: d().getByRole('textbox', { name: 'Alamat' }),
      npwp: d().getByRole('textbox', { name: 'NPWP' }),
      kpp: d().getByRole('textbox', { name: 'KPP' }),
      efin: d().getByRole('textbox', { name: 'EFIN' }),
      pic: d().getByRole('textbox', { name: 'PIC (Person in Charge)' }),
      ar: d().getByRole('textbox', { name: 'Account Representative' }),
      arPhone: d().getByRole('textbox', { name: 'No. HP AR' }),
      left: up(d().getByText('Informasi Dasar', { exact: true })).locator('xpath=..'),
      right: up(d().getByText('Data Pajak & Kontak', { exact: true })).locator('xpath=..'),
      cancel: d().getByRole('button', { name: 'Batal' }),
      save: d().getByRole('button', { name: 'Simpan Klien' }),
    });
    await d().getByRole('textbox', { name: 'Nama Klien *' }).waitFor();
    await snap(s, 'staff-form-empty', fields());

    await d().getByRole('textbox', { name: 'Nama Klien *' }).fill(NAME);
    await snap(s, 'staff-form-name', fields());

    await d().getByRole('button', { name: 'Perusahaan' }).click();
    await snap(s, 'staff-form-type', fields());

    await d().getByRole('textbox', { name: 'Email' }).fill('finance@sinarmitra.co.id');
    await d().getByRole('textbox', { name: 'Alamat' }).fill('Jl. Raya Cakung Cilincing Km 2, Jakarta Utara');
    await snap(s, 'staff-form-contact', fields());

    await d().getByRole('textbox', { name: 'NPWP' }).fill('02.418.765.3-045.000');
    await d().getByRole('textbox', { name: 'KPP' }).fill('KPP Pratama Koja');
    await d().getByRole('textbox', { name: 'EFIN' }).fill('4120987654');
    await snap(s, 'staff-form-tax', fields());

    await d().getByRole('textbox', { name: 'PIC (Person in Charge)' }).fill('Ratna Dewi');
    await d().getByRole('textbox', { name: 'Account Representative' }).fill('Hendra Gunawan');
    await d().getByRole('textbox', { name: 'No. HP AR' }).fill('0812-3456-7890');
    await snap(s, 'staff-form-filled', fields());

    await d().getByRole('button', { name: 'Simpan Klien' }).scrollIntoViewIfNeeded();
    await snap(s, 'staff-form-save', fields());

    await d().getByRole('button', { name: 'Simpan Klien' }).click();
    await d().waitFor({ state: 'detached' });
    await s.getByRole('textbox', { name: 'Cari nama, email, NPWP...' }).fill('Sinar Mitra');
    await s.waitForURL(/search=Sinar/);
    await s.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
    await snap(s, 'staff-list-created', {
      row: row(s, NAME),
      search: s.getByRole('textbox', { name: 'Cari nama, email, NPWP...' }),
      status: row(s, NAME).getByText('Aktif', { exact: true }),
      edit: row(s, NAME).getByRole('button').first(),
      remove: row(s, NAME).getByRole('button').last(),
      stats: up(up(up(s.getByText('Total Klien', { exact: true })))).locator('xpath=..'),
    });

    await row(s, NAME).getByRole('button').first().click();
    const e = () => s.getByRole('dialog', { name: 'Edit Klien' });
    await e().getByRole('textbox', { name: 'Nama Klien *' }).waitFor();
    await e().getByRole('button', { name: 'Tidak Aktif' }).click();
    await snap(s, 'staff-edit', {
      dialog: e(),
      name: e().getByRole('textbox', { name: 'Nama Klien *' }),
      status: up(e().getByRole('button', { name: 'Tidak Aktif' })),
      npwp: e().getByRole('textbox', { name: 'NPWP' }),
      save: e().getByRole('button', { name: 'Perbarui Klien' }),
      cancel: e().getByRole('button', { name: 'Batal' }),
    });
    await e().getByRole('button', { name: 'Batal' }).click();
    await e().waitFor({ state: 'detached' });

    /* ── Admin: hapus + jejak di modul lain ── */
    const a = await open('admin@gmail.com');
    await a.goto(BASE + '/clients');
    await row(a, BIG).first().waitFor();
    await snap(a, 'admin-list', {
      bigRow: row(a, BIG),
      invoiceCell: row(a, BIG).getByRole('cell').nth(4),
      finance: row(a, BIG).getByRole('cell').nth(5),
      remove: row(a, BIG).getByRole('button').last(),
    });
    await row(a, BIG).getByRole('button').last().click();
    const del = () => a.getByRole('dialog', { name: 'Hapus Klien' });
    await del().waitFor();
    await snap(a, 'admin-delete', {
      dialog: del(),
      confirm: del().getByRole('button', { name: 'Hapus Klien' }),
      cancel: del().getByRole('button', { name: 'Batal' }),
    });
    await del().getByRole('button', { name: 'Batal' }).click();

    const go = async (url) => {
      await a.goto(BASE + url).catch(() => a.goto(BASE + url));
      await a.waitForLoadState('networkidle');
    };
    await go(`/invoices?client_ids[]=${BIG_ID}&month=`);
    await snap(a, 'admin-invoices', {
      list: a.getByRole('region', { name: 'Daftar invoice' }),
      clientFilter: a.getByRole('button', { name: /klien/i }).first(),
      summary: a.getByRole('region', { name: 'Ringkasan invoice' }),
    });

    await go(`/cash-flow/income?clients=${BIG_ID}`);
    await snap(a, 'admin-income', {
      total: up(up(a.getByText('Total Pemasukan', { exact: false }))),
      firstRow: a.getByRole('row', { name: /Budi Santoso/ }),
      table: a.getByRole('table'),
    });

  } catch (err) {
    log.push('ERROR ' + err.message.split('\n')[0]);
    for (const [i, ctx] of contexts.entries()) for (const pg of ctx.pages()) await pg.screenshot({ path: OUT + `../debug-${i}.png` }).catch(() => {});
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
  return JSON.stringify({ log, shots });
}
