// ========== კონფიგურაცია ==========
const SUPABASE_URL = 'https://ftfciebnywbondaiarnc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eQZDSu_Jy1gWmXJFF800Pw_TP2kBRLI';
let db;

const currentUser = localStorage.getItem('mafia_user');
if (!currentUser || currentUser === "null" || currentUser === "") {
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

// ========== ინიციალიზაცია (უსაფრთხო ვერსია) ==========
async function initData() {
    // 1. ვამოწმებთ Supabase-ის არსებობას
    if (typeof supabase === 'undefined') {
        console.log("ველოდებით Supabase-ის ჩატვირთვას...");
        setTimeout(initData, 500); // თუ არ არის, ნახევარ წამში სცადე თავიდან
        return;
    }

    if (!db) db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
        // 2. ჯერ გამოვაჩინოთ ოთახები, რომ მომხმარებელმა შავი ეკრანი არ ნახოს
        renderRooms();

        // 3. შემდეგ ვცადოთ პროფილების წამოღება
        const { data: profilesData, error } = await db.from('profiles').select('*');
        
        if (error) throw error;

        users = (profilesData || []).map(p => ({
            username: p.username,
            status: p.status || "ონლაინ",
            avatar: p.avatar || null,
            role: p.username === OWNER ? 'owner' : (p.role === 'Admin' || p.role === 'admin' ? 'admin' : 'user'),
            online: false
        }));

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
        console.error("ბაზის შეცდომა:", err.message);
        // თუ ბაზა ვერ ჩაიტვირთა, ოთახები უკვე დახატულია renderRooms-ით try-ს დასაწყისში
    }
}

// ========== ოთახების მართვა ==========
function renderRooms() {
    const list = document.getElementById('roomsList');
    if (!list) {
        console.error("ელემენტი 'roomsList' ვერ მოიძებნა HTML-ში!");
        return;
    }

    list.innerHTML = ROOMS.map(room => `
        <div class="room-card" onclick="openRoom('${room}')">
            ${room}
        </div>
    `).join('');
}

// ========== სხვა ფუნქციები (იგივე დატოვე) ==========
async function openRoom(roomName) {
    if (currentRoom === roomName) return;
    if (messagesChannel) {
        await db.removeChannel(messagesChannel);
        messagesChannel = null;
    }
    currentRoom = roomName;
    const chatTitle = document.getElementById('chatTitle');
    if (chatTitle) chatTitle.textContent = roomName;
    
    // აქ დარწმუნდი რომ renderRoomMessages ფუნქცია გაწერილი გაქვს სხვაგან
    if (typeof renderRoomMessages === "function") await renderRoomMessages(roomName);
    listenToRoom(roomName);
    
    const roomsScr = document.getElementById('roomsScreen');
    const chatScr = document.getElementById('chatScreen');
    if (roomsScr) roomsScr.style.display = 'none';
    if (chatScr) chatScr.style.display = 'flex';
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
            if (currentRoom === roomName && typeof appendMessage === "function") appendMessage(payload.new);
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
