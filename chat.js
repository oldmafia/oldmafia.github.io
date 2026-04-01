// ========== SUPABASE ==========
const SUPABASE_URL = 'https://ftfciebnywbondaiarnc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eQZDSu_Jy1gWmXJFF800Pw_TP2kBRLI';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const currentUser = localStorage.getItem('mafia_user');
if (!currentUser || currentUser === "null" || currentUser === "") {
    window.location.href = "index.html";
}

const OWNER = "Abu007";
let currentRoom = null;
let currentPMUser = null;
let messagesChannel = null;
let pmChannel = null;
let pendingImage = null;
let pendingPMImage = null;
let users = JSON.parse(localStorage.getItem('mafia_users') || '[]');
let blockedUsers = JSON.parse(localStorage.getItem('mafia_blocked') || '[]');

const ROOMS = [
    "☕ კაფე-ბარი","🎲 ნარდი","🃏 ჯოკერი","💎 VIP","📝 ფორუმი",
    "🛠️ ადმინები","😂 იუმორი","🏆 შიფროგრამა","🎭 გამოძიება",
    "🎵 მუსიკა","⁉️ ვიქტორინა","🆘 დახმარება"
];

const DEFAULT_EMOJIS = ['😊','😂','❤️','🔥','👍','🎉','😍','🥳','😎','🥺','💀','👑','💪','🤡','👻','😘','🙏','😆','😅','🤔','😒','😢','😭','😤','🫡','😋','🤩','😏','🙄','😬','🤣','😇','🥰','😡','🤯','💯','✨','🎊','🍀'];

function saveLocal() {
    localStorage.setItem('mafia_users', JSON.stringify(users));
    localStorage.setItem('mafia_blocked', JSON.stringify(blockedUsers));
}

