const { createEventService } = require('../src/services/events');
const { createAuthService } = require('../src/services/auth');
const projectTools = [
    { name: 'list_events', description: 'List upcoming campus events from the database with dates, locations and available places.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'get_event', description: 'Read one campus event by its ID, including its date, location and available places.', inputSchema: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'], additionalProperties: false } },
    { name: 'register_event', description: 'Register the signed-in student for an upcoming event, refusing duplicates and full events.', inputSchema: { type: 'object', properties: { id: { type: 'integer', minimum: 1 } }, required: ['id'], additionalProperties: false } }
];
function createProjectTools(data, token) {
    const events = createEventService(data);
    const auth = createAuthService(data);
    return async function call(name, args) {
        if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(key => key !== 'id') || (name === 'list_events' && Object.keys(args).length) || (name !== 'list_events' && (!Number.isSafeInteger(args.id) || args.id < 1))) {
            return { protocolError: 'Arguments do not match this tool schema.' };
        }
        try {
            let result;
            if (name === 'list_events') result = await events.listEvents();
            else if (name === 'get_event') result = await events.getEvent(args.id);
            else result = await events.registerEvent(await auth.sessionUser(token), args.id);
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (error) {
            return { isError: true, content: [{ type: 'text', text: JSON.stringify({ status: error.status || 500, error: error.status ? error.message : 'The request failed. Please try again.' }) }] };
        }
    };
}
module.exports = { projectTools, createProjectTools };
