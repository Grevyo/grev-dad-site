-- A "Grev Home" dashboard tile that downloads the latest Grev Home installer for Windows.
-- It is a default tile for new dashboards, and is added once to every existing dashboard,
-- placed in a new row under the member's current tiles so it never overlaps one.
PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO dashboard_features(
  id,slug,name,description,category,feature_type,tile_presentation,route,icon_text,audience,
  default_size,allowed_sizes,default_width,default_height,allowed_dimensions,
  is_active,is_default,sort_order,created_at,updated_at
) VALUES (
  'feature-grev-home','grev-home','Grev Home',
  'Download Grev Home for Windows: a controller-first console for your PC, linked to your Grev.dad account.',
  'Apps','link','content','/download/grev-home','GH','all',
  'large','medium,large,wide',3,2,'2x1,3x1,4x1,2x2,3x2,4x2',
  1,1,15,unixepoch(),unixepoch()
);

INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,pinned_at,updated_at)
SELECT p.user_id,'feature-grev-home',
  COALESCE((SELECT MAX(t.position) FROM user_dashboard_tiles t WHERE t.user_id=p.user_id),-1)+1,
  'large',0,
  MIN(196,COALESCE((SELECT MAX(t.grid_y+t.tile_height) FROM user_dashboard_tiles t WHERE t.user_id=p.user_id),0)),
  3,2,'blue',unixepoch(),unixepoch()
FROM user_dashboard_preferences p
WHERE NOT EXISTS(SELECT 1 FROM user_dashboard_tiles t WHERE t.user_id=p.user_id AND t.feature_id='feature-grev-home');
