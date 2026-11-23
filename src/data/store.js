const { DatabaseSync } = require('node:sqlite');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

async function openStore(options = {}) {
    const url = options.url === undefined ? process.env.DATABASE_URL : options.url;
    let database;
    if (url) {
        const { Pool } = require('pg');
        database = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
    } else {
        database = new DatabaseSync(options.filename || process.env.DATABASE_PATH || 'campus.sqlite');
        database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000');
    }
    function query(sql, params = [], connection = database) {
        if (url) {
            let index = 0;
            return connection.query(sql.replace(/\?/g, () => '$' + (++index)), params).then(result => result.rows);
        }
        return Promise.resolve(connection.prepare(sql).all(...params));
    }
    async function exec(sql, connection = database) {
        if (url) await connection.query(sql);
        else connection.exec(sql);
    }
    await exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
    // Serialize PostgreSQL migrations across HTTP/MCP startup processes.
    const migrationConnection = url ? await database.connect() : database;
    try {
        await exec('BEGIN', migrationConnection);
        if (url) await query('SELECT pg_advisory_xact_lock(273222012)', [], migrationConnection);
        for (const name of readdirSync(path.join(__dirname, '../migrations')).filter(name => name.endsWith('.sql')).sort()) {
            if (!(await query('SELECT name FROM migrations WHERE name = ?', [name], migrationConnection)).length) {
                let sql = readFileSync(path.join(__dirname, '../migrations', name), 'utf8');
                if (url) sql = sql.replace(/INTEGER PRIMARY KEY/g, 'SERIAL PRIMARY KEY');
                await exec(sql, migrationConnection);
                await query('INSERT INTO migrations (name) VALUES (?)', [name], migrationConnection);
            }
        }
        await exec('COMMIT', migrationConnection);
    } catch (error) {
        await exec('ROLLBACK', migrationConnection);
        throw error;
    } finally { if (url) migrationConnection.release(); }

    const eventFields = 'e.id, e.name, e.date, e.place, e.capacity, e.organizer_id, (e.capacity - (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id)) AS available';
    // SQLite transactions share a connection, so queue them. Postgres uses a dedicated connection per transaction.
    let queue = Promise.resolve();
    async function transaction(work) {
        const run = async () => {
            const connection = url ? await database.connect() : database;
            try {
                await exec(url ? 'BEGIN' : 'BEGIN IMMEDIATE', connection);
                const result = await work((sql, params) => query(sql, params, connection));
                await exec('COMMIT', connection);
                return result;
            } catch (error) {
                await exec('ROLLBACK', connection);
                throw error;
            } finally { if (url) connection.release(); }
        };
        if (url) return run();
        const result = queue.then(run);
        queue = result.catch(() => {});
        return result;
    }
    return {
        async listUpcoming(today) { return query(`SELECT ${eventFields} FROM events e WHERE e.date >= ? ORDER BY e.date, e.id`, [today]); },
        async getEvent(id) { return (await query(`SELECT ${eventFields} FROM events e WHERE e.id = ?`, [id]))[0]; },
        async addEvent(event, organizerId = null) {
            return (await query('INSERT INTO events (name, date, place, capacity, organizer_id) VALUES (?, ?, ?, ?, ?) RETURNING id', [event.name, event.date, event.place, event.capacity, organizerId]))[0];
        },
        async updateEvent(id, event) { await query('UPDATE events SET name = ?, date = ?, place = ? WHERE id = ?', [event.name, event.date, event.place, id]); },
        async findUser(email) { return (await query('SELECT * FROM users WHERE email = ?', [email]))[0]; },
        async findGoogle(sub) { return (await query('SELECT * FROM users WHERE google_sub = ?', [sub]))[0]; },
        async addUser(email, hash, sub = null) { return (await query('INSERT INTO users (email, password_hash, google_sub) VALUES (?, ?, ?) RETURNING *', [email, hash, sub]))[0]; },
        async linkGoogle(id, sub) { await query('UPDATE users SET google_sub = ? WHERE id = ?', [sub, id]); },
        async saveSession(hash, userId, expires) { await query('INSERT INTO sessions VALUES (?, ?, ?)', [hash, userId, expires]); },
        async sessionUser(hash, now) { return (await query('SELECT u.id, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?', [hash, now]))[0]; },
        async deleteSession(hash) { await query('DELETE FROM sessions WHERE token_hash = ?', [hash]); },
        async saveState(hash, verifier, expires) { await query('INSERT INTO oauth_states VALUES (?, ?, ?)', [hash, verifier, expires]); },
        async consumeState(hash, now) { return (await query('DELETE FROM oauth_states WHERE state_hash = ? AND expires_at > ? RETURNING verifier', [hash, now]))[0]; },
        async register(userId, eventId, check) {
            return transaction(async q => {
                const event = (await q('SELECT * FROM events WHERE id = ?' + (url ? ' FOR UPDATE' : ''), [eventId]))[0];
                const duplicate = (await q('SELECT id FROM registrations WHERE user_id = ? AND event_id = ?', [userId, eventId]))[0];
                const count = Number((await q('SELECT COUNT(*) AS count FROM registrations WHERE event_id = ?', [eventId]))[0].count);
                check(event, duplicate, count);
                return (await q('INSERT INTO registrations (user_id, event_id) VALUES (?, ?) RETURNING id', [userId, eventId]))[0];
            });
        },
        async registrations(userId) { return query('SELECT r.id AS registrationId, e.id, e.name, e.date, e.place FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.user_id = ? ORDER BY e.date, e.id', [userId]); },
        async getRegistration(id) { return (await query('SELECT * FROM registrations WHERE id = ?', [id]))[0]; },
        async cancelRegistration(id) { await query('DELETE FROM registrations WHERE id = ?', [id]); },
        async promote(email) { return query("UPDATE users SET role = 'organizer' WHERE email = ? RETURNING id", [email]); },
        async health() { await query('SELECT 1'); },
        async close() { if (url) await database.end(); else database.close(); }
    };
}
module.exports = { openStore };
