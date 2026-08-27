document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. Persistent Theme Handling
    // ==========================================
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

    // ==========================================
    // 2. Intro Sequence & FADE-IN FIX
    // ==========================================
    const introContainer = document.getElementById('intro-container');
    const introLogo = document.getElementById('intro-logo');
    const mainUI = document.getElementById('main-ui');
    const sidebarsWrapper = document.getElementById('sidebar-ui');
    
    // Initialize the startup sound
    const startupAudio = new Audio("/static/audio/startup.mp3");

    setTimeout(() => {
        introLogo.classList.add('dropped');
        setTimeout(() => {
            introLogo.classList.add('fade-out');
            setTimeout(() => {
                introContainer.style.opacity = '0';
                
                // Trigger the main tab unroll
                mainUI.classList.add('unrolled'); 
                
                // 👉 PLAY STARTUP SOUND HERE
                if (isSfxEnabled) {
                    startupAudio.play().catch(e => {
                        console.log("Startup sound blocked by browser autoplay policy.");
                    });
                }
                
                // Slide sidebars in
                setTimeout(() => { sidebarsWrapper.classList.add('revealed'); }, 300);
                setTimeout(() => introContainer.style.display = 'none', 800);

                // Force items to fade in AFTER unroll completes
                setTimeout(() => {
                    const items = document.querySelectorAll('.scroll-reveal');
                    items.forEach((el, index) => {
                        setTimeout(() => el.classList.add('visible'), index * 75);
                    });
                }, 1000); 

            }, 400);
        }, 1200);
    }, 100);

    // ==========================================
    // 3. Warp effect -> NEW TAB
    // ==========================================
    
    const triggerWarp = (e, url) => {
        e.preventDefault();
        
        // ADD THIS LINE:
        if (sfxEnabled) sfxAudio.cloneNode(true).play().catch(()=>{});
        
        mainUI.classList.add('warp-active');
        setTimeout(() => {
            window.open(url, '_blank'); 
            mainUI.classList.remove('warp-active'); 
        }, 400);
    };

    // Settings button logic
    document.getElementById('settings-btn').addEventListener('click', (e) => {
        triggerWarp(e, 'https://settings-rfdtq2xvdwq.teamexist.com/#/');
    });

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

