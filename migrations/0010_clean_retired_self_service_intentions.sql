PRAGMA foreign_keys = ON;

-- Remove memberships granted only by retired intention options. Relationship groups
-- are deliberately preserved because they are now controlled by the separate
-- relationship onboarding stage.
DELETE FROM group_memberships
WHERE group_id IN (
  SELECT igg.group_id
  FROM intention_group_grants igg
  JOIN intention_options io ON io.id = igg.intention_id
  WHERE io.is_active = 0
)
AND group_id NOT IN (SELECT group_id FROM relationship_group_grants);

DELETE FROM user_intentions
WHERE intention_id IN (SELECT id FROM intention_options WHERE is_active = 0);

DELETE FROM intention_group_grants
WHERE intention_id IN (SELECT id FROM intention_options WHERE is_active = 0);
