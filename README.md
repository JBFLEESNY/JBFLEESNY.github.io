# JBFLEESNY.github.io

## Local Testing

Before pushing to GitHub, test your site locally using one of these methods:

### Option 1: Python HTTP Server (Recommended - No Installation Needed)

If you have Python installed (most Macs do), run:

```bash
# Python 3
python3 -m http.server 8000

# Or Python 2 (if Python 3 isn't available)
python -m SimpleHTTPServer 8000
```

Then open your browser to: `http://localhost:8000`

### Option 2: Node.js http-server

If you have Node.js installed:

```bash
# Install globally (one time)
npm install -g http-server

# Run in your project directory
http-server -p 8000
```

Then open: `http://localhost:8000`

### Option 3: VS Code Live Server Extension

If you use VS Code:
1. Install the "Live Server" extension
2. Right-click on `index.html`
3. Select "Open with Live Server"

### Option 4: PHP Built-in Server

If you have PHP installed:

```bash
php -S localhost:8000
```

Then open: `http://localhost:8000`

---

**Important:** You must use an HTTP server (not just open the HTML file directly) because the site uses ES6 modules, which require proper CORS headers.
