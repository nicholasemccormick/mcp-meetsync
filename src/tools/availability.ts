// ─────────────────────────────────────────────────────────────────────────────
// MeetSync MCP Tools — Availability resource (2 tools)
//
//   getParticipantAvailability  GET  /v1/participants/:participantId/availability
//   findMutualAvailability      POST /v1/availability/query
// ─────────────────────────────────────────────────────────────────────────────

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { client } from '../client';

// ── Tool definitions ──────────────────────────────────────────────────────────

export const availabilityTools: Tool[] = [
  {
    name: 'getParticipantAvailability',
    description:
      'Use this tool when you need to inspect the free time windows for exactly one participant — ' +
      'for example, to verify they are free at a specific time before booking directly, ' +
      'or to understand one person\'s constraints before a conversation. ' +
      'Do not use this for group scheduling — if you need a time that works for multiple people at once, ' +
      'call findMutualAvailability instead. ' +
      'Prerequisite: you must have the participant\'s UUID from createParticipant or listParticipants.',
    inputSchema: {
      type: 'object',
      required: ['participantId', 'startDate', 'endDate'],
      properties: {
        participantId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the participant whose availability you want.',
        },
        startDate: {
          type: 'string',
          format: 'date',
          description: 'Start of the date range to check (YYYY-MM-DD, inclusive).',
        },
        endDate: {
          type: 'string',
          format: 'date',
          description: 'End of the date range to check (YYYY-MM-DD, inclusive). Max 30 days from startDate.',
        },
        timezone: {
          type: 'string',
          description: 'IANA timezone to express results in. Defaults to the participant\'s own timezone.',
        },
        minDurationMinutes: {
          type: 'integer',
          minimum: 15,
          description: 'Exclude free windows shorter than this. Defaults to 30.',
        },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'findMutualAvailability',
    description:
      'Use this tool when you need to find meeting times that work for all participants simultaneously. ' +
      'This is the primary scheduling intelligence tool — call it to get scored candidate slots before creating a proposal. ' +
      'Prerequisites: every participant in participantIds must already be registered via createParticipant ' +
      '(UUIDs required — names and emails are not accepted). ' +
      'Have ready: the UUIDs of all participants, the meeting duration in minutes, and the date range to search. ' +
      'The returned slots are scored 0–1 by suitability (working hours, buffer fit, daily meeting load) ' +
      'and the start/end values can be passed directly into createProposal as candidateSlots.',
    inputSchema: {
      type: 'object',
      required: ['participantIds', 'durationMinutes', 'startDate', 'endDate'],
      properties: {
        participantIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          minItems: 2,
          description: 'UUIDs of all participants who must be available (minimum 2).',
        },
        durationMinutes: {
          type: 'integer',
          minimum: 15,
          maximum: 480,
          description: 'Required meeting duration in minutes.',
        },
        startDate: {
          type: 'string',
          format: 'date',
          description: 'Start of the search window (YYYY-MM-DD, inclusive).',
        },
        endDate: {
          type: 'string',
          format: 'date',
          description: 'End of the search window (YYYY-MM-DD, inclusive). Max 30 days from startDate.',
        },
        timezone: {
          type: 'string',
          description: 'IANA timezone to express candidate slots in. Defaults to the first participant\'s timezone.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'Maximum number of candidate slots to return. Defaults to 5.',
        },
      },
      additionalProperties: false,
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────

export async function handleAvailabilityTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'getParticipantAvailability': {
      const { participantId, ...params } = args;
      return client.get(`/v1/participants/${participantId}/availability`, params);
    }

    case 'findMutualAvailability':
      return client.post('/v1/availability/query', args);

    default:
      throw new Error(`Unknown availability tool: ${name}`);
  }
}
