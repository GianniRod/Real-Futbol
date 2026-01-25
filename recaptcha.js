/**
 * reCAPTCHA Enterprise Utility
 * 
 * Handles interaction with Google reCAPTCHA Enterprise
 */

const SITE_KEY = '6LeqflUsAAAAADT9Rs3soVcJly_C5E-8Yf50wk-G';

/**
 * Executes reCAPTCHA and returns the token
 * @param {string} action - The action name for the assessment (e.g. 'LOGIN', 'SIGNUP')
 * @returns {Promise<string>} - The reCAPTCHA token
 */
export const getToken = async (action) => {
    return new Promise((resolve, reject) => {
        if (!window.grecaptcha || !window.grecaptcha.enterprise) {
            reject(new Error('reCAPTCHA Enterprise not loaded'));
            return;
        }

        window.grecaptcha.enterprise.ready(async () => {
            try {
                const token = await window.grecaptcha.enterprise.execute(SITE_KEY, { action });
                resolve(token);
            } catch (error) {
                console.error('reCAPTCHA execution failed:', error);
                reject(error);
            }
        });
    });
};

/**
 * Verifies a token via the backend API
 * @param {string} token - The reCAPTCHA token
 * @param {string} action - The action name
 * @returns {Promise<object>} - The verification result
 */
export const verifyToken = async (token, action) => {
    try {
        const response = await fetch('/api/verify-recaptcha', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token, action })
        });

        if (!response.ok) {
            throw new Error('Verification request failed');
        }

        return await response.json();
    } catch (error) {
        console.error('reCAPTCHA verification error:', error);
        throw error;
    }
};
