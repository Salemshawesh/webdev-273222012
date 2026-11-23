const express = require('express');
const path = require('node:path');
const { createEventService } = require('./services/events');
const { createAuthService } = require('./services/auth');
const { createSuggestionService } = require('./services/suggestions');
const { createModelClient } = require('./providers/model');
const { createGoogleFlow } = require('./providers/google');
const { eventRoutes } = require('./routes/events');
const { accountRoutes } = require('./routes/accounts');
function createApp(data, options = {}) {
    const app = express();
    const baseUrl = options.baseUrl || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const secure = baseUrl.startsWith('https://');
    const auth = createAuthService(data);
    const events = createEventService(data);
    const suggestions = createSuggestionService(events, options.modelClient || createModelClient());
    const google = createGoogleFlow(data, auth, options.googleClient);
    const cookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
    const setSession = (res, token) => res.cookie('session', token, { ...cookieOptions, maxAge: token ? 7 * 86400000 : 0 });
    app.disable('x-powered-by');
    app.use((req, res, next) => {
        res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
        next();
    });
    app.use(express.json({ limit: '16kb', strict: false }));
    app.get('/health', async (req, res) => {
        await data.health();
        res.json({ status: 'ok', db: 'ok' });
    });
    app.use(async (req, res, next) => {
        const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map(pair => pair.trim().split('=')));
        req.cookies = cookies;
        req.sessionToken = req.headers.authorization?.replace(/^Bearer /, '') || cookies.session;
        req.user = await auth.sessionUser(req.sessionToken);
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            if (req.headers.origin && req.headers.origin !== new URL(baseUrl).origin) return res.status(403).json({ error: 'This request must come from this website.' });
            if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
            if (req.method !== 'DELETE' && !req.is('application/json')) return res.status(415).json({ error: 'Send JSON data.' });
        }
        next();
    });
    app.get('/auth/google', async (req, res) => {
        const result = await google.start();
        res.cookie('oauth_state', result.state, { ...cookieOptions, maxAge: 600000 });
        res.redirect(result.url);
    });
    app.get('/auth/google/callback', async (req, res) => {
        const result = await google.finish(req.query.code, req.query.state, req.cookies.oauth_state);
        res.clearCookie('oauth_state', cookieOptions);
        setSession(res, result.token);
        res.redirect('/#account');
    });
    app.use('/api/events', eventRoutes(events));
    app.use('/api', accountRoutes(auth, events, suggestions, setSession));
    app.use(express.static(path.join(__dirname, '../public')));
    app.use((req, res) => res.status(404).json({ error: 'Not found' }));
    app.use((error, req, res, next) => {
        const status = error.status || 500;
        if (status >= 500) console.error('Request failed:', error.name);
        res.status(status).json({ error: status >= 500 ? 'The request failed. Please try again.' : error.message });
    });
    return app;
}
module.exports = { createApp };
