PRAGMA foreign_keys = ON;

CREATE TABLE content_items (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('task','reminder','event','project','favourite','achievement','gaming_account','equipment','timeline','media','post','announcement')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','account','verified','group')),
  starts_at INTEGER,
  ends_at INTEGER,
  completed_at INTEGER,
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX content_items_owner_type_updated ON content_items(owner_user_id,item_type,updated_at DESC);
CREATE INDEX content_items_group_type_updated ON content_items(group_id,item_type,updated_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX content_items_schedule ON content_items(owner_user_id,starts_at,ends_at);

CREATE TABLE user_presence (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  availability TEXT NOT NULL DEFAULT 'online' CHECK (availability IN ('online','away','busy','offline')),
  status_text TEXT NOT NULL DEFAULT '',
  activity_type TEXT NOT NULL DEFAULT 'none' CHECK (activity_type IN ('none','playing','listening','watching','working')),
  activity_text TEXT NOT NULL DEFAULT '',
  expires_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  target_url TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX notifications_recipient_created ON notifications(recipient_user_id,created_at DESC);
CREATE INDEX notifications_unread ON notifications(recipient_user_id,read_at,created_at DESC);

CREATE TABLE notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  guestbook INTEGER NOT NULL DEFAULT 1 CHECK (guestbook IN (0,1)),
  reactions INTEGER NOT NULL DEFAULT 1 CHECK (reactions IN (0,1)),
  group_posts INTEGER NOT NULL DEFAULT 1 CHECK (group_posts IN (0,1)),
  reminders INTEGER NOT NULL DEFAULT 1 CHECK (reminders IN (0,1)),
  mentions INTEGER NOT NULL DEFAULT 1 CHECK (mentions IN (0,1)),
  updated_at INTEGER NOT NULL
);

CREATE TABLE dashboard_device_layouts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  device_mode TEXT NOT NULL CHECK (device_mode IN ('desktop','mobile')),
  layout_json TEXT NOT NULL DEFAULT '{"tiles":[],"preferences":{}}',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,page_key,device_mode)
);

CREATE TABLE dashboard_layout_drafts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  device_mode TEXT NOT NULL CHECK (device_mode IN ('desktop','mobile')),
  layout_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,page_key,device_mode)
);

CREATE TABLE dashboard_layout_versions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  device_mode TEXT NOT NULL CHECK (device_mode IN ('desktop','mobile')),
  version_name TEXT NOT NULL,
  layout_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX dashboard_layout_versions_page ON dashboard_layout_versions(user_id,page_key,device_mode,created_at DESC);

CREATE TABLE dashboard_page_collaborators (
  page_id TEXT NOT NULL REFERENCES dashboard_pages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'edit' CHECK (permission IN ('view','edit','manage')),
  assigned_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at INTEGER NOT NULL,
  PRIMARY KEY(page_id,user_id)
);

CREATE TABLE profile_visits (
  profile_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visitor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visited_at INTEGER NOT NULL,
  PRIMARY KEY(profile_user_id,visitor_user_id)
);
CREATE INDEX profile_visits_recent ON profile_visits(profile_user_id,visited_at DESC);

CREATE TABLE profile_subscriptions (
  profile_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscriber_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(profile_user_id,subscriber_user_id)
);

CREATE TABLE profile_blocks (
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(owner_user_id,blocked_user_id)
);

ALTER TABLE profile_guestbook_entries ADD COLUMN parent_id TEXT REFERENCES profile_guestbook_entries(id) ON DELETE CASCADE;
ALTER TABLE profile_guestbook_entries ADD COLUMN updated_at INTEGER;
ALTER TABLE profile_guestbook_entries ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0,1));

CREATE TABLE profile_guestbook_reports (
  entry_id TEXT NOT NULL REFERENCES profile_guestbook_entries(id) ON DELETE CASCADE,
  reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY(entry_id,reporter_user_id)
);

