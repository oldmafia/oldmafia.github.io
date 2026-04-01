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

// ========== ინიციალიზაცია (გასწორებული ლოგიკა) ==========
async function initData() {
    const { data: profilesData } = await db.from('profiles').select('*');
    if (profilesData) {
        // ძველი მონაცემების გასუფთავება დუბლირების თავიდან ასაცილებლად
        users = []; 
        profilesData.forEach(p => {
            users.push({
                username: p.username,
                status: p.status || "ონლაინ",
                avatar: p.avatar || null,
                role: p.username === OWNER ? 'owner' : (p.role === 'Admin' ? 'admin' : 'user'),
                online: false
            });
        });
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
    if (statusInp && me.status) statusInp.value = me.status;
    
    updateProfileAvatarUI();
    listenToFriendRequests();
    renderRooms(); // ოთახების გამოჩენა ჩატვირთვისას
}

// ========== ვიქტორინა (გასწორებული ASYNC შეცდომა) ==========
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
        showQuizResult(); 
        return; 
    }

    let q = quizQuestions[quizIndex];
    let options = q.options;
    if (typeof options === 'string') { 
        try { options = JSON.parse(options); } catch (e) { options = []; } 
    }

    let box = document.createElement('div');
    box.id = 'quizBox';
    box.className = 'quiz-floating-box'; // სტილები CSS-ში გქონდეს
    box.style.cssText = 'position:fixed;bottom:80px;left:10px;right:10px;background:var(--card);border:2px solid var(--accent);border-radius:16px;padding:14px;z-index:3000;';
    
    box.innerHTML = `
        <div style="font-size:12px;opacity:0.6;margin-bottom:6px;">კითხვა ${quizIndex + 1}/${quizQuestions.length} • ქულა: ${quizScore}</div>
        <div style="font-weight:bold;font-size:14px;margin-bottom:10px;">${escapeHtml(q.question)}</div>
        <div id="quizOptions" style="display:flex;flex-direction:column;gap:7px;">
            ${(options || []).map((opt, i) => `
                <button onclick="answerQuiz(${i})" style="background:#2a1a1a;border:1px solid var(--accent);color:var(--text);padding:8px 12px;border-radius:10px;cursor:pointer;text-align:left;font-size:13px;">
                    ${escapeHtml(String(opt))}
                </button>`).join('')}
        </div>
        <button onclick="hideQuiz()" style="margin-top:8px;background:#333;font-size:12px;padding:5px 10px;border:none;color:white;border-radius:5px;">✕ დახურვა</button>`;
    document.body.appendChild(box);
}

// აი აქ იყო მთავარი შეცდომა - დავამატეთ async
async function answerQuiz(sel) {
    let q = quizQuestions[quizIndex];
    let options = q.options;
    if (typeof options === 'string') { try { options = JSON.parse(options); } catch (e) { options = []; } }
    
    let buttons = document.querySelectorAll('#quizOptions button');
    let correct = typeof q.answer === 'number' ? q.answer : (options || []).findIndex(o => o === q.answer);
    
    buttons.forEach((btn, i) => { 
        btn.disabled = true; 
        if (i === correct) btn.style.background = '#2d6a4f'; 
        else if (i === sel && i !== correct) btn.style.background = '#8b0000'; 
    });

    if (sel === correct) { 
        quizScore++; 
        showNotification('✅ სწორია! +1 ქულა'); 
    } else {
        showNotification('❌ არასწორი!');
    }
    
    quizIndex++;
    
    // თუ კითხვები დამთავრდა, ვინახავთ ქულას ბაზაში
    if (quizIndex >= quizQuestions.length) {
        const { error } = await db.from('profiles').update({ points: quizScore }).eq('username', currentUser);
        if (error) console.error("ქულის შენახვა ვერ მოხერხდა", error);
    }
    
    setTimeout(() => { 
        let b = document.getElementById('quizBox'); 
        if (b) b.remove(); 
        showQuizQuestion(); 
    }, 1500);
}

// ========== გულები (უსაფრთხოების შემოწმებით) ==========
const heartsContainer = document.getElementById('hearts');
if (heartsContainer) {
    setInterval(() => {
        let h = document.createElement('div');
        h.className = 'heart';
        h.innerHTML = ['❤️', '💖', '💗', '💘'][Math.floor(Math.random() * 4)];
        h.style.left = Math.random() * 100 + '%';
        h.style.fontSize = (26 + Math.random() * 20) + 'px';
        heartsContainer.appendChild(h);
        setTimeout(() => h.remove(), 5000);
    }, 3500);
}

// ========== ფოტო მოდალის დასასრული (რაც გამოგრჩა) ==========
async function openPhotoModal(photoId, username, photoDataEncoded) {
    let photoData = decodeURIComponent(photoDataEncoded);
    const modalHtml = `
        <div id="photoFullModal" class="modal-overlay" onclick="this.remove()" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:5000;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div class="modal-content" onclick="event.stopPropagation()" style="position:relative;max-width:90%;">
                <img src="${photoData}" style="max-width:100%; max-height:80vh; border-radius:10px; border:2px solid #333;">
                <div style="margin-top:15px; color:white; text-align:center;">
                    <b>ატვირთა:</b> ${escapeHtml(username)}
                </div>
                <div style="display:flex; justify-content:center; gap:10px; margin-top:15px;">
                    <button onclick="setAsProfilePhoto('${photoData}')" style="background:#2d6a4f; padding:8px 15px;">პროფილზე დაყენება</button>
                    <button onclick="document.getElementById('photoFullModal').remove()" style="background:#444; padding:8px 15px;">დახურვა</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ინიციალიზაციის გაშვება
initData();
