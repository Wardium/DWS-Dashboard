from flask import Flask, render_template, jsonify, request, send_file
import requests
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

# Store Scraped DWOS Data
dwos_data = {
    "cpu": 0, "ram": 0, "temp": "--°C", "storage": "Loading..."
}

def scrape_dwos_bg():
    """Runs infinitely in the background scraping DWOS, handling logins."""
    global dwos_data
    while True:
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                page = context.new_page()
                
                # Navigate to the dashboard
                page.goto("https://settings-rfdtq2xvdwq.teamexist.com/#/", wait_until="load", timeout=60000)
                
                # Give Vue.js a second to draw the interface (whether it's the login screen or dashboard)
                page.wait_for_timeout(3000)
                
                # --- NEW LOGIN LOGIC ---
                # Check if there is a password input on the screen
                password_input = page.locator("input[type='password']")
                if password_input.count() > 0:
                    print("DWOS Login screen detected. Attempting to log in...")
                    
                    # Target the username field (usually the first text-based input on the login form)
                    username_input = page.locator("input[type='text'], input[name='username'], input[placeholder*='sername']").first
                    if username_input.count() > 0:
                        username_input.fill("dylan")
                    
                    # Target the password field
                    password_input.first.fill("weqr1234")
                    
                    # Press enter on the password field to submit the form
                    password_input.first.press("Enter")
                    
                    # Wait for the login redirect and the actual dashboard to load
                    page.wait_for_timeout(5000)
                # -----------------------
                
                # Now wait for the actual dashboard stat elements
                page.wait_for_selector(".overlay .per", state="attached", timeout=15000)
                
                # Extract CPU & RAM
                cpu = page.evaluate("() => document.querySelectorAll('.overlay .per')[0]?.innerText || '0'")
                ram = page.evaluate("() => document.querySelectorAll('.overlay .per')[1]?.innerText || '0'")
                
                # Extract Temp
                temp = page.evaluate("() => document.querySelector('.bar-content.is-clickable')?.innerText || '--°C'")
                
                # Extract Storage
                storage = page.evaluate("""() => {
                    let diskNodes = document.querySelectorAll('.disk-info');
                    if(diskNodes.length > 0) {
                        return diskNodes[0].innerText.replace(/\\n/g, ' / ');
                    }
                    return 'Unknown';
                }""")
                
                # Update global dictionary
                dwos_data["cpu"] = int(cpu)
                dwos_data["ram"] = int(ram)
                dwos_data["temp"] = temp
                dwos_data["storage"] = storage
                
                print(f"DWOS Scrape Successful: CPU {cpu}%, RAM {ram}%")
                browser.close()
                
        except Exception as e:
            print(f"DWOS Scrape Failed: {e}")
            try:
                page.screenshot(path="debug_scraper.png")
                print("Saved debug screenshot to debug_scraper.png so you can see what went wrong.")
                browser.close()
            except:
                pass
            
        time.sleep(30) # Scrape every 30 seconds

def capture_screenshot_bg(url, filepath):
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            page.goto(url, wait_until="domcontentloaded", timeout=50000)
            page.wait_for_timeout(5000) 
            page.screenshot(path=filepath)
            browser.close()
            print(f"Successfully snapped: {url}")
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
    bgs = [f for f in os.listdir(BACKGROUNDS_DIR) if f.endswith('.jpg')]
    bg_image = random.choice(bgs) if bgs else None
    return render_template('index.html', default_sites=DEFAULT_SITES, applets=APPLETS, bg_image=bg_image)

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
        
        threading.Thread(target=capture_screenshot_bg, args=(url, filepath)).start()

        if os.path.exists(filepath):
            return send_file(filepath, mimetype='image/png')
        else:
            fallback = os.path.join(STATIC_DIR, "logo.png")
            if os.path.exists(fallback):
                return send_file(fallback, mimetype='image/png')
            return "", 404
    except Exception as e:
        print(f"Error in /screenshot route: {e}")
        return "Internal Server Error", 500

if __name__ == '__main__':
    threading.Thread(target=scrape_dwos_bg, daemon=True).start()
    app.run(host='0.0.0.0', port=6060, debug=False)
