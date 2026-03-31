# MeetSync Tool Definitions

Copy-paste ready definitions for Claude, LangChain, and n8n.

---

## Example system prompt

Drop this into any agent that should handle scheduling:

```
You have access to MeetSync, a calendar scheduling API. Use it any time the user
wants to schedule, book, reschedule, or cancel a meeting, or asks about someone's
availability.

Important rules:
- Never guess or assume when someone is free. Always call findMutualAvailability.
- Before scheduling anyone, verify they are registered. If not, call createParticipant.
- For multi-party scheduling, call findMutualAvailability to get ranked slots, then
  either book directly (createBooking) or create a proposal for explicit acceptance.
- respondToProposal must be called once per participant — not once per proposal.
- After confirming a booking, call getBooking to verify and report the confirmed time.
- If you get a 429, read retryAfterSeconds from the error and wait before retrying.
```

---

## Claude tool definitions (JSON)

Paste these into the `tools` array of any `messages.create` call. All 19 tools.

```json
[
  {
    "name": "listParticipants",
    "description": "Use when you need to find participants and don't have their UUID yet — e.g. when you only know a name or email. Also use to verify someone is registered before scheduling. If you already have the UUID, use getParticipant instead.",
    "input_schema": {
      "type": "object",
      "properties": {
        "status": { "type": "string", "enum": ["active", "inactive"], "description": "Filter by status" },
        "page":   { "type": "integer", "minimum": 1 },
        "limit":  { "type": "integer", "minimum": 1, "maximum": 100 }
      }
    }
  },
  {
    "name": "createParticipant",
    "description": "Register a new person in MeetSync. Must be called before a participant can appear in proposals, bookings, or availability queries.",
    "input_schema": {
      "type": "object",
      "required": ["name", "email"],
      "properties": {
        "name":             { "type": "string" },
        "email":            { "type": "string", "format": "email" },
        "timezone":         { "type": "string", "description": "IANA timezone, e.g. America/New_York" },
        "calendarProvider": { "type": "string", "enum": ["google", "outlook", "ical", "none"] },
        "icalUrl":          { "type": "string", "format": "uri", "description": "Required when calendarProvider is ical" }
      }
    }
  },
  {
    "name": "getParticipant",
    "description": "Look up a specific participant by UUID. Prerequisite: you must have the UUID from createParticipant or listParticipants. Does not return scheduling preferences — call getParticipantPreferences for that.",
    "input_schema": {
      "type": "object",
      "required": ["participantId"],
      "properties": {
        "participantId": { "type": "string", "format": "uuid" }
      }
    }
  },
  {
    "name": "updateParticipant",
    "description": "Change a participant's name, email, timezone, or calendar provider. Also use to soft-deactivate via status=inactive. Partial update — only supplied fields change.",
    "input_schema": {
      "type": "object",
      "required": ["participantId"],
      "properties": {
        "participantId":    { "type": "string", "format": "uuid" },
        "name":             { "type": "string" },
        "email":            { "type": "string", "format": "email" },
        "timezone":         { "type": "string" },
        "calendarProvider": { "type": "string", "enum": ["google", "outlook", "ical", "none"] },
        "icalUrl":          { "type": "string", "format": "uri" },
        "status":           { "type": "string", "enum": ["active", "inactive"] }
      }
    }
  },
  {
    "name": "deleteParticipant",
    "description": "Permanently and irreversibly erase a participant. Use updateParticipant with status=inactive instead if you just want to stop scheduling them. Fails with 409 if they have active proposals or bookings unless force=true.",
    "input_schema": {
      "type": "object",
      "required": ["participantId"],
      "properties": {
        "participantId": { "type": "string", "format": "uuid" },
        "force": { "type": "boolean", "description": "Cancel active proposals and bookings before deleting" }
      }
    }
  },
  {
    "name": "getParticipantPreferences",
    "description": "Read a participant's scheduling preferences: working hours, blackout windows, buffer time, max meetings per day. Note: getParticipant does not return preferences — you must call this separately. Call this before setParticipantPreferences if only updating some fields.",
    "input_schema": {
      "type": "object",
      "required": ["participantId"],
      "properties": {
        "participantId": { "type": "string", "format": "uuid" }
      }
    }
  },
  {
    "name": "setParticipantPreferences",
    "description": "Set a participant's scheduling preferences. WARNING: full replacement — fields not included revert to defaults. Call getParticipantPreferences first if only changing one field.",
    "input_schema": {
      "type": "object",
      "required": ["participantId"],
      "properties": {
        "participantId": { "type": "string", "format": "uuid" },
        "workingHours": {
          "type": "object",
          "description": "Keys monday–sunday, each: { enabled: boolean, start: HH:MM, end: HH:MM }",
          "properties": {
            "monday":    { "type": "object", "properties": { "enabled": { "type": "boolean" }, "start": { "type": "string" }, "end": { "type": "string" } } },
            "tuesday":   { "type": "object", "properties": { "enabled": { "type": "boolean" }, "start": { "type": "string" }, "end": { "type": "string" } } },
            "wednesday": { "type": "object", "properties": { "enabled": { "type": "boolean" }, "start": { "type": "string" }, "end": { "type": "string" } } },
            "thursday":  { "type": "object", "properties": { "enabled": { "type": "boolean" }, "start": { "type": "string" }, "end": { "type": "string" } } },
            "friday":    { "type": "object", "properties": { "enabled": { "type": "boolean" }, "start": { "type": "string" }, "end": { "type": "string" } } },
            "saturday":  { "type": "object", "properties": { "enabled": { "type": "boolean" }, "start": { "type": "string" }, "end": { "type": "string" } } },
            "sunday":    { "type": "object", "properties": { "enabled": { "type": "boolean" }, "start": { "type": "string" }, "end": { "type": "string" } } }
          }
        },
        "blackoutWindows": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["label", "startTime", "endTime", "daysOfWeek"],
            "properties": {
              "label":      { "type": "string" },
              "startTime":  { "type": "string", "description": "HH:MM" },
              "endTime":    { "type": "string", "description": "HH:MM" },
              "daysOfWeek": { "type": "array", "items": { "type": "string", "enum": ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] } }
            }
          }
        },
        "bufferMinutes":     { "type": "integer", "minimum": 0, "maximum": 120 },
        "maxMeetingsPerDay": { "type": "integer", "minimum": 1, "maximum": 20 }
      }
    }
  },
  {
    "name": "getParticipantAvailability",
    "description": "Find free time windows for exactly one participant. Do not use for group scheduling — call findMutualAvailability for that. Prerequisite: participant UUID from createParticipant or listParticipants.",
    "input_schema": {
      "type": "object",
      "required": ["participantId", "startDate", "endDate"],
      "properties": {
        "participantId":     { "type": "string", "format": "uuid" },
        "startDate":         { "type": "string", "format": "date", "description": "YYYY-MM-DD inclusive" },
        "endDate":           { "type": "string", "format": "date", "description": "YYYY-MM-DD inclusive, max 30 days from startDate" },
        "timezone":          { "type": "string" },
        "minDurationMinutes":{ "type": "integer", "minimum": 15 }
      }
    }
  },
  {
    "name": "findMutualAvailability",
    "description": "Find meeting slots that work for all participants simultaneously. This is the primary scheduling tool — call it before createProposal or createBooking. Prerequisites: all participants must be registered via createParticipant; their UUIDs are required.",
    "input_schema": {
      "type": "object",
      "required": ["participantIds", "durationMinutes", "startDate", "endDate"],
      "properties": {
        "participantIds":  { "type": "array", "items": { "type": "string", "format": "uuid" }, "minItems": 2 },
        "durationMinutes": { "type": "integer", "minimum": 15, "maximum": 480 },
        "startDate":       { "type": "string", "format": "date" },
        "endDate":         { "type": "string", "format": "date" },
        "timezone":        { "type": "string" },
        "limit":           { "type": "integer", "minimum": 1, "maximum": 20 }
      }
    }
  },
  {
    "name": "listProposals",
    "description": "Browse existing proposals. Use when you don't have a specific proposalId yet, or to check status of pending proposals. If you have the ID, use getProposal.",
    "input_schema": {
      "type": "object",
      "properties": {
        "organizerParticipantId": { "type": "string", "format": "uuid" },
        "participantId":          { "type": "string", "format": "uuid" },
        "status": { "type": "string", "enum": ["pending","accepted","rejected","expired","cancelled"] },
        "page":  { "type": "integer" },
        "limit": { "type": "integer" }
      }
    }
  },
  {
    "name": "createProposal",
    "description": "Send candidate time slots to participants for acceptance before confirming a booking. Prerequisites: all participantIds must be registered; organizerParticipantId must be in participantIds. Call findMutualAvailability first to get slots. Each participant must respond via respondToProposal (one call per person).",
    "input_schema": {
      "type": "object",
      "required": ["title", "organizerParticipantId", "participantIds", "candidateSlots"],
      "properties": {
        "title":                  { "type": "string" },
        "description":            { "type": "string" },
        "organizerParticipantId": { "type": "string", "format": "uuid" },
        "participantIds":         { "type": "array", "items": { "type": "string", "format": "uuid" }, "minItems": 2 },
        "candidateSlots": {
          "type": "array",
          "minItems": 1,
          "maxItems": 10,
          "items": {
            "type": "object",
            "required": ["start", "end"],
            "properties": {
              "start": { "type": "string", "format": "date-time" },
              "end":   { "type": "string", "format": "date-time" }
            }
          }
        },
        "expiresAt":     { "type": "string", "format": "date-time" },
        "location":      { "type": "string" },
        "conferenceLink":{ "type": "string", "format": "uri" }
      }
    }
  },
  {
    "name": "getProposal",
    "description": "Inspect a specific proposal: check status, see who has responded, and retrieve the acceptedSlotId you need for createBooking. If you don't have the proposalId, call listProposals first.",
    "input_schema": {
      "type": "object",
      "required": ["proposalId"],
      "properties": {
        "proposalId": { "type": "string", "format": "uuid" }
      }
    }
  },
  {
    "name": "cancelProposal",
    "description": "Withdraw an entire proposal for all participants. Only pending proposals can be cancelled. To decline on behalf of one participant (not cancel for everyone), use respondToProposal with status=rejected instead.",
    "input_schema": {
      "type": "object",
      "required": ["proposalId"],
      "properties": {
        "proposalId": { "type": "string", "format": "uuid" }
      }
    }
  },
  {
    "name": "respondToProposal",
    "description": "Record one participant's accept/reject response. Must be called separately for each participant — a proposal with N participants requires N calls. Call getProposal first to see who hasn't responded yet. When all accept, the proposal becomes accepted and createBooking can be called.",
    "input_schema": {
      "type": "object",
      "required": ["proposalId", "participantId", "status"],
      "properties": {
        "proposalId":      { "type": "string", "format": "uuid" },
        "participantId":   { "type": "string", "format": "uuid" },
        "status":          { "type": "string", "enum": ["accepted", "rejected"] },
        "preferredSlotId": { "type": "string", "format": "uuid" },
        "note":            { "type": "string" }
      }
    }
  },
  {
    "name": "listBookings",
    "description": "Retrieve confirmed, cancelled, or rescheduled meetings. Filter by participant, status, or time range. Use to find a bookingId before rescheduling or cancelling.",
    "input_schema": {
      "type": "object",
      "properties": {
        "participantId": { "type": "string", "format": "uuid" },
        "status":        { "type": "string", "enum": ["confirmed","cancelled","rescheduled"] },
        "startAfter":    { "type": "string", "format": "date-time" },
        "startBefore":   { "type": "string", "format": "date-time" },
        "page":          { "type": "integer" },
        "limit":         { "type": "integer" }
      }
    }
  },
  {
    "name": "createBooking",
    "description": "Confirm a meeting. MODE 1 (proposal-based): call getProposal to get acceptedSlotId, then pass proposalId + slotId. MODE 2 (direct): provide organizerParticipantId, participantIds, startTime, endTime. Use Mode 1 after a proposal workflow, Mode 2 when the time is already agreed. Conflict detection runs automatically.",
    "input_schema": {
      "type": "object",
      "required": ["title"],
      "properties": {
        "title":                  { "type": "string" },
        "description":            { "type": "string" },
        "proposalId":             { "type": "string", "format": "uuid", "description": "Mode 1: UUID of accepted proposal" },
        "slotId":                 { "type": "string", "format": "uuid", "description": "Mode 1: acceptedSlotId from getProposal" },
        "organizerParticipantId": { "type": "string", "format": "uuid", "description": "Mode 2: organizer UUID" },
        "participantIds":         { "type": "array", "items": { "type": "string", "format": "uuid" }, "description": "Mode 2: all participant UUIDs" },
        "startTime":              { "type": "string", "format": "date-time", "description": "Mode 2: ISO 8601 with offset" },
        "endTime":                { "type": "string", "format": "date-time", "description": "Mode 2: ISO 8601 with offset" },
        "timezone":               { "type": "string" },
        "location":               { "type": "string" },
        "conferenceLink":         { "type": "string", "format": "uri" }
      }
    }
  },
  {
    "name": "getBooking",
    "description": "Retrieve full booking details — status, participants, start/end times, calendar event IDs, and linked proposal. Use after createBooking to confirm success.",
    "input_schema": {
      "type": "object",
      "required": ["bookingId"],
      "properties": {
        "bookingId": { "type": "string", "format": "uuid" }
      }
    }
  },
  {
    "name": "rescheduleBooking",
    "description": "Move a confirmed booking to a new time. New startTime must be in the future. Conflict detection runs automatically. Only confirmed bookings can be rescheduled.",
    "input_schema": {
      "type": "object",
      "required": ["bookingId", "startTime", "endTime"],
      "properties": {
        "bookingId": { "type": "string", "format": "uuid" },
        "startTime": { "type": "string", "format": "date-time", "description": "Must be in the future" },
        "endTime":   { "type": "string", "format": "date-time" },
        "reason":    { "type": "string" }
      }
    }
  },
  {
    "name": "cancelBooking",
    "description": "Permanently cancel a confirmed meeting for all participants. Irreversible — use rescheduleBooking if you want to change the time instead. Only confirmed bookings can be cancelled.",
    "input_schema": {
      "type": "object",
      "required": ["bookingId"],
      "properties": {
        "bookingId": { "type": "string", "format": "uuid" }
      }
    }
  }
]
```

