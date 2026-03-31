// ========== SUPABASE ==========
const SUPABASE_URL = 'https://ftfciebnywbondaiarnc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eQZDSu_Jy1gWmXJFF800Pw_TP2kBRLI';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ========== მომხმარებელი ==========
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

let users = JSON.parse(localStorage.getItem('mafia_users') || '[]');
let customEmojis = JSON.parse(localStorage.getItem('mafia_emojis') || '[]');
let photoInteractions = JSON.parse(localStorage.getItem('mafia_photo_comments') || '{}');
let userAlbums = JSON.parse(localStorage.getItem('mafia_albums') || '{}');
let blockedUsers = JSON.parse(localStorage.getItem('mafia_blocked') || '[]');
let friendReqs = JSON.parse(localStorage.getItem('mafia_friend_reqs') || '[]');

const ROOMS = [
    "☕ კაფე-ბარი","🎲 ნარდი","🃏 ჯოკერი","💎 VIP","📝 ფორუმი",
    "🛠️ ადმინები","😂 იუმორი","🏆 შიფროგრამა","🎭 გამოძიება",
    "🎵 მუსიკა","⁉️ ვიქტორინა","🆘 დახმარება"
];

function saveAll() {
    localStorage.setItem('mafia_users', JSON.stringify(users));
    localStorage.setItem('mafia_emojis', JSON.stringify(customEmojis));
    localStorage.setItem('mafia_photo_comments', JSON.stringify(photoInteractions));
    localStorage.setItem('mafia_albums', JSON.stringify(userAlbums));
    localStorage.setItem('mafia_blocked', JSON.stringify(blockedUsers));
    localStorage.setItem('mafia_friend_reqs', JSON.stringify(friendReqs));
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
    let u = users.find(x => x.username === username);
    return u?.avatar || null;
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
                    role: p.role === 'Admin' ? 'admin' : (p.username === OWNER ? 'owner' : 'user'),
                    online: false
                });
            } else {
                if (p.status) ex.status = p.status;
                if (p.avatar) ex.avatar = p.avatar;
            }
        });
        saveAll();
    }

    let me = users.find(u => u.username === currentUser);
    if (!me) {
        users.push({ username: currentUser, status: "ახალი მოთამაშე", avatar: null, role: 'user', online: true });
    } else {
        me.online = true;
    }
    saveAll();

    document.getElementById('profileName').textContent = currentUser;
    let meUser = users.find(u => u.username === currentUser);
    if (meUser?.status) document.getElementById('statusInput').value = meUser.status;
    updateProfileAvatarUI();
}

function updateProfileAvatarUI() {
    let me = users.find(u => u.username === currentUser);
    let av = document.getElementById('profileAvatar');
    if (me?.avatar) {
        av.style.backgroundImage = `url(${me.avatar})`;
        av.style.backgroundSize = 'cover';
        av.innerHTML = '';
    } else {
        av.style.backgroundImage = '';
        av.innerHTML = '👤';
    }
}

// ========== ოთახები ==========
function renderRooms() {
    document.getElementById('roomsList').innerHTML = ROOMS.map(room =>
        `<div class="room-card" onclick="openRoom('${escapeHtml(room)}')">${room}</div>`
    ).join('');
}

function openRoom(room) {
    currentRoom = room;
    document.getElementById('chatRoomName').textContent = room;
    showPage('chat');
    listenToRoom(room);
}

function closeChat() {
    if (messagesChannel) { db.removeChannel(messagesChannel); messagesChannel = null; }
    currentRoom = null;
    showPage('home');
}

// ========== REALTIME შეტყობინებები ==========
async function listenToRoom(roomName) {
    if (messagesChannel) { await db.removeChannel(messagesChannel); messagesChannel = null; }
    await renderRoomMessages(roomName);

    messagesChannel = db
        .channel('room_' + btoa(roomName).replace(/[^a-zA-Z0-9]/g, ''))
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'messages',
            filter: `room=eq.${roomName}`
        }, (payload) => {
            if (currentRoom === roomName) appendMessage(payload.new);
        })
        .on('postgres_changes', {
            event: 'DELETE', schema: 'public', table: 'messages'
        }, () => {
            if (currentRoom === roomName) renderRoomMessages(roomName);
        })
        .subscribe();
}

