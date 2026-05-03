(function(){
  if (window.GREVChat) return;
  const state={rooms:[],selectedRoomId:null,lastMessageId:0,poller:null,open:false};
  async function api(url,options){const r=await fetch(url,options);const d=await r.json().catch(()=>({ok:false,error:'Invalid JSON'}));if(!r.ok||!d?.ok) throw new Error(d?.error||'Request failed');return d;}
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
  function mount(){ if(document.getElementById('chat-launcher')) return;
    const launcher=el('button','chat-launcher','Chat'); launcher.id='chat-launcher';
    const popup=el('section','chat-popup'); popup.id='chat-popup';
    popup.innerHTML='<div class="chat-header"><strong>Chat</strong><button type="button" id="chat-close">×</button></div><div class="chat-private-start"><input id="chat-dm-user" placeholder="username"/><button id="chat-dm-start" type="button">Start</button></div><select id="chat-room-list" class="chat-room-list"></select><div id="chat-message-list" class="chat-message-list">Loading…</div><div class="chat-input-row"><input id="chat-input" maxlength="1000" placeholder="Message"/><button id="chat-send" type="button">Send</button></div>';
    document.body.append(launcher,popup);
    launcher.onclick=()=>{state.open=true; popup.classList.add('chat-popup-open'); loadRooms();};
    popup.querySelector('#chat-close').onclick=()=>{state.open=false; popup.classList.remove('chat-popup-open');};
    popup.querySelector('#chat-room-list').onchange=(e)=>selectRoom(Number(e.target.value));
    popup.querySelector('#chat-send').onclick=sendMessage;
    popup.querySelector('#chat-dm-start').onclick=startDm;
    window.addEventListener('beforeunload',()=>{if(state.poller)clearInterval(state.poller);});
  }
  function renderMessages(messages,target){target.textContent=''; messages.forEach(m=>{const row=el('div','chat-message'+(window.GREVChat.currentUserId===m.sender_user_id?' chat-message-own':'')); const meta=el('div','chat-message-meta',`${m.sender_display_name||m.sender_username} · ${new Date(m.created_at).toLocaleTimeString()}`); const body=el('div','chat-message-body'); body.textContent=m.body; row.append(meta,body); target.append(row); state.lastMessageId=Math.max(state.lastMessageId,Number(m.id)||0);}); }
  async function loadRooms(){try{const d=await api('/api/chat/rooms'); state.rooms=d.rooms||[]; const sel=document.getElementById('chat-room-list'); sel.textContent=''; state.rooms.forEach(r=>{const o=el('option','',`${r.name}${r.unread_count?` (${r.unread_count})`:''}`); o.value=String(r.id); sel.append(o);}); if(!state.selectedRoomId&&state.rooms[0]) state.selectedRoomId=state.rooms[0].id; if(state.selectedRoomId) {sel.value=String(state.selectedRoomId); await loadMessages();} if(state.poller) clearInterval(state.poller); state.poller=setInterval(()=>{if(state.open&&state.selectedRoomId) loadMessages(true);},5000);}catch{}}
  async function loadMessages(incremental){const list=document.getElementById('chat-message-list'); if(!list) return; try{const q=`/api/chat/messages?room_id=${state.selectedRoomId}${incremental&&state.lastMessageId?`&after_id=${state.lastMessageId}`:''}`;const d=await api(q); if(incremental){renderMessages([...(d.messages||[])],list);} else {state.lastMessageId=0; renderMessages(d.messages||[],list);} list.scrollTop=list.scrollHeight; if(state.lastMessageId) await api('/api/chat/read',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({room_id:state.selectedRoomId,last_read_message_id:state.lastMessageId})}); }catch{list.textContent='Chat unavailable.';}}
  async function sendMessage(){const input=document.getElementById('chat-input'); const body=(input.value||'').trim(); if(!body||!state.selectedRoomId) return; try{await api('/api/chat/messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({room_id:state.selectedRoomId,body})}); input.value=''; await loadMessages(true);}catch{}}
  async function startDm(){const input=document.getElementById('chat-dm-user'); const username=(input.value||'').trim(); if(!username) return; try{const d=await api('/api/chat/direct',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username})}); state.selectedRoomId=d.room.id; input.value=''; await loadRooms();}catch{}}
  async function selectRoom(roomId){state.selectedRoomId=roomId; state.lastMessageId=0; await loadMessages();}
  window.GREVChat={mount,currentUserId:null,openRoom:async function(id){if(!document.getElementById('chat-popup'))mount();state.open=true;document.getElementById('chat-popup').classList.add('chat-popup-open');state.selectedRoomId=id;await loadRooms();}};
})();
