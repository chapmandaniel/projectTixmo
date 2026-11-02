import type { HttpClient, HttpRequest, HttpResponse } from './types.js';

export const createFetchClient = (timeoutMs = 20_000): HttpClient => ({
  async request(url: string, init?: HttpRequest): Promise<HttpResponse> {
    const response = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: init?.headers,
      body: init?.body,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      status: response.status,
      url: response.url || url,
      body: await response.text(),
    };
  },
});

export const readJson = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
};
