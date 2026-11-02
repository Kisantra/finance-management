/*
 * Ambil ulang screenshot tutorial Notifikasi (video/notifications/screens/*.webp, lewat to-webp.py) bila UI berubah.
 * 1. Jalankan server QC: DB_DATABASE=finance_management_qc php artisan serve --host=127.0.0.1 --port=8017
 * 2. Jalankan video/capture/feedbacks.js dulu: skrip itu membuat notifikasi Feedback Baru (Admin & Finance manager)
 *    dan Tanggapan Feedback (staff) yang masih belum dibaca.
 * 3. Jalankan file ini lewat Playwright MCP (browser_run_code_unsafe, filename: video/capture/notifications.js).
 * 4. python video/capture/to-webp.py notifications, lalu salin koordinat ke video/notifications/shots.ts.
 * Skrip ini menandai notifikasi ketiga akun uji sebagai sudah dibaca. Jangan jalankan di DB utama.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8017';
  const OUT = 'D:/Laravel/finance-management/video/notifications/screens/';
  const browser = page.context().browser();
  const shots = {};
  const log = [];
  const contexts = [];

  const open = async (email) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
    contexts.push(ctx);
    // Server Vite dipakai bersama agent lain: putus HMR agar perubahan file lain tidak memuat ulang halaman di tengah capture.
    await ctx.routeWebSocket(/:5173/, () => {});
    ctx.setDefaultTimeout(60000);
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
    await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
    await p.mouse.move(0, 719);
    await p.waitForTimeout(300);
  };
  const box = async (loc) => {
    const b = await loc.first().boundingBox({ timeout: 1500 }).catch(() => null);
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
  const bell = (p) => p.getByRole('button', { name: 'Notifikasi' });
  const popover = (p) => p.getByText('Lihat semua notifikasi').locator('xpath=ancestor::*[@role="dialog"][1]');
  const popTargets = (p) => ({
    bell: bell(p),
    popover: popover(p),
    header: popover(p).getByRole('heading', { name: 'Notifikasi' }).locator('xpath=../..'),
    markAll: popover(p).getByRole('button', { name: 'Tandai semua' }),
    first: popover(p).locator('li button').first(),
    second: popover(p).locator('li button').nth(1),
    seeAll: popover(p).getByRole('button', { name: /Lihat semua notifikasi/ }),
  });
  const drawer = (p) => p.getByRole('dialog').filter({ hasText: 'Semua Notifikasi' });
  const drawerTargets = (p) => ({
    drawer: drawer(p),
    header: drawer(p).getByText('Semua Notifikasi').locator('xpath=../../..'),
    summary: drawer(p).getByText(/total ·/),
    markAll: drawer(p).getByRole('button', { name: 'Tandai semua' }),
    first: drawer(p).locator('li button').first(),
    list: drawer(p).locator('ul').first(),
  });
  const openPopover = async (p) => {
    await bell(p).click();
    await p.getByText('Lihat semua notifikasi').waitFor();
  };

  try {
    /* ── Staff ── */
    const s = await open('staff@qc.test');
    await s.goto(BASE + '/dashboard');
    await s.getByRole('region', { name: 'Arus Kas' }).first().waitFor();
    await snap(s, 'staff-header', { bell: bell(s), header: s.locator('header').first() });
    await openPopover(s);
    await snap(s, 'staff-popover', popTargets(s));
    await popover(s).locator('li button').first().click();
    await s.waitForURL(/feedbacks/);
    await s.getByRole('heading', { name: 'Feedback & Saran' }).waitFor();
    await snap(s, 'staff-after-click', { bell: bell(s), heading: s.getByRole('heading', { name: 'Feedback & Saran' }) });
    await openPopover(s);
    await s.getByRole('button', { name: /Lihat semua notifikasi/ }).click();
    await drawer(s).locator('li button').first().waitFor();
    await s.waitForTimeout(500);
    await snap(s, 'staff-drawer', drawerTargets(s));
    await drawer(s).getByRole('button', { name: 'Tandai semua' }).click();
    await drawer(s).getByText(/0 belum dibaca/).waitFor();
    await snap(s, 'staff-drawer-read', { ...drawerTargets(s), bell: bell(s) });

    /* ── Finance manager ── */
    const m = await open('fm@qc.test');
    await m.goto(BASE + '/dashboard');
    await m.getByRole('region', { name: 'Arus Kas' }).first().waitFor();
    await openPopover(m);
    await snap(m, 'fm-popover', popTargets(m));
    await popover(m).locator('li button').first().click();
    await m.waitForURL(/feedbacks/);
    await m.getByRole('heading', { name: 'Feedback & Saran' }).waitFor();
    await snap(m, 'fm-after-click', { bell: bell(m), heading: m.getByRole('heading', { name: 'Feedback & Saran' }) });

    /* ── Admin ── */
    const a = await open('admin@gmail.com');
    await a.goto(BASE + '/dashboard');
    await a.getByRole('region', { name: 'Arus Kas' }).first().waitFor();
    await snap(a, 'admin-header', { bell: bell(a) });
    await openPopover(a);
    await snap(a, 'admin-popover', popTargets(a));
    await popover(a).getByRole('button', { name: 'Tandai semua' }).click();
    await a.waitForFunction(() => !document.querySelector('button[aria-label="Notifikasi"] span'));
    await snap(a, 'admin-read-all', popTargets(a));
    await a.getByRole('button', { name: /Lihat semua notifikasi/ }).click();
    await drawer(a).locator('li button').first().waitFor();
    await a.waitForTimeout(500);
    await snap(a, 'admin-drawer', drawerTargets(a));
  } finally {
    for (const ctx of contexts) await ctx.close();
  }
  return JSON.stringify({ log, shots });
}
