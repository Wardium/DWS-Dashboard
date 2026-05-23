from flask import Flask, render_template, jsonify, request, send_file
import requests
from urllib.parse import urlparse
import os
import random
import threading
from playwright.sync_api import sync_playwright

app = Flask(__name__)

# Build absolute paths based on where app.py is located
STATIC_DIR = os.path.join(app.root_path, "static")
SCREENSHOTS_DIR = os.path.join(STATIC_DIR, "screenshots")
BACKGROUNDS_DIR = os.path.join(STATIC_DIR, "backgrounds")

# Ensure directories exist upon startup
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
    {"name": "Coolors", "url": "https://coolors.co/gradient-maker/"}
]

APPLETS = [
    {"name": "Nextcloud", "url": "https://nextcloud.teamexist.com", "full_width": True},
    {"name": "Converter", "url": "https://convert-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "Jellyfin", "url": "https://jellyfin-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "MeTube", "url": "https://metube-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "Minecraft", "url": "https://minecraft-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "PhotoPrism", "url": "https://photoprism-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "PiHole", "url": "https://pihole-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "OctoPrint", "url": "https://octoprint-rfdtq2xvdwq.teamexist.com", "full_width": True},
    {"name": "Stremio", "url": "https://stremio-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "Transfer", "url": "https://transfer-rfdtq2xvdwq.teamexist.com", "full_width": False},
    {"name": "WebInfinity", "url": "https://webinfinity.teamexist.com", "full_width": False},
    {"name": "HomePage", "url": "https://teamexist.com", "full_width": False}
]

def capture_screenshot_bg(url, filepath):
    """Runs in the background to silently update the screenshot."""
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            
            # Wait until network traffic stops, with a longer 20s timeout
            page.goto(url, wait_until="networkidle", timeout=50000)
            
            # Force Playwright to wait exactly 5000 milliseconds (5 seconds)
            page.wait_for_timeout(5000) 
            
            page.screenshot(path=filepath)
            browser.close()
            print(f"Successfully snapped: {url}")
    except Exception as e:
        print(f"Failed to screenshot {url}: {e}")

@app.route('/favicon.ico')
def favicon():
    # Force the browser to use your favicon.png from the static folder
    favicon_path = os.path.join(STATIC_DIR, "favicon.png")
    if os.path.exists(favicon_path):
        return send_file(favicon_path, mimetype='image/png')
    return "", 404

@app.route('/')
def index():
    # Pick a random background from static/backgrounds safely
    bgs = [f for f in os.listdir(BACKGROUNDS_DIR) if f.endswith('.jpg')]
    bg_image = random.choice(bgs) if bgs else None

    return render_template('index.html', default_sites=DEFAULT_SITES, applets=APPLETS, bg_image=bg_image)

@app.route('/status')
def check_status():
    url = request.args.get('url')
    if not url:
        return jsonify({'online': False})
    try:
        res = requests.get(url, timeout=3)
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
        
        # Fire off the thread to take the picture for *next* time
        threading.Thread(target=capture_screenshot_bg, args=(url, filepath)).start()

        # Check if file exists, else use fallback
        if os.path.exists(filepath):
            return send_file(filepath, mimetype='image/png')
        else:
            # Fallback to the logo using absolute path
            fallback = os.path.join(STATIC_DIR, "logo.png")
            if os.path.exists(fallback):
                return send_file(fallback, mimetype='image/png')
            
            # If even the logo is missing, send a blank response instead of crashing
            return "", 404
            
    except Exception as e:
        # If anything breaks, print it to the console so we can see it, and return 500 cleanly
        print(f"Error in /screenshot route: {e}")
        return "Internal Server Error", 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6060, debug=False)
