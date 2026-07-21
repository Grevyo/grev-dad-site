const fs=require('node:fs');
const required={
  'public/site-shell.js':['global-site-header','Admin centre','/api/site/settings','originalHeaderControls','global-header-compat'],
  'public/site-shell.css':['global-header-compat'],
  'public/chat-tabs.js':['Global','Private','Groups','Communities','/api/chat/context','scheduleApply','applying:false','childList:true,subtree:true'],
  'public/chat-tabs.css':['grid-template-columns:repeat(2,minmax(0,1fr))','text-overflow:ellipsis','grev-chat-room-heading button::before','opacity:.26','data-chat-close'],
  'public/admin.html':['data-admin-panel="default-dashboard"','data-admin-panel="chat"','data-admin-panel="settings"'],
  'public/admin-centre.js':['/api/admin/default-dashboard','/api/admin/centre','/api/admin/site-settings'],
  'src/admin-centre.ts':['dashboard_default_layouts','seedDashboard','/api/chat/context'],
  'src/worker.ts':['handleAdminCentreRequest','/site-shell.js','/chat-tabs.js']
};
for(const [file,needles] of Object.entries(required)){
  const text=fs.readFileSync(file,'utf8');
  for(const needle of needles)if(!text.includes(needle))throw new Error(`${file} is missing ${needle}`);
}
const chatTabs=fs.readFileSync('public/chat-tabs.js','utf8');
if(chatTabs.includes('attributes:true')||chatTabs.includes("attributeFilter:['class','hidden']"))throw new Error('Chat tabs must not observe attributes that they mutate themselves.');
const chatCss=fs.readFileSync('public/chat-tabs.css','utf8');
if(chatCss.includes('repeat(4,minmax(0,1fr))'))throw new Error('Chat categories must not be forced into four narrow sidebar columns.');
console.log('Admin centre and chat tabs static verification passed.');