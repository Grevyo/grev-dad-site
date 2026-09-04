-- Home milestones already contribute to Home's activity XP; mirroring them must
-- not award that XP for a second time. IDs are provider-qualified.
INSERT OR IGNORE INTO achievement_definitions(id,name,description,image_url,xp_reward,category,criteria_type,criteria_value,sort_order) VALUES
('grev-home:first-session','Home: First Boot','Complete your first managed app session.','',0,'Grev Home','grev_home_sessions',1,500),
('grev-home:one-hour','Home: Settling In','Track one hour in Grev Home.','',0,'Grev Home','grev_home_seconds',3600,501),
('grev-home:ten-hours','Home: Regular','Track ten hours in Grev Home.','',0,'Grev Home','grev_home_seconds',36000,502),
('grev-home:hundred-hours','Home: Centurion','Track one hundred hours in Grev Home.','',0,'Grev Home','grev_home_seconds',360000,503),
('grev-home:five-apps','Home: Explorer','Use five different managed apps.','',0,'Grev Home','grev_home_apps',5,504),
('grev-home:twenty-apps','Home: Library Hopper','Use twenty different managed apps.','',0,'Grev Home','grev_home_apps',20,505),
('grev-home:fifty-sessions','Home: Session Veteran','Complete fifty managed app sessions.','',0,'Grev Home','grev_home_sessions',50,506),
('grev-home:level-five','Home: Level Five','Reach account level five, or earn the original local Home level-five milestone.','',0,'Grev Home','grev_home_level',5,507),
('grev-home:level-ten','Home: Double Digits','Reach account level ten, or earn the original local Home level-ten milestone.','',0,'Grev Home','grev_home_level',10,508);

UPDATE achievement_definitions SET image_url='/achievement-badges/collector.svg'
WHERE category='Grev Home' AND image_url='';
