const fs=require('node:fs');
const vm=require('node:vm');
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
const bundles={
  dashboard:['public/dashboard.js','public/dashboard-experience.js','public/platform-dashboard.js','public/dashboard-advanced.js','public/dashboard-collaboration.js','public/platform-live-quick.js'],
  profile:['public/profile-editor-unified.js','public/profile-editor-unified-a11y.js','public/profile-experience.js','public/platform-profile.js','public/site-shell.js','public/site-platform.js','public/profile-card-popover.js','public/chat-ui.js','public/chat-tabs.js','public/platform-live-quick.js','public/profile-guestbook-enhanced.js']
};
for(const[name,files]of Object.entries(bundles)){
  const source=files.map(file=>fs.readFileSync(file,'utf8')).join('\n');
  try{new vm.Script(source,{filename:`${name}.bundle.js`});}
  catch(error){throw new Error(`${name} browser bundle does not parse: ${error.message}`);}
}
console.log('Dashboard/profile completion static and bundle verification passed.');
