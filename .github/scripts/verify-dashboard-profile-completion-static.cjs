const fs=require('node:fs');
const required={
  'src/platform-completion.ts':['handlePlatformCompletionRequest','/api/platform/events','handleGuestbookActions','handleLegacyProfileRequest'],
  'src/completion-pages.ts':['Verified group membership','dashboard_page_collaborators','canCreateGroupPages','x+width>8','y>199'],
  'src/completion-core.ts':['platform_change_revision','revision,changed_at'],
  'src/completion-guestbook-actions.ts':['profile.guestbook_replied','profile.guestbook_pinned','profile.guestbook_reported','profile.member_blocked'],
  'src/completion-legacy.ts':['profile_subscriptions','handleGuestbookActions',"action==='subscribe'","action==='report'",'UUID_RE.test(parentId)','removeSubscriptionAfterBlock'],
  'migrations/20260721_complete_dashboard_profile.sql':['platform_change_revision','platform_change_content_items_update','platform_change_presence_update'],
  'public/platform-live-quick.js':['dashboard-inline-action','feature-quick-task','EventSource','BroadcastChannel','localEpoch(data.startsAt)'],
  'public/profile-guestbook-enhanced.js':['guestbook-inline-composer','data-guestbook-action','/report','/blocks/'],
  'src/worker.ts':['handlePlatformCompletionRequest','/platform-live-quick.js','/profile-guestbook-enhanced.js','/platform-completion.css']
};
for(const[file,needles]of Object.entries(required)){
  const text=fs.readFileSync(file,'utf8');
  for(const needle of needles)if(!text.includes(needle))throw new Error(`${file} missing ${needle}`);
}
console.log('Dashboard/profile completion static verification passed.');
