// ─────────────────────────────────────────────────────────────────────────────
// MeetSync MCP Tools — Proposals resource (5 tools)
//
//   listProposals      GET    /v1/proposals
//   createProposal     POST   /v1/proposals
//   getProposal        GET    /v1/proposals/:proposalId
//   cancelProposal     PATCH  /v1/proposals/:proposalId
//   respondToProposal  POST   /v1/proposals/:proposalId/responses
// ─────────────────────────────────────────────────────────────────────────────

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { client } from '../client';

// ── Shared sub-schemas ────────────────────────────────────────────────────────

const candidateSlotSchema = {
  type: 'object',
  required: ['start', 'end'],
  properties: {
    start: {
      type: 'string',
      format: 'date-time',
      description: 'Slot start time as an ISO 8601 datetime with timezone offset (e.g. "2025-04-10T09:00:00-05:00").',
    },
    end: {
      type: 'string',
      format: 'date-time',
      description: 'Slot end time as an ISO 8601 datetime with timezone offset.',
    },
  },
  additionalProperties: false,
};

// ── Tool definitions ──────────────────────────────────────────────────────────

export const proposalTools: Tool[] = [
  {
    name: 'listProposals',
    description:
      'Use this tool when you need to browse existing meeting proposals — for example, to check whether ' +
      'a proposal is still pending, to find proposals involving a particular participant, or to audit ' +
      'all pending proposals before creating a new one. Supports filtering by status and organizer.',
    inputSchema: {
      type: 'object',
      properties: {
        organizerParticipantId: {
          type: 'string',
          format: 'uuid',
          description: 'Filter to proposals created by this participant.',
        },
        participantId: {
          type: 'string',
          format: 'uuid',
          description: 'Filter to proposals that include this participant.',
        },
        status: {
          type: 'string',
          enum: ['pending', 'accepted', 'rejected', 'expired', 'cancelled'],
          description: 'Filter by proposal status.',
        },
        page:  { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'createProposal',
    description:
      'Use this tool when you want to send candidate meeting times to a group and collect their votes ' +
      'before confirming a booking. ' +
      'Prerequisites: every participant in participantIds must already be registered via createParticipant; ' +
      'the organizerParticipantId must be one of the participantIds. ' +
      'Typical sequence: createParticipant for each person → findMutualAvailability to get slots → createProposal with those slots. ' +
      'After creation the proposal is "pending". ' +
      'Each participant must respond via respondToProposal (one call per person). ' +
      'Once all participants accept, the proposal becomes "accepted" and you call createBooking to confirm.',
    inputSchema: {
      type: 'object',
      required: ['title', 'organizerParticipantId', 'participantIds', 'candidateSlots'],
      properties: {
        title: {
          type: 'string',
          minLength: 1,
          description: 'Short title for the proposed meeting (e.g. "Q2 Planning Sync").',
        },
        description: {
          type: 'string',
          description: 'Optional longer description or agenda.',
        },
        organizerParticipantId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the participant organizing this meeting. Must be in participantIds.',
        },
        participantIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          minItems: 2,
          description: 'UUIDs of all participants, including the organizer.',
        },
        candidateSlots: {
          type: 'array',
          items: candidateSlotSchema,
          minItems: 1,
          maxItems: 10,
          description: 'Proposed time slots for participants to vote on. Provide between 1 and 10.',
        },
        expiresAt: {
          type: 'string',
          format: 'date-time',
          description: 'When the proposal expires if not fully responded to. Defaults to 48 hours from creation.',
        },
        location: {
          type: 'string',
          description: 'Optional physical location or meeting room.',
        },
        conferenceLink: {
          type: 'string',
          format: 'uri',
          description: 'Optional video conference URL.',
        },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'getProposal',
    description:
      'Use this tool when you need to inspect a specific proposal — to see its current status, ' +
      'check which participants have and have not yet responded, ' +
      'or retrieve the acceptedSlotId you will need to pass into createBooking once the proposal is accepted. ' +
      'If you do not have the proposalId, call listProposals first.',
    inputSchema: {
      type: 'object',
      required: ['proposalId'],
      properties: {
        proposalId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the proposal to retrieve.',
        },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'cancelProposal',
    description:
      'Use this tool when the organizer needs to withdraw an entire proposal — ' +
      'cancelling it for all participants so no booking can result. ' +
      'Only proposals with status "pending" can be cancelled. ' +
      'Important: this is not the tool to use when a single participant wants to decline. ' +
      'If one participant wants to say no while others continue, call respondToProposal with status="rejected" for that participant instead.',
    inputSchema: {
      type: 'object',
      required: ['proposalId'],
      properties: {
        proposalId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the proposal to cancel.',
        },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'respondToProposal',
    description:
      'Use this tool to record one participant\'s response (accept or reject) to a meeting proposal. ' +
      'This must be called once per participant — if a proposal has 3 participants, you must call this tool ' +
      '3 separate times, once for each participantId. ' +
      'Call getProposal first to see which participants have not yet responded (check the responses array). ' +
      'When accepting, the participant can indicate a preferredSlotId from the proposal\'s candidateSlots. ' +
      'Once every participant has responded and all accepted, the proposal automatically becomes "accepted" ' +
      'and you can then call createBooking (proposal-based mode) to confirm the meeting.',
    inputSchema: {
      type: 'object',
      required: ['proposalId', 'participantId', 'status'],
      properties: {
        proposalId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the proposal being responded to.',
        },
        participantId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the participant submitting their response.',
        },
        status: {
          type: 'string',
          enum: ['accepted', 'rejected'],
          description: '"accepted" to agree to the proposal, "rejected" to decline.',
        },
        preferredSlotId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the participant\'s preferred slot within the proposal (only used when status is "accepted").',
        },
        note: {
          type: 'string',
          description: 'Optional message to include with the response (e.g. reason for rejection).',
        },
      },
      additionalProperties: false,
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────

export async function handleProposalTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'listProposals':
      return client.get('/v1/proposals', args);

    case 'createProposal':
      return client.post('/v1/proposals', args);

    case 'getProposal': {
      const { proposalId } = args;
      return client.get(`/v1/proposals/${proposalId}`);
    }

    case 'cancelProposal': {
      const { proposalId } = args;
      return client.patch(`/v1/proposals/${proposalId}`, { status: 'cancelled' });
    }

    case 'respondToProposal': {
      const { proposalId, ...body } = args;
      return client.post(`/v1/proposals/${proposalId}/responses`, body);
    }

    default:
      throw new Error(`Unknown proposal tool: ${name}`);
  }
}
