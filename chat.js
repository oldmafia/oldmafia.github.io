// ==================== SUPABASE INIT ====================
const supabaseUrl = 'https://ftfciebnywbondaiarnc.supabase.co';
const supabaseKey = 'sb_publishable_eQZDSu_Jy1gWmXJFF800Pw_TP2kBRLI';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==================== STATE ====================
let currentUser = null;
let currentProfile = null;
let currentRoom = null;
let currentPMUser = null;
let messageSubscription = null;
let pmSubscription = null;
let onlineInterval = null;
let unreadPM = {};
const ADMIN_ID = null; // will be set after login check

// ==================== INIT ====================
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showLoginModal();
    return;
  }
  currentUser = session.user;
  await loadProfile();
  setupUI();
  loadRooms();
  loadUsers();
  loadFriends();
  loadPMList();
  startOnlinePresence();
  setupNavigation();
  setupTheme();
  buildEmojiPanel();
  subscribeToNotifications();
}

// ==================== AUTH ====================
function showLoginModal() {
  const m = document.createElement('div');
  m.className = 'modal';
  m.id = 'loginModal';
  m.innerHTML = `
    <div class="modal-content">
      <h2 style="color:var(--accent);margin-bottom:15px;">🏴 Old Mafia</h2>
      <input type="email" id="loginEmail" placeholder="ელ-ფოსტა" style="width:100%;padding:10px;border-radius:20px;border:1px solid var(--accent);background:var(--bg);color:var(--text);margin-bottom:8px;outline:none;">
      <input type="password" id="loginPass" placeholder="პაროლი" style="width:100%;padding:10px;border-radius:20px;border:1px solid var(--accent);background:var(--bg);color:var(--text);margin-bottom:10px;outline:none;">
      <button onclick="doLogin()" style="width:100%;margin-bottom:5px;">შესვლა</button>
      <button onclick="doRegister()" style="width:100%;background:#5a0000;">რეგისტრაცია</button>
      <div id="loginError" style="color:#ff6666;margin-top:8px;font-size:12px;"></div>
    </div>`;
  document.body.appendChild(m);
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) { document.getElementById('loginError').textContent = error.message; return; }
  currentUser = data.user;
  document.getElementById('loginModal').remove();
  await loadProfile();
  setupUI();
  loadRooms();
  loadUsers();
  loadFriends();
  loadPMList();
  startOnlinePresence();
  setupNavigation();
  setupTheme();
  buildEmojiPanel();
  subscribeToNotifications();
}

async function doRegister() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const username = email.split('@')[0];
  const { data, error } = await supabase.auth.signUp({ email, password: pass });
  if (error) { document.getElementById('loginError').textContent = error.message; return; }
  if (data.user) {
    await supabase.from('profiles').insert({ id: data.user.id, username, avatar_url: null, status: '' });
    document.getElementById('loginError').textContent = 'დარეგისტრირდი! შედი ანგარიშში.';
  }
}

async function logout() {
  if (onlineInterval) clearInterval(onlineInterval);
  await supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', currentUser.id);
  await supabase.auth.signOut();
  location.reload();
}

// ==================== PROFILE ====================
async function loadProfile() {
  const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
  if (data) {
    currentProfile = data;
  } else {
    const username = currentUser.email.split('@')[0];
    await supabase.from('profiles').insert({ id: currentUser.id, username, avatar_url: null, status: '' });
    currentProfile = { id: currentUser.id, username, avatar_url: null, status: '', is_admin: false };
  }
}

function setupUI() {
  document.getElementById('profileName').textContent = currentProfile.username;
  document.getElementById('statusInput').value = currentProfile.status || '';
  const av = document.getElementById('profileAvatar');
  if (currentProfile.avatar_url) {
    av.style.backgroundImage = `url(${currentProfile.avatar_url})`;
    av.textContent = '';
  }
  loadAlbum();
}

async function saveStatus() {
  const s = document.getElementById('statusInput').value;
  await supabase.from('profiles').update({ status: s }).eq('id', currentUser.id);
  currentProfile.status = s;
  showNotification('სტატუსი შენახულია ✓');
}

