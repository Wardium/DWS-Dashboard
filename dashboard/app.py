from flask import Flask, render_template, jsonify, request, send_file
import requests
import json
import queue
from urllib.parse import urlparse
import os
import random
import threading
import psutil
import time
from datetime import datetime
from playwright.sync_api import sync_playwright

app = Flask(__name__)

STATIC_DIR = os.path.join(app.root_path, "static")
SCREENSHOTS_DIR = os.path.join(STATIC_DIR, "screenshots")
BACKGROUNDS_DIR = os.path.join(STATIC_DIR, "backgrounds")

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
os.makedirs(BACKGROUNDS_DIR, exist_ok=True)

DEFAULT_SITES = [
    {"name": "YouTube", "url": "https://youtube.com"},
    {"name": "Adobe Express", "url": "https://express.adobe.com"},
    {"name": "Google", "url": "https://google.com"},
    {"name": "GitHub", "url": "https://github.com/Wardium"},
    {"name": "Google Gemini", "url": "https://gemini.google.com"},
    {"name": "Steam", "url": "https://store.steampowered.com"},
    {"name": "The Onion", "url": "https://theonion.com"},
    {"name": "SignalMidi", "url": "https://signalmidi.app"},
    {"name": "Coolors", "url": "https://coolors.co/gradient-maker"}
]

