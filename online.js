(function() {
    // 1. ვამატებთ სტილებს
    const style = document.createElement('style');
    style.innerHTML = `
        .sidebar-right { position: fixed; top: 0; right: -280px; width: 280px; height: 100%; background: #050000; transition: 0.3s ease-in-out; z-index: 4000; border-left: 2px solid #4a0000; box-shadow: -5px 0 20px rgba(138, 0, 0, 0.4); display: flex; flex-direction: column; }
        .sidebar-right.active { right: 0; }
        .user-list { flex: 1; overflow-y: auto; padding: 10px; }
        .role-group-title { color: #555; font-size: 10px; text-transform: uppercase; margin: 15px 0 8px 10px; letter-spacing: 1px; border-bottom: 1px solid #1a0000; }
        .user-item { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; cursor: pointer; transition: 0.2s; color: white; font-family: sans-serif; }
        .user-item:hover { background: rgba(255, 0, 0, 0.05); }
        .status-dot { width: 9px; height: 9px; background: #0f0; border-radius: 50%; box-shadow: 0 0 8px #0f0; }
        .menu-btn-right { cursor: pointer; font-size: 24px; color: #ff0000; text-shadow: 0 0 10px rgba(255,0,0,0.7); position: absolute; right: 15px; top: 15px; z-index: 1001; }
    `;
    document.head.appendChild(style);

    // 2. ვქმნით მენიუს სტრუქტურას
    const sidebar = document.createElement('div');
    sidebar.id = 'sidebar-right';
    sidebar.className = 'sidebar-right';
    sidebar.innerHTML = `
        <div style="padding: 20px; border-bottom: 1px solid #4a0000; text-align: center;">
            <h3 style="color:#ff0000; margin:0; font-size: 16px; font-family: sans-serif;">🕵️ მაფიოზები</h3>
        </div>
        <div id="user-list-container" class="user-list"></div>
    `;
    document.body.appendChild(sidebar);

    // 3. ვამატებთ ღილაკს Topbar-ში
    const topbar = document.querySelector('.topbar');
    if (topbar) {
        const btn = document.createElement('div');
        btn.className = 'menu-btn-right';
        btn.innerHTML = '👥';
        btn.onclick = () => {
            sidebar.classList.toggle('active');
            const overlay = document.getElementById('overlay');
            if(overlay) overlay.classList.toggle('active');
        };
        topbar.appendChild(btn);
    }

    // 4. იუზერების ჩატვირთვის ფუნქცია
    window.loadOnlineUsers = async function() {
        const { data: users, error } = await _s.from('profiles').select('*');
        if (error) return;
        const container = document.getElementById('user-list-container');
        container.innerHTML = "";
        const roleMap = { 'Owner': '👑 დამფუძნებლები', 'Admin': '🛡️ ადმინისტრაცია', 'Member': '👤 წევრები' };
        Object.keys(roleMap).forEach(role => {
            const filtered = users.filter(u => (u.role || 'Member') === role);
            if (filtered.length > 0) {
                container.innerHTML += `<div class="role-group-title">${roleMap[role]}</div>`;
                filtered.forEach(u => {
                    container.innerHTML += `
                        <div class="user-item" onclick="openProfile('${u.username}')">
                            <div class="status-dot"></div>
                            <img src="${u.avatar_url || 'https://i.ibb.co/v3m6y6R/avatar.png'}" style="width:32px; height:32px; border-radius:50%; border:1px solid #4a0000;">
                            <span style="color: ${role === 'Owner' ? '#ff0' : (role === 'Admin' ? '#f55' : '#ccc')}; font-size: 14px;">${u.username}</span>
                        </div>`;
                });
            }
        });
    };

    setInterval(loadOnlineUsers, 20000);
    setTimeout(loadOnlineUsers, 2000);
})();