async function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop();
  const path = `avatars/${currentUser.id}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if (error) { showNotification('შეცდომა: ' + error.message); return; }
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = urlData.publicUrl;
  await supabase.from('profiles').update({ avatar_url: url }).eq('id', currentUser.id);
  currentProfile.avatar_url = url;
  const av = document.getElementById('profileAvatar');
  av.style.backgroundImage = `url(${url})`;
  av.textContent = '';
  showNotification('ავატარი განახლდა ✓');
}

async function removeAvatar() {
  await supabase.from('profiles').update({ avatar_url: null }).eq('id', currentUser.id);
  currentProfile.avatar_url = null;
  const av = document.getElementById('profileAvatar');
  av.style.backgroundImage = '';
  av.textContent = '👤';
  showNotification('ავატარი წაიშალა');
}

async function loadAlbum() {
  const { data } = await supabase.from('user_photos').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  const grid = document.getElementById('albumGrid');
  if (!grid) return;
  grid.innerHTML = '';
  (data || []).forEach(p => {
    const img = document.createElement('img');
    img.className = 'album-photo';
    img.src = p.photo_url;
    img.onclick = () => openPhotoModal(p);
    grid.appendChild(img);
  });
}

async function addToAlbum(input) {
  const file = input.files[0];
  if (!file) return;
  const path = `album/${currentUser.id}/${Date.now()}.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: false });
  if (error) { showNotification('შეცდომა: ' + error.message); return; }
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  await supabase.from('user_photos').insert({ user_id: currentUser.id, photo_url: urlData.publicUrl });
  loadAlbum();
  showNotification('ფოტო დაემატა ✓');
}

// ==================== PHOTO MODAL ====================
function openPhotoModal(photo) {
  const existing = document.getElementById('photoModal');
  if (existing) existing.remove();
  const m = document.createElement('div');
  m.className = 'photo-modal';
  m.id = 'photoModal';
  m.innerHTML = `
    <div class="photo-modal-content">
      <img class="photo-modal-img" src="${photo.photo_url}">
      <div class="photo-comments" id="photoComments"></div>
      <div class="comment-input-area">
        <input class="comment-input" id="commentInput" placeholder="კომენტარი...">
        <button onclick="addPhotoComment('${photo.id}')">➤</button>
      </div>
      <button onclick="document.getElementById('photoModal').remove()" style="width:100%;margin-top:5px;background:#5a0000;">დახურვა</button>
    </div>`;
  document.body.appendChild(m);
  loadPhotoComments(photo.id);
}

async function loadPhotoComments(photoId) {
  const { data } = await supabase.from('photo_comments').select('*, profiles(username)').eq('photo_id', photoId).order('created_at');
  const div = document.getElementById('photoComments');
  if (!div) return;
  div.innerHTML = (data || []).map(c => `<div class="comment-item"><b>${c.profiles?.username}</b>: ${c.content}</div>`).join('');
}

async function addPhotoComment(photoId) {
  const inp = document.getElementById('commentInput');
  const content = inp.value.trim();
  if (!content) return;
  await supabase.from('photo_comments').insert({ photo_id: photoId, user_id: currentUser.id, content });
  inp.value = '';
  loadPhotoComments(photoId);
}

// ==================== NAVIGATION ====================
function setupNavigation() {
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(page + 'Page').classList.add('active');
      if (page === 'online') loadUsers();
      if (page === 'friends') loadFriends();
      if (page === 'messages') loadPMList();
    });
  });
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

// ==================== THEME ====================
function setupTheme() {
  const btn = document.getElementById('themeBtn');
  const saved = localStorage.getItem('theme');
  if (saved === 'day') { document.body.classList.add('day-mode'); btn.textContent = '☀️'; }
  btn.addEventListener('click', () => {
    document.body.classList.toggle('day-mode');
    const isDay = document.body.classList.contains('day-mode');
    btn.textContent = isDay ? '☀️' : '🌙';
    localStorage.setItem('theme', isDay ? 'day' : 'night');
  });
}

// ==================== ONLINE PRESENCE ====================
function startOnlinePresence() {
  updateOnline();
  onlineInterval = setInterval(updateOnline, 30000);
  window.addEventListener('beforeunload', () => {
    supabase.from('profiles').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', currentUser.id);
  });
}

async function updateOnline() {
  await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', currentUser.id);
  updateOnlineBadge();
}

async function updateOnlineBadge() {
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_online', true);
  const btn = document.querySelector('.nav-btn[data-page="online"]');
  if (btn) {
    btn.innerHTML = `🌐${count > 0 ? `<span style="position:absolute;top:2px;right:2px;background:#2ecc71;color:white;border-radius:50%;width:14px;height:14px;font-size:9px;display:flex;align-items:center;justify-content:center;">${count}</span>` : ''}`;
    btn.style.position = 'relative';
  }
}

