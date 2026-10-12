/*
 * Ambil ulang screenshot tutorial Feedback (video/feedbacks/screens/*.webp, lewat to-webp.py) bila UI berubah.
 * 1. Jalankan server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8017
 * 2. Jalankan file ini lewat Playwright MCP (browser_run_code_unsafe, filename: video/capture/feedbacks.js).
 * 3. python video/capture/to-webp.py feedbacks, lalu salin koordinat dari hasilnya ke video/feedbacks/shots.ts.
 * Skrip ini membuat 2 feedback baru milik staff@qc.test di DB QC (satu Fitur ditanggapi "Diproses", satu Bug "Selesai")
 * beserta notifikasinya. Notifikasi staff sengaja dibiarkan belum dibaca untuk video/capture/notifications.js.
 * Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8017';
  const OUT = 'D:/Laravel/finance-management/video/feedbacks/screens/';
  const FIX = 'D:/Laravel/finance-management/video/capture/fixtures/';
  const browser = page.context().browser();
  const shots = {};
  const log = [];
  const contexts = [];

  const open = async (email, { showFloating = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
    contexts.push(ctx);
    // Server Vite dipakai bersama agent lain: putus HMR agar perubahan file lain tidak memuat ulang halaman di tengah capture.
    await ctx.routeWebSocket(/:5173/, () => {});
    ctx.setDefaultTimeout(60000);
    if (!showFloating) {
      await ctx.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          const s = document.createElement('style');
          s.textContent = 'button[aria-label="Kirim Feedback"]{display:none!important}';
          document.head.appendChild(s);
        });
      });
    }
    const p = await ctx.newPage();
    await p.goto(BASE + '/login');
    await p.locator('input[type=email]').fill(email);
    await p.locator('input[type=password]').fill('password');
    await p.getByRole('button', { name: 'Masuk ke Dasbor' }).click();
    await p.waitForURL(/dashboard/);
    return p;
  };
  const settle = async (p, { keepMouse = false } = {}) => {
    await p.waitForLoadState('networkidle');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
    if (!keepMouse) await p.mouse.move(0, 719);
    await p.waitForTimeout(300);
  };
  const box = async (loc) => {
    const b = await loc.first().boundingBox({ timeout: 1500 }).catch(() => null);
    return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
  };
  const snap = async (p, name, targets = {}, opts = {}) => {
    await settle(p, opts);
    await p.screenshot({ path: OUT + name + '.png' });
    const boxes = {};
    for (const [k, loc] of Object.entries(targets)) {
      boxes[k] = await box(loc);
      if (!boxes[k]) log.push(`${name}.${k} not found`);
    }
    shots[name] = boxes;
  };
  const top = (p) => p.getByRole('dialog').last();
  const field = (d, label) => d.getByText(label, { exact: true }).first().locator('xpath=..');
  const formTargets = (d) => ({
    dialog: d,
    type: field(d, 'Tipe *'),
    title: d.locator('input[type=text]').first(),
    description: d.locator('textarea').first(),
    priority: field(d, 'Prioritas *'),
    upload: d.locator('input[type=file]').locator('xpath=..'),
    submit: d.getByRole('button', { name: 'Kirim Feedback' }),
  });
  const card = (p, title) => p.getByRole('button', { name: new RegExp(title) });
  const showTargets = (p) => ({
    dialog: top(p),
    badges: top(p).getByRole('heading').first().locator('xpath=..'),
    description: top(p).getByText('Deskripsi', { exact: true }).locator('xpath=..'),
    pageUrl: top(p).getByText('URL halaman:').locator('xpath=..'),
    attachment: top(p).getByText('Lampiran', { exact: true }).locator('xpath=..'),
    response: top(p).getByText(/^Tanggapan dari/).locator('xpath=../..'),
    footer: top(p).getByRole('button', { name: 'Tutup' }).locator('xpath=..'),
    changeStatus: top(p).getByRole('button', { name: 'Ubah Status' }),
    respond: top(p).getByRole('button', { name: /^(Tanggapi|Edit Tanggapan)$/ }),
    edit: top(p).getByRole('button', { name: 'Edit', exact: true }),
    remove: top(p).getByRole('button', { name: 'Hapus', exact: true }),
  });

  const FEATURE = 'Ekspor arus kas ke Excel per bulan';
  const BUG = 'Nama klien terpotong di daftar invoice pada ponsel';

  try {
    /* ── Staff: kirim lewat tombol melayang (dari Ringkasan) ── */
    const s = await open('staff@qc.test', { showFloating: true });
    await s.goto(BASE + '/dashboard');
    await s.getByRole('region', { name: 'Arus Kas' }).first().waitFor();
    const floating = s.locator('button[aria-label="Kirim Feedback"]');
    await floating.hover();
    await s.waitForTimeout(500);
    await snap(s, 'staff-floating', { floating }, { keepMouse: true });

    // Lampiran contoh untuk feedback Bug: potongan layar Ringkasan.
    await s.screenshot({ path: FIX + 'feedback-tangkapan-layar.png', clip: { x: 292, y: 160, width: 946, height: 480 } });

    await floating.click();
    await top(s).locator('textarea').waitFor();
    await snap(s, 'staff-float-empty', formTargets(top(s)));
    await top(s).getByText('Fitur', { exact: true }).click();
    await snap(s, 'staff-float-type', formTargets(top(s)));
    await top(s).locator('input[type=text]').first().fill(FEATURE);
    await snap(s, 'staff-float-title', formTargets(top(s)));
    await top(s).locator('textarea').first().fill(
      'Setiap awal bulan kami menyalin transaksi Arus Kas ke Excel secara manual untuk laporan ke direksi. Mohon ada tombol ekspor per bulan beserta kategorinya.',
    );
    await snap(s, 'staff-float-filled', formTargets(top(s)));
    await top(s).getByRole('button', { name: 'Kirim Feedback' }).click();
    await s.getByText(/Feedback berhasil dikirim/).first().waitFor();
    await snap(s, 'staff-float-sent', { toast: s.getByText(/Feedback berhasil dikirim/).first().locator('xpath=ancestor::li[1]') });

    /* ── Staff: kirim lewat halaman Feedback (dengan lampiran) ── */
    await s.goto(BASE + '/feedbacks');
    await s.getByRole('heading', { name: 'Feedback & Saran' }).waitFor();
    const headerBtn = s.locator('main').getByRole('button', { name: 'Kirim Feedback' }).first();
    await snap(s, 'staff-list-one', {
      header: s.getByRole('heading', { name: 'Feedback & Saran' }).locator('xpath=../..'),
      create: headerBtn,
      tutorial: s.getByRole('button', { name: 'Tutorial' }),
      floating,
      card: card(s, FEATURE),
    });
    await headerBtn.click();
    await top(s).locator('textarea').waitFor();
    await top(s).getByText('Bug', { exact: true }).click();
    await top(s).locator('input[type=text]').first().fill(BUG);
    await top(s).locator('textarea').first().fill(
      'Di menu Invoice saat dibuka dari ponsel, nama klien yang panjang terpotong sehingga PT Sinar Jaya Abadi dan PT Sinar Jaya Mandiri tidak bisa dibedakan.',
    );
    await top(s).getByText('Tinggi', { exact: true }).click();
    await snap(s, 'staff-form-priority', formTargets(top(s)));
    await top(s).locator('input[type=file]').setInputFiles(FIX + 'feedback-tangkapan-layar.png');
    await top(s).locator('.max-h-\\[70vh\\]').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await snap(s, 'staff-form-filled', formTargets(top(s)));
    await top(s).getByRole('button', { name: 'Kirim Feedback' }).click();
    await card(s, BUG).waitFor();
    await snap(s, 'staff-list', {
      stats: s.getByText('Total', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
      filters: s.getByRole('button', { name: 'Semua tipe' }).locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
      cardBug: card(s, BUG),
      cardFeature: card(s, FEATURE),
    });

    await card(s, BUG).click();
    await top(s).getByText('Deskripsi', { exact: true }).waitFor();
    await snap(s, 'staff-show-open', showTargets(s));
    await top(s).getByRole('button', { name: 'Tutup' }).click();

    /* ── Finance manager: tinjau & tanggapi ── */
    const m = await open('fm@qc.test');
    await m.goto(BASE + '/feedbacks');
    await card(m, BUG).waitFor();
    await snap(m, 'fm-list', {
      tabs: m.getByRole('button', { name: 'Semua Feedback' }).locator('xpath=..'),
      stats: m.getByText('Total', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
      filters: m.getByRole('button', { name: 'Semua tipe' }).locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
      search: m.getByPlaceholder('Cari judul, deskripsi, atau pengirim...'),
      cardBug: card(m, BUG),
      cardFeature: card(m, FEATURE),
    });

    await card(m, FEATURE).click();
    await top(m).getByText('Deskripsi', { exact: true }).waitFor();
    await snap(m, 'fm-show', showTargets(m));

    await top(m).getByRole('button', { name: 'Tanggapi' }).click();
    await top(m).getByText('Status Baru *').waitFor();
    const respond = () => ({
      dialog: top(m),
      response: top(m).locator('textarea'),
      status: top(m).getByText('Status Baru *').locator('xpath=..'),
      submit: top(m).getByRole('button', { name: 'Kirim Tanggapan' }),
    });
    await snap(m, 'fm-respond-empty', respond());
    await top(m).locator('textarea').fill('Terima kasih, usulan ini masuk rencana rilis November. Kami kabari lagi bila sudah bisa dicoba.');
    await snap(m, 'fm-respond-text', respond());
    await top(m).getByText('Status Baru *').locator('xpath=..').getByRole('button').first().click();
    await m.getByRole('option', { name: 'Selesai' }).waitFor();
    await snap(m, 'fm-respond-status', { ...respond(), list: m.getByRole('listbox'), option: m.getByRole('option', { name: 'Sedang Diproses' }) });
    await m.getByRole('option', { name: 'Sedang Diproses' }).click();
    await top(m).getByRole('button', { name: 'Kirim Tanggapan' }).click();
    await top(m).getByText(/^Tanggapan dari/).waitFor();
    await m.waitForTimeout(600);
    await snap(m, 'fm-show-responded', showTargets(m));

    await top(m).getByRole('button', { name: 'Ubah Status' }).click();
    await m.getByRole('menuitem', { name: 'Selesai' }).waitFor();
    await snap(m, 'fm-status-menu', { ...showTargets(m), menu: m.getByRole('menu') });
    await m.keyboard.press('Escape');
    await m.waitForTimeout(300);
    await top(m).getByRole('button', { name: 'Tutup' }).click();

    // Bug: tanggapi langsung "Selesai" (tanpa screenshot).
    await card(m, BUG).click();
    await top(m).getByRole('button', { name: 'Tanggapi' }).click();
    await top(m).getByText('Status Baru *').waitFor();
    await top(m).locator('textarea').fill('Sudah diperbaiki: nama klien kini turun ke baris kedua di layar ponsel. Silakan dicek lagi.');
    await top(m).getByText('Status Baru *').locator('xpath=..').getByRole('button').first().click();
    await m.getByRole('option', { name: 'Selesai' }).click();
    await top(m).getByRole('button', { name: 'Kirim Tanggapan' }).click();
    await top(m).getByText(/^Tanggapan dari/).waitFor();
    await m.goto(BASE + '/feedbacks');
    await card(m, BUG).waitFor();
    await snap(m, 'fm-list-after', {
      stats: m.getByText('Total', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
      cardBug: card(m, BUG),
      cardFeature: card(m, FEATURE),
    });

    /* ── Staff: lihat tanggapan (tanpa membuka notifikasi) ── */
    await s.goto(BASE + '/feedbacks');
    await card(s, BUG).waitFor();
    await snap(s, 'staff-list-after', { cardBug: card(s, BUG), cardFeature: card(s, FEATURE), bell: s.getByRole('button', { name: 'Notifikasi' }) });
    await card(s, FEATURE).click();
    await top(s).getByText(/^Tanggapan dari/).waitFor();
    await snap(s, 'staff-show-responded', showTargets(s));

    /* ── Admin: daftar semua + notifikasi feedback baru ── */
    const a = await open('admin@gmail.com');
    await a.goto(BASE + '/feedbacks');
    await card(a, BUG).waitFor();
    await snap(a, 'admin-list', {
      tabs: a.getByRole('button', { name: 'Semua Feedback' }).locator('xpath=..'),
      stats: a.getByText('Total', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"grid")][1]'),
      cardBug: card(a, BUG),
      cardFeature: card(a, FEATURE),
      bell: a.getByRole('button', { name: 'Notifikasi' }),
    });
    await a.getByRole('button', { name: 'Notifikasi' }).click();
    await a.getByText('Lihat semua notifikasi').waitFor();
    await snap(a, 'admin-bell', {
      popover: a.getByText('Lihat semua notifikasi').locator('xpath=ancestor::*[@role="dialog"][1]'),
      first: a.getByRole('button', { name: /Feedback Baru/ }).first(),
    });
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
  return JSON.stringify({ log, shots });
}
