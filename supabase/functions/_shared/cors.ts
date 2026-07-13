const allowedOrigins = new Set([
  'https://laeetii.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

export function corsHeaders(request: Request, methods: string): Record<string, string> | null {
  const origin = request.headers.get('Origin');
  if (origin && !allowedOrigins.has(origin)) return null;

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': methods,
    'Vary': 'Origin',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function withCors(response: Response, headers: Record<string, string>): Response {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
  return response;
}
