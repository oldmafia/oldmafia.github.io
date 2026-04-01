// ========== 1. კონფიგურაცია ==========
const SUPABASE_URL = 'https://ftfciebnywbondaiarnc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eQZDSu_Jy1gWmXJFF800Pw_TP2kBRLI';
let db;

const currentUser = localStorage.getItem('mafia_user');
const OWNER = "Abu007";
const ROOMS = [
    "☕ კაფე-ბარი", "🎲 ნარდი", "🃏 ჯოკერი", "💎 VIP", "📝 ფორუმი",
    "🛠️ ადმინები", "😂 იუმორი", "🏆 შიფროგრამა", "🎭 გამოძიება",
    "🎵 მუსიკა", "⁉️ ვიქტორინა", "🆘 დახმარება"
];

// ========== 2. ფუნქცია, რომელიც ოთახებს ხატავს (დამოუკიდებლად) ==========
function renderRooms() {
    console.log("ოთახების რენდერინგი დაიწყო...");
    const list = document.getElementById('roomsList');
    if (!list) {
        console.error("შეცდომა: HTML-ში ვერ მოიძებნა 'roomsList'!");
        return;
    }

    list.innerHTML = ROOMS.map(room => `
        <div class="room-card" onclick="openRoom('${room}')" style="cursor:pointer; padding:15px; margin:5px; background:#222; border-radius:10px; color:white; text-align:center; border:1px solid #444;">
            ${room}
        </div>
    `).join('');
}

// ========== 3. ინიციალიზაცია ==========
async function initData() {
    // აიძულე ოთახების გამოჩენა მაშინვე
    renderRooms();

    if (typeof supabase === 'undefined') {
        console.error("Supabase SDK არ არის ჩატვირთული HTML-ში!");
        return;
    }

    db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
        const { data: profilesData, error } = await db.from('profiles').select('*');
        if (error) console.warn("პროფილების წაკითხვა ვერ მოხერხდა, მაგრამ ჩატი გაგრძელდება.");
        
        console.log("ბაზასთან კავშირი დამყარდა!");
        
        const profileNameEl = document.getElementById('profileName');
        if (profileNameEl) profileNameEl.textContent = currentUser || "სტუმარი";

    } catch (err) {
        console.error("Initialization Error:", err.message);
    }
}

// ========== 4. ოთახის გახსნა ==========
function openRoom(roomName) {
    console.log("ითსნება ოთახი:", roomName);
    const chatTitle = document.getElementById('chatTitle');
    if (chatTitle) chatTitle.textContent = roomName;

    // ეკრანების გადართვა
    const roomsScr = document.getElementById('roomsScreen');
    const chatScr = document.getElementById('chatScreen');
    
    if (roomsScr) roomsScr.style.display = 'none';
    if (chatScr) chatScr.style.display = 'flex';
}

// ========== 5. გაშვება ==========
document.addEventListener('DOMContentLoaded', initData);
// ყოველი შემთხვევისთვის, თუ DOMContentLoaded-მა დააგვიანა
window.onload = () => { if(!document.getElementById('roomsList')?.innerHTML) initData(); };
