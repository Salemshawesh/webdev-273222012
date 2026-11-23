async function loadEvents() {
    const status = document.getElementById('events-status');
    const list = document.getElementById('events-list');
    status.textContent = 'Loading events…';
    list.replaceChildren();
    try {
        const response = await fetch('/api/events', { cache: 'no-store' });
        if (!response.ok) throw new Error('Request failed');
        const events = await response.json();
        if (!Array.isArray(events)) throw new Error('Invalid events');
        status.textContent = events.length ? '' : 'No upcoming events. Please check again later.';
        for (const event of events) {
            const article = document.createElement('article');
            const title = document.createElement('h3');
            title.textContent = event.name;
            const date = document.createElement('time');
            date.dateTime = event.date;
            date.textContent = event.date;
            const location = document.createElement('p');
            location.textContent = event.place;
            article.append(title, date, location);
            const details = document.createElement('p');
            details.textContent = `Event ${event.id}: ${event.available} places available`;
            const button = document.createElement('button');
            button.textContent = 'Register for event';
            button.type = 'button';
            button.addEventListener('click', async () => {
                button.disabled = true;
                status.textContent = 'Registering…';
                try {
                    await api(`/api/events/${event.id}/registrations`, 'POST', {});
                    await loadEvents();
                    status.textContent = 'Registration saved.';
                    await loadRegistrations();
                } catch (error) { status.textContent = error.message; button.disabled = false; }
            });
            article.append(details, button);
            list.append(article);
        }
    } catch (error) {
        list.replaceChildren();
        status.textContent = 'Could not load events. Please try again.';
    }
}

document.getElementById('retry-events').addEventListener('click', loadEvents);
loadEvents();
