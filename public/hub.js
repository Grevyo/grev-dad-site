(() => {
  const $ = selector => document.querySelector(selector);
  const state = { session:null, modules:null, notifications:null, groups:[], active:'tasks', editing:null };
  const DEFINITIONS = {
    tasks:{type:'task',label:'Tasks',singular:'Task',description:'Personal work with completion and due dates.',fields:[['priority','Priority','select',['low','normal','high','urgent']],['progress','Progress %','number']]},
    calendar:{type:'event',label:'Calendar',singular:'Event',description:'Appointments, events and plans with start and end times.',fields:[['location','Location','text'],['allDay','All day','checkbox']]},
    reminders:{type:'reminder',label:'Reminders',singular:'Reminder',description:'Time-based prompts that feed notifications and dashboard tiles.',fields:[['repeat','Repeat','select',['never','daily','weekly','monthly','yearly']]]},
    projects:{type:'project',label:'Projects',singular:'Project',description:'Current projects with state, progress and links.',fields:[['status','Status','select',['planned','active','paused','complete']],['progress','Progress %','number'],['url','Project link','url']]},
    media:{type:'media',label:'Media library',singular:'Media item',description:'Reusable images, GIFs and links for your homepage.',fields:[['mediaUrl','Media URL','url'],['alt','Alternative text','text'],['category','Category','text']],media:true},
    favourites:{type:'favourite',label:'Favourites',singular:'Favourite',description:'Games, films, music, food, places and anything else.',fields:[['category','Category','select',['game','film','series','music','book','food','place','other']],['url','Link','url']]},
    achievements:{type:'achievement',label:'Achievements',singular:'Achievement',description:'Badges, awards, milestones and completed goals.',fields:[['date','Achievement date','date'],['icon','Short icon','text']]},
    gaming:{type:'gaming_account',label:'Gaming accounts',singular:'Gaming account',description:'Gaming identities and public usernames.',fields:[['platform','Platform','text'],['username','Account username','text'],['url','Profile URL','url']]},
    equipment:{type:'equipment',label:'Equipment',singular:'Equipment item',description:'PC hardware, peripherals, setup and other equipment.',fields:[['category','Category','text'],['model','Model','text'],['url','Product link','url']]},
    timeline:{type:'timeline',label:'Timeline',singular:'Timeline event',description:'Important dates and personal milestones.',fields:[['date','Timeline date','date'],['category','Category','text']]},
    posts:{type:'post',label:'Posts',singular:'Post',description:'Personal or group updates that can notify subscribers.',fields:[['mood','Mood / label','text']]},
    announcements:{type:'announcement',label:'Announcements',singular:'Announcement',description:'Administrator-managed updates for group members.',fields:[['importance','Importance','select',['normal','important','urgent']]]},
    notifications:{type:null,label:'Notifications',singular:'Notification',description:'Profile, reminder and group activity requiring attention.'}
  };
  const ORDER = Object.keys(DEFINITIONS);
  const api = async (path, options={}) => { const response=await fetch(path,{cache:'no-store',...options}); const payload=await response.json().catch(()=>({message:'Invalid server response.'})); if(!response.ok)throw new Error(payload.message||'Request failed.'); return payload; };
  const message=(text,type='')=>{const node=$('#hub-message');if(!node)return;node.textContent=text;node.className=`hub-message${type?` ${type}`:''}`;};
  const escape=value=>String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const toInputDate=timestamp=>timestamp?new Date(timestamp*1000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'';
  const fromInputDate=value=>value?Math.floor(new Date(value).getTime()/1000):null;
  const formatDate=timestamp=>timestamp?new Date(timestamp*1000).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):'';

  function ensureTabs(){
    const nav=$('#hub-tabs');
    nav.replaceChildren(...ORDER.map(key=>{const button=document.createElement('button');button.type='button';button.dataset.hubTab=key;button.className=key===state.active?'active':'';button.innerHTML=`<strong>${DEFINITIONS[key].label}</strong><span data-hub-count="${key}">0</span>`;button.addEventListener('click',()=>selectTab(key));return button;}));
  }
  function selectTab(key,{updateHash=true}={}){
    if(!DEFINITIONS[key])key='tasks';state.active=key;if(updateHash)history.replaceState(null,'',`#${key}`);
    document.querySelectorAll('[data-hub-tab]').forEach(button=>button.classList.toggle('active',button.dataset.hubTab===key));
    render();
  }
  function ownItems(key){const type=DEFINITIONS[key]?.type;return type?(state.modules?.byType?.[type]??[]):[];}
  function tabItems(key){if(key==='announcements')return state.modules?.groupAnnouncements??[];return ownItems(key);}
  function updateCounts(){
    ORDER.forEach(key=>{const node=document.querySelector(`[data-hub-count="${key}"]`);if(!node)return;node.textContent=String(key==='notifications'?(state.notifications?.unread??0):tabItems(key).length);});
  }
  function renderSummary(){
    const summary=$('#hub-summary');const counts=[['Open tasks',ownItems('tasks').filter(item=>!item.completedAt).length],['Upcoming events',ownItems('calendar').filter(item=>!item.startsAt||item.startsAt>=Date.now()/1000).length],['Projects',ownItems('projects').length],['Unread',state.notifications?.unread??0]];
    summary.replaceChildren(...counts.map(([label,value])=>{const article=document.createElement('article');article.innerHTML=`<span>${escape(label)}</span><strong>${value}</strong>`;return article;}));
  }
  function moduleFieldValue(item,key){return item?.data?.[key]??'';}
  function itemCard(item){
    const article=document.createElement('article');article.className=`hub-item-card${item.completedAt?' complete':''}`;article.dataset.itemId=item.id;
    const heading=document.createElement('div');const identity=document.createElement('div');identity.className='hub-item-identity';
    const title=document.createElement('strong');title.textContent=item.title;const meta=document.createElement('span');
    const bits=[];if(item.groupName)bits.push(item.groupName);if(item.startsAt)bits.push(formatDate(item.startsAt));if(item.data?.category)bits.push(item.data.category);if(item.data?.platform)bits.push(item.data.platform);meta.textContent=bits.join(' · ')||DEFINITIONS[state.active]?.singular||item.type;
    identity.append(title,meta);const actions=document.createElement('div');
    if(['task','reminder'].includes(item.type)&&item.canEdit){const complete=document.createElement('button');complete.type='button';complete.textContent=item.completedAt?'Reopen':'Complete';complete.addEventListener('click',()=>toggleComplete(item));actions.append(complete);}
    if(item.canEdit){const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.addEventListener('click',()=>openEditor(item));actions.append(edit);}
    heading.append(identity,actions);article.append(heading);
    if(item.body){const body=document.createElement('p');body.textContent=item.body;article.append(body);}
    const detail=document.createElement('div');detail.className='hub-item-details';
    const details=[];for(const [key,value] of Object.entries(item.data||{})){if(value!==''&&value!==null&&value!==false&&key!=='mediaUrl')details.push(`${key.replaceAll('_',' ')}: ${value}`);}
    if(item.endsAt)details.push(`Ends ${formatDate(item.endsAt)}`);if(item.visibility!=='private')details.push(item.visibility==='group'?`Visible to ${item.groupName||'group'}`:`Visible to ${item.visibility}`);detail.textContent=details.join(' · ');if(detail.textContent)article.append(detail);
    if(item.type==='media'&&item.data?.mediaUrl){const media=document.createElement('img');media.className='hub-media-preview';media.src=item.data.mediaUrl;media.alt=item.data.alt||item.title;media.loading='lazy';article.append(media);}
    if(item.owner&&item.owner.id!==state.session?.user?.id){const author=document.createElement('button');author.type='button';author.className='hub-item-author';author.dataset.profileUserId=item.owner.id;author.textContent=`By ${item.owner.displayName} (@${item.owner.username})`;article.append(author);}
    return article;
  }
  function notificationCard(item){
    const article=document.createElement('article');article.className=`hub-notification${item.readAt?'':' unread'}`;
    const heading=document.createElement('div');const identity=document.createElement('div');const title=document.createElement('strong');title.textContent=item.title;const date=document.createElement('span');date.textContent=formatDate(item.createdAt);identity.append(title,date);
    const actions=document.createElement('div');if(!item.readAt){const read=document.createElement('button');read.type='button';read.textContent='Mark read';read.addEventListener('click',()=>notificationAction('read',item.id));actions.append(read);}const remove=document.createElement('button');remove.type='button';remove.textContent='Delete';remove.addEventListener('click',()=>notificationAction('delete',item.id));actions.append(remove);heading.append(identity,actions);article.append(heading);
    if(item.body){const body=document.createElement('p');body.textContent=item.body;article.append(body);}if(item.actor){const actor=document.createElement('button');actor.type='button';actor.className='hub-item-author';actor.dataset.profileUserId=item.actor.id;actor.textContent=`${item.actor.displayName} (@${item.actor.username})`;article.append(actor);}if(item.targetUrl){const open=document.createElement('a');open.href=item.targetUrl;open.textContent='Open →';article.append(open);}return article;
  }
  function renderNotifications(container){
    const toolbar=document.createElement('div');toolbar.className='hub-list-toolbar';toolbar.innerHTML='<div><strong>Notifications</strong><span>Account, profile, reminders and group activity.</span></div>';
    const readAll=document.createElement('button');readAll.type='button';readAll.textContent='Mark all read';readAll.disabled=!state.notifications?.unread;readAll.addEventListener('click',()=>notificationAction('read-all'));toolbar.append(readAll);container.append(toolbar);
    const list=document.createElement('div');list.className='hub-item-list';const items=state.notifications?.notifications??[];if(items.length)list.append(...items.map(notificationCard));else list.innerHTML='<p class="hub-empty">No notifications yet.</p>';container.append(list);
  }
  function render(){
    updateCounts();renderSummary();const content=$('#hub-content');content.replaceChildren();const definition=DEFINITIONS[state.active];
    if(state.active==='notifications'){renderNotifications(content);return;}
    const toolbar=document.createElement('div');toolbar.className='hub-list-toolbar';toolbar.innerHTML=`<div><strong>${escape(definition.label)}</strong><span>${escape(definition.description)}</span></div>`;
    const create=document.createElement('button');create.type='button';create.textContent=`Add ${definition.singular.toLowerCase()}`;create.addEventListener('click',()=>openEditor(null,state.active));toolbar.append(create);content.append(toolbar);
    const list=document.createElement('div');list.className='hub-item-list';const items=tabItems(state.active);if(items.length)list.append(...items.map(itemCard));else list.innerHTML=`<p class="hub-empty">No ${definition.label.toLowerCase()} yet. Add the first one.</p>`;content.append(list);
  }

  function updateVisibility(){const visibility=$('#hub-item-visibility').value;$('#hub-group-control').hidden=visibility!=='group'&&!['announcement'].includes($('#hub-item-type').value);}
  function dynamicField(definition,key,label,type,options=[]){
    const wrapper=document.createElement('label');wrapper.dataset.dynamicKey=key;wrapper.textContent=label;let input;
    if(type==='select'){input=document.createElement('select');options.forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value.replaceAll('_',' ');input.append(option);});}
    else if(type==='checkbox'){input=document.createElement('input');input.type='checkbox';wrapper.classList.add('hub-check');}
    else{input=document.createElement('input');input.type=type; if(type==='number'){input.min='0';input.max='100';}}
    input.dataset.hubField=key;wrapper.append(input);return wrapper;
  }
  function renderDynamicFields(item){
    const key=Object.keys(DEFINITIONS).find(candidate=>DEFINITIONS[candidate].type===$('#hub-item-type').value)||'tasks';const definition=DEFINITIONS[key];const target=$('#hub-dynamic-fields');target.replaceChildren();
    for(const field of definition.fields??[]){const node=dynamicField(definition,...field);const input=node.querySelector('[data-hub-field]');const value=moduleFieldValue(item,field[0]);if(input.type==='checkbox')input.checked=Boolean(value);else input.value=value;target.append(node);}
    if(definition.media){const upload=document.createElement('label');upload.className='hub-upload';upload.innerHTML='<span>Upload picture or GIF</span><input id="hub-media-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small>Up to 1.4 MB. The reusable media is stored with this item.</small>';upload.querySelector('input').addEventListener('change',handleMediaFile);target.append(upload);}
    $('#hub-start-control').hidden=!['task','reminder','event','timeline'].includes(definition.type);$('#hub-end-control').hidden=!['event','reminder'].includes(definition.type);$('#hub-body-control').firstChild.textContent=definition.type==='post'?'Post':definition.type==='announcement'?'Announcement':'Details';
  }
  async function handleMediaFile(event){const file=event.target.files?.[0];if(!file)return;if(file.size>1_400_000){message('Media must be 1.4 MB or smaller.','error');event.target.value='';return;}const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});const field=document.querySelector('[data-hub-field="mediaUrl"]');if(field)field.value=url;}
  function populateGroups(){const select=$('#hub-item-group');select.replaceChildren(...state.groups.map(group=>{const option=document.createElement('option');option.value=group.id;option.textContent=group.name;return option;}));}
  function openEditor(item=null,key=state.active){
    const definition=DEFINITIONS[key]?.type?DEFINITIONS[key]:DEFINITIONS.tasks;state.editing=item;$('#hub-editor-title').textContent=item?`Edit ${definition.singular.toLowerCase()}`:`Create ${definition.singular.toLowerCase()}`;$('#hub-editor-description').textContent=definition.description;
    const type=$('#hub-item-type');type.replaceChildren(...ORDER.filter(tab=>DEFINITIONS[tab].type).map(tab=>{const option=document.createElement('option');option.value=DEFINITIONS[tab].type;option.textContent=DEFINITIONS[tab].singular;option.selected=DEFINITIONS[tab].type===(item?.type??definition.type);return option;}));
    $('#hub-item-title').value=item?.title??'';$('#hub-item-body').value=item?.body??'';$('#hub-item-start').value=toInputDate(item?.startsAt);$('#hub-item-end').value=toInputDate(item?.endsAt);$('#hub-item-visibility').value=item?.visibility??(definition.type==='announcement'?'group':'private');$('#hub-item-pinned').checked=Boolean(item?.pinned);populateGroups();if(item?.groupId)$('#hub-item-group').value=item.groupId;renderDynamicFields(item);updateVisibility();$('#hub-delete-item').hidden=!item;
    const dialog=$('#hub-editor');if(!dialog.open)dialog.showModal();setTimeout(()=>$('#hub-item-title').focus(),0);
  }
  function collectData(){const result={};document.querySelectorAll('[data-hub-field]').forEach(input=>{result[input.dataset.hubField]=input.type==='checkbox'?input.checked:input.type==='number'&&input.value!==''?Number(input.value):input.value;});return result;}
  async function saveItem(event){event.preventDefault();const payload={type:$('#hub-item-type').value,title:$('#hub-item-title').value.trim(),body:$('#hub-item-body').value.trim(),startsAt:fromInputDate($('#hub-item-start').value),endsAt:fromInputDate($('#hub-item-end').value),visibility:$('#hub-item-visibility').value,groupId:$('#hub-item-visibility').value==='group'||$('#hub-item-type').value==='announcement'?$('#hub-item-group').value:null,pinned:$('#hub-item-pinned').checked,data:collectData()};message('Saving content…');try{await api(state.editing?`/api/platform/items/${state.editing.id}`:'/api/platform/items',{method:state.editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});$('#hub-editor').close();await load();message('Content saved.','success');}catch(error){message(error.message,'error');}}
  async function deleteItem(){if(!state.editing||!confirm(`Delete ${state.editing.title}?`))return;try{await api(`/api/platform/items/${state.editing.id}`,{method:'DELETE'});$('#hub-editor').close();await load();message('Content deleted.','success');}catch(error){message(error.message,'error');}}
  async function toggleComplete(item){try{await api(`/api/platform/items/${item.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:!item.completedAt})});await load();}catch(error){message(error.message,'error');}}
  async function notificationAction(action,id=null){try{state.notifications=await api('/api/platform/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id})});render();}catch(error){message(error.message,'error');}}

  function renderStatus(){const presence=state.modules?.presence??{};$('#hub-status-summary').textContent=[presence.availability||'offline',presence.statusText,presence.activityType!=='none'&&presence.activityText?`${presence.activityType} ${presence.activityText}`:''].filter(Boolean).join(' · ');}
  function openStatus(){const presence=state.modules?.presence??{};$('#hub-presence-availability').value=presence.availability||'online';$('#hub-presence-type').value=presence.activityType||'none';$('#hub-presence-text').value=presence.statusText||'';$('#hub-presence-activity').value=presence.activityText||'';$('#hub-presence-expires').value=toInputDate(presence.expiresAt);$('#hub-status-editor').showModal();}
  async function saveStatus(event){event.preventDefault();try{await api('/api/platform/presence',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({availability:$('#hub-presence-availability').value,activityType:$('#hub-presence-type').value,statusText:$('#hub-presence-text').value.trim(),activityText:$('#hub-presence-activity').value.trim(),expiresAt:fromInputDate($('#hub-presence-expires').value)})});$('#hub-status-editor').close();await load();message('Status updated.','success');}catch(error){message(error.message,'error');}}

  async function load(){message('Loading content…');const [modules,notifications,pages]=await Promise.all([api('/api/platform/modules'),api('/api/platform/notifications'),api('/api/experience/dashboard/pages')]);state.modules=modules;state.notifications=notifications;state.groups=pages.groups??[];renderStatus();render();message(`${modules.items.length} content item${modules.items.length===1?'':'s'} available.`,'success');}
  async function init(){
    state.session=await api('/api/auth/session');if(!state.session.authenticated)return location.replace('/login');$('#hub-admin-link').hidden=!state.session.user?.isAdmin;ensureTabs();
    const hash=location.hash.slice(1);if(hash.startsWith('new-')){const type=hash.slice(4);const key=Object.keys(DEFINITIONS).find(candidate=>DEFINITIONS[candidate].type===type)||'tasks';state.active=key;}else if(DEFINITIONS[hash])state.active=hash;
    ensureTabs();await load();if(hash.startsWith('new-'))openEditor(null,state.active);
  }
  $('#hub-create')?.addEventListener('click',()=>openEditor(null,state.active==='notifications'?'tasks':state.active));$('#hub-edit-status')?.addEventListener('click',openStatus);$('#hub-item-type')?.addEventListener('change',()=>{renderDynamicFields(null);updateVisibility();});$('#hub-item-visibility')?.addEventListener('change',updateVisibility);$('#hub-editor-form')?.addEventListener('submit',saveItem);$('#hub-delete-item')?.addEventListener('click',deleteItem);document.querySelectorAll('[data-hub-close]').forEach(button=>button.addEventListener('click',()=>$('#hub-editor').close()));document.querySelectorAll('[data-status-close]').forEach(button=>button.addEventListener('click',()=>$('#hub-status-editor').close()));$('#hub-status-form')?.addEventListener('submit',saveStatus);$('#logout')?.addEventListener('click',async()=>{await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});location.replace('/');});
  init().catch(error=>message(error.message,'error'));
})();
