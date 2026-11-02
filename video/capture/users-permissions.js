/*
 * Ambil ulang screenshot tutorial Pengguna & Izin (video/users-permissions/screens/*.webp) bila UI berubah.
 * 1. Server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8018
 * 2. Playwright MCP: browser_run_code_unsafe, filename: video/capture/users-permissions.js
 * 3. python video/capture/to-webp.py users-permissions, lalu salin koordinat ke video/users-permissions/shots.ts.
 * Skrip ini membuat pengguna "Budi Santoso" (staff) bila belum ada, dan peran sementara "auditor"
 * (dihapus lagi di akhir). Tidak mengubah izin peran bawaan. Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8018';
  const OUT = 'D:/Laravel/finance-management/video/users-permissions/screens/';
  const NEW_EMAIL = 'budi.santoso@kisantra.test';
  const NEW_PASSWORD = 'Kisantra2026';
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
  // Opsi Combobox di dalam dialog: klik mouse sungguhan (cek actionability Playwright gagal karena body pointer-events:none).
  const clickAt = async (p, loc) => {
    const b = await loc.first().boundingBox();
    await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  const parentOf = (loc) => loc.locator('xpath=..');
  const waitToastsGone = async (p) => {
    await p.locator('[data-sonner-toast]').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
  };

  try {
  /* ── Admin: daftar & tambah pengguna ── */
  const a = await open('admin@gmail.com');
  await a.goto(BASE + '/admin/users');
  const row = (name) => a.getByRole('row', { name: new RegExp(name) });
  const listTargets = () => ({
    create: a.getByRole('button', { name: 'Tambah Pengguna' }),
    stats: parentOf(parentOf(parentOf(a.getByText('Total Pengguna', { exact: true })))),
    filters: parentOf(parentOf(a.getByRole('button', { name: 'Peran', exact: true }))),
    search: a.getByPlaceholder('Cari nama, email, atau telepon...'),
    table: a.locator('table'),
    yogaRow: row('Yoga Saputra'),
    yogaEdit: row('Yoga Saputra').getByRole('button', { name: 'Edit pengguna' }),
    yogaDelete: row('Yoga Saputra').getByRole('button', { name: 'Hapus pengguna' }),
    dimasRow: row('Dimas Prasetyo'),
    dimasEdit: row('Dimas Prasetyo').getByRole('button', { name: 'Edit pengguna' }),
    dimasStatus: row('Dimas Prasetyo').getByText('Tidak Aktif'),
    adminRow: row('admin@gmail.com'),
    budiRow: row('Budi Santoso'),
  });

  // Hapus Budi lama (buatan skrip ini) agar bisa dibuat ulang lewat form.
  if (await row('Budi Santoso').count()) {
    await row('Budi Santoso').getByRole('button', { name: 'Hapus pengguna' }).click();
    await top(a).getByRole('button', { name: 'Hapus', exact: true }).click();
    await row('Budi Santoso').waitFor({ state: 'detached' });
    await waitToastsGone(a);
  }
  await snap(a, 'admin-users', listTargets());

  await a.getByRole('button', { name: 'Tambah Pengguna' }).first().click();
  const f = () => top(a);
  const fields = () => ({
    dialog: f(),
    name: f().getByRole('textbox', { name: 'Nama Lengkap *' }),
    email: f().getByRole('textbox', { name: 'Email *' }),
    phone: f().getByRole('textbox', { name: 'Nomor Telepon' }),
    status: parentOf(f().getByRole('button', { name: 'Aktif', exact: true })),
    role: f().getByRole('button', { name: /Pilih peran pengguna|^Staff$/ }),
    password: f().getByPlaceholder('Minimal 8 karakter'),
    confirm: f().getByPlaceholder('Ulangi kata sandi'),
    note: f().getByText('Pengguna baru otomatis terverifikasi'),
    submit: f().getByRole('button', { name: 'Tambah Pengguna' }),
  });
  await f().getByRole('textbox', { name: 'Nama Lengkap *' }).waitFor();
  await snap(a, 'admin-form-empty', fields());

  await f().getByRole('textbox', { name: 'Nama Lengkap *' }).fill('Budi Santoso');
  await snap(a, 'admin-form-name', fields());

  await f().getByRole('textbox', { name: 'Email *' }).fill(NEW_EMAIL);
  await f().getByRole('textbox', { name: 'Nomor Telepon' }).fill('0811-5402-7731');
  await snap(a, 'admin-form-contact', fields());

  await f().getByRole('button', { name: 'Pilih peran pengguna' }).click();
  await a.getByRole('option', { name: 'Staff' }).waitFor();
  await snap(a, 'admin-form-role', { ...fields(), option: a.getByRole('option', { name: 'Staff' }), list: a.getByRole('listbox') });
  if (!(await a.getByRole('option', { name: 'Staff' }).isVisible())) {
    await clickAt(a, f().getByRole('button', { name: 'Pilih peran pengguna' }));
    await a.getByRole('option', { name: 'Staff' }).waitFor();
  }
  await clickAt(a, a.getByRole('option', { name: 'Staff' }));

  await f().getByPlaceholder('Minimal 8 karakter').fill(NEW_PASSWORD);
  await f().getByPlaceholder('Ulangi kata sandi').fill(NEW_PASSWORD);
  await snap(a, 'admin-form-filled', fields());

  await f().getByRole('button', { name: 'Tambah Pengguna' }).click();
  await row('Budi Santoso').waitFor();
  await a.waitForTimeout(400);
  await snap(a, 'admin-users-created', { ...listTargets(), toast: a.locator('[data-sonner-toast]') });
  await waitToastsGone(a);

  /* Edit pengguna nonaktif (tidak disimpan). */
  await row('Dimas Prasetyo').getByRole('button', { name: 'Edit pengguna' }).click();
  await f().getByRole('textbox', { name: 'Nama Lengkap *' }).waitFor();
  await snap(a, 'admin-edit', {
    dialog: f(),
    status: parentOf(f().getByRole('button', { name: 'Tidak Aktif', exact: true })),
    role: f().getByRole('button', { name: 'Staff', exact: true }),
    password: f().getByPlaceholder('Kosongkan jika tidak diubah'),
    passwordSection: parentOf(parentOf(f().getByRole('heading', { name: 'Peran & Kata Sandi' }))),
    submit: f().getByRole('button', { name: 'Simpan Perubahan' }),
  });
  await f().getByRole('button', { name: 'Batal' }).click();
  await f().waitFor({ state: 'detached' }).catch(() => {});

  /* Konfirmasi hapus (dibatalkan). */
  await row('Yoga Saputra').getByRole('button', { name: 'Hapus pengguna' }).click();
  await top(a).getByRole('button', { name: 'Hapus', exact: true }).waitFor();
  await snap(a, 'admin-delete', {
    dialog: top(a),
    confirm: top(a).getByRole('button', { name: 'Hapus', exact: true }),
  });
  await top(a).getByRole('button', { name: 'Batal' }).click();

  /* ── Admin: izin & peran ── */
  await a.goto(BASE + '/admin/permissions');
  const roleBtn = (name) => a.getByRole('button', { name: new RegExp('^' + name, 'i') });
  const roleItem = (name) => a.locator('div.group.relative', { has: roleBtn(name) });
  const permTargets = () => ({
    create: a.getByRole('button', { name: 'Tambah Peran' }),
    stats: parentOf(parentOf(parentOf(a.getByText('Total Peran', { exact: true })))),
    roles: parentOf(parentOf(a.getByRole('heading', { name: 'Daftar Peran' }))),
    adminRole: roleItem('admin'),
    fmRole: roleItem('finance manager'),
    staffRole: roleItem('staff'),
    search: a.getByPlaceholder('Cari permission...'),
    revokeAll: a.getByRole('button', { name: 'Cabut Semua' }),
    grantAll: a.getByRole('button', { name: 'Beri Semua' }),
    firstGroup: a.getByRole('heading', { name: 'Bank-accounts' }).locator('xpath=../..'),
    moduleButtons: parentOf(a.getByRole('button', { name: 'Semua', exact: true }).first()),
    deleteBadge: a.getByTitle('Hapus permission').first(),
    firstPerm: a.locator('label').filter({ hasText: 'create bank-accounts' }),
  });
  await a.getByRole('heading', { name: 'Daftar Peran' }).waitFor();
  if (await roleBtn('auditor').count()) {
    await roleItem('auditor').getByTitle('Hapus peran').click();
    await top(a).getByRole('button', { name: 'Hapus Peran' }).click();
    await roleBtn('auditor').waitFor({ state: 'detached' });
    await waitToastsGone(a);
  }
  await snap(a, 'admin-perm', permTargets());

  await a.getByRole('button', { name: 'Tambah Peran' }).click();
  await top(a).getByRole('textbox', { name: 'Nama Peran *' }).waitFor();
  const roleForm = () => ({
    dialog: top(a),
    name: top(a).getByRole('textbox', { name: 'Nama Peran *' }),
    icons: parentOf(top(a).getByTitle('calculator')),
    icon: top(a).getByTitle('calculator'),
    submit: top(a).getByRole('button', { name: 'Tambah Peran' }),
  });
  await top(a).getByRole('textbox', { name: 'Nama Peran *' }).fill('Auditor');
  await snap(a, 'admin-role-name', roleForm());
  await top(a).getByTitle('calculator').click();
  await snap(a, 'admin-role-icon', roleForm());
  await top(a).getByRole('button', { name: 'Tambah Peran' }).click();
  await roleBtn('auditor').waitFor();
  await waitToastsGone(a);
  await roleBtn('auditor').click();
  await a.getByRole('heading', { name: 'auditor', level: 3 }).waitFor();
  await snap(a, 'admin-perm-auditor', {
    ...permTargets(),
    auditorRole: roleItem('auditor'),
    header: a.getByRole('heading', { name: 'auditor', level: 3 }).locator('xpath=../../..'),
  });

  await a.getByPlaceholder('Cari permission...').fill('invoices');
  const invGroup = () => a.getByRole('heading', { name: 'Invoices', exact: true }).locator('xpath=../..');
  await invGroup().waitFor();
  const searchTargets = () => ({
    search: a.getByPlaceholder('Cari permission...'),
    auditorRole: roleItem('auditor'),
    header: a.getByRole('heading', { name: 'auditor', level: 3 }).locator('xpath=../../..'),
    invHeader: invGroup(),
    invAll: invGroup().getByRole('button', { name: 'Semua', exact: true }),
    invNone: invGroup().getByRole('button', { name: 'None', exact: true }),
    invPerms: invGroup().locator('xpath=following-sibling::div[1]'),
    viewInvoices: a.locator('label').filter({ hasText: /^view invoices$/ }),
    viewCheckbox: a.locator('label').filter({ hasText: /^view invoices$/ }).getByRole('checkbox'),
  });
  await snap(a, 'admin-perm-search', searchTargets());

  await a.locator('label').filter({ hasText: /^view invoices$/ }).getByRole('checkbox').click();
  await a.waitForFunction(() => [...document.querySelectorAll('label')].some((l) => l.textContent.trim() === 'view invoices' && l.querySelector('[data-state=checked]')));
  await snap(a, 'admin-perm-toggled', searchTargets());

  await invGroup().getByRole('button', { name: 'Semua', exact: true }).click();
  await a.waitForFunction(() => [...document.querySelectorAll('label')].some((l) => l.textContent.trim() === 'delete invoices' && l.querySelector('[data-state=checked]')));
  await a.waitForTimeout(300);
  await snap(a, 'admin-perm-module', { ...searchTargets(), toast: a.locator('[data-sonner-toast]') });
  await waitToastsGone(a);

  /* Konfirmasi hapus peran (dijalankan di akhir untuk membersihkan peran sementara). */
  await a.getByPlaceholder('Cari permission...').fill('');
  await roleItem('auditor').getByTitle('Hapus peran').click();
  await top(a).getByRole('button', { name: 'Hapus Peran' }).waitFor();
  await snap(a, 'admin-role-delete', { dialog: top(a), confirm: top(a).getByRole('button', { name: 'Hapus Peran' }) });
  await top(a).getByRole('button', { name: 'Hapus Peran' }).click();
  await roleBtn('auditor').waitFor({ state: 'detached' });

  /* ── Finance manager: hanya melihat ── */
  const m = await open('fm@qc.test');
  await m.goto(BASE + '/admin/permissions');
  await m.getByRole('heading', { name: 'Daftar Peran' }).waitFor();
  await m.getByRole('button', { name: /^finance manager/i }).click();
  await snap(m, 'fm-perm', {
    header: m.getByRole('heading', { name: 'finance manager', level: 3 }).locator('xpath=../../..'),
    roles: parentOf(parentOf(m.getByRole('heading', { name: 'Daftar Peran' }))),
    firstGroup: m.getByRole('heading', { name: 'Bank-accounts' }).locator('xpath=../..'),
    firstPerm: m.locator('label').filter({ hasText: 'create bank-accounts' }),
    pageHeader: m.getByRole('heading', { name: 'Manajemen Peran & Permission' }),
    adminMenu: m.getByRole('button', { name: 'Administrasi' }),
    nav: m.locator('nav').first(),
  });

  /* ── Jejak: pengguna baru masuk dengan menu sesuai perannya ── */
  const b = await open(NEW_EMAIL, NEW_PASSWORD);
  await snap(b, 'new-user-dashboard', {
    nav: b.locator('nav').first(),
    account: b.getByRole('button', { name: /Akun: Budi Santoso/ }),
  });

  await a.goto(BASE + '/dashboard');
  await snap(a, 'admin-dashboard', {
    nav: a.locator('nav').first(),
    account: a.getByRole('button', { name: /Akun: Admin/ }),
  });

  } finally {
    for (const ctx of contexts) await ctx.close();
  }
  return JSON.stringify({ log, shots });
}
