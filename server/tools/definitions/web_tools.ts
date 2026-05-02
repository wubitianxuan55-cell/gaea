import { ToolRegistry } from '../registry';

async function webSearchHandler(args: Record<string, any>): Promise<string> {
  const query = String(args.query || '');
  if (!query.trim()) throw new Error('Search query is required.');

  const maxResults = Math.min(Math.max(Number(args.maxResults) || 5, 1), 10);

  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`DuckDuckGo API returned ${response.status}`);
    }

    const data = await response.json() as any;
    const results: string[] = [];

    if (data.AbstractText) {
      results.push(`Abstract: ${data.AbstractText}${data.AbstractURL ? ` (${data.AbstractURL})` : ''}`);
    }

    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, maxResults)) {
        if (topic.Text && topic.FirstURL) {
          results.push(`${topic.Text} — ${topic.FirstURL}`);
        }
      }
    }

    if (data.Results && Array.isArray(data.Results)) {
      for (const r of data.Results.slice(0, maxResults)) {
        if (r.Text && r.FirstURL) {
          results.push(`${r.Text} — ${r.FirstURL}`);
        }
      }
    }

    return results.length > 0
      ? results.join('\n\n')
      : `No results found for "${query}".`;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return `Web search timed out for query "${query}".`;
    }
    return `Web search failed: ${err.message}`;
  }
}

async function urlFetchHandler(args: Record<string, any>): Promise<string> {
  const url = String(args.url || '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('URL must start with http:// or https://');
  }

  const maxChars = Math.min(Math.max(Number(args.maxChars) || 10000, 100), 50000);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'LumiAI/2.0 (Agent Tool)' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/') && !contentType.includes('application/json') && !contentType.includes('application/xml')) {
      throw new Error(`Unsupported content type: ${contentType}. Only text, JSON, and XML are supported.`);
    }

    let text = await response.text();
    // Strip HTML tags
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    // Collapse whitespace
    text = text.replace(/\s+/g, ' ').trim();

    if (text.length > maxChars) {
      text = text.slice(0, maxChars) + `\n\n[Truncated at ${maxChars} characters]`;
    }

    return text || '(No text content extracted)';
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return `URL fetch timed out for "${url}".`;
    }
    return `URL fetch failed: ${err.message}`;
  }
}

export function registerWebOpsTools(registry: ToolRegistry): void {
  registry.register({
    name: 'web_search',
    description: 'Search the web using DuckDuckGo Instant Answers. Returns formatted results with titles and URLs.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query string' },
        maxResults: { type: 'number', description: 'Maximum results (1-10, default 5)' },
      },
      required: ['query'],
    },
    handler: webSearchHandler,
    permission: 'user',
  });

  registry.register({
    name: 'url_fetch',
    description: 'Fetch and extract text content from a URL. Strips HTML tags and returns plain text.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch (must start with http:// or https://)' },
        maxChars: { type: 'number', description: 'Maximum characters to return (default 10000, max 50000)' },
      },
      required: ['url'],
    },
    handler: urlFetchHandler,
    permission: 'user',
  });
}
