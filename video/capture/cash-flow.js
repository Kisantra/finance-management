/*
 * Ambil ulang screenshot tutorial Arus Kas (video/cash-flow/screens/*.webp, lewat to-webp.py) bila UI berubah.
 * 1. Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8014
 * 2. Prasyarat data QC: sub-kategori transfer "Pindah Dana Antar Rekening" (induk Transfer Internal) dan sub-kategori
 *    pemasukan "Sewa Ruang Rapat" (induk Penghasilan, grup L/R kosong) — kategori transfer tanpa sub-kategori tidak bisa dipilih.
 * 3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/cash-flow.js
 * 4. python video/capture/to-webp.py cash-flow, lalu salin koordinat dari hasilnya ke video/cash-flow/shots.ts.
 * Skrip ini MENAMBAH 1 pemasukan, 1 pengeluaran, dan 1 transfer di DB QC (tidak menghapus apa pun). Jangan jalankan di DB utama.
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
  const listTargets = (p, createName) => ({
    create: p.getByRole('button', { name: createName }),
    export: p.getByRole('button', { name: 'Export PDF' }),
    stats: up(p.getByText(/^Total (Pemasukan|Pengeluaran|Transfer)$/).first(), 4),
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

    await top(m).getByRole('button', { name: 'Pilih kategori' }).click();
    await m.getByRole('option', { name: /Sewa Ruang Rapat/ }).waitFor();
    await snap(m, 'fm-income-form-category', { ...incomeFields(), option: m.getByRole('option', { name: /Sewa Ruang Rapat/ }), list: m.getByRole('listbox') });
    await m.getByRole('option', { name: /Sewa Ruang Rapat/ }).click();

    await top(m).locator('input[type=text]').first().click();
    await m.keyboard.type('1500000');
    await snap(m, 'fm-income-form-amount', incomeFields());

    await top(m).locator('textarea').fill('Sewa ruang rapat lantai 3 oleh PT Maju Bersama (2 hari)');
    await up(label(top(m), 'Nomor Referensi')).locator('input').fill('KW-SR-2610-07');
    await snap(m, 'fm-income-form-filled', incomeFields());

    if (SAVE) {
      await top(m).getByRole('button', { name: 'Simpan Pemasukan' }).click();
      await m.getByText('Pemasukan berhasil dicatat').first().waitFor();
      await snap(m, 'fm-income-saved', { ...incomeFields(), toast: m.getByText('Pemasukan berhasil dicatat').first() });
    }
    await top(m).getByRole('button', { name: 'Tutup' }).click();
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
    await top(m).getByRole('button', { name: 'Pilih kategori' }).click();
    await m.getByRole('option', { name: /OPEX BULANAN/ }).waitFor();
    await m.getByRole('option', { name: /OPEX BULANAN/ }).scrollIntoViewIfNeeded();
    await snap(m, 'fm-expense-form-category', { ...expenseFields(), option: m.getByRole('option', { name: /OPEX BULANAN/ }), list: m.getByRole('listbox') });
    await m.getByRole('option', { name: /OPEX BULANAN/ }).click();
    await top(m).locator('input[type=text]').first().click();
    await m.keyboard.type('1250000');
    await top(m).locator('textarea').fill('Tagihan internet kantor Oktober 2026 (Nusanet 100 Mbps)');
    await up(label(top(m), 'Nomor Referensi')).locator('input').fill('NF-2610-08821');
    await top(m).locator('input[type=file]').setInputFiles(FIX + 'tagihan-internet.png');
    await snap(m, 'fm-expense-form-filled', expenseFields());
    if (SAVE) {
      await top(m).getByRole('button', { name: 'Simpan Pengeluaran' }).click();
      await m.getByText('Pengeluaran berhasil dicatat').first().waitFor();
    }
    await top(m).getByRole('button', { name: 'Tutup' }).click();
    // Data QC dipakai bersama: cari transaksinya agar barisnya pasti terlihat di atas.
    await m.goto(BASE + '/cash-flow/expenses?search=' + encodeURIComponent('Tagihan internet kantor'));
    const expenseRow = () => m.getByRole('row', { name: /Tagihan internet kantor Oktober 2026/ }).first();
    await expenseRow().waitFor();
    await m.waitForTimeout(800);
    await snap(m, 'fm-expense-list-after', {
      ...listTargets(m, 'Input Pengeluaran'),
      row: expenseRow(),
      category: expenseRow().getByText('OPEX BULANAN'),
    });

    await expenseRow().click();
    await top(m).getByText('Edit Pengeluaran').waitFor();
    await m.waitForTimeout(500);
    await snap(m, 'fm-expense-edit', {
      dialog: top(m),
      amount: up(label(top(m), 'Jumlah *')),
      category: up(label(top(m), 'Kategori *'), 2),
      attachment: up(label(top(m), 'Lampiran')),
      save: top(m).getByRole('button', { name: 'Simpan Perubahan' }),
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
      submit: top(m).getByRole('button', { name: 'Lakukan Transfer' }),
    });
    await snap(m, 'fm-transfer-form-empty', transferFields());
    await pick(m, top(m).getByRole('button', { name: 'Rekening Sumber *' }), /BNI - Investasi/);
    await pick(m, top(m).getByRole('button', { name: 'Rekening Tujuan *' }), /BCA - Operasional/);
    await pick(m, top(m).getByRole('button', { name: 'Kategori *' }), /Pindah Dana Antar Rekening/);
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
    await snap(m, 'fm-transfer-detail', {
      dialog: top(m),
      sums: up(top(m).getByText('Biaya Admin', { exact: true }).first(), 3),
      edit: up(top(m).getByText('Edit Transfer', { exact: true }).first(), 2),
      save: top(m).getByRole('button', { name: 'Simpan Perubahan' }),
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
      line: a.getByText('OPEX BULANAN', { exact: true }).first(),
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
