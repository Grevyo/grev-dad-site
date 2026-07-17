const featureElement = selector => document.querySelector(selector);

async function loadFeatureWorkspace() {
  const slug = decodeURIComponent(location.pathname.slice('/feature/'.length));
  const message = featureElement('#feature-message');
  try {
    const response = await fetch(`/api/dashboard/features/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.feature) throw new Error(payload.message ?? 'Feature unavailable.');
    const feature = payload.feature;
    document.title = `${feature.name} · Grev.dad`;
    featureElement('#feature-icon').textContent = feature.iconText;
    featureElement('#feature-category').textContent = feature.category;
    featureElement('#feature-name').textContent = feature.name;
    featureElement('#feature-description').textContent = feature.description;
    featureElement('#feature-access').textContent = feature.accessGroups?.length
      ? `Available through: ${feature.accessGroups.join(', ')}.`
      : feature.audience === 'all'
        ? 'Available to all active Grev.dad members.'
        : `Available through ${feature.audience} access.`;
    featureElement('#feature-foundation').hidden = false;
    message.textContent = 'Workspace access confirmed.';
    message.className = 'dashboard-status success';
  } catch (error) {
    featureElement('#feature-name').textContent = 'Feature unavailable';
    featureElement('#feature-description').textContent = error.message;
    message.textContent = 'Return to the dashboard to view the features currently available to your account.';
    message.className = 'dashboard-status error';
  }
}

featureElement('#logout')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  location.replace('/');
});

loadFeatureWorkspace();
