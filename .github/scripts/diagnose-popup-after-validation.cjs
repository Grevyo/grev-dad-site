const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const ref = process.env.VERIFY_REF;
const rawBase = `https://raw.githubusercontent.com/Grevyo/grev-dad-site/${ref}/public`;

async function get(path) {
  const response = await fetch(`${rawBase}/${path}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.text();
}

(async () => {
  const [css, js] = await Promise.all([get('profile-editor-unified.css'), get('profile-editor-unified.js')]);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const login = await context.request.post(`${base}/api/auth/login`, { data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false } });
  if (login.status() !== 200) throw new Error(`login ${login.status()}`);
  const profileId = (await (await context.request.get(`${base}/api/auth/session`)).json()).user.id;
  await page.route('**/profile-editor-unified.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: css }));
  await page.route('**/profile-editor-unified.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: js }));
  await page.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    window.__diag = [];
    const push = (name, extra = {}) => window.__diag.push({ name, at: performance.now(), ...extra });
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('#profile-save')) push('save-click');
      if (target?.closest('#profile-cancel')) push('cancel-click');
    }, true);
    const toolbar = document.querySelector('#profile-editor-toolbar');
    new MutationObserver(() => push('toolbar', { hidden: toolbar.hidden })).observe(toolbar, { attributes: true, attributeFilter: ['hidden'] });
  });

  await page.locator('#profile-edit').click();
  const dialog = page.locator('#profile-unified-editor');
  await dialog.waitFor({ state: 'visible' });
  await dialog.locator('#profile-card-website').fill('not-a-valid-url');
  await dialog.locator('#profile-save').click();
  await page.waitForTimeout(100);

  console.log('AFTER_SAVE', JSON.stringify(await page.evaluate(() => {
    const dialog = document.querySelector('#profile-unified-editor');
    const cancel = document.querySelector('#profile-cancel');
    const save = document.querySelector('#profile-save');
    return {
      open: dialog.open,
      toolbarHidden: document.querySelector('#profile-editor-toolbar').hidden,
      cancelParent: cancel.parentElement?.className,
      saveParent: save.parentElement?.className,
      cancelConnected: cancel.isConnected,
      saveConnected: save.isConnected,
      message: document.querySelector('#profile-editor-message').textContent,
      events: window.__diag
    };
  })));

  await dialog.locator('#profile-cancel').click();
  await page.waitForTimeout(500);

  console.log('AFTER_CANCEL', JSON.stringify(await page.evaluate(() => {
    const dialog = document.querySelector('#profile-unified-editor');
    return {
      open: dialog.open,
      openAttribute: dialog.hasAttribute('open'),
      modal: dialog.matches(':modal'),
      toolbarHidden: document.querySelector('#profile-editor-toolbar').hidden,
      editHidden: document.querySelector('#profile-edit').hidden,
      bodyEditing: document.body.classList.contains('profile-unified-editing'),
      events: window.__diag
    };
  })));

  await browser.close();
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
