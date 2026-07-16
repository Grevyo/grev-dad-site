PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO roles(id,name,description,is_system,created_at,updated_at)
VALUES('role-admin','Administrator','Can manage users, verification and private groups.',1,unixepoch(),unixepoch());

INSERT OR IGNORE INTO permissions(permission_key,description) VALUES
('admin.view','Open the administration centre.'),
('users.view','View registered user accounts.'),
('users.verify','Verify and unverify accounts.'),
('users.status.manage','Suspend, disable and reactivate accounts.'),
('groups.private.assign','Assign hidden private groups.'),
('admins.manage','Promote and remove administrators.'),
('audit.view','View account administration history.');

INSERT OR IGNORE INTO role_permissions(role_id,permission_key) VALUES
('role-admin','admin.view'),
('role-admin','users.view'),
('role-admin','users.verify'),
('role-admin','users.status.manage'),
('role-admin','groups.private.assign'),
('role-admin','audit.view');

CREATE INDEX IF NOT EXISTS users_status_created_idx ON users(status,created_at);
CREATE INDEX IF NOT EXISTS audit_events_target_created_idx ON audit_events(target_id,created_at);
CREATE INDEX IF NOT EXISTS audit_events_actor_created_idx ON audit_events(actor_user_id,created_at);