# MeetSync API

MeetSync is a calendar negotiation API built from the ground up for AI agents. Most calendar APIs hand you raw event data and expect a human to reason about availability — MeetSync skips all of that. You give it a list of participants and a meeting duration; it gives you ranked time slots that respect each person's working hours, buffer preferences, and existing commitments. From there, a single proposal-and-confirm loop is all it takes to go from "find a time" to "meeting is on the calendar" — no human back-and-forth, no OAuth redirects, no parsing raw ical feeds.

**MCP server:** `npm install -g mcp-meetsync` — [npmjs.com/package/mcp-meetsync](https://www.npmjs.com/package/mcp-meetsync)

---

## Quickstart — first call in under 5 minutes

### 1. Get an API key

Sign up at [meetsync.dev](https://meetsync.dev) to get an API key. Set it in your environment:

```bash
export MEETSYNC_API_KEY="your-key-here"
export MEETSYNC_BASE_URL="https://api.meetsync.dev/v1"
```

### 2. Register two participants

```bash
# Register Alice
curl -s -X POST "$MEETSYNC_BASE_URL/participants" \
  -H "X-API-Key: $MEETSYNC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Chen","email":"alice@example.com","timezone":"America/Los_Angeles"}' \
  | jq '.id'
# → "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# Register Bob
curl -s -X POST "$MEETSYNC_BASE_URL/participants" \
  -H "X-API-Key: $MEETSYNC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob Tanaka","email":"bob@example.com","timezone":"America/Chicago"}' \
  | jq '.id'
# → "b2c3d4e5-f6a7-8901-bcde-f12345678901"
```

### 3. Find mutual availability

```bash
curl -s -X POST "$MEETSYNC_BASE_URL/availability/query" \
  -H "X-API-Key: $MEETSYNC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "participantIds": [
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "b2c3d4e5-f6a7-8901-bcde-f12345678901"
    ],
    "durationMinutes": 30,
    "startDate": "2025-09-15",
    "endDate": "2025-09-19"
  }' | jq '.slots[0]'
# → { "start": "2025-09-15T10:00:00-07:00", "end": "2025-09-15T10:30:00-07:00", "score": 0.9 }
```

### 4. Book it directly

```bash
curl -s -X POST "$MEETSYNC_BASE_URL/bookings" \
  -H "X-API-Key: $MEETSYNC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Quick sync",
    "organizerParticipantId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "participantIds": [
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "b2c3d4e5-f6a7-8901-bcde-f12345678901"
    ],
    "startTime": "2025-09-15T10:00:00-07:00",
    "endTime":   "2025-09-15T10:30:00-07:00"
  }' | jq '.id'
# → "c3d4e5f6-a7b8-9012-cdef-123456789012"
```

That's the full direct-booking path. For multi-party scheduling with explicit slot voting, see the [Proposals](#proposals) section below.

---

## Authentication

All requests require an `X-API-Key` header:

```
X-API-Key: your-api-key-here
```

Keys are scoped to your account. No OAuth, no redirects — safe for agents to use directly. If the key is missing or invalid, you get a `401`. If the key is valid but lacks permission for the resource, you get a `403`.

---

## Base URL

```
https://api.meetsync.dev/v1
```

---

## Endpoint reference

### Participants

Participants are people whose calendars MeetSync manages. Register everyone before running availability queries or creating proposals.

---

#### `GET /participants` — listParticipants

Returns a paginated list of all participants.

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | No | Filter by exact email address |
| `status` | `active` \| `inactive` | No | Filter by status |
| `page` | integer | No | Page number, 1-based (default: 1) |
| `limit` | integer | No | Results per page, max 100 (default: 20) |

**Response 200**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "alice@example.com",
      "name": "Alice Chen",
      "timezone": "America/Los_Angeles",
      "calendarProvider": "google",
      "status": "active",
      "createdAt": "2025-08-01T10:00:00-07:00",
      "updatedAt": "2025-08-15T14:30:00-07:00"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "hasMore": false }
}
```

---

#### `POST /participants` — createParticipant

Registers a new participant. Returns `409` if the email is already registered.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full name |
| `email` | string | Yes | Unique email address |
| `timezone` | string | No | IANA timezone (default: `UTC`) |
| `calendarProvider` | `google` \| `outlook` \| `ical` \| `none` | No | Calendar integration (default: `none`) |
| `icalUrl` | string | No | iCal feed URL — required when provider is `ical` |

```json
{
  "name": "Alice Chen",
  "email": "alice@example.com",
  "timezone": "America/Los_Angeles",
  "calendarProvider": "google"
}
```

**Response 201**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "email": "alice@example.com",
  "name": "Alice Chen",
  "timezone": "America/Los_Angeles",
  "calendarProvider": "google",
  "status": "active",
  "createdAt": "2025-08-01T10:00:00-07:00",
  "updatedAt": "2025-08-01T10:00:00-07:00"
}
```

