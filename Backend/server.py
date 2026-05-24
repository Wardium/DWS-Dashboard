from flask import Flask, request, jsonify, render_template, session, redirect
import os

app = Flask(__name__)

# 1. The Secret Key: This cryptographically signs the cookie so users cannot forge it.
# In production, use os.environ.get('FLASK_SECRET_KEY') and set a random 32-character string.
app.secret_key = "DSHIBOoSYIUGFS32v8740vn30c2r93r87ywfcnw0r8w04gwhrf" 

# 2. Cookie Security Configuration
app.config['SESSION_COOKIE_HTTPONLY'] = True # JavaScript cannot read the cookie
app.config['SESSION_COOKIE_SECURE'] = True   # MUST be True (requires HTTPS/Cloudflare)
# Because the iframe (Server) is inside a different domain (GitHub), 
# the browser requires SameSite='None' to allow setting the cookie.
app.config['SESSION_COOKIE_SAMESITE'] = 'None' 

SECRET_PASSWORD = "dws131258513"
GITHUB_PAGES_URL = "https://teamexist.com" 

@app.after_request
def add_security_headers(response):
    response.headers['Content-Security-Policy'] = f"frame-ancestors {GITHUB_PAGES_URL}"
    response.headers['X-Robots-Tag'] = "noindex, nofollow"
    return response

@app.route('/gateway', methods=['GET'])
def serve_gateway():
    return render_template('gateway.html')

@app.route('/api/verify', methods=['POST'])
def verify_password():
    data = request.get_json()
    if data and data.get('password') == SECRET_PASSWORD:
        # 3. Grant the VIP pass. This tells Flask to send the cookie to the browser.
        session['authenticated'] = True
        
        # Notice we don't even need the crazy long URL anymore. 
        # A standard, clean URL is perfectly safe now.
        return jsonify({"success": True, "redirect_url": "https://dashboard-rfdtq2xvdwq.teamexist.com"})
    else:
        return jsonify({"success": False}), 401

@app.route('/dashboard', methods=['GET'])
def serve_dashboard():
    # 4. The Bouncer: Check if the VIP pass exists
    if not session.get('authenticated'):
        # Kick them back out if they don't have the cookie
        return "Access Denied: Please log in through the main site.", 403
        
    # If they pass the check, serve the actual dashboard
    return render_template('your_actual_dashboard.html')

@app.route('/logout', methods=['GET'])
def logout():
    # Destroys the cookie
    session.clear()
    return "Logged out securely."

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
