// ========== კონფიგურაცია და ცვლადები ==========
const SUPABASE_URL = 'https://ftfciebnywbondaiarnc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eQZDSu_Jy1gWmXJFF800Pw_TP2kBRLI';

// ბაზის ინიციალიზაცია უსაფრთხოდ
let db;
if (typeof supabase !== 'undefined') {
    db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    console.error("Supabase SDK არ არის ნაპოვნი!");
}

const currentUser = localStorage.getItem('mafia_user') || "";
if (!currentUser || currentUser === "null") {
    window.location.href = "index.html";
}

const OWNER = "Abu007";
let currentRoom = null;
let messagesChannel = null;
let users = [];
let blockedUsers = JSON.parse(localStorage.getItem('mafia_blocked') || '[]');

const ROOMS = [
    "☕ კაფე-ბარი", "🎲 ნარდი", "🃏 ჯოკერი", "💎 VIP", "📝 ფორუმი",
    "🛠️ ადმინები", "😂 იუმორი", "🏆 შიფროგრამა", "🎭 გამოძიება",
    "🎵 მუსიკა", "⁉️ ვიქტორინა", "🆘 დახმარება"
];

// ========== დამხმარე ფუნქციები ==========
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

// ========== ინიციალიზაცია (შესწორებული) ==========
async function initData() {
    // 1. ჯერ ვხატავთ ოთახებს, რომ ეკრანი არ იყოს ცარიელი
    renderRooms();

    try {
        if (!db) return;

        // 2. ვცდილობთ პროფილების წამოღებას
        const { data: profilesData, error } = await db.from('profiles').select('*');
        
        if (!error && profilesData) {
            users = profilesData.map(p => ({
                username: p.username,
                status: p.status || "ონლაინ",
                avatar: p.avatar || null,
                role: p.username === OWNER ? 'owner' : (p.role === 'Admin' || p.role === 'admin' ? 'admin' : 'user'),
                online: false
            }));
        }

        let me = users.find(u => u.username === currentUser);
        if (!me) {
            me = { username: currentUser, status: "ახალი მოთამაშე", avatar: null, role: 'user', online: true };
            users.push(me);
        } else {
            me.online = true;
        }

        saveLocal();
        
        const profileNameEl = document.getElementById('profileName');
        if (profileNameEl) profileNameEl.textContent = currentUser;
        
        const statusInp = document.getElementById('statusInput');
        if (statusInp) statusInp.value = me.status || "";

        if (typeof updateProfileAvatarUI === "function") updateProfileAvatarUI();
        if (typeof listenToFriendRequests === "function") listenToFriendRequests();

    } catch (err) {
        console.warn("მონაცემების სრული ჩატვირთვა ვერ მოხერხდა:", err.message);
    }
}

// ========== ოთახების მართვა (გასწორებული ვიზუალით) ==========
function renderRooms() {
    const list = document.getElementById('roomsList');
    if (!list) return;

    // ვასუფთავებთ და ვხატავთ
    list.innerHTML = ROOMS.map(room => `
        <div class="room-card" onclick="openRoom('${room}')">
            ${room}
        </div>
    `).join('');
}

async function openRoom(roomName) {
    if (currentRoom === roomName) return;

    if (messagesChannel) {
        await db.removeChannel(messagesChannel);
        messagesChannel = null;
    }

    currentRoom = roomName;
    const chatTitle = document.getElementById('chatTitle');
    if (chatTitle) chatTitle.textContent = roomName;

    // მობილურზე ეკრანების გადართვა
    const roomsScr = document.getElementById('roomsScreen');
    const chatScr = document.getElementById('chatScreen');
    
    if (roomsScr) roomsScr.style.display = 'none';
    if (chatScr) chatScr.style.display = 'flex';

    // მესიჯების ჩატვირთვა (თუ ეს ფუნქციები გაწერილი გაქვს)
    if (typeof renderRoomMessages === "function") await renderRoomMessages(roomName);
    listenToRoom(roomName);
}

function listenToRoom(roomName) {
    if (!db) return;
    messagesChannel = db.channel(`room-${roomName}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages', 
            filter: `room=eq.${roomName}` 
        }, payload => {
            if (currentRoom === roomName && typeof appendMessage === "function") {
                appendMessage(payload.new);
            }
        })
        .subscribe();
}

// ========== ეფექტები ==========
function startHearts() {
    const container = document.getElementById('hearts');
    if (!container) return;

    setInterval(() => {
        let h = document.createElement('div');
        h.className = 'heart';
        h.innerHTML = '❤️';
        h.style.left = Math.random() * 100 + '%';
        container.appendChild(h);
        setTimeout(() => h.remove(), 5000);
    }, 4000);
}

// ========== გაშვება ==========
window.addEventListener('DOMContentLoaded', () => {
    initData();
    startHearts();
});
