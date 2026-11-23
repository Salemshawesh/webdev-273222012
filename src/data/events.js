const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const path = require('node:path');

function openEventsDatabase(filename = process.env.DATABASE_PATH || 'campus.sqlite') {
    const db = new DatabaseSync(filename);
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
    const migration = '001-events.sql';
    if (!db.prepare('SELECT name FROM migrations WHERE name = ?').get(migration)) {
        db.exec('BEGIN');
        try {
            db.exec(readFileSync(path.join(__dirname, '../migrations', migration), 'utf8'));
            db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration);
            db.exec('COMMIT');
        } catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }
    return {
        listUpcoming(today) {
            return db.prepare('SELECT id, name, date, place, capacity FROM events WHERE date >= ? ORDER BY date, id').all(today);
        },
        addEvent(event) {
            return db.prepare('INSERT INTO events (name, date, place, capacity) VALUES (?, ?, ?, ?)')
                .run(event.name, event.date, event.place, event.capacity);
        },
        health() { db.prepare('SELECT 1').get(); },
        close() { db.close(); }
    };
}

module.exports = { openEventsDatabase };
