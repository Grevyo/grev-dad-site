const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const ref = process.env.VERIFY_REF;
const rawBase = `https://raw.githubusercontent.com/Grevyo/grev-dad-site/${ref}/public`;

async function text(path) {
  const response = await fetch(`${rawBase}/${path}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.text();
}

(async () => {
  const [css, js] = await Promise.all([
    text('profile-editor-unified.css'),
    text('profile-editor-unified.js')
  ]);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const login = await context.request.post(`${base}/api/auth/login`, {
    data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false }
  });
  if (login.status() !== 200) throw new Error(`login ${login.status()}`);
  const session = await context.request.get(`${base}/api/auth/session`);
  const profileId = (await session.json()).user.id;

  await page.route('**/profile-editor-unified.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: css }));
  await page.route('**/profile-editor-unified.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: js }));
  await page.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    window.__popupDiagnostics = [];
    const record = (name, extra = {}) => window.__popupDiagnostics.push({ name, at: performance.now(), ...extra });
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('#profile-cancel')) record('profile-cancel-click-capture');
      if (target?.closest('[data-unified-cancel]')) record('unified-cancel-click-capture');
    }, true);
    const toolbar = document.querySelector('#profile-editor-toolbar');
    new MutationObserver(() => record('toolbar-hidden-change', { hidden: toolbar.hidden })).observe(toolbar, { attributes: true, attributeFilter: ['hidden'] });
    const observer = new MutationObserver(() => {
      const dialog = document.querySelector('#profile-unified-editor');
      if (dialog) record('dialog-attribute-change', { open: dialog.open, openAttribute: dialog.hasAttribute('open') });
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  });

  await page.locator('#profile-edit').click();
  const dialog = page.locator('#profile-unified-editor');
  await dialog.waitFor({ state: 'visible' });
  await page.evaluate(() => {
    const dialog = document.querySelector('#profile-unified-editor');
    dialog.addEventListener('close', () => window.__popupDiagnostics.push({ name: 'dialog-close-event', at: performance.now(), open: dialog.open }));
    dialog.addEventListener('cancel', () => window.__popupDiagnostics.push({ name: 'dialog-cancel-event', at: performance.now(), open: dialog.open }));
  });

  console.log('BEFORE', JSON.stringify(await page.evaluate(() => {
    const dialog = document.querySelector('#profile-unified-editor');
    const cancel = document.querySelector('#profile-cancel');
    return {
      dialogOpen: dialog.open,
      modal: dialog.matches(':modal'),
      toolbarHidden: document.querySelector('#profile-editor-toolbar').hidden,
      editHidden: document.querySelector('#profile-edit').hidden,
      cancelParent: cancel.parentElement?.className,
      cancelVisible: getComputedStyle(cancel).display !== 'none',
      cancelData: cancel.hasAttribute('data-unified-cancel')
    };
  })));

  await dialog.locator('#profile-cancel').click();
  await page.waitForTimeout(500);

  console.log('AFTER', JSON.stringify(await page.evaluate(() => {
    const dialog = document.querySelector('#profile-unified-editor');
    const cancel = document.querySelector('#profile-cancel');
    return {
      dialogOpen: dialog.open,
      openAttribute: dialog.hasAttribute('open'),
      modal: dialog.matches(':modal'),
      toolbarHidden: document.querySelector('#profile-editor-toolbar').hidden,
      editHidden: document.querySelector('#profile-edit').hidden,
      bodyEditing: document.body.classList.contains('profile-unified-editing'),
      cancelParent: cancel.parentElement?.className,
      events: window.__popupDiagnostics
    };
  })));

  await browser.close();
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