---

## LangChain tool definitions (Python)

The 5 most commonly used tools, ready to drop into any LangChain agent.

```python
import os
import requests
from langchain_core.tools import tool

MEETSYNC_BASE = os.environ["MEETSYNC_API_URL"]  # https://api.meetsync.dev
MEETSYNC_KEY  = os.environ["MEETSYNC_API_KEY"]

def _call(method: str, path: str, body: dict = None) -> dict:
    r = requests.request(
        method,
        f"{MEETSYNC_BASE}/v1{path}",
        headers={"X-API-Key": MEETSYNC_KEY, "Content-Type": "application/json"},
        json=body,
        timeout=30,
    )
    return r.json()


@tool
def create_participant(name: str, email: str, timezone: str = "UTC") -> dict:
    """
    Register a new person in MeetSync. Must be called before they can be scheduled.
    Returns the participant record including their UUID — store it for subsequent calls.

    Args:
        name: Full name of the person.
        email: Email address (must be unique across participants).
        timezone: IANA timezone identifier, e.g. 'America/New_York'. Defaults to UTC.
    """
    return _call("POST", "/participants", {
        "name": name, "email": email, "timezone": timezone
    })


@tool
def find_mutual_availability(
    participant_ids: list[str],
    duration_minutes: int,
    start_date: str,
    end_date: str,
    limit: int = 5,
) -> dict:
    """
    Find meeting slots that work for all listed participants simultaneously.
    Call this before createProposal or createBooking — never guess availability.
    All participants must already be registered (participant_ids are UUIDs).

    Args:
        participant_ids: List of participant UUIDs (min 2).
        duration_minutes: Required meeting length in minutes (15–480).
        start_date: Start of search window, YYYY-MM-DD.
        end_date: End of search window, YYYY-MM-DD (max 30 days from start_date).
        limit: Max number of slots to return (default 5, max 20).
    """
    return _call("POST", "/availability/query", {
        "participantIds": participant_ids,
        "durationMinutes": duration_minutes,
        "startDate": start_date,
        "endDate": end_date,
        "limit": limit,
    })


@tool
def create_proposal(
    title: str,
    organizer_participant_id: str,
    participant_ids: list[str],
    candidate_slots: list[dict],
    expires_at: str = None,
) -> dict:
    """
    Send candidate meeting times to a group for acceptance before booking.
    All participants must be registered. organizer_participant_id must be in participant_ids.
    Call find_mutual_availability first to get scored candidate slots.

    Args:
        title: Meeting title.
        organizer_participant_id: UUID of the participant organizing the meeting.
        participant_ids: All participant UUIDs including organizer (min 2).
        candidate_slots: List of dicts with 'start' and 'end' ISO 8601 datetimes (1–10 slots).
        expires_at: Optional ISO 8601 datetime when the proposal expires.
    """
    body = {
        "title": title,
        "organizerParticipantId": organizer_participant_id,
        "participantIds": participant_ids,
        "candidateSlots": candidate_slots,
    }
    if expires_at:
        body["expiresAt"] = expires_at
    return _call("POST", "/proposals", body)


@tool
def respond_to_proposal(
    proposal_id: str,
    participant_id: str,
    status: str,
    preferred_slot_id: str = None,
    note: str = None,
) -> dict:
    """
    Record one participant's response to a proposal.
    IMPORTANT: Must be called once per participant. A 3-person proposal requires 3 calls.
    Call get_proposal first to see who hasn't responded yet (check the responses array).

    Args:
        proposal_id: UUID of the proposal.
        participant_id: UUID of the participant responding.
        status: 'accepted' or 'rejected'.
        preferred_slot_id: UUID of their preferred slot (optional, used when accepting).
        note: Optional message with the response.
    """
    body: dict = {
        "participantId": participant_id,
        "status": status,
    }
    if preferred_slot_id:
        body["preferredSlotId"] = preferred_slot_id
    if note:
        body["note"] = note
    return _call("POST", f"/proposals/{proposal_id}/responses", body)


@tool
def create_booking(
    title: str,
    proposal_id: str = None,
    slot_id: str = None,
    organizer_participant_id: str = None,
    participant_ids: list[str] = None,
    start_time: str = None,
    end_time: str = None,
) -> dict:
    """
    Confirm a meeting booking.

    Mode 1 (proposal-based): Use after a proposal is accepted. Get the acceptedSlotId
    from get_proposal, then pass proposal_id + slot_id.

    Mode 2 (direct): Use when you already know the time. Pass organizer_participant_id,
    participant_ids, start_time, and end_time.

    Conflict detection runs automatically in both modes.

    Args:
        title: Meeting title.
        proposal_id: (Mode 1) UUID of the accepted proposal.
        slot_id: (Mode 1) acceptedSlotId from get_proposal.
        organizer_participant_id: (Mode 2) Organizer UUID.
        participant_ids: (Mode 2) All participant UUIDs.
        start_time: (Mode 2) ISO 8601 datetime with timezone offset.
        end_time: (Mode 2) ISO 8601 datetime with timezone offset.
    """
    body: dict = {"title": title}
    if proposal_id:
        body["proposalId"] = proposal_id
    if slot_id:
        body["slotId"] = slot_id
    if organizer_participant_id:
        body["organizerParticipantId"] = organizer_participant_id
    if participant_ids:
        body["participantIds"] = participant_ids
    if start_time:
        body["startTime"] = start_time
    if end_time:
        body["endTime"] = end_time
    return _call("POST", "/bookings", body)


# Assemble into a list to pass to your agent
MEETSYNC_TOOLS = [
    create_participant,
    find_mutual_availability,
    create_proposal,
    respond_to_proposal,
    create_booking,
]
```

