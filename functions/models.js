const https = require('https');

exports.handler = async function (event, context) {
    const API_KEY = process.env.GOOGLE_API_KEY;
    if (!API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "Server Key Missing" }) };
    }

    // Helper to fetch data
    const fetchData = (path) => {
        return new Promise((resolve, reject) => {
            https.get(`https://generativelanguage.googleapis.com/v1beta/${path}?key=${API_KEY}`, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        // If Google returns error, capture it
                        try {
                            const err = JSON.parse(data);
                            // Log to Netlify logs (optional visibility)
                            console.log(`Upstream Error ${path}:`, err);
                            resolve({ upstreamError: err });
                        } catch (e) {
                            resolve({ upstreamError: { code: res.statusCode, message: data } });
                        }
                    } else {
                        resolve(JSON.parse(data));
                    }
                });
            }).on('error', reject);
        });
    };

    try {
        // Parallel fetch: Models + TunedModels
        const [modelsData, tunedData] = await Promise.all([
            fetchData('models'),
            fetchData('tunedModels').catch(() => ({}))
        ]);

        // Check for critical upstream errors
        if (modelsData.upstreamError) {
            return {
                statusCode: 400, // Bad Request usually implies Key/Perms issues
                body: JSON.stringify({ error: modelsData.upstreamError })
            };
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                models: modelsData.models || [],
                tunedModels: tunedData.tunedModels || []
            })
        };
    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};
