/*
 * Ambil ulang screenshot tutorial Permintaan Dana (video/fund-requests/screens/*.webp) bila UI berubah.
 * 1. Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8015
 * 2. Playwright MCP: browser_run_code_unsafe, filename: video/capture/fund-requests.js
 * 3. Lalu jalankan video/capture/fund-requests-admin.js (layar Admin + dampak).
 * 4. python video/capture/to-webp.py fund-requests, lalu salin koordinat hasilnya ke video/fund-requests/shots.ts.
 * Membuat 2 permintaan dana baru di DB QC (satu dicairkan dari BCA - Operasional, satu ditolak). Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8015';
  const OUT = 'D:/Laravel/finance-management/video/fund-requests/screens/';
  const FIX = 'D:/Laravel/finance-management/video/capture/fixtures/';
  const TITLE = 'Konsumsi & ATK pelatihan pajak klien';
  const TITLE2 = 'Sewa mobil kunjungan klien Bandung';
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
  // Klik opsi/tanggal lalu tunggu popover benar-benar tertutup; klik terlalu cepat tertangkap sebagai "klik di luar" dan menutup sheet.
  const pick = async (p, loc) => {
    await loc.click();
    await p.getByRole('listbox').or(p.getByRole('grid')).first().waitFor({ state: 'detached' }).catch(() => {});
    await p.waitForTimeout(400);
  };
  const statusOf = async (p, title) => (await row(p, title).first().innerText()).replace(/\s+/g, ' ');

  try {
    /* ── Staff: buat & ajukan ── */
    const s = await open('staff@qc.test');
    await s.goto(BASE + '/fund-requests');
    await snap(s, 'staff-list-empty', {
      create: s.getByRole('button', { name: 'Buat Permintaan' }).first(),
      stats: up(up(s.getByText('menunggu review', { exact: true }))).locator('xpath=..'),
      filters: up(up(s.getByRole('button', { name: 'Status', exact: true }))),
    });

    await s.getByRole('button', { name: 'Buat Permintaan' }).first().click();
    const f = () => s.getByRole('dialog', { name: 'Buat Permintaan Dana' });
    await f().getByRole('textbox', { name: 'Judul *' }).click();
    const head = () => ({
      sheet: f(),
      number: f().getByRole('textbox', { name: 'Nomor Permintaan *' }),
      title: f().getByRole('textbox', { name: 'Judul *' }),
      priority: f().getByRole('button', { name: 'Prioritas *' }),
      date: f().getByRole('button', { name: 'Dibutuhkan Sebelum *' }),
      purpose: f().getByRole('textbox', { name: 'Tujuan / Keterangan *' }),
      upload: up(f().getByText('Lampiran (opsional)', { exact: true })),
      draft: f().getByRole('button', { name: 'Simpan Draft' }),
      submit: f().getByRole('button', { name: 'Ajukan', exact: true }),
    });
    await snap(s, 'staff-form-empty', head());

    await f().getByRole('textbox', { name: 'Judul *' }).fill(TITLE);
    await snap(s, 'staff-form-title', head());

    await f().getByRole('button', { name: 'Prioritas *' }).click();
    await s.getByRole('option', { name: 'High' }).waitFor();
    await snap(s, 'staff-form-priority', { ...head(), option: s.getByRole('option', { name: 'High' }), list: s.getByRole('listbox') });
    await pick(s, s.getByRole('option', { name: 'High' }));

    await f().getByRole('button', { name: 'Dibutuhkan Sebelum *' }).click();
    const day = s.getByRole('button', { name: /, 16 Oktober 2026$/ });
    await day.waitFor();
    await snap(s, 'staff-form-date', { ...head(), day, calendar: s.getByRole('grid') });
    await pick(s, day);
    await snap(s, 'staff-form-dated', head());

    await f().getByRole('textbox', { name: 'Tujuan / Keterangan *' }).fill('Pelatihan e-Faktur untuk 25 staf klien PT Teknologi Maju Indonesia pada 16 Oktober: konsumsi peserta dan perlengkapan dokumen.');
    await snap(s, 'staff-form-purpose', head());

    await f().locator('input[type=file]').setInputFiles(FIX + 'fr-penawaran-konsumsi.jpg');
    await snap(s, 'staff-form-attach', head());

    const items = () => up(up(f().getByText('Item Biaya', { exact: true }))).locator('xpath=..');
    const item = (i) => ({
      name: f().getByRole('textbox', { name: 'Nama Item *' }).nth(i),
      category: f().getByRole('button', { name: 'Kategori *' }).nth(i),
      qty: f().getByRole('spinbutton', { name: 'Qty *' }).nth(i),
      price: f().getByRole('textbox', { name: 'Harga Satuan *' }).nth(i),
    });
    await f().getByRole('textbox', { name: 'Nama Item *' }).first().scrollIntoViewIfNeeded();
    await f().getByText('Item Biaya', { exact: true }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
    const itemTargets = (i) => ({
      ...item(i),
      items: items(),
      add: f().getByRole('button', { name: 'Tambah' }),
      total: f().getByText('Total Pengajuan:').locator('xpath=..'),
      badge: up(f().getByRole('button', { name: 'Tambah' })),
      draft: f().getByRole('button', { name: 'Simpan Draft' }),
      submit: f().getByRole('button', { name: 'Ajukan', exact: true }),
    });
    await snap(s, 'staff-form-items', itemTargets(0));
    await f().getByRole('textbox', { name: 'Nama Item *' }).first().fill('Snack box peserta pelatihan');
    await snap(s, 'staff-form-item1', itemTargets(0));

    await item(0).category.click();
    const makan = s.getByRole('option', { name: '↳ MAKAN MINUM' });
    await makan.waitFor();
    await makan.hover();
    await snap(s, 'staff-form-category', { ...itemTargets(0), option: makan, list: s.getByRole('listbox') });
    await pick(s, makan);
    await snap(s, 'staff-form-item1-cat', itemTargets(0));

    await item(0).qty.fill('25');
    await item(0).price.click();
    await s.keyboard.type('35000');
    await snap(s, 'staff-form-item1-done', itemTargets(0));

    await f().getByRole('button', { name: 'Tambah' }).click();
    await item(1).name.fill('Kertas A4 & map dokumen');
    await item(1).category.click();
    await pick(s, s.getByRole('option', { name: '↳ OPERASIONAL', exact: true }));
    await item(1).qty.fill('5');
    await item(1).price.click();
    await s.keyboard.type('62000');
    await f().getByText('Total Pengajuan:').scrollIntoViewIfNeeded();
    await snap(s, 'staff-form-item2', { ...itemTargets(1), item2: up(up(up(item(1).name))) });

    await f().getByRole('button', { name: 'Ajukan', exact: true }).click();
    await row(s, TITLE).first().waitFor();
    await s.waitForTimeout(800);
    log.push('after submit: ' + (await statusOf(s, TITLE)));
    await snap(s, 'staff-list-pending', { row: row(s, TITLE), status: row(s, TITLE).getByText('Pending Review') });

    // Permintaan kedua (untuk alur penolakan), tanpa screenshot.
    await s.getByRole('button', { name: 'Buat Permintaan' }).first().click();
    await f().getByRole('textbox', { name: 'Judul *' }).fill(TITLE2);
    await f().getByRole('button', { name: 'Dibutuhkan Sebelum *' }).click();
    await pick(s, s.getByRole('button', { name: /, 20 Oktober 2026$/ }));
    await f().getByRole('textbox', { name: 'Tujuan / Keterangan *' }).fill('Kunjungan audit dokumen pajak ke kantor cabang klien di Bandung, 2 hari.');
    await item(0).name.fill('Sewa mobil + sopir');
    await item(0).category.click();
    await pick(s, s.getByRole('option', { name: '↳ OPERASIONAL LUAR KOTA' }));
    await item(0).qty.fill('2');
    await item(0).price.click();
    await s.keyboard.type('750000');
    await f().getByRole('button', { name: 'Ajukan', exact: true }).click();
    await row(s, TITLE2).first().waitFor();
    await s.waitForTimeout(800);
    log.push('second: ' + (await statusOf(s, TITLE2)));

    /* ── Finance manager: review & cairkan ── */
    const m = await open('fm@qc.test', true);
    await m.goto(BASE + '/fund-requests');
    await row(m, TITLE).first().waitFor();
    await snap(m, 'fm-list', {
      tabs: m.getByRole('button', { name: 'Semua Pengajuan' }).locator('xpath=..'),
      stats: up(up(m.getByText('menunggu review', { exact: true }))).locator('xpath=..'),
      row: row(m, TITLE),
      review: row(m, TITLE).getByRole('button', { name: 'Review' }),
      requester: m.getByRole('button', { name: 'Pemohon', exact: true }),
    });

    await row(m, TITLE).first().click();
    await top(m).getByRole('button', { name: 'Setujui' }).waitFor();
    await snap(m, 'fm-detail-pending', {
      dialog: top(m),
      items: up(up(top(m).getByText(/Item Biaya \(/))),
      attachment: top(m).getByRole('button', { name: /fr-penawaran/ }),
      approve: top(m).getByRole('button', { name: 'Setujui' }),
      reject: top(m).getByRole('button', { name: 'Tolak' }),
    });
    await top(m).getByRole('button', { name: 'Setujui' }).click();
    await top(m).getByRole('textbox', { name: 'Catatan Review' }).waitFor();
    await snap(m, 'fm-approve-empty', {});
    await top(m).getByRole('textbox', { name: 'Catatan Review' }).fill('Disetujui. Pakai katering Sari Rasa sesuai penawaran.');
    await snap(m, 'fm-approve', {
      dialog: top(m),
      notes: top(m).getByRole('textbox', { name: 'Catatan Review' }),
      confirm: top(m).getByRole('button', { name: 'Setujui', exact: true }),
    });
    await top(m).getByRole('button', { name: 'Setujui', exact: true }).click();
    await row(m, TITLE).getByRole('button', { name: 'Cairkan' }).waitFor();
    await snap(m, 'fm-list-approved', {
      row: row(m, TITLE),
      status: row(m, TITLE).getByText('Approved'),
      disburse: row(m, TITLE).getByRole('button', { name: 'Cairkan' }),
    });

    await row(m, TITLE).getByRole('button', { name: 'Cairkan' }).click();
    const dlg = () => m.getByRole('dialog', { name: 'Cairkan Dana' });
    await dlg().getByRole('button', { name: 'Rekening Bank *' }).waitFor();
    const dis = () => ({
      dialog: dlg(),
      summary: up(dlg().getByText('Total:')),
      bank: dlg().getByRole('button', { name: 'Rekening Bank *' }),
      date: dlg().getByRole('button', { name: 'Tanggal Pencairan *' }),
      notes: dlg().getByRole('textbox', { name: 'Catatan Pencairan' }),
      upload: up(dlg().locator('input[type=file]')),
      confirm: dlg().getByRole('button', { name: 'Cairkan Dana' }),
    });
    await dlg().getByRole('button', { name: 'Rekening Bank *' }).click();
    const bca = m.getByRole('option', { name: /BCA - Operasional/ });
    await bca.waitFor();
    await bca.hover();
    await snap(m, 'fm-disburse-bank', { ...dis(), option: bca, list: m.getByRole('listbox') });
    await pick(m, bca);
    await snap(m, 'fm-disburse-picked', dis());
    await dlg().getByRole('textbox', { name: 'Catatan Pencairan' }).fill('BCA 1012-0458');
    await snap(m, 'fm-disburse-noted', dis());
    await dlg().locator('input[type=file]').setInputFiles(FIX + 'fr-bukti-transfer.jpg');
    await snap(m, 'fm-disburse-filled', dis());
    await dlg().getByRole('button', { name: 'Cairkan Dana' }).click();
    await row(m, TITLE).getByText('Disbursed').waitFor();
    await m.waitForTimeout(600);
    await row(m, TITLE).first().click();
    await top(m).getByText('Pencairan', { exact: true }).waitFor();
    await top(m).getByText('Pencairan', { exact: true }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await snap(m, 'fm-detail-disbursed', {
      dialog: top(m),
      status: top(m).getByText('Disbursed'),
      disbursement: up(top(m).getByText('Pencairan', { exact: true })),
      items: up(up(top(m).getByText(/Item Biaya \(/))),
    });
    await m.keyboard.press('Escape');

    await row(m, TITLE2).first().click();
    await top(m).getByRole('button', { name: 'Tolak' }).click();
    await top(m).getByRole('textbox', { name: 'Catatan Review' }).waitFor();
    await snap(m, 'fm-reject-empty', {});
    await top(m).getByRole('textbox', { name: 'Catatan Review' }).fill('Pakai mobil kantor, tersedia di tanggal itu.');
    await snap(m, 'fm-reject', {
      dialog: top(m),
      notes: top(m).getByRole('textbox', { name: 'Catatan Review' }),
      confirm: top(m).getByRole('button', { name: 'Tolak', exact: true }),
    });
    await top(m).getByRole('button', { name: 'Tolak', exact: true }).click();
    await row(m, TITLE2).getByText('Rejected').waitFor();

    /* ── Staff: hasil ── */
    await s.goto(BASE + '/fund-requests?r=1');
    await row(s, TITLE2).first().waitFor();
    await snap(s, 'staff-list-final', {
      row1: row(s, TITLE),
      row2: row(s, TITLE2),
      edit: row(s, TITLE2).getByRole('button').first(),
    });
    await row(s, TITLE2).first().click();
    await top(s).getByText('Catatan Review').waitFor();
    await snap(s, 'staff-detail-rejected', {
      dialog: top(s),
      status: top(s).getByText('Rejected'),
      notes: up(top(s).getByText('Catatan Review')),
      edit: top(s).getByRole('button', { name: 'Edit' }),
    });

  } catch (e) {
    log.push('ERROR ' + e.message.split('\n')[0]);
    for (const [i, ctx] of contexts.entries()) for (const pg of ctx.pages()) await pg.screenshot({ path: OUT + `../debug-${i}.png` }).catch(() => {});
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
  return JSON.stringify({ log, shots });
}