---

#### `GET /participants/{participantId}` — getParticipant

Returns a single participant by ID.

**Response 200** — same shape as `createParticipant` 201 above.

---

#### `PATCH /participants/{participantId}` — updateParticipant

Partial update. Only supplied fields are changed.

**Request body** — all fields optional:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Updated full name |
| `email` | string | Updated email |
| `timezone` | string | Updated IANA timezone |
| `calendarProvider` | string | Updated provider |
| `icalUrl` | string | Updated iCal URL |
| `status` | `active` \| `inactive` | Soft-deactivate by setting `inactive` |

**Response 200** — updated participant record.

---

#### `DELETE /participants/{participantId}` — deleteParticipant

Permanently removes a participant. Returns `204` on success.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `force` | boolean | If `true`, cancel active proposals and bookings first (default: `false`) |

Without `force`, returns `409` if the participant has active proposals or confirmed bookings.

---

#### `GET /participants/{participantId}/preferences` — getParticipantPreferences

Returns the participant's scheduling preferences.

**Response 200**
```json
{
  "participantId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "workingHours": {
    "monday":    { "enabled": true,  "start": "09:00", "end": "17:00" },
    "tuesday":   { "enabled": true,  "start": "09:00", "end": "17:00" },
    "wednesday": { "enabled": true,  "start": "09:00", "end": "17:00" },
    "thursday":  { "enabled": true,  "start": "09:00", "end": "17:00" },
    "friday":    { "enabled": true,  "start": "09:00", "end": "17:00" },
    "saturday":  { "enabled": false, "start": "09:00", "end": "17:00" },
    "sunday":    { "enabled": false, "start": "09:00", "end": "17:00" }
  },
  "blackoutWindows": [
    {
      "id": "bw-uuid-here",
      "label": "Lunch",
      "startTime": "12:00",
      "endTime": "13:00",
      "daysOfWeek": ["monday","tuesday","wednesday","thursday","friday"]
    }
  ],
  "bufferMinutes": 15,
  "maxMeetingsPerDay": 6,
  "updatedAt": "2025-08-10T08:00:00-07:00"
}
```

---

#### `PUT /participants/{participantId}/preferences` — setParticipantPreferences

**Full replacement** — fields not included revert to defaults. Call `GET` preferences first if you only want to update one field.

**Request body** — all fields optional except `participantId`:

| Field | Type | Description |
|-------|------|-------------|
| `workingHours` | object | Keys `monday`–`sunday`, each with `{ enabled, start, end }` in `HH:MM` |
| `blackoutWindows` | array | Recurring unavailable blocks: `{ label, startTime, endTime, daysOfWeek }` |
| `bufferMinutes` | integer | Minutes of gap required between meetings (0–120) |
| `maxMeetingsPerDay` | integer | Hard cap on meetings per day (1–20) |

**Response 200** — updated preferences object.

---

### Availability

---

#### `GET /participants/{participantId}/availability` — getParticipantAvailability

Returns free time windows for one participant. For group scheduling, use `POST /availability/query` instead.

