const { AppError, requireUser } = require('./errors');
function createEventService(data) {
    const today = () => new Date().toISOString().slice(0, 10);
    function publicEvent(event) {
        return { id: event.id, name: event.name, date: event.date, place: event.place, capacity: event.capacity, available: Number(event.available) };
    }
    async function listEvents(date = today()) {
        return (await data.listUpcoming(date)).map(publicEvent);
    }
    function validId(id) {
        if (!Number.isSafeInteger(id) || id < 1) throw new AppError(422, 'Use a valid ID.');
    }
    async function getEvent(id) {
        validId(id);
        const event = await data.getEvent(id);
        if (!event) throw new AppError(404, 'Event not found.');
        return publicEvent(event);
    }
    async function registerEvent(user, id) {
        requireUser(user);
        validId(id);
        return data.register(user.id, id, (event, duplicate, count) => {
            if (!event) throw new AppError(404, 'Event not found.');
            if (event.date < today()) throw new AppError(409, 'This event has already passed.');
            if (duplicate) throw new AppError(409, 'You are already registered.');
            if (count >= event.capacity) throw new AppError(409, 'This event is full.');
        });
    }
    async function myRegistrations(user, ownerId) {
        requireUser(user);
        if (user.id !== ownerId) throw new AppError(403, 'You may only see your own registrations.');
        return data.registrations(user.id);
    }
    async function cancelRegistration(user, id) {
        requireUser(user);
        validId(id);
        const row = await data.getRegistration(id);
        if (!row) throw new AppError(404, 'Registration not found.');
        if (row.user_id !== user.id) throw new AppError(403, 'You may only cancel your own registration.');
        await data.cancelRegistration(id);
    }
    function eventInput(input) {
        const { name, date, place } = input || {};
        if (typeof name !== 'string' || !name.trim() || name.length > 120 || typeof place !== 'string' || !place.trim() || place.length > 160) throw new AppError(422, 'Enter a title and location.');
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < today()) throw new AppError(422, 'Enter a valid upcoming date.');
        return { name: name.trim(), date, place: place.trim() };
    }
    function requireOrganizer(user) {
        requireUser(user);
        if (user.role !== 'organizer') throw new AppError(403, 'Only organizers can manage events.');
    }
    async function createEvent(user, input) {
        requireOrganizer(user);
        const event = eventInput(input);
        if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 10000) throw new AppError(422, 'Capacity must be between 1 and 10000.');
        const result = await data.addEvent({ ...event, capacity: input.capacity }, user.id);
        return getEvent(Number(result.id));
    }
    async function updateEvent(user, id, input) {
        requireOrganizer(user);
        validId(id);
        const event = await data.getEvent(id);
        if (!event) throw new AppError(404, 'Event not found.');
        if (event.organizer_id !== user.id) throw new AppError(403, 'You may only edit your own event.');
        await data.updateEvent(id, eventInput(input));
        return getEvent(id);
    }
    return { listEvents, getEvent, registerEvent, myRegistrations, cancelRegistration, createEvent, updateEvent };
}
module.exports = { createEventService };
