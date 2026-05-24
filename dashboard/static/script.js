document.addEventListener('DOMContentLoaded', () => {
    // 1. Persistent Theme Handling
    const htmlEl = document.documentElement;
    const themeBtn = document.getElementById('theme-toggle');
    const themeIconPath = themeBtn.querySelector('path');
    
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

    // 2. Intro Sequence (Drop, Fade, Unroll, Push Sidebar)
    const introContainer = document.getElementById('intro-container');
    const introLogo = document.getElementById('intro-logo');
    const mainUI = document.getElementById('main-ui');
    const sidebarUI = document.getElementById('sidebar-ui');

    setTimeout(() => {
        introLogo.classList.add('dropped');
        setTimeout(() => {
            introLogo.classList.add('fade-out');
            setTimeout(() => {
                introContainer.style.opacity = '0';
                mainUI.classList.add('unrolled'); // Unrolls main container
                
                // Immediately after unrolling, slide sidebar in
                setTimeout(() => {
                    sidebarUI.classList.add('revealed');
                }, 300);

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

    // 4. Warp effect but open in NEW TAB
    const triggerWarp = (e, url) => {
        e.preventDefault();
        mainUI.classList.add('warp-active');
        
        setTimeout(() => {
            window.open(url, '_blank'); // Open in new tab
            mainUI.classList.remove('warp-active'); // Revert effect immediately for returning
        }, 400);
    };

    document.querySelectorAll('.applet-card').forEach(applet => {
        const url = applet.getAttribute('data-url');
        applet.onclick = (e) => triggerWarp(e, url);

        fetch(`/status?url=${encodeURIComponent(url)}`)
            .then(res => res.json())
            .then(data => {
                if (!data.online) applet.classList.add('applet-offline');
            })
            .catch(err => console.error(err));
    });

    // 5. Charts Configuration
    Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
    const defaultDoughnutOptions = {
        responsive: true, maintainAspectRatio: false,
        cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 500 }
    };

    // Uptime Background Aesthetic Graph
    const uptimeCtx = document.getElementById('uptimeChart').getContext('2d');
    new Chart(uptimeCtx, {
        type: 'line',
        data: {
            labels: Array.from({length: 30}, () => ''),
            datasets: [{
                data: Array.from({length: 30}, () => Math.floor(Math.random() * 20) + 80),
                borderColor: 'rgba(79, 168, 255, 0.8)', backgroundColor: 'rgba(79, 168, 255, 0.2)',
                borderWidth: 2, fill: true, tension: 0.5, pointRadius: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, layout: { padding: 0 },
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } }
        }
    });

    // CPU Ring
    const cpuChart = new Chart(document.getElementById('cpuChart'), {
        type: 'doughnut',
        data: { datasets: [{ data: [0, 100], backgroundColor: ['#4FA8FF', 'rgba(255,255,255,0.1)'], borderWidth: 0 }] },
        options: defaultDoughnutOptions
    });

    // RAM Ring
    const ramChart = new Chart(document.getElementById('ramChart'), {
        type: 'doughnut',
        data: { datasets: [{ data: [0, 100], backgroundColor: ['#FF4F81', 'rgba(255,255,255,0.1)'], borderWidth: 0 }] },
        options: defaultDoughnutOptions
    });

    // Speed History Graph (Live Bandwidth)
    const speedData = Array.from({length: 15}, () => 0);
    const speedChart = new Chart(document.getElementById('speedChart'), {
        type: 'line',
        data: {
            labels: Array.from({length: 15}, () => ''),
            datasets: [{
                data: speedData,
                borderColor: '#4FA8FF', backgroundColor: 'rgba(79, 168, 255, 0.2)',
                borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false, min: 0 } },
            animation: { duration: 0 }
        }
    });

    // 6. Data Polling Loop
    const fetchStats = () => {
        fetch('/api/stats')
            .then(res => res.json())
            .then(data => {
                document.getElementById('clock-display').innerText = data.time;
                document.getElementById('weather-display').innerText = `Prince George, BC: ${data.weather}`;
                document.getElementById('storage-display').innerText = `${data.storage} GB Free`;
                
                document.getElementById('speed-number').innerText = data.mbps;
                document.getElementById('speed-rating').innerText = data.speed_rating;

                // Update Rings
                cpuChart.data.datasets[0].data = [data.cpu, 100 - data.cpu];
                cpuChart.update();

                ramChart.data.datasets[0].data = [data.ram, 100 - data.ram];
                ramChart.update();

                // Update Speed Graph array (push new, shift old)
                speedData.push(data.mbps);
                speedData.shift();
                speedChart.update();
            })
            .catch(err => console.error("Stats Error:", err));
    };

    // Run immediately, then every 3 seconds
    fetchStats();
    setInterval(fetchStats, 3000);
});
