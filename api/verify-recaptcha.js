export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { token, action } = req.body;
    const apiKey = process.env.RECAPTCHA_API_KEY;
    const siteKey = '6LeqflUsAAAAADT9Rs3soVcJly_C5E-8Yf50wk-G';
    const projectId = 'real-futbol-950e9';

    if (!token || !action) {
        return res.status(400).json({ error: 'Missing token or action' });
    }

    if (!apiKey) {
        console.error('RECAPTCHA_API_KEY not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event: {
                    token: token,
                    siteKey: siteKey,
                    expectedAction: action,
                },
            }),
        });

        const data = await response.json();

        // Check if the token is valid and the score is high enough
        // Note: You should adjust the score threshold based on your needs (0.0 - 1.0)
        if (data.tokenProperties && data.tokenProperties.valid) {
            // Return the full assessment so the client/caller can decide based on score
            return res.status(200).json({
                success: true,
                score: data.riskAnalysis ? data.riskAnalysis.score : 0,
                reasons: data.riskAnalysis ? data.riskAnalysis.reasons : [],
                data: data
            });
        } else {
            return res.status(400).json({ success: false, error: 'Invalid token', details: data });
        }

    } catch (error) {
        console.error('reCAPTCHA verification error:', error);
        return res.status(500).json({ error: 'Verification failed' });
    }
}
