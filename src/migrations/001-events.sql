CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    place TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0)
);
