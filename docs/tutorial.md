# How to give your AI agent the ability to schedule meetings

Scheduling is one of the first things people ask their AI agents to handle. It's also one of the first places agents fall apart. This tutorial walks through why that happens, what MeetSync does about it, and exactly how to wire it into your agent — whether you're building on Claude, LangChain, or n8n.

---

## Why scheduling breaks most agents

An agent that can draft emails, summarize documents, and search the web will still fail at "find a time to meet with Sarah and James next week." Here's why.

**Raw calendar APIs aren't agent-friendly.** Google Calendar and Outlook expose events, not intelligence. To find mutual availability, an agent has to: fetch both calendars, parse free/busy data, cross-reference working hours, account for timezones, apply buffer preferences, rank the results by quality — and then do something with them. That's 6–8 steps of stateful reasoning before it can even propose a time.

**LLMs hallucinate availability.** Without a real API call, an agent that tries to reason about "when is Sarah free?" based on context will invent answers. It may confidently suggest 2pm Tuesday when Sarah has a recurring all-hands.

**Multi-party coordination requires multiple round-trips.** A two-person meeting is manageable. A four-person meeting with different timezones, working hours, and blackout windows quickly exceeds what a single prompt can reliably orchestrate.

**OAuth is hostile to agents.** Most calendar APIs require a redirect-based OAuth flow. Agents can't click "Allow." Getting around this requires custom OAuth proxy setups that add weeks of work.

---

## What MeetSync gives your agent

MeetSync collapses the entire scheduling workflow into five deterministic API calls:

1. **Register participants** — one call per person, stores their timezone and calendar integration
2. **Set preferences** — working hours, blackout windows, buffer time
3. **Find mutual availability** — one call returns ranked slots across all participants, scoring each by working hours, buffer fit, and daily load
4. **Create a proposal** — send candidate slots to participants, collect votes
5. **Confirm the booking** — lock in the winning slot

The API is designed around agent constraints: API key auth (no OAuth redirects), explicit timezone handling in every response, UUIDs as stable references, and error envelopes that tell agents exactly what to fix.

The MCP server (`npx mcp-meetsync`) wraps all 19 endpoints as named MCP tools, so any MCP-compatible LLM can call them directly from its tool list.

---

## Step 1: Install the MCP server

```bash
npm install -g mcp-meetsync
```

Or run without installing:

```bash
npx mcp-meetsync
```

The server reads two environment variables:

```bash
MEETSYNC_API_URL=https://api.meetsync.dev    # or your self-hosted URL
MEETSYNC_API_KEY=your-api-key-here
```

