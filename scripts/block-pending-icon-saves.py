from pathlib import Path

path = Path('public/dashboard.js')
source = path.read_text()
before = '''async function saveDashboardLayout() {
  const preferences = editorPreferences();
  editorMessage('Saving dashboard…');'''
after = '''async function saveDashboardLayout() {
  if (dashboardState.iconUploads.size > 0) {
    editorMessage('Wait for the selected icon picture to finish loading before saving.', 'error');
    return;
  }
  const preferences = editorPreferences();
  editorMessage('Saving dashboard…');'''
if source.count(before) != 1:
    raise RuntimeError(f'pending icon save guard: expected one anchor, found {source.count(before)}')
path.write_text(source.replace(before, after, 1))
print('Dashboard saving now waits for pending icon pictures.')
