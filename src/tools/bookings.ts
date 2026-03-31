// ─────────────────────────────────────────────────────────────────────────────
// MeetSync MCP Tools — Bookings resource (5 tools)
//
//   listBookings      GET    /v1/bookings
//   createBooking     POST   /v1/bookings
//   getBooking        GET    /v1/bookings/:bookingId
//   rescheduleBooking PATCH  /v1/bookings/:bookingId
//   cancelBooking     DELETE /v1/bookings/:bookingId
// ─────────────────────────────────────────────────────────────────────────────

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { client } from '../client';

// ── Tool definitions ──────────────────────────────────────────────────────────

export const bookingTools: Tool[] = [
  {
    name: 'listBookings',
    description:
      'Use this tool when you need to retrieve confirmed, cancelled, or rescheduled meetings. ' +
      'Supports filtering by participant, status, and time range. ' +
      'Call this to check a participant\'s upcoming meetings or to find a specific booking ' +
      'before rescheduling or cancelling it.',
    inputSchema: {
      type: 'object',
      properties: {
        participantId: {
          type: 'string',
          format: 'uuid',
          description: 'Filter to bookings that include this participant.',
        },
        status: {
          type: 'string',
          enum: ['confirmed', 'cancelled', 'rescheduled'],
          description: 'Filter by booking status.',
        },
        startAfter: {
          type: 'string',
          format: 'date-time',
          description: 'Return bookings that start after this ISO 8601 datetime.',
        },
        startBefore: {
          type: 'string',
          format: 'date-time',
          description: 'Return bookings that start before this ISO 8601 datetime.',
        },
        page:  { type: 'integer', minimum: 1, default: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'createBooking',
    description:
      'Use this tool to confirm a meeting. Choose the mode based on how you arrived here:\n' +
      'MODE 1 — Proposal-based (used after a proposal workflow): ' +
      'call this when a proposal\'s status is "accepted". ' +
      'First call getProposal to retrieve the acceptedSlotId, then pass proposalId + slotId (= acceptedSlotId) here. ' +
      'All participant UUIDs are already known from the proposal.\n' +
      'MODE 2 — Direct (skipping the proposal workflow): ' +
      'call this when you already know the exact meeting time and want to book immediately. ' +
      'You must provide organizerParticipantId, participantIds (all UUIDs from createParticipant), startTime, and endTime. ' +
      'Use this only when consensus is already established outside of MeetSync.\n' +
      'In both modes, conflict detection runs automatically and the call fails if any participant has an overlapping confirmed booking.',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: {
          type: 'string',
          minLength: 1,
          description: 'Title of the meeting.',
        },
        description: {
          type: 'string',
          description: 'Optional meeting description or agenda.',
        },
        // Proposal-based fields
        proposalId: {
          type: 'string',
          format: 'uuid',
          description: '(Proposal-based mode) UUID of an accepted proposal.',
        },
        slotId: {
          type: 'string',
          format: 'uuid',
          description: '(Proposal-based mode) UUID of the accepted slot within the proposal.',
        },
        // Direct booking fields
        organizerParticipantId: {
          type: 'string',
          format: 'uuid',
          description: '(Direct mode) UUID of the participant organizing the meeting.',
        },
        participantIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          minItems: 2,
          description: '(Direct mode) UUIDs of all participants including the organizer.',
        },
        startTime: {
          type: 'string',
          format: 'date-time',
          description: '(Direct mode) Meeting start as ISO 8601 datetime with timezone offset.',
        },
        endTime: {
          type: 'string',
          format: 'date-time',
          description: '(Direct mode) Meeting end as ISO 8601 datetime with timezone offset.',
        },
        timezone: {
          type: 'string',
          description: '(Direct mode) IANA timezone for the booking. Defaults to UTC.',
        },
        // Common optional
        location: {
          type: 'string',
          description: 'Physical location or meeting room.',
        },
        conferenceLink: {
          type: 'string',
          format: 'uri',
          description: 'Video conference URL.',
        },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'getBooking',
    description:
      'Use this tool when you need to retrieve full details about a specific booking — ' +
      'including its status, participants, start/end times, calendar event IDs, and any linked proposal. ' +
      'Useful for confirming a booking was created successfully or for building a summary to share with participants.',
    inputSchema: {
      type: 'object',
      required: ['bookingId'],
      properties: {
        bookingId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the booking to retrieve.',
        },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'rescheduleBooking',
    description:
      'Use this tool when you need to move a confirmed meeting to a new time. ' +
      'The new startTime must be in the future. ' +
      'Conflict detection runs automatically for all participants. ' +
      'Only bookings with status "confirmed" can be rescheduled.',
    inputSchema: {
      type: 'object',
      required: ['bookingId', 'startTime', 'endTime'],
      properties: {
        bookingId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the booking to reschedule.',
        },
        startTime: {
          type: 'string',
          format: 'date-time',
          description: 'New start time as ISO 8601 datetime with timezone offset. Must be in the future.',
        },
        endTime: {
          type: 'string',
          format: 'date-time',
          description: 'New end time as ISO 8601 datetime with timezone offset.',
        },
        reason: {
          type: 'string',
          description: 'Optional reason for the reschedule.',
        },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'cancelBooking',
    description:
      'Use this tool when a confirmed meeting needs to be permanently cancelled for all participants. ' +
      'If the intent is to move the meeting to a different time rather than cancel it entirely, ' +
      'use rescheduleBooking instead — cancellation is irreversible. ' +
      'Only bookings with status "confirmed" can be cancelled; already-cancelled bookings will return an error.',
    inputSchema: {
      type: 'object',
      required: ['bookingId'],
      properties: {
        bookingId: {
          type: 'string',
          format: 'uuid',
          description: 'UUID of the booking to cancel.',
        },
      },
      additionalProperties: false,
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────

export async function handleBookingTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'listBookings':
      return client.get('/v1/bookings', args);

    case 'createBooking':
      return client.post('/v1/bookings', args);

    case 'getBooking': {
      const { bookingId } = args;
      return client.get(`/v1/bookings/${bookingId}`);
    }

    case 'rescheduleBooking': {
      const { bookingId, ...body } = args;
      return client.patch(`/v1/bookings/${bookingId}`, body);
    }

    case 'cancelBooking': {
      const { bookingId } = args;
      return client.delete(`/v1/bookings/${bookingId}`);
    }

    default:
      throw new Error(`Unknown booking tool: ${name}`);
  }
}
