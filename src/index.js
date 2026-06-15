#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { RybbitClient, buildTimeParams } from './client.js';

const API_KEY = process.env.RYBBIT_API_KEY;

if (!API_KEY) {
  console.error('Error: RYBBIT_API_KEY environment variable is required');
  process.exit(1);
}

const client = new RybbitClient(API_KEY);

// Common schema definitions
const timeParamsSchema = {
  startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
  endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
  timeZone: { type: 'string', description: 'IANA timezone identifier (e.g., America/New_York)' },
  pastMinutesStart: { type: 'number', description: 'Minutes ago for start (alternative to date-based)' },
  pastMinutesEnd: { type: 'number', description: 'Minutes ago for end (alternative to date-based)' },
  filters: { type: 'string', description: 'JSON array of filter objects with parameter, type, and value fields' },
};

const siteIdSchema = {
  siteId: { type: 'string', description: 'Site ID or identifier' },
};

const paginationSchema = {
  page: { type: 'number', description: 'Page number for pagination' },
  limit: { type: 'number', description: 'Results per page' },
};

// Tool definitions
const tools = [
  // Overview Tools
  {
    name: 'rybbit_get_overview',
    description: 'Get high-level analytics totals for a site over a date range: unique users (visitors), sessions, pageviews, pages per session, bounce rate, and average session duration. Start here for "how many users/visitors/pageviews did I get" questions.',
    inputSchema: {
      type: 'object',
      properties: { ...siteIdSchema, ...timeParamsSchema },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_overview_timeseries',
    description: 'Get time-series analytics data broken into configurable time buckets for trend analysis',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        bucket: { type: 'string', enum: ['minute', 'five_minutes', 'hour', 'day', 'week', 'month'], description: 'Time bucket granularity' },
      },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_metric',
    description: 'Get a ranked breakdown of traffic by one dimension. Use parameter="pathname" for the top pages visited, "country"/"region"/"city" for geography, "referrer"/"utm_source" for traffic sources, "browser"/"operating_system"/"device_type" for technology. Returns each value with its session count, pageviews, and percentage.',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        parameter: { type: 'string', description: 'Dimension to break down by (browser, operating_system, device_type, country, region, city, pathname, page_title, hostname, querystring, referrer, utm_source, utm_medium, utm_campaign, user_id, event_name)' },
        ...paginationSchema,
      },
      required: ['siteId', 'parameter'],
    },
  },
  {
    name: 'rybbit_get_live_visitors',
    description: 'Get the count of currently active visitors on the site',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        minutes: { type: 'number', description: 'Time window in minutes (default: 5)' },
      },
      required: ['siteId'],
    },
  },

  // Sessions Tools
  {
    name: 'rybbit_get_sessions',
    description: 'Get a paginated list of sessions with analytics data',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        ...paginationSchema,
        userId: { type: 'string', description: 'Filter by specific user ID' },
        identifiedOnly: { type: 'boolean', description: 'Return only identified users' },
      },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_session_details',
    description: 'Get detailed information about a specific session including all events and pageviews',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        sessionId: { type: 'string', description: 'Session identifier' },
        ...paginationSchema,
        offset: { type: 'number', description: 'Events to skip' },
        minutes: { type: 'number', description: 'Retrieve events from last N minutes only' },
      },
      required: ['siteId', 'sessionId'],
    },
  },
  {
    name: 'rybbit_get_session_locations',
    description: 'Get aggregated session locations with coordinates for map visualization',
    inputSchema: {
      type: 'object',
      properties: { ...siteIdSchema, ...timeParamsSchema },
      required: ['siteId'],
    },
  },

  // Events Tools
  {
    name: 'rybbit_get_events',
    description: 'Get a paginated list of individual events (pageviews, custom events, and outbound clicks) with full per-event detail — pathname, referrer, device, browser, geo, and timestamps. Use this to see the actual pages and events visitors hit.',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        page: { type: 'number', description: 'Page number' },
        pageSize: { type: 'number', description: 'Results per page' },
        sinceTimestamp: { type: 'string', description: 'Return events at or after this ISO timestamp (cursor-based pagination)' },
        beforeTimestamp: { type: 'string', description: 'Return events before this ISO timestamp (cursor-based pagination)' },
      },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_event_names',
    description: 'Get a list of unique custom event names with their occurrence counts',
    inputSchema: {
      type: 'object',
      properties: { ...siteIdSchema, ...timeParamsSchema },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_event_properties',
    description: 'Get property key-value pairs for a specific event name with occurrence counts',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        eventName: { type: 'string', description: 'Target event name' },
      },
      required: ['siteId', 'eventName'],
    },
  },
  {
    name: 'rybbit_get_outbound_links',
    description: 'Get a list of outbound link clicks with their occurrence counts',
    inputSchema: {
      type: 'object',
      properties: { ...siteIdSchema, ...timeParamsSchema },
      required: ['siteId'],
    },
  },

  // Users Tools
  {
    name: 'rybbit_get_users',
    description: 'Get a paginated list of users with analytics data',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        page: { type: 'number', description: 'Page number' },
        pageSize: { type: 'number', description: 'Results per page' },
        sortBy: { type: 'string', enum: ['first_seen', 'last_seen', 'pageviews', 'sessions', 'events'], description: 'Sort field' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction' },
        identifiedOnly: { type: 'boolean', description: 'Return only identified users' },
      },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_user_sessions',
    description: 'Get session data for a specific user',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        userId: { type: 'string', description: 'User identifier' },
      },
      required: ['siteId', 'userId'],
    },
  },
  {
    name: 'rybbit_get_user_session_count',
    description: 'Get the number of sessions per day for a specific user',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        userId: { type: 'string', description: 'User identifier' },
        timeZone: { type: 'string', description: 'IANA timezone (default: UTC)' },
      },
      required: ['siteId', 'userId'],
    },
  },
  {
    name: 'rybbit_get_user_info',
    description: 'Get detailed user information including profile traits and linked devices',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        userId: { type: 'string', description: 'User identifier' },
      },
      required: ['siteId', 'userId'],
    },
  },

  // Goals Tools
  {
    name: 'rybbit_get_goals',
    description: 'Get a paginated list of goals with their conversion metrics',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        ...paginationSchema,
        sort: { type: 'string', description: 'Sort field' },
        order: { type: 'string', description: 'Sort direction' },
      },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_goal_sessions',
    description: 'Get sessions that completed a specific goal',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        goalId: { type: 'string', description: 'Goal identifier' },
        ...paginationSchema,
      },
      required: ['siteId', 'goalId'],
    },
  },
  {
    name: 'rybbit_create_goal',
    description: 'Create a new goal for tracking conversions (path-based or event-based)',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        name: { type: 'string', description: 'Goal name' },
        goalType: { type: 'string', enum: ['path', 'event'], description: 'Type of goal' },
        pathPattern: { type: 'string', description: 'Path pattern for path goals (e.g., /signup/*)' },
        eventName: { type: 'string', description: 'Event name for event goals' },
        eventPropertyKey: { type: 'string', description: 'Optional event property key' },
        eventPropertyValue: { type: 'string', description: 'Optional event property value' },
      },
      required: ['siteId', 'name', 'goalType'],
    },
  },
  {
    name: 'rybbit_update_goal',
    description: 'Update an existing goal configuration',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        goalId: { type: 'string', description: 'Goal identifier' },
        name: { type: 'string', description: 'Goal name' },
        goalType: { type: 'string', enum: ['path', 'event'], description: 'Type of goal' },
        pathPattern: { type: 'string', description: 'Path pattern for path goals' },
        eventName: { type: 'string', description: 'Event name for event goals' },
        eventPropertyKey: { type: 'string', description: 'Optional event property key' },
        eventPropertyValue: { type: 'string', description: 'Optional event property value' },
      },
      required: ['siteId', 'goalId', 'name', 'goalType'],
    },
  },
  // Funnels Tools
  {
    name: 'rybbit_get_funnels',
    description: 'Get all saved funnels for a site',
    inputSchema: {
      type: 'object',
      properties: { ...siteIdSchema },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_analyze_funnel',
    description: 'Analyze a funnel and get step-by-step conversion data',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        steps: { type: 'string', description: 'JSON array of funnel steps with type, value, and optional name/hostname/eventPropertyKey/eventPropertyValue' },
      },
      required: ['siteId', 'steps'],
    },
  },
  {
    name: 'rybbit_get_funnel_step_sessions',
    description: 'Get sessions that reached or dropped off at a specific funnel step',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        stepNumber: { type: 'number', description: 'Target funnel step (0-indexed)' },
        mode: { type: 'string', enum: ['dropped', 'reached'], description: 'Filter by dropped or reached' },
        steps: { type: 'string', description: 'JSON array of funnel steps' },
        ...paginationSchema,
      },
      required: ['siteId', 'stepNumber', 'mode', 'steps'],
    },
  },
  {
    name: 'rybbit_create_funnel',
    description: 'Create or update a saved funnel',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        name: { type: 'string', description: 'Funnel name' },
        steps: { type: 'string', description: 'JSON array of funnel steps' },
        reportId: { type: 'number', description: 'Optional report ID for updating' },
      },
      required: ['siteId', 'name', 'steps'],
    },
  },
  // Performance Tools
  {
    name: 'rybbit_get_performance_overview',
    description: 'Get Core Web Vitals and performance metrics overview (LCP, CLS, INP, FCP, TTFB percentiles)',
    inputSchema: {
      type: 'object',
      properties: { ...siteIdSchema, ...timeParamsSchema },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_performance_timeseries',
    description: 'Get performance metrics over time for trend analysis',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        bucket: { type: 'string', enum: ['minute', 'five_minutes', 'hour', 'day', 'week', 'month'], description: 'Time bucket granularity' },
      },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_performance_by_dimension',
    description: 'Get performance metrics broken down by a specific dimension (pathname, country, browser, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        dimension: { type: 'string', description: 'Breakdown dimension (pathname, country, browser, etc.)' },
        ...paginationSchema,
        sortBy: { type: 'string', description: 'Metric to sort by' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction' },
      },
      required: ['siteId', 'dimension'],
    },
  },

  // Error Tracking Tools
  {
    name: 'rybbit_get_error_names',
    description: 'Get unique error messages with occurrence and session counts',
    inputSchema: {
      type: 'object',
      properties: { ...siteIdSchema, ...timeParamsSchema, ...paginationSchema },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_error_events',
    description: 'Get individual error occurrences with full context including stack traces',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        errorMessage: { type: 'string', description: 'Filter by specific error message' },
        ...paginationSchema,
      },
      required: ['siteId', 'errorMessage'],
    },
  },
  {
    name: 'rybbit_get_error_timeseries',
    description: 'Get error occurrence trends over time',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        errorMessage: { type: 'string', description: 'Filter by error message' },
        bucket: { type: 'string', enum: ['hour', 'day', 'week', 'month'], description: 'Time bucket granularity' },
      },
      required: ['siteId', 'errorMessage'],
    },
  },

  // Retention & Journeys Tools
  {
    name: 'rybbit_get_retention',
    description: 'Get cohort-based retention analysis data',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        mode: { type: 'string', enum: ['day', 'week'], description: 'Retention period granularity' },
        range: { type: 'number', description: 'Analysis window in days (7-365, default: 90)' },
      },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_journeys',
    description: 'Get the most common page navigation paths (user journeys) within sessions',
    inputSchema: {
      type: 'object',
      properties: {
        ...siteIdSchema,
        ...timeParamsSchema,
        steps: { type: 'number', description: 'Maximum journey steps (2-10, default: 3)' },
        limit: { type: 'number', description: 'Results returned (1-500, default: 100)' },
        stepFilters: { type: 'string', description: 'JSON object filtering specific steps (e.g., {"0":"/"})' },
      },
      required: ['siteId'],
    },
  },

  // Organizations & Sites Tools
  {
    name: 'rybbit_get_organizations',
    description: 'Get all organizations the authenticated user is a member of',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'rybbit_get_organization_members',
    description: 'Get members of a specific organization',
    inputSchema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization identifier' },
      },
      required: ['organizationId'],
    },
  },
  {
    name: 'rybbit_get_site',
    description: 'Get site details and configuration (domain, privacy settings, tracking flags)',
    inputSchema: {
      type: 'object',
      properties: { ...siteIdSchema },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_excluded_ips',
    description: 'Get the list of IP addresses excluded from analytics tracking for a site',
    inputSchema: {
      type: 'object',
      properties: { ...siteIdSchema },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_excluded_countries',
    description: 'Get the list of country codes excluded from analytics tracking for a site',
    inputSchema: {
      type: 'object',
      properties: { ...siteIdSchema },
      required: ['siteId'],
    },
  },
  {
    name: 'rybbit_get_private_link_config',
    description: 'Get the read-only private share-link configuration for a site',
    inputSchema: {
      type: 'object',
      properties: { ...siteIdSchema },
      required: ['siteId'],
    },
  },
];

// Tool handlers
async function handleToolCall(name, args) {
  const siteId = args.siteId;
  const timeParams = buildTimeParams({
    startDate: args.startDate,
    endDate: args.endDate,
    timeZone: args.timeZone,
    pastMinutesStart: args.pastMinutesStart,
    pastMinutesEnd: args.pastMinutesEnd,
    filters: args.filters ? JSON.parse(args.filters) : undefined,
  });

  switch (name) {
    // Overview
    case 'rybbit_get_overview':
      return client.get(`/api/sites/${siteId}/overview`, timeParams);

    case 'rybbit_get_overview_timeseries':
      return client.get(`/api/sites/${siteId}/overview-bucketed`, { ...timeParams, bucket: args.bucket });

    case 'rybbit_get_metric':
      return client.get(`/api/sites/${siteId}/metric`, { ...timeParams, parameter: args.parameter, limit: args.limit, page: args.page });

    case 'rybbit_get_live_visitors':
      return client.get(`/api/sites/${siteId}/live-user-count`, { minutes: args.minutes });

    // Sessions
    case 'rybbit_get_sessions':
      return client.get(`/api/sites/${siteId}/sessions`, {
        ...timeParams,
        page: args.page,
        limit: args.limit,
        user_id: args.userId,
        identified_only: args.identifiedOnly?.toString(),
      });

    case 'rybbit_get_session_details':
      return client.get(`/api/sites/${siteId}/sessions/${args.sessionId}`, {
        limit: args.limit,
        offset: args.offset,
        minutes: args.minutes,
      });

    case 'rybbit_get_session_locations':
      return client.get(`/api/sites/${siteId}/session-locations`, timeParams);

    // Events
    case 'rybbit_get_events':
      return client.get(`/api/sites/${siteId}/events`, { ...timeParams, page: args.page, page_size: args.pageSize, since_timestamp: args.sinceTimestamp, before_timestamp: args.beforeTimestamp });

    case 'rybbit_get_event_names':
      return client.get(`/api/sites/${siteId}/events/names`, timeParams);

    case 'rybbit_get_event_properties':
      return client.get(`/api/sites/${siteId}/events/properties`, { ...timeParams, event_name: args.eventName });

    case 'rybbit_get_outbound_links':
      return client.get(`/api/sites/${siteId}/events/outbound`, timeParams);

    // Users
    case 'rybbit_get_users':
      return client.get(`/api/sites/${siteId}/users`, {
        ...timeParams,
        page: args.page,
        page_size: args.pageSize,
        sort_by: args.sortBy,
        sort_order: args.sortOrder,
        identified_only: args.identifiedOnly?.toString(),
      });

    case 'rybbit_get_user_sessions':
      return client.get(`/api/sites/${siteId}/users/${args.userId}/sessions`);

    case 'rybbit_get_user_session_count':
      return client.get(`/api/sites/${siteId}/users/session-count`, { user_id: args.userId, time_zone: args.timeZone });

    case 'rybbit_get_user_info':
      return client.get(`/api/sites/${siteId}/users/${args.userId}`);

    // Goals
    case 'rybbit_get_goals':
      return client.get(`/api/sites/${siteId}/goals`, { ...timeParams, page: args.page, page_size: args.limit, sort: args.sort, order: args.order });

    case 'rybbit_get_goal_sessions':
      return client.get(`/api/sites/${siteId}/goals/${args.goalId}/sessions`, { page: args.page, limit: args.limit });

    case 'rybbit_create_goal': {
      const config = args.goalType === 'path'
        ? { pathPattern: args.pathPattern }
        : { eventName: args.eventName, eventPropertyKey: args.eventPropertyKey, eventPropertyValue: args.eventPropertyValue };
      return client.post(`/api/sites/${siteId}/goals`, { name: args.name, goalType: args.goalType, config });
    }

    case 'rybbit_update_goal': {
      const config = args.goalType === 'path'
        ? { pathPattern: args.pathPattern }
        : { eventName: args.eventName, eventPropertyKey: args.eventPropertyKey, eventPropertyValue: args.eventPropertyValue };
      return client.put(`/api/sites/${siteId}/goals/${args.goalId}`, { name: args.name, goalType: args.goalType, config });
    }

    // Funnels
    case 'rybbit_get_funnels':
      return client.get(`/api/sites/${siteId}/funnels`);

    case 'rybbit_analyze_funnel':
      return client.post(`/api/sites/${siteId}/funnels/analyze`, { steps: JSON.parse(args.steps) }, timeParams);

    case 'rybbit_get_funnel_step_sessions':
      return client.post(`/api/sites/${siteId}/funnels/${args.stepNumber}/sessions`, { steps: JSON.parse(args.steps) }, { ...timeParams, mode: args.mode, page: args.page, limit: args.limit });

    case 'rybbit_create_funnel':
      return client.post(`/api/sites/${siteId}/funnels`, { name: args.name, steps: JSON.parse(args.steps), reportId: args.reportId });

    // Performance
    case 'rybbit_get_performance_overview':
      return client.get(`/api/sites/${siteId}/performance/overview`, timeParams);

    case 'rybbit_get_performance_timeseries':
      return client.get(`/api/sites/${siteId}/performance/time-series`, { ...timeParams, bucket: args.bucket });

    case 'rybbit_get_performance_by_dimension':
      return client.get(`/api/sites/${siteId}/performance/by-dimension`, {
        ...timeParams,
        dimension: args.dimension,
        page: args.page,
        limit: args.limit,
        sort_by: args.sortBy,
        sort_order: args.sortOrder,
      });

    // Errors
    case 'rybbit_get_error_names':
      return client.get(`/api/sites/${siteId}/error-names`, { ...timeParams, page: args.page, limit: args.limit });

    case 'rybbit_get_error_events':
      return client.get(`/api/sites/${siteId}/error-events`, { ...timeParams, errorMessage: args.errorMessage, page: args.page, limit: args.limit });

    case 'rybbit_get_error_timeseries':
      return client.get(`/api/sites/${siteId}/error-bucketed`, { ...timeParams, errorMessage: args.errorMessage, bucket: args.bucket });

    // Retention & Journeys
    case 'rybbit_get_retention':
      return client.get(`/api/sites/${siteId}/retention`, { mode: args.mode, range: args.range });

    case 'rybbit_get_journeys':
      return client.get(`/api/sites/${siteId}/journeys`, {
        ...timeParams,
        steps: args.steps,
        limit: args.limit,
        stepFilters: args.stepFilters,
      });

    // Organizations
    case 'rybbit_get_organizations':
      return client.get('/api/organizations');

    case 'rybbit_get_organization_members':
      return client.get(`/api/organizations/${args.organizationId}/members`);

    // Sites
    case 'rybbit_get_site':
      return client.get(`/api/sites/${siteId}`);

    case 'rybbit_get_excluded_ips':
      return client.get(`/api/sites/${siteId}/excluded-ips`);

    case 'rybbit_get_excluded_countries':
      return client.get(`/api/sites/${siteId}/excluded-countries`);

    case 'rybbit_get_private_link_config':
      return client.get(`/api/sites/${siteId}/private-link-config`);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Create MCP server
const server = new Server(
  {
    name: 'rybbit-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await handleToolCall(name, args || {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Rybbit MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
