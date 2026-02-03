/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    url.host = 'api.anthropic.com';

    const requestWithAuth = new Request(request);
    requestWithAuth.headers.set("x-api-key", env.ANTHROPIC_API_KEY);

    return fetch(url.toString(), requestWithAuth);
  },
}
