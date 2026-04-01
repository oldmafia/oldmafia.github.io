// ========== კონფიგურაცია და ცვლადები ==========
const SUPABASE_URL = 'https://ftfciebnywbondaiarnc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eQZDSu_Jy1gWmXJFF800Pw_TP2kBRLI';
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

// ========== ინიციალიზაცია (მთავარი ფუნქცია) ==========
async function initData() {
    try {
        const { data: profilesData, error } = await db.from('profiles').select('*');
        if (error) throw error;

        // მომხმარებლების სიის სუფთად აწყობა
        users = profilesData.map(p => ({
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
        
        // UI ელემენტების განახლება
        const profileNameEl = document.getElementById('profileName');
        if (profileNameEl) profileNameEl.textContent = currentUser;
        
        const statusInp = document.getElementById('statusInput');
        if (statusInp) statusInp.value = me.status || "";

        renderRooms();
        if (typeof updateProfileAvatarUI === "function") updateProfileAvatarUI();
        if (typeof listenToFriendRequests === "function") listenToFriendRequests();

    } catch (err) {
        console.error("კრიტიკული შეცდომა ჩატვირთვისას:", err.message);
        showNotification("მონაცემების ჩატვირთვა ვერ მოხერხდა");
    }
}

// ========== ოთახების მართვა ==========
function renderRooms() {
    const list = document.getElementById('roomsList');
    if (!list) return;

    list.innerHTML = ROOMS.map(room => `
        <div class="room-card" onclick="openRoom('${room}')">
            ${room}
        </div>
    `).join('');
}

async function openRoom(roomName) {
    if (currentRoom === roomName) return;

    // ძველი არხის დახურვა (რომ არ გაჭედოს)
    if (messagesChannel) {
        await db.removeChannel(messagesChannel);
        messagesChannel = null;
    }

    currentRoom = roomName;
    const chatTitle = document.getElementById('chatTitle');
    if (chatTitle) chatTitle.textContent = roomName;

    // მესიჯების ჩატვირთვა და მოსმენა
    await renderRoomMessages(roomName);
    listenToRoom(roomName);
    
    // ჩატის ფანჯრის ჩვენება (თუ მობილურზეა)
    document.getElementById('roomsScreen').style.display = 'none';
    document.getElementById('chatScreen').style.display = 'flex';
}

function listenToRoom(roomName) {
    messagesChannel = db.channel(`room-${roomName}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages', 
            filter: `room=eq.${roomName}` 
        }, payload => {
            if (currentRoom === roomName) appendMessage(payload.new);
        })
        .subscribe();
}

// ========== ვიქტორინის ლოგიკა ==========
let quizQuestions = [], quizIndex = 0, quizScore = 0;

async function startQuiz() {
    const { data, error } = await db.from('quiz_questions').select('*');
    if (error || !data || data.length === 0) {
        showNotification('კითხვები ვერ მოიძებნა!');
        return;
    }
    quizQuestions = data.sort(() => Math.random() - 0.5);
    quizIndex = 0;
    quizScore = 0;
    showQuizQuestion();
}

function showQuizQuestion() {
    let ex = document.getElementById('quizBox');
    if (ex) ex.remove();

    if (quizIndex >= quizQuestions.length) {
        showNotification(`ვიქტორინა დასრულდა! ქულა: ${quizScore}`);
        return;
    }

    let q = quizQuestions[quizIndex];
    let options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;

    let box = document.createElement('div');
    box.id = 'quizBox';
    box.style.cssText = 'position:fixed; bottom:80px; left:10px; right:10px; background:#1a1a1a; border:2px solid orange; border-radius:15px; padding:15px; z-index:3000; color:white;';
    
    box.innerHTML = `
        <div style="font-size:12px; margin-bottom:5px;">კითხვა ${quizIndex + 1}/${quizQuestions.length}</div>
        <div style="font-weight:bold; margin-bottom:10px;">${escapeHtml(q.question)}</div>
        <div id="quizOptions" style="display:flex; flex-direction:column; gap:8px;">
            ${(options || []).map((opt, i) => `
                <button onclick="answerQuiz(${i})" style="background:#333; color:white; border:1px solid #444; padding:10px; border-radius:8px; text-align:left;">
                    ${escapeHtml(String(opt))}
                </button>
            `).join('')}
        </div>
    `;
    document.body.appendChild(box);
}

async function answerQuiz(sel) {
    // სპამისგან დაცვა
    const buttons = document.querySelectorAll('#quizOptions button');
    if (buttons[0].disabled) return;

    let q = quizQuestions[quizIndex];
    let options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
    let correct = typeof q.answer === 'number' ? q.answer : options.indexOf(q.answer);

    buttons.forEach((btn, i) => {
        btn.disabled = true;
        if (i === correct) btn.style.background = '#2d6a4f';
        else if (i === sel) btn.style.background = '#8b0000';
    });

    if (sel === correct) quizScore++;

    quizIndex++;
    
    if (quizIndex >= quizQuestions.length) {
        await db.from('profiles').update({ points: quizScore }).eq('username', currentUser);
    }

    setTimeout(() => {
        let b = document.getElementById('quizBox');
        if (b) b.remove();
        showQuizQuestion();
    }, 1500);
}

// ========== ეფექტები ==========
function startHearts() {
    const container = document.getElementById('hearts');
    if (!container) return;

    setInterval(() => {
        if (!document.getElementById('hearts')) return;
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
