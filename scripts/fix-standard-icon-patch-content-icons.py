from pathlib import Path

path = Path('scripts/patch-standard-tile-icons.py')
source = path.read_text()
before = '''js = replace_once(
    js,
    \'\'\'  const icon = document.createElement('span');
  icon.className = 'dashboard-content-icon';
  icon.textContent = feature.iconText;
  heading.append(label, icon);\'\'\',
    \'\'\'  const icon = createStandardTileIcon(feature, 'dashboard-content-icon');
  heading.append(label, icon);\'\'\',
    "news standard icon",
)
js = replace_once(
    js,
    \'\'\'  const icon = document.createElement('span');
  icon.className = 'dashboard-content-icon';
  icon.textContent = feature.iconText;
  heading.append(label, icon);\'\'\',
    \'\'\'  const icon = createStandardTileIcon(feature, 'dashboard-content-icon');
  heading.append(label, icon);\'\'\',
    "generic standard icon",
)
'''
after = '''content_icon_anchor = \'\'\'  const icon = document.createElement('span');
  icon.className = 'dashboard-content-icon';
  icon.textContent = feature.iconText;
  heading.append(label, icon);\'\'\'
content_icon_replacement = \'\'\'  const icon = createStandardTileIcon(feature, 'dashboard-content-icon');
  heading.append(label, icon);\'\'\'
if js.count(content_icon_anchor) != 2:
    raise RuntimeError(f"standard content icons: expected two anchors, found {js.count(content_icon_anchor)}")
js = js.replace(content_icon_anchor, content_icon_replacement)
'''
if source.count(before) != 1:
    raise RuntimeError(f'expected one repeated-content patch block, found {source.count(before)}')
path.write_text(source.replace(before, after, 1))
print('Repeated standard content icon anchors fixed.')
