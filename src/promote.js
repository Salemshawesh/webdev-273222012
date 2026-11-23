// Maintenance command for the database owner; there is no public role-changing endpoint.
const { openStore } = require('./data/store');
async function promote() {
    if (!process.argv[2]) throw new Error('Pass the email of an existing account.');
    const data = await openStore();
    try {
        const result = await data.promote(process.argv[2].trim().toLowerCase());
        if (!result.length) throw new Error('Account not found.');
        console.log('Organizer role granted.');
    } finally { await data.close(); }
}
promote().catch(error => { console.error(error.message); process.exitCode = 1; });
