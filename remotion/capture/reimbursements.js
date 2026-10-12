/*
 * Ambil ulang screenshot tutorial Reimbursement (remotion/reimbursements/screens/*.webp, lewat to-webp.py) bila UI berubah.
 * 1. Jalankan server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8001
 * 2. Jalankan file ini lewat Playwright MCP (browser_run_code_unsafe, filename: remotion/capture/reimbursements.js).
 * 3. python remotion/capture/to-webp.py, lalu salin koordinat dari hasilnya ke remotion/reimbursements/shots.ts.
 * Skrip ini membuat 2 pengajuan baru di DB QC (satu dibayar lunas, satu ditolak). Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8001';
  const OUT = 'D:/Laravel/finance-management/remotion/reimbursements/screens/';
  const FIX = 'D:/Laravel/finance-management/remotion/capture/fixtures/';
  const browser = page.context().browser();
  const shots = {};
  const log = [];

  const open = async (email) => {
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
  const drawer = (p) => p.getByRole('dialog').first();
  const parentOf = (loc) => loc.locator('xpath=..');
  const openDrawer = async (p, id) => {
    await p.goto(`${BASE}/reimbursements?open=${id}#reimbursement/${id}`);
    await drawer(p).getByRole('heading', { name: 'Riwayat' }).waitFor();
  };

  /* ── Staff: buat & ajukan ── */
  const s = await open('staff@qc.test');
  await s.goto(BASE + '/reimbursements');
  await snap(s, 'staff-list', {
    create: s.getByRole('button', { name: 'Buat pengajuan' }),
    summary: s.getByRole('region', { name: 'Ringkasan reimbursement' }),
    list: s.getByRole('region', { name: 'Daftar reimbursement' }),
    statusFilter: s.getByRole('group', { name: 'Filter status' }),
    firstRow: s.getByRole('region', { name: 'Daftar reimbursement' }).locator('tbody tr'),
  });

  await s.getByRole('button', { name: 'Buat pengajuan' }).first().click();
  const f = () => top(s);
  const fields = () => ({
    sheet: f(),
    title: f().locator('#rb-title'),
    amount: f().locator('input[type=text]').nth(1),
    date: f().getByRole('button', { name: 'Tanggal pengeluaran' }),
    category: f().getByRole('button', { name: 'Kategori', exact: true }),
    description: f().locator('#rb-description'),
    upload: parentOf(f().locator('input[type=file]')),
    draft: f().getByRole('button', { name: 'Simpan draft' }),
    submit: f().getByRole('button', { name: 'Ajukan', exact: true }),
  });
  await snap(s, 'staff-form-empty', fields());

  await f().locator('#rb-title').fill('Taksi ke kantor PT Sinar Jaya');
  await snap(s, 'staff-form-title', fields());

  await f().locator('input[type=text]').nth(1).click();
  await s.keyboard.type('185000');
  await snap(s, 'staff-form-amount', fields());

  await f().getByRole('button', { name: 'Kategori', exact: true }).click();
  await s.getByRole('option', { name: 'Transportasi' }).waitFor();
  await snap(s, 'staff-form-category', { ...fields(), option: s.getByRole('option', { name: 'Transportasi' }), list: s.getByRole('listbox') });
  await s.getByRole('option', { name: 'Transportasi' }).click();

  await f().locator('#rb-description').fill('Meeting penawaran proyek, pulang-pergi dari kantor.');
  await f().locator('input[type=file]').setInputFiles(FIX + 'struk-taksi.jpg');
  await snap(s, 'staff-form-filled', fields());

  await f().getByRole('button', { name: 'Ajukan', exact: true }).click();
  await s.waitForURL(/#reimbursement\/\d+/);
  const id1 = Number(s.url().match(/#reimbursement\/(\d+)/)[1]);
  await drawer(s).getByRole('heading', { name: 'Riwayat' }).waitFor();
  await snap(s, 'staff-drawer-pending', {
    drawer: drawer(s),
    status: drawer(s).getByText('Menunggu review').first(),
    metrics: parentOf(parentOf(drawer(s).getByText('Sudah dibayar', { exact: true }))),
    history: parentOf(drawer(s).getByRole('heading', { name: 'Riwayat' })),
    proof: parentOf(drawer(s).getByRole('button', { name: /Perbesar bukti/ })),
  });

  // Pengajuan kedua (untuk alur penolakan), dibuat cepat tanpa screenshot.
  await s.goto(BASE + '/reimbursements?create=1');
  await f().locator('#rb-title').fill('Makan siang dengan klien');
  await f().locator('input[type=text]').nth(1).click();
  await s.keyboard.type('275000');
  await f().getByRole('button', { name: 'Kategori', exact: true }).click();
  await s.getByRole('option').nth(1).click();
  await f().getByRole('button', { name: 'Ajukan', exact: true }).click();
  await s.waitForURL(/#reimbursement\/\d+/);
  const id2 = Number(s.url().match(/#reimbursement\/(\d+)/)[1]);

  /* ── Finance manager: review & bayar ── */
  const m = await open('fm@qc.test');
  await m.goto(BASE + '/reimbursements?status=pending');
  await snap(m, 'fm-list', {
    scope: m.getByRole('group', { name: 'Cakupan pengajuan' }),
    summary: m.getByRole('region', { name: 'Ringkasan reimbursement' }),
    statusFilter: m.getByRole('group', { name: 'Filter status' }),
    row: m.getByRole('row', { name: /Taksi ke kantor PT Sinar Jaya/ }),
  });

  await openDrawer(m, id1);
  await snap(m, 'fm-drawer-pending', {
    drawer: drawer(m),
    approve: drawer(m).getByRole('button', { name: 'Setujui' }),
    reject: drawer(m).getByRole('button', { name: 'Tolak' }),
    proof: parentOf(drawer(m).getByRole('button', { name: /Perbesar bukti/ })),
    metrics: parentOf(parentOf(drawer(m).getByText('Sudah dibayar', { exact: true }))),
  });

  await drawer(m).getByRole('button', { name: 'Setujui' }).click();
  await top(m).getByRole('button', { name: 'Kategori akuntansi' }).waitFor();
  const review = () => ({
    dialog: top(m),
    category: top(m).getByRole('button', { name: 'Kategori akuntansi' }),
    notes: top(m).locator('textarea'),
    confirm: top(m).getByRole('button', { name: 'Setujui', exact: true }),
  });
  await snap(m, 'fm-approve-empty', review());
  await top(m).getByRole('button', { name: 'Kategori akuntansi' }).click();
  const transportOpt = m.getByRole('option', { name: /OPERASIONAL$/ }).first();
  await transportOpt.waitFor();
  await transportOpt.click();
  await top(m).locator('textarea').fill('Sesuai struk, terima kasih.');
  await snap(m, 'fm-approve-filled', review());
  await top(m).getByRole('button', { name: 'Setujui', exact: true }).click();
  await drawer(m).getByRole('button', { name: 'Bayar' }).waitFor();
  await snap(m, 'fm-drawer-approved', {
    drawer: drawer(m),
    status: drawer(m).getByText('Disetujui').first(),
    pay: drawer(m).getByRole('button', { name: 'Bayar' }),
    history: parentOf(drawer(m).getByRole('heading', { name: 'Riwayat' })),
  });

  await drawer(m).getByRole('button', { name: 'Bayar' }).click();
  await top(m).getByRole('button', { name: 'Rekening sumber' }).waitFor();
  await top(m).getByRole('button', { name: 'Rekening sumber' }).click();
  await m.getByRole('option').first().click();
  await top(m).locator('#rb-pay-ref').fill('TRF-2026-1011');
  await snap(m, 'fm-pay', {
    dialog: top(m),
    account: top(m).getByText('Rekening sumber').locator('xpath=..'),
    date: top(m).getByText('Tanggal bayar').locator('xpath=..'),
    amount: top(m).getByText('Nominal', { exact: true }).locator('xpath=..'),
    reference: top(m).locator('#rb-pay-ref'),
    confirm: top(m).getByRole('button', { name: /Bayar lunas|Bayar sebagian/ }),
  });
  await top(m).getByRole('button', { name: /Bayar lunas/ }).click();
  await drawer(m).getByText('Lunas').first().waitFor();
  await m.waitForTimeout(600);
  await snap(m, 'fm-drawer-paid', {
    drawer: drawer(m),
    status: drawer(m).getByText('Lunas').first(),
    metrics: parentOf(parentOf(drawer(m).getByText('Sudah dibayar', { exact: true }))),
    history: parentOf(drawer(m).getByRole('heading', { name: 'Riwayat' })),
  });

  await openDrawer(m, id2);
  await drawer(m).getByRole('button', { name: 'Tolak' }).click();
  await top(m).locator('textarea').waitFor();
  await top(m).locator('textarea').fill('Lampirkan struk asli dari restoran.');
  await snap(m, 'fm-reject', {
    dialog: top(m),
    notes: top(m).locator('textarea'),
    confirm: top(m).getByRole('button', { name: 'Tolak pengajuan' }),
  });
  await top(m).getByRole('button', { name: 'Tolak pengajuan' }).click();
  await drawer(m).getByText('Ditolak').first().waitFor();

  /* ── Staff: lihat penolakan ── */
  await openDrawer(s, id2);
  await snap(s, 'staff-drawer-rejected', {
    drawer: drawer(s),
    banner: parentOf(drawer(s).getByText('Lampirkan struk asli dari restoran.')),
    resubmit: drawer(s).getByRole('button', { name: 'Perbaiki & ajukan ulang' }),
    status: drawer(s).getByText('Ditolak').first(),
  });

  /* ── Admin: semua akses + hapus ── */
  const a = await open('admin@gmail.com');
  await a.goto(BASE + '/reimbursements');
  await snap(a, 'admin-list', {
    scope: a.getByRole('group', { name: 'Cakupan pengajuan' }),
    summary: a.getByRole('region', { name: 'Ringkasan reimbursement' }),
    list: a.getByRole('region', { name: 'Daftar reimbursement' }),
  });
  await openDrawer(a, id2);
  await drawer(a).getByRole('button', { name: 'Aksi lain' }).click();
  await a.getByRole('menuitem', { name: /Hapus pengajuan/ }).waitFor();
  await snap(a, 'admin-drawer-menu', {
    drawer: drawer(a),
    more: drawer(a).getByRole('button', { name: 'Aksi lain' }),
    menu: a.getByRole('menu'),
    remove: a.getByRole('menuitem', { name: /Hapus pengajuan/ }),
  });

  for (const ctx of browser.contexts()) if (ctx !== page.context()) await ctx.close();
  return JSON.stringify({ ids: [id1, id2], log, shots });
}
