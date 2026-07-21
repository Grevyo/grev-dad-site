const fs=require('node:fs');
const vm=require('node:vm');
const required={
  'src/feedback-centre.ts':['handleFeedbackCentreRequest','/api/feedback/config','/api/feedback/reports','/api/admin/feedback','release_previous_commit'],
  'public/feedback-centre.js':['Report a problem','diagnostics()','Feedback & release centre','failedRequests','screenshotDataUrl'],
  'public/feedback-centre.css':['#beta-feedback-button','#beta-site-banner','.feedback-report-card'],
  'migrations/20260721_beta_feedback_release_centre.sql':['feedback_reports','feedback_report_events','beta_enabled','release_commit'],
  'src/worker.ts':['handleFeedbackCentreRequest','/feedback-centre.js','/feedback-centre.css']
};
for(const[file,needles]of Object.entries(required)){
  const text=fs.readFileSync(file,'utf8');
  for(const needle of needles)if(!text.includes(needle))throw new Error(`${file} missing ${needle}`);
}
new vm.Script(fs.readFileSync('public/feedback-centre.js','utf8'),{filename:'feedback-centre.js'});
const worker=fs.readFileSync('src/worker.ts','utf8');
for(const route of ['/dashboard.js','/profile-editor-unified.js','/admin.js','/app.js','/hub.js']){
  const line=worker.split('\n').find(value=>value.includes(`url.pathname === '${route}'`));
  if(!line?.includes('/feedback-centre.js'))throw new Error(`${route} does not include feedback-centre.js`);
}
for(const route of ['/dashboard.css','/profile-editor-unified.css','/styles.css','/hub.css']){
  const line=worker.split('\n').find(value=>value.includes(`url.pathname === '${route}'`));
  if(!line?.includes('/feedback-centre.css'))throw new Error(`${route} does not include feedback-centre.css`);
}
console.log('Feedback and release centre verification passed.');