const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const { mkdirSync } = require('node:fs');
const { openStore } = require('../src/data/store');
const { createApp } = require('../src/app');
async function run() {
    const data = await openStore({ filename: ':memory:', url: '' });
    await data.addEvent({ name: 'Coding Club Meeting', date: '2099-12-03', place: 'Computer Lab', capacity: 1 });
    const server = require('node:http').createServer();
    server.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    server.on('request', createApp(data, { baseUrl: base, modelClient: async () => { await new Promise(resolve => setTimeout(resolve, 400)); throw new Error('fake provider down'); } }));
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        mkdirSync('docs/screenshots', { recursive: true });
        await page.goto(base);
        await page.getByRole('heading', { name: 'Coding Club Meeting' }).waitFor();
        await page.reload();
        await page.getByRole('heading', { name: 'Coding Club Meeting' }).waitFor();
        assert.match(await page.locator('#events-list').innerText(), /2099-12-03[\s\S]*Computer Lab/);
        console.log('PASS AC-3 homepage opens and refreshes with database title, date and location');
        for (const width of [380, 768, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.screenshot({ path: `docs/screenshots/events-${width}.png`, fullPage: true });
        }
        console.log('PASS responsive widths 380, 768, 1280: no horizontal scrolling');
        await page.route('**/api/events', async route => { await new Promise(resolve => setTimeout(resolve, 700)); await route.continue(); });
        await page.getByRole('button', { name: 'Refresh events', exact: true }).click();
        await page.getByText('Loading events…', { exact: true }).waitFor();
        await page.screenshot({ path: 'docs/screenshots/events-loading.png', fullPage: true });
        await page.getByRole('heading', { name: 'Coding Club Meeting' }).waitFor();
        await page.unroute('**/api/events');
        await page.route('**/api/events', route => route.fulfill({ json: [] }));
        await page.getByRole('button', { name: 'Refresh events', exact: true }).click();
        await page.getByText('No upcoming events. Please check again later.', { exact: true }).waitFor();
        await page.screenshot({ path: 'docs/screenshots/events-empty.png', fullPage: true });
        await page.unroute('**/api/events');
        await page.route('**/api/events', route => route.abort());
        await page.getByRole('button', { name: 'Refresh events', exact: true }).click();
        await page.getByText('Could not load events. Please try again.', { exact: true }).waitFor();
        await page.screenshot({ path: 'docs/screenshots/events-error.png', fullPage: true });
        await page.unroute('**/api/events');
        await page.getByRole('button', { name: 'Refresh events', exact: true }).click();
        await page.getByRole('heading', { name: 'Coding Club Meeting' }).waitFor();
        console.log('PASS loading, empty, error and success states with screenshots');
        // Start focus in the registration form, then use only keyboard inputs.
        await page.locator('#register-email').focus();
        await page.keyboard.type('browser@example.org');
        await page.keyboard.press('Tab');
        await page.keyboard.type('StudentPassword123');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');
        await page.getByText('Account created. You can now sign in.', { exact: true }).waitFor();
        await page.locator('#login-email').focus();
        await page.keyboard.type('browser@example.org');
        await page.keyboard.press('Tab');
        await page.keyboard.type('StudentPassword123');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');
        await page.getByText('Signed in as browser@example.org', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Register for event', exact: true }).focus();
        await page.keyboard.press('Enter');
        await page.getByText('Registration saved.', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Cancel registration', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Cancel registration', exact: true }).focus();
        await page.keyboard.press('Enter');
        await page.getByText('No registrations yet. Choose an upcoming event to join.', { exact: true }).waitFor();
        await page.locator('#interests').fill('coding');
        await page.getByRole('button', { name: 'Suggest events', exact: true }).click();
        await page.getByText('Finding suggestions…', { exact: true }).waitFor();
        await page.screenshot({ path: 'docs/screenshots/suggestions-loading.png', fullPage: true });
        await page.getByText('Suggestions are unavailable. Here are the next upcoming events.', { exact: true }).waitFor();
        await page.screenshot({ path: 'docs/screenshots/suggestions-fallback.png', fullPage: true });
        // Use a real Tab key so the browser shows its keyboard focus outline.
        for (let step = 0; step < 40; step++) {
            await page.keyboard.press('Tab');
            if (await page.locator('#logout:focus').count()) break;
        }
        assert.equal(await page.locator('#logout:focus').count(), 1);
        assert.notEqual(await page.locator('#logout').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
        await page.keyboard.press('Enter');
        await page.getByText('Sign in to register for events.', { exact: true }).waitFor();
        assert.deepEqual(errors, []);
        console.log('PASS AC-1 AC-2 AC-5 keyboard form controls, registration, cancellation, sign-out; no uncaught browser errors');
        console.log('PASS AC-9 fake provider unavailable: visible pending and fallback states');
        const waterfall = await page.evaluate(() => performance.getEntriesByType('resource').map(r => ({ path: new URL(r.name).pathname, durationMs: Math.round(r.duration) })));
        console.log('Observed local resource timings:', JSON.stringify(waterfall));
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
        await data.close();
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