**Query parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | date | Yes | `YYYY-MM-DD`, inclusive |
| `endDate` | date | Yes | `YYYY-MM-DD`, inclusive, max 30 days from start |
| `timezone` | string | No | Express results in this timezone (default: participant's timezone) |
| `minDurationMinutes` | integer | No | Exclude windows shorter than this (default: 30) |

**Response 200**
```json
{
  "participantId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "timezone": "America/Los_Angeles",
  "freeWindows": [
    {
      "start": "2025-09-15T09:00:00-07:00",
      "end":   "2025-09-15T12:00:00-07:00",
      "durationMinutes": 180
    },
    {
      "start": "2025-09-15T13:00:00-07:00",
      "end":   "2025-09-15T17:00:00-07:00",
      "durationMinutes": 240
    }
  ]
}
```

---

#### `POST /availability/query` — findMutualAvailability

Finds time slots that work for all participants simultaneously. Returns scored slots sorted by suitability.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `participantIds` | uuid[] | Yes | All participants (minimum 2) |
| `durationMinutes` | integer | Yes | Required meeting length (15–480) |
| `startDate` | date | Yes | Start of search window |
| `endDate` | date | Yes | End of search window (max 30 days from start) |
| `timezone` | string | No | Express slots in this timezone |
| `limit` | integer | No | Max slots to return (default: 5, max: 20) |

```json
{
  "participantIds": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f6a7-8901-bcde-f12345678901"
  ],
  "durationMinutes": 60,
  "startDate": "2025-09-15",
  "endDate": "2025-09-19",
  "timezone": "America/Chicago",
  "limit": 3
}
```

**Response 200**
```json
{
  "slots": [
    {
      "start": "2025-09-15T10:00:00-05:00",
      "end":   "2025-09-15T11:00:00-05:00",
      "score": 0.92,
      "scoreBreakdown": {
        "workingHours": 0.5,
        "bufferFit": 0.27,
        "meetingLoad": 0.15
      }
    },
    {
      "start": "2025-09-16T14:00:00-05:00",
      "end":   "2025-09-16T15:00:00-05:00",
      "score": 0.78,
      "scoreBreakdown": {
        "workingHours": 0.5,
        "bufferFit": 0.18,
        "meetingLoad": 0.10
      }
    }
  ],
  "participantIds": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f6a7-8901-bcde-f12345678901"
  ],
  "durationMinutes": 60
}
```

Pass `slots[n].start` and `slots[n].end` directly as `candidateSlots` in `POST /proposals`.

---

### Proposals

A proposal sends one or more candidate time slots to a group of participants and collects votes before a booking is confirmed. Use this when you want explicit acceptance before locking in a meeting.

---

#### `GET /proposals` — listProposals

Returns paginated proposals filtered by organizer, participant, or status.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `organizerParticipantId` | uuid | Filter to proposals created by this participant |
| `participantId` | uuid | Filter to proposals involving this participant |
| `status` | `pending` \| `accepted` \| `rejected` \| `expired` \| `cancelled` | Filter by status |
| `page` / `limit` | integer | Pagination |

**Response 200**
```json
{
  "data": [
    {
      "id": "d4e5f6a7-b8c9-0123-def0-234567890123",
      "title": "Q4 Planning",
      "status": "pending",
      "organizerParticipantId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "participantIds": ["a1b2c3d4-...", "b2c3d4e5-..."],
      "candidateSlots": [
        { "id": "slot-uuid-1", "start": "2025-09-15T10:00:00-07:00", "end": "2025-09-15T11:00:00-07:00" },
        { "id": "slot-uuid-2", "start": "2025-09-16T14:00:00-07:00", "end": "2025-09-16T15:00:00-07:00" }
      ],
      "responses": [],
      "expiresAt": "2025-09-13T10:00:00-07:00",
      "createdAt": "2025-09-11T10:00:00-07:00"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "hasMore": false }
}
```

---

#### `POST /proposals` — createProposal

Creates a meeting proposal with candidate time slots.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Meeting title |
| `organizerParticipantId` | uuid | Yes | Must be in `participantIds` |
| `participantIds` | uuid[] | Yes | All participants including organizer (min 2) |
| `candidateSlots` | array | Yes | 1–10 slots: `{ start, end }` ISO 8601 with offset |
| `description` | string | No | Meeting agenda or notes |
| `expiresAt` | datetime | No | Proposal expiry (default: 48 hours from creation) |
| `location` | string | No | Physical location |
| `conferenceLink` | string | No | Video call URL |

```json
{
  "title": "Q4 Planning",
  "organizerParticipantId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "participantIds": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f6a7-8901-bcde-f12345678901"
  ],
  "candidateSlots": [
    { "start": "2025-09-15T10:00:00-07:00", "end": "2025-09-15T11:00:00-07:00" },
    { "start": "2025-09-16T14:00:00-07:00", "end": "2025-09-16T15:00:00-07:00" }
  ],
  "expiresAt": "2025-09-13T10:00:00-07:00"
}
```

**Response 201** — proposal object with `status: "pending"` and slot IDs assigned.

---

#### `GET /proposals/{proposalId}` — getProposal

Returns the full proposal, including which participants have responded and (once all accept) the `acceptedSlotId` needed for `createBooking`.

**Response 200**
```json
{
  "id": "d4e5f6a7-b8c9-0123-def0-234567890123",
  "title": "Q4 Planning",
  "status": "accepted",
  "acceptedSlotId": "slot-uuid-1",
  "organizerParticipantId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "participantIds": ["a1b2c3d4-...", "b2c3d4e5-..."],
  "candidateSlots": [
    { "id": "slot-uuid-1", "start": "2025-09-15T10:00:00-07:00", "end": "2025-09-15T11:00:00-07:00" }
  ],
  "responses": [
    { "participantId": "a1b2c3d4-...", "status": "accepted", "preferredSlotId": "slot-uuid-1", "respondedAt": "2025-09-11T11:00:00-07:00" },
    { "participantId": "b2c3d4e5-...", "status": "accepted", "preferredSlotId": "slot-uuid-1", "respondedAt": "2025-09-11T12:30:00-07:00" }
  ],
  "createdAt": "2025-09-11T10:00:00-07:00"
}
```

---

#### `PATCH /proposals/{proposalId}` — cancelProposal

Cancels a pending proposal. The request body must be `{ "status": "cancelled" }`. Only proposals with status `pending` can be cancelled. Returns the updated proposal.

---

#### `POST /proposals/{proposalId}/responses` — respondToProposal

Records one participant's response. Must be called separately for each participant.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `participantId` | uuid | Yes | The responding participant |
| `status` | `accepted` \| `rejected` | Yes | Their response |
| `preferredSlotId` | uuid | No | Their preferred slot (used when accepting) |
| `note` | string | No | Optional message |

```json
{
  "participantId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "status": "accepted",
  "preferredSlotId": "slot-uuid-1"
}
```

**Response 200** — updated proposal. When all participants have accepted the same slot, `status` automatically becomes `"accepted"` and `acceptedSlotId` is set.

---

### Bookings

A booking is a confirmed meeting. Create one from an accepted proposal or directly.

---

#### `GET /bookings` — listBookings

Returns paginated bookings with optional filtering.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `participantId` | uuid | Filter to bookings involving this participant |
| `status` | `confirmed` \| `cancelled` \| `rescheduled` | Filter by status |
| `startAfter` | datetime | Bookings starting after this ISO 8601 datetime |
| `startBefore` | datetime | Bookings starting before this ISO 8601 datetime |
| `page` / `limit` | integer | Pagination |

**Response 200**
```json
{
  "data": [
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "title": "Q4 Planning",
      "status": "confirmed",
      "startTime": "2025-09-15T10:00:00-07:00",
      "endTime":   "2025-09-15T11:00:00-07:00",
      "organizerParticipantId": "a1b2c3d4-...",
      "participantIds": ["a1b2c3d4-...", "b2c3d4e5-..."],
      "proposalId": "d4e5f6a7-...",
      "calendarEventIds": {
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890": "evt_a1b2c3d4_abc123",
        "b2c3d4e5-f6a7-8901-bcde-f12345678901": "evt_b2c3d4e5_def456"
      },
      "createdAt": "2025-09-11T13:00:00-07:00"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "hasMore": false }
}
```

---

#### `POST /bookings` — createBooking

Confirms a meeting. Two modes:

**Mode 1 — Proposal-based** (after an accepted proposal):
```json
{
  "title": "Q4 Planning",
  "proposalId": "d4e5f6a7-b8c9-0123-def0-234567890123",
  "slotId":     "slot-uuid-1"
}
```

**Mode 2 — Direct** (skipping the proposal workflow):
```json
{
  "title": "Quick sync",
  "organizerParticipantId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "participantIds": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f6a7-8901-bcde-f12345678901"
  ],
  "startTime": "2025-09-15T10:00:00-07:00",
  "endTime":   "2025-09-15T10:30:00-07:00"
}
```

In both modes, conflict detection runs automatically. Returns `409` if any participant has an overlapping confirmed booking.

**Response 201** — booking object with `status: "confirmed"` and `calendarEventIds` populated.

---

#### `GET /bookings/{bookingId}` — getBooking

Returns the full booking record including `calendarEventIds`, linked `proposalId`, and participant list.

---

#### `PATCH /bookings/{bookingId}` — rescheduleBooking

Moves a confirmed booking to a new time. Conflict detection runs for all participants.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `startTime` | datetime | Yes | New start — must be in the future |
| `endTime` | datetime | Yes | New end |
| `reason` | string | No | Reason for the change |

**Response 200** — updated booking with `status: "rescheduled"`.

---

#### `DELETE /bookings/{bookingId}` — cancelBooking

Cancels a confirmed booking. Returns `204` on success. Irreversible.

---

## Error codes

All errors follow the same envelope:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description.",
    "details": { }
  }
}
```

| HTTP status | `code` | When you'll see it |
|-------------|--------|--------------------|
| 400 | `BAD_REQUEST` | Malformed JSON, invalid field type, missing required field |
| 401 | `UNAUTHORIZED` | Missing or invalid `X-API-Key` header |
| 403 | `FORBIDDEN` | Valid key but insufficient permission for the resource |
| 404 | `NOT_FOUND` | Resource ID does not exist |
| 409 | `CONFLICT` | Duplicate email on `createParticipant`; overlapping booking on `createBooking` |
| 422 | `UNPROCESSABLE` | Fields are valid types but fail business rules (e.g. `endTime` before `startTime`) |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded — `details.retryAfterSeconds` tells you when to retry |
| 500 | `INTERNAL_ERROR` | Something went wrong on our side — safe to retry after a brief wait |

**Rate limit error example:**
```json
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Rate limit exceeded. Retry after 34 seconds.",
    "details": { "retryAfterSeconds": 34 }
  }
}
```

---

## Rate limits

| Limit | Default |
|-------|---------|
| Requests per minute | 100 |
| Window | 60 seconds, rolling |
| Applies to | All endpoints except `GET /health` |

Rate limit headers are included on every response:

```
RateLimit-Limit: 100
RateLimit-Remaining: 87
RateLimit-Reset: 1694000060
```

When you exceed the limit, you receive a `429` with `details.retryAfterSeconds`. Agents should back off by that duration before retrying.

---

## Further reading

- [MCP server on npm](https://www.npmjs.com/package/mcp-meetsync) — install and run with `npx mcp-meetsync`
- [Agent builder tutorial](./tutorial.md) — full walkthrough for Claude, LangChain, and n8n
- [Tool definitions](./tool-definition.md) — copy-paste Claude JSON, LangChain Python, and n8n snippets
- [OpenAPI spec](../openapi.yaml) — full spec in OpenAPI 3.1
