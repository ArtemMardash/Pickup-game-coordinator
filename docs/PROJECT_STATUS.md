# Pickup Game Coordinator: project status

Last updated: 2026-11-10. Based on the project plan (Google Doc), the code on
`main`, and the checks listed in section 7.

This file answers three questions: how does it work today, what is done, and
what is left. Setup and run commands live in [README.md](../README.md) and
[backend/README.md](../backend/README.md); the full endpoint reference is
[src/lib/endpoints.ts](../src/lib/endpoints.ts).

---

## 1. How it runs

| Part | Tech | Where | Notes |
| --- | --- | --- | --- |
| Database | PostgreSQL 17 in Docker | `backend/docker-compose.yml`, `127.0.0.1:5432` | Needs Docker Desktop running |
| Backend | FastAPI + SQLAlchemy + Alembic | `backend/`, http://localhost:8000 | API docs at `/docs` |
| Frontend | React + Vite + TypeScript | repo root, http://localhost:5173 | Calls the backend; CORS allows port 5173 |

Secrets (`DB_PASSWORD`, `JWT_SECRET_KEY`) are never stored in the repo. Each
developer generates their own into the gitignored `backend/.env`.

Work split: BE1 owns accounts (`models/user.py`, `routers/auth.py`,
`routers/users.py`, `deps.py`, `services/email.py`, `services/geocode.py`);
BE2 owns games (`models/game.py`, `routers/games.py`, `schemas/game.py`).

---

## 2. How it works today

### 2.1 Accounts and sign-in

1. **Register** (`POST /api/auth/register`): username (3-50 chars), email,
   password (8+ chars, at most 72 bytes). Usernames and emails are unique,
   ignoring case. Passwords are hashed with bcrypt. Registering does not sign
   you in.
2. **Log in** (`POST /api/auth/login`): returns a signed token (JWT) valid for
   30 minutes by default (`ACCESS_TOKEN_EXPIRE_MINUTES`).
3. The frontend saves the token in the browser (`localStorage`, key
   `pickup.auth`) and sends it as `Authorization: Bearer <token>` on every
   request. After registering it logs in automatically.
4. Any `401` from the server signs the user out in the UI. Logging out clears
   the token in the browser; the server does not revoke tokens, so an old token
   stays valid until it expires.
5. **Profile** (`GET` / `PATCH /api/users/me`): change email and the
   `notify_non_critical` preference. Backend only; there is no profile screen.

### 2.2 Games

A game is a post made by one user, the **organizer**. The organizer is added
to the player list automatically and counts toward `capacity`.

Rules the server enforces (the browser only mirrors them):

| Rule | Detail |
| --- | --- |
| Who can do what | Anyone signed in can browse, create, join, leave. Only the organizer can edit, delete, or remove another player |
| Length | End after start, at most 6 hours |
| Not ended | `end_time` must be in the future |
| Timezone | Times must include a timezone offset |
| Capacity | 1 to 1000, includes the organizer, can never go below the players already joined |
| Skill level | `beginner`, `intermediate`, `advanced` |
| Last spot | Joining locks the game row in the database, so when two people tap Join for the last spot exactly one gets in |
| Organizer can't leave | They end the game by deleting it |
| Ended games | Never returned by the API; deleted with their player list the next time the list is loaded |
| Editing location | If `location` changes without new coordinates, the old coordinates are cleared so a pin never points at the wrong place |

Fields: title, game_name (the sport), start_time, end_time, location, skill_level,
capacity are required. language (default English), is_online, latitude, longitude,
description, equipment_notes and tags are optional.

### 2.3 Finding games (list, filters, sort)

`GET /api/games` is the one query behind the list and the map. Every selected
filter must match; repeating a parameter means "any of these".

- **Filters:** `game_name`, `skill_level`, `language`, `q` (text inside the
  location), `lat` + `lng` + `radius_km` (distance, all three together),
  `is_online`, `has_spots`, `joined` (only games I am on).
- **Sort:** `start_time` (default, soonest first), `game_name` (A-Z),
  `skill_level` (lowest first). Ties are broken by start time, then id, so list
  and map always show the same order.
- **Paging:** `limit` (default 50, max 200) and `offset`; the response includes
  `total`.
- **Used by the frontend today:** sport, skill level, language, sort, and the
  location filter. `has_spots`, `q` and `is_online` exist on the server but have
  no control in the UI.

### 2.4 Errors

- Games endpoints: `{"detail": {"status": "error", "reason": "gameFull", "message": "..."}}`.
  Reasons: `gameNotFound` 404, `gameTerminated` 410, `notOrganizer` 403,
  `invalidGameDetails` / `invalidFilter` 422, `gameFull`, `alreadyJoined`,
  `notJoined`, `organizerCannotLeave` 409.