Usage with LangChain:

```python
from langchain_anthropic import ChatAnthropic
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

llm    = ChatAnthropic(model="claude-sonnet-4-6")
prompt = ChatPromptTemplate.from_messages([
    ("system", "You have MeetSync scheduling tools. Never guess availability. {agent_scratchpad}"),
    ("human", "{input}"),
])

agent          = create_tool_calling_agent(llm, MEETSYNC_TOOLS, prompt)
agent_executor = AgentExecutor(agent=agent, tools=MEETSYNC_TOOLS, verbose=True)

result = agent_executor.invoke({"input": "Book a 30-min call with alice@example.com and bob@example.com next Monday."})
print(result["output"])
```

---

## n8n HTTP node configuration

### findMutualAvailability — find open slots

Set up an **HTTP Request** node with these settings:

| Setting | Value |
|---------|-------|
| Method | `POST` |
| URL | `https://api.meetsync.dev/v1/availability/query` |
| Authentication | Header Auth |
| Header name | `X-API-Key` |
| Header value | `{{ $env.MEETSYNC_API_KEY }}` |
| Body Content Type | `JSON` |

**JSON body** (using n8n expressions):
```json
{
  "participantIds": {{ $json.participantIds }},
  "durationMinutes": {{ $json.durationMinutes }},
  "startDate": "{{ $json.startDate }}",
  "endDate": "{{ $json.endDate }}",
  "limit": 5
}
```

