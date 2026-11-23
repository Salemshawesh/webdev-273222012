let currentUser = null;
async function api(url, method = 'GET', body) {
    const response = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    if (response.status === 204) return null;
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The request failed. Please try again.');
    return result;
}
const accountStatus = document.getElementById('account-status');
function showAccount() {
    document.getElementById('auth-forms').hidden = !!currentUser;
    document.getElementById('signed-in').hidden = !currentUser;
    document.getElementById('organizer').hidden = currentUser?.role !== 'organizer';
    accountStatus.textContent = currentUser ? `Signed in as ${currentUser.email}` : 'Sign in to register for events.';
}
async function loadAccount() {
    accountStatus.textContent = 'Loading account…';
    try {
        currentUser = (await api('/api/me')).user;
        showAccount();
        if (currentUser) await loadRegistrations();
    } catch (error) { accountStatus.textContent = error.message; }
}
async function loadRegistrations() {
    const status = document.getElementById('registrations-status');
    const list = document.getElementById('registrations-list');
    status.textContent = 'Loading registrations…';
    list.replaceChildren();
    try {
        if (!currentUser) throw new Error('Please sign in to see your registrations.');
        const registrations = await api(`/api/users/${currentUser.id}/registrations`);
        status.textContent = registrations.length ? 'Your registrations:' : 'No registrations yet. Choose an upcoming event to join.';
        for (const row of registrations) {
            const item = document.createElement('li');
            const label = document.createElement('p');
            label.textContent = `${row.name} — ${row.date} — ${row.place}`;
            const button = document.createElement('button');
            button.textContent = 'Cancel registration';
            button.addEventListener('click', async () => {
                button.disabled = true;
                try { await api(`/api/registrations/${row.registrationId}`, 'DELETE'); await loadRegistrations(); await loadEvents(); }
                catch (error) { status.textContent = error.message; button.disabled = false; }
            });
            item.append(label, button);
            list.append(item);
        }
    } catch (error) { status.textContent = error.message; }
}
for (const kind of ['login', 'register']) {
    document.getElementById(kind + '-form').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector('button');
        button.disabled = true;
        accountStatus.textContent = kind === 'login' ? 'Signing in…' : 'Creating account…';
        try {
            await api('/api/' + kind, 'POST', { email: form.elements.email.value, password: form.elements.password.value });
            form.reset();
            if (kind === 'login') await loadAccount();
            else accountStatus.textContent = 'Account created. You can now sign in.';
        } catch (error) { accountStatus.textContent = error.message; }
        finally { button.disabled = false; }
    });
}
document.getElementById('logout').addEventListener('click', async () => {
    try {
        await api('/api/logout', 'POST', {});
        currentUser = null;
        showAccount();
        document.getElementById('registrations-list').replaceChildren();
        document.getElementById('registrations-status').textContent = 'Sign in to see your registrations.';
    } catch (error) { accountStatus.textContent = error.message; }
});
document.getElementById('retry-registrations').addEventListener('click', loadRegistrations);
document.getElementById('event-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = document.getElementById('organizer-status');
    const button = form.querySelector('button');
    button.disabled = true;
    status.textContent = 'Saving event…';
    try {
        const body = Object.fromEntries(new FormData(form));
        const id = body.eventId;
        delete body.eventId;
        body.capacity = Number(body.capacity);
        await api(id ? `/api/events/${id}` : '/api/events', id ? 'PATCH' : 'POST', body);
        status.textContent = id ? 'Event updated.' : 'Event created.';
        form.reset();
        await loadEvents();
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
});
document.getElementById('suggestion-form').addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.getElementById('suggestions-status');
    const list = document.getElementById('suggestions-list');
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    status.textContent = 'Finding suggestions…';
    list.replaceChildren();
    try {
        const result = await api('/api/suggestions', 'POST', { interests: event.currentTarget.elements.interests.value });
        status.textContent = result.message;
        if (!result.events.length) status.textContent += ' No upcoming events. Check again later.';
        for (const row of result.events) {
            const item = document.createElement('li');
            item.textContent = `${row.name} — ${row.date} — ${row.place}. ${row.explanation}`;
            list.append(item);
        }
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
});
loadAccount();