// ==================== ROOMS ====================
const ROOMS = [
  { id: 'general', name: '🏙️ მთავარი მოედანი', desc: 'ზოგადი საუბარი' },
  { id: 'mafia', name: '🕵️ მაფიის სახლი', desc: 'სტრატეგია და ინტრიგა' },
  { id: 'casino', name: '🎰 კაზინო', desc: 'სათამაშო ადგილი' },
  { id: 'bar', name: '🍷 ბარი', desc: 'დასვენება და ჩეთი' },
  { id: 'market', name: '💼 ბაზარი', desc: 'ვაჭრობა და გარიგება' },
  { id: 'prison', name: '⛓️ ციხე', desc: 'პატიმართა სექცია' },
  { id: 'vip', name: '👑 VIP ლაუნჯი', desc: 'პრემიუმ წევრები' },
  { id: 'war', name: '⚔️ ომის ოთახი', desc: 'ბრძოლის გეგმები' },
  { id: 'music', name: '🎵 მუსიკის კლუბი', desc: 'გართობა' },
  { id: 'sport', name: '⚽ სპორტი', desc: 'სპორტული ჩეთი' },
  { id: 'politics', name: '🗳️ პოლიტიკა', desc: 'დიდი ბოსების კრება' },
  { id: 'secret', name: '🔐 საიდუმლო ოთახი', desc: 'მხოლოდ ელიტისთვის' },
];

function loadRooms() {
  const list = document.getElementById('roomsList');
  list.innerHTML = '';
  ROOMS.forEach(room => {
    const div = document.createElement('div');
    div.className = 'room-card';
    div.innerHTML = `<div>${room.name}</div><div style="font-size:11px;opacity:0.6;font-weight:normal;margin-top:2px;">${room.desc}</div>`;
    div.onclick = () => openRoom(room);
    list.appendChild(div);
  });
}

function openRoom(room) {
  currentRoom = room.id;
  document.getElementById('chatRoomName').textContent = room.name;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('chatPage').classList.add('active');
  document.getElementById('chatMessages').innerHTML = '';
  loadRoomMessages();
  subscribeRoom();
  document.getElementById('messageInput').onkeydown = e => { if (e.key === 'Enter') sendMessage(); };
}

function closeChat() {
  if (messageSubscription) { supabase.removeChannel(messageSubscription); messageSubscription = null; }
  currentRoom = null;
  showPage('homePage');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.nav-btn[data-page="home"]').classList.add('active');
}

async function loadRoomMessages() {
  const { data } = await supabase.from('messages')
    .select('*, profiles(username, avatar_url, is_admin)')
    .eq('room_id', currentRoom)
    .order('created_at', { ascending: true })
    .limit(60);
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  (data || []).forEach(msg => renderMessage(msg, container));
  container.scrollTop = container.scrollHeight;
}

