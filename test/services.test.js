const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openStore } = require('../src/data/store');
const { createAuthService, digest } = require('../src/services/auth');
const { createEventService } = require('../src/services/events');
const { createSuggestionService } = require('../src/services/suggestions');
const { AppError } = require('../src/services/errors');
const rejected = (promise, status) => assert.rejects(promise, error => error instanceof AppError && error.status === status);
const event = { name: 'Campus meeting', date: '2099-12-03', place: 'Computer Lab', capacity: 1 };
async function fixture(t) {
    const data = await openStore({ filename: ':memory:', url: '' });
    t.after(() => data.close());
    const auth = createAuthService(data);
    const events = createEventService(data);
    const user = await auth.register('first@example.org', 'StudentPassword123');
    const other = await auth.register('other@example.org', 'StudentPassword123');
    await data.promote(user.email);
    return { data, auth, events, user, other, organizer: { ...user, role: 'organizer' } };
}

test('AC-1 database stores salted password hashes and rejects invalid or duplicate accounts', async t => {
    const { auth, data } = await fixture(t);
    const saved = await data.findUser('first@example.org');
    assert.match(saved.password_hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    assert.ok(!saved.password_hash.includes('StudentPassword123'));
    for (const email of [null, 'a'.repeat(255), 'wrong']) await rejected(auth.register(email, 'StudentPassword123'), 422);
    for (const password of [null, 'short', 'a'.repeat(129)]) await rejected(auth.register('new@example.org', password), 422);
    await rejected(auth.register('first@example.org', 'StudentPassword123'), 409);
    assert.equal((await auth.register('UPPER@example.org', 'StudentPassword123')).email, 'upper@example.org');
    let lookup = 0;
    const race = createAuthService({ findUser: async () => (++lookup === 1 ? null : saved), addUser: async () => { throw new Error('unique'); } });
    await rejected(race.register('first@example.org', 'StudentPassword123'), 409);
    const failed = createAuthService({ findUser: async () => null, addUser: async () => { throw new Error('database down'); } });
    await assert.rejects(failed.register('new@example.org', 'StudentPassword123'), /database down/);
});

test('AC-2 sessions require correct credentials, expire and can be revoked', async t => {
    const { auth, data, user } = await fixture(t);
    await rejected(auth.login(user.email, 'WrongPassword123'), 401);
    await rejected(auth.login('absent@example.org', 'WrongPassword123'), 401);
    const session = await auth.login(user.email, 'StudentPassword123');
    assert.match(session.token, /^[a-f0-9]{64}$/);
    assert.equal((await auth.sessionUser(session.token)).id, user.id);
    assert.equal(await auth.sessionUser(null), null);
    assert.equal(await auth.sessionUser('invalid'), null);
    assert.equal(await auth.sessionUser('a'.repeat(64)), null);
    const expired = 'b'.repeat(64);
    await data.saveSession(digest(expired), user.id, '2000-01-01');
    assert.equal(await auth.sessionUser(expired), null);
    await auth.logout(session.token);
    await auth.logout(undefined);
    assert.equal(await auth.sessionUser(session.token), null);
});

test('AC-4 verified Google identity links to the existing local account; unverified identity is rejected', async t => {
    const { auth, data, user } = await fixture(t);
    for (const identity of [{ sub: 'g1', email: user.email, email_verified: false }, { sub: 5, email_verified: true }, { sub: '', email_verified: true }]) await rejected(auth.googleLogin(identity), 401);
    const identity = { sub: 'g1', email: user.email, email_verified: true };
    const linked = await auth.googleLogin(identity);
    assert.equal(linked.user.id, user.id);
    assert.equal((await data.findUser(user.email)).google_sub, 'g1');
    assert.equal((await auth.googleLogin(identity)).user.id, user.id);
    const created = await auth.googleLogin({ sub: 'g2', email: 'google@example.org', email_verified: true });
    assert.equal(created.user.role, 'student');
    await rejected(auth.login('google@example.org', 'StudentPassword123'), 401);
    await rejected(auth.googleLogin({ sub: 'g3', email: user.email, email_verified: true }), 409);
});

test('AC-5 AC-6 database registrations reject duplicates, full and past events, including simultaneous attempts', async t => {
    const { events, user, other, organizer, data } = await fixture(t);
    const created = await events.createEvent(organizer, event);
    assert.equal(created.available, 1);
    const registration = await events.registerEvent(user, created.id);
    assert.equal((await events.getEvent(created.id)).available, 0);
    await rejected(events.registerEvent(user, created.id), 409);
    await rejected(events.registerEvent(other, created.id), 409);
    assert.equal((await data.registrations(user.id)).length, 1);
    await events.cancelRegistration(user, registration.id);
    const results = await Promise.allSettled([events.registerEvent(user, created.id), events.registerEvent(other, created.id)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
    const past = await data.addEvent({ ...event, date: '2000-01-01' });
    await rejected(events.registerEvent(user, past.id), 409);
    await rejected(events.registerEvent(user, 99999), 404);
    await rejected(events.registerEvent(null, created.id), 401);
});

test('AC-7 event creation requires organizer role and editing requires ownership', async t => {
    const { events, user, organizer } = await fixture(t);
    await rejected(events.createEvent(null, event), 401);
    await rejected(events.createEvent(user, event), 403);
    const created = await events.createEvent(organizer, event);
    assert.equal(created.name, event.name);
    assert.equal((await events.updateEvent(organizer, created.id, { ...event, name: 'Changed' })).name, 'Changed');
    await rejected(events.updateEvent({ ...organizer, id: 999 }, created.id, event), 403);
    await rejected(events.updateEvent(organizer, 99999, event), 404);
    await rejected(events.createEvent(organizer, null), 422);
    for (const bad of [
        { name: null }, { name: '' }, { name: 'a'.repeat(121) },
        { place: null }, { place: '' }, { place: 'a'.repeat(161) },
        { date: null }, { date: 'bad' }, { date: '2099-99-99' }, { date: '2099-02-31' }, { date: '2000-01-01' },
        { capacity: '1' }, { capacity: 0 }, { capacity: 10001 }
    ]) await rejected(events.createEvent(organizer, { ...event, ...bad }), 422);
    for (const id of [null, 0, -1, 1.5]) await rejected(events.getEvent(id), 422);
    await rejected(events.getEvent(99999), 404);
});

test('AC-8 another student cannot read or cancel private registrations', async t => {
    const { events, user, other, organizer } = await fixture(t);
    const created = await events.createEvent(organizer, event);
    const row = await events.registerEvent(user, created.id);
    assert.equal((await events.myRegistrations(user, user.id))[0].registrationId, row.id);
    await rejected(events.myRegistrations(other, user.id), 403);
    await rejected(events.myRegistrations(null, user.id), 401);
    await rejected(events.cancelRegistration(other, row.id), 403);
    await rejected(events.cancelRegistration(null, row.id), 401);
    await rejected(events.cancelRegistration(user, 99999), 404);
    assert.equal((await events.myRegistrations(user, user.id)).length, 1);
    await events.cancelRegistration(user, row.id);
    assert.deepEqual(await events.myRegistrations(user, user.id), []);
});

test('AC-9 fake model validates real picks and falls back for nonsense, failure and timeout', async t => {
    const { events, user, organizer } = await fixture(t);
    const first = await events.createEvent(organizer, event);
    const second = await events.createEvent(organizer, { ...event, date: '2099-12-04' });
    const valid = createSuggestionService(events, async () => ({ ids: [second.id] }));
    assert.equal((await valid.suggest(user, 'football')).events[0].id, second.id);
    assert.equal((await valid.suggest(user, 'football')).source, 'model');
    await rejected(valid.suggest(null, 'football'), 401);
    for (const input of [null, '', 'a'.repeat(501)]) await rejected(valid.suggest(user, input), 422);
    for (const answer of [null, {}, { ids: 'bad' }, { ids: [] }, { ids: [1, 2, 3, 4] }, { ids: [first.id, first.id] }, { ids: [99999] }]) {
        const result = await createSuggestionService(events, async () => answer).suggest(user, 'football');
        assert.equal(result.source, 'fallback');
        assert.equal(result.events[0].id, first.id);
    }
    const down = createSuggestionService(events, async () => { throw new Error('429'); });
    assert.equal((await down.suggest(user, 'football')).source, 'fallback');
    const timeout = createSuggestionService(events, () => new Promise(() => {}), 5);
    assert.equal((await timeout.suggest(user, 'football')).source, 'fallback');
    const empty = createSuggestionService({ listEvents: async () => [] }, async () => { throw new Error('must not call'); });
    assert.deepEqual((await empty.suggest(user, 'football')).events, []);
});


test('AC-9 a model pick removed during generation is rejected', async () => {
    let reads = 0;
    const rows = [{ id: 1, name: 'Removed', date: '2099-12-03', place: 'Campus' }];
    const service = createSuggestionService({ listEvents: async () => ++reads === 1 ? rows : [] }, async () => ({ ids: [1] }));
    const result = await service.suggest({ id: 1 }, 'coding');
    assert.equal(result.source, 'fallback');
    assert.deepEqual(result.events, []);
});
