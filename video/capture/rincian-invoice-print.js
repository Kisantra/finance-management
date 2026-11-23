/*
 * Layar "Pratinjau cetak" panduan Rincian item invoice (video/rincian-invoice/screens/staff-print.webp).
 * Jalankan SETELAH rincian-invoice.js (ubah ID sesuai hasilnya), lalu:
 *   1. Unduh PDF pratinjau draft itu ke out/rincian-invoice/invoice.pdf (GET /c/bahtera-cipta-bersama/invoice/{ID}/preview
 *      dengan sesi staff.bcb, mis. curl + cookie laravel_session dari browser).
 *   2. python video/capture/invoices-pdf.py rincian-invoice  (PDF → out/rincian-invoice/invoice.png)
 *   3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/rincian-invoice-print.js
 * Penampil PDF Chromium headless kosong, jadi iframe pratinjau diisi gambar PDF asli. Hanya membaca DB QC.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8031';
  const COMPANY = 'bahtera-cipta-bersama';
  const ROOT = '/Users/alexjanuar/orca/workspaces/finance-management/nusa-lintas-armada/';
  const OUT = ROOT + 'video/rincian-invoice/screens/';
  const PDF_PNG = ROOT + 'out/rincian-invoice/invoice.png';
  const ID = 13;
  const browser = page.context().browser();
  const log = [];

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = 'button[aria-label="Kirim Masukan"],[data-sonner-toaster]{display:none!important}';
      document.head.appendChild(s);
    });
  });
  await ctx.route(/\/invoice\/\d+\/preview/, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0;background:#fff"><img src="/__capture/invoice.png" style="width:100%;display:block"></body></html>' }),
  );
  await ctx.route(/\/__capture\/invoice\.png/, (route) => route.fulfill({ path: PDF_PNG, contentType: 'image/png' }));
  const box = async (loc) => {
    const b = await loc.first().boundingBox({ timeout: 3000 }).catch(() => null);
    return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;
  };

  const shots = {};
  try {
    const s = await ctx.newPage();
    await s.goto(BASE + '/login');
    await s.locator('input[type=email]').fill('staff.bcb@mitragroup.id');
    await s.locator('input[type=password]').fill('password');
    await s.getByRole('button', { name: 'Masuk', exact: true }).click();
    await s.waitForURL(/dashboard/);
    await s.goto(`${BASE}/c/${COMPANY}/invoices?open=${ID}#invoice/${ID}`);
    const drawer = s.getByRole('dialog').first();
    await drawer.getByRole('heading', { name: 'Riwayat' }).waitFor();
    await drawer.getByRole('radio', { name: 'Pratinjau cetak' }).click();
    const frame = drawer.locator('iframe').first();
    await frame.waitFor();
    await s.waitForTimeout(1500);
    // Iframe setinggi halaman PDF: gulir wadah drawer sampai tabel item (±32% tinggi halaman) berada di atas layar.
    await frame.evaluate((el) => {
      let box = el.parentElement;
      while (box && box.scrollHeight <= box.clientHeight + 4) box = box.parentElement;
      const top = el.getBoundingClientRect().top + el.getBoundingClientRect().height * 0.31 - 110;
      box?.scrollBy({ top, behavior: 'instant' });
    });
    await s.waitForTimeout(500);
    await s.mouse.move(0, 719);
    await s.screenshot({ path: OUT + 'staff-print.png' });
    shots['staff-print'] = {
      tabs: await box(drawer.getByRole('radiogroup', { name: 'Tampilan detail' })),
      preview: await box(frame),
    };
  } catch (e) {
    log.push('ERROR ' + e.message.split('\n')[0]);
  }
  await ctx.close();
  return { shots, log };
}