function subscribeRoom() {
  if (messageSubscription) supabase.removeChannel(messageSubscription);
  messageSubscription = supabase.channel('room:' + currentRoom)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${currentRoom}` }, async payload => {
      const { data } = await supabase.from('messages').select('*, profiles(username, avatar_url, is_admin)').eq('id', payload.new.id).single();
      if (data) {
        const container = document.getElementById('chatMessages');
        renderMessage(data, container);
        container.scrollTop = container.scrollHeight;
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
      const el = document.getElementById('msg-' + payload.old.id);
      if (el) el.remove();
    })
    .subscribe();
}

function renderMessage(msg, container) {
  const isOwn = msg.user_id === currentUser.id;
  const row = document.createElement('div');
  row.className = 'msg-row' + (isOwn ? ' own' : '');
  row.id = 'msg-' + msg.id;
  const avatarStyle = msg.profiles?.avatar_url ? `style="background-image:url(${msg.profiles.avatar_url});background-color:transparent;"` : '';
  const avatarText = msg.profiles?.avatar_url ? '' : (msg.profiles?.username?.[0]?.toUpperCase() || '?');
  const adminBadge = msg.profiles?.is_admin ? ' <span style="font-size:9px;background:gold;color:#000;border-radius:4px;padding:1px 3px;">ADMIN</span>' : '';
  const time = new Date(msg.created_at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });
  const deleteBtn = (isOwn || currentProfile?.is_admin) ? `<button class="delete-msg" onclick="deleteMessage('${msg.id}')">✕</button>` : '';
  let content = '';
  if (msg.image_url) content += `<img src="${msg.image_url}" class="message-img" onclick="window.open('${msg.image_url}','_blank')">`;
  if (msg.content) content += `<div class="message-text">${escapeHtml(msg.content)}</div>`;
  row.innerHTML = `
    <div class="msg-avatar" ${avatarStyle} onclick="openUserProfile('${msg.user_id}')">${avatarText}</div>
    <div class="message">
      ${deleteBtn}
      <span class="message-name" onclick="openUserProfile('${msg.user_id}')">${msg.profiles?.username || '?'}${adminBadge}</span>
      <span class="message-time">${time}</span>
      ${content}
    </div>`;
  container.appendChild(row);
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  const pendingImg = window._pendingImageUrl || null;
  if (!text && !pendingImg) return;
  if (!currentRoom) return;
  input.value = '';
  await supabase.from('messages').insert({
    room_id: currentRoom,
    user_id: currentUser.id,
    content: text || null,
    image_url: pendingImg || null
  });
  clearPendingImg();
}

async function deleteMessage(id) {
  await supabase.from('messages').delete().eq('id', id);
}

// ==================== IMAGE IN CHAT ====================
function addChatPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const base64 = e.target.result;
    const path = `chat/${currentRoom}/${Date.now()}.${file.name.split('.').pop()}`;
    const res = await fetch(base64);
    const blob = await res.blob();
    const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: false });
    if (error) { showNotification('შეცდომა: ' + error.message); return; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    window._pendingImageUrl = data.publicUrl;
    document.getElementById('pendingImgPreview').src = data.publicUrl;
    document.getElementById('pendingImgWrap').style.display = 'flex';
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function clearPendingImg() {
  window._pendingImageUrl = null;
  document.getElementById('pendingImgWrap').style.display = 'none';
  document.getElementById('pendingImgPreview').src = '';
}

// ==================== EMOJI PANEL ====================
async function buildEmojiPanel() {
  const panel = document.getElementById('emojiPanel');
  const { data: customEmojis } = await supabase.from('emojis').select('*').order('created_at');
  const defaultEmojis = ['😀','😂','🥰','😎','🤔','😢','😡','🤯','👍','👎','❤️','🔥','💀','🎉','🍷','🎰','⚔️','💼','🕵️','👑','🏴','💣','🌹','🐍','🦅','🎭','💰','🔫','🗡️','🏆','🎲','🃏','🌙','⭐','💎','🔐','🎵','⚽','🗳️','🌐'];
  panel.innerHTML = '<div class="emoji-grid" id="emojiGrid"></div>';
  if (currentProfile?.is_admin) {
    panel.innerHTML += `<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">
      <small style="opacity:0.6;">ემოჯის დამატება (მხოლოდ ადმინი)</small>
      <div style="display:flex;gap:5px;margin-top:5px;">
        <input id="emojiNameInput" placeholder="სახელი" style="flex:1;padding:5px;border-radius:15px;border:1px solid var(--accent);background:var(--bg);color:var(--text);outline:none;font-size:12px;">
        <button onclick="document.getElementById('emojiFile').click()" style="padding:5px 10px;font-size:12px;margin:0;">📁</button>
        <button onclick="addCustomEmoji()" style="padding:5px 10px;font-size:12px;margin:0;">➕</button>
      </div>
    </div>`;
  }
  const grid = document.getElementById('emojiGrid');
  defaultEmojis.forEach(e => {
    const span = document.createElement('span');
    span.className = 'emoji-item';
    span.textContent = e;
    span.onclick = () => insertEmoji(e);
    grid.appendChild(span);
  });
  (customEmojis || []).forEach(e => {
    const span = document.createElement('span');
    span.className = 'emoji-item';
    span.innerHTML = `<img src="${e.url}" style="width:24px;height:24px;border-radius:4px;" title="${e.name}">`;
    span.onclick = () => insertEmoji(e.url, true);
    grid.appendChild(span);
  });
}

function insertEmoji(val, isUrl = false) {
  const input = document.getElementById('messageInput');
  if (isUrl) {
    window._pendingImageUrl = val;
    document.getElementById('pendingImgPreview').src = val;
    document.getElementById('pendingImgWrap').style.display = 'flex';
  } else {
    input.value += val;
    input.focus();
  }
  document.getElementById('emojiPanel').style.display = 'none';
}

function toggleEmojiPanel() {
  const p = document.getElementById('emojiPanel');
  p.style.display = p.style.display === 'block' ? 'none' : 'block';
}

async function addCustomEmoji() {
  const name = document.getElementById('emojiNameInput')?.value.trim();
  if (!name) { showNotification('სახელი შეიყვანე'); return; }
  document.getElementById('emojiFile').click();
  window._pendingEmojiName = name;
}

async function uploadEmoji(input) {
  const file = input.files[0];
  if (!file) return;
  const name = window._pendingEmojiName || 'emoji';
  const path = `emojis/${Date.now()}.${file.name.split('.').pop()}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: false });
  if (error) { showNotification('შეცდომა'); return; }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  await supabase.from('emojis').insert({ name, url: data.publicUrl, created_by: currentUser.id });
  showNotification('ემოჯი დაემატა ✓');
  buildEmojiPanel();
  input.value = '';
}

