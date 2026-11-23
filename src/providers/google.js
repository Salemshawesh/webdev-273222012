const { createHash, randomBytes } = require('node:crypto');
const { AppError } = require('../services/errors');
const { digest } = require('../services/auth');
function createGoogleClient(config = process.env, fetchClient = fetch) {
    const callback = config.PUBLIC_BASE_URL + '/auth/google/callback';
    function configured() {
        if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.PUBLIC_BASE_URL) throw new AppError(503, 'Google sign-in is not configured yet. Please use password sign-in.');
    }
    return {
        start(state, verifier) {
            configured();
            const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            url.search = new URLSearchParams({ client_id: config.GOOGLE_CLIENT_ID, redirect_uri: callback, response_type: 'code', scope: 'openid email', state, nonce: state, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') });
            return url.toString();
        },
        async finish(code, verifier, state) {
            configured();
            const response = await fetchClient('https://oauth2.googleapis.com/token', {
                method: 'POST', signal: AbortSignal.timeout(8000),
                body: new URLSearchParams({ code, code_verifier: verifier, client_id: config.GOOGLE_CLIENT_ID, client_secret: config.GOOGLE_CLIENT_SECRET, redirect_uri: callback, grant_type: 'authorization_code' })
            });
            if (!response.ok) throw new AppError(401, 'Google sign-in failed. Please try again.');
            const tokens = await response.json();
            const { createRemoteJWKSet, jwtVerify } = await import('jose');
            const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), { timeoutDuration: 8000 });
            const { payload } = await jwtVerify(tokens.id_token, keys, { audience: config.GOOGLE_CLIENT_ID, issuer: ['https://accounts.google.com', 'accounts.google.com'] });
            if (payload.nonce !== state) throw new AppError(401, 'Google sign-in could not be verified.');
            return payload;
        }
    };
}
function createGoogleFlow(data, auth, client = createGoogleClient()) {
    return {
        async start() {
            const state = randomBytes(32).toString('hex');
            const verifier = randomBytes(32).toString('base64url');
            const url = client.start(state, verifier);
            await data.saveState(digest(state), verifier, new Date(Date.now() + 600000).toISOString());
            return { state, url };
        },
        async finish(code, state, cookieState) {
            if (typeof code !== 'string' || !code || typeof state !== 'string' || !state || state !== cookieState) throw new AppError(401, 'Google sign-in expired or could not be verified.');
            const saved = await data.consumeState(digest(state), new Date().toISOString());
            if (!saved) throw new AppError(401, 'Google sign-in expired. Please try again.');
            return auth.googleLogin(await client.finish(code, saved.verifier, state));
        }
    };
}
module.exports = { createGoogleClient, createGoogleFlow };
