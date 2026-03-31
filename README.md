# mcp-meetsync

MCP server for **MeetSync** — a calendar negotiation API built for AI agents.

Exposes all 19 MeetSync endpoints as MCP tools so any MCP-compatible LLM can autonomously find availability, propose meeting times, and confirm bookings — no human back-and-forth required.

---

## Installation

```bash
npm install -g mcp-meetsync
```

Or run directly with npx:

```bash
npx mcp-meetsync
```

---

## Configuration

The server reads two environment variables:

| Variable           | Required | Default                  | Description                          |
|--------------------|----------|--------------------------|--------------------------------------|
| `MEETSYNC_API_URL` | No       | `http://localhost:3000`  | Base URL of your MeetSync API        |
| `MEETSYNC_API_KEY` | Yes      | —                        | API key sent in `X-API-Key` header   |

Copy `.env.example` to `.env` and fill in your values, or pass them directly in the Claude tool definition.

---

## Adding to Claude

Paste this snippet into your Claude desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "meetsync": {
      "command": "npx",
      "args": ["-y", "mcp-meetsync"],
      "env": {
        "MEETSYNC_API_URL": "https://api.yourmeetsync.com",
        "MEETSYNC_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

After saving, restart Claude. The 19 MeetSync tools will appear in Claude's tool list.

---

## Tools

All 19 MeetSync operationIds are exposed as tools. Tool names match operationIds exactly.

### Participants (7 tools)

| Tool                       | When to use                                                       |
|----------------------------|-------------------------------------------------------------------|
| `listParticipants`         | Browse or search registered participants                          |
| `createParticipant`        | Register a new person before they can be scheduled               |
| `getParticipant`           | Look up a specific participant's timezone/provider details        |
| `updateParticipant`        | Change a participant's name, email, timezone, or calendar setup   |
| `deleteParticipant`        | Permanently remove a participant (use `force` to cascade)         |
| `getParticipantPreferences`| Read a participant's working hours and scheduling constraints     |
| `setParticipantPreferences`| Define or replace working hours, blackout windows, and buffers    |

### Availability (2 tools)

| Tool                        | When to use                                                     |
|-----------------------------|-----------------------------------------------------------------|
| `getParticipantAvailability`| Find free windows for a single participant                      |
| `findMutualAvailability`    | Find scored slots that work for all participants simultaneously  |

### Proposals (5 tools)

| Tool               | When to use                                                              |
|--------------------|--------------------------------------------------------------------------|
| `listProposals`    | Browse pending or historical proposals                                   |
| `createProposal`   | Propose candidate time slots and send to participants for consensus       |
| `getProposal`      | Check proposal status and see who has responded                          |
| `cancelProposal`   | Withdraw a pending proposal                                              |
| `respondToProposal`| Record a participant's acceptance or rejection                           |

### Bookings (5 tools)

| Tool               | When to use                                                              |
|--------------------|--------------------------------------------------------------------------|
| `listBookings`     | Browse confirmed, cancelled, or rescheduled meetings                     |
| `createBooking`    | Confirm a booking from an accepted proposal, or book directly            |
| `getBooking`       | Retrieve full details of a specific meeting                              |
| `rescheduleBooking`| Move a confirmed meeting to a new time                                   |
| `cancelBooking`    | Cancel a meeting permanently                                             |

---

## Example agent workflow

Here is a complete scheduling workflow an AI agent would follow using these tools:

```
1. createParticipant  ← register alice@example.com
2. createParticipant  ← register bob@example.com
3. setParticipantPreferences  ← Alice: Mon–Fri 09–17, 15 min buffer
4. setParticipantPreferences  ← Bob: Mon–Fri 10–18, no back-to-back
5. findMutualAvailability  ← find 60-min slots next week for [alice, bob]
   → returns top 5 scored slots
6. createProposal  ← "Budget Review" with top 3 slots, expires in 24h
   → proposal id: prop_abc123
7. respondToProposal  ← alice accepts, prefers slot 1
8. respondToProposal  ← bob accepts, prefers slot 1
   → proposal auto-transitions to "accepted", acceptedSlotId set
9. getProposal  ← confirm acceptedSlotId
10. createBooking  ← proposalId + slotId
    → booking confirmed, calendarEventIds written
```

---

## Development

```bash
# Install dependencies
npm install

# Type-check without building
npm run typecheck

# Build to dist/
npm run build

# Run in dev mode (auto-reloads)
MEETSYNC_API_URL=http://localhost:3000 MEETSYNC_API_KEY=dev-key npm run dev
```

---

## Architecture

```
src/
  index.ts          ← MCP Server, ListTools + CallTool handlers, stdio transport
  client.ts         ← Typed fetch wrapper: GET/POST/PUT/PATCH/DELETE + X-API-Key injection
  tools/
    participants.ts  ← 7 participant tools + handlers
    availability.ts  ← 2 availability tools + handlers
    proposals.ts     ← 5 proposal tools + handlers
    bookings.ts      ← 5 booking tools + handlers
```

Each tool file exports:
- A `Tool[]` array with `name`, `description`, and `inputSchema` (strict JSON Schema)
- A `handle*Tool(name, args)` async function that calls the MeetSync API via `client`

---

## License

MIT