// ==================== USERS LIST ====================
async function loadUsers() {
  const { data } = await supabase.from('profiles').select('*').order('is_online', { ascending: false }).order('username');
  const list = document.getElementById('usersList');
  list.innerHTML = '';
  if (!data || data.length === 0) { list.innerHTML = '<div class="empty-state">მომხმარებლები არ არიან</div>'; return; }
  const { data: myFriends } = await supabase.from('friends').select('friend_id').eq('user_id', currentUser.id);
  const friendIds = (myFriends || []).map(f => f.friend_id);
  data.forEach(user => {
    if (user.id === currentUser.id) return;
    const isFriend = friendIds.includes(user.id);
    const div = document.createElement('div');
    div.className = 'user-item';
    div.onclick = () => openUserProfile(user.id);
    const avStyle = user.avatar_url ? `style="background-image:url(${user.avatar_url});background-color:transparent;"` : '';
    const avText = user.avatar_url ? '' : (user.username?.[0]?.toUpperCase() || '?');
    div.innerHTML = `
      <div class="user-avatar" ${avStyle}>${avText}
        ${user.is_online ? '<div class="online-dot"></div>' : ''}
      </div>
      <div style="flex:1;">
        <div style="font-weight:bold;font-size:13px;">${user.username}${user.is_admin ? ' 👑' : ''}</div>
        <div style="font-size:11px;opacity:0.6;">${user.status || (user.is_online ? '🟢 ონლაინ' : '⚫ ოფლაინ')}</div>
      </div>
      ${isFriend ? '<span class="friend-badge">✓ მეგობარი</span>' : `<span class="add-badge" onclick="event.stopPropagation();sendFriendRequest('${user.id}')">➕</span>`}
    `;
    list.appendChild(div);
  });
}

// ==================== USER PROFILE MODAL ====================
async function openUserProfile(userId) {
  if (userId === currentUser.id) {
    showPage('profilePage');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.nav-btn[data-page="profile"]').classList.add('active');
    return;
  }
  const { data: user } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (!user) return;
  const { data: photos } = await supabase.from('user_photos').select('*').eq('user_id', userId).limit(6);
  const { data: fr } = await supabase.from('friends').select('*').eq('user_id', currentUser.id).eq('friend_id', userId).single();
  const isFriend = !!fr;
  const existing = document.getElementById('userProfileModal');
  if (existing) existing.remove();
  const m = document.createElement('div');
  m.className = 'modal';
  m.id = 'userProfileModal';
  const avStyle = user.avatar_url ? `style="background-image:url(${user.avatar_url});background-color:transparent;background-size:cover;background-position:center;"` : '';
  const avText = user.avatar_url ? '' : (user.username?.[0]?.toUpperCase() || '?');
  const photoGrid = (photos || []).map(p => `<img src="${p.photo_url}" class="album-photo" onclick="openPhotoModal({id:'${p.id}',photo_url:'${p.photo_url}'})">`).join('');
  m.innerHTML = `
    <div class="modal-content">
      <div class="profile-avatar" ${avStyle} style="pointer-events:none;">${avText}</div>
      <h3 style="text-align:center;">${user.username}${user.is_admin ? ' 👑' : ''}</h3>
      <p style="text-align:center;opacity:0.6;font-size:12px;margin:4px 0;">${user.status || ''}</p>
      <p style="text-align:center;font-size:12px;margin:4px 0;">${user.is_online ? '🟢 ონლაინ' : '⚫ ოფლაინ'}</p>
      <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:10px 0;">
        <button class="action-btn" onclick="openPM('${user.id}','${user.username}')">💬 მიწერე</button>
        ${!isFriend ? `<button class="action-btn" onclick="sendFriendRequest('${user.id}')">👥 მეგობრობა</button>` : '<button class="action-btn success">✓ მეგობარი</button>'}
        ${currentProfile?.is_admin ? `<button class="action-btn danger" onclick="banUser('${user.id}')">🚫 ბანი</button>` : ''}
      </div>
      ${photoGrid ? `<div class="album-grid" style="margin-top:8px;">${photoGrid}</div>` : ''}
      <button onclick="document.getElementById('userProfileModal').remove()" style="width:100%;margin-top:10px;background:#5a0000;">დახურვა</button>
    </div>`;
  document.body.appendChild(m);
}

