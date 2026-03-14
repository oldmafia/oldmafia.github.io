(function() {
    // 1. სტილები - იძულებითი განახლებისთვის დავამატე !important
    const style = document.createElement('style');
    style.innerHTML = `
        .sidebar-right { position: fixed; top: 0; right: -280px; width: 280px; height: 100%; background: #050000; transition: 0.3s ease; z-index: 4000; border-left: 2px solid #4a0000; display: flex; flex-direction: column; font-family: sans-serif; }
        .sidebar-right.active { right: 0; }
        .user-list { flex: 1; overflow-y: auto; padding: 10px; }
        .role-group-title { color: #555; font-size: 10px; text-transform: uppercase; margin: 15px 0 8px 10px; letter-spacing: 1px; border-bottom: 1px solid #1a0000; }
        .user-item { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; color: white; font-size: 14px; }
        .status-dot-online { width: 9px; height: 9px; background: #0f0; border-radius: 50%; box-shadow: 0 0 8px #0f0; animation: pulse 2s infinite; }
        
        /* კონვერტის ახალი პოზიცია და მუქი ჩრდილი */
        #fixed-inbox-btn { 
            position: fixed !important; 
            bottom: 25px !important; 
            right: 85px !important; /* გამოწეული მარცხნივ */
            width: 55px !important; 
            height: 55px !important; 
            background: #600000 !important; 
            border-radius: 50% !important; 
            display: flex !important; 
            align-items: center !important; 
            justify-content: center !important; 
            border: 2px solid #ff0000 !important; 
            box-shadow: 0 10px 30px rgba(0,0,0,1) !important; /* მუქი ჩრდილი */
            cursor: pointer !important; 
            z-index: 10000 !important; 
            text-decoration: none !important;
        }

        /* წითელი ციფრი */
        #msg-count-node { 
            position: absolute !important; 
            top: -5px !important; 
            right: -5px !important; 
            background: #ff0000 !important; 
            color: white !important; 
            border-radius: 50% !important; 
            width: 22px !important; 
            height: 22px !important; 
            font-size: 12px !important; 
            display: none; 
            align-items: center !important; 
            justify-content: center !important; 
            font-weight: bold !important; 
            border: 2px solid white !important; 
            box-shadow: 0 0 10px rgba(0,0,0,0.8) !important; 
        }
    `;
    document.head.appendChild(style);

    // 2. კონვერტის შექმნა
    const inboxBtn = document.createElement('div');
    inboxBtn.id = 'fixed-inbox-btn';
    inboxBtn.innerHTML = `<span style="font-size: 24px;">✉️</span><div id="msg-count-node">0</div>`;
    inboxBtn.onclick = () => window.location.href = 'inbox.html';
    document.body.appendChild(inboxBtn);

    // 3. ონლაინების მენიუ
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar-right';
    sidebar.className = 'sidebar-right';
    sidebar.innerHTML = `<div style="padding: 20px; border-bottom: 1px solid #4a0000; text-align: center;"><h3 style="color:#ff0000; margin:0; font-size: 16px;">🟢 ონლაინშია</h3></div><div id="user-list-container" class="user-list"></div>`;
    document.body.appendChild(sidebar);

    // 4. ფუნქციები
    async function updateMyPresence() {
        if (typeof myNick !== 'undefined' && myNick) {
            await _s.from('profiles').update({ last_online: new Date().toISOString() }).eq('username', myNick);
        }
    }

    async function checkNewMessages() {
        if (typeof myNick === 'undefined' || !myNick) return;
        const { count, error } = await _s
            .from('private_messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver', myNick)
            .eq('is_read', false);

        const badge = document.getElementById('msg-count-node');
        if (!error && count > 0) {
            badge.innerText = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // ონლაინების ჩატვირთვა
    window.loadOnlineUsers = async function() {
        const { data: users } = await _s.from('profiles').select('*');
        const container = document.getElementById('user-list-container');
        if (!container || !users) return;
        container.innerHTML = "";
        const now = new Date();
        const roleMap = { 'Owner': '👑 დამფუძნებლები', 'Admin': '🛡️ ადმინისტრაცია', 'Member': '👤 მომხმარებლები' };

        Object.keys(roleMap).forEach(role => {
            const onlineUsers = users.filter(u => {
                const lastSeen = new Date(u.last_online);
                return (u.role || 'Member') === role && (now - lastSeen) / 1000 / 60 < 2;
            });
            if (onlineUsers.length > 0) {
                container.innerHTML += `<div class="role-group-title">${roleMap[role]}</div>`;
                onlineUsers.forEach(u => {
                    container.innerHTML += `<div class="user-item"><div class="status-dot-online"></div><img src="${u.avatar_url || 'https://i.ibb.co/v3m6y6R/avatar.png'}" style="width:30px; height:30px; border-radius:50%; border:1px solid #444;"><span>${u.username}</span></div>`;
                });
            }
        });
    };

    // 👥 ღილაკი
    const topbar = document.querySelector('.topbar');
    if (topbar) {
        const btn = document.createElement('div');
        btn.className = 'menu-btn-right';
        btn.innerHTML = '👥';
        btn.onclick = (e) => { e.stopPropagation(); sidebar.classList.toggle('active'); };
        topbar.appendChild(btn);
    }

    setInterval(updateMyPresence, 30000);
    setInterval(loadOnlineUsers, 15000);
    setInterval(checkNewMessages, 4000);
    
    setTimeout(() => { updateMyPresence(); loadOnlineUsers(); checkNewMessages(); }, 1000);
})();