async function renderRoomMessages(roomName) {
    let container = document.getElementById('chatMessages');
    if (!container || currentRoom !== roomName) return;
    const { data: msgs, error } = await db
        .from('messages').select('*')
        .eq('room', roomName)
        .order('time', { ascending: true })
        .limit(100);
    if (error) { console.error(error); return; }
    if (!msgs || msgs.length === 0) {
        container.innerHTML = '<div class="empty-state">💬 შეტყობინებები არ არის</div>';
        return;
    }
    container.innerHTML = msgs.map(msg => buildMessageHtml(msg)).join('');
    container.scrollTop = container.scrollHeight;
}

function buildMessageHtml(msg) {
    let isOwn = msg.sender === currentUser;
    let time = new Date(parseInt(msg.time)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let canDelete = currentUser === OWNER || msg.sender === currentUser;
    let avatar = getAvatar(msg.sender);
    let avatarStyle = avatar ? `background-image:url(${avatar});background-size:cover;` : '';
    let avatarContent = avatar ? '' : escapeHtml(msg.sender.charAt(0).toUpperCase());

    // ტექსტიდან emoji-ების გამოყოფა — base64 სურათი თუ ჩვეულებრივი ტექსტი
    let textContent = '';
    if (msg.text) {
        // custom emoji images in text
        textContent = msg.text.replace(/\[IMG:(data:[^\]]+)\]/g, (match, src) => {
            return `<img src="${src}" style="width:28px;height:28px;border-radius:4px;vertical-align:middle;">`;
        });
        if (textContent === msg.text) textContent = escapeHtml(msg.text);
    }

    return `<div class="msg-row ${isOwn ? 'own' : ''}" id="msgrow-${msg.id}">
        <div class="msg-avatar" style="${avatarStyle}" onclick="showUserProfile('${escapeHtml(msg.sender)}')">${avatarContent}</div>
        <div class="message" id="msg-${msg.id}">
            <span class="message-name" onclick="showUserProfile('${escapeHtml(msg.sender)}')">${escapeHtml(msg.sender)}</span>
            <span class="message-time">${time}</span>
            <div class="message-text">${textContent}</div>
            ${msg.image ? `<img src="${msg.image}" class="message-img" onclick="openPhotoModal('${msg.image}','${escapeHtml(msg.sender)}')">` : ''}
            ${canDelete ? `<button class="delete-msg" onclick="deleteMessage(${msg.id})">🗑️</button>` : ''}
        </div>
    </div>`;
}

function appendMessage(msg) {
    let container = document.getElementById('chatMessages');
    if (!container) return;
    let empty = container.querySelector('.empty-state');
    if (empty) empty.remove();
    container.insertAdjacentHTML('beforeend', buildMessageHtml(msg));
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    let input = document.getElementById('messageInput');
    let text = input.value.trim();
    if (!text && !pendingImage) return;
    if (!currentRoom) return;

    // image კოლონა არ გვაქვს, ამიტომ სურათს text-ში ვინახავთ სპეც ტეგით
    let finalText = text;
    let imageData = null;
    if (pendingImage) {
        imageData = pendingImage;
    }

    const { error } = await db.from('messages').insert([{
        sender: currentUser,
        text: finalText || "",
        room: currentRoom,
        time: Date.now().toString()
    }]);

    if (error) {
        showNotification('შეცდომა: ' + error.message);
        return;
    }
    input.value = '';
    clearPendingImg();
}

async function deleteMessage(id) {
    await db.from('messages').delete().eq('id', id);
    let el = document.getElementById('msgrow-' + id);
    if (el) el.remove();
}

function addChatPhoto(input) {
    let file = input.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = e => {
        pendingImage = e.target.result;
        document.getElementById('pendingImgPreview').src = pendingImage;
        document.getElementById('pendingImgWrap').style.display = 'flex';
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function clearPendingImg() {
    pendingImage = null;
    document.getElementById('pendingImgWrap').style.display = 'none';
    document.getElementById('pendingImgPreview').src = '';
}

// ========== Enter კლავიში ==========
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('messageInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') sendMessage();
    });
});

// ========== პირადი მიმოწერა ==========
async function listenToPM(otherUser) {
    if (pmChannel) { await db.removeChannel(pmChannel); pmChannel = null; }
    let chatId = [currentUser, otherUser].sort().join('_');
    await renderPMMessages(chatId);
    pmChannel = db
        .channel('pm_' + chatId)
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'direct_messages',
            filter: `chat_id=eq.${chatId}`
        }, payload => appendPMMessage(payload.new))
        .subscribe();
}