APPLETS = [
    {"name": "Nextcloud", "url": "https://nextcloud.teamexist.com", "full_width": True},
    {"name": "Converter", "url": "https://convert-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "Jellyfin", "url": "https://jellyfin-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "MeTube", "url": "https://metube-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "Minecraft", "url": "https://minecraft-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "PhotoPrism", "url": "https://photoprism-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "PiHole", "url": "https://pihole-rfdtq2xvdwq.teamexist.com/admin/login", "full_width": False},
    {"name": "OctoPrint", "url": "https://octoprint-rfdtq2xvdwq.teamexist.com", "full_width": True},
    {"name": "Stremio", "url": "https://stremio-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "Transfer", "url": "https://transfer-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "WebInfinity", "url": "https://webinfinity.teamexist.com", "full_width": False},
    {"name": "HomePage", "url": "https://teamexist.com", "full_width": False}
]

last_net = psutil.net_io_counters()
last_time = time.time()

# Global dict for background scrappers
dwos_data = {
    "cpu": 0, "ram": 0, "temp": "--°C", "storage": "-- / --"
}

screenshot_queue = queue.Queue()
queued_urls = set() # Keeps track of URLs already waiting in line

def screenshot_worker():
    """Runs continuously in the background, processing one screenshot at a time."""
    while True:
        url, filepath = screenshot_queue.get()
        print(f"[SCREENSHOT] Processing {url}...")
        
        capture_screenshot_bg(url, filepath)
        
        # Remove from tracking set and mark task done
        queued_urls.remove(url)
        screenshot_queue.task_done()
        
        # Let the CPU breathe before launching the next browser
        time.sleep(2)

def scrape_dwos_bg():
    global dwos_data
    while True:
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context()
                page = context.new_page()
                
                print("[DWOS] Connecting to DWOS...")
                page.goto("https://settings-rfdtq2xvdwq.teamexist.com/#/", wait_until="networkidle", timeout=60000)
                
                # Take a screenshot of the initial load to see what the bot sees
                page.screenshot(path=os.path.join(STATIC_DIR, "debug_dwos_load.png"))
                print("[DWOS] Saved debug_dwos_load.png - check this image to see what the bot sees!")
                
                try:
                    page.wait_for_selector("input[type='password']", timeout=10000)
                    print("[DWOS] Login required. Submitting credentials...")
                    
                    user_input = page.locator("input[type='text']").first
                    if user_input.count() > 0:
                        user_input.fill("dylan")
                    else:
                        page.locator("input[name='username']").first.fill("dylan")
                        
                    page.locator("input[type='password']").first.fill("weqr1234")
                    page.locator("input[type='password']").first.press("Enter")
                    page.wait_for_timeout(5000)
                except Exception as login_err:
                    print(f"[DWOS] Login step skipped or failed. (This is normal if already logged in). Details: {login_err}")
                
                print("[DWOS] Waiting for dashboard elements (.overlay .per)...")
                try:
                    page.wait_for_selector(".overlay .per", state="attached", timeout=20000)
                    print("[DWOS] Dashboard loaded successfully! Starting live polling...")
                except Exception as wait_err:
                    print(f"[DWOS] FAILED to find dashboard elements! Taking screenshot...")
                    page.screenshot(path=os.path.join(STATIC_DIR, "debug_dwos_failed_dashboard.png"))
                    raise Exception("Could not find .overlay .per on page.")

                while True:
                    cpu_raw = page.evaluate("() => document.querySelectorAll('.overlay .per')[0]?.innerText || '0'")
                    ram_raw = page.evaluate("() => document.querySelectorAll('.overlay .per')[1]?.innerText || '0'")
                    
                    cpu_clean = cpu_raw.replace('%', '').strip()
                    ram_clean = ram_raw.replace('%', '').strip()
                    
                    temp = page.evaluate(r"""() => {
                        let match = document.body.innerText.match(/(\d+)\s*°C/);
                        return match ? match[1] + '°C' : '--°C';
                    }""")
                    
                    storage = page.evaluate(r"""() => {
                        let text = document.body.innerText;
                        let used = text.match(/Used:\s*([\d\.]+\s*[a-zA-Z]+)/i);
                        let total = text.match(/Total:\s*([\d\.]+\s*[a-zA-Z]+)/i);
                        if (used && total) {
                            return used[1] + ' / ' + total[1];
                        }
                        return '-- / --';
                    }""")
                    
                    # Log the exact raw data we are scraping to the console
                    print(f"[DWOS DATA] CPU: {cpu_clean} | RAM: {ram_clean} | Temp: {temp} | Storage: {storage}")
                    
                    dwos_data["cpu"] = int(cpu_clean) if cpu_clean.isdigit() else 0
                    dwos_data["ram"] = int(ram_clean) if ram_clean.isdigit() else 0
                    dwos_data["temp"] = temp
                    dwos_data["storage"] = storage
                    
                    # Update DWOS data once per minute
                    time.sleep(60)
                    
        except Exception as e:
            print(f"[DWOS ERROR] Connection lost/Error: {e}. Reconnecting in 10s...")
            time.sleep(10)

def capture_screenshot_bg(url, filepath):
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            page.goto(url, wait_until="domcontentloaded", timeout=50000)
            
            # Check if redirected to the TeamExist auth firewall
            if "auth.teamexist.com" in page.url:
                try:
                    print(f"Auth redirect detected for {url}. Bypassing firewall...")
                    # Target the password field, fill it, and hit enter
                    page.locator("input[type='password']").first.fill("weqr1234")
                    page.locator("input[type='password']").first.press("Enter")
                    
                    # Wait for the authentication to complete and the destination site to load
                    page.wait_for_timeout(4000) 
                except Exception as auth_err:
                    print(f"Failed to bypass auth for {url}: {auth_err}")
            
            page.wait_for_timeout(5000) 
            page.screenshot(path=filepath)
            browser.close()
    except Exception as e:
        print(f"Failed to screenshot {url}: {e}")

@app.route('/favicon.ico')
def favicon():
    favicon_path = os.path.join(STATIC_DIR, "favicon.png")
    if os.path.exists(favicon_path):
        return send_file(favicon_path, mimetype='image/png')
    return "", 404

@app.route('/')
def index():
    bgs = [f for f in os.listdir(BACKGROUNDS_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    bg_url = f"/static/backgrounds/{random.choice(bgs)}" if bgs else ""
    return render_template('index.html', default_sites=DEFAULT_SITES, applets=APPLETS, bg_url=bg_url)

@app.route('/api/stats')
def stats():
    global last_net, last_time, dwos_data
    
    cpu = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory().percent
    disk = psutil.disk_usage('/')
    free_gb = round(disk.free / (1024**3), 1)
    
    now_net = psutil.net_io_counters()
    now_time = time.time()
    delta_bytes = (now_net.bytes_sent + now_net.bytes_recv) - (last_net.bytes_sent + last_net.bytes_recv)
    delta_time = now_time - last_time
    mbps = round((delta_bytes * 8) / 1000000 / delta_time, 2) if delta_time > 0 else 0.0
    
    last_net = now_net
    last_time = now_time
    
    speed_rating = "Really Fast! 🚀" if mbps > 200 else "Fast ⚡" if mbps > 50 else "Good 👍" if mbps > 10 else "Slow 🐢" if mbps > 1 else "Really Slow... 🐌"

    weather_desc = "--°C"
    try:
        w_url = "https://api.open-meteo.com/v1/forecast?latitude=53.9171&longitude=-122.7497&current_weather=true"
        w_res = requests.get(w_url, timeout=2).json()
        weather_desc = f"{w_res['current_weather']['temperature']}°C"
    except:
        pass

    return jsonify({
        "time": datetime.now().strftime("%I:%M %p"),
        "weather": weather_desc,
        "cpu": cpu,
        "ram": ram,
        "storage": free_gb,
        "mbps": mbps,
        "speed_rating": speed_rating,
        "dwos": dwos_data
    })

@app.route('/status')
def check_status():
    url = request.args.get('url')
    if not url:
        return jsonify({'online': False})
    try:
        res = requests.get(url, timeout=20)
        return jsonify({'online': res.status_code < 400})
    except:
        return jsonify({'online': False})

@app.route('/screenshot')
def get_screenshot():
    try:
        url = request.args.get('url')
        if not url:
            return "No URL provided", 400
            
        domain = urlparse(url).netloc
        safe_name = domain.replace(".", "_") + ".png"
        filepath = os.path.join(SCREENSHOTS_DIR, safe_name)
        
        # 1. Check if the file exists and how old it is
        needs_update = True
        if os.path.exists(filepath):
            file_age = time.time() - os.path.getmtime(filepath)
            if file_age < 86400:  # 24 hours in seconds
                needs_update = False
                
        # 2. If it needs an update and isn't already queued, add it
        if needs_update and url not in queued_urls:
            queued_urls.add(url)
            screenshot_queue.put((url, filepath))
            print(f"[SCREENSHOT] Added {url} to queue. Queue size: {screenshot_queue.qsize()}")

        # 3. Serve the file if it exists, otherwise serve the fallback logo
        if os.path.exists(filepath):
            return send_file(filepath, mimetype='image/png')
        else:
            fallback = os.path.join(STATIC_DIR, "logo.png")
            if os.path.exists(fallback):
                return send_file(fallback, mimetype='image/png')
            return "", 404
            
    except Exception as e:
        print(f"Screenshot endpoint error: {e}")
        return "Internal Server Error", 500

if __name__ == '__main__':
    threading.Thread(target=scrape_dwos_bg, daemon=True).start()
    app.run(host='0.0.0.0', port=6060, debug=False)
