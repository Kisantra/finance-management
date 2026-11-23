/*
 * Ambil ulang screenshot panduan Ganti Bahasa (video/bahasa/screens/*.webp) bila UI berubah.
 * 1. DB QC terisolasi: `php artisan migrate:fresh --seed` (perusahaan demo Kisantra), staff@gmail.com = "Staf Uji".
 * 2. Server: php artisan serve --host=127.0.0.1 --port=8031.
 * 3. Playwright MCP: browser_run_code_unsafe, filename: video/capture/bahasa.js (ubah ROOT bila perlu).
 * 4. python video/capture/to-webp.py bahasa, lalu salin koordinat hasilnya ke video/bahasa/shots.ts.
 * Skrip ini mengganti bahasa akun staff@gmail.com ke English dan 中文, lalu MENGEMBALIKANNYA ke Indonesia.
 */
async (page) => {
  const BASE = 'http://127.0.0.1:8031';
  const COMPANY = 'kisantra';
  const ROOT = '/Users/alexjanuar/orca/workspaces/finance-management/nusa-lintas-armada/';
  const OUT = ROOT + 'video/bahasa/screens/';
  const url = (path) => `${BASE}/c/${COMPANY}${path}`;
  const browser = page.context().browser();
  const contexts = [];
  const shots = {};
  const log = [];

  const context = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'id-ID' });
    contexts.push(ctx);
    await ctx.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = 'button[aria-label="Kirim Masukan"],button[aria-label="Send Feedback"],[data-sonner-toaster]{display:none!important}';
        document.head.appendChild(s);
      });
    });
    return ctx.newPage();
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
  // Pemicu pemilih bahasa: label aria "Bahasa: Indonesia" / "Language: English" / "语言：中文".
  const switcher = (p) => p.getByRole('button', { name: /(Indonesia|English|中文)$/ }).first();
  const choose = async (p, name) => {
    await switcher(p).click();
    await p.getByRole('menuitemradio', { name: new RegExp(name) }).click();
    await p.waitForLoadState('load');
    await p.waitForTimeout(1200);
  };

  let s = null;
  try {
    /* ── Pengguna yang sudah masuk ── */
    s = await context();
    await s.goto(BASE + '/login');
    await s.locator('input[type=email]').fill('staff@gmail.com');
    await s.locator('input[type=password]').fill('password');
    await s.getByRole('button', { name: 'Masuk', exact: true }).click();
    await s.waitForURL(/dashboard/);
    await snap(s, 'staff-id', { switcher: switcher(s), heading: s.getByRole('heading', { level: 1 }), nav: s.locator('aside').first() });
    await switcher(s).click();
    await s.getByRole('menuitemradio', { name: /English/ }).waitFor();
    await snap(s, 'staff-menu', {
      switcher: switcher(s),
      menu: s.getByRole('menu'),
      english: s.getByRole('menuitemradio', { name: /English/ }),
      chinese: s.getByRole('menuitemradio', { name: /中文/ }),
    });
    await s.getByRole('menuitemradio', { name: /English/ }).click();
    await s.waitForLoadState('load');
    await s.waitForTimeout(1200);
    await snap(s, 'staff-en', { switcher: switcher(s), heading: s.getByRole('heading', { level: 1 }), nav: s.locator('aside').first() });
    await s.goto(url('/invoices/create'));
    await s.getByRole('heading', { level: 1 }).waitFor();
    await snap(s, 'staff-en-invoice', { switcher: switcher(s), heading: s.getByRole('heading', { level: 1 }), detail: s.getByRole('region').first() });
    await choose(s, '中文');
    await s.goto(url('/dashboard'));
    await s.getByRole('heading', { level: 1 }).waitFor();
    await snap(s, 'staff-zh', { switcher: switcher(s), heading: s.getByRole('heading', { level: 1 }), nav: s.locator('aside').first() });
    await choose(s, 'Indonesia');

    /* ── Tamu di halaman masuk ── */
    const g = await context();
    await g.goto(BASE + '/login');
    await g.locator('input[type=email]').waitFor();
    await snap(g, 'guest-login', { switcher: switcher(g), form: g.locator('form').first() });
    await choose(g, 'English');
    await g.locator('input[type=email]').waitFor();
    await snap(g, 'guest-login-en', { switcher: switcher(g), form: g.locator('form').first() });
  } catch (e) {
    log.push('ERROR ' + e.message.split('\n')[0]);
    // Jangan tinggalkan akun staff dalam bahasa lain.
    if (s) await choose(s, 'Indonesia').catch(() => log.push('reset locale failed'));
  }
  for (const c of contexts) await c.close();
  return { shots, log };
}
