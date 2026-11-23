const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGoogleFlow, createGoogleClient } = require('../src/providers/google');
const { createModelClient } = require('../src/providers/model');
const { createAuthService } = require('../src/services/auth');
const { openStore } = require('../src/data/store');
const { createApp } = require('../src/app');

test('AC-4 Google flow binds state to a browser, expires it, consumes once and passes PKCE verifier', async t => {
    const data = await openStore({ filename: ':memory:', url: '' });
    t.after(() => data.close());
    const auth = createAuthService(data);
    let captured;
    const client = {
        start(state, verifier) { captured = { state, verifier }; return 'https://accounts.google.com/example'; },
        async finish(code, verifier, state) {
            assert.equal(code, 'test-code');
            assert.equal(verifier, captured.verifier);
            assert.equal(state, captured.state);
            return { sub: 'provider-subject', email: 'google@example.org', email_verified: true };
        }
    };
    const flow = createGoogleFlow(data, auth, client);
    const started = await flow.start();
    assert.equal(started.url, 'https://accounts.google.com/example');
    await assert.rejects(flow.finish('test-code', started.state, 'wrong-cookie'), error => error.status === 401);
    const result = await flow.finish('test-code', started.state, started.state);
    assert.equal((await auth.sessionUser(result.token)).email, 'google@example.org');
    await assert.rejects(flow.finish('test-code', started.state, started.state), error => error.status === 401);
    await assert.rejects(flow.finish('', started.state, started.state), error => error.status === 401);
    const google = createGoogleClient({ PUBLIC_BASE_URL: 'https://campus.example', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'placeholder' });
    const url = new URL(google.start('state', 'verifier'));
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('nonce'), 'state');
    assert.equal(url.searchParams.get('redirect_uri'), 'https://campus.example/auth/google/callback');
    assert.throws(() => createGoogleClient({}).start('state', 'verifier'), error => error.status === 503);
    const rejected = createGoogleClient({ PUBLIC_BASE_URL: 'http://localhost', GOOGLE_CLIENT_ID: 'test', GOOGLE_CLIENT_SECRET: 'placeholder' }, async () => ({ ok: false }));
    await assert.rejects(rejected.finish('code', 'verifier', 'state'), error => error.status === 401);
});

test('AC-4 HTTP Google redirects set a secure state cookie and use the ordinary session on callback', async t => {
    const data = await openStore({ filename: ':memory:', url: '' });
    const client = { start: state => 'https://accounts.google.com/?state=' + state, finish: async () => ({ sub: 'sub', email: 'callback@example.org', email_verified: true }) };
    const server = createApp(data, { baseUrl: 'https://campus.example', googleClient: client }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => { await new Promise(resolve => server.close(resolve)); await data.close(); });
    const base = 'http://127.0.0.1:' + server.address().port;
    const start = await fetch(base + '/auth/google', { redirect: 'manual' });
    assert.equal(start.status, 302);
    assert.match(start.headers.get('set-cookie'), /Secure/);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const callback = await fetch(base + '/auth/google/callback?code=fake&state=' + state, { headers: { Cookie: 'oauth_state=' + state }, redirect: 'manual' });
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get('set-cookie'), /session=[a-f0-9]{64}/);
    assert.match(callback.headers.get('set-cookie'), /HttpOnly/);
});

test('AC-9 provider adapter uses a timeout and the injected fake fetch, never a live model', async () => {
    let seen;
    const fake = async (url, options) => {
        seen = { url, options };
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ids":[1]}' }] } }] }) };
    };
    const client = createModelClient({ GEMINI_API_KEY: 'fake-test-key' }, fake);
    assert.deepEqual(await client('coding', [{ id: 1, name: 'Club', date: '2099-01-01', place: 'Campus', secret: 'must not leave' }]), { ids: [1] });
    assert.ok(seen.options.signal);
    assert.ok(!seen.options.body.includes('must not leave'));
    assert.equal(seen.options.headers['x-goog-api-key'], 'fake-test-key');
    await assert.rejects(createModelClient({})('coding', []), /unavailable/);
    await assert.rejects(createModelClient({ GEMINI_API_KEY: 'fake', MODEL_NAME: 'custom' }, async () => ({ ok: false }))('coding', []), /unavailable/);
});