async function renderPMMessages(chatId) {
    let container = document.getElementById('pmMessages');
    if (!container) return;
    const { data: msgs } = await db
        .from('direct_messages').select('*')
        .eq('chat_id', chatId)
        .order('time', { ascending: true });
    if (!msgs || msgs.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:15px;font-size:12px;">მიმოწერა ცარიელია</div>';
        return;
    }
    container.innerHTML = msgs.map(msg => buildPMHtml(msg)).join('');
    container.scrollTop = container.scrollHeight;
}

function buildPMHtml(msg) {
    let isOwn = msg.from_user === currentUser;
    let time = new Date(parseInt(msg.time)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div style="text-align:${isOwn ? 'right' : 'left'};margin:5px 0;">
        <div style="background:${isOwn ? '#8b0000' : '#2a1a1a'};display:inline-block;padding:6px 10px;border-radius:12px;max-width:88%;word-break:break-word;font-size:13px;">${escapeHtml(msg.text)}</div>
        <div style="font-size:9px;opacity:0.6;margin-top:2px;">${time}</div>
    </div>`;
}

function appendPMMessage(msg) {
    let container = document.getElementById('pmMessages');
    if (!container) return;
    let empty = container.querySelector('.empty-state');
    if (empty) empty.remove();
    container.insertAdjacentHTML('beforeend', buildPMHtml(msg));
    container.scrollTop = container.scrollHeight;
}

async function sendPM() {
    let input = document.getElementById('pmInput');
    let text = input.value.trim();
    if (!text || !currentPMUser) return;
    let chatId = [currentUser, currentPMUser].sort().join('_');
    await db.from('direct_messages').insert([{
        chat_id: chatId, from_user: currentUser,
        to_user: currentPMUser, text: text, time: Date.now().toString()
    }]);
    input.value = '';
}

async function renderPMList() {
    let container = document.getElementById('pmList');
    if (!container) return;
    const { data: chats } = await db
        .from('direct_messages').select('chat_id,from_user,to_user')
        .or(`from_user.eq.${currentUser},to_user.eq.${currentUser}`);
    let seen = new Set();
    chats?.forEach(c => {
        let other = c.from_user === currentUser ? c.to_user : c.from_user;
        seen.add(other);
    });
    if (seen.size === 0) { container.innerHTML = '<div class="empty-state">ჯერ არ გქონია მიმოწერა</div>'; return; }
    container.innerHTML = Array.from(seen).map(username => {
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
    currentPMUser = username;
    renderPrivateChat();
    listenToPM(username);
}

function renderPrivateChat() {
    document.getElementById('pmContainer').innerHTML = `
        <div class="pm-window">
            <div class="pm-header">
                <span>💬 ${escapeHtml(currentPMUser)}</span>
                <span onclick="closePM()">✕</span>
            </div>
            <div class="pm-messages" id="pmMessages"></div>
            <div class="pm-input">
                <input type="text" id="pmInput" placeholder="დაწერე..." onkeypress="if(event.key==='Enter') sendPM()">
                <button onclick="sendPM()">➤</button>
            </div>
        </div>`;
}

function closePM() {
    if (pmChannel) { db.removeChannel(pmChannel); pmChannel = null; }
    document.getElementById('pmContainer').innerHTML = '';
    currentPMUser = null;
}

// ========== ემოჯი ==========
function toggleEmojiPanel() {
    let panel = document.getElementById('emojiPanel');
    if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
    let defaults = ['😊','😂','❤️','🔥','👍','🎉','😍','🥳','😎','🥺','💀','👑','💪','🤡','👻','😘','🙏','😆','😅','🤔','😒','😢','😭','😤','🫡','😋','🤩','😏','🙄','😬','🤣','😇','🥰','😡','🤯','💯','✨','🎊','🍀'];
    let me = users.find(u => u.username === currentUser);
    let isAdmin = me?.role === 'admin' || currentUser === OWNER;
    panel.innerHTML = `<div class="emoji-grid">
        ${defaults.map(e => `<div class="emoji-item" onclick="insertEmoji('${e}')">${e}</div>`).join('')}
        ${customEmojis.map(e => typeof e === 'string' && e.startsWith('data:')
            ? `<img src="${e}" style="width:32px;height:32px;object-fit:cover;border-radius:6px;cursor:pointer;padding:2px;" onclick="insertCustomEmoji('${e}')">`
            : `<div class="emoji-item" onclick="insertEmoji('${e}')">${e}</div>`
        ).join('')}
        ${isAdmin ? `<div class="emoji-item" style="background:#8b0000;border-radius:8px;" onclick="document.getElementById('emojiFile').click()">➕</div>` : ''}
    </div>`;
    panel.style.display = 'block';
}

function insertEmoji(emoji) {
    let input = document.getElementById('messageInput');
    if (input) {
        let pos = input.selectionStart;
        let val = input.value;
        input.value = val.slice(0, pos) + emoji + val.slice(pos);
        input.selectionStart = input.selectionEnd = pos + emoji.length;
        input.focus();
    }
    document.getElementById('emojiPanel').style.display = 'none';
}

function insertCustomEmoji(src) {
    // custom emoji — ვინახავთ pending image-ად
    pendingImage = src;
    document.getElementById('pendingImgPreview').src = src;
    document.getElementById('pendingImgWrap').style.display = 'flex';
    document.getElementById('emojiPanel').style.display = 'none';
}

function uploadEmoji(input) {
    let me = users.find(u => u.username === currentUser);
    if (!me || (me.role !== 'admin' && currentUser !== OWNER)) { showNotification('❌ მხოლოდ ადმინებს შეუძლიათ!'); return; }
    let file = input.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = e => { customEmojis.push(e.target.result); saveAll(); showNotification('✅ ემოჯი დაემატა!'); };
    reader.readAsDataURL(file);
    input.value = '';
}

// ========== გულები ==========
setInterval(() => {
    let h = document.createElement('div');
    h.className = 'heart';
    h.innerHTML = ['❤️','💖','💗','💘'][Math.floor(Math.random() * 4)];
    h.style.left = Math.random() * 100 + '%';
    h.style.fontSize = (26 + Math.random() * 20) + 'px';
    document.getElementById('hearts').appendChild(h);
    setTimeout(() => h.remove(), 5000);
}, 3500);

// ========== პროფილი ==========
async function saveStatus() {
    let me = users.find(u => u.username === currentUser);
    let status = document.getElementById('statusInput').value.trim();
    if (me) {
        me.status = status;
        saveAll();
        await db.from('profiles').update({ status }).eq('username', currentUser);
        showNotification('✅ სტატუსი განახლდა!');
    }
}

function uploadAvatar(input) {
    let file = input.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = e => {
        let me = users.find(u => u.username === currentUser);
        if (me) me.avatar = e.target.result;
        saveAll();
        updateProfileAvatarUI();
        showNotification('✅ ავატარი განახლდა!');
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function removeAvatar() {
    let me = users.find(u => u.username === currentUser);
    if (me) { me.avatar = null; saveAll(); }
    updateProfileAvatarUI();
    showNotification('🗑️ ავატარი წაიშალა!');
}

function renderAlbum() {
    let container = document.getElementById('albumGrid');
    let album = userAlbums[currentUser] || [];
    container.innerHTML = album.length === 0
        ? '<div class="empty-state" style="grid-column:span 3;">ალბომი ცარიელია</div>'
        : album.map((photo, idx) => `<img src="${photo}" class="album-photo" onclick="openPhotoModal('${photo}','${escapeHtml(currentUser)}')">`).join('');
}

function addToAlbum(input) {
    let file = input.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = e => {
        if (!userAlbums[currentUser]) userAlbums[currentUser] = [];
        userAlbums[currentUser].push(e.target.result);
        saveAll(); renderAlbum();
        showNotification('📸 ფოტო დაემატა!');
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function setAsProfilePhoto(photoUrl) {
    let me = users.find(u => u.username === currentUser);
    if (me) me.avatar = photoUrl;
    saveAll();
    updateProfileAvatarUI();
    showNotification('✅ პროფილის ფოტო განახლდა!');
}

// ========== ფოტო მოდალი ==========
function openPhotoModal(photoUrl, username) {
    if (!photoInteractions[photoUrl]) photoInteractions[photoUrl] = { likes: [], comments: [] };
    let data = photoInteractions[photoUrl];
    let modal = document.createElement('div');
    modal.className = 'photo-modal';
    modal.innerHTML = `<div class="photo-modal-content">
        <img src="${photoUrl}" class="photo-modal-img">
        <div style="padding:9px;display:flex;gap:7px;flex-wrap:wrap;">
            <button class="action-btn" id="likeBtn">❤️ ${data.likes.length}</button>
            <button class="action-btn">💬 ${data.comments.length}</button>
            ${currentUser === username ? `<button class="action-btn success" id="setProfileBtn">👤 პროფილის ფოტოდ</button>` : ''}
            <button class="action-btn danger" onclick="this.closest('.photo-modal').remove()">✕</button>
        </div>
        <div class="photo-comments" id="photoComments">
            ${data.comments.length ? data.comments.map(c => `<div class="comment-item"><b>${escapeHtml(c.user)}</b>: ${escapeHtml(c.text)}</div>`).join('') : '<div style="opacity:0.5;padding:6px;font-size:12px;">კომენტარები არ არის</div>'}
        </div>
        <div class="comment-input-area">
            <input type="text" id="photoCommentInput" class="comment-input" placeholder="კომენტარი...">
            <button class="action-btn" id="addCommentBtn">📝</button>
        </div>
    </div>`;
    modal.querySelector('#likeBtn').onclick = () => {
        let idx = data.likes.indexOf(currentUser);
        if (idx === -1) data.likes.push(currentUser); else data.likes.splice(idx, 1);
        saveAll();
        modal.querySelector('#likeBtn').innerHTML = `❤️ ${data.likes.length}`;
    };
    if (modal.querySelector('#setProfileBtn')) {
        modal.querySelector('#setProfileBtn').onclick = () => { setAsProfilePhoto(photoUrl); modal.remove(); };
    }
    modal.querySelector('#addCommentBtn').onclick = () => {
        let input = modal.querySelector('#photoCommentInput');
        let text = input.value.trim();
        if (!text) return;
        data.comments.push({ user: currentUser, text, time: Date.now() });
        saveAll();
        modal.querySelector('#photoComments').innerHTML = data.comments.map(c => `<div class="comment-item"><b>${escapeHtml(c.user)}</b>: ${escapeHtml(c.text)}</div>`).join('');
        input.value = '';
    };
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}

// ========== მეგობრები ==========
function isFriend(username) {
    return friendReqs.some(r => r.status === 'accepted' &&
        ((r.from === currentUser && r.to === username) || (r.from === username && r.to === currentUser)));
}

function sendFriendRequest(target) {
    if (target === currentUser) return showNotification('საკუთარ თავს ვერ დაუმატებ');
    if (isFriend(target)) return showNotification('უკვე მეგობარია');
    if (friendReqs.some(r => r.from === currentUser && r.to === target && r.status === 'pending'))
        return showNotification('მოთხოვნა უკვე გაგზავნილია');
    friendReqs.push({ from: currentUser, to: target, status: 'pending' });
    saveAll();
    showNotification(`📨 მოთხოვნა გაეგზავნა ${target}-ს`);
    renderUsersList();
}

function acceptFriendRequest(from) {
    let req = friendReqs.find(r => r.from === from && r.to === currentUser && r.status === 'pending');
    if (req) { req.status = 'accepted'; saveAll(); showNotification(`✅ ${from} დაემატა!`); renderAll(); }
}

function rejectFriendRequest(from) {
    friendReqs = friendReqs.filter(r => !(r.from === from && r.to === currentUser && r.status === 'pending'));
    saveAll(); showNotification('❌ უარყავით'); renderAll();
}

function blockUser(username) {
    if (!blockedUsers.includes(username)) { blockedUsers.push(username); saveAll(); showNotification(`🔒 ${username} დაბლოკილია`); renderUsersList(); }
}

function unblockUser(username) {
    blockedUsers = blockedUsers.filter(u => u !== username);
    saveAll(); showNotification(`🔓 ${username} განბლოკილია`); renderUsersList();
}

function makeAdmin(username) {
    let u = users.find(x => x.username === username);
    if (u) { u.role = 'admin'; u.status = '🔧 ადმინი'; saveAll(); showNotification(`✅ ${username} ადმინია!`); renderUsersList(); }
}

function removeAdmin(username) {
    let u = users.find(x => x.username === username);
    if (u) { u.role = 'user'; u.status = 'ონლაინ'; saveAll(); showNotification(`🔻 ადმინი ჩამოერთვა`); renderUsersList(); }
}

function makeOwner(username) {
    let old = users.find(u => u.role === 'owner');
    if (old) old.role = 'user';
    let u = users.find(x => x.username === username);
    if (u) { u.role = 'owner'; u.status = '👑 დამფუძნებელი'; saveAll(); showNotification(`👑 ${username} დამფუძნებელია!`); renderUsersList(); }
}

// ========== მომხმარებლის პროფილი ==========
function showUserProfile(username) {
    let user = users.find(u => u.username === username);
    if (!user) { showNotification('მომხმარებელი ვერ მოიძებნა'); return; }
    let friendUser = isFriend(username);
    let pendFromMe = friendReqs.some(r => r.from === currentUser && r.to === username && r.status === 'pending');
    let pendToMe = friendReqs.some(r => r.from === username && r.to === currentUser && r.status === 'pending');
    let isBlocked = blockedUsers.includes(username);
    let me = users.find(u => u.username === currentUser);
    let amAdmin = me?.role === 'admin' || currentUser === OWNER;

    let modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content">
        <div style="width:78px;height:78px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:38px;margin:0 auto 10px;${user.avatar ? `background-image:url(${user.avatar});background-size:cover;` : ''}">${user.avatar ? '' : user.username.charAt(0).toUpperCase()}</div>
        <h3>${escapeHtml(user.username)}</h3>
        <p style="opacity:0.8;font-size:12px;margin:4px 0;">${escapeHtml(user.status || '')}</p>
        <p style="font-size:12px;">${user.role === 'owner' ? '👑 დამფუძნებელი' : user.role === 'admin' ? '🔧 ადმინი' : '👤 მომხმარებელი'}</p>
        <div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:10px;">
            ${username !== currentUser && !friendUser && !pendFromMe && !pendToMe ? `<button class="action-btn success" id="addFriendBtn">➕ მეგობრობა</button>` : ''}
            ${pendFromMe ? `<button class="action-btn" disabled>⏳ მოთხოვნა</button>` : ''}
            ${pendToMe ? `<button class="action-btn success" id="acceptBtn">✅ მიღება</button><button class="action-btn danger" id="rejectBtn">❌ უარყოფა</button>` : ''}
            ${friendUser ? `<button class="action-btn success" disabled>✅ მეგობარი</button>` : ''}
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
    if (modal.querySelector('#blockBtn')) modal.querySelector('#blockBtn').onclick = () => { blockUser(username); modal.remove(); };
    if (modal.querySelector('#unblockBtn')) modal.querySelector('#unblockBtn').onclick = () => { unblockUser(username); modal.remove(); };
    if (modal.querySelector('#makeAdminBtn')) modal.querySelector('#makeAdminBtn').onclick = () => { makeAdmin(username); modal.remove(); };
    if (modal.querySelector('#removeAdminBtn')) modal.querySelector('#removeAdminBtn').onclick = () => { removeAdmin(username); modal.remove(); };
    if (modal.querySelector('#makeOwnerBtn')) modal.querySelector('#makeOwnerBtn').onclick = () => { makeOwner(username); modal.remove(); };
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}

// ========== სიები ==========
function renderUsersList() {
    let container = document.getElementById('usersList');
    if (!container) return;
    let others = users.filter(u => u.username !== currentUser);
    if (others.length === 0) { container.innerHTML = '<div class="empty-state">სხვა მომხმარებლები არ არიან</div>'; return; }
    container.innerHTML = others.map(user => {
        let fr = isFriend(user.username);
        let pendFromMe = friendReqs.some(r => r.from === currentUser && r.to === user.username && r.status === 'pending');
        let pendToMe = friendReqs.some(r => r.from === user.username && r.to === currentUser && r.status === 'pending');
        return `<div class="user-item" onclick="showUserProfile('${escapeHtml(user.username)}')">
            <div class="user-avatar" style="${user.avatar ? `background-image:url(${user.avatar});background-size:cover;` : ''}">
                ${user.avatar ? '' : user.username.charAt(0).toUpperCase()}
                ${user.online ? '<span class="online-dot"></span>' : ''}
            </div>
            <div style="flex:1;">
                <div style="font-weight:bold;font-size:13px;">${escapeHtml(user.username)} ${user.role === 'owner' ? '👑' : user.role === 'admin' ? '🔧' : ''}</div>
                <div style="font-size:11px;opacity:0.7;">${escapeHtml(user.status || '')}</div>
            </div>
            ${!fr && !pendFromMe && !pendToMe ? `<div class="add-badge" onclick="event.stopPropagation();sendFriendRequest('${escapeHtml(user.username)}')">➕</div>` : ''}
            ${pendFromMe ? `<div class="add-badge" style="background:orange;">⏳</div>` : ''}
            ${pendToMe ? `<div class="add-badge" style="background:gold;color:black;" onclick="event.stopPropagation();acceptFriendRequest('${escapeHtml(user.username)}')">✅</div>` : ''}
            ${fr ? `<div class="friend-badge">✅</div>` : ''}
        </div>`;
    }).join('');
}

function renderFriendsList() {
    let container = document.getElementById('friendsList');
    if (!container) return;
    let myFriends = friendReqs
        .filter(r => r.status === 'accepted' && (r.from === currentUser || r.to === currentUser))
        .map(r => r.from === currentUser ? r.to : r.from);
    let friendUsers = users.filter(u => myFriends.includes(u.username));
    container.innerHTML = friendUsers.length === 0
        ? '<div class="empty-state">მეგობრები არ არიან</div>'
        : friendUsers.map(u => `<div class="user-item" onclick="showUserProfile('${escapeHtml(u.username)}')">
            <div class="user-avatar" style="${u.avatar ? `background-image:url(${u.avatar});background-size:cover;` : ''}">${u.avatar ? '' : u.username.charAt(0).toUpperCase()}</div>
            <div><div style="font-weight:bold;font-size:13px;">${escapeHtml(u.username)}</div><div style="font-size:11px;opacity:0.7;">${escapeHtml(u.status || '')}</div></div>
        </div>`).join('');
}

function renderRequestsList() {
    let container = document.getElementById('requestsList');
    if (!container) return;
    let pending = friendReqs.filter(r => r.to === currentUser && r.status === 'pending');
    container.innerHTML = pending.length === 0
        ? '<div class="empty-state">მოთხოვნები არ არის</div>'
        : pending.map(req => `<div class="user-item">
            <div class="user-avatar">${req.from.charAt(0).toUpperCase()}</div>
            <div style="flex:1;"><div style="font-weight:bold;font-size:13px;">${escapeHtml(req.from)}</div><div style="font-size:11px;opacity:0.7;">მეგობრობის მოთხოვნა</div></div>
            <div style="display:flex;gap:4px;">
                <button class="action-btn success" onclick="acceptFriendRequest('${escapeHtml(req.from)}')">✅</button>
                <button class="action-btn danger" onclick="rejectFriendRequest('${escapeHtml(req.from)}')">❌</button>
            </div>
        </div>`).join('');
}

function renderAll() { renderUsersList(); renderFriendsList(); renderRequestsList(); }

// ========== ნავიგაცია ==========
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(page + 'Page').classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-page') === page) btn.classList.add('active');
    });
    document.getElementById('emojiPanel').style.display = 'none';
    if (page === 'online') renderUsersList();
    if (page === 'friends') { renderFriendsList(); renderRequestsList(); }
    if (page === 'messages') renderPMList();
    if (page === 'profile') {
        let me = users.find(u => u.username === currentUser);
        document.getElementById('statusInput').value = me?.status || '';
        updateProfileAvatarUI();
        renderAlbum();
    }
}

function toggleTheme() {
    document.body.classList.toggle('day-mode');
    document.getElementById('themeBtn').textContent = document.body.classList.contains('day-mode') ? '☀️' : '🌙';
}

function logout() {
    let me = users.find(u => u.username === currentUser);
    if (me) { me.online = false; saveAll(); }
    localStorage.removeItem('mafia_user');
    window.location.href = "index.html";
}

// ========== START ==========
async function init() {
    await initData();
    renderRooms();
    renderAll();
    renderPMList();
    renderAlbum();

    document.getElementById('themeBtn').addEventListener('click', toggleTheme);
    document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => showPage(btn.getAttribute('data-page')));
    });

    document.addEventListener('click', e => {
        let panel = document.getElementById('emojiPanel');
        if (panel && !panel.contains(e.target) && !e.target.classList.contains('icon-btn')) {
            panel.style.display = 'none';
        }
    });

    window.addEventListener('beforeunload', () => {
        let me = users.find(u => u.username === currentUser);
        if (me) { me.online = false; saveAll(); }
    });
}

init();