To add to **Claude Desktop**, open `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) and add:

```json
{
  "mcpServers": {
    "meetsync": {
      "command": "npx",
      "args": ["-y", "mcp-meetsync"],
      "env": {
        "MEETSYNC_API_URL": "https://api.meetsync.dev",
        "MEETSYNC_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Restart Claude. The 19 MeetSync tools appear in Claude's tool list automatically.

---

## Step 2: Add MeetSync to your agent's system prompt

A good system prompt tells your agent when to reach for these tools. The key principles: don't guess availability, always check who's registered, call `findMutualAvailability` before proposing any time.

```
You have access to MeetSync — a calendar scheduling API. Use it any time the user
asks to schedule, book, reschedule, or cancel a meeting.

Rules:
1. Never guess or assume availability. Always call findMutualAvailability before
   suggesting a time.
2. Before scheduling anyone, check whether they are registered. If not, call
   createParticipant first.
3. If the user wants to collect everyone's input before booking, use the proposal
   workflow: createProposal → respondToProposal (once per person) → createBooking.
4. If the user just wants to book a time that's already agreed on, use createBooking
   directly (direct mode).
5. After creating a booking, call getBooking to confirm it succeeded and report
   the confirmed time back to the user.
```

---

## Step 3: Full worked example

**User message:** "Schedule a 30-minute call with Sarah and James sometime next week."

Here is the exact sequence of tool calls a well-configured agent should make.

---

### Tool call 1 — Check whether Sarah is registered

```json
{
  "tool": "listParticipants",
  "input": {}
}
```

**Result:** Returns two existing participants — but neither is Sarah or James. They need to be registered.

---

### Tool calls 2 & 3 — Register Sarah and James

```json
{
  "tool": "createParticipant",
  "input": {
    "name": "Sarah Okonkwo",
    "email": "sarah@example.com",
    "timezone": "America/New_York"
  }
}
```
→ `{ "id": "sarah-uuid-here", ... }`

```json
{
  "tool": "createParticipant",
  "input": {
    "name": "James Wu",
    "email": "james@example.com",
    "timezone": "America/Los_Angeles"
  }
}
```
→ `{ "id": "james-uuid-here", ... }`

---

### Tool call 4 — Find mutual availability next week

```json
{
  "tool": "findMutualAvailability",
  "input": {
    "participantIds": ["sarah-uuid-here", "james-uuid-here"],
    "durationMinutes": 30,
    "startDate": "2025-09-22",
    "endDate": "2025-09-26",
    "limit": 5
  }
}
```

**Result:**
```json
{
  "slots": [
    { "start": "2025-09-22T10:00:00-04:00", "end": "2025-09-22T10:30:00-04:00", "score": 0.91 },
    { "start": "2025-09-22T14:00:00-04:00", "end": "2025-09-22T14:30:00-04:00", "score": 0.84 },
    { "start": "2025-09-23T11:00:00-04:00", "end": "2025-09-23T11:30:00-04:00", "score": 0.79 }
  ]
}
```

The agent has 3 candidate slots scored by quality. It picks the top-ranked one.

---

### Tool call 5 — Book the meeting directly

Since the user said "schedule a call" (not "send options to Sarah and James"), the agent books directly without a proposal.

```json
{
  "tool": "createBooking",
  "input": {
    "title": "Call with Sarah and James",
    "organizerParticipantId": "sarah-uuid-here",
    "participantIds": ["sarah-uuid-here", "james-uuid-here"],
    "startTime": "2025-09-22T10:00:00-04:00",
    "endTime":   "2025-09-22T10:30:00-04:00"
  }
}
```

**Result:**
```json
{
  "id": "booking-uuid-here",
  "status": "confirmed",
  "startTime": "2025-09-22T10:00:00-04:00",
  "endTime":   "2025-09-22T10:30:00-04:00",
  "calendarEventIds": {
    "sarah-uuid-here": "evt_sarah_abc123",
    "james-uuid-here": "evt_james_def456"
  }
}
```

**Agent response to user:** "Done — I've scheduled a 30-minute call with Sarah Okonkwo and James Wu for Monday, September 22 at 10:00 AM Eastern (7:00 AM Pacific). Calendar invites have been sent."

---

### Variant: Use the proposal workflow instead

If the user says "send Sarah and James some options and let them pick," the agent uses the proposal workflow instead of booking directly. After Tool Call 4 above:

**Tool call 5 — Create a proposal with 3 options:**
```json
{
  "tool": "createProposal",
  "input": {
    "title": "30-min call",
    "organizerParticipantId": "sarah-uuid-here",
    "participantIds": ["sarah-uuid-here", "james-uuid-here"],
    "candidateSlots": [
      { "start": "2025-09-22T10:00:00-04:00", "end": "2025-09-22T10:30:00-04:00" },
      { "start": "2025-09-22T14:00:00-04:00", "end": "2025-09-22T14:30:00-04:00" },
      { "start": "2025-09-23T11:00:00-04:00", "end": "2025-09-23T11:30:00-04:00" }
    ]
  }
}
```
→ `{ "id": "proposal-uuid-here", "status": "pending", ... }`

**Tool calls 6 & 7 — Collect each participant's response** (once per person):
```json
{ "tool": "respondToProposal", "input": { "proposalId": "proposal-uuid-here", "participantId": "sarah-uuid-here", "status": "accepted", "preferredSlotId": "slot-1-uuid" } }
{ "tool": "respondToProposal", "input": { "proposalId": "proposal-uuid-here", "participantId": "james-uuid-here", "status": "accepted", "preferredSlotId": "slot-1-uuid" } }
```
→ After the second call, the proposal `status` automatically becomes `"accepted"` with `acceptedSlotId` set.

**Tool call 8 — Confirm the booking:**
```json
{
  "tool": "createBooking",
  "input": {
    "title": "30-min call",
    "proposalId": "proposal-uuid-here",
    "slotId": "slot-1-uuid"
  }
}
```

---

## Full code example — Claude tool use (TypeScript)

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const MEETSYNC_BASE = "https://api.meetsync.dev/v1";
const MEETSYNC_KEY  = process.env.MEETSYNC_API_KEY!;

async function callMeetSync(method: string, path: string, body?: unknown) {
  const res = await fetch(`${MEETSYNC_BASE}${path}`, {
    method,
    headers: { "X-API-Key": MEETSYNC_KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// Define the tools Claude will see
const tools: Anthropic.Tool[] = [
  {
    name: "createParticipant",
    description: "Register a new person in MeetSync. Must be called before scheduling them.",
    input_schema: {
      type: "object" as const,
      required: ["name", "email"],
      properties: {
        name:     { type: "string" },
        email:    { type: "string" },
        timezone: { type: "string" },
      },
    },
  },
  {
    name: "findMutualAvailability",
    description: "Find meeting slots that work for all participants. Call after registering everyone.",
    input_schema: {
      type: "object" as const,
      required: ["participantIds", "durationMinutes", "startDate", "endDate"],
      properties: {
        participantIds:  { type: "array",   items: { type: "string" } },
        durationMinutes: { type: "integer" },
        startDate:       { type: "string" },
        endDate:         { type: "string" },
        limit:           { type: "integer" },
      },
    },
  },
  {
    name: "createBooking",
    description: "Confirm a meeting. Direct mode: provide organizerParticipantId, participantIds, startTime, endTime.",
    input_schema: {
      type: "object" as const,
      required: ["title"],
      properties: {
        title:                  { type: "string" },
        organizerParticipantId: { type: "string" },
        participantIds:         { type: "array", items: { type: "string" } },
        startTime:              { type: "string" },
        endTime:                { type: "string" },
        proposalId:             { type: "string" },
        slotId:                 { type: "string" },
      },
    },
  },
];

async function runSchedulingAgent(userMessage: string) {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage }
  ];

  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      tools,
      system: `You have access to MeetSync scheduling tools. Never guess availability —
               always call findMutualAvailability. Register participants before scheduling them.`,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content.find(b => b.type === "text");
      return text?.type === "text" ? text.text : "";
    }

    // Process tool calls
    const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
    if (toolUseBlocks.length === 0) break;

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      if (block.type !== "tool_use") continue;
      const input = block.input as Record<string, unknown>;

      let result: unknown;
      switch (block.name) {
        case "createParticipant":
          result = await callMeetSync("POST", "/participants", input);
          break;
        case "findMutualAvailability":
          result = await callMeetSync("POST", "/availability/query", input);
          break;
        case "createBooking":
          result = await callMeetSync("POST", "/bookings", input);
          break;
        default:
          result = { error: `Unknown tool: ${block.name}` };
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return "";
}

// Run it
runSchedulingAgent("Schedule a 30-minute call with sarah@example.com and james@example.com next week.")
  .then(console.log)
  .catch(console.error);
```

---

## Full code example — LangChain (Python)

```python
import os
import requests
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool
from langchain_core.prompts import ChatPromptTemplate

BASE_URL = os.environ["MEETSYNC_API_URL"]
API_KEY  = os.environ["MEETSYNC_API_KEY"]

def meetsync(method: str, path: str, body: dict = None):
    resp = requests.request(
        method, f"{BASE_URL}{path}",
        headers={"X-API-Key": API_KEY, "Content-Type": "application/json"},
        json=body,
    )
    return resp.json()

@tool
def create_participant(name: str, email: str, timezone: str = "UTC") -> dict:
    """Register a new participant in MeetSync. Call before any scheduling."""
    return meetsync("POST", "/v1/participants", {"name": name, "email": email, "timezone": timezone})

@tool
def find_mutual_availability(
    participant_ids: list[str],
    duration_minutes: int,
    start_date: str,
    end_date: str,
    limit: int = 5,
) -> dict:
    """Find meeting slots that work for all participants. Requires registered participant UUIDs."""
    return meetsync("POST", "/v1/availability/query", {
        "participantIds": participant_ids,
        "durationMinutes": duration_minutes,
        "startDate": start_date,
        "endDate": end_date,
        "limit": limit,
    })

@tool
def create_booking(
    title: str,
    organizer_participant_id: str,
    participant_ids: list[str],
    start_time: str,
    end_time: str,
) -> dict:
    """Confirm a meeting booking directly. Provide ISO 8601 datetimes with timezone offset."""
    return meetsync("POST", "/v1/bookings", {
        "title": title,
        "organizerParticipantId": organizer_participant_id,
        "participantIds": participant_ids,
        "startTime": start_time,
        "endTime": end_time,
    })

llm   = ChatAnthropic(model="claude-sonnet-4-6")
tools = [create_participant, find_mutual_availability, create_booking]

prompt = ChatPromptTemplate.from_messages([
    ("system", """You have access to MeetSync scheduling tools.
     Never guess availability — always call find_mutual_availability.
     Register participants before scheduling them.
     {agent_scratchpad}"""),
    ("human", "{input}"),
])

agent          = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

result = agent_executor.invoke({
    "input": "Schedule a 30-min call with sarah@example.com and james@example.com next week."
})
print(result["output"])
```

---

## Links

- [npm package](https://www.npmjs.com/package/mcp-meetsync) — `npx mcp-meetsync`
- [API Reference](./README.md) — full endpoint docs with request/response examples
- [Tool definitions](./tool-definition.md) — copy-paste JSON, Python, and n8n config