// ==================== FRIENDS ====================
async function sendFriendRequest(toId) {
  const { data: existing } = await supabase.from('friend_requests').select('*').eq('from_id', currentUser.id).eq('to_id', toId).single();
  if (existing) { showNotification('უკვე გაგზავნილია'); return; }
  await supabase.from('friend_requests').insert({ from_id: currentUser.id, to_id: toId });
  showNotification('მოთხოვნა გაიგზავნა ✓');
  const modal = document.getElementById('userProfileModal');
  if (modal) modal.remove();
}

async function loadFriends() {
  const { data: friends } = await supabase.from('friends').select('friend_id, profiles!friends_friend_id_fkey(*)').eq('user_id', currentUser.id);
  const { data: requests } = await supabase.from('friend_requests').select('from_id, profiles!friend_requests_from_id_fkey(*)').eq('to_id', currentUser.id).eq('status', 'pending');
  const fl = document.getElementById('friendsList');
  const rl = document.getElementById('requestsList');
  fl.innerHTML = '';
  rl.innerHTML = '';
  if (!friends || friends.length === 0) fl.innerHTML = '<div class="empty-state">მეგობრები არ გყავს</div>';
  (friends || []).forEach(f => {
    const u = f.profiles;
    if (!u) return;
    const div = document.createElement('div');
    div.className = 'user-item';
    div.onclick = () => openUserProfile(u.id);
    const avStyle = u.avatar_url ? `style="background-image:url(${u.avatar_url});background-color:transparent;"` : '';
    div.innerHTML = `
      <div class="user-avatar" ${avStyle}>${u.avatar_url ? '' : (u.username?.[0]?.toUpperCase() || '?')}
        ${u.is_online ? '<div class="online-dot"></div>' : ''}
      </div>
      <div style="flex:1;"><div style="font-weight:bold;font-size:13px;">${u.username}</div>
        <div style="font-size:11px;opacity:0.6;">${u.is_online ? '🟢 ონლაინ' : '⚫ ოფლაინ'}</div>
      </div>
      <button class="action-btn" onclick="event.stopPropagation();openPM('${u.id}','${u.username}')" style="font-size:11px;padding:5px 9px;margin:0;">💬</button>
      <button class="action-btn danger" onclick="event.stopPropagation();removeFriend('${u.id}')" style="font-size:11px;padding:5px 9px;margin:0;margin-left:4px;">✕</button>`;
    fl.appendChild(div);
  });
  if (!requests || requests.length === 0) rl.innerHTML = '<div class="empty-state">მოთხოვნები არ არის</div>';
  (requests || []).forEach(r => {
    const u = r.profiles;
    if (!u) return;
    const div = document.createElement('div');
    div.className = 'user-item';
    div.innerHTML = `
      <div class="user-avatar">${u.username?.[0]?.toUpperCase() || '?'}</div>
      <div style="flex:1;"><div style="font-weight:bold;font-size:13px;">${u.username}</div></div>
      <button class="action-btn success" onclick="acceptFriend('${r.from_id}')" style="font-size:11px;padding:5px 9px;margin:0;">✓</button>
      <button class="action-btn danger" onclick="declineFriend('${r.from_id}')" style="font-size:11px;padding:5px 9px;margin:0;margin-left:4px;">✕</button>`;
    rl.appendChild(div);
  });
}

async function acceptFriend(fromId) {
  await supabase.from('friend_requests').update({ status: 'accepted' }).eq('from_id', fromId).eq('to_id', currentUser.id);
  await supabase.from('friends').insert([{ user_id: currentUser.id, friend_id: fromId }, { user_id: fromId, friend_id: currentUser.id }]);
  showNotification('მეგობარი დაემატა ✓');
  loadFriends();
}

async function declineFriend(fromId) {
  await supabase.from('friend_requests').delete().eq('from_id', fromId).eq('to_id', currentUser.id);
  loadFriends();
}

