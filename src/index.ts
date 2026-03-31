#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// MeetSync MCP Server — entry point
//
// Exposes all 19 MeetSync operationIds as MCP tools over stdio.
// Configure via environment variables:
//   MEETSYNC_API_URL  — base URL of the MeetSync API  (default: http://localhost:3000)
//   MEETSYNC_API_KEY  — API key for X-API-Key header  (required)
//
// Usage:
//   node dist/index.js
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { Server }               from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

import { participantTools,  handleParticipantTool  } from './tools/participants';
import { availabilityTools, handleAvailabilityTool } from './tools/availability';
import { proposalTools,     handleProposalTool     } from './tools/proposals';
import { bookingTools,      handleBookingTool      } from './tools/bookings';

// ── Tool registry ─────────────────────────────────────────────────────────────

const ALL_TOOLS = [
  ...participantTools,
  ...availabilityTools,
  ...proposalTools,
  ...bookingTools,
];

// Map tool name → resource handler for O(1) dispatch
const PARTICIPANT_NAMES  = new Set(participantTools.map(t => t.name));
const AVAILABILITY_NAMES = new Set(availabilityTools.map(t => t.name));
const PROPOSAL_NAMES     = new Set(proposalTools.map(t => t.name));
const BOOKING_NAMES      = new Set(bookingTools.map(t => t.name));

// ── Server setup ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'mcp-meetsync', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

// ── handlers ──────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
  const { name, arguments: rawArgs } = request.params;
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  try {
    let result: unknown;

    if (PARTICIPANT_NAMES.has(name)) {
      result = await handleParticipantTool(name, args);
    } else if (AVAILABILITY_NAMES.has(name)) {
      result = await handleAvailabilityTool(name, args);
    } else if (PROPOSAL_NAMES.has(name)) {
      result = await handleProposalTool(name, args);
    } else if (BOOKING_NAMES.has(name)) {
      result = await handleBookingTool(name, args);
    } else {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2),
      }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error calling ${name}: ${message}` }],
      isError: true,
    };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now listening on stdin/stdout — no console output here to avoid
  // corrupting the MCP framing. Errors go to stderr.
  process.stderr.write('mcp-meetsync running\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
