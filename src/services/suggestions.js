const { AppError, requireUser } = require('./errors');

// Gemini is optional. When it fails, show the next three events by date.
function fallback(events) {
    return {
        source: 'fallback',
        message: 'Suggestions are unavailable. Here are the next upcoming events.',
        events: events.slice(0, 3).map(event => ({ ...event, explanation: 'An upcoming event, ordered by date.' }))
    };
}

function createSuggestionService(events, client, timeoutMs = 8500) {
    async function suggest(user, interests) {
        requireUser(user);
        if (typeof interests !== 'string' || !interests.trim() || interests.length > 500) {
            throw new AppError(422, 'Enter interests using 1 to 500 characters.');
        }
        const upcoming = await events.listEvents();
        if (!upcoming.length) return fallback(upcoming);

        let timer;
        let answer;
        try {
            const timeout = new Promise((resolve, reject) => {
                timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
            });
            answer = await Promise.race([client(interests.trim(), upcoming), timeout]);
        } catch {
            return fallback(await events.listEvents());
        } finally {
            clearTimeout(timer);
        }

        const current = await events.listEvents();
        const ids = answer?.ids;
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > 3 || new Set(ids).size !== ids.length) {
            return fallback(current);
        }
        const selected = ids.map(id => current.find(event => event.id === id));
        if (selected.includes(undefined)) return fallback(current);
        return {
            source: 'model',
            message: 'Suggested events. Check the event details before registering.',
            events: selected.map(event => ({ ...event, explanation: 'Selected from upcoming events for your interests.' }))
        };
    }
    return { suggest };
}
module.exports = { createSuggestionService };
