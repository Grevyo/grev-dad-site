# Dashboard and profile expansion programme

This programme expands the existing Dashboard and Profile foundations without creating separate incompatible tile or identity systems.

## Delivery principles

- PBE first; production only after explicit approval.
- Reuse the existing dashboard/profile tile renderers and editors.
- Shared concepts (visibility, themes, actions, activity and reusable profile cards) use shared schemas.
- Every migration remains backwards-compatible with existing dashboards and profiles.
- New editing features include Cancel restoration and no-save verification.

## Workstreams

### Dashboard

1. **Useful and live tiles**
   - Live data contract with refresh interval, loading, stale and error states.
   - Initial providers: activity, announcements, reminders, calendar/countdowns and service status.
   - Per-tile refresh and manual refresh without reloading the dashboard.

2. **Quick-action tiles**
   - Action contract with confirmation, success and error feedback.
   - Initial actions: create reminder, add calendar item, upload media, change status and open an internal destination.
   - Permission-aware execution; no arbitrary client-provided endpoints.

3. **Dashboard pages and groups**
   - Multiple personal pages with name, icon, order and default page.
   - Group-owned pages with membership/role access.
   - Tiles belong to a page rather than only to a user dashboard.
   - Page switcher and group context in the Dashboard header.

4. **Better editing experience**
   - Undo/redo history for tile add, remove, move, resize and appearance edits.
   - Duplicate tile and copy/paste appearance.
   - Autosaved local draft with explicit saved-state indicator.
   - Desktop/mobile preview modes and per-device ordering.
   - Restore last saved layout and reset one tile.

### Profile

1. **Personal homepage modules**
   - Module types for introduction, gallery, favourites, projects, links, achievements, activity and timeline.
   - Existing profile tiles remain compatible and become the custom/general module type.

2. **Field-level privacy**
   - Visibility on card fields, modules and media: account, verified, selected groups, admins, only me.
   - Server-side filtering based on the viewer; hidden data is never delivered to the client.

3. **Profile interaction**
   - Private-site guestbook/comments and simple reactions.
   - Owner moderation, delete and disable controls.
   - Notification events for new interactions.

4. **Profile themes**
   - Starting themes: Minimal, Personal homepage, Gaming, Photo, Retro web, Professional and Terminal.
   - Applying a theme changes presentation defaults without replacing content.
   - Users can customise after applying and restore the theme defaults.

5. **Reusable profile cards site-wide**
   - One permission-aware profile-card endpoint/component.
   - Use in member directory, groups, comments/activity, admin account views and identity popovers.
   - Card fields respect viewer-specific privacy.

## Shared persisted foundations

- `dashboard_pages`: personal or group-owned page metadata.
- `dashboard_page_members`: optional page-level access beyond the owning group.
- `dashboard_page_tiles`: page-scoped placement, appearance, live provider and action configuration.
- `profile_modules`: homepage module content and placement.
- `profile_visibility_rules`: field/module/media visibility policies.
- `profile_interactions`: guestbook entries, comments and reactions.
- `profile_theme`: selected theme and custom overrides.
- One server-filtered identity-card payload reused across the site.

## Delivery order

1. Shared schema foundations, page ownership, visibility policy and editor history.
2. Dashboard pages, undo/redo, duplication and quick-action framework.
3. Initial live tiles and action tiles.
4. Profile modules, themes and privacy editor.
5. Guestbook/reactions and notifications.
6. Site-wide profile-card adoption and group dashboards.

## Acceptance baseline

- Existing dashboards and profiles load unchanged after migration.
- A user can cancel every editor without persistent changes.
- All server responses enforce viewer permissions.
- Mobile and desktop have deliberate layouts and verified interactions.
- No arbitrary URLs or executable code are stored as actions.
