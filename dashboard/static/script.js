document.addEventListener('DOMContentLoaded', () => {
    // 1. Persistent Theme Handling
    const htmlEl = document.documentElement;
    const themeBtn = document.getElementById('theme-toggle');
    const themeIconPath = themeBtn.querySelector('path');
    
    // SVG Paths for Sun vs Moon
    const sunPath = "M6.995 12c0 2.761 2.246 5.007 5.007 5.007s5.007-2.246 5.007-5.007-2.246-5.007-5.007-5.007S6.995 9.239 6.995 12zM11 19h2v3h-2zm0-17h2v3h-2zm-9 9h3v2H2zm17 0h3v2h-3zM5.637 19.778l-1.414-1.414 2.121-2.121 1.414 1.414zM16.242 6.344l2.122-2.122 1.414 1.414-2.122 2.122zM6.344 7.759L4.223 5.637l1.415-1.414 2.12 2.122zm13.434 10.605l-1.414 1.414-2.122-2.122 1.414-1.414z";
    const moonPath = "M12 21c-4.962 0-9-4.038-9-9s4.038-9 9-9c1.605 0 3.122.42 4.453 1.164a8.956 8.956 0 00-6.289 8.528 8.955 8.955 0 005.803 8.358A8.995 8.995 0 0112 21z";

    const savedTheme = localStorage.getItem('dws_theme') || 'dark';
    htmlEl.setAttribute('data-theme', savedTheme);
    themeIconPath.setAttribute('d', savedTheme === 'dark' ? sunPath : moonPath);

    themeBtn.addEventListener('click', () => {
        const currentTheme = htmlEl.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        htmlEl.setAttribute('data-theme', newTheme);
        localStorage.setItem('dws_theme', newTheme);
        themeIconPath.setAttribute('d', newTheme === 'dark' ? sunPath : moonPath);
    });

    // 2. Intro Sequence (Drop, Fade, Unroll)
    const introContainer = document.getElementById('intro-container');
    const introLogo = document.getElementById('intro-logo');
    const mainUI = document.getElementById('main-ui');

    // 100ms delay to let CSS load, then drop logo
    setTimeout(() => {
        introLogo.classList.add('dropped');
        
        // Hold the logo for 1.2s, then fade it out
        setTimeout(() => {
            introLogo.classList.add('fade-out');
            
            // Fade out the black overlay
            setTimeout(() => {
                introContainer.style.opacity = '0';
                
                // Trigger the UI unroll
                mainUI.classList.add('unrolled');
                
                // Remove overlay from DOM flow so clicks pass through
                setTimeout(() => introContainer.style.display = 'none', 800);
            }, 400);
        }, 1200);
    }, 100);

    // 3. Scroll Reveal Observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));

    // 4. Warp & Back-Button Fix
    const triggerWarp = (e, url) => {
        e.preventDefault();
        mainUI.classList.add('warp-active');
        setTimeout(() => window.location.href = url, 500);
    };

    window.addEventListener('pageshow', (event) => {
        if (event.persisted || performance.getEntriesByType("navigation")[0].type === 'back_forward') {
            mainUI.classList.remove('warp-active');
        }
    });

    document.querySelectorAll('.site-link').forEach(link => {
        link.addEventListener('click', (e) => triggerWarp(e, link.href));
    });

    document.querySelectorAll('.applet-card').forEach(applet => {
        const url = applet.getAttribute('data-url');
        
        // 1. Immediately make it clickable so the warp works no matter what
        applet.onclick = (e) => triggerWarp(e, url);

        // 2. Still check the status just to apply the grayscale effect if it's down
        fetch(`/status?url=${encodeURIComponent(url)}`)
            .then(res => res.json())
            .then(data => {
                if (!data.online) {
                    applet.classList.add('applet-offline');
                    // It stays clickable, just turns grey!
                }
            })
            .catch(err => console.error(err));
    });

    // 5. Aesthetic Graph
    const ctx = document.getElementById('uptimeChart').getContext('2d');
    const dataPoints = Array.from({length: 30}, () => Math.floor(Math.random() * 20) + 80);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 30}, () => ''),
            datasets: [{
                data: dataPoints,
                borderColor: 'rgba(79, 168, 255, 0.8)',
                backgroundColor: 'rgba(79, 168, 255, 0.2)',
                borderWidth: 2, fill: true, tension: 0.5, pointRadius: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, layout: { padding: 0 },
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } }
        }
    });
});
