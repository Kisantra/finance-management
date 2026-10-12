/*
 * Ambil ulang screenshot tutorial Pengaturan (video/settings/screens/*.webp) bila UI berubah.
 * 1. Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8018
 * 2. Jalankan dulu video/capture/users-permissions.js (membuat pengguna staff "Budi Santoso").
 * 3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/settings.js
 * 4. python video/capture/to-webp.py settings, lalu salin koordinat ke video/settings/shots.ts.
 * Pengaturan global (profil perusahaan, penomoran invoice) TIDAK disimpan — hanya diisi untuk screenshot.
 * Template PDF contoh dibuat lalu dihapus lagi di akhir. Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8018';
  const OUT = 'D:/Laravel/finance-management/video/settings/screens/';
  const STAFF_EMAIL = 'budi.santoso@kisantra.test';
  const STAFF_PASSWORD = 'Kisantra2026';
  const TEMPLATE = 'Invoice Kisantra Modern';
  const INVOICE_ID = 13;
  const browser = page.context().browser();
  const shots = {};
  const log = [];
  const contexts = [];

  const open = async (email, password = 'password') => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
    contexts.push(ctx);
    await ctx.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = 'button[aria-label="Kirim Feedback"]{display:none!important}';
        document.head.appendChild(s);
      });
    });
    ctx.setDefaultTimeout(45000);
    // Putus HMR Vite: agent lain yang menyunting file memicu reload halaman di tengah capture.
    await ctx.routeWebSocket(/.*/, () => {});
    const p = await ctx.newPage();
    await p.goto(BASE + '/login');
    await p.waitForLoadState('networkidle');
    await p.locator('input[type=email]').fill(email);
    await p.locator('input[type=password]').fill(password);
    await p.getByRole('button', { name: 'Masuk ke Dasbor' }).click();
    await p.waitForURL(/dashboard/, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
  const snap = async (p, name, targets = {}, opts = {}) => {
    if (!opts.noSettle) await settle(p);
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
  const waitToastsGone = async (p) => {
    await p.locator('[data-sonner-toast]').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
  };
  const hubRow = (p, title) => p.getByRole('link', { name: new RegExp('^' + title) });
  const scrollTo = async (p, loc, offset = 90) => {
    // Halaman bergulir di kontainer <main>, bukan window: gulir ancestor terdekat yang bisa digulir.
    await loc.first().evaluate((el, off) => {
      let sc = el.parentElement;
      while (sc && !(sc.scrollHeight > sc.clientHeight && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      sc = sc || document.scrollingElement;
      sc.scrollTop += el.getBoundingClientRect().top - off;
    }, offset);
  };

  try {
  /* ── Staff: akun sendiri ── */
  const s = await open(STAFF_EMAIL, STAFF_PASSWORD);
  await s.getByRole('button', { name: /^Akun: / }).click();
  await s.getByRole('menuitem', { name: 'Pengaturan' }).waitFor();
  await snap(s, 'staff-menu', {
    account: s.getByRole('button', { name: /^Akun: / }),
    menu: s.getByRole('menu'),
    settings: s.getByRole('menuitem', { name: 'Pengaturan' }),
    company: s.getByRole('menuitem', { name: 'Profil perusahaan' }),
  });
  await s.getByRole('menuitem', { name: 'Pengaturan' }).click();
  await s.waitForURL(/\/settings$/);
  await s.getByRole('heading', { name: 'Pengaturan', level: 1 }).waitFor();
  await snap(s, 'staff-hub', {
    akun: s.locator('section', { has: s.getByRole('heading', { name: 'Akun', exact: true }) }),
    perusahaan: s.locator('section', { has: s.getByRole('heading', { name: 'Perusahaan', exact: true }) }),
    profile: hubRow(s, 'Profil'),
    password: hubRow(s, 'Kata sandi'),
    company: hubRow(s, 'Profil perusahaan'),
  });

  await hubRow(s, 'Profil').first().click();
  await s.getByRole('textbox', { name: 'Nama Lengkap *' }).waitFor();
  const profileTargets = () => ({
    back: s.getByRole('link', { name: 'Pengaturan' }).last(),
    name: s.getByRole('textbox', { name: 'Nama Lengkap *' }),
    email: s.getByRole('textbox', { name: 'Email *' }),
    save: s.getByRole('button', { name: 'Simpan Perubahan' }),
    saved: s.getByText('Tersimpan', { exact: true }),
    danger: parentOf(parentOf(parentOf(s.getByRole('heading', { name: 'Hapus Akun' })))),
    deleteBtn: s.getByRole('button', { name: 'Hapus Akun' }),
  });
  await snap(s, 'staff-profile', profileTargets());
  await s.getByRole('textbox', { name: 'Nama Lengkap *' }).fill('Budi Santoso Wibowo');
  await snap(s, 'staff-profile-name', profileTargets());
  await s.getByRole('button', { name: 'Simpan Perubahan' }).click();
  await s.getByText('Tersimpan', { exact: true }).waitFor();
  await snap(s, 'staff-profile-saved', { ...profileTargets(), account: s.getByRole('button', { name: /^Akun: / }) }, { noSettle: true });
  await waitToastsGone(s);

  await s.getByRole('button', { name: 'Hapus Akun' }).click();
  await top(s).getByRole('button', { name: 'Hapus Akun Saya' }).waitFor();
  await snap(s, 'staff-delete', {
    dialog: top(s),
    password: top(s).getByPlaceholder('Kata sandi saat ini'),
    confirm: top(s).getByRole('button', { name: 'Hapus Akun Saya' }),
  });
  await top(s).getByRole('button', { name: 'Batal' }).click();
  // Kembalikan nama agar skrip bisa diulang.
  await s.getByRole('textbox', { name: 'Nama Lengkap *' }).fill('Budi Santoso');
  await s.getByRole('button', { name: 'Simpan Perubahan' }).click();
  await s.getByText('Tersimpan', { exact: true }).waitFor();

  await s.goto(BASE + '/settings/password');
  const pw = (ph) => s.getByPlaceholder(ph);
  const pwTargets = () => ({
    current: pw('Kata sandi saat ini'),
    next: pw('Minimal 8 karakter'),
    confirm: pw('Ulangi kata sandi baru'),
    tip: s.getByText('Gunakan kombinasi huruf besar'),
    save: s.getByRole('button', { name: 'Perbarui Kata Sandi' }),
    saved: s.getByText('Tersimpan', { exact: true }),
  });
  await pw('Kata sandi saat ini').waitFor();
  await snap(s, 'staff-password', pwTargets());
  await pw('Kata sandi saat ini').fill(STAFF_PASSWORD);
  await snap(s, 'staff-password-current', pwTargets());
  // Kata sandi baru = sama (akun contoh tetap bisa dipakai ulang).
  await pw('Minimal 8 karakter').fill(STAFF_PASSWORD);
  await pw('Ulangi kata sandi baru').fill(STAFF_PASSWORD);
  await snap(s, 'staff-password-new', pwTargets());
  await s.getByRole('button', { name: 'Perbarui Kata Sandi' }).click();
  await s.getByText('Tersimpan', { exact: true }).waitFor();
  await snap(s, 'staff-password-saved', pwTargets(), { noSettle: true });

  /* ── Finance manager: penomoran invoice (tidak disimpan) ── */
  const m = await open('fm@qc.test');
  await m.goto(BASE + '/settings');
  await m.getByRole('heading', { name: 'Pengaturan', level: 1 }).waitFor();
  await snap(m, 'fm-hub', {
    invoice: m.locator('section', { has: m.getByRole('heading', { name: 'Invoice', exact: true }) }),
    numbering: hubRow(m, 'Penomoran invoice'),
  });
  await hubRow(m, 'Penomoran invoice').click();
  await m.locator('#invoice-number-format').waitFor();
  const seg = (label) => m.getByRole('radio', { name: label, exact: true });
  const numTargets = () => ({
    pattern: m.locator('#invoice-number-format'),
    patternField: parentOf(parentOf(m.locator('#invoice-number-format'))),
    tokens: m.getByRole('group', { name: 'Sisipkan token' }),
    tokenNo: m.getByRole('button', { name: /^Sisipkan \{NO\}/ }),
    tokenYear: m.getByRole('button', { name: /^Sisipkan \{THN\}/ }),
    padding: m.getByRole('radiogroup', { name: 'Jumlah digit nomor urut' }),
    digits4: seg('4 digit · 0001'),
    reset: m.getByRole('radiogroup', { name: 'Nomor kembali ke 1' }),
    yearly: seg('Tiap tahun'),
    preview: m.getByRole('complementary', { name: 'Pratinjau nomor' }),
    previewNumber: m.locator('[aria-live=polite]'),
    recent: parentOf(m.getByRole('heading', { name: 'Nomor terakhir yang terbit' })),
    save: m.getByRole('button', { name: 'Simpan', exact: true }),
    restore: m.getByRole('button', { name: 'Kembalikan default' }),
    note: m.getByText('Berlaku untuk invoice yang dikirim setelah disimpan'),
    error: m.locator('#invoice-number-format').locator('xpath=ancestor::div[2]').locator('p').last(),
  });
  await snap(m, 'fm-numbering', numTargets());
  await seg('4 digit · 0001').click();
  await snap(m, 'fm-numbering-digits', numTargets());
  await m.locator('#invoice-number-format').fill('INV-{PT}/{THN}/');
  await m.locator('#invoice-number-format').press('End');
  await m.getByRole('button', { name: /^Sisipkan \{NO\}/ }).click();
  await snap(m, 'fm-numbering-error', numTargets());
  await seg('Tiap tahun').click();
  await snap(m, 'fm-numbering-valid', numTargets());
  await scrollTo(m, m.getByRole('radiogroup', { name: 'Jumlah digit nomor urut' }), 120);
  await snap(m, 'fm-numbering-save', numTargets());
  // Tinggalkan halaman tanpa menyimpan.

  /* ── Admin: hub, profil perusahaan (tidak disimpan), template PDF ── */
  const a = await open('admin@gmail.com');
  await a.goto(BASE + '/settings');
  await a.getByRole('heading', { name: 'Pengaturan', level: 1 }).waitFor();
  await snap(a, 'admin-hub', {
    akun: a.locator('section', { has: a.getByRole('heading', { name: 'Akun', exact: true }) }),
    perusahaan: a.locator('section', { has: a.getByRole('heading', { name: 'Perusahaan', exact: true }) }),
    invoice: a.locator('section', { has: a.getByRole('heading', { name: 'Invoice', exact: true }) }),
    company: hubRow(a, 'Profil perusahaan'),
    numbering: hubRow(a, 'Penomoran invoice'),
    templates: hubRow(a, 'Template PDF'),
  });

  await hubRow(a, 'Profil perusahaan').click();
  await a.getByRole('textbox', { name: 'Nama Perusahaan *' }).waitFor();
  const section = (title) => parentOf(a.getByRole('heading', { name: title }).locator('xpath=..'));
  await snap(a, 'admin-company', {
    identity: section('Identitas Perusahaan'),
    name: a.getByRole('textbox', { name: 'Nama Perusahaan *' }),
    address: a.getByRole('textbox', { name: 'Alamat *' }),
  });
  await scrollTo(a, a.getByRole('heading', { name: 'Penanggung Jawab Keuangan' }), 24);
  await snap(a, 'admin-company-tax', {
    finance: section('Penanggung Jawab Keuangan'),
    tax: section('Status PKP & Pajak'),
    pkp: a.getByText('Pengusaha Kena Pajak (PKP)').locator('xpath=ancestor::label[1]'),
    ppn: a.getByRole('textbox', { name: /Tarif PPN/ }),
  });
  await scrollTo(a, a.getByRole('heading', { name: 'Aset Visual' }), 24);
  await snap(a, 'admin-company-assets', {
    assets: section('Aset Visual'),
    letterHead: a.getByRole('heading', { name: 'Kop Surat' }).locator('xpath=ancestor::div[3]'),
    signature: a.getByRole('heading', { name: 'Tanda Tangan' }).locator('xpath=ancestor::div[3]'),
    stamp: a.getByRole('heading', { name: 'Stempel' }).locator('xpath=ancestor::div[3]'),
    save: a.getByRole('button', { name: 'Simpan Perubahan' }),
  });

  await a.goto(BASE + '/settings/pdf-templates');
  await a.getByRole('heading', { name: 'Template PDF', level: 1 }).waitFor();
  // Sisa template contoh dari capture sebelumnya.
  while (await a.getByRole('row', { name: new RegExp(TEMPLATE) }).count()) {
    await a.getByRole('row', { name: new RegExp(TEMPLATE) }).first().getByRole('button').last().click();
    await a.getByRole('menuitem', { name: 'Hapus' }).click();
    await top(a).getByRole('button', { name: /Hapus/ }).last().click();
    await a.waitForTimeout(1500);
  }
  await snap(a, 'admin-templates-empty', {
    create: a.getByRole('button', { name: 'Template Baru' }),
    list: a.locator('main section').first(),
  });
  await a.getByRole('button', { name: 'Template Baru' }).click();
  await top(a).getByRole('textbox', { name: 'Nama Template *' }).fill(TEMPLATE);
  await top(a).getByRole('textbox', { name: 'Deskripsi' }).fill('Kop surat biru, tabel item ringkas');
  await snap(a, 'admin-template-new', {
    dialog: top(a),
    name: top(a).getByRole('textbox', { name: 'Nama Template *' }),
    description: top(a).getByRole('textbox', { name: 'Deskripsi' }),
    submit: top(a).getByRole('button', { name: 'Buat Template' }),
  });
  await top(a).getByRole('button', { name: 'Buat Template' }).click();
  await a.waitForURL(/pdf-templates\/\d+\/edit/);
  const templateId = Number(a.url().match(/pdf-templates\/(\d+)\/edit/)[1]);
  await a.getByRole('button', { name: 'Simpan' }).waitFor();
  await waitToastsGone(a);
  const editorTargets = () => ({
    back: a.getByRole('button', { name: /Kembali/ }).or(a.getByRole('link', { name: /Kembali/ })),
    tools: parentOf(a.getByTitle(/^Teks/)),
    text: a.getByTitle(/^Teks/),
    layers: a.getByText('Layers', { exact: true }).locator('xpath=ancestor::div[2]'),
    preview: a.getByTitle('Pratinjau PDF dengan N item'),
    pdf: a.getByTitle('Cetak PDF (data contoh)'),
    save: a.getByRole('button', { name: 'Simpan' }),
  });
  await snap(a, 'admin-editor', editorTargets());
  await a.getByTitle(/^Teks/).click();
  await a.waitForTimeout(600);
  await snap(a, 'admin-editor-text', editorTargets());
  await a.getByRole('button', { name: 'Simpan' }).click();
  await a.getByRole('button', { name: 'Simpan', exact: true }).waitFor();
  await a.waitForTimeout(800);
  await snap(a, 'admin-editor-saved', { ...editorTargets(), toast: a.locator('[data-sonner-toast]') });
  await waitToastsGone(a);

  await a.goto(BASE + '/settings/pdf-templates');
  const trow = () => a.getByRole('row', { name: new RegExp(TEMPLATE) });
  await trow().waitFor();
  await trow().getByRole('button').last().click();
  await a.getByRole('menuitem', { name: 'Jadikan Default' }).waitFor();
  await snap(a, 'admin-template-menu', {
    row: trow(),
    edit: trow().getByRole('button', { name: 'Edit' }),
    more: trow().getByRole('button').last(),
    menu: a.getByRole('menu'),
    setDefault: a.getByRole('menuitem', { name: 'Jadikan Default' }),
    duplicate: a.getByRole('menuitem', { name: 'Duplikat' }),
    remove: a.getByRole('menuitem', { name: 'Hapus' }),
  });
  await a.getByRole('menuitem', { name: 'Jadikan Default' }).click();
  await trow().getByText('Default', { exact: true }).waitFor();
  await snap(a, 'admin-template-default', {
    row: trow(),
    badge: trow().getByText('Default', { exact: true }),
    toast: a.locator('[data-sonner-toast]'),
  });
  await waitToastsGone(a);

  /* Jejak: template & profil perusahaan dipakai di dialog Cetak invoice. */
  await a.goto(`${BASE}/invoices/${INVOICE_ID}`);
  await a.getByRole('button', { name: 'Cetak' }).waitFor();
  await a.getByRole('button', { name: 'Cetak' }).click();
  await a.getByRole('radiogroup', { name: 'Template' }).waitFor();
  await a.waitForTimeout(6000);
  await snap(a, 'admin-print', {
    dialog: top(a),
    templates: a.getByRole('radiogroup', { name: 'Template' }),
    custom: a.getByRole('radio', { name: new RegExp(TEMPLATE) }),
    preview: top(a).locator('iframe, object, embed, canvas').first(),
  });

  /* Bersihkan: hapus template contoh (screenshot konfirmasinya dipakai di video). */
  await a.goto(BASE + '/settings/pdf-templates');
  await trow().waitFor();
  await trow().getByRole('button').last().click();
  await a.getByRole('menuitem', { name: 'Hapus' }).click();
  await top(a).getByRole('button', { name: /Hapus/ }).last().waitFor();
  await snap(a, 'admin-template-delete', { dialog: top(a), confirm: top(a).getByRole('button', { name: /Hapus/ }).last() });
  await top(a).getByRole('button', { name: /Hapus/ }).last().click();
  await trow().waitFor({ state: 'detached' });
  log.push('template ' + templateId + ' dibuat & dihapus');
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
  return JSON.stringify({ log, shots });
}