// ==========================================
    // 4. Dynamic Music Player & SFX System
    // ==========================================
    const albumBaseURL = "https://teamexist.com/expansions/DWSMusic/albums/MayhemsWorld/";
    const songTitleEl = document.getElementById('song-title');
    const playBtn = document.getElementById('btn-play');
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    const sfxBtn = document.getElementById('btn-sfx');

    const MAX_VOLUME = 0.5; // Drops max volume to 50%
    const FADE_DURATION = 1000; // 1 second fade time

    let currentAudio = new Audio();
    currentAudio.volume = MAX_VOLUME;
    
    // Optional SFX source file
    const sfxAudio = new Audio("/static/audio/click.mp3");

    let songList = [];
    let currentSongIndex = 0;
    let gracePeriodEnded = false; // Tracks if the initial load sequence is done

    // Load persisted user choices
    let isMusicEnabled = localStorage.getItem('dws_music_playing') === 'true';
    let isSfxEnabled = localStorage.getItem('dws_sfx_enabled') === 'true';

    // --- CUSTOM FADE ENGINE ---
    const fadeAudio = (audioEl, targetVol, onComplete) => {
        if (!audioEl) return;
        
        if (audioEl.fadeInterval) clearInterval(audioEl.fadeInterval);
        
        const steps = 20; 
        const intervalTime = FADE_DURATION / steps;
        const stepVol = (targetVol - audioEl.volume) / steps;
        
        const startFading = () => {
            audioEl.fadeInterval = setInterval(() => {
                let nextVol = audioEl.volume + stepVol;
                
                if (nextVol > 1) nextVol = 1;
                if (nextVol < 0) nextVol = 0;

                if ((stepVol >= 0 && nextVol >= targetVol) || (stepVol <= 0 && nextVol <= targetVol)) {
                    audioEl.volume = targetVol;
                    clearInterval(audioEl.fadeInterval);
                    
                    if (targetVol === 0) audioEl.pause();
                    if (onComplete) onComplete();
                } else {
                    audioEl.volume = nextVol;
                }
            }, intervalTime);
        };

        // If fading up from 0, play FIRST, then fade
        if (targetVol > 0 && audioEl.paused) {
            audioEl.play().then(startFading).catch(e => {
                console.warn("🚨 Browser blocked autoplay. Waiting for user interaction...");
            });
        } else {
            startFading();
        }
    };

    const updateSfxUI = () => {
        if (!sfxBtn) return;
        if (isSfxEnabled) {
            sfxBtn.classList.remove('sfx-off');
        } else {
            sfxBtn.classList.add('sfx-off');
        }
    };

    const formatSongTitle = (filename) => {
        return decodeURIComponent(filename)
            .replace(/\.mp3$/i, '')
            .replace(/[-_]/g, ' ');
    };

    // Load Track with Crossfade Support
    const loadTrack = (index, crossfade = false) => {
        if (songList.length === 0) return;
        
        currentSongIndex = (index + songList.length) % songList.length;
        const songFilename = songList[currentSongIndex];
        const trackUrl = albumBaseURL + songFilename.split(' ').join('%20');
        
        if (songTitleEl) {
            songTitleEl.innerText = formatSongTitle(songFilename);
        }

        const oldAudio = currentAudio;
        currentAudio = new Audio(trackUrl);
        currentAudio.volume = (crossfade && isMusicEnabled) ? 0 : (isMusicEnabled ? MAX_VOLUME : 0);
        
        currentAudio.onerror = () => {
            console.error("🚨 Audio Error: Could not load", trackUrl);
            if (songTitleEl) songTitleEl.innerText = "Error Loading Track";
        };

        currentAudio.addEventListener('ended', () => {
            loadTrack(currentSongIndex + 1, true);
        });

        if (isMusicEnabled) {
            if (crossfade) {
                fadeAudio(oldAudio, 0, () => {
                    oldAudio.onerror = null; 
                    oldAudio.removeAttribute('src'); 
                    oldAudio.load(); 
                });
                fadeAudio(currentAudio, MAX_VOLUME);
            } else {
                if (oldAudio) {
                    oldAudio.onerror = null;
                    oldAudio.pause();
                    oldAudio.removeAttribute('src');
                    oldAudio.load();
                }
                currentAudio.volume = MAX_VOLUME;
                currentAudio.play().catch(e => console.warn("Playback blocked waiting for interaction."));
            }
        } else {
            if (oldAudio) {
                oldAudio.onerror = null;
                oldAudio.pause();
                oldAudio.removeAttribute('src');
                oldAudio.load();
            }
        }
    };

    const togglePlayback = () => {
        gracePeriodEnded = true; // User interacted
        isMusicEnabled = !isMusicEnabled;
        localStorage.setItem('dws_music_playing', isMusicEnabled);
        
        if (playBtn) playBtn.innerText = isMusicEnabled ? "⏸" : "▶";

        if (isMusicEnabled) {
            fadeAudio(currentAudio, MAX_VOLUME);
        } else {
            fadeAudio(currentAudio, 0);
        }
    };

    const forcePlayTrack = () => {
        gracePeriodEnded = true; // User interacted
        isMusicEnabled = true;
        localStorage.setItem('dws_music_playing', 'true');
        if (playBtn) playBtn.innerText = "⏸";
    };

    // Auto-discover songs dynamically using the GitHub API
    const initMusicEngine = async () => {
        const githubApiUrl = "https://api.github.com/repos/Wardium/Dylan-Ward-Studios-Website/contents/expansions/DWSMusic/albums/MayhemsWorld";

        try {
            const res = await fetch(githubApiUrl);
            if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
            
            const data = await res.json();

            songList = data
                .filter(file => file.name.toLowerCase().endsWith('.mp3'))
                .map(file => file.name);

            if (songList.length > 0) {
                currentSongIndex = Math.floor(Math.random() * songList.length);
                loadTrack(currentSongIndex, false);

                // 3.5s Grace period
                setTimeout(() => {
                    if (!gracePeriodEnded) {
                        gracePeriodEnded = true;
                        if (isMusicEnabled) {
                            currentAudio.volume = 0; 
                            fadeAudio(currentAudio, MAX_VOLUME);
                        }
                    }
                }, 3500);
            } else {
                if (songTitleEl) songTitleEl.innerText = "No Tracks Found";
            }
        } catch (err) {
            console.error("🚨 Error auto-discovering tracks via GitHub API:", err);
            if (songTitleEl) songTitleEl.innerText = "Mayhem's World";
        }
    };

    // Attach Player Event Handlers
    if (playBtn) {
        playBtn.innerText = isMusicEnabled ? "⏸" : "▶";
        playBtn.addEventListener('click', togglePlayback);
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            forcePlayTrack();
            loadTrack(currentSongIndex + 1, true); 
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            forcePlayTrack();
            loadTrack(currentSongIndex - 1, true); 
        });
    }

    if (sfxBtn) {
        updateSfxUI();
        sfxBtn.addEventListener('click', () => {
            isSfxEnabled = !isSfxEnabled;
            localStorage.setItem('dws_sfx_enabled', isSfxEnabled);
            updateSfxUI();
        });
    }

    // Global Click Handler (SFX + Audio Unlock)
    document.addEventListener('click', (e) => {
        // 1. Audio Unlock: If music should be playing but was blocked by browser
        if (typeof gracePeriodEnded !== 'undefined' && gracePeriodEnded && typeof isMusicEnabled !== 'undefined' && isMusicEnabled && currentAudio.paused) {
            currentAudio.volume = 0;
            fadeAudio(currentAudio, MAX_VOLUME);
        }

        // 2. SFX Handler
        if (typeof isSfxEnabled !== 'undefined' && !isSfxEnabled) return;
        
        // Clone the audio so clicks don't cut each other off
        const clickClone = sfxAudio.cloneNode(true);
        clickClone.volume = 0.6;
        clickClone.play().catch(() => {});
    });

    initMusicEngine();

    // ==========================================
    // 5. Build Dynamic UI Charts
    // ==========================================
    Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
    
    const buildGradient = (canvasId, colorTop, colorBottom) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 150);
        grad.addColorStop(0, colorTop);
        grad.addColorStop(1, colorBottom);
        return grad;
    };

    const gradientBlue1 = buildGradient('cpuChart', '#00d2ff', '#3a7bd5'); 
    const gradientBlue2 = buildGradient('ramChart', '#00c6ff', '#0072ff'); 
    const gradientPurple1 = buildGradient('dwosCpuChart', '#b224ef', '#7579ff');
    const gradientPurple2 = buildGradient('dwosRamChart', '#8e2de2', '#4a00e0');

    const defaultDoughnutOptions = {
        responsive: true, maintainAspectRatio: false,
        cutout: '80%', plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 500 }
    };

    new Chart(document.getElementById('uptimeChart').getContext('2d'), {
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

    const createRing = (id, color) => new Chart(document.getElementById(id), {
        type: 'doughnut',
        data: { datasets: [{ data: [0, 100], backgroundColor: [color, 'rgba(255,255,255,0.1)'], borderWidth: 0, borderRadius: 10 }] },
        options: defaultDoughnutOptions
    });

    const cpuChart = createRing('cpuChart', gradientBlue1);
    const ramChart = createRing('ramChart', gradientBlue2);
    const dwosCpuChart = createRing('dwosCpuChart', gradientPurple1);
    const dwosRamChart = createRing('dwosRamChart', gradientPurple2);

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

    // ==========================================
    // 6. Polling Loop
    // ==========================================
    const fetchStats = () => {
        fetch('/api/stats')
            .then(res => res.json())
            .then(data => {
                document.getElementById('clock-display').innerText = data.time;
                document.getElementById('weather-display').innerText = `Prince George, BC: ${data.weather}`;
                document.getElementById('storage-display').innerText = `${data.storage} GB Free`;
                
                document.getElementById('speed-number').innerText = data.mbps;
                document.getElementById('speed-rating').innerText = data.speed_rating;

                cpuChart.data.datasets[0].data = [data.cpu, 100 - data.cpu];
                cpuChart.update();
                ramChart.data.datasets[0].data = [data.ram, 100 - data.ram];
                ramChart.update();

                speedData.push(data.mbps);
                speedData.shift();
                speedChart.update();
                
                document.getElementById('dwos-temp-display').innerText = `Temp: ${data.dwos.temp}`;
                document.getElementById('dwos-storage-display').innerText = data.dwos.storage;
                
                dwosCpuChart.data.datasets[0].data = [data.dwos.cpu, 100 - data.dwos.cpu];
                dwosCpuChart.update();
                dwosRamChart.data.datasets[0].data = [data.dwos.ram, 100 - data.dwos.ram];
                dwosRamChart.update();
            })
            .catch(err => console.error("Stats Error:", err));
    };

    fetchStats();
    setInterval(fetchStats, 3000);
});
