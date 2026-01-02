const https = require('https');

exports.handler = async function (event, context) {
    console.log("SERVER: Function started.");

    // Only allow POST requests
    if (event.httpMethod !== "POST") {
        console.log("SERVER: Method Not Allowed:", event.httpMethod);
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // Get API Key from Environment Variable (Securely set in Netlify Dashboard)
    const API_KEY = process.env.GOOGLE_API_KEY;
    console.log("SERVER: Key Check:", API_KEY ? "Present (Length: " + API_KEY.length + ")" : "MISSING");

    if (!API_KEY) {
        console.error("SERVER ERROR: API Key is missing in process.env");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: { message: "Server API Key not configured in Netlify." } })
        };
    }

    try {
        console.log("SERVER: Parsing Body...");
        const clientData = JSON.parse(event.body);

        // Smart Separator: Check if URL already has params
        const separator = clientData.url.includes('?') ? '&' : '?';
        const googleUrl = clientData.url + `${separator}key=${API_KEY}`;

        console.log("SERVER: Request URL constructed:", googleUrl.replace(API_KEY, "HIDDEN_KEY"));

        // Return a promise to handle the async HTTPS request
        return new Promise((resolve, reject) => {
            console.log("SERVER: Sending request to Google...");
            const req = https.request(googleUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: 9000 // 9s timeout (Netlify limit is 10s)
            }, (res) => {
                console.log("SERVER: Google Responded. Status:", res.statusCode);
                let responseBody = '';
                res.on('data', (chunk) => responseBody += chunk);
                res.on('end', () => {
                    console.log("SERVER: Response received completely. Length:", responseBody.length);
                    resolve({
                        statusCode: res.statusCode,
                        headers: { "Content-Type": "application/json" },
                        body: responseBody
                    });
                });
            });

            req.on('timeout', () => {
                console.error("SERVER ERROR: Request Timeout (>9s)");
                req.destroy();
                resolve({ statusCode: 504, body: JSON.stringify({ error: { message: "Gateway Timeout (Google took too long)" } }) });
            });

            req.on('error', (e) => {
                console.error("SERVER ERROR: Request Error:", e.message);
                resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
            });

            req.write(JSON.stringify(clientData.payload));
            req.end();
        });

    } catch (e) {
        console.error("SERVER EXCEPTION:", e);
        return { statusCode: 400, body: "Invalid Request Body" };
    }
};
