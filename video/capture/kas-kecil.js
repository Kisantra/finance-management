/*
 * Ambil ulang screenshot panduan Kas Kecil (video/kas-kecil/screens/*.webp) bila UI berubah.
 * 1. DB QC terisolasi: `php artisan migrate:fresh --seed` (perusahaan demo Kisantra; KasBankSeeder membuat
 *    "Kas Kecil Kantor" plafon Rp 5.000.000 yang perlu isi ulang Rp 2.175.000, penanggung jawab Staf Uji),
 *    nama pengguna manager@gmail.com = "Fina Manager", staff@gmail.com = "Staf Uji".
 * 2. Server: php artisan serve --host=127.0.0.1 --port=8031.
 * 3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/kas-kecil.js (ubah ROOT bila perlu).
 * 4. python video/capture/to-webp.py kas-kecil, lalu salin koordinat hasilnya ke video/kas-kecil/shots.ts.
 * Skrip ini MENAMBAH akun kas "Kas Kecil Gudang" dan MENGISI ULANG Kas Kecil Kantor dari BCA - Operasional di DB QC.
 * Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8031';
  const COMPANY = 'kisantra';
  const ROOT = '/Users/alexjanuar/orca/workspaces/finance-management/nusa-lintas-armada/';
  const OUT = ROOT + 'video/kas-kecil/screens/';
  const url = (path) => `${BASE}/c/${COMPANY}${path}`;
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
        s.textContent = 'button[aria-label="Kirim Masukan"],[data-sonner-toaster]{display:none!important}';
        document.head.appendChild(s);
      });
    });
    const p = await ctx.newPage();
    await p.goto(BASE + '/login');
    await p.locator('input[type=email]').fill(email);
    await p.locator('input[type=password]').fill('password');
    await p.getByRole('button', { name: 'Masuk', exact: true }).click();
    // Anggota beberapa perusahaan diarahkan ke pemilih perusahaan; buka perusahaan contoh langsung.
    await p.waitForURL(/dashboard|choose-company/);
    await p.waitForLoadState('networkidle');
    return p;
  };
  const settle = async (p) => {
    await p.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => log.push('networkidle timeout'));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 6000 }).catch(() => log.push('animation timeout'));
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
  const up = (loc, n = 1) => loc.locator('xpath=' + Array(n).fill('..').join('/'));
  const typeMoney = async (p, loc, text) => {
    await loc.click();
    await p.keyboard.press('ControlOrMeta+A');
    await p.keyboard.type(text);
  };

  // Bagian yang sudah berhasil bisa dilewati saat mengulang setelah gagal (hindari data ganda): mis. ['new'].
  const SKIP = [];
  try {
    const m = await open('manager@gmail.com');
    await m.goto(url('/bank-accounts'));
    await m.getByRole('heading', { name: 'Akun', exact: true }).waitFor();
    const kasCard = () => m.getByRole('button', { name: /^Kas Kecil Kantor/ });
    const dlg = () => m.getByRole('dialog').last();
    if (!SKIP.includes('new')) {
    await snap(m, 'fm-list', {
      add: m.getByRole('button', { name: 'Tambah Akun' }).first(),
      accounts: up(m.getByRole('heading', { name: 'Akun', exact: true }), 2),
      kasCard: kasCard(),
      totals: up(m.getByRole('heading', { name: 'Ringkasan Total' }), 1),
    });

    /* ── Menambah kas kecil ── */
    await m.getByRole('button', { name: 'Tambah Akun' }).first().click();
    await dlg().getByRole('radiogroup', { name: /Jenis/ }).waitFor();
    await snap(m, 'fm-new-bank', { dialog: dlg(), type: dlg().getByRole('radiogroup', { name: /Jenis/ }), cash: dlg().getByRole('radio', { name: 'Kas' }) });
    await dlg().getByRole('radio', { name: 'Kas' }).click();
    await dlg().getByRole('heading', { name: 'Tambah Kas' }).waitFor();
    const cashTargets = () => ({
      dialog: dlg(),
      type: dlg().getByRole('radiogroup', { name: /Jenis/ }),
      name: dlg().getByRole('textbox', { name: /Nama Kas/ }),
      custodian: dlg().getByRole('button', { name: 'Penanggung Jawab' }),
      limit: dlg().getByRole('textbox', { name: 'Plafon' }),
      limitHint: dlg().getByText(/Batas saldo kas kecil/),
      opening: dlg().getByRole('textbox', { name: /Saldo Awal/ }),
      submit: dlg().getByRole('button', { name: 'Tambah Kas' }),
    });
    await snap(m, 'fm-new-cash', cashTargets());
    await dlg().getByRole('textbox', { name: /Nama Kas/ }).fill('Kas Kecil Gudang');
    await dlg().getByRole('button', { name: 'Penanggung Jawab' }).click();
    await m.getByRole('option', { name: /Staf Uji/ }).click();
    await typeMoney(m, dlg().getByRole('textbox', { name: 'Plafon' }), '3000000');
    await typeMoney(m, dlg().getByRole('textbox', { name: /Saldo Awal/ }), '0');
    await m.keyboard.press('Tab');
    await snap(m, 'fm-new-filled', cashTargets());
    await dlg().getByRole('button', { name: 'Tambah Kas' }).click();
    await m.getByRole('button', { name: /^Kas Kecil Gudang/ }).waitFor();
    }

    /* ── Mengisi ulang kas kecil ── */
    await kasCard().click();
    await m.getByRole('heading', { name: 'Kas Kecil Kantor', level: 2 }).waitFor();
    await m.waitForTimeout(500);
    const header = () => up(m.getByRole('heading', { name: 'Kas Kecil Kantor', level: 2 }), 3);
    await snap(m, 'fm-cash', {
      kasCard: kasCard(),
      header: header(),
      info: m.getByText(/^Plafon Rp/).first(),
      custodian: m.getByText(/Penanggung jawab:/).first(),
      refill: m.getByRole('button', { name: 'Isi ulang', exact: true }),
      expense: m.getByRole('button', { name: 'Pengeluaran', exact: true }).first(),
    });
    await m.getByRole('button', { name: 'Isi ulang', exact: true }).click();
    const tr = dlg();
    await tr.getByRole('heading').first().waitFor();
    await m.waitForTimeout(500);
    const source = tr.getByRole('button', { name: /^Rekening Sumber/ });
    await snap(m, 'fm-refill', {
      dialog: tr,
      source,
      target: tr.getByRole('button', { name: /^Rekening Tujuan/ }),
      amount: tr.getByRole('textbox', { name: /Jumlah/ }).first(),
      fee: tr.getByRole('textbox', { name: /Biaya Admin/ }).first(),
    });
    await source.click();
    await m.getByRole('option', { name: /BCA - Operasional/ }).click();
    await tr.getByRole('button', { name: /^Kategori/ }).click();
    await m.getByRole('option', { name: /Antar Rekening Sendiri/ }).first().click();
    const description = tr.getByRole('textbox', { name: /Deskripsi/ });
    if (!(await description.inputValue())) await description.fill('Isi ulang Kas Kecil Kantor');
    await m.waitForTimeout(400);
    await tr.locator('section[aria-label="Jurnal"]').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await m.waitForTimeout(300);
    const submit = tr.getByRole('button', { name: 'Lakukan Transfer' });
    await snap(m, 'fm-refill-filled', {
      dialog: tr,
      journal: tr.locator('section[aria-label="Jurnal"]'),
      description,
      submit,
    });
    await submit.click();
    await m.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 }).catch(() => log.push('transfer dialog still open'));
    await m.waitForTimeout(800);
    await m.getByRole('heading', { name: 'Kas Kecil Kantor', level: 2 }).waitFor();
    await snap(m, 'fm-refill-done', {
      kasCard: kasCard(),
      header: header(),
      info: m.getByText(/^Plafon Rp/).first(),
    });
  } catch (e) {
    log.push('ERROR ' + e.message.split('\n')[0]);
  }
  for (const c of contexts) await c.close();
  return { shots, log };
}