function escapeHtml(t) {
    if (!t) return '';
    let d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

function showNotification(msg) {
    let n = document.createElement('div');
    n.className = 'notification';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

function getAvatar(username) {
    return users.find(x => x.username === username)?.avatar || null;
}

function isAdminOrOwner(username) {
    if (username === OWNER) return true;
    let u = users.find(x => x.username === username);
    return u?.role === 'admin' || u?.role === 'owner';
}

// ========== ინიციალიზაცია ==========
async function initData() {
    const { data: profilesData } = await db.from('profiles').select('*');
    if (profilesData) {
        profilesData.forEach(p => {
            let ex = users.find(u => u.username === p.username);
            if (!ex) {
                users.push({
                    username: p.username,
                    status: p.status || "ონლაინ",
                    avatar: p.avatar || null,
                    role: p.username === OWNER ? 'owner' : (p.role === 'Admin' ? 'admin' : 'user'),
                    online: false
                });
            } else {
                if (p.status) ex.status = p.status;
                if (p.avatar) ex.avatar = p.avatar;
            }
        });
        saveLocal();
    }
    let me = users.find(u => u.username === currentUser);
    if (!me) users.push({ username: currentUser, status: "ახალი მოთამაშე", avatar: null, role: 'user', online: true });
    else me.online = true;
    saveLocal();
    document.getElementById('profileName').textContent = currentUser;
    let meUser = users.find(u => u.username === currentUser);
    if (meUser?.status) document.getElementById('statusInput').value = meUser.status;
    updateProfileAvatarUI();
    listenToFriendRequests();
}

function updateProfileAvatarUI() {
    let me = users.find(u => u.username === currentUser);
    let av = document.getElementById('profileAvatar');
    if (me?.avatar) { av.style.backgroundImage = `url(${me.avatar})`; av.style.backgroundSize = 'cover'; av.innerHTML = ''; }
    else { av.style.backgroundImage = ''; av.innerHTML = '👤'; }
}

// ========== ოთახები ==========
function renderRooms() {
    document.getElementById('roomsList').innerHTML = ROOMS.map(room =>
        `<div class="room-card" onclick="openRoom(this.dataset.room)" data-room="${escapeHtml(room)}">${room}</div>`
    ).join('');
}

function openRoom(room) {
    currentRoom = room;
    document.getElementById('chatRoomName').textContent = room;
    showPage('chat');
    listenToRoom(room);
    if (room === "⁉️ ვიქტორინა") { hideQuiz(); startQuiz(); }
    else if (room === "🏆 შიფროგრამა") { hideQuiz(); startCipher(); }
    else { hideQuiz(); hideCipher(); }
}

function closeChat() {
    if (messagesChannel) { db.removeChannel(messagesChannel); messagesChannel = null; }
    currentRoom = null; hideQuiz(); showPage('home');
}

// ========== REALTIME შეტყობინებები ==========
async function listenToRoom(roomName) {
    if (messagesChannel) { await db.removeChannel(messagesChannel); messagesChannel = null; }
    await renderRoomMessages(roomName);
    messagesChannel = db.channel('room_' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.${roomName}` },
            p => { if (currentRoom === roomName) appendMessage(p.new); })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' },
            () => { if (currentRoom === roomName) renderRoomMessages(roomName); })
        .subscribe();
}

async function renderRoomMessages(roomName) {
    let c = document.getElementById('chatMessages');
    if (!c || currentRoom !== roomName) return;
    const { data: msgs, error } = await db.from('messages').select('*').eq('room', roomName).order('time', { ascending: true }).limit(100);
    if (error) { console.error(error); return; }
    c.innerHTML = (!msgs || msgs.length === 0) ? '<div class="empty-state">💬 შეტყობინებები არ არის</div>' : msgs.map(buildMessageHtml).join('');
    c.scrollTop = c.scrollHeight;
}

function buildMessageHtml(msg) {
    let isOwn = msg.sender === currentUser;
    let time = new Date(parseInt(msg.time)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let canDelete = isAdminOrOwner(currentUser);
    let avatar = getAvatar(msg.sender);
    return `<div class="msg-row ${isOwn ? 'own' : ''}" id="msgrow-${msg.id}">
        <div class="msg-avatar" style="${avatar ? `background-image:url(${avatar});background-size:cover;` : ''}" onclick="showUserProfile('${escapeHtml(msg.sender)}')">${avatar ? '' : escapeHtml((msg.sender || '?').charAt(0).toUpperCase())}</div>
        <div class="message" id="msg-${msg.id}">
            <span class="message-name" onclick="showUserProfile('${escapeHtml(msg.sender)}')">${escapeHtml(msg.sender)}</span>
            <span class="message-time">${time}</span>
            <div class="message-text">${escapeHtml(msg.text)}</div>
            ${msg.image ? `<img src="${msg.image}" class="message-img" onclick="openPhotoModal('${msg.id}','${escapeHtml(msg.sender)}','${encodeURIComponent(msg.image)}')">` : ''}
            ${canDelete ? `<button class="delete-msg" onclick="deleteMessage(${msg.id})">🗑️</button>` : ''}
        </div>
    </div>`;
}

function appendMessage(msg) {
    let c = document.getElementById('chatMessages');
    if (!c) return;
    let e = c.querySelector('.empty-state');
    if (e) e.remove();
    c.insertAdjacentHTML('beforeend', buildMessageHtml(msg));
    c.scrollTop = c.scrollHeight;
}

async function sendMessage() {
    let input = document.getElementById('messageInput');
    let text = input.value.trim();
    if (!text && !pendingImage) return;
    if (!currentRoom) return;
    const { error } = await db.from('messages').insert([{
        sender: currentUser, text: text || "", room: currentRoom,
        image: pendingImage || null, time: Date.now().toString()
    }]);
    if (error) { showNotification('შეცდომა: ' + error.message); return; }
    input.value = ''; clearPendingImg();
}

async function deleteMessage(id) {
    await db.from('messages').delete().eq('id', id);
    let el = document.getElementById('msgrow-' + id);
    if (el) el.remove();
}

function addChatPhoto(input) {
    let file = input.files[0]; if (!file) return;
    let reader = new FileReader();
    reader.onload = e => { pendingImage = e.target.result; document.getElementById('pendingImgPreview').src = pendingImage; document.getElementById('pendingImgWrap').style.display = 'flex'; };
    reader.readAsDataURL(file); input.value = '';
}

function clearPendingImg() {
    pendingImage = null; document.getElementById('pendingImgWrap').style.display = 'none'; document.getElementById('pendingImgPreview').src = '';
}

// ========== პირადი მიმოწერა ==========
// ცხრილი: direct_messages (id, chat_id, from_user, to_user, text, time)
async function listenToPM(otherUser) {
    if (pmChannel) { await db.removeChannel(pmChannel); pmChannel = null; }
    let chatId = [currentUser, otherUser].sort().join('_');
    await renderPMMessages(chatId);
    pmChannel = db.channel('pm_' + chatId + '_' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `chat_id=eq.${chatId}` },
            p => appendPMMessage(p.new))
        .subscribe();
}

async function renderPMMessages(chatId) {
    let c = document.getElementById('pmMessages'); if (!c) return;
    const { data: msgs, error } = await db.from('direct_messages').select('*').eq('chat_id', chatId).order('time', { ascending: true });
    if (error) { showNotification('PM შეცდომა: ' + error.message); return; }
    c.innerHTML = (!msgs || msgs.length === 0)
        ? '<div style="text-align:center;padding:15px;opacity:0.5;font-size:12px;">მიმოწერა ცარიელია</div>'
        : msgs.map(buildPMHtml).join('');
    c.scrollTop = c.scrollHeight;
}

function buildPMHtml(msg) {
    let isOwn = msg.from_user === currentUser;
    let time = new Date(parseInt(msg.time)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div style="text-align:${isOwn ? 'right' : 'left'};margin:5px 0;">
        <div style="background:${isOwn ? '#8b0000' : '#2a1a1a'};display:inline-block;padding:6px 10px;border-radius:12px;max-width:88%;word-break:break-word;font-size:13px;">
            ${msg.image ? `<img src="${msg.image}" style="max-width:120px;border-radius:8px;display:block;margin-bottom:4px;">` : ''}
            ${escapeHtml(msg.text)}
        </div>
        <div style="font-size:9px;opacity:0.6;margin-top:2px;">${time}</div>
    </div>`;
}

function appendPMMessage(msg) {
    let c = document.getElementById('pmMessages'); if (!c) return;
    c.insertAdjacentHTML('beforeend', buildPMHtml(msg));
    c.scrollTop = c.scrollHeight;
}

async function sendPM() {
    let input = document.getElementById('pmInput'); if (!input) return;
    let text = input.value.trim();
    if (!text && !pendingPMImage) return;
    if (!currentPMUser) return;
    let chatId = [currentUser, currentPMUser].sort().join('_');
    const { error } = await db.from('direct_messages').insert([{
        chat_id: chatId, from_user: currentUser, to_user: currentPMUser,
        text: text || "", time: Date.now().toString()
    }]);
    if (error) { showNotification('PM შეცდომა: ' + error.message); return; }
    input.value = ''; clearPMPendingImg();
}

function clearPMPendingImg() {
    pendingPMImage = null;
    let w = document.getElementById('pmPendingWrap'); if (w) w.style.display = 'none';
}

async function renderPMList() {
    let c = document.getElementById('pmList'); if (!c) return;
    const { data: chats } = await db.from('direct_messages').select('chat_id,from_user,to_user').or(`from_user.eq.${currentUser},to_user.eq.${currentUser}`);
    let seen = new Set();
    chats?.forEach(x => seen.add(x.from_user === currentUser ? x.to_user : x.from_user));
    if (seen.size === 0) { c.innerHTML = '<div class="empty-state">ჯერ არ გქონია მიმოწერა</div>'; return; }
    c.innerHTML = Array.from(seen).map(username => {
        let u = users.find(x => x.username === username);
        return `<div class="user-item" onclick="openPrivateChat('${escapeHtml(username)}')">
            <div class="user-avatar" style="${u?.avatar ? `background-image:url(${u.avatar});background-size:cover;` : ''}">${u?.avatar ? '' : username.charAt(0).toUpperCase()}</div>
            <div><div style="font-weight:bold;font-size:14px;">${escapeHtml(username)}</div></div>
        </div>`;
    }).join('');
}

function openPrivateChat(username) {
    if (username === currentUser) { showNotification('საკუთარ თავთან არ შეიძლება'); return; }
    if (blockedUsers.includes(username)) { showNotification('🔒 ' + username + ' დაბლოკილია'); return; }
    currentPMUser = username; renderPrivateChat(); listenToPM(username);
}

async function buildPMEmojiGrid() {
    // ცხრილი: emojis (id, name, emoji_url, created_at)
    const { data } = await db.from('emojis').select('*').order('created_at', { ascending: true });
    let customs = data || [];
    return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;">
        ${DEFAULT_EMOJIS.map(e => `<div style="font-size:22px;text-align:center;cursor:pointer;padding:4px;border-radius:6px;" onclick="insertPMEmoji('${e}')">${e}</div>`).join('')}
        ${customs.map(e => `<img src="${e.emoji_url}" style="width:28px;height:28px;object-fit:cover;border-radius:5px;cursor:pointer;margin:2px;" onclick="insertPMCustomEmoji('${e.emoji_url}')">`).join('')}
    </div>`;
}

function renderPrivateChat() {
    document.getElementById('pmContainer').innerHTML = `
        <div class="pm-window">
            <div class="pm-header"><span>💬 ${escapeHtml(currentPMUser)}</span><span onclick="closePM()" style="cursor:pointer;font-size:16px;">✕</span></div>
            <div class="pm-messages" id="pmMessages"></div>
            <div id="pmPendingWrap" style="display:none;padding:3px 8px;flex-direction:row;align-items:center;gap:5px;">
                <img id="pmPendingPreview" style="max-height:36px;border-radius:6px;border:2px solid var(--accent);">
                <button onclick="clearPMPendingImg()" style="margin:0;padding:2px 6px;font-size:11px;background:#5a0000;">✕</button>
            </div>
            <div style="display:flex;gap:4px;padding:4px 7px;background:var(--card);">
                <button class="icon-btn" onclick="togglePMEmojiPanel()" style="width:32px;height:32px;font-size:13px;">😊</button>
                <button class="icon-btn" onclick="document.getElementById('pmPhotoInput').click()" style="width:32px;height:32px;font-size:13px;">📷</button>
            </div>
            <div id="pmEmojiPanel" style="display:none;padding:8px;background:var(--card);border-top:1px solid var(--accent);max-height:160px;overflow-y:auto;">
                <div id="pmEmojiGrid">⏳ იტვირთება...</div>
            </div>
            <div class="pm-input">
                <input type="text" id="pmInput" placeholder="დაწერე...">
                <button onclick="sendPM()">➤</button>
            </div>
            <input type="file" id="pmPhotoInput" hidden accept="image/*" onchange="addPMPhoto(this)">
        </div>`;
    setTimeout(() => {
        let inp = document.getElementById('pmInput');
        if (inp) inp.addEventListener('keypress', e => { if (e.key === 'Enter') sendPM(); });
    }, 100);
}

async function togglePMEmojiPanel() {
    let panel = document.getElementById('pmEmojiPanel');
    if (!panel) return;
    if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    let grid = document.getElementById('pmEmojiGrid');
    if (grid) grid.innerHTML = await buildPMEmojiGrid();
}

function insertPMEmoji(emoji) {
    let input = document.getElementById('pmInput');
    if (input) { let pos = input.selectionStart || input.value.length; input.value = input.value.slice(0, pos) + emoji + input.value.slice(pos); input.focus(); }
    let p = document.getElementById('pmEmojiPanel'); if (p) p.style.display = 'none';
}

function insertPMCustomEmoji(src) {
    pendingPMImage = src;
    let preview = document.getElementById('pmPendingPreview');
    let wrap = document.getElementById('pmPendingWrap');
    if (preview) preview.src = src; if (wrap) wrap.style.display = 'flex';
    let p = document.getElementById('pmEmojiPanel'); if (p) p.style.display = 'none';
}

function addPMPhoto(input) {
    let file = input.files[0]; if (!file) return;
    let reader = new FileReader();
    reader.onload = e => {
        pendingPMImage = e.target.result;
        let preview = document.getElementById('pmPendingPreview');
        let wrap = document.getElementById('pmPendingWrap');
        if (preview) preview.src = pendingPMImage; if (wrap) wrap.style.display = 'flex';
    };
    reader.readAsDataURL(file); input.value = '';
}

function closePM() {
    if (pmChannel) { db.removeChannel(pmChannel); pmChannel = null; }
    document.getElementById('pmContainer').innerHTML = '';
    currentPMUser = null; pendingPMImage = null;
}

// ========== მეგობრები - ცხრილი: friend_requests (id, from_user, to_user, status) ==========
async function listenToFriendRequests() {
    db.channel('friends_' + currentUser + '_' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `to_user=eq.${currentUser}` },
            p => { showNotification(`📨 ${p.new.from_user}-მა მეგობრობა მოითხოვა!`); renderRequestsList(); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friend_requests' },
            () => { renderFriendsList(); renderRequestsList(); renderUsersList(); })
        .subscribe();
}

async function sendFriendRequest(target) {
    if (target === currentUser) return showNotification('საკუთარ თავს ვერ დაუმატებ');
    const { data: existing } = await db.from('friend_requests').select('id,status')
        .or(`and(from_user.eq.${currentUser},to_user.eq.${target}),and(from_user.eq.${target},to_user.eq.${currentUser})`);
    if (existing && existing.length > 0)
        return showNotification(existing[0].status === 'accepted' ? 'უკვე მეგობარია' : 'მოთხოვნა უკვე გაგზავნილია');
    const { error } = await db.from('friend_requests').insert([{ from_user: currentUser, to_user: target, status: 'pending' }]);
    if (!error) showNotification(`📨 მოთხოვნა გაეგზავნა ${target}-ს`);
    else showNotification('შეცდომა: ' + error.message);
    renderUsersList();
}

async function acceptFriendRequest(from) {
    const { error } = await db.from('friend_requests').update({ status: 'accepted' }).eq('from_user', from).eq('to_user', currentUser);
    if (!error) { showNotification(`✅ ${from} დაემატა!`); renderAll(); }
}

async function rejectFriendRequest(from) {
    await db.from('friend_requests').delete().eq('from_user', from).eq('to_user', currentUser);
    showNotification('❌ უარყავით'); renderAll();
}

async function renderFriendsList() {
    let c = document.getElementById('friendsList'); if (!c) return;
    const { data } = await db.from('friend_requests').select('from_user,to_user').eq('status', 'accepted').or(`from_user.eq.${currentUser},to_user.eq.${currentUser}`);
    let names = (data || []).map(r => r.from_user === currentUser ? r.to_user : r.from_user);
    let friendUsers = users.filter(u => names.includes(u.username));
    c.innerHTML = friendUsers.length === 0 ? '<div class="empty-state">მეგობრები არ არიან</div>'
        : friendUsers.map(u => `<div class="user-item" onclick="showUserProfile('${escapeHtml(u.username)}')">
            <div class="user-avatar" style="${u.avatar ? `background-image:url(${u.avatar});background-size:cover;` : ''}">${u.avatar ? '' : u.username.charAt(0).toUpperCase()}</div>
            <div><div style="font-weight:bold;font-size:13px;">${escapeHtml(u.username)}</div><div style="font-size:11px;opacity:0.7;">${escapeHtml(u.status || '')}</div></div>
        </div>`).join('');
}

async function renderRequestsList() {
    let c = document.getElementById('requestsList'); if (!c) return;
    const { data: pending } = await db.from('friend_requests').select('*').eq('to_user', currentUser).eq('status', 'pending');
    c.innerHTML = (!pending || pending.length === 0) ? '<div class="empty-state">მოთხოვნები არ არის</div>'
        : pending.map(req => `<div class="user-item">
            <div class="user-avatar">${req.from_user.charAt(0).toUpperCase()}</div>
            <div style="flex:1;"><div style="font-weight:bold;font-size:13px;">${escapeHtml(req.from_user)}</div><div style="font-size:11px;opacity:0.7;">მეგობრობის მოთხოვნა</div></div>
            <div style="display:flex;gap:4px;">
                <button class="action-btn success" onclick="acceptFriendRequest('${escapeHtml(req.from_user)}')">✅</button>
                <button class="action-btn danger" onclick="rejectFriendRequest('${escapeHtml(req.from_user)}')">❌</button>
            </div>
        </div>`).join('');
}

async function renderUsersList() {
    let c = document.getElementById('usersList'); if (!c) return;
    const { data: allReqs } = await db.from('friend_requests').select('*').or(`from_user.eq.${currentUser},to_user.eq.${currentUser}`);
    let others = users.filter(u => u.username !== currentUser);
    if (others.length === 0) { c.innerHTML = '<div class="empty-state">სხვა მომხმარებლები არ არიან</div>'; return; }
    c.innerHTML = others.map(user => {
        let req = (allReqs || []).find(r => (r.from_user === currentUser && r.to_user === user.username) || (r.from_user === user.username && r.to_user === currentUser));
        let isFr = req?.status === 'accepted', pendFromMe = req?.status === 'pending' && req?.from_user === currentUser, pendToMe = req?.status === 'pending' && req?.to_user === currentUser;
        return `<div class="user-item" onclick="showUserProfile('${escapeHtml(user.username)}')">
            <div class="user-avatar" style="${user.avatar ? `background-image:url(${user.avatar});background-size:cover;` : ''}">
                ${user.avatar ? '' : user.username.charAt(0).toUpperCase()}
                ${user.online ? '<span class="online-dot"></span>' : ''}
            </div>
            <div style="flex:1;">
                <div style="font-weight:bold;font-size:13px;">${escapeHtml(user.username)} ${user.role === 'owner' ? '👑' : user.role === 'admin' ? '🔧' : ''}</div>
                <div style="font-size:11px;opacity:0.7;">${escapeHtml(user.status || '')}</div>
            </div>
            ${!isFr && !pendFromMe && !pendToMe ? `<div class="add-badge" onclick="event.stopPropagation();sendFriendRequest('${escapeHtml(user.username)}')">➕</div>` : ''}
            ${pendFromMe ? `<div class="add-badge" style="background:orange;">⏳</div>` : ''}
            ${pendToMe ? `<div class="add-badge" style="background:gold;color:black;" onclick="event.stopPropagation();acceptFriendRequest('${escapeHtml(user.username)}')">✅</div>` : ''}
            ${isFr ? `<div class="friend-badge">✅</div>` : ''}
        </div>`;
    }).join('');
}

async function renderAll() { await Promise.all([renderUsersList(), renderFriendsList(), renderRequestsList()]); }

// ========== ვიქტორინა ==========
let quizQuestions = [], quizIndex = 0, quizScore = 0;

async function startQuiz() {
    const { data, error } = await db.from('quiz_questions').select('*');
    if (error || !data || data.length === 0) { showNotification('კითხვები ვერ მოიძებნა!'); return; }
    quizQuestions = data.sort(() => Math.random() - 0.5);
    quizIndex = 0; quizScore = 0; showQuizQuestion();
}

function showQuizQuestion() {
    let ex = document.getElementById('quizBox'); if (ex) ex.remove();
    if (quizIndex >= quizQuestions.length) { showQuizResult(); return; }
    let q = quizQuestions[quizIndex];
    let options = q.options;
    if (typeof options === 'string') { try { options = JSON.parse(options); } catch (e) { options = []; } }
    let box = document.createElement('div');
    box.id = 'quizBox';
    box.style.cssText = 'position:fixed;bottom:80px;left:10px;right:10px;background:var(--card);border:2px solid var(--accent);border-radius:16px;padding:14px;z-index:3000;';
    box.innerHTML = `<div style="font-size:12px;opacity:0.6;margin-bottom:6px;">კითხვა ${quizIndex + 1}/${quizQuestions.length} • ქულა: ${quizScore}</div>
        <div style="font-weight:bold;font-size:14px;margin-bottom:10px;">${escapeHtml(q.question)}</div>
        <div id="quizOptions" style="display:flex;flex-direction:column;gap:7px;">
            ${(options || []).map((opt, i) => `<button onclick="answerQuiz(${i})" style="background:#2a1a1a;border:1px solid var(--accent);color:var(--text);padding:8px 12px;border-radius:10px;cursor:pointer;text-align:left;font-size:13px;">${escapeHtml(String(opt))}</button>`).join('')}
        </div>
        <button onclick="hideQuiz()" style="margin-top:8px;background:#333;font-size:12px;padding:5px 10px;">✕ დახურვა</button>`;
    document.body.appendChild(box);
}

function answerQuiz(sel) {
    let q = quizQuestions[quizIndex];
    let options = q.options;
    if (typeof options === 'string') { try { options = JSON.parse(options); } catch (e) { options = []; } }
    let buttons = document.querySelectorAll('#quizOptions button');
    let correct = typeof q.answer === 'number' ? q.answer : (options || []).findIndex(o => o === q.answer);
    buttons.forEach((btn, i) => { btn.disabled = true; if (i === correct) btn.style.background = '#2d6a4f'; else if (i === sel && i !== correct) btn.style.background = '#8b0000'; });
    if (sel === correct) { quizScore++; showNotification('✅ სწორია! +1 ქულა'); } else showNotification('❌ არასწორი!');
    quizIndex++;
    if (quizIndex >= quizQuestions.length) await saveQuizScore(quizScore);
    setTimeout(() => { let b = document.getElementById('quizBox'); if (b) b.remove(); showQuizQuestion(); }, 1500);
}

function showQuizResult() {
    let box = document.createElement('div');
    box.id = 'quizBox';
    box.style.cssText = 'position:fixed;bottom:80px;left:10px;right:10px;background:var(--card);border:2px solid var(--accent);border-radius:16px;padding:16px;z-index:3000;text-align:center;';
    box.innerHTML = `<div style="font-size:32px;">🏆</div>
        <div style="font-size:16px;font-weight:bold;margin:8px 0;">ვიქტორინა დასრულდა!</div>
        <div style="font-size:14px;">შენი ქულა: <b>${quizScore}</b> / ${quizQuestions.length}</div>
        <div style="font-size:12px;opacity:0.7;margin:6px 0;">${quizScore === quizQuestions.length ? '🎉 საუკეთესო!' : quizScore >= quizQuestions.length / 2 ? '👍 კარგია!' : '📚 კიდევ სცადე!'}</div>
        <button onclick="startQuiz()" style="margin:5px;">🔄 თავიდან</button>
        <button onclick="hideQuiz()" style="margin:5px;background:#333;">✕ დახურვა</button>`;
    document.body.appendChild(box);
}

function hideQuiz() { let b = document.getElementById('quizBox'); if (b) b.remove(); }

// ========== ემოჯი - ცხრილი: emojis (id, name, emoji_url) ==========
async function toggleEmojiPanel() {
    let panel = document.getElementById('emojiPanel');
    if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
    const { data } = await db.from('emojis').select('*').order('created_at', { ascending: true });
    let customs = data || [];
    let isAdmin = isAdminOrOwner(currentUser);
    panel.innerHTML = `<div class="emoji-grid">
        ${DEFAULT_EMOJIS.map(e => `<div class="emoji-item" onclick="insertEmoji('${e}')">${e}</div>`).join('')}
        ${customs.map(e => `<img src="${e.emoji_url}" style="width:32px;height:32px;object-fit:cover;border-radius:6px;cursor:pointer;padding:2px;" onclick="insertCustomEmoji('${e.emoji_url}')">`).join('')}
        ${isAdmin ? `<div class="emoji-item" style="background:#8b0000;border-radius:8px;" onclick="document.getElementById('emojiFile').click()">➕</div>` : ''}
    </div>`;
    panel.style.display = 'block';
}

function insertEmoji(emoji) {
    let input = document.getElementById('messageInput');
    if (input) { let pos = input.selectionStart || input.value.length; input.value = input.value.slice(0, pos) + emoji + input.value.slice(pos); input.focus(); }
    document.getElementById('emojiPanel').style.display = 'none';
}

function insertCustomEmoji(src) {
    pendingImage = src;
    document.getElementById('pendingImgPreview').src = src;
    document.getElementById('pendingImgWrap').style.display = 'flex';
    document.getElementById('emojiPanel').style.display = 'none';
}

async function uploadEmoji(input) {
    if (!isAdminOrOwner(currentUser)) { showNotification('❌ მხოლოდ ადმინებს შეუძლიათ!'); return; }
    let file = input.files[0]; if (!file) return;
    let reader = new FileReader();
    reader.onload = async e => {
        // emojis ცხრილი: name, emoji_url
        const { error } = await db.from('emojis').insert([{ name: 'custom_' + Date.now(), emoji_url: e.target.result }]);
        if (!error) showNotification('✅ ემოჯი დაემატა!');
        else showNotification('შეცდომა: ' + error.message);
    };
    reader.readAsDataURL(file); input.value = '';
}

// ========== გულები ==========
setInterval(() => {
    let h = document.createElement('div');
    h.className = 'heart';
    h.innerHTML = ['❤️', '💖', '💗', '💘'][Math.floor(Math.random() * 4)];
    h.style.left = Math.random() * 100 + '%';
    h.style.fontSize = (26 + Math.random() * 20) + 'px';
    document.getElementById('hearts').appendChild(h);
    setTimeout(() => h.remove(), 5000);
}, 3500);

// ========== პროფილი ==========
async function saveStatus() {
    let status = document.getElementById('statusInput').value.trim();
    let me = users.find(u => u.username === currentUser);
    if (me) { me.status = status; saveLocal(); }
    await db.from('profiles').update({ status }).eq('username', currentUser);
    showNotification('✅ სტატუსი განახლდა!');
}

function uploadAvatar(input) {
    let file = input.files[0]; if (!file) return;
    let reader = new FileReader();
    reader.onload = e => {
        let me = users.find(u => u.username === currentUser);
        if (me) me.avatar = e.target.result;
        saveLocal(); updateProfileAvatarUI();
        showNotification('✅ ავატარი განახლდა!');
    };
    reader.readAsDataURL(file); input.value = '';
}

function removeAvatar() {
    let me = users.find(u => u.username === currentUser);
    if (me) { me.avatar = null; saveLocal(); }
    updateProfileAvatarUI(); showNotification('🗑️ ავატარი წაიშალა!');
}

// ========== ალბომი - ცხრილი: user_photos (id, username, data, created_at) ==========
async function renderAlbum() {
    let c = document.getElementById('albumGrid'); if (!c) return;
    const { data } = await db.from('user_photos').select('*').eq('username', currentUser).order('created_at', { ascending: true });
    c.innerHTML = (!data || data.length === 0)
        ? '<div class="empty-state" style="grid-column:span 3;">ალბომი ცარიელია</div>'
        : data.map(p => `<div style="position:relative;">
            <img src="${p.image_url}" class="album-photo" onclick="openPhotoModal('${p.id}','${escapeHtml(currentUser)}','${encodeURIComponent(p.image_url)}')">
            <button onclick="deleteAlbumPhoto(${p.id})" style="position:absolute;top:2px;right:2px;width:20px;height:20px;padding:0;margin:0;background:rgba(0,0,0,0.7);border-radius:50%;font-size:10px;border:none;cursor:pointer;color:white;">✕</button>
          </div>`).join('');
}

async function deleteAlbumPhoto(id) {
    await db.from('user_photos').delete().eq('id', id);
    renderAlbum(); showNotification('🗑️ ფოტო წაიშალა!');
}

async function addToAlbum(input) {
    let file = input.files[0]; if (!file) return;
    let reader = new FileReader();
    reader.onload = async e => {
        const { error } = await db.from('user_photos').insert([{ username: currentUser, image_url: e.target.result }]);
        if (!error) { showNotification('📸 ფოტო დაემატა!'); renderAlbum(); }
        else showNotification('შეცდომა: ' + error.message);
    };
    reader.readAsDataURL(file); input.value = '';
}

function setAsProfilePhoto(photoData) {
    let me = users.find(u => u.username === currentUser);
    if (me) me.avatar = photoData;
    saveLocal(); updateProfileAvatarUI();
    showNotification('✅ პროფილის ფოტო განახლდა!');
}

// ========== ფოტო მოდალი - ცხრილი: photo_comments ==========
async function openPhotoModal(photoId, username, photoDataEncoded) {
    let photoData = decodeURIComponent(photoDataEncoded || '');
    const { data: comments } = await db.from('photo_comments').select('*').eq('photo_id', String(photoId)).order('created_at', { ascending: true });

    let modal = document.createElement('div');
    modal.className = 'photo-modal';
    modal.innerHTML = `<div class="photo-modal-content">
        <img src="${photoData}" class="photo-modal-img">
        <div style="padding:9px;display:flex;gap:7px;flex-wrap:wrap;">
            ${currentUser === username ? `<button class="action-btn success" id="setProfileBtn">👤 პროფილის ფოტოდ</button>` : ''}
            <button class="action-btn danger" onclick="this.closest('.photo-modal').remove()">✕ დახურვა</button>
        </div>
        <div class="photo-comments" id="photoComments">
            ${(comments && comments.length)
                ? comments.map(c => `<div class="comment-item"><b>${escapeHtml(c.from_user)}</b>: ${escapeHtml(c.text)}</div>`).join('')
                : '<div style="opacity:0.5;padding:6px;font-size:12px;">კომენტარები არ არის</div>'}
        </div>
        <div class="comment-input-area">
            <input type="text" id="photoCommentInput" class="comment-input" placeholder="კომენტარი...">
            <button class="action-btn" id="addCommentBtn">📝</button>
        </div>
    </div>`;

    if (modal.querySelector('#setProfileBtn'))
        modal.querySelector('#setProfileBtn').onclick = () => { setAsProfilePhoto(photoData); modal.remove(); };

    modal.querySelector('#addCommentBtn').onclick = async () => {
        let input = modal.querySelector('#photoCommentInput');
        let text = input.value.trim(); if (!text) return;
        const { error } = await db.from('photo_comments').insert([{ photo_id: String(photoId), from_user: currentUser, text }]);
        if (!error) {
            const { data: newC } = await db.from('photo_comments').select('*').eq('photo_id', String(photoId)).order('created_at', { ascending: true });
            modal.querySelector('#photoComments').innerHTML = (newC || []).map(c => `<div class="comment-item"><b>${escapeHtml(c.from_user)}</b>: ${escapeHtml(c.text)}</div>`).join('');
            input.value = '';
        } else showNotification('კომენტარის შეცდომა: ' + error.message);
    };

    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}

// ========== მომხმარებლის პროფილი ==========
async function showUserProfile(username) {
    let user = users.find(u => u.username === username);
    if (!user) { showNotification('მომხმარებელი ვერ მოიძებნა'); return; }
    const { data: reqData } = await db.from('friend_requests').select('*')
        .or(`and(from_user.eq.${currentUser},to_user.eq.${username}),and(from_user.eq.${username},to_user.eq.${currentUser})`);
    let req = reqData && reqData[0];
    let isFr = req?.status === 'accepted', pendFromMe = req?.status === 'pending' && req?.from_user === currentUser, pendToMe = req?.status === 'pending' && req?.to_user === currentUser;
    let isBlocked = blockedUsers.includes(username), amAdmin = isAdminOrOwner(currentUser);
    const { data: photos } = await db.from('user_photos').select('*').eq('username', username).limit(6);

    let modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content">
        <div style="width:78px;height:78px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:38px;margin:0 auto 10px;${user.avatar ? `background-image:url(${user.avatar});background-size:cover;` : ''}">${user.avatar ? '' : user.username.charAt(0).toUpperCase()}</div>
        <h3>${escapeHtml(user.username)}</h3>
        <p style="opacity:0.8;font-size:12px;margin:4px 0;">${escapeHtml(user.status || '')}</p>
        <p style="font-size:12px;">${user.role === 'owner' ? '👑 დამფუძნებელი' : user.role === 'admin' ? '🔧 ადმინი' : '👤 მომხმარებელი'}</p>
        ${photos && photos.length ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:10px 0;">
            ${photos.map(p => `<img src="${p.image_url}" style="aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid var(--accent);" onclick="openPhotoModal('${p.id}','${escapeHtml(username)}','${encodeURIComponent(p.image_url)}')">`).join('')}
        </div>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:10px;">
            ${username !== currentUser && !isFr && !pendFromMe && !pendToMe ? `<button class="action-btn success" id="addFriendBtn">➕ მეგობრობა</button>` : ''}
            ${pendFromMe ? `<button class="action-btn" disabled>⏳ მოთხოვნა</button>` : ''}
            ${pendToMe ? `<button class="action-btn success" id="acceptBtn">✅ მიღება</button><button class="action-btn danger" id="rejectBtn">❌ უარყოფა</button>` : ''}
            ${isFr ? `<button class="action-btn success" disabled>✅ მეგობარი</button>` : ''}
            ${username !== currentUser ? `<button class="action-btn" id="pmBtn">💬 მიწერა</button>` : ''}
            ${username !== currentUser && !isBlocked ? `<button class="action-btn danger" id="blockBtn">🔒 დაბლოკვა</button>` : ''}
            ${isBlocked ? `<button class="action-btn success" id="unblockBtn">🔓 განბლოკვა</button>` : ''}
        </div>
        ${amAdmin && username !== currentUser ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #8b3a3a;display:flex;flex-wrap:wrap;gap:5px;justify-content:center;">
            ${user.role === 'user' ? `<button class="action-btn success" id="makeAdminBtn">🔧 ადმინად</button>` : ''}
            ${user.role === 'admin' ? `<button class="action-btn" id="removeAdminBtn">🔻 ადმინი ჩამოართვი</button>` : ''}
            ${currentUser === OWNER && user.role !== 'owner' ? `<button class="action-btn success" id="makeOwnerBtn">👑 დამფუძნებლად</button>` : ''}
        </div>` : ''}
        <button onclick="this.closest('.modal').remove()" style="background:#333;margin-top:10px;">დახურვა</button>
    </div>`;

    if (modal.querySelector('#addFriendBtn')) modal.querySelector('#addFriendBtn').onclick = () => { sendFriendRequest(username); modal.remove(); };
    if (modal.querySelector('#acceptBtn')) modal.querySelector('#acceptBtn').onclick = () => { acceptFriendRequest(username); modal.remove(); };
    if (modal.querySelector('#rejectBtn')) modal.querySelector('#rejectBtn').onclick = () => { rejectFriendRequest(username); modal.remove(); };
    if (modal.querySelector('#pmBtn')) modal.querySelector('#pmBtn').onclick = () => { openPrivateChat(username); modal.remove(); };
    if (modal.querySelector('#blockBtn')) modal.querySelector('#blockBtn').onclick = () => { if (!blockedUsers.includes(username)) { blockedUsers.push(username); saveLocal(); showNotification(`🔒 ${username} დაბლოკილია`); } modal.remove(); };
    if (modal.querySelector('#unblockBtn')) modal.querySelector('#unblockBtn').onclick = () => { blockedUsers = blockedUsers.filter(u => u !== username); saveLocal(); showNotification(`🔓 ${username} განბლოკილია`); modal.remove(); };
    if (modal.querySelector('#makeAdminBtn')) modal.querySelector('#makeAdminBtn').onclick = () => { let u = users.find(x => x.username === username); if (u) { u.role = 'admin'; u.status = '🔧 ადმინი'; saveLocal(); showNotification(`✅ ${username} ადმინია!`); } modal.remove(); };
    if (modal.querySelector('#removeAdminBtn')) modal.querySelector('#removeAdminBtn').onclick = () => { let u = users.find(x => x.username === username); if (u) { u.role = 'user'; u.status = 'ონლაინ'; saveLocal(); showNotification(`🔻 ადმინი ჩამოერთვა`); } modal.remove(); };
    if (modal.querySelector('#makeOwnerBtn')) modal.querySelector('#makeOwnerBtn').onclick = () => { let old = users.find(u => u.role === 'owner'); if (old) old.role = 'user'; let u = users.find(x => x.username === username); if (u) { u.role = 'owner'; u.status = '👑 დამფუძნებელი'; saveLocal(); showNotification(`👑 ${username} დამფუძნებელია!`); } modal.remove(); };
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}

// ========== ნავიგაცია ==========
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page + 'Page').classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => { btn.classList.remove('active'); if (btn.getAttribute('data-page') === page) btn.classList.add('active'); });
    document.getElementById('emojiPanel').style.display = 'none';
    if (page === 'online') renderUsersList();
    if (page === 'friends') { renderFriendsList(); renderRequestsList(); }
    if (page === 'messages') renderPMList();
    if (page === 'profile') { let me = users.find(u => u.username === currentUser); document.getElementById('statusInput').value = me?.status || ''; updateProfileAvatarUI(); renderAlbum(); }
    if (page !== 'chat') hideQuiz();
}

function toggleTheme() {
    document.body.classList.toggle('day-mode');
    document.getElementById('themeBtn').textContent = document.body.classList.contains('day-mode') ? '☀️' : '🌙';
}

function logout() {
    let me = users.find(u => u.username === currentUser);
    if (me) { me.online = false; saveLocal(); }
    localStorage.removeItem('mafia_user');
    window.location.href = "index.html";
}

// ========== ონლაინი ==========
async function updateOnlineStatus(online) {
    await db.from('profiles').update({ online, last_seen: Date.now().toString() }).eq('username', currentUser);
}

async function loadOnlineStatuses() {
    const { data } = await db.from('profiles').select('username,online');
    if (data) {
        data.forEach(p => {
            let u = users.find(x => x.username === p.username);
            if (u) u.online = p.online || false;
        });
        saveLocal();
    }
}

// ========== PM badge ==========
async function checkUnreadPMs() {
    const { data } = await db.from('direct_messages').select('id').eq('to_user', currentUser).eq('read', false);
    let btn = document.querySelector('.nav-btn[data-page="messages"]');
    if (btn) {
        let count = data?.length || 0;
        btn.innerHTML = count > 0 ? `💬<span style="position:absolute;top:2px;right:2px;background:red;color:white;border-radius:50%;font-size:9px;width:14px;height:14px;display:flex;align-items:center;justify-content:center;">${count}</span>` : '💬';
        btn.style.position = 'relative';
    }
}

// ========== მეგობრობის badge ==========
async function checkFriendRequests() {
    const { data } = await db.from('friend_requests').select('id').eq('to_user', currentUser).eq('status', 'pending');
    let btn = document.querySelector('.nav-btn[data-page="friends"]');
    if (btn) {
        let count = data?.length || 0;
        btn.innerHTML = count > 0 ? `👥<span style="position:absolute;top:2px;right:2px;background:red;color:white;border-radius:50%;font-size:9px;width:14px;height:14px;display:flex;align-items:center;justify-content:center;">${count}</span>` : '👥';
        btn.style.position = 'relative';
    }
}

// ========== ვიქტორინის ქულა ==========
async function saveQuizScore(score) {
    const { data: prof } = await db.from('profiles').select('quiz_score').eq('username', currentUser).maybeSingle();
    let current = prof?.quiz_score || 0;
    if (score > current) {
        await db.from('profiles').update({ quiz_score: score }).eq('username', currentUser);
        showNotification(`🏆 ახალი რეკორდი: ${score} ქულა!`);
    }
}

// ========== შიფროგრამა ==========
let cipherWord = '', cipherGuessed = [], cipherWrong = 0, cipherMaxWrong = 6;

async function startCipher() {
    const { data, error } = await db.from('cipher_games').select('*');
    if (error || !data || data.length === 0) { showNotification('სიტყვები ვერ მოიძებნა!'); return; }
    let q = data[Math.floor(Math.random() * data.length)];
    cipherWord = q.word.toUpperCase();
    cipherGuessed = [];
    cipherWrong = 0;
    showCipherGame(q.hint);
}

function showCipherGame(hint) {
    let ex = document.getElementById('cipherBox'); if (ex) ex.remove();
    let display = cipherWord.split('').map(l => cipherGuessed.includes(l) ? l : '_').join(' ');
    let letters = 'ᲐᲑᲒᲓᲔᲕᲖᲗᲘᲙᲚᲛᲜᲝᲞᲟᲠᲡᲢᲣᲤᲥᲦᲧᲨᲩᲪᲫᲬᲭᲮᲯᲰ'.split('').concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
    let usedLetters = new Set(cipherGuessed);
    let box = document.createElement('div');
    box.id = 'cipherBox';
    box.style.cssText = 'position:fixed;bottom:80px;left:10px;right:10px;background:var(--card);border:2px solid var(--accent);border-radius:16px;padding:14px;z-index:3000;max-height:70vh;overflow-y:auto;';
    box.innerHTML = `
        <div style="font-size:12px;opacity:0.6;margin-bottom:6px;">🏆 შიფროგრამა • შეცდომები: ${cipherWrong}/${cipherMaxWrong}</div>
        <div style="font-size:12px;opacity:0.7;margin-bottom:8px;">💡 ${escapeHtml(hint)}</div>
        <div style="font-size:22px;letter-spacing:8px;text-align:center;margin:10px 0;font-weight:bold;">${display}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:8px 0;">
            ${letters.filter(l => cipherWord.includes(l) || cipherWord.includes(l.toLowerCase())).map(l =>
                `<button onclick="guessCipher('${l}')" ${usedLetters.has(l)?'disabled':''} style="padding:6px 10px;border-radius:8px;border:1px solid var(--accent);background:${usedLetters.has(l)?(cipherWord.includes(l)?'#2d6a4f':'#8b0000'):'#2a1a1a'};color:white;cursor:pointer;font-size:13px;">${l}</button>`
            ).join('')}
        </div>
        <button onclick="hideCipher()" style="margin-top:8px;background:#333;font-size:12px;padding:5px 10px;">✕ დახურვა</button>`;
    document.body.appendChild(box);
}

async function guessCipher(letter) {
    if (cipherGuessed.includes(letter)) return;
    cipherGuessed.push(letter);
    if (!cipherWord.includes(letter)) cipherWrong++;

    let display = cipherWord.split('').map(l => cipherGuessed.includes(l) ? l : '_').join(' ');
    let won = !display.includes('_');
    let lost = cipherWrong >= cipherMaxWrong;

    if (won) {
        let score = Math.max(10 - cipherWrong * 2, 1);
        const { data: prof } = await db.from('profiles').select('cipher_score').eq('username', currentUser).maybeSingle();
        let current = prof?.cipher_score || 0;
        await db.from('profiles').update({ cipher_score: current + score }).eq('username', currentUser);
        showNotification(`🎉 სწორია! +${score} ქულა`);
        hideCipher();
        setTimeout(startCipher, 1500);
    } else if (lost) {
        showNotification(`💀 წაიგე! სიტყვა იყო: ${cipherWord}`);
        hideCipher();
        setTimeout(startCipher, 2000);
    } else {
        let ex = document.getElementById('cipherBox');
        let hint = ex?.querySelector('div:nth-child(2)')?.textContent?.replace('💡 ', '') || '';
        hideCipher();
        showCipherGame(hint);
    }
}

function hideCipher() { let b = document.getElementById('cipherBox'); if (b) b.remove(); }

// ========== პროფილი - ქულები ==========
async function renderProfileScores() {
    const { data } = await db.from('profiles').select('quiz_score,cipher_score').eq('username', currentUser).maybeSingle();
    let qs = data?.quiz_score || 0;
    let cs = data?.cipher_score || 0;
    let el = document.getElementById('profileScores');
    if (el) el.innerHTML = `<div style="display:flex;gap:16px;justify-content:center;margin:8px 0;">
        <div style="text-align:center;"><div style="font-size:20px;">⁉️</div><div style="font-size:12px;">ვიქტორინა</div><div style="font-weight:bold;color:var(--accent);">${qs}</div></div>
        <div style="text-align:center;"><div style="font-size:20px;">🏆</div><div style="font-size:12px;">შიფროგრამა</div><div style="font-weight:bold;color:var(--accent);">${cs}</div></div>
    </div>`;
}

// ========== START ==========
async function init() {
    await initData();
    await loadOnlineStatuses();
    await updateOnlineStatus(true);
    renderRooms();
    await renderAll();
    renderPMList();
    renderAlbum();

    // ქულები პროფილზე
    let profilePage = document.getElementById('profilePage');
    if (profilePage) {
        let scoresDiv = document.createElement('div');
        scoresDiv.id = 'profileScores';
        let nameEl = document.getElementById('profileName');
        if (nameEl) nameEl.after(scoresDiv);
    }
    renderProfileScores();

    // badge-ები
    checkFriendRequests();
    checkUnreadPMs();
    setInterval(checkFriendRequests, 10000);
    setInterval(checkUnreadPMs, 10000);
    setInterval(loadOnlineStatuses, 15000);

    document.getElementById('themeBtn').addEventListener('click', toggleTheme);
    document.querySelectorAll('.nav-btn[data-page]').forEach(btn => btn.addEventListener('click', () => showPage(btn.getAttribute('data-page'))));
    document.getElementById('messageInput').addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
    document.addEventListener('click', e => { let p = document.getElementById('emojiPanel'); if (p && !p.contains(e.target) && !e.target.classList.contains('icon-btn')) p.style.display = 'none'; });
    window.addEventListener('beforeunload', () => { updateOnlineStatus(false); });
}

init();