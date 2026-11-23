const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

// A small DOM double exercises our renderer without installing a browser package.
// It cannot prove browser layout, keyboard behavior or Codespaces forwarding.
function element() {
    return {
        textContent: '', children: [],
        replaceChildren() { this.children = []; },
        append(...children) { this.children.push(...children); },
        addEventListener(name, callback) { this[name] = callback; }
    };
}

async function render(fetch) {
    const elements = {
        'events-status': element(), 'events-list': element(), 'retry-events': element()
    };
    const context = vm.createContext({
        document: { getElementById: id => elements[id], createElement: element }, fetch
    });
    vm.runInContext(readFileSync('public/events.js', 'utf8'), context);
    await new Promise(resolve => setImmediate(resolve));
    return elements;
}

test('AC-3 homepage renders names, dates and locations again after refresh', async () => {
    let calls = 0;
    const elements = await render(async (url, options) => {
        assert.equal(url, '/api/events');
        assert.equal(options.cache, 'no-store');
        calls++;
        return { ok: true, json: async () => [{ id: 1, available: 4, name: '<b>Club</b>', date: '2026-12-03', place: 'Computer Lab' }] };
    });
    function checkCard() {
        const cards = elements['events-list'].children;
        assert.equal(cards.length, 1);
        assert.deepEqual(cards[0].children.map(child => child.textContent), ['<b>Club</b>', '2026-12-03', 'Computer Lab', 'Event 1: 4 places available', 'Register for event']);
        assert.equal(cards[0].children[1].dateTime, '2026-12-03');
        assert.equal(elements['events-status'].textContent, '');
    }
    checkCard();
    await elements['retry-events'].click();
    checkCard();
    assert.equal(calls, 2);
});

test('AC-3 homepage shows loading until the response arrives', async () => {
    let respond;
    const elements = await render(() => new Promise(resolve => { respond = resolve; }));
    assert.equal(elements['events-status'].textContent, 'Loading events…');
    respond({ ok: true, json: async () => [] });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements['events-status'].textContent, 'No upcoming events. Please check again later.');
});

test('AC-3 homepage separates an empty database from HTTP, network and invalid-response failures', async () => {
    for (const fetch of [
        async () => ({ ok: false }),
        async () => { throw new Error('Network unavailable'); },
        async () => ({ ok: true, json: async () => ({ unexpected: true }) })
    ]) {
        const elements = await render(fetch);
        assert.equal(elements['events-status'].textContent, 'Could not load events. Please try again.');
        assert.equal(elements['events-list'].children.length, 0);
    }
});
