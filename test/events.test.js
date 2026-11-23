const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openStore } = require('../src/data/store');
const { createEventService } = require('../src/services/events');
const { createApp } = require('../src/app');

test('AC-3 service lists only upcoming database events in date order', async () => {
    const data = await openStore({ filename: ':memory:', url: '' });
    try {
        await data.addEvent({ name: 'Past', date: '2000-01-01', place: 'Old hall', capacity: 2 });
        await data.addEvent({ name: 'Later', date: '2099-12-20', place: 'Sports ground', capacity: 4 });
        await data.addEvent({ name: 'Sooner', date: '2099-12-03', place: 'Computer lab', capacity: 3 });
        const service = createEventService(data);
        assert.deepEqual((await service.listEvents('2099-12-01')).map(e => [e.name, e.date, e.place]), [
            ['Sooner', '2099-12-03', 'Computer lab'], ['Later', '2099-12-20', 'Sports ground']
        ]);
        assert.deepEqual(await service.listEvents('2100-01-01'), []);
    } finally { await data.close(); }
});

test('AC-3 HTTP serves the database list and a homepage that loads its renderer', async () => {
    const data = await openStore({ filename: ':memory:', url: '' });
    await data.addEvent({ name: 'Test meeting', date: '2099-01-01', place: 'Test hall', capacity: 5 });
    const server = createApp(data).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    try {
        const response = await fetch(url + '/api/events');
        assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).map(e => [e.name, e.date, e.place]), [['Test meeting', '2099-01-01', 'Test hall']]);
        assert.deepEqual(await (await fetch(url + '/health')).json(), { status: 'ok', db: 'ok' });
        assert.match(await (await fetch(url)).text(), /src="\/events.js" defer/);
        assert.match(await (await fetch(url + '/events.js')).text(), /fetch\('\/api\/events'/);
        assert.equal((await fetch(url + '/api/missing')).status, 404);
    } finally {
        await new Promise(resolve => server.close(resolve));
        await data.close();
    }
});

test('AC-3 HTTP distinguishes an empty list from a database failure', async () => {
    const data = await openStore({ filename: ':memory:', url: '' });
    const server = createApp(data).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    try {
        assert.deepEqual(await (await fetch(url + '/api/events')).json(), []);
        await data.close();
        const response = await fetch(url + '/api/events');
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { error: 'The request failed. Please try again.' });
        assert.equal((await fetch(url + '/health')).status, 500);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
