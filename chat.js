// ========== კონფიგურაცია და ცვლადები ==========
const SUPABASE_URL = 'https://ftfciebnywbondaiarnc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eQZDSu_Jy1gWmXJFF800Pw_TP2kBRLI';

// დავამატოთ შემოწმება, რომ supabase ობიექტი არსებობს
if (typeof supabase === 'undefined') {
    console.error("Supabase library არ არის ჩატვირთული!");
}
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

// ========== დამხმარე ფუნქციები (უცვლელია) ==========
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

// ========== ინიციალიზაცია (გასწორებული) ==========
async function initData() {
    try {
        // მონაცემების წამოღება
        const { data: profilesData, error } = await db.from('profiles').select('*');
        
        // თუ შეცდომაა, მაინც გავაგრძელოთ, რომ ოთახები გამოჩნდეს
        if (error) {
            console.warn("Profiles ვერ ჩაიტვირთა:", error.message);
        }

        // მომხმარებლების სიის აწყობა (უსაფრთხო map)
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

        // ამას გამოვიტანთ try-ს ბოლოში, რომ არაფერმა დააბლოკოს
        renderRooms();
        
        if (typeof updateProfileAvatarUI === "function") updateProfileAvatarUI();
        if (typeof listenToFriendRequests === "function") listenToFriendRequests();

    } catch (err) {
        console.error("კრიტიკული შეცდომა:", err.message);
        // თუ ბაზამ საერთოდ გაჭედა, ოთახები მაინც დავარენდეროთ მასივიდან
        renderRooms();
        showNotification("კავშირის ხარვეზი");
    }
}

// ========== ოთახების მართვა (უცვლელია) ==========
function renderRooms() {
    const list = document.getElementById('roomsList');
    if (!list) return;

    list.innerHTML = ROOMS.map(room => `
        <div class="room-card" onclick="openRoom('${room}')">
            ${room}
        </div>
    `).join('');
}

// დანარჩენი ფუნქციები (openRoom, listenToRoom, Quiz და Hearts) დატოვე როგორც გაქვს...
