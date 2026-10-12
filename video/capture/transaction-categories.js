/*
 * Ambil ulang screenshot tutorial Kategori Transaksi (video/transaction-categories/screens/*.webp) bila UI berubah.
 * 1. Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8013
 * 2. Jalankan video/capture/bank-accounts.js lebih dulu (membuat "Langganan Software" & "Biaya Langganan (lama)" + transaksinya).
 * 3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/transaction-categories.js
 * 4. python video/capture/to-webp.py transaction-categories, lalu salin koordinat ke video/transaction-categories/shots.ts.
 * Mengubah di DB QC (hanya data buatan skrip): membuat "Iklan Media Sosial", memberi "Langganan Software" grup Beban Operasional,
 * menghapus "Biaya Langganan (lama)" dengan memindahkan transaksinya ke "Langganan Software". Langkah yang sudah terjadi dilewati.
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
  const search = async (p, q) => {
    await p.goto(`${BASE}/transaction-categories?search=${encodeURIComponent(q)}`);
    await p.getByRole('heading', { name: 'Kategori Transaksi' }).waitFor();
  };

  try {
    const m = await open('fm@qc.test');
    await m.goto(BASE + '/transaction-categories');
    const list = () => ({
      create: m.getByRole('button', { name: 'Tambah Kategori' }),
      tutorial: m.getByRole('button', { name: 'Tutorial' }),
      stats: m.getByText('Total Kategori').locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
      unclassifiedStat: m.getByText('Belum Diklasifikasi', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]'),
      search: m.getByPlaceholder('Cari kategori...'),
      type: m.getByRole('button', { name: 'Semua Tipe' }),
      unclassified: m.getByRole('button', { name: 'Belum diklasifikasi' }),
      table: m.getByRole('table'),
      head: m.getByRole('table').locator('thead'),
      firstRow: m.getByRole('table').locator('tbody tr').first(),
      subRow: m.getByRole('row', { name: /MAKAN MINUM/ }),
    });
    await snap(m, 'fm-list', list());

    await m.getByRole('button', { name: 'Belum diklasifikasi' }).click();
    await m.waitForURL(/pl_status=unclassified/);
    await m.getByPlaceholder('Cari kategori...').fill('Langganan');
    await m.waitForURL(/search=Langganan/);
    await snap(m, 'fm-unclassified', {
      ...list(),
      software: row(m, /Langganan Software/),
      old: row(m, /Biaya Langganan/),
      softwareUsage: row(m, /Langganan Software/).getByText(/pemakaian/),
      softwareGroup: row(m, /Langganan Software/).locator('td').nth(3),
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
    await pick(m, top(m).getByLabel('Parent Kategori (opsional)'), 'Operational Expenses');
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
    await row(m, /Langganan Software/).getByRole('button').first().click();
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
    await snap(m, 'fm-edit-saved', { ...list(), software: row(m, /Langganan Software/), group: row(m, /Langganan Software/).locator('td').nth(3) });

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
      await m.getByRole('option', { name: 'Operational Expenses → Langganan Software' }).waitFor();
      await snap(m, 'fm-reassign-options', { ...del(), listbox: m.getByRole('listbox'), option: m.getByRole('option', { name: 'Operational Expenses → Langganan Software' }), parentOption: m.getByRole('option', { name: 'Operational Expenses', exact: true }) });
      await m.getByRole('option', { name: 'Operational Expenses → Langganan Software' }).click();
      await snap(m, 'fm-reassign-filled', del());
      await top(m).getByRole('button', { name: 'Pindahkan & Hapus' }).click();
      await m.getByText('Kategori berhasil dihapus.').first().waitFor();
      await noToast(m);
    } else {
      log.push('Biaya Langganan (lama) sudah dihapus: fm-reassign* dilewati');
    }
    await search(m, 'Langganan');
    await snap(m, 'fm-reassigned', { ...list(), software: row(m, /Langganan Software/), usage: row(m, /Langganan Software/).getByText(/pemakaian/) });

    /* Kategori utama yang masih punya sub: tombol hapus nonaktif + tooltip. */
    await search(m, 'Operational Expenses');
    const lock = row(m, /Operational Expenses/).locator('span[tabindex="0"]');
    await lock.hover();
    await m.getByRole('tooltip').first().waitFor();
    await snap(m, 'fm-parent-locked', { row: row(m, /Operational Expenses/), lock, tooltip: m.getByRole('tooltip').first() }, true);

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
    await a.getByRole('option', { name: /Langganan Software/ }).waitFor();
    await a.getByRole('option', { name: /Langganan Software/ }).scrollIntoViewIfNeeded();
    await snap(a, 'admin-picker', {
      trigger,
      listbox: a.getByRole('listbox'),
      parentOption: a.getByRole('option', { name: 'Operational Expenses', exact: true }),
      option: a.getByRole('option', { name: /Langganan Software/ }),
    });

    return JSON.stringify({ log, shots });
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
}
