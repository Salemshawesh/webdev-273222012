const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openStore } = require('../src/data/store');
const { createApp } = require('../src/app');
const { createAuthService } = require('../src/services/auth');
const { createProjectTools } = require('../mcp-server/project');
async function fixture(t) {
    const data = await openStore({ filename: ':memory:', url: '' });
    const server = createApp(data, { modelClient: async () => { throw new Error('offline fake'); } }).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => { await new Promise(resolve => server.close(resolve)); await data.close(); });
    const base = `http://127.0.0.1:${server.address().port}`;
    async function request(path, method = 'GET', body, cookie, extraHeaders = {}) {
        const response = await fetch(base + path, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
        const text = await response.text();
        return { status: response.status, body: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie') };
    }
    async function account(email) {
        assert.equal((await request('/api/register', 'POST', { email, password: 'StudentPassword123' })).status, 201);
        return request('/api/login', 'POST', { email, password: 'StudentPassword123' });
    }
    return { data, request, account };
}

test('AC-1 AC-2 HTTP local accounts issue HttpOnly SameSite sessions and reject bad credentials', async t => {
    const { request, account } = await fixture(t);
    assert.equal((await request('/api/me')).body.user, null);
    assert.equal((await request('/api/register', 'POST', { email: 'bad', password: 'bad' })).status, 422);
    assert.equal((await request('/api/register', 'POST', null)).status, 422);
    const signed = await account('api@example.org');
    assert.match(signed.cookie, /HttpOnly/);
    assert.match(signed.cookie, /SameSite=Lax/);
    assert.equal((await request('/api/me', 'GET', undefined, signed.cookie)).body.user.email, 'api@example.org');
    const bad = await request('/api/login', 'POST', { email: 'api@example.org', password: 'IncorrectPassword' });
    assert.equal(bad.status, 401);
    assert.equal(bad.cookie, null);
    assert.equal((await request('/api/logout', 'POST', {}, signed.cookie)).status, 204);
    assert.equal((await request('/api/me', 'GET', undefined, signed.cookie)).body.user, null);
    assert.equal((await request('/api/register', 'POST', {}, null, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await request('/api/register', 'POST', {}, null, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
    assert.equal((await request('/api/register', 'POST')).status, 415);
});

test('AC-5 AC-6 AC-7 AC-8 HTTP capacity and private registrations enforce 401, 403, 404 and 409', async t => {
    const { request, account, data } = await fixture(t);
    const first = await account('owner@example.org');
    const second = await account('second@example.org');
    const event = { name: 'Test event', date: '2099-12-03', place: 'Campus', capacity: 1 };
    assert.equal((await request('/api/events', 'POST', event)).status, 401);
    assert.equal((await request('/api/events', 'POST', event, second.cookie)).status, 403);
    await data.promote('owner@example.org');
    const created = await request('/api/events', 'POST', event, first.cookie);
    assert.equal(created.status, 201);
    const id = created.body.id;
    assert.equal((await request(`/api/events/${id}`)).status, 200);
    assert.equal((await request(`/api/events/${id}`, 'PATCH', { ...event, name: 'Updated' }, first.cookie)).body.name, 'Updated');
    assert.equal((await request(`/api/events/${id}/registrations`, 'POST', {})).status, 401);
    const registered = await request(`/api/events/${id}/registrations`, 'POST', {}, first.cookie);
    assert.equal(registered.status, 201);
    assert.equal((await request(`/api/events/${id}/registrations`, 'POST', {}, first.cookie)).status, 409);
    assert.equal((await request(`/api/events/${id}/registrations`, 'POST', {}, second.cookie)).status, 409);
    const ownPath = `/api/users/${first.body.id}/registrations`;
    assert.equal((await request(ownPath)).status, 401);
    assert.equal((await request(ownPath, 'GET', undefined, second.cookie)).status, 403);
    assert.equal((await request(ownPath, 'GET', undefined, first.cookie)).body.length, 1);
    const cancelPath = `/api/registrations/${registered.body.id}`;
    assert.equal((await request(cancelPath, 'DELETE')).status, 401);
    assert.equal((await request(cancelPath, 'DELETE', undefined, second.cookie)).status, 403);
    assert.equal((await request(cancelPath, 'DELETE', undefined, first.cookie)).status, 204);
    assert.equal((await request('/api/events/99999')).status, 404);
    assert.equal((await request('/missing')).status, 404);
});

test('AC-9 HTTP missing provider shows fallback without leaking model errors', async t => {
    const { request, account, data } = await fixture(t);
    const signed = await account('suggest@example.org');
    await data.addEvent({ name: 'Next event', date: '2099-12-03', place: 'Campus', capacity: 4 });
    assert.equal((await request('/api/suggestions', 'POST', { interests: 'coding' })).status, 401);
    const response = await request('/api/suggestions', 'POST', { interests: 'coding' }, signed.cookie);
    assert.equal(response.status, 200);
    assert.equal(response.body.source, 'fallback');
    assert.equal(response.body.events[0].name, 'Next event');
    assert.ok(!JSON.stringify(response.body).includes('offline fake'));
});

test('AC-10 project MCP uses the same session, capacity and duplicate rules as HTTP', async t => {
    const { data, request, account } = await fixture(t);
    const signed = await account('mcp@example.org');
    const auth = createAuthService(data);
    const session = await auth.login('mcp@example.org', 'StudentPassword123');
    const tools = createProjectTools(data, session.token);
    const anonymous = createProjectTools(data, undefined);
    const event = await data.addEvent({ name: 'MCP event', date: '2099-12-03', place: 'Campus', capacity: 1 });
    assert.equal(JSON.parse((await tools('list_events', {})).content[0].text)[0].name, 'MCP event');
    assert.equal(JSON.parse((await tools('get_event', { id: event.id })).content[0].text).id, event.id);
    assert.equal(JSON.parse((await anonymous('register_event', { id: event.id })).content[0].text).status, 401);
    const result = await tools('register_event', { id: event.id });
    assert.ok(!result.isError);
    assert.equal((await request(`/api/events/${event.id}/registrations`, 'POST', {}, signed.cookie)).status, 409);
    assert.equal(JSON.parse((await tools('register_event', { id: event.id })).content[0].text).status, 409);
    for (const args of [null, [], { id: 0 }, { id: 1, userId: 5 }]) assert.ok((await tools('get_event', args)).protocolError);
    assert.ok((await tools('list_events', { id: 1 })).protocolError);
    await auth.logout(session.token);
    assert.equal(JSON.parse((await tools('register_event', { id: event.id })).content[0].text).status, 401);
});
