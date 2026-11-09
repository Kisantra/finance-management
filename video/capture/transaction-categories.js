/*
 * Ambil ulang screenshot tutorial Kategori Transaksi (video/transaction-categories/screens/*.webp) bila UI berubah.
 * 1. Server QC terisolasi (bukan DB perusahaan asli), mis. php artisan serve --env=<qc> --host=127.0.0.1 --port=8013.
 *    Akun (sandi "password"), masing-masing anggota SATU perusahaan QC sehingga alamat tanpa /c/{slug} dialihkan otomatis:
 *    - fm@qc.test (finance manager) & admin@gmail.com (admin): perusahaan contoh hasil provisioning (sudah berisi template).
 *    - fm.lama@qc.test (finance manager): perusahaan contoh "lama" yang kategorinya dibuat sebelum template ada
 *      (mis. induk "beban kantor" + sub "Listrik", sub "Internet & Telepon" di induk lain, induk datar "Beban Pemasaran"
 *      yang dipakai langsung satu transaksi). Bagian Pakai Template mengambil layarnya dari sini.
 * 2. Jalankan video/capture/bank-accounts.js lebih dulu (membuat "Langganan Software" & "Biaya Langganan (lama)" + transaksinya).
 * 3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/transaction-categories.js
 * 4. python video/capture/to-webp.py transaction-categories, lalu salin koordinat ke video/transaction-categories/shots.ts.
 * Mengubah di DB QC (hanya data buatan skrip): membuat "Iklan Media Sosial", memberi "Langganan Software" grup Beban Operasional,
 * menghapus "Biaya Langganan (lama)" dengan memindahkan transaksinya ke "Langganan Software", dan menerapkan template di
 * perusahaan "lama". Langkah yang sudah terjadi dilewati.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8013';
  const OUT = 'D:/Laravel/finance-management/video/transaction-categories/screens/';
  const browser = page.context().browser();
  const shots = {};
  const log = [];
  const contexts = [];

  const open = async (email) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
    contexts.push(ctx);
    // Vite HMR milik dev server bersama bisa memuat ulang halaman di tengah pengisian form: putuskan websocket-nya.
    await ctx.routeWebSocket(/.*/, () => {});
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
  const settle = async (p, keepMouse) => {
    await p.waitForLoadState('networkidle');
    await p.evaluate(() => document.fonts.ready);
    if (!keepMouse) {
      await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
      await p.mouse.move(0, 719);
    }
    await p.waitForTimeout(400);
  };
  const box = async (loc) => {
    const b = await loc.first().boundingBox().catch(() => null);
    return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
  };
  const snap = async (p, name, targets = {}, keepMouse = false) => {
    await settle(p, keepMouse);
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
  const pick = async (p, trigger, option) => {
    await trigger.click();
    const opt = p.getByRole('option', { name: option }).first();
    await opt.waitFor();
    await opt.click();
  };
  const noToast = (p) => p.locator('[data-sonner-toast]').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  const row = (p, name) => p.getByRole('row', { name }).first();
  // Template punya "Langganan Software & Aplikasi": tanpa lookahead/exact, baris & opsinya ikut cocok.
  const SOFTWARE = /Langganan Software(?! &)/;
  const search = async (p, q) => {
    await p.goto(`${BASE}/transaction-categories?search=${encodeURIComponent(q)}`);
    await p.getByRole('heading', { name: 'Kategori Transaksi' }).waitFor();
  };

  try {
    const m = await open('fm@qc.test');
    await m.goto(BASE + '/transaction-categories');
    const list = () => ({
      create: m.getByRole('button', { name: 'Tambah Kategori' }),
      template: m.getByRole('button', { name: 'Pakai Template' }),
      tutorial: m.getByRole('button', { name: 'Tutorial' }),
      stats: m.getByText('Total Kategori').locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
      unclassifiedStat: m.getByText('Belum Diklasifikasi', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]'),
      search: m.getByPlaceholder('Cari kategori...'),
      type: m.getByRole('button', { name: 'Semua Tipe' }),
      unclassified: m.getByRole('button', { name: 'Belum diklasifikasi' }),
      table: m.getByRole('table'),
      head: m.getByRole('table').locator('thead'),
      firstRow: m.getByRole('table').locator('tbody tr').first(),
      subRow: m.getByRole('row', { name: /Gaji Karyawan/ }),
    });
    await snap(m, 'fm-list', list());

    await m.getByRole('button', { name: 'Belum diklasifikasi' }).click();
    await m.waitForURL(/pl_status=unclassified/);
    await m.getByPlaceholder('Cari kategori...').fill('Langganan');
    await m.waitForURL(/search=Langganan/);
    await snap(m, 'fm-unclassified', {
      ...list(),
      software: row(m, SOFTWARE),
      old: row(m, /Biaya Langganan/),
      softwareUsage: row(m, SOFTWARE).getByText(/pemakaian/),
      softwareGroup: row(m, SOFTWARE).locator('td').nth(3),
    });

    /* ── Tambah kategori (bertahap) ── */
    await search(m, 'Iklan Media Sosial');
    const iklanExists = (await m.getByRole('row', { name: /Iklan Media Sosial/ }).count()) > 0;
    await m.goto(BASE + '/transaction-categories');
    await m.getByRole('button', { name: 'Tambah Kategori' }).click();
    await top(m).getByText('Tipe *').waitFor();
    const form = () => ({
      dialog: top(m),
      type: parentOf(top(m).getByRole('button', { name: 'Pemasukan', exact: true })),
      expense: top(m).getByRole('button', { name: 'Pengeluaran', exact: true }),
      name: top(m).getByLabel('Nama Kategori *'),
      plGroup: top(m).getByLabel('Grup Laba Rugi (opsional)'),
      parent: top(m).getByLabel('Parent Kategori (opsional)'),
      submit: top(m).getByRole('button', { name: /Simpan Kategori|Perbarui Kategori/ }),
    });
    await snap(m, 'fm-form-empty', form());
    await top(m).getByRole('button', { name: 'Pengeluaran', exact: true }).click();
    await top(m).getByLabel('Grup Laba Rugi (opsional)').waitFor();
    await snap(m, 'fm-form-type', form());
    await top(m).getByLabel('Nama Kategori *').fill('Iklan Media Sosial');
    await snap(m, 'fm-form-name', form());
    await top(m).getByLabel('Grup Laba Rugi (opsional)').click();
    await m.getByRole('option', { name: 'Beban Operasional' }).waitFor();
    await snap(m, 'fm-form-plgroup', { ...form(), listbox: m.getByRole('listbox'), option: m.getByRole('option', { name: 'Beban Operasional' }) });
    await m.getByRole('option', { name: 'Beban Operasional' }).click();
    await pick(m, top(m).getByLabel('Parent Kategori (opsional)'), 'Beban Pemasaran');
    await snap(m, 'fm-form-filled', form());
    if (!iklanExists) {
      await top(m).getByRole('button', { name: 'Simpan Kategori' }).click();
      await m.getByText('Kategori berhasil ditambahkan.').first().waitFor();
    } else {
      log.push('Iklan Media Sosial sudah ada: tidak disimpan ulang');
      await top(m).getByRole('button', { name: 'Batal' }).click();
    }
    await noToast(m);
    await search(m, 'Iklan Media Sosial');
    await snap(m, 'fm-created', { ...list(), created: row(m, /Iklan Media Sosial/), group: row(m, /Iklan Media Sosial/).locator('td').nth(3), parentCell: row(m, /Iklan Media Sosial/).locator('td').nth(2) });

    /* Hapus kategori yang belum dipakai: tampilkan konfirmasi saja (Batal). */
    await row(m, /Iklan Media Sosial/).getByRole('button').nth(1).click();
    await top(m).getByRole('heading', { name: 'Hapus Kategori' }).waitFor();
    await snap(m, 'fm-delete-simple', { dialog: top(m), confirm: top(m).getByRole('button', { name: 'Hapus', exact: true }) });
    await top(m).getByRole('button', { name: 'Batal' }).click();

    /* ── Edit: beri Grup Laba Rugi untuk "Langganan Software" ── */
    await search(m, 'Langganan Software');
    await row(m, SOFTWARE).getByRole('button').first().click();
    await top(m).getByText('Edit Kategori').waitFor();
    const classified = (await top(m).getByLabel('Grup Laba Rugi (opsional)').innerText()).includes('Beban Operasional');
    await snap(m, 'fm-edit', form());
    if (!classified) {
      await pick(m, top(m).getByLabel('Grup Laba Rugi (opsional)'), 'Beban Operasional');
    }
    await snap(m, 'fm-edit-filled', form());
    if (!classified) {
      await top(m).getByRole('button', { name: 'Perbarui Kategori' }).click();
      await m.getByText('Kategori berhasil diperbarui.').first().waitFor();
    } else {
      log.push('Langganan Software sudah Beban Operasional');
      await top(m).getByRole('button', { name: 'Batal' }).click();
    }
    await noToast(m);
    await search(m, 'Langganan');
    await snap(m, 'fm-edit-saved', { ...list(), software: row(m, SOFTWARE), group: row(m, SOFTWARE).locator('td').nth(3) });

    /* ── Hapus + pindahkan: "Biaya Langganan (lama)" → "Langganan Software" ── */
    if ((await m.getByRole('row', { name: /Biaya Langganan/ }).count()) > 0) {
      await row(m, /Biaya Langganan/).getByRole('button').nth(1).click();
      await top(m).getByText('masih digunakan oleh').waitFor();
      const del = () => ({
        dialog: top(m),
        warning: top(m).getByText('masih digunakan oleh').locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]'),
        target: top(m).getByLabel('Pindahkan ke Kategori *'),
        confirm: top(m).getByRole('button', { name: 'Pindahkan & Hapus' }),
      });
      await snap(m, 'fm-reassign', del());
      await top(m).getByLabel('Pindahkan ke Kategori *').click();
      const target = m.getByRole('option', { name: 'Beban Administrasi & Umum → Langganan Software', exact: true });
      await target.waitFor();
      await snap(m, 'fm-reassign-options', { ...del(), listbox: m.getByRole('listbox'), option: target, parentOption: m.getByRole('option', { name: 'Beban Administrasi & Umum', exact: true }) });
      await target.click();
      await snap(m, 'fm-reassign-filled', del());
      await top(m).getByRole('button', { name: 'Pindahkan & Hapus' }).click();
      await m.getByText('Kategori berhasil dihapus.').first().waitFor();
      await noToast(m);
    } else {
      log.push('Biaya Langganan (lama) sudah dihapus: fm-reassign* dilewati');
    }
    await search(m, 'Langganan');
    await snap(m, 'fm-reassigned', { ...list(), software: row(m, SOFTWARE), usage: row(m, SOFTWARE).getByText(/pemakaian/) });

    /* Kategori utama yang masih punya sub: tombol hapus nonaktif + tooltip. */
    await search(m, 'Beban Kantor');
    const lock = row(m, /Beban Kantor/).locator('span[tabindex="0"]');
    await lock.hover();
    await m.getByRole('tooltip').first().waitFor();
    await snap(m, 'fm-parent-locked', { row: row(m, /Beban Kantor/), lock, tooltip: m.getByRole('tooltip').first() }, true);

    /* ── Admin: jejak di modul lain ── */
    const a = await open('admin@gmail.com');
    await a.goto(BASE + '/reports/profit-loss');
    const opexLine = a.getByText('Langganan Software').first();
    await opexLine.waitFor();
    await opexLine.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await snap(a, 'admin-pl', {
      line: parentOf(opexLine),
      lineText: opexLine,
      unclassified: a.getByText('Perlu Diklasifikasi').first().locator('xpath=ancestor::div[contains(@class,"rounded")][2]'),
    });

    await a.goto(BASE + '/cash-flow/expenses?search=Zoom%20Pro');
    const zrow = a.getByRole('row', { name: /Zoom Pro/ }).first();
    await zrow.waitFor();
    await snap(a, 'admin-expense-moved', { row: zrow, category: zrow.getByText('Langganan Software') });

    const bri = await (await a.request.get(BASE + '/api/bank-accounts')).json();
    const briId = bri.find((o) => o.label.startsWith('BRI - Proyek Klien')).value;
    await a.goto(`${BASE}/bank-accounts?account=${briId}`);
    await a.getByRole('heading', { name: 'Breakdown Kategori' }).waitFor();
    await a.getByRole('heading', { name: 'Breakdown Kategori' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await a.mouse.wheel(0, -100);
    await snap(a, 'admin-breakdown', {
      breakdown: a.getByRole('heading', { name: 'Breakdown Kategori' }).locator('xpath=ancestor::div[contains(@class,"rounded")][2]'),
      legend: a.getByText('Langganan Software').first(),
    });

    await a.getByRole('button', { name: 'Pengeluaran', exact: true }).click();
    await top(a).getByText('Catat Pengeluaran').waitFor();
    const trigger = parentOf(top(a).getByText('Kategori *', { exact: true })).locator('xpath=following-sibling::*[1]//button').first();
    await trigger.click();
    // Judul kelompok (kategori utama) di atas daftar; sub-sub kategorinya di bawahnya.
    const groupHeading = a.getByRole('listbox').getByText('Beban Administrasi & Umum', { exact: true }).first();
    await groupHeading.waitFor();
    await groupHeading.evaluate((el) => {
      let c = el.parentElement;
      while (c && !(c.scrollHeight > c.clientHeight + 2 && getComputedStyle(c).overflowY !== 'visible')) c = c.parentElement;
      c.scrollTop += el.getBoundingClientRect().top - c.getBoundingClientRect().top - 4;
    });
    // Kotak `trigger` diambil sebelum daftar dibuka: setelah terbuka, dialog terakhir adalah popover-nya.
    await snap(a, 'admin-picker', {
      listbox: a.getByRole('listbox'),
      group: groupHeading,
      option: a.getByRole('option', { name: '↳ Asuransi', exact: true }),
    });

    /* ── Pakai Template di perusahaan "lama" ── */
    const t = await open('fm.lama@qc.test');
    await t.goto(BASE + '/transaction-categories');
    await t.getByRole('button', { name: 'Pakai Template' }).click();
    const createBtn = () => top(t).getByRole('button', { name: /^Buat \d+ kategori$|^Tidak ada kategori baru$/ });
    await createBtn().waitFor();
    const scrollToGroup = (label) => top(t).getByText(label, { exact: true }).first().evaluate((el) => {
      const v = el.closest('[data-radix-scroll-area-viewport]');
      v.scrollTop += el.getBoundingClientRect().top - v.getBoundingClientRect().top - 12;
    });
    const tpl = () => ({
      dialog: top(t),
      intro: top(t).locator('ul').first(),
      summary: top(t).getByText('Sudah ada', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
      list: top(t).locator('[data-radix-scroll-area-viewport]'),
      create: createBtn(),
      cancel: top(t).getByRole('button', { name: 'Batal' }),
    });
    const groupCard = (label) => top(t).getByText(label, { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    const applied = (await createBtn().innerText()).startsWith('Tidak ada');
    await snap(t, 'fm-template', tpl());
    await scrollToGroup('Beban Kantor');
    await snap(t, 'fm-template-existing', { ...tpl(), group: groupCard('Beban Kantor'), note: top(t).getByText(/Sudah ada di grup/).first() });
    await scrollToGroup('Beban Pemasaran');
    await snap(t, 'fm-template-skipped', { ...tpl(), group: groupCard('Beban Pemasaran'), reason: top(t).getByText(/dipakai langsung/).first() });
    if (!applied) {
      await createBtn().click();
      await t.getByText(/kategori dibuat/).first().waitFor();
    } else {
      log.push('Template sudah diterapkan di perusahaan lama: fm-template-done diambil tanpa menerapkan ulang');
      await top(t).getByRole('button', { name: 'Batal' }).click();
    }
    await snap(t, 'fm-template-done', {
      template: t.getByRole('button', { name: 'Pakai Template' }),
      toast: t.locator('[data-sonner-toast]').first(),
      stats: t.getByText('Total Kategori').locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
    }, true);

    return JSON.stringify({ log, shots });
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
}