INSERT OR IGNORE INTO dashboard_features(
  id,slug,name,description,category,feature_type,tile_presentation,route,icon_text,audience,
  default_size,allowed_sizes,default_width,default_height,allowed_dimensions,
  is_active,is_default,sort_order,created_at,updated_at
) VALUES
('feature-module-tasks','module-tasks','Tasks','Live personal tasks with completion and due dates.','Personal modules','system','content','/hub#tasks','DO','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,400,unixepoch(),unixepoch()),
('feature-module-calendar','module-calendar','Calendar','Upcoming personal events and appointments.','Personal modules','system','content','/hub#calendar','CAL','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,410,unixepoch(),unixepoch()),
('feature-module-reminders','module-reminders','Reminders','Active reminders ordered by time.','Personal modules','system','content','/hub#reminders','REM','all','medium','medium,large,wide',2,2,'2x1,2x2,3x2,4x2',1,0,420,unixepoch(),unixepoch()),
('feature-module-notifications','module-notifications','Notifications','Unread account, profile and group notifications.','Personal modules','system','content','/hub#notifications','NEW','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,430,unixepoch(),unixepoch()),
('feature-module-projects','module-projects','Projects','Current personal projects with status and progress.','Profile modules','system','content','/hub#projects','PRJ','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,440,unixepoch(),unixepoch()),
('feature-module-media','module-media','Media library','Recent reusable pictures, GIFs and media links.','Profile modules','system','content','/hub#media','IMG','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,450,unixepoch(),unixepoch()),
('feature-module-favourites','module-favourites','Favourites','Favourite games, films, music, places and more.','Profile modules','system','content','/hub#favourites','FAV','all','medium','medium,large,wide',2,2,'2x1,2x2,3x2,4x2',1,0,460,unixepoch(),unixepoch()),
('feature-module-achievements','module-achievements','Achievements','Badges, milestones and personal achievements.','Profile modules','system','content','/hub#achievements','WIN','all','medium','medium,large,wide',2,2,'2x1,2x2,3x2,4x2',1,0,470,unixepoch(),unixepoch()),
('feature-module-gaming','module-gaming','Gaming accounts','Connected gaming identities and usernames.','Profile modules','system','content','/hub#gaming','GAME','all','medium','medium,large,wide',2,2,'2x1,2x2,3x2,4x2',1,0,480,unixepoch(),unixepoch()),
('feature-module-equipment','module-equipment','Setup and equipment','PC, gaming and personal equipment.','Profile modules','system','content','/hub#equipment','KIT','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,490,unixepoch(),unixepoch()),
('feature-module-timeline','module-timeline','Timeline','Personal milestones and important dates.','Profile modules','system','content','/hub#timeline','TIME','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,500,unixepoch(),unixepoch()),
('feature-module-status','module-status','Status and presence','Current availability and activity.','Personal modules','system','content','/hub#status','NOW','all','medium','small,medium,large',2,1,'1x1,2x1,2x2,3x1',1,0,510,unixepoch(),unixepoch()),
('feature-module-posts','module-posts','Recent posts','Recent personal posts and updates.','Community','system','content','/hub#posts','POST','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,520,unixepoch(),unixepoch()),
('feature-module-announcements','module-announcements','Group announcements','Recent announcements from your groups.','Community','system','content','/hub#announcements','GROUP','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,530,unixepoch(),unixepoch()),
('feature-quick-content','quick-content','Add content','Open the content hub and create a real module item.','Quick actions','link','action','/hub','ADD','all','medium','small,medium,large',2,1,'1x1,2x1,2x2',1,0,540,unixepoch(),unixepoch()),
('feature-quick-task','quick-task','Add task','Create a task directly in the content hub.','Quick actions','link','action','/hub#new-task','TASK','all','medium','small,medium,large',2,1,'1x1,2x1,2x2',1,0,550,unixepoch(),unixepoch()),
('feature-quick-event','quick-event','Add event','Create a calendar event directly in the content hub.','Quick actions','link','action','/hub#new-event','DATE','all','medium','small,medium,large',2,1,'1x1,2x1,2x2',1,0,560,unixepoch(),unixepoch()),
('feature-quick-status','quick-status','Change status','Update your availability and current activity.','Quick actions','link','action','/hub#status','LIVE','all','medium','small,medium,large',2,1,'1x1,2x1,2x2',1,0,570,unixepoch(),unixepoch()),
('feature-quick-post','quick-post','Create post','Publish a personal or group update.','Quick actions','link','action','/hub#new-post','WRITE','all','medium','small,medium,large',2,1,'1x1,2x1,2x2',1,0,580,unixepoch(),unixepoch());
