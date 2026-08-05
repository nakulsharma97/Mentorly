/* Dark-mode verification v2: seed a real mentor token → toggle dark →
   visit /mentor/analytics + /mentor/students, screenshot and measure. */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const TOKEN = process.env.DARK_TOKEN;
  if (!TOKEN) { console.log('NO TOKEN — pass DARK_TOKEN env'); await browser.close(); return; }

  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((tok) => {
    localStorage.setItem('token', tok);
    sessionStorage.setItem('token', tok);
    localStorage.setItem('user', 'darktest+4@example.com');
    sessionStorage.setItem('user', 'darktest+4@example.com');
    localStorage.setItem('currentUser', JSON.stringify({ email: 'darktest+4@example.com', role: 'MENTOR' }));
    localStorage.setItem('theme-preference', 'dark');
  }, TOKEN);
  await page.waitForTimeout(500);

  async function shoot(path, name) {
    await page.goto('http://127.0.0.1:5174' + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      localStorage.setItem('theme-preference', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(800);
    const bg = await page.evaluate(() => {
      const body = getComputedStyle(document.body).backgroundColor;
      const shells = [...document.querySelectorAll('.ws-shell, .ss-crm, .md-page, .ws-sb, .ws-main-content')].slice(0, 5)
        .map((el) => (el.className && String(el.className).split(' ')[0]) + ':' + getComputedStyle(el).backgroundColor);
      return { body, shells };
    });
    await page.screenshot({ path: `e2e-screenshots/dark-${name}.png`, fullPage: false });
    console.log(`[${name}] url=${page.url()}`);
    console.log(`[${name}] bg=`, JSON.stringify(bg));
    const white = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('aside, section, div, main').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 30 || r.height < 30 || r.width > 2000) return;
        const bg = getComputedStyle(el).backgroundColor;
        if (bg === 'rgb(255, 255, 255)' || bg === 'rgb(248, 250, 252)' || bg === 'rgb(241, 245, 249)') {
          const cls = (el.className && String(el.className).slice(0, 60)) || el.tagName;
          out.push(`${cls} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.x)},${Math.round(r.y)}`);
        }
      });
      return out.slice(0, 12);
    });
    console.log(`[${name}] LIGHT-LEAK ELEMENTS:`, white.length ? white : 'NONE');
  }

  await shoot('/mentor/analytics', 'analytics');
  await shoot('/mentor/students', 'students');

  console.log('PAGE ERRORS:', errors.length ? errors.slice(0, 6) : 'NONE');
  await browser.close();
})();
