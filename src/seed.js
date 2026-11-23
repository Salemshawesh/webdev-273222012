// Explicit demo data; the normal server never seeds or grants roles.
const { openStore } = require('./data/store');
async function seed() {
    const data = await openStore();
    try {
        const events = [
            { name: 'Coding Club Meeting', date: '2026-12-03', place: 'Computer Lab', capacity: 20 },
            { name: 'Football Tournament', date: '2026-12-10', place: 'University Sports Ground', capacity: 30 },
            { name: 'Movie Night', date: '2026-12-15', place: 'Student Hall', capacity: 40 }
        ];
        const existing = await data.listUpcoming('0000-01-01');
        for (const event of events) {
            if (!existing.some(row => row.name === event.name && row.date === event.date)) await data.addEvent(event);
        }
        console.log('Demo events saved. Existing events were preserved.');
    } finally { await data.close(); }
}
seed().catch(error => { console.error('Seeding failed:', error.name); process.exitCode = 1; });