async function removeFriend(friendId) {
  await supabase.from('friends').delete().eq('user_id', currentUser.id).eq('friend_id', friendId);
  await supabase.from('friends').delete().eq('user_id', friendId).eq('friend_id', currentUser.id);
  showNotification('მეგობარი წაიშალა');
  loadFriends();
}

// ==================== PRIVATE MESSAGES (MESSENGER STYLE) ====================
async function loadPMList() {
  const { data } = await supabase.from('direct_messages')
    .select('*')
    .or(`from_id.eq.${currentUser.id},to_id.eq.${currentUser.id}`)
    .order('created_at', { ascending: false });
  const list = document.getElementById('pmList');
  list.innerHTML = '';
  if (!data || data.length === 0) { list.innerHTML = '<div class="empty-state">მიმოწერა არ არის</div>'; return; }
  const seen = new Set();
  const convs = [];
  for (const msg of data) {
    const otherId = msg.from_id === currentUser.id ? msg.to_id : msg.from_id;
    if (!seen.has(otherId)) { seen.add(otherId); convs.push({ otherId, lastMsg: msg }); }
  }
  for (const conv of convs) {
    const { data: user } = await supabase.from('profiles').select('*').eq('id', conv.otherId).single();
    if (!user) continue;
    const unread = unreadPM[conv.otherId] || 0;
    const div = document.createElement('div');
    div.className = 'user-item';
    div.onclick = () => openPM(user.id, user.username);
    const avStyle = user.avatar_url ? `style="background-image:url(${user.avatar_url});background-color:transparent;"` : '';
    div.innerHTML = `
      <div class="user-avatar" ${avStyle}>${user.avatar_url ? '' : (user.username?.[0]?.toUpperCase() || '?')}
        ${user.is_online ? '<div class="online-dot"></div>' : ''}
      </div>
      <div style="flex:1;">
        <div style="font-weight:bold;font-size:13px;">${user.username}</div>
        <div style="font-size:11px;opacity:0.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${conv.lastMsg.content || '📷 ფოტო'}</div>
      </div>
      ${unread > 0 ? `<span style="background:var(--accent);color:white;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;">${unread}</span>` : ''}`;
    list.appendChild(div);
  }
}

function openPM(userId, username) {
  const existing = document.getElementById('userProfileModal');
  if (existing) existing.remove();
  currentPMUser = { id: userId, username };
  unreadPM[userId] = 0;
  updatePMBadge();
  const old = document.getElementById('pmWindow');
  if (old) old.remove();
  const win = document.createElement('div');
  win.className = 'pm-window';
  win.id = 'pmWindow';
  win.innerHTML = `
    <div class="pm-header" onclick="togglePMWindow()">
      <span>💬 ${username}</span>
      <span id="pmMinIcon">▼</span>
    </div>
    <div class="pm-messages" id="pmMessages"></div>
    <div class="pm-input">
      <input id="pmInput" placeholder="შეტყობინება..." onkeydown="if(event.key==='Enter')sendPM()">
      <button onclick="sendPM()" style="margin:0;padding:7px 12px;">➤</button>
    </div>`;
  document.body.appendChild(win);
  loadPMMessages();
  subscribePM();
}

let pmMinimized = false;
function togglePMWindow() {
  const messages = document.getElementById('pmMessages');
  const input = document.querySelector('.pm-input');
  const icon = document.getElementById('pmMinIcon');
  if (!messages) return;
  pmMinimized = !pmMinimized;
  messages.style.display = pmMinimized ? 'none' : 'flex';
  if (input) input.style.display = pmMinimized ? 'none' : 'flex';
  if (icon) icon.textContent = pmMinimized ? '▲' : '▼';
}

async function loadPMMessages() {
  const { data } = await supabase.from('direct_messages')
    .select('*, profiles!direct_messages_from_id_fkey(username)')
    .or(`and(from_id.eq.${currentUser.id},to_id.eq.${currentPMUser.id}),and(from_id.eq.${currentPMUser.id},to_id.eq.${currentUser.id})`)
    .order('created_at', { ascending: true })
    .limit(50);
  const container = document.getElementById('pmMessages');
  if (!container) return;
  container.innerHTML = '';
  (data || []).forEach(msg => renderPMMessage(msg, container));
  container.scrollTop = container.scrollHeight;
}