- Account endpoints: `{"detail": "Email is already in use"}` (plain text).
- Invalid input anywhere: `422` with a list of problems.
- The frontend turns all three shapes into one message (`describeApiError`).

### 2.5 The frontend

- `AuthGate` shows sign-in / sign-up until you are signed in.
- Two tabs. **Explore** lists games hosted by *other* people (including ones you
  have joined, marked as joined), with the filter bar. **My Games** lists only
  the games *you host*, with edit and delete, and no filter bar. Your own game
  does not appear in Explore. There is no separate view for "games I joined";
  they stay in Explore with a joined mark.
- Clicking a card opens the **game detail** view: details, player list, and a
  button that changes with your role: Join, Leave, Full, or Delete (organizer).
- **Create / edit** is one modal (`GameModal`). It checks the same limits as the
  server before sending.
- Deleting asks for confirmation on the card.
- Data comes from `src/state/useGames.ts`; all paths and types from
  `src/lib/endpoints.ts`.
- Map and location features (Google Maps pins, previews, address search,
  location filter) are built but need `VITE_GOOGLE_MAPS_API_KEY`. Without a key
  the map shows a placeholder. Planned as v2.

---

## 3. Status against the plan

| Milestone | Backend | Frontend | Overall |
| --- | --- | --- | --- |
| M1 Discover games (list, map, preview, area search) | Done (filters, `lat`/`lng`/radius, coordinates stored) | List and detail done; map built but needs a key and is v2 | Mostly done |
| M2 Accounts (register, login, profile, permissions) | Done, except temporary lockout (see section 4) | Sign-in/up done; no profile screen | Mostly done |
| M3 Post and join (create, edit, cancel, roster, last-spot) | Done and tested | Create, edit, delete, join, leave done; organizer cannot remove a player from the UI | Mostly done |
| M4 Filter and sort | Done | Done | Done |
| M5 Email notifications | Not started | n/a | Not started (v2) |
| Final week: end-to-end testing, demo build | n/a | n/a | Not started |

---

## 4. What is left

Ordered by what to do first. Items 1-4 come from the latest review.

### 1. Games must not start in the past (backend + form)

- **Now:** only `end_time` must be in the future, so a game that already
  started can be posted (the server calls it `active`).
- **Change:** on create, require `start_time` to be at or after "now" (allow a
  small grace of about a minute so a game posted for "now" is not rejected by
  clock drift). On edit, only check `start_time` when it is being changed, so an
  organizer can still fix the title of a game that is already underway.
- **Also:** the form should block past start times (a `min` on the date picker
  plus a clear message), mirroring the server.
- **Side effects:** the test `test_create_game_starts_active_when_already_started`
  and the `active` status need rethinking. After this change `active` only
  describes games that started after being posted.
- **Open question:** may an organizer move an existing game's start time into the
  past? Suggest no.

### 2. Location tied to a real place (v2)

- **Now:** `location` is free text. The browser geocodes it (when a Google key
  is set) and sends latitude and longitude. If geocoding fails, the post still
  saves, just without a pin. Nothing checks that the address is real.
- **Wanted:** the user picks a specific place from Google's suggestions, and the
  post stores it.
- **Suggested:** store the place's formatted address and its Google place id
  next to the coordinates; require coordinates for in-person games (reject a post
  that has none); keep `is_online` games exempt. Decide whether geocoding is
  re-checked on the server (needs a server-side key and `services/geocode.py`)
  or trusted from the browser. The browser route is already built.
- **Needs:** a Google Maps key with HTTP-referrer restrictions.

### 3. Emails to players (v2)

Nothing exists yet: no `services/email.py`, no SMTP settings, no retry queue.
Editing or cancelling a game notifies nobody.

- **Who gets what:** players on the roster, except the organizer, for
  cancellation, time change and location change. These are *critical*: they are
  sent even if the player turned off `notify_non_critical`.
  `participant_update` (someone joined or left) is non-critical and respects the
  opt-out.
- **How:** one `send_email()` function, called in the background so requests
  never wait. A real Gmail SMTP sender, and a fake sender for tests.
- **Retries:** critical emails retry for up to 1 hour (`email_jobs` table in
  the plan).
- **Where it plugs in:** `PATCH /api/games/{id}` (time or location changed) and
  `DELETE /api/games/{id}` (the roster must be read *before* the delete).
- **Needs:** a dedicated Gmail account with an app password (Gmail SMTP limit is
  about 500 recipients a day); new env vars for it.

### 4. Create-game form UX (frontend)

What exists: the form uses the browser's `datetime-local` inputs. When a start
is picked and the end is still empty, the end is filled with start + 1 hour.
Language is a single-choice list (English, Spanish, Mandarin, French,
Portuguese, Other).

