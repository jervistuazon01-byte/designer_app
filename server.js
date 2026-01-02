require('dotenv').config();
const express = require('express');
const https = require('https');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON Body Parsing (Limit increased for images)
app.use(express.json({ limit: '50mb' }));

// 1. Serve Static Files
app.use(express.static(path.join(__dirname)));

// 2. API Proxy Endpoint: /api/generate
// SECURE: Does NOT accept 'key' from client in URL. Uses server ENV key.
app.post('/api/generate', async (req, res) => {
    console.log("SERVER: Received /api/generate request");

    // Get API Key from Environment
    const API_KEY = process.env.GOOGLE_API_KEY;

    if (!API_KEY) {
        console.error("SERVER ERROR: No GOOGLE_API_KEY in environment variables.");
        return res.status(500).json({ error: "Server Configuration Error: No API Key." });
    }

    try {
        const { url, payload } = req.body;

        if (!url || !payload) {
            return res.status(400).json({ error: "Missing 'url' or 'payload' in request body." });
        }

        // Construct Target URL (Inject Key)
        // Assume url passed by client does NOT have key.
        const separator = url.includes('?') ? '&' : '?';
        const googleUrl = url + `${separator}key=${API_KEY}`;

        console.log("SERVER: Proxying to Google...", url);

        // Forward execution to Google
        const proxyReq = https.request(googleUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000
        }, (proxyRes) => {
            let responseBody = '';
            proxyRes.on('data', (chunk) => responseBody += chunk);
            proxyRes.on('end', () => {
                res.status(proxyRes.statusCode).set(proxyRes.headers).send(responseBody);
            });
        });

        proxyReq.on('error', (e) => {
            console.error("SERVER PROXY ERROR:", e);
            res.status(500).json({ error: e.message });
        });

        proxyReq.write(JSON.stringify(payload));
        proxyReq.end();

    } catch (e) {
        console.error("SERVER EXCEPTION:", e);
        res.status(500).json({ error: e.message });
    }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const results = {};

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }

    console.log(`\n==================================================`);
    console.log(` NANO BANANA SERVER STARTED! (SECURE MODE) `);
    console.log(`--------------------------------------------------`);
    console.log(` [YOU] On PC:       http://localhost:${PORT}`);

    if (Object.keys(results).length === 0) {
        console.log(` [Network] Could not detect LAN IP.`);
    } else {
        console.log(` [OTHERS] On WiFi / LAN, try these:`);
        for (const name of Object.keys(results)) {
            for (const ip of results[name]) {
                console.log(`    - http://${ip}:${PORT}  (${name})`);
            }
        }
    }
    console.log(`==================================================\n`);
});