function renderPMMessage(msg, container) {
  const isOwn = msg.from_id === currentUser.id;
  const div = document.createElement('div');
  div.style.cssText = `display:flex;flex-direction:column;align-items:${isOwn ? 'flex-end' : 'flex-start'};margin-bottom:6px;`;
  const time = new Date(msg.created_at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div style="background:${isOwn ? 'var(--accent)' : 'var(--bg)'};padding:7px 10px;border-radius:12px;max-width:200px;word-break:break-word;font-size:13px;">
      ${msg.content ? escapeHtml(msg.content) : ''}
      ${msg.image_url ? `<img src="${msg.image_url}" style="max-width:150px;border-radius:8px;display:block;margin-top:4px;">` : ''}
    </div>
    <span style="font-size:10px;opacity:0.5;margin-top:2px;">${time}</span>`;
  container.appendChild(div);
}

async function sendPM() {
  const input = document.getElementById('pmInput');
  const text = input.value.trim();
  if (!text || !currentPMUser) return;
  input.value = '';
  await supabase.from('direct_messages').insert({ from_id: currentUser.id, to_id: currentPMUser.id, content: text });
}

function subscribePM() {
  if (pmSubscription) supabase.removeChannel(pmSubscription);
  pmSubscription = supabase.channel('pm:' + currentUser.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `to_id=eq.${currentUser.id}` }, async payload => {
      const msg = payload.new;
      if (currentPMUser && msg.from_id === currentPMUser.id) {
        const { data } = await supabase.from('direct_messages').select('*, profiles!direct_messages_from_id_fkey(username)').eq('id', msg.id).single();
        if (data) {
          const container = document.getElementById('pmMessages');
          if (container) { renderPMMessage(data, container); container.scrollTop = container.scrollHeight; }
        }
      } else {
        unreadPM[msg.from_id] = (unreadPM[msg.from_id] || 0) + 1;
        updatePMBadge();
        const { data: sender } = await supabase.from('profiles').select('username').eq('id', msg.from_id).single();
        showNotification(`💬 ${sender?.username || '?'}: ${msg.content || 'ფოტო'}`);
      }
      loadPMList();
    })
    .subscribe();
}

function updatePMBadge() {
  const total = Object.values(unreadPM).reduce((a, b) => a + b, 0);
  const btn = document.querySelector('.nav-btn[data-page="messages"]');
  if (!btn) return;
  btn.style.position = 'relative';
  const old = btn.querySelector('.pm-badge');
  if (old) old.remove();
  if (total > 0) {
    btn.innerHTML = `💬<span class="pm-badge" style="position:absolute;top:2px;right:2px;background:var(--accent);color:white;border-radius:50%;width:14px;height:14px;font-size:9px;display:flex;align-items:center;justify-content:center;">${total}</span>`;
  } else {
    btn.innerHTML = '💬';
  }
}

// ==================== NOTIFICATIONS ====================
function subscribeToNotifications() {
  supabase.channel('notifications:' + currentUser.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `to_id=eq.${currentUser.id}` }, async payload => {
      const { data: sender } = await supabase.from('profiles').select('username').eq('id', payload.new.from_id).single();
      showNotification(`👥 ${sender?.username || '?'} გიგზავნის მეგობრობის მოთხოვნას`);
      loadFriends();
    })
    .subscribe();
}

function showNotification(msg) {
  const old = document.querySelector('.notification');
  if (old) old.remove();
  const n = document.createElement('div');
  n.className = 'notification';
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3500);
}

// ==================== ADMIN ====================
async function banUser(userId) {
  if (!currentProfile?.is_admin) return;
  if (!confirm('დარწმუნებული ხარ?')) return;
  await supabase.from('profiles').update({ is_banned: true }).eq('id', userId);
  await supabase.from('messages').delete().eq('user_id', userId);
  showNotification('მომხმარებელი დაიბანა');
  const modal = document.getElementById('userProfileModal');
  if (modal) modal.remove();
}

// ==================== HEARTS ====================
function spawnHeart() {
  const h = document.createElement('div');
  h.className = 'heart';
  h.textContent = ['❤️','🌹','💀','🔥','💎'][Math.floor(Math.random() * 5)];
  h.style.left = Math.random() * 90 + '%';
  h.style.fontSize = (16 + Math.random() * 20) + 'px';
  document.getElementById('hearts').appendChild(h);
  setTimeout(() => h.remove(), 5000);
}
setInterval(spawnHeart, 8000);

// ==================== UTILS ====================
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ==================== START ====================
init();
