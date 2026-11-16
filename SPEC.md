
# Campus Club Events

<!-- Exercise 2. Project specification. -->

## Project option

Club events.

## Goals

- Build a website where students can see upcoming university club events.
- Allow students to create an account, sign in, and register for events.
- Allow organizers to create and manage events.
- Use Gemini to suggest events based on student interests.

## Non-goals

- No online payments or ticket selling.
- No live video streaming.
- No separate Android or iOS mobile app.
- No social media chat system.

## Constraints

- The website must work on desktop and mobile browsers.
- The backend will use Node.js and Express.
- User accounts and events will be saved in a database.
- Passwords must be hashed and never stored as plain text.
- API keys and passwords must not be uploaded to GitHub.
- MCP tools and HTTP routes must use the same service functions.

## The model feature

- Model: Google Gemini Flash-Lite, using text input and output.
- Input: Student interests and information about upcoming events.
- Output: Up to three suggested events with short explanations.
- When it fails: If Gemini times out, is rate-limited, or returns incorrect information, show upcoming events sorted by date as a fallback. Only events that actually exist in the database may be suggested.

## Auth

- Local: Students can register and sign in using email and a hashed password.
- Provider: Google OAuth will also allow students to sign in using Google.
- Linking: Accounts using the same verified email can be linked after verification, so one student does not get two separate accounts.

## MCP tools

| Tool | What it does | Who may call it |
|---|---|---|
| list_events | Reads the database and returns upcoming events with their dates and available places. | Everyone |
| get_event | Returns detailed information about a selected event using its ID. | Everyone |
| register_event | Registers a student for an event after checking their identity and available places. | Signed-in students |

These tools must use the same service functions and authorization rules as the website's HTTP API.

## UI

Stack: HTML, CSS, JavaScript, Node.js, and Express.

Screens:
- Login and registration page.
- Upcoming events page.
- Event details and registration page.
- My registrations page.
- Organizer event management page.

The website should be responsive and support keyboard navigation, readable text, and clear error messages.

## Architecture

The application will have separate routes, services, and database access files.

HTTP routes and MCP tools will both call the same service layer. The service layer will contain the business rules, and only the data layer will access the database.

The exact file-by-file request trace will be documented in Exercise 3 after implementation.

## Acceptance criteria

### Slice 1: sign-in and event listing

- [AC-1] A student can register with a valid email and password. The account is saved in the database with a hashed password.
- [AC-2] A student can sign in with correct credentials. Incorrect credentials show an error and do not create a signed-in session.
- [AC-3] A visitor can see upcoming events from the database, including their titles, dates, and locations.

### Later features

- [AC-4] A student can sign in using Google and link the Google identity to an existing account after email verification.
- [AC-5] A signed-in student can register for an event with available places, and the registration is saved in the database.
- [AC-6] A student cannot register twice for the same event or register for an event that is already full.
- [AC-7] An organizer can create an event, while a normal student cannot create one and receives a forbidden response.
- [AC-8] A student can see their own event registrations but cannot access another student's private registrations.
- [AC-9] A student can request Gemini event suggestions. If Gemini fails, upcoming events are still displayed using the fallback.
- [AC-10] MCP event registration follows the same permissions and capacity rules as registration through the website.

## Traceability

The automated tests will be added alongside the implementation in Exercises 2 and 3. Each test will include the relevant AC number.

| Criterion | Test |
|---|---|
| AC-1 | Pending implementation |
| AC-2 | Pending implementation |
| AC-3 | Pending implementation |
| AC-4 to AC-10 | Pending later features |

## Spec vs result

The first slice has not been implemented yet. After building the login and event listing, I will record which acceptance criteria passed, what the agent missed, and any changes I made to the specification.
