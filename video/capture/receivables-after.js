/*
 * Tutorial Piutang — bagian 3/4: pembayaran cicilan (finance manager) & penolakan dilihat staff.
 * Butuh: RCV kasbon Staf Uji Rp 6.000.000 sudah Aktif, kasbon Rp 15.000.000 Ditolak, piutang CV. Karya Bersama Aktif.
 * Mencoba menyimpan cicilan Potongan Gaji lewat UI (status respons dicatat di log); cicilan transfer hanya diisi.
 * Playwright MCP browser_run_code_unsafe, filename: video/capture/receivables-after.js
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8016';
  const OUT = 'D:/Laravel/finance-management/video/receivables/screens/';
  const FIX = 'D:/Laravel/finance-management/video/capture/fixtures/';
  const browser = page.context().browser();
  const shots = {};
  const log = [];
  const contexts = [];

  const open = async (email) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
    contexts.push(ctx);
    // Putus HMR Vite: edit file oleh orang lain tidak lagi memuat ulang halaman di tengah capture.
    await ctx.routeWebSocket(/./, () => {});
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
  const parentOf = (loc) => loc.locator('xpath=..');
  /** Pilih opsi Combobox; buka ulang bila popover sempat tertutup (mis. setelah snap). */
  const pick = async (p, btn, name) => {
    const opt = p.getByRole('option', { name });
    if (!(await opt.first().isVisible().catch(() => false))) await btn.click();
    await opt.first().click();
  };

  try {
    const m = await open('fm@qc.test');
    await m.goto(BASE + '/receivables');
    const row = m.getByRole('row', { name: /RCV-00003/ });
    await row.getByText('Aktif', { exact: true }).waitFor();
    await snap(m, 'fm-list-active', {
      stats: parentOf(parentOf(parentOf(parentOf(m.getByText('Total Piutang', { exact: true }))))),
      row,
      remaining: row.locator('td').nth(6),
      pay: row.getByTitle('Catat Pembayaran'),
    });
    await row.locator('td').nth(2).click();
    await top(m).getByRole('button', { name: 'Catat Pembayaran' }).waitFor();
    await snap(m, 'fm-detail-active', {
      dialog: top(m),
      status: top(m).getByText('Aktif', { exact: true }),
      progress: parentOf(top(m).getByText('Progres Pembayaran')).locator('xpath=..'),
      pay: top(m).getByRole('button', { name: 'Catat Pembayaran' }),
    });
    await top(m).getByRole('button', { name: 'Catat Pembayaran' }).click();
    const d = () => top(m);
    await d().getByText('Metode Pembayaran *').waitFor();
    const pay = () => ({
      dialog: d(),
      summary: parentOf(parentOf(d().getByText('Sisa Pokok', { exact: true }))),
      method: parentOf(d().getByText('Metode Pembayaran *', { exact: true })),
      bank: parentOf(d().getByText('Rekening *', { exact: true })),
      date: parentOf(d().getByText('Tanggal Pembayaran *', { exact: true })),
      principal: d().getByLabel(/Pembayaran Pokok/),
      interest: d().getByLabel(/Pembayaran Bunga/),
      reference: d().getByLabel('Nomor Referensi'),
      save: d().getByRole('button', { name: 'Simpan Pembayaran' }),
    });
    const methodBtn = d().getByRole('button', { name: 'Transfer Bank' });
    await methodBtn.click();
    await m.getByRole('option', { name: 'Potongan Gaji' }).waitFor();
    await snap(m, 'fm-pay-method', { ...pay(), list: m.getByRole('listbox'), option: m.getByRole('option', { name: 'Potongan Gaji' }) });
    await pick(m, methodBtn, 'Potongan Gaji');
    await d().getByLabel(/Pembayaran Pokok/).click();
    await m.keyboard.type('1000000');
    await d().getByLabel('Nomor Referensi').fill('GAJI-2026-10');
    await snap(m, 'fm-pay-payroll', pay());
    const resp = m.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/pay'));
    await d().getByRole('button', { name: 'Simpan Pembayaran' }).click();
    const status = (await resp).status();
    log.push('payroll pay status ' + status);
    await m.keyboard.press('Escape').catch(() => {});

    /* Cicilan transfer CV. Karya Bersama (diisi, tidak disimpan). */
    await m.goto(BASE + '/receivables?type=company_loan');
    const kb = m.getByRole('row', { name: /CV. Karya Bersama/ });
    await kb.getByTitle('Catat Pembayaran').click();
    await d().getByText('Metode Pembayaran *').waitFor();
    await pick(m, d().getByRole('button', { name: 'Pilih rekening...' }), /BCA - Operasional/);
    await d().getByLabel(/Pembayaran Pokok/).click();
    await m.keyboard.type('5000000');
    await d().getByLabel(/Pembayaran Bunga/).click();
    await m.keyboard.type('300000');
    await d().getByLabel('Nomor Referensi').fill('TRF-KB-1012');
    await snap(m, 'fm-pay-transfer', pay());
    await d().evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await snap(m, 'fm-pay-transfer-save', pay());
    await d().getByRole('button', { name: 'Batal' }).click();

    /* Staff melihat penolakan. */
    const s = await open('staff@qc.test');
    await s.goto(BASE + '/receivables');
    await s.getByRole('row', { name: /RCV-00004/ }).locator('td').nth(2).click();
    await top(s).getByText('Alasan Penolakan').waitFor();
    await snap(s, 'staff-detail-rejected', {
      dialog: top(s),
      status: top(s).getByText('Ditolak', { exact: true }),
      reason: parentOf(top(s).getByText('Alasan Penolakan')),
    });

    return JSON.stringify({ log, shots });
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
}