**Output:** The node returns a `slots` array. Wire the first slot's `start` and `end` into the next node.

---

### createBooking — confirm a meeting

Set up a second **HTTP Request** node after `findMutualAvailability`:

| Setting | Value |
|---------|-------|
| Method | `POST` |
| URL | `https://api.meetsync.dev/v1/bookings` |
| Authentication | Header Auth |
| Header name | `X-API-Key` |
| Header value | `{{ $env.MEETSYNC_API_KEY }}` |
| Body Content Type | `JSON` |

**JSON body:**
```json
{
  "title": "{{ $json.meetingTitle }}",
  "organizerParticipantId": "{{ $json.organizerParticipantId }}",
  "participantIds": {{ $json.participantIds }},
  "startTime": "{{ $node['findMutualAvailability'].json.slots[0].start }}",
  "endTime":   "{{ $node['findMutualAvailability'].json.slots[0].end }}"
}
```

**Complete n8n workflow (JSON — import directly):**

```json
{
  "name": "MeetSync — Book a meeting",
  "nodes": [
    {
      "name": "Trigger",
      "type": "n8n-nodes-base.manualTrigger",
      "position": [250, 300],
      "parameters": {}
    },
    {
      "name": "Set inputs",
      "type": "n8n-nodes-base.set",
      "position": [450, 300],
      "parameters": {
        "values": {
          "string": [
            { "name": "meetingTitle",          "value": "Weekly sync" },
            { "name": "startDate",             "value": "2025-09-22" },
            { "name": "endDate",               "value": "2025-09-26" },
            { "name": "organizerParticipantId","value": "YOUR-ORGANIZER-UUID" }
          ],
          "number": [
            { "name": "durationMinutes", "value": 30 }
          ],
          "array": [
            { "name": "participantIds", "value": ["UUID-1", "UUID-2"] }
          ]
        }
      }
    },
    {
      "name": "findMutualAvailability",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 300],
      "parameters": {
        "method": "POST",
        "url": "https://api.meetsync.dev/v1/availability/query",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "jsonParameters": true,
        "bodyParametersJson": "={\"participantIds\":{{$json.participantIds}},\"durationMinutes\":{{$json.durationMinutes}},\"startDate\":\"{{$json.startDate}}\",\"endDate\":\"{{$json.endDate}}\",\"limit\":5}"
      }
    },
    {
      "name": "createBooking",
      "type": "n8n-nodes-base.httpRequest",
      "position": [850, 300],
      "parameters": {
        "method": "POST",
        "url": "https://api.meetsync.dev/v1/bookings",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "jsonParameters": true,
        "bodyParametersJson": "={\"title\":\"{{$node['Set inputs'].json.meetingTitle}}\",\"organizerParticipantId\":\"{{$node['Set inputs'].json.organizerParticipantId}}\",\"participantIds\":{{$node['Set inputs'].json.participantIds}},\"startTime\":\"{{$json.slots[0].start}}\",\"endTime\":\"{{$json.slots[0].end}}\"}"
      }
    }
  ],
  "connections": {
    "Trigger": { "main": [[{ "node": "Set inputs", "type": "main", "index": 0 }]] },
    "Set inputs": { "main": [[{ "node": "findMutualAvailability", "type": "main", "index": 0 }]] },
    "findMutualAvailability": { "main": [[{ "node": "createBooking", "type": "main", "index": 0 }]] }
  }
}
```

To use this workflow: paste the JSON into n8n via **Import from JSON**, add your `MEETSYNC_API_KEY` credential under **HTTP Header Auth**, and replace the UUID placeholders in the "Set inputs" node.

---

## Links

- [npm package](https://www.npmjs.com/package/mcp-meetsync) — `npx mcp-meetsync`
- [API reference](./README.md) — full endpoint docs
- [Agent builder tutorial](./tutorial.md) — worked examples for Claude, LangChain, n8n
