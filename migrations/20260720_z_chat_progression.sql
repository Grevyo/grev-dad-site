PRAGMA foreign_keys = ON;

CREATE TABLE chat_channels (
  id TEXT PRIMARY KEY,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('global','group','direct')),
  title TEXT NOT NULL,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  direct_key TEXT UNIQUE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX chat_channels_group_unique ON chat_channels(group_id) WHERE channel_type='group';

CREATE TABLE chat_channel_members (
  channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  muted INTEGER NOT NULL DEFAULT 0 CHECK (muted IN (0,1)),
  PRIMARY KEY(channel_id,user_id)
);
CREATE INDEX chat_members_user ON chat_channel_members(user_id,channel_id);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL DEFAULT '',
  gif_url TEXT,
  reply_to_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL,
  edited_at INTEGER,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX chat_messages_channel_created ON chat_messages(channel_id,created_at DESC);
CREATE INDEX chat_messages_sender_created ON chat_messages(sender_user_id,created_at DESC);

CREATE TABLE chat_reads (
  channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at INTEGER NOT NULL,
  PRIMARY KEY(channel_id,user_id)
);

CREATE TABLE chat_message_reports (
  message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY(message_id,reporter_user_id)
);

CREATE TABLE achievement_definitions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  image_path TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0 CHECK (xp_reward >= 0),
  action_key TEXT NOT NULL,
  required_count INTEGER NOT NULL DEFAULT 1 CHECK (required_count > 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX achievement_action ON achievement_definitions(action_key,required_count);

CREATE TABLE user_progression (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_xp INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  updated_at INTEGER NOT NULL
);

CREATE TABLE xp_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  xp_amount INTEGER NOT NULL CHECK (xp_amount >= 0),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  UNIQUE(user_id,action_key,source_type,source_id)
);
CREATE INDEX xp_events_user_action ON xp_events(user_id,action_key,created_at DESC);
CREATE INDEX xp_events_user_created ON xp_events(user_id,created_at DESC);

CREATE TABLE user_achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  awarded_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,achievement_id)
);
CREATE INDEX user_achievements_awarded ON user_achievements(user_id,awarded_at DESC);

INSERT INTO chat_channels(id,channel_type,title,created_at,updated_at)
VALUES('chat-global','global','Global chat',unixepoch(),unixepoch());

INSERT INTO achievement_definitions(id,slug,name,description,image_path,xp_reward,action_key,required_count,sort_order,created_at,updated_at) VALUES
('achievement-welcome','welcome-home','Welcome Home','Join Grev.dad and begin building your personal digital home.','/achievements/welcome-home.svg',50,'account.created',1,10,unixepoch(),unixepoch()),
('achievement-profile-first','profile-first-step','Profile First Step','Save your profile for the first time.','/achievements/profile-first-step.svg',75,'profile.edit',1,20,unixepoch(),unixepoch()),
('achievement-profile-builder','profile-builder','Profile Builder','Save ten profile improvements.','/achievements/profile-builder.svg',150,'profile.edit',10,30,unixepoch(),unixepoch()),
('achievement-dashboard-first','dashboard-first-step','Dashboard First Step','Save your first dashboard layout.','/achievements/dashboard-first-step.svg',75,'dashboard.edit',1,40,unixepoch(),unixepoch()),
('achievement-dashboard-designer','dashboard-designer','Dashboard Designer','Save ten dashboard layout changes.','/achievements/dashboard-designer.svg',150,'dashboard.edit',10,50,unixepoch(),unixepoch()),
('achievement-content-first','content-creator','Content Creator','Create your first functional content item.','/achievements/content-creator.svg',50,'content.create',1,60,unixepoch(),unixepoch()),
('achievement-task-master','task-master','Task Master','Complete ten tasks or reminders.','/achievements/task-master.svg',200,'task.complete',10,70,unixepoch(),unixepoch()),
('achievement-social','social-butterfly','Social Butterfly','React, subscribe or use a guestbook ten times.','/achievements/social-butterfly.svg',150,'profile.interaction',10,80,unixepoch(),unixepoch()),
('achievement-first-message','first-message','First Message','Send your first chat message.','/achievements/first-message.svg',50,'chat.message',1,90,unixepoch(),unixepoch()),
('achievement-global-voice','global-voice','Global Voice','Send twenty-five messages in Global chat.','/achievements/global-voice.svg',200,'chat.global',25,100,unixepoch(),unixepoch()),
('achievement-group-voice','group-voice','Group Voice','Send twenty-five messages in group chats.','/achievements/group-voice.svg',200,'chat.group',25,110,unixepoch(),unixepoch()),
('achievement-direct-starter','direct-starter','Conversation Starter','Send ten direct messages.','/achievements/direct-starter.svg',100,'chat.direct',10,120,unixepoch(),unixepoch()),
('achievement-gif-slinger','gif-slinger','GIF Slinger','Send five GIFs in chat.','/achievements/gif-slinger.svg',100,'chat.gif',5,130,unixepoch(),unixepoch()),
('achievement-level-five','level-five','Level Five','Reach profile level five.','/achievements/level-five.svg',250,'level.reached.5',1,140,unixepoch(),unixepoch()),
('achievement-level-ten','level-ten','Level Ten','Reach profile level ten.','/achievements/level-ten.svg',500,'level.reached.10',1,150,unixepoch(),unixepoch());

INSERT OR IGNORE INTO dashboard_features(
  id,slug,name,description,category,feature_type,tile_presentation,route,icon_text,audience,
  default_size,allowed_sizes,default_width,default_height,allowed_dimensions,
  is_active,is_default,sort_order,created_at,updated_at
) VALUES
('feature-chat-global','chat-global','Global chat','Live conversation shared by every Grev.dad member.','Chat','system','content','/dashboard#chat-global','CHAT','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,600,unixepoch(),unixepoch()),
('feature-chat-groups','chat-groups','Group chats','Live chats for the groups you belong to.','Chat','system','content','/dashboard#chat-groups','GROUP','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,610,unixepoch(),unixepoch()),
('feature-chat-direct','chat-direct','Direct messages','Your recent one-to-one conversations.','Chat','system','content','/dashboard#chat-direct','DM','all','large','medium,large,wide',3,2,'2x2,3x2,4x2,4x3',1,0,620,unixepoch(),unixepoch());
