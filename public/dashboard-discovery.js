(() => {
  if(typeof dashboardState==='undefined'||typeof createTileContent!=='function')return;
  const moduleState={payload:null,monthOffset:0,loading:false,timer:null};
  const api=async path=>{const response=await fetch(path,{cache:'no-store'});const payload=await response.json();if(!response.ok)throw new Error(payload.message||'Dashboard module request failed.');return payload;};
  const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const eventDate=item=>item?.startsAt?new Date(item.startsAt*1000):null;
  const events=()=>moduleState.payload?.byType?.event||[];
  const eventsOn=date=>events().filter(item=>{const value=eventDate(item);return value&&dateKey(value)===dateKey(date);}).sort((a,b)=>(a.startsAt||0)-(b.startsAt||0));
  const monthDate=()=>{const now=new Date();return new Date(now.getFullYear(),now.getMonth()+moduleState.monthOffset,1);};
  const timeLabel=item=>item.startsAt?new Date(item.startsAt*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'All day';

  function calendarTile(feature,editing){
    const element=document.createElement('div');element.className='dashboard-tile-content dashboard-content-tile dashboard-month-calendar';
    const month=monthDate(),today=new Date(),monthName=month.toLocaleDateString([],{month:'long',year:'numeric'});
    const heading=document.createElement('div');heading.className='dashboard-calendar-heading';
    const identity=document.createElement('div');const label=document.createElement('span');label.className='dashboard-content-label';label.textContent=editing?'CALENDAR PREVIEW':'CALENDAR';const title=document.createElement('strong');title.textContent=monthName;identity.append(label,title);heading.append(identity);
    if(!editing){const controls=document.createElement('div');controls.className='dashboard-calendar-controls';[[-1,'Previous month'],[0,'Current month'],[1,'Next month']].forEach(([delta,text])=>{const button=document.createElement('button');button.type='button';button.textContent=delta===-1?'‹':delta===1?'›':'Today';button.title=text;button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();moduleState.monthOffset=delta===0?0:moduleState.monthOffset+delta;renderDashboardGrid();});controls.append(button);});heading.append(controls);}
    element.append(heading);
    const weekdays=document.createElement('div');weekdays.className='dashboard-calendar-weekdays';['M','T','W','T','F','S','S'].forEach(day=>{const node=document.createElement('span');node.textContent=day;weekdays.append(node);});element.append(weekdays);
    const grid=document.createElement('div');grid.className='dashboard-calendar-grid';const mondayOffset=(month.getDay()+6)%7;const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let index=0;index<42;index+=1){const day=index-mondayOffset+1;const cell=document.createElement('span');cell.className='dashboard-calendar-day';if(day<1||day>days){cell.classList.add('outside');cell.textContent='';}else{const date=new Date(month.getFullYear(),month.getMonth(),day),dayEvents=eventsOn(date);cell.textContent=String(day);if(dateKey(date)===dateKey(today))cell.classList.add('today');if(dayEvents.length){cell.classList.add('has-events');cell.title=dayEvents.map(item=>`${timeLabel(item)} ${item.title}`).join('\n');const count=document.createElement('b');count.textContent=dayEvents.length>1?String(dayEvents.length):'';cell.append(count);}}grid.append(cell);}element.append(grid);
    const todayPanel=document.createElement('section');todayPanel.className='dashboard-calendar-today';const todayTitle=document.createElement('strong');todayTitle.textContent='Today';todayPanel.append(todayTitle);const todayEvents=eventsOn(today);
    if(!todayEvents.length){const empty=document.createElement('span');empty.textContent=moduleState.payload?'Nothing scheduled today.':'Loading today’s events…';todayPanel.append(empty);}else todayEvents.slice(0,3).forEach(item=>{const row=document.createElement('div');const time=document.createElement('b');time.textContent=timeLabel(item);const name=document.createElement('span');name.textContent=item.title;row.append(time,name);todayPanel.append(row);});element.append(todayPanel);
    if(!editing){const link=document.createElement('a');link.className='platform-module-open';link.href=feature.route||'/hub#calendar';link.textContent='Open full calendar →';element.append(link);}return element;
  }

  const baseCreateTileContent=createTileContent;
  createTileContent=function discoveryTileContent(feature,preferences,editing=false){if(feature.id==='feature-module-calendar')return calendarTile(feature,editing);return baseCreateTileContent(feature,preferences,editing);};

  async function refreshModules(render=false){if(moduleState.loading)return;moduleState.loading=true;try{moduleState.payload=await api('/api/platform/modules');if(render&&dashboardState.payload&&!dashboardState.editing)renderDashboardGrid();}catch{}finally{moduleState.loading=false;}}

  function ensurePicker(){
    let dialog=document.querySelector('#dashboard-tile-picker-dialog');if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='dashboard-tile-picker-dialog';dialog.className='dashboard-tile-picker-dialog';dialog.setAttribute('aria-labelledby','dashboard-tile-picker-title');
    const shell=document.createElement('div');shell.className='dashboard-tile-picker-shell';const heading=document.createElement('header');heading.innerHTML='<div><p class="eyebrow">Dashboard tiles</p><h2 id="dashboard-tile-picker-title">Choose a tile to add</h2><p>Every tile available to your account is shown here. Search or filter, then place it directly onto the dashboard.</p></div><button type="button" data-close-tile-picker>Close</button>';const body=document.createElement('div');body.className='dashboard-tile-picker-body';const catalogue=document.querySelector('#dashboard-editor-catalogue-panel');if(catalogue){catalogue.hidden=false;body.append(catalogue);}shell.append(heading,body);dialog.append(shell);document.body.append(dialog);
    dialog.querySelector('[data-close-tile-picker]')?.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();const target=event.target instanceof Element?event.target:null;const button=target?.closest('#dashboard-catalogue button');if(button&&button.textContent==='Place tile')setTimeout(()=>dialog.close(),0);});return dialog;
  }
  function ensureAddButton(){let button=document.querySelector('#dashboard-open-tile-picker');if(button)return button;const actions=document.querySelector('.dashboard-editor-actions'),pack=document.querySelector('#dashboard-pack-layout');if(!actions)return null;button=document.createElement('button');button.id='dashboard-open-tile-picker';button.type='button';button.className='dashboard-add-tile-button';button.textContent='Add custom tile';button.hidden=true;button.addEventListener('click',()=>{if(!dashboardState.editing)return;const dialog=ensurePicker();renderCatalogueTools();renderCatalogue();dialog.showModal();setTimeout(()=>document.querySelector('#dashboard-feature-search')?.focus(),0);});actions.insertBefore(button,pack||actions.firstChild);return button;}
  const baseOpenEditor=openEditor;openEditor=function discoveryOpenEditor(){baseOpenEditor();if(!dashboardState.editing)return;ensurePicker();const button=ensureAddButton();if(button)button.hidden=false;};
  const baseCloseEditor=closeEditor;closeEditor=function discoveryCloseEditor(saved=false){document.querySelector('#dashboard-tile-picker-dialog')?.close();const button=document.querySelector('#dashboard-open-tile-picker');if(button)button.hidden=true;baseCloseEditor(saved);};

  async function init(){ensureAddButton();for(let attempt=0;attempt<80&&!dashboardState.payload;attempt+=1)await new Promise(resolve=>setTimeout(resolve,100));await refreshModules(true);moduleState.timer=setInterval(()=>{if(!document.hidden)refreshModules(true);},30000);document.addEventListener('grev:platform-changed',()=>refreshModules(true));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
