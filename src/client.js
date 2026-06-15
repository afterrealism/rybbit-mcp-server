/**
 * Rybbit API Client
 * Handles authentication and HTTP requests to the Rybbit Analytics API
 */

const BASE_URL = process.env.RYBBIT_URL || 'https://app.rybbit.io';

export class RybbitClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Make an authenticated request to the Rybbit API
   */
  async request(method, path, options = {}) {
    const { body, params } = options;

    let url = `${BASE_URL}${path}`;

    console.error(`[Rybbit] ${method} ${url}`);
    console.error(`[Rybbit] API Key present: ${!!this.apiKey}, length: ${this.apiKey?.length || 0}`);

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const fetchOptions = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Rybbit API error (${response.status}) - URL: ${url} - Response: ${errorText}`);
    }

    return response.json();
  }

  get(path, params) {
    return this.request('GET', path, { params });
  }

  post(path, body, params) {
    return this.request('POST', path, { body, params });
  }

  put(path, body) {
    return this.request('PUT', path, { body });
  }
}

/**
 * Build common query parameters for time-based queries
 */
export function buildTimeParams(options) {
  const params = {};

  if (options.startDate) params.start_date = options.startDate;
  if (options.endDate) params.end_date = options.endDate;
  if (options.timeZone) params.time_zone = options.timeZone;
  if (options.pastMinutesStart !== undefined) params.past_minutes_start = options.pastMinutesStart;
  if (options.pastMinutesEnd !== undefined) params.past_minutes_end = options.pastMinutesEnd;
  if (options.filters) params.filters = JSON.stringify(options.filters);

  return params;
}
