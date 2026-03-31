// ─────────────────────────────────────────────────────────────────────────────
// MeetSync MCP Tools — Participants resource (7 tools)
//
//   listParticipants          GET  /v1/participants
//   createParticipant         POST /v1/participants
//   getParticipant            GET  /v1/participants/:participantId
//   updateParticipant         PATCH /v1/participants/:participantId
//   deleteParticipant         DELETE /v1/participants/:participantId
//   getParticipantPreferences GET  /v1/participants/:participantId/preferences
//   setParticipantPreferences PUT  /v1/participants/:participantId/preferences
// ─────────────────────────────────────────────────────────────────────────────

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { client } from '../client';

// ── Tool definitions ──────────────────────────────────────────────────────────

export const participantTools: Tool[] = [
  {
    name: 'listParticipants',
    description:
      'Use this tool when you need to find participants and you do not yet have their UUID — for example, ' +
      'when you only know their name or email address. ' +
      'Also use it to verify a person is registered before scheduling, or to enumerate all active participants. ' +
      'If you already have a participant\'s UUID, use getParticipant instead.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'inactive'],
          description: 'Filter participants by status.',
        },
        page:  { type: 'integer', minimum: 1, default: 1, description: 'Page number (1-based).' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20, description: 'Results per page.' },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'createParticipant',
    description:
      'Use this tool when you need to register a new person in MeetSync so their calendar can be considered during scheduling. ' +
      'Must be called before a participant can appear in proposals, bookings, or availability queries. ' +
      'Supports Google, Outlook, and iCal providers.',
    inputSchema: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name:             { type: 'string', minLength: 1, description: 'Full name of the participant.' },
        email:            { type: 'string', format: 'email', description: 'Unique email address.' },
        timezone:         { type: 'string', description: 'IANA timezone identifier (e.g. "America/New_York"). Defaults to UTC.' },
        calendarProvider: {
          type: 'string',
          enum: ['google', 'outlook', 'ical', 'none'],
          description: 'Calendar integration provider. Defaults to "none".',
        },
        icalUrl: {
          type: 'string',
          format: 'uri',
          description: 'iCal feed URL. Required when calendarProvider is "ical".',
        },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'getParticipant',
    description:
      'Use this tool when you already have the participant\'s UUID and need to look up their details — ' +
      'timezone, calendar provider, or status. ' +
      'Prerequisite: you must have the UUID from a prior createParticipant or listParticipants call. ' +
      'If you only have a name or email address and need the UUID, call listParticipants first. ' +
      'Note: this does not return scheduling preferences — call getParticipantPreferences for that.',
    inputSchema: {
      type: 'object',
      required: ['participantId'],
      properties: {
        participantId: { type: 'string', format: 'uuid', description: 'UUID of the participant.' },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'updateParticipant',
    description:
      'Use this tool when you need to change a participant\'s name, email, timezone, or calendar provider, ' +
      'or when you want to soft-deactivate a participant by setting status to "inactive". ' +
      'Only the fields you supply are changed (partial update — other fields stay as-is). ' +
      'Prefer this over deleteParticipant when you want to stop scheduling someone without erasing their history.',
    inputSchema: {
      type: 'object',
      required: ['participantId'],
      properties: {
        participantId:    { type: 'string', format: 'uuid', description: 'UUID of the participant to update.' },
        name:             { type: 'string', minLength: 1, description: 'Updated full name.' },
        email:            { type: 'string', format: 'email', description: 'Updated email address.' },
        timezone:         { type: 'string', description: 'Updated IANA timezone identifier.' },
        calendarProvider: { type: 'string', enum: ['google', 'outlook', 'ical', 'none'], description: 'Updated calendar provider.' },
        icalUrl:          { type: 'string', format: 'uri', description: 'Updated iCal URL (required if switching to ical provider).' },
        status:           { type: 'string', enum: ['active', 'inactive'], description: 'Set to "inactive" to soft-deactivate.' },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'deleteParticipant',
    description:
      'Use this tool only when you need to permanently and irreversibly erase a participant and all their data. ' +
      'If the goal is simply to stop scheduling someone, use updateParticipant with status="inactive" instead — ' +
      'that preserves their history and can be reversed. ' +
      'deleteParticipant cannot be undone. ' +
      'By default it fails if the participant has active proposals or confirmed bookings; ' +
      'pass force=true only when you explicitly intend to cancel those as well.',
    inputSchema: {
      type: 'object',
      required: ['participantId'],
      properties: {
        participantId: { type: 'string', format: 'uuid', description: 'UUID of the participant to delete.' },
        force: {
          type: 'boolean',
          description: 'If true, cancel any active proposals and bookings before deleting. Defaults to false.',
        },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'getParticipantPreferences',
    description:
      'Use this tool when you need to read a participant\'s scheduling preferences — working hours by day, ' +
      'blackout windows, buffer time between meetings, and maximum meetings per day. ' +
      'Important: getParticipant does not return preferences; you must call this tool separately. ' +
      'Call this before setParticipantPreferences if you only want to update some fields, ' +
      'since setParticipantPreferences replaces the entire preference object.',
    inputSchema: {
      type: 'object',
      required: ['participantId'],
      properties: {
        participantId: { type: 'string', format: 'uuid', description: 'UUID of the participant.' },
      },
      additionalProperties: false,
    },
  },

  {
    name: 'setParticipantPreferences',
    description:
      'Use this tool when you need to set a participant\'s scheduling preferences: working hours, ' +
      'blackout windows, buffer time, and daily meeting cap. ' +
      'WARNING — this is a full replacement, not a partial update: any preference not included in your call ' +
      'reverts to its default value, which will silently overwrite existing settings. ' +
      'If you only want to change one field (e.g. bufferMinutes), call getParticipantPreferences first ' +
      'to read the current values, then send the full merged object back here.',
    inputSchema: {
      type: 'object',
      required: ['participantId'],
      properties: {
        participantId: { type: 'string', format: 'uuid', description: 'UUID of the participant.' },
        workingHours: {
          type: 'object',
          description: 'Working hours keyed by day of week (monday–sunday). Each day has start/end in HH:MM format and an enabled flag.',
          properties: {
            monday:    { '$ref': '#/$defs/daySchedule' },
            tuesday:   { '$ref': '#/$defs/daySchedule' },
            wednesday: { '$ref': '#/$defs/daySchedule' },
            thursday:  { '$ref': '#/$defs/daySchedule' },
            friday:    { '$ref': '#/$defs/daySchedule' },
            saturday:  { '$ref': '#/$defs/daySchedule' },
            sunday:    { '$ref': '#/$defs/daySchedule' },
          },
          additionalProperties: false,
        },
        blackoutWindows: {
          type: 'array',
          description: 'Recurring unavailable time blocks (e.g. lunch, standup).',
          items: {
            type: 'object',
            required: ['label', 'startTime', 'endTime', 'daysOfWeek'],
            properties: {
              label:      { type: 'string', description: 'Name of the blackout window (e.g. "Lunch").' },
              startTime:  { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', description: 'Start time in HH:MM.' },
              endTime:    { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', description: 'End time in HH:MM.' },
              daysOfWeek: {
                type: 'array',
                items: { type: 'string', enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
                minItems: 1,
                description: 'Days this blackout applies to.',
              },
            },
            additionalProperties: false,
          },
        },
        bufferMinutes:    { type: 'integer', minimum: 0, maximum: 120, description: 'Minimum gap (minutes) between consecutive meetings.' },
        maxMeetingsPerDay: { type: 'integer', minimum: 1, maximum: 20, description: 'Maximum number of meetings per calendar day.' },
      },
      additionalProperties: false,
      $defs: {
        daySchedule: {
          type: 'object',
          required: ['enabled', 'start', 'end'],
          properties: {
            enabled: { type: 'boolean' },
            start:   { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', description: 'Start time HH:MM.' },
            end:     { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', description: 'End time HH:MM.' },
          },
          additionalProperties: false,
        },
      },
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────

export async function handleParticipantTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'listParticipants':
      return client.get('/v1/participants', args);

    case 'createParticipant':
      return client.post('/v1/participants', args);

    case 'getParticipant': {
      const { participantId, ...rest } = args;
      void rest;
      return client.get(`/v1/participants/${participantId}`);
    }

    case 'updateParticipant': {
      const { participantId, ...body } = args;
      return client.patch(`/v1/participants/${participantId}`, body);
    }

    case 'deleteParticipant': {
      const { participantId, force } = args;
      return client.delete(`/v1/participants/${participantId}`, force !== undefined ? { force } : {});
    }

    case 'getParticipantPreferences': {
      const { participantId } = args;
      return client.get(`/v1/participants/${participantId}/preferences`);
    }

    case 'setParticipantPreferences': {
      const { participantId, ...body } = args;
      return client.put(`/v1/participants/${participantId}/preferences`, body);
    }

    default:
      throw new Error(`Unknown participant tool: ${name}`);
  }
}
