(function() {
    // 1. სტილები - ვიყენებთ !important-ს, რომ ბრაუზერმა ძველი რაღაცები არ აურიოს
    const style = document.createElement('style');
    style.innerHTML = `
        /* კონვერტის მთავარი კონტეინერი */
        #inbox-wrapper {
            position: fixed !important;
            bottom: 20px !important;
            right: 80px !important; /* თვითმფრინავის მარცხნივ */
            width: 50px !important;
            height: 50px !important;
            z-index: 99999 !important;
            cursor: pointer !important;
        }

        /* თავად კონვერტის წრე და მუქი ჩრდილი */
        .inbox-circle {
            width: 100% !important;
            height: 100% !important;
            background: #4a0000 !important;
            border: 2px solid #ff0000 !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-shadow: 0 0 20px rgba(0,0,0,1), inset 0 0 10px rgba(0,0,0,0.5) !important;
            transition: 0.2s !important;
        }

        /* წითელი ციფრი (ბეიჯი) */
        #msg-badge-new {
            position: absolute !important;
            top: -5px !important;
            right: -5px !important;
            background: #ff0000 !important;
            color: white !important;
            font-size: 11px !important;
            font-weight: bold !important;
            width: 20px !important;
            height: 20px !important;
            border-radius: 50% !important;
            display: none; /* თავიდან დამალულია */
            align-items: center !important;
            justify-content: center !important;
            border: 1.5px solid #fff !important;
            box-shadow: 0 2px 5px rgba(0,0,0,0.8) !important;
        }

        /* ონლაინების მენიუს სტილი */
        .sidebar-right { position: fixed; top: 0; right: -280px; width: 280px; height: 100%; background: #050000; transition: 0.3s; z-index: 4000; border-left: 2px solid #4a0000; display: flex; flex-direction: column; }
        .sidebar-right.active { right: 0; }
        .user-list { flex: 1; overflow-y: auto; padding: 10px; }
        .user-item { display: flex; align-items: center; gap: 10px; padding: 8px; color: white; }
        .status-dot { width: 8px; height: 8px; background: #0f0; border-radius: 50%; box-shadow: 0 0 5px #0f0; }
    `;
    document.head.appendChild(style);

    // 2. კონვერტის ღილაკის შექმნა
    const wrapper = document.createElement('div');
    wrapper.id = 'inbox-wrapper';
    wrapper.innerHTML = `
        <div class="inbox-circle">
            <span style="font-size: 22px;">✉️</span>
            <div id="msg-badge-new">0</div>
        </div>
    `;
    wrapper.onclick = () => window.location.href = 'inbox.html';
    document.body.appendChild(wrapper);

    // 3. ონლაინების მენიუს შექმნა
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar-right';
    sidebar.id = 'sidebar-right';
    sidebar.innerHTML = '<div style="padding:15px; border-bottom:1px solid #4a0000; color:#ff0000; text-align:center;">🟢 ონლაინშია</div><div id="online-list" class="user-list"></div>';
    document.body.appendChild(sidebar);

    // 4. ფუნქცია: მესიჯების შემოწმება
    async function updateInboxBadge() {
        if (!window.myNick) return;
        const { count, error } = await _s
            .from('private_messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver', myNick)
            .eq('is_read', false);

        const badge = document.getElementById('msg-badge-new');
        if (!error && count > 0) {
            badge.innerText = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // 5. ფუნქცია: ონლაინების ჩატვირთვა
    window.loadOnlineUsers = async function() {
        const { data: users } = await _s.from('profiles').select('*');
        const list = document.getElementById('online-list');
        if (!list || !users) return;
        list.innerHTML = "";
        const now = new Date();
        users.forEach(u => {
            const lastSeen = new Date(u.last_online);
            if ((now - lastSeen) / 1000 / 60 < 2) {
                list.innerHTML += `<div class="user-item"><div class="status-dot"></div><span>${u.username}</span></div>`;
            }
        });
    };

    // ინტერვალები
    setInterval(updateInboxBadge, 4000);
    setInterval(loadOnlineUsers, 15000);
    setTimeout(() => { updateInboxBadge(); loadOnlineUsers(); }, 1000);
})();
