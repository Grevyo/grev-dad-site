PRAGMA foreign_keys = ON;

CREATE TABLE chat_rooms (
  id TEXT PRIMARY KEY,
  room_type TEXT NOT NULL CHECK (room_type IN ('global','group','direct')),
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX chat_rooms_global_unique ON chat_rooms(room_type) WHERE room_type='global';
CREATE UNIQUE INDEX chat_rooms_group_unique ON chat_rooms(group_id) WHERE room_type='group' AND group_id IS NOT NULL;

CREATE TABLE chat_members (
  room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member' CHECK (member_role IN ('member','moderator','owner')),
  joined_at INTEGER NOT NULL,
  last_read_at INTEGER,
  muted_at INTEGER,
  PRIMARY KEY(room_id,user_id)
);
CREATE INDEX chat_members_user ON chat_members(user_id,room_id);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','gif','system')),
  body TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  reply_to_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  edited_at INTEGER,
  deleted_at INTEGER
);
CREATE INDEX chat_messages_room_created ON chat_messages(room_id,created_at DESC);

CREATE TABLE achievement_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  xp_reward INTEGER NOT NULL CHECK (xp_reward >= 0),
  category TEXT NOT NULL,
  criteria_type TEXT NOT NULL,
  criteria_value INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE user_achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  awarded_at INTEGER NOT NULL,
  progress_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,achievement_id)
);
CREATE INDEX user_achievements_recent ON user_achievements(user_id,awarded_at DESC);

CREATE TABLE user_progression (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_xp INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  updated_at INTEGER NOT NULL
);

CREATE TABLE xp_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  xp_amount INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  event_key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX xp_ledger_user_created ON xp_ledger(user_id,created_at DESC);

INSERT OR IGNORE INTO chat_rooms(id,room_type,title,created_at,updated_at)
VALUES('chat-global','global','Global chat',unixepoch(),unixepoch());

INSERT OR IGNORE INTO achievement_definitions(id,name,description,image_url,xp_reward,category,criteria_type,criteria_value,sort_order) VALUES
('achievement-profile-started','Profile started','Save your first personalised profile.','/achievement-badges/profile-started.svg',100,'Profile','profile_saved',1,10),
('achievement-profile-builder','Profile builder','Make five profile updates.','/achievement-badges/profile-builder.svg',250,'Profile','profile_updates',5,20),
('achievement-dashboard-designer','Dashboard designer','Save your first dashboard layout version.','/achievement-badges/dashboard-designer.svg',150,'Dashboard','dashboard_versions',1,30),
('achievement-task-starter','Getting things done','Create your first task.','/achievement-badges/task-starter.svg',100,'Productivity','tasks_created',1,40),
('achievement-task-master','Task master','Complete ten tasks.','/achievement-badges/task-master.svg',500,'Productivity','tasks_completed',10,50),
('achievement-social-starter','Say hello','Send your first chat message.','/achievement-badges/social-starter.svg',100,'Community','chat_messages',1,60),
('achievement-global-voice','Global voice','Send your first message in Global chat.','/achievement-badges/global-voice.svg',150,'Community','global_messages',1,70),
('achievement-group-voice','Team player','Send your first group-chat message.','/achievement-badges/group-voice.svg',150,'Community','group_messages',1,80),
('achievement-chatter','Chatter','Send fifty chat messages.','/achievement-badges/chatter.svg',600,'Community','chat_messages',50,90),
('achievement-collector','Achievement collector','Unlock five achievements.','/achievement-badges/collector.svg',400,'Progression','achievements_earned',5,100);

INSERT OR IGNORE INTO dashboard_features(
  id,slug,name,description,category,feature_type,tile_presentation,route,icon_text,audience,
  default_size,allowed_sizes,default_width,default_height,allowed_dimensions,
  is_active,is_default,sort_order,created_at,updated_at
) VALUES
('feature-chat-global','chat-global','Global chat','Live chat shared by every active Grev.dad member.','Chat','system','content','/dashboard#chat-global','CHAT','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,600,unixepoch(),unixepoch()),
('feature-chat-groups','chat-groups','Group chats','Your private group conversations and unread messages.','Chat','system','content','/dashboard#chat-groups','GROUP','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,610,unixepoch(),unixepoch()),
('feature-chat-direct','chat-direct','Messages','Recent direct messages and unread conversations.','Chat','system','content','/dashboard#chat-direct','DM','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,620,unixepoch(),unixepoch()),
('feature-achievements','achievements','Achievements','Unlocked achievements, XP and profile level progress.','Profile modules','system','content','/profile#achievements','XP','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,630,unixepoch(),unixepoch());