Planned improvements (my reading of the feedback; confirm the "timer" point):

- **Date and time picking.** "The timer is not good" is read as the native
  date-time picker being awkward. Options: separate date and time fields with
  15-minute steps, a small custom picker, or quick presets ("Today 6 PM",
  "Tomorrow 10 AM"). Default the start to the next round hour.
- **End follows start.** The end is only auto-set when it is empty. Make it
  follow the start (start + 1 hour) every time the start changes, until the user
  edits the end themselves; after that, leave their value alone. Keep the 6-hour
  limit message friendly.
- **Show the length.** Display "2 h" between the two times so a wrong date is
  obvious.
- **Languages.** Today a game has exactly one language, matching the plan's
  example. Multiple languages would change the database (a list instead of a
  single value), the filter (match any overlap) and the cards. Recommendation:
  keep one language for the MVP, but let "Other" take a typed value. Needs a
  decision.
- **Smaller wins:** remember the last sport, skill level and capacity; warn
  before closing a half-filled form.
- **Own games hidden in Explore.** Intentional (see section 2.5), but it can
  confuse a new organizer who just posted a game and does not see it in Explore.
  Consider a short "Posted! View it under My Games" message after creating.

### 5. Gaps found while reviewing (not on the list above)

- **Organizer cannot remove a player in the UI.** The endpoint exists
  (`DELETE /api/games/{id}/participants/{user_id}`); the detail view has no
  button. The plan requires it.
- **No profile screen** (wireframe A.6): email and notification preference have
  an API but no page.
- **No temporary lockout** after repeated failed sign-ins. The plan lists it
  under M2 "Security"; BE1's README excludes it from the MVP. Decide: build it or
  record it as cut.
- **Ended games are deleted lazily**, only when someone loads the list. Until
  then their rosters stay in the database. A background cleanup would match the
  plan's "removed immediately" more strictly.
- **Roster is visible to every signed-in user** (usernames only, no emails). The
  plan's data table says "users in the game". Decide which.
- **Sessions:** tokens last 30 minutes and there is no refresh; users are signed
  out after that. Fine for a demo, probably annoying in real use.
- **HTTPS** for deployment (plan M2) is not set up; local development uses
  plain HTTP.
- **No CI.** Tests only run when someone runs them by hand.
- **Frontend lint warnings** (3, in `PlaceInput.tsx` and `GameMap.tsx`) from the
  map PR.

### 6. Final stretch

End-to-end test of the full flow in a browser on phone and desktop, a demo build,
and a deployment plan (hosting, HTTPS, production database, real secrets).

---

## 5. Behaviors worth knowing

- Call `/api/games` without a trailing slash: the server redirects it and
  browsers drop the `Authorization` header on the redirect.
- Game ids are numbers; user ids are UUIDs.
- `capacity` includes the organizer; `players_joined` includes the organizer.
- The frontend sends times as UTC (`toISOString()`), which the server accepts.
- Changing `location` without sending coordinates clears the old coordinates.
  The frontend already re-geocodes on edit to avoid losing a pin.
- Tests run against your local development database. Normal tests roll back;
  the concurrency test commits real rows and removes them afterwards.
- Both dev servers (`npm run dev` and `fastapi dev`) reload automatically when
  you change files.
- Because Explore hides your own games, test the join flow with two accounts:
  one creates the game (see it under My Games), the other finds it in Explore.

---

## 6. Ownership map

```
backend/app/
  models/user.py        BE1      models/game.py        BE2
  routers/auth.py       BE1      routers/games.py      BE2
  routers/users.py      BE1      schemas/game.py       BE2
  deps.py               BE1      services/email.py     BE1 (not written yet)
  security.py           BE1      services/geocode.py   BE1 (not written yet)
  main.py               BE1 (BE2 registers the games router)
src/lib/endpoints.ts    API reference for the frontend (keep in sync with backend)
```

---

## 7. How this was verified

- **Automated:** 104 backend tests (64 for games, the rest for accounts) against
  a real PostgreSQL in Docker. They cover permissions, every filter and sort,
  limits, join/leave rules, and a threaded test where 6 people grab the last spot
  at once (checked to fail if the row lock is removed).
- **Live run:** register, log in, create, filter, join, full-game rejection,
  non-organizer edit rejection and delete, all over real HTTP against the
  running server.
- **Browser requests:** CORS preflight for PATCH and DELETE with the
  `Authorization` header from `http://localhost:5173`; other origins get no
  access.
- **Frontend:** `npm run build` and `npm run lint` pass on `main` after the
  stray-file fix (3 lint warnings remain).
- **Not verified:** a full manual click-through in the browser with two
  accounts; the Google map, pins and geocoding (no key yet); heavy load; email.
