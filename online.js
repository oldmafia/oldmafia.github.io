(function() {
    console.log("Online.js დაიტვირთა!"); // შემოწმება კონსოლში

    // 1. სტილების დამატება
    const style = document.createElement('style');
    style.innerHTML = `
        #inbox-wrapper { 
            position: fixed !important; 
            bottom: 25px !important; 
            right: 85px !important; 
            width: 55px !important; 
            height: 55px !important; 
            z-index: 999999 !important; 
            cursor: pointer !important;
            display: block !important;
        }
        .inbox-circle { 
            width: 100%; 
            height: 100%; 
            background: #4a0000; 
            border: 2px solid #ff0000; 
            border-radius: 50%; 
            display: flex !important; 
            align-items: center; 
            justify-content: center; 
            box-shadow: 0 0 15px rgba(255,0,0,0.5);
            transition: 0.3s;
        }
        .inbox-circle:hover { transform: scale(1.1); background: #600; }
        @media screen and (max-width: 600px) {
            #inbox-wrapper { bottom: 100px !important; right: 20px !important; }
        }
    `;
    document.head.appendChild(style);

    // 2. ელემენტის შექმნა
    const wrapper = document.createElement('div');
    wrapper.id = 'inbox-wrapper';
    wrapper.innerHTML = '<div class="inbox-circle"><span style="font-size:24px;">✉️</span></div>';
    
    // 3. დაწკაპუნების ფუნქცია
    wrapper.onclick = function() {
        window.location.href = 'inbox.html';
    };

    // 4. ჩამატება გვერდზე
    document.body.appendChild(wrapper);
})();
