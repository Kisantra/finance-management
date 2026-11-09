/*
 * Ambil ulang screenshot tutorial Arus Kas (video/cash-flow/screens/*.webp, lewat to-webp.py) bila UI berubah.
 * 1. Server QC terisolasi (bukan DB perusahaan asli), mis. php artisan serve --env=<qc> --host=127.0.0.1 --port=8014.
 *    Akun (sandi "password"): fm@qc.test (finance manager) & admin@gmail.com (admin), anggota SATU perusahaan contoh hasil
 *    provisioning (template kategori lengkap, termasuk bagian Pendanaan) + seeder demo ClientSeeder, BankAccountSeeder,
 *    InvoiceSeeder, BankTransactionSeeder.
 * 2. Prasyarat data QC: sub-kategori pemasukan "Sewa Ruang Rapat" (induk Pendapatan Usaha (Tanpa Invoice), grup L/R
 *    dikosongkan); satu utang "Bank BRI" (LOAN-00001) beserta pembayaran pokok + bunganya di BCA - Operasional (baris
 *    pokok tampil hanya-lihat). Sub transfer "Antar Rekening Sendiri" (induk Transfer Internal) sudah dibuat seeder.
 * 3. Jalankan headless: Playwright MCP browser_run_code_unsafe (filename: video/capture/cash-flow.js) atau runner Node
 *    kecil yang memanggil fungsi ini dengan objek `page` dari chromium.launch({ headless: true }).
 * 4. python video/capture/to-webp.py cash-flow, lalu salin koordinat dari hasilnya ke video/cash-flow/shots.ts.
 * Skrip ini MENAMBAH 1 pemasukan, 2 pengeluaran (biaya + Setor PPN), dan 1 transfer di DB QC (tidak menghapus apa pun).
 * Jangan jalankan di DB utama. Screenshot terakhir diambil 9 Nov 2026 (fitur Jurnal: kotak Jurnal di formulir, rincian,
 * ubah, transfer, dan rincian hanya-lihat pokok utang — layar fm-*-journal dan fm-financing-locked-detail baru); 10 Nov 2026:
 * dialog Catat/Ubah satu kolom (Jumlah dulu) — layar dialog Catat/Ubah diambil ulang, jam browser dipatok 9 Nov 2026.
 * Jalankan SEBELUM video/capture/profit-loss.js (screenshot Laba Rugi di sini masih menampilkan "Sewa Ruang Rapat" belum diklasifikasi).
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8014';
  const OUT = 'D:/Laravel/finance-management/video/cash-flow/screens/';
  const FIX = 'D:/Laravel/finance-management/video/capture/fixtures/';
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
    await p.waitForLoadState('networkidle');
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
  const top = (p) => p.getByRole('dialog').filter({ hasNot: p.locator('[cmdk-root]') }).last();
  const up = (loc, n = 1) => loc.locator('xpath=' + Array(n).fill('..').join('/'));
  const label = (d, text) => d.getByText(text, { exact: true }).first();
  const pick = async (p, trigger, option) => {
    await trigger.click();
    const opt = p.getByRole('option', { name: option }).first();
    await opt.waitFor();
    await opt.click();
  };
  const journalOf = (d) => d.locator('section[aria-label="Jurnal"]');
  // Dialog dengan kotak Jurnal lebih tinggi dari layar 720: gulir isinya ke bawah agar Jurnal + tombol simpan terlihat.
  const toBottom = (d) => d.evaluate((el) => [el, ...el.querySelectorAll('*')].forEach((n) => { if (n.scrollHeight > n.clientHeight + 4) n.scrollTop = n.scrollHeight; }));
  const listTargets = (p, createName) => ({
    create: p.getByRole('button', { name: createName }),
    export: p.getByRole('button', { name: 'Export PDF' }),
    stats: up(p.getByText(/^(Pemasukan \(masuk Laba Rugi\)|Beban \(masuk Laba Rugi\)|Total Transfer)$/).first(), 4),
    filters: up(p.getByText('Rentang Tanggal', { exact: true }).first(), 2),
    table: p.locator('table').first(),
  });

  try {
    /* ── Finance manager: pemasukan ── */
    const m = await open('fm@qc.test');
    // Bagian yang sudah berhasil bisa dilewati saat mengulang setelah gagal (hindari data ganda): mis. ['income', 'expense'].
    // SAVE = false: isi form & ambil screenshot tanpa menyimpan (untuk mengambil ulang koordinat).
    const SKIP = [];
    const SAVE = true;
    if (!SKIP.includes('income')) {
    await m.goto(BASE + '/cash-flow/income');
    await m.locator('table').first().waitFor();
    await snap(m, 'fm-income-list', {
      ...listTargets(m, 'Input Pemasukan'),
      invoiceRow: m.locator('tbody tr').filter({ hasText: 'Invoice' }).first(),
      directRow: m.locator('tbody tr').filter({ hasText: 'Langsung' }).first(),
      sourceCol: m.locator('thead th').nth(2),
      rows: m.locator('tbody').first(),
      cards: up(m.getByText('Pemasukan (masuk Laba Rugi)', { exact: true }).first(), 3),
    });

    await m.getByRole('button', { name: 'Input Pemasukan' }).click();
    const incomeFields = () => ({
      dialog: top(m),
      account: up(label(top(m), 'Rekening *')),
      category: up(label(top(m), 'Kategori *'), 2),
      addCategory: top(m).getByRole('button', { name: 'Tambah' }),
      amount: up(label(top(m), 'Jumlah *')),
      date: up(label(top(m), 'Tanggal *')),
      description: up(label(top(m), 'Deskripsi *')),
      reference: up(label(top(m), 'Nomor Referensi')),
      upload: up(label(top(m), 'Lampiran Bukti')),
      save: top(m).getByRole('button', { name: 'Simpan Pemasukan' }),
      close: top(m).getByRole('button', { name: 'Tutup' }),
    });
    await top(m).getByRole('button', { name: 'Pilih kategori' }).waitFor();
    await m.waitForTimeout(500);
    await snap(m, 'fm-income-form-empty', incomeFields());

    // Dialog satu kolom (10 Nov 2026): Jumlah paling atas, lalu Tanggal | Rekening, lalu Kategori.
    await top(m).locator('input[type=text]').first().click();
    await m.keyboard.type('1500000');
    await snap(m, 'fm-income-form-amount', incomeFields());

    await top(m).getByRole('button', { name: 'Pilih kategori' }).click();
    await m.getByRole('option', { name: /Sewa Ruang Rapat/ }).waitFor();
    await m.getByRole('option', { name: /Sewa Ruang Rapat/ }).scrollIntoViewIfNeeded();
    await snap(m, 'fm-income-form-category', { ...incomeFields(), option: m.getByRole('option', { name: /Sewa Ruang Rapat/ }), list: m.getByRole('listbox') });
    await m.getByRole('option', { name: /Sewa Ruang Rapat/ }).click();

    await top(m).locator('textarea').fill('Sewa ruang rapat lantai 3 oleh PT Maju Bersama (2 hari)');
    await up(label(top(m), 'Nomor Referensi')).locator('input').fill('KW-SR-2610-07');
    await snap(m, 'fm-income-form-filled', incomeFields());
    // Kotak Jurnal (pratinjau) di bawah Tanggal: gulir isi dialog ke bawah — Jurnal + Simpan terlihat.
    await toBottom(top(m));
    await snap(m, 'fm-income-journal', { ...incomeFields(), journal: journalOf(top(m)) });

    if (SAVE) {
      await top(m).getByRole('button', { name: 'Simpan Pemasukan' }).click();
      await m.getByText('Pemasukan berhasil dicatat').first().waitFor();
      await snap(m, 'fm-income-saved', { ...incomeFields(), toast: m.getByText('Pemasukan berhasil dicatat').first() });
    }
    await top(m).getByRole('button', { name: 'Tutup' }).first().click(); // .first(): tombol X dialog juga bernama "Tutup"
    await m.goto(BASE + '/cash-flow/income?search=' + encodeURIComponent('Sewa ruang rapat'));
    await m.getByRole('row', { name: /Sewa ruang rapat lantai 3/ }).first().waitFor();
    await m.waitForTimeout(800);
    await snap(m, 'fm-income-list-after', {
      ...listTargets(m, 'Input Pemasukan'),
      row: m.getByRole('row', { name: /Sewa ruang rapat lantai 3/ }).first(),
    });

    await m.goto(BASE + '/cash-flow/income');
    await m.locator('tbody tr').filter({ hasText: 'Invoice' }).first().click();
    await top(m).getByText('Detail Pembayaran Invoice').waitFor();
    await snap(m, 'fm-income-payment-detail', {
      dialog: top(m),
      note: up(top(m).getByText(/Pembayaran ini terhubung dengan invoice/)),
      journal: journalOf(top(m)),
    });
    await top(m).getByRole('button', { name: 'Tutup' }).first().click();

    }
    if (!SKIP.includes('expense')) {
    /* ── Finance manager: pengeluaran ── */
    await m.goto(BASE + '/cash-flow/expenses');
    await m.locator('table').first().waitFor();
    await snap(m, 'fm-expense-list', listTargets(m, 'Input Pengeluaran'));

    await m.getByRole('button', { name: 'Input Pengeluaran' }).click();
    await top(m).getByRole('button', { name: 'Pilih kategori' }).waitFor();
    await m.waitForTimeout(500);
    const expenseFields = () => ({
      dialog: top(m),
      account: up(label(top(m), 'Rekening *')),
      category: up(label(top(m), 'Kategori *'), 2),
      amount: up(label(top(m), 'Jumlah *')),
      date: up(label(top(m), 'Tanggal *')),
      description: up(label(top(m), 'Deskripsi *')),
      reference: up(label(top(m), 'Nomor Referensi')),
      upload: up(label(top(m), 'Lampiran Bukti')),
      save: top(m).getByRole('button', { name: 'Simpan Pengeluaran' }),
    });
    await top(m).locator('input[type=text]').first().click();
    await m.keyboard.type('1250000');
    await top(m).getByRole('button', { name: 'Pilih kategori' }).click();
    await m.getByRole('option', { name: /Internet & Telepon/ }).waitFor();
    await m.getByRole('option', { name: /Internet & Telepon/ }).scrollIntoViewIfNeeded();
    await snap(m, 'fm-expense-form-category', { ...expenseFields(), option: m.getByRole('option', { name: /Internet & Telepon/ }), list: m.getByRole('listbox') });
    await m.getByRole('option', { name: /Internet & Telepon/ }).click();
    await top(m).locator('textarea').fill('Tagihan internet kantor Oktober 2026 (Nusanet 100 Mbps)');
    await up(label(top(m), 'Nomor Referensi')).locator('input').fill('NF-2610-08821');
    await top(m).locator('input[type=file]').setInputFiles(FIX + 'tagihan-internet.png');
    await snap(m, 'fm-expense-form-filled', expenseFields());
    await toBottom(top(m));
    await snap(m, 'fm-expense-journal', { ...expenseFields(), journal: journalOf(top(m)) });
    if (SAVE) {
      await top(m).getByRole('button', { name: 'Simpan Pengeluaran' }).click();
      await m.getByText('Pengeluaran berhasil dicatat').first().waitFor();
    }
    await top(m).getByRole('button', { name: 'Tutup' }).first().click(); // .first(): tombol X dialog juga bernama "Tutup"
    // Data QC dipakai bersama: cari transaksinya agar barisnya pasti terlihat di atas.
    await m.goto(BASE + '/cash-flow/expenses?search=' + encodeURIComponent('Tagihan internet kantor'));
    const expenseRow = () => m.getByRole('row', { name: /Tagihan internet kantor Oktober 2026/ }).first();
    await expenseRow().waitFor();
    await m.waitForTimeout(800);
    await snap(m, 'fm-expense-list-after', {
      ...listTargets(m, 'Input Pengeluaran'),
      row: expenseRow(),
      category: expenseRow().getByText('Internet & Telepon'),
    });

    await expenseRow().click();
    await top(m).getByText('Edit Pengeluaran').waitFor();
    await m.waitForTimeout(500);
    await toBottom(top(m));
    await snap(m, 'fm-expense-edit', {
      dialog: top(m),
      amount: up(label(top(m), 'Jumlah *')),
      category: up(label(top(m), 'Kategori *'), 2),
      attachment: up(label(top(m), 'Lampiran')),
      save: top(m).getByRole('button', { name: 'Simpan Perubahan' }),
      journal: journalOf(top(m)),
    });
    await m.keyboard.press('Escape');

    }
    if (!SKIP.includes('financing')) {
    /* ── Finance manager: pendanaan (Setor PPN) — grup terakhir pemilih kategori, tidak masuk Laba Rugi ── */
    await m.goto(BASE + '/cash-flow/expenses');
    await m.getByRole('button', { name: 'Input Pengeluaran' }).click();
    await top(m).getByRole('button', { name: 'Pilih kategori' }).waitFor();
    await m.waitForTimeout(500);
    const financeFields = () => ({
      dialog: top(m),
      account: up(label(top(m), 'Rekening *')),
      category: up(label(top(m), 'Kategori *'), 2),
      amount: up(label(top(m), 'Jumlah *')),
      description: up(label(top(m), 'Deskripsi *')),
      save: top(m).getByRole('button', { name: 'Simpan Pengeluaran' }),
    });
    await top(m).locator('input[type=text]').first().click();
    await m.keyboard.type('3300000');
    await top(m).getByRole('button', { name: 'Pilih kategori' }).click();
    const ppn = () => m.getByRole('option', { name: '↳ Setor PPN', exact: true });
    await ppn().waitFor();
    await ppn().scrollIntoViewIfNeeded();
    await snap(m, 'fm-financing-picker', {
      ...financeFields(),
      option: ppn(),
      list: m.getByRole('listbox'),
      section: m.getByText('Pendanaan · tidak masuk Laba Rugi', { exact: true }),
    });
    await ppn().click();
    await top(m).locator('textarea').fill('Setor PPN masa Oktober 2026');
    await up(label(top(m), 'Nomor Referensi')).locator('input').fill('NTPN-2611-0042');
    // Isian di bawah menggulir dialog satu kolom: kembalikan Kategori (penanda + petunjuk) ke atas layar.
    await up(label(top(m), 'Kategori *'), 2).evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await snap(m, 'fm-financing-filled', {
      ...financeFields(),
      hint: top(m).getByRole('note'),
      tag: top(m).getByText('Pendanaan', { exact: true }).first(),
    });
    // Jurnal pratinjau: Setor PPN → akun neraca "PPN Keluaran" (bukan beban).
    await toBottom(top(m));
    await snap(m, 'fm-financing-journal', { ...financeFields(), journal: journalOf(top(m)) });
    if (SAVE) {
      await top(m).getByRole('button', { name: 'Simpan Pengeluaran' }).click();
      await m.getByText('Pengeluaran berhasil dicatat').first().waitFor();
    }
    await top(m).getByRole('button', { name: 'Tutup' }).first().click();
    await m.goto(BASE + '/cash-flow/expenses?date_from=2026-11-01&date_to=2026-11-30');
    const ppnRow = () => m.getByRole('row', { name: /Setor PPN masa Oktober 2026/ }).first();
    const loanRow = () => m.getByRole('row', { name: /Pembayaran pokok pinjaman - Bank BRI/ }).first();
    await ppnRow().waitFor();
    await m.waitForTimeout(800);
    await snap(m, 'fm-financing-list', {
      cards: up(m.getByText('Beban (masuk Laba Rugi)', { exact: true }).first(), 3),
      financingCard: up(m.getByText('Pendanaan (tidak masuk Laba Rugi)', { exact: true }).first(), 2),
      totalCard: up(m.getByText('Total keluar', { exact: true }).first(), 2),
      row: ppnRow(),
      badge: ppnRow().locator('td').nth(3).getByText('Pendanaan', { exact: true }),
    });
    // Pokok utang dari modul Utang: hanya-lihat (gembok, tanpa centang) + tautan "kelola di Utang".
    await m.goto(BASE + '/cash-flow/expenses?search=' + encodeURIComponent('Pembayaran pokok pinjaman'));
    await loanRow().waitFor();
    await m.waitForTimeout(800);
    await snap(m, 'fm-financing-locked', {
      cards: up(m.getByText('Beban (masuk Laba Rugi)', { exact: true }).first(), 3),
      row: loanRow(),
      lock: loanRow().locator('td').first(),
      note: loanRow().getByText(/kelola di Utang/),
    });
    // Baris pokok membuka rincian HANYA-LIHAT beserta jurnalnya (tanpa tombol ubah/hapus).
    await loanRow().locator('td').nth(2).click();
    await top(m).getByText('Rincian Pengeluaran').waitFor();
    await m.waitForTimeout(500);
    await snap(m, 'fm-financing-locked-detail', {
      dialog: top(m),
      note: top(m).getByText(/kelola di Utang/),
      journal: journalOf(top(m)),
    });
    await m.keyboard.press('Escape');

    }
    if (!SKIP.includes('transfer')) {
    /* ── Finance manager: transfer ── */
    await m.goto(BASE + '/cash-flow/transfers');
    await m.getByRole('button', { name: 'Input Transfer' }).waitFor();
    if (SAVE) await snap(m, 'fm-transfer-list', listTargets(m, 'Input Transfer'));

    await m.getByRole('button', { name: 'Input Transfer' }).click();
    await top(m).getByRole('button', { name: 'Rekening Sumber *' }).waitFor();
    await m.waitForTimeout(500);
    const transferFields = () => ({
      dialog: top(m),
      flow: up(top(m).getByText('Dari', { exact: true }).first(), 3),
      from: up(label(top(m), 'Rekening Sumber *')),
      to: up(label(top(m), 'Rekening Tujuan *')),
      category: up(label(top(m), 'Kategori *')),
      date: up(label(top(m), 'Tanggal *')),
      amount: up(label(top(m), 'Jumlah Transfer *')),
      fee: up(label(top(m), 'Biaya Admin')),
      description: up(label(top(m), 'Deskripsi *')),
      proof: up(label(top(m), 'Bukti Transfer')),
      summary: up(top(m).getByText('Total Debit', { exact: true }).first(), 2),
      journal: journalOf(top(m)),
      submit: top(m).getByRole('button', { name: 'Lakukan Transfer' }),
    });
    await snap(m, 'fm-transfer-form-empty', transferFields());
    await pick(m, top(m).getByRole('button', { name: 'Rekening Sumber *' }), /BNI - Investasi/);
    await pick(m, top(m).getByRole('button', { name: 'Rekening Tujuan *' }), /BCA - Operasional/);
    await pick(m, top(m).getByRole('button', { name: 'Kategori *' }), /Antar Rekening Sendiri/);
    await snap(m, 'fm-transfer-form-accounts', transferFields());
    await up(label(top(m), 'Jumlah Transfer *')).locator('input').click();
    await m.keyboard.type('10000000');
    const fee = up(label(top(m), 'Biaya Admin')).locator('input');
    await fee.click();
    await fee.press('Control+A');
    await m.keyboard.type('6500');
    await up(label(top(m), 'Deskripsi *')).locator('input,textarea').first().fill('Tambah dana operasional Oktober');
    await snap(m, 'fm-transfer-form-filled', transferFields());
    // Form lebih tinggi dari layar: gulir isi dialog ke bawah agar ringkasan & tombol kirim terlihat.
    await top(m).evaluate((el) => [el, ...el.querySelectorAll('*')].forEach((n) => { if (n.scrollHeight > n.clientHeight + 4) n.scrollTop = n.scrollHeight; }));
    await snap(m, 'fm-transfer-form-submit', transferFields());
    if (!SAVE) {
      await m.keyboard.press('Escape');
    } else {
    await top(m).getByRole('button', { name: 'Lakukan Transfer' }).click();
    await m.getByText('Transfer berhasil dicatat').first().waitFor();
    const transferRow = () => m.getByRole('row', { name: /Tambah dana operasional Oktober/ }).first();
    await transferRow().first().waitFor();
    await m.waitForTimeout(800);
    await snap(m, 'fm-transfer-list-after', {
      ...listTargets(m, 'Input Transfer'),
      row: transferRow(),
      flowCell: transferRow().locator('td').nth(2),
      debitCell: transferRow().locator('td').nth(5),
    });
    await transferRow().first().click();
    await top(m).getByText('Edit Transfer').waitFor();
    await m.waitForTimeout(500);
    await toBottom(top(m));
    await snap(m, 'fm-transfer-detail', {
      dialog: top(m),
      sums: up(top(m).getByText('Biaya Admin', { exact: true }).first(), 3),
      edit: up(top(m).getByText('Edit Transfer', { exact: true }).first(), 2),
      save: top(m).getByRole('button', { name: 'Simpan Perubahan' }),
      journal: journalOf(top(m)),
    });
    await m.keyboard.press('Escape');
    }
    }
    if (!SKIP.includes('admin')) {
    /* ── Admin: hapus massal (dibatalkan) + jejak di modul lain (hanya membaca) ── */
    const a = await open('admin@gmail.com');
    await a.goto(BASE + '/cash-flow/expenses');
    const aRow = a.getByRole('row', { name: /Tagihan internet kantor Oktober 2026/ }).first();
    await aRow.waitFor();
    await aRow.getByRole('checkbox').click();
    await a.getByText('catatan dipilih').or(a.getByText('pengeluaran dipilih')).first().waitFor().catch(() => {});
    await snap(a, 'admin-expense-bulk', {
      row: aRow,
      checkbox: aRow.getByRole('checkbox'),
      bar: up(a.getByRole('button', { name: 'Hapus' }).last(), 2),
      remove: a.getByRole('button', { name: 'Hapus' }).last(),
    });

    await a.goto(BASE + '/cash-flow/income');
    const payRow = a.locator('tbody tr').filter({ hasText: 'Invoice' }).first();
    await payRow.waitFor();
    await payRow.getByRole('checkbox').click();
    await a.getByRole('button', { name: 'Hapus' }).last().click();
    await top(a).getByText(/Pembayaran terkait invoice/).waitFor();
    await snap(a, 'admin-income-delete-confirm', {
      dialog: top(a),
      text: top(a).getByText(/Pembayaran terkait invoice/),
      confirm: top(a).getByRole('button', { name: /^Hapus 1/ }),
      cancel: top(a).getByRole('button', { name: 'Batal' }),
    });
    await top(a).getByRole('button', { name: 'Batal' }).click();

    await a.goto(BASE + '/bank-accounts');
    await a.getByRole('button', { name: /BCA - Ope/ }).first().waitFor();
    await snap(a, 'admin-bank', {
      bca: a.getByRole('button', { name: /BCA - Ope/ }),
      bni: a.getByRole('button', { name: /BNI - Inv/ }),
    });

    await a.goto(BASE + '/reports/profit-loss');
    await a.getByText('Laba Bersih', { exact: true }).first().waitFor();
    await snap(a, 'admin-pl-top', {
      revenue: up(a.getByText('Total Pendapatan', { exact: true }).first(), 1),
      panel: up(a.getByText(/Perlu Diklasifikasi/).first(), 4),
      meetingRoom: a.getByText('Sewa Ruang Rapat', { exact: true }).first(),
    });
    const opex = a.getByText('Beban Operasional', { exact: true }).first();
    await opex.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await a.mouse.wheel(0, -80);
    await snap(a, 'admin-pl-opex', {
      heading: opex,
      line: a.getByText('Internet & Telepon', { exact: true }).first(),
      net: a.getByText('Laba Bersih', { exact: true }).first(),
    });
    }
  } catch (e) {
    log.push('ERROR ' + String(e).slice(0, 600));
  } finally {
    for (const ctx of contexts) await ctx.close().catch(() => {});
  }
  return JSON.stringify({ log, shots });
}
