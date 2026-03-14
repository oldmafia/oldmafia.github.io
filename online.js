(function() {
    // 1. სტილები (ონლაინების, კონვერტის და მუქი ჩრდილის)
    const style = document.createElement('style');
    style.innerHTML = `
        .sidebar-right { position: fixed; top: 0; right: -280px; width: 280px; height: 100%; background: #050000; transition: 0.3s ease; z-index: 4000; border-left: 2px solid #4a0000; display: flex; flex-direction: column; font-family: sans-serif; }
        .sidebar-right.active { right: 0; }
        .user-list { flex: 1; overflow-y: auto; padding: 10px; }
        .role-group-title { color: #555; font-size: 10px; text-transform: uppercase; margin: 15px 0 8px 10px; letter-spacing: 1px; border-bottom: 1px solid #1a0000; }
        .user-item { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; color: white; font-size: 14px; }
        .status-dot-online { width: 9px; height: 9px; background: #0f0; border-radius: 50%; box-shadow: 0 0 8px #0f0; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .menu-btn-right { cursor: pointer; font-size: 24px; color: #ff0000; position: absolute; right: 15px; top: 15px; z-index: 1001; }
        
        /* კონვერტის ნოთიფიკაციის და ჩრდილის სტილი */
        #msg-badge { position: absolute; top: -5px; right: -5px; background: #ff0000; color: white; border-radius: 50%; width: 22px; height: 22px; font-size: 12px; display: none; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.8); }
        .inbox-shadow { box-shadow: 0 10px 20px rgba(0,0,0,0.9), 0 0 15px rgba(255,0,0,0.2) !important; }
    `;
    document.head.appendChild(style);

    // 2. ონლაინების მენიუ
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar-right';
    sidebar.className = 'sidebar-right';
    sidebar.innerHTML = `<div style="padding: 20px; border-bottom: 1px solid #4a0000; text-align: center;"><h3 style="color:#ff0000; margin:0; font-size: 16px;">🟢 ონლაინშია</h3></div><div id="user-list-container" class="user-list"></div>`;
    document.body.appendChild(sidebar);

    async function updateMyPresence() {
        if (typeof myNick !== 'undefined') {
            await _s.from('profiles').update({ last_online: new Date().toISOString() }).eq('username', myNick);
        }
    }

    window.loadOnlineUsers = async function() {
        const { data: users, error } = await _s.from('profiles').select('*');
        if (error) return;
        const container = document.getElementById('user-list-container');
        if (!container) return;
        container.innerHTML = "";
        const now = new Date();
        const roleMap = { 'Owner': '👑 დამფუძნებლები', 'Admin': '🛡️ ადმინისტრაცია', 'Member': '👤 მომხმარებლები' };

        Object.keys(roleMap).forEach(role => {
            const onlineUsers = users.filter(u => {
                const lastSeen = new Date(u.last_online);
                const diff = (now - lastSeen) / 1000 / 60;
                return (u.role || 'Member') === role && diff < 2; 
            });
            if (onlineUsers.length > 0) {
                container.innerHTML += `<div class="role-group-title">${roleMap[role]}</div>`;
                onlineUsers.forEach(u => {
                    container.innerHTML += `<div class="user-item"><div class="status-dot-online"></div><img src="${u.avatar_url || 'https://i.ibb.co/v3m6y6R/avatar.png'}" style="width:30px; height:30px; border-radius:50%; border:1px solid #444;"><span style="color: ${role === 'Owner' ? '#ff0' : (role === 'Admin' ? '#f55' : '#ccc')}">${u.username}</span></div>`;
                });
            }
        });
    };

    // 3. კონვერტის ღილაკი (გამოწეული მარცხნივ + მუქი ჩრდილი)
    const inboxBtn = document.createElement('div');
    inboxBtn.innerHTML = `
        <div class="inbox-shadow" style="position: relative; width: 55px; height: 55px; background: #600000; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ff0000; transition: 0.3s;">
            <span style="font-size: 24px;">✉️</span>
            <div id="msg-badge">0</div>
        </div>
    `;
    // right: 85px გამოწევს მარცხნივ, bottom: 25px დასვამს გაგზავნის ველის გასწვრივ
    inboxBtn.style = "position: fixed; bottom: 25px; right: 85px; cursor: pointer; z-index: 10000;";
    inboxBtn.onclick = () => window.location.href = 'inbox.html';
    document.body.appendChild(inboxBtn);

    // 4. მესიჯების ციფრის განახლება
    async function updateUnreadCount() {
        if (typeof myNick === 'undefined') return;
        const { count, error } = await _s
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', myNick)
            .eq('is_read', false);

        const badge = document.getElementById('msg-badge');
        if (!error && count > 0) {
            badge.innerText = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // ღილაკი 👥
    const topbar = document.querySelector('.topbar');
    if (topbar) {
        const btn = document.createElement('div');
        btn.className = 'menu-btn-right';
        btn.innerHTML = '👥';
        btn.onclick = (e) => { e.stopPropagation(); sidebar.classList.toggle('active'); };
        topbar.appendChild(btn);
    }

    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && sidebar.classList.contains('active')) sidebar.classList.remove('active');
    });

    setInterval(updateMyPresence, 30000);
    setInterval(loadOnlineUsers, 15000);
    setInterval(updateUnreadCount, 4000); // ყოველ 4 წამში შეამოწმებს SMS-ს
    
    setTimeout(() => { updateMyPresence(); loadOnlineUsers(); updateUnreadCount(); }, 1000);
})();
