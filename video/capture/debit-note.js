/*
 * Ambil ulang screenshot panduan Debit Note (video/debit-note/screens/*.webp) bila UI berubah.
 * 1. DB QC terisolasi (bukan DB perusahaan asli): `php artisan db:seed --class=ContohInvoiceBcbSeeder` (PT BCB:
 *    template Debit Note, sakelar Debit Note menyala, klien fiktif PT. CONTOH BINA SAMUDRA). Ganti alamat, telepon,
 *    email, dan rekening profil BCB dengan data contoh; nama pengguna staff.bcb = "Staf Uji", admin.bcb = "Admin";
 *    tambahkan satu rekening di Kas & Bank BCB ("Mandiri Operasional") agar pembayaran bisa dicatat.
 * 2. Server: php artisan serve --host=127.0.0.1 --port=8031 (APP_URL sama).
 * 3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/debit-note.js (ubah ROOT bila perlu).
 * 4. python video/capture/to-webp.py debit-note, lalu salin koordinat hasilnya ke video/debit-note/shots.ts.
 * Skrip ini MENERBITKAN 1 Debit Note talangan baru di DB QC (nomor berikutnya). Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8031';
  const COMPANY = 'bahtera-cipta-bersama';
  const ROOT = '/Users/alexjanuar/orca/workspaces/finance-management/nusa-lintas-armada/';
  const OUT = ROOT + 'video/debit-note/screens/';
  const CLIENT = 'PT. CONTOH BINA SAMUDRA';
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
    await p.waitForURL(/dashboard/);
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
  /** Gulir <main> agar elemen berada di posisi `block` (start/center/end) layar. */
  const reveal = async (loc, block = 'center') => {
    await loc.first().evaluate((el, b) => el.scrollIntoView({ block: b, behavior: 'instant' }), block);
    await loc.page().waitForTimeout(400);
  };
  const top = (p) => p.getByRole('dialog').filter({ hasNot: p.locator('[cmdk-root]') }).last();
  const drawer = (p) => p.getByRole('dialog').first();
  const up = (loc, n = 1) => loc.locator('xpath=' + Array(n).fill('..').join('/'));
  const typeMoney = async (p, loc, digits) => {
    await loc.click();
    await p.keyboard.press('ControlOrMeta+A');
    await p.keyboard.type(digits);
  };
  const editor = (p) => ({
    title: p.getByRole('heading', { level: 1 }),
    type: p.getByRole('radiogroup', { name: 'Jenis dokumen' }),
    debitNote: p.getByRole('radio', { name: 'Debit Note' }),
    code: p.getByRole('combobox', { name: 'Kode jenis' }),
    codeHint: p.getByText(/^Di nomor:/),
    nature: p.getByRole('radiogroup', { name: 'Isi Debit Note' }),
    talangan: p.getByRole('radio', { name: 'Talangan' }),
    jasa: p.getByRole('radio', { name: 'Tagihan jasa' }),
    natureInfo: up(p.getByRole('radiogroup', { name: 'Isi Debit Note' }), 2).locator('xpath=following-sibling::*[1]'),
    client: p.getByRole('button', { name: 'Klien', exact: true }),
    subject: p.getByRole('textbox', { name: 'Perihal' }),
    attention: p.getByRole('textbox', { name: 'Untuk perhatian (ATTENTION)' }),
    publish: p.getByRole('button', { name: 'Simpan & terbitkan' }),
    draft: p.getByRole('button', { name: 'Simpan draft' }),
  });

  /* ── Staff: Debit Note talangan ── */
  const s = await open('staff.bcb@mitragroup.id');
  await s.goto(url('/invoices'));
  await s.locator('table').first().waitFor();
  await snap(s, 'staff-list', {
    create: s.getByRole('link', { name: 'Buat Invoice' }).or(s.getByRole('button', { name: 'Buat Invoice' })),
    dnRow: s.getByRole('row', { name: /DN-OT/ }).first(),
    table: s.locator('table').first(),
  });

  await s.goto(url('/invoices/create'));
  await s.getByRole('radiogroup', { name: 'Jenis dokumen' }).waitFor();
  await snap(s, 'staff-new', editor(s));

  await s.getByRole('radio', { name: 'Debit Note' }).click();
  await s.getByRole('heading', { name: 'Buat Debit Note' }).waitFor();
  await snap(s, 'staff-type', editor(s));

  await s.getByRole('combobox', { name: 'Kode jenis' }).fill('PNBP');
  await s.getByText('Di nomor: DN-PNBP').waitFor();
  await s.keyboard.press('Escape');
  await snap(s, 'staff-code', editor(s));

  await s.getByRole('button', { name: 'Klien', exact: true }).click();
  await s.getByRole('option', { name: CLIENT }).click();
  await s.getByRole('textbox', { name: 'Perihal' }).fill('Penggantian biaya PNBP jasa labuh MV. CONTOH JAYA');
  await reveal(s.getByRole('button', { name: 'Klien', exact: true }), 'start');
  await s.evaluate(() => document.querySelector('main').scrollBy(0, -90));
  await snap(s, 'staff-client', editor(s));

  const items = s.getByRole('region', { name: /^Item/ });
  await s.getByLabel('Layanan baris 1', { exact: true }).fill('PNBP jasa labuh kapal');
  await s.keyboard.press('Escape');
  await typeMoney(s, s.locator('#price-0'), '4250000');
  await s.getByRole('button', { name: 'Tambah keterangan' }).first().click();
  const desc = items.locator('textarea').first();
  await desc.fill('NTPN 0000-CONTOH-0001\nDibayar 18 November 2026');
  await reveal(items, 'center');
  await snap(s, 'staff-item', {
    items,
    row1: items.getByRole('listitem').first(),
    name1: s.getByLabel('Layanan baris 1', { exact: true }),
    price1: s.locator('#price-0'),
    desc1: desc,
  });

  const totals = s.getByRole('region', { name: 'Penyesuaian dan total' });
  await reveal(totals, 'end');
  await snap(s, 'staff-totals', {
    totals,
    summary: up(totals.getByText('Total', { exact: true }), 2),
    note: totals.getByText(/Talangan diganti klien/),
    items,
  });

  await reveal(s.getByRole('heading', { level: 1 }), 'start');
  await s.getByRole('button', { name: 'Simpan & terbitkan' }).click();
  await top(s).getByRole('button', { name: /Terbitkan/ }).last().waitFor();
  await snap(s, 'staff-publish', {
    dialog: top(s),
    number: top(s).getByText(/DN-PNBP/).first(),
    confirm: top(s).getByRole('button', { name: /Terbitkan/ }).last(),
  });
  await top(s).getByRole('button', { name: /Terbitkan/ }).last().click();
  await s.waitForURL(/#invoice\/\d+/);
  const id = Number(s.url().match(/#invoice\/(\d+)/)[1]);
  await drawer(s).getByRole('heading', { name: 'Riwayat' }).waitFor();
  await s.waitForTimeout(500);
  await snap(s, 'staff-drawer', {
    drawer: drawer(s),
    number: drawer(s).getByText(/DN-PNBP/).first(),
    status: drawer(s).locator('.rounded-full', { hasText: /^(Draft|Terbit|Sebagian|Lunas)$/ }).first(),
    items: drawer(s).locator('table').first(),
    pay: drawer(s).getByRole('button', { name: 'Catat pembayaran' }),
  });

  /* ── Staff: Debit Note tagihan jasa (tidak disimpan) ── */
  await s.goto(url('/invoices/create'));
  await s.getByRole('radio', { name: 'Debit Note' }).click();
  await s.getByRole('radio', { name: 'Tagihan jasa' }).click();
  await s.waitForTimeout(300);
  await snap(s, 'staff-jasa', editor(s));

  const jasaTotals = s.getByRole('region', { name: 'Penyesuaian dan total' });
  await reveal(jasaTotals, 'end');
  await snap(s, 'staff-jasa-totals', {
    totals: jasaTotals,
    ppn: up(jasaTotals.getByRole('switch', { name: /Tagih PPN/ }), 1),
    ppnSwitch: jasaTotals.getByRole('switch', { name: /Tagih PPN/ }),
    pph: up(jasaTotals.getByRole('switch', { name: /PPh 23/ }), 1),
    pphSwitch: jasaTotals.getByRole('switch', { name: /PPh 23/ }),
  });

  /* ── Admin: sakelar Debit Note di Profil perusahaan ── */
  const a = await open('admin.bcb@mitragroup.id');
  await a.goto(url('/settings/company'));
  const dnCheck = a.getByText('Perusahaan ini menerbitkan').first();
  await dnCheck.waitFor();
  await reveal(dnCheck, 'center');
  await snap(a, 'admin-profile', {
    section: up(a.getByRole('heading', { name: 'Debit Note', exact: true }), 3),
    heading: a.getByRole('heading', { name: 'Debit Note', exact: true }),
    check: up(dnCheck, 1),
    usd: a.getByText('Perusahaan ini bisa').first(),
  });

  /* ── Admin: pembayaran Debit Note talangan (jurnal pratinjau, tidak disimpan) ── */
  await a.goto(url(`/invoices?open=${id}#invoice/${id}`));
  await drawer(a).getByRole('heading', { name: 'Riwayat' }).waitFor();
  await drawer(a).getByRole('button', { name: 'Catat pembayaran' }).click();
  const pay = top(a);
  await pay.getByText('Rekening tujuan').first().waitFor();
  await up(pay.getByText('Rekening tujuan').first(), 1).getByRole('button').first().click();
  await a.getByRole('option', { name: /Mandiri Operasional/ }).click();
  await pay.locator('section[aria-label="Jurnal"]').waitFor();
  await snap(a, 'admin-pay', {
    dialog: pay,
    amount: pay.getByText('Jumlah', { exact: true }).first(),
    account: up(pay.getByText('Rekening tujuan').first(), 1),
    journal: pay.locator('section[aria-label="Jurnal"]'),
    credit: pay.locator('section[aria-label="Jurnal"]').getByText(/Talangan/).first(),
  });
  await a.keyboard.press('Escape');

  /* ── Admin: bayar biaya ke negara = pengeluaran Pendanaan "Bayar Talangan Klien" (tidak disimpan) ── */
  await a.goto(url('/cash-flow/expenses'));
  await a.locator('table').first().waitFor().catch(() => log.push('expense table not found'));
  await a.getByRole('button', { name: 'Catat Pengeluaran' }).click();
  const ex = top(a);
  await ex.getByRole('button', { name: 'Pilih kategori' }).waitFor();
  await ex.locator('input[type=text]').first().click();
  await a.keyboard.type('4250000');
  await ex.getByRole('button', { name: 'Pilih kategori' }).click();
  const opt = a.getByRole('option', { name: /Bayar Talangan Klien/ }).first();
  await opt.waitFor();
  await opt.click();
  await ex.locator('textarea').fill('Bayar PNBP jasa labuh MV. CONTOH JAYA (talangan klien)');
  await reveal(ex.locator('section[aria-label="Jurnal"]'), 'center');
  await snap(a, 'admin-expense', {
    dialog: ex,
    category: ex.getByText(/Bayar Talangan Klien/).first(),
    hint: ex.getByText(/Laba Rugi tidak berubah/).first(),
    journal: ex.locator('section[aria-label="Jurnal"]'),
  });

  for (const c of contexts) await c.close();
  return { id, shots, log };
}
