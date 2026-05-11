import { type OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import { searxngConfigSchema } from "./config.js";

const searxngPlugin = {
  id: "search-searxng",
  name: "Search (SearXNG)",
  description: "Privacy-respecting metasearch plugin",
  kind: "search" as const,
  configSchema: searxngConfigSchema,

  register(api: OpenClawPluginApi) {
    const cfg = api.pluginConfig as { baseUrl: string; apiKey?: string; maxResults?: number };

    api.logger.info(`search-searxng: plugin registered (url: ${cfg.baseUrl})`);

    api.registerTool(
      {
        name: "searxng_search",
        label: "SearXNG Search",
        description: "Search the web using SearXNG. Returns structured results natively supporting privacy-respecting metasearch.",
        parameters: Type.Object({
          query: Type.String({ description: "Search query string." }),
          count: Type.Optional(
            Type.Number({
              description: "Number of results to return (1-10).",
              minimum: 1,
              maximum: 10,
            })
          ),
          language: Type.Optional(
            Type.String({
              description: "ISO 639-1 language code for results (e.g., 'en', 'de', 'fr').",
            })
          ),
          freshness: Type.Optional(
            Type.String({
              description: "Filter by time: 'day' (24h), 'week', 'month', or 'year'.",
            })
          ),
        }),
        async execute(_toolCallId: string, params: any) {
          const { query, language, freshness } = params as any;
          
          // M-1: Enforce parameter bounds at the plugin level
          const count = Math.max(1, Math.min(10, params.count ?? cfg.maxResults ?? 5));

          // M-2: Validate language and freshness
          const VALID_LANGUAGES = /^[a-z]{2}(-[A-Z]{2})?$/;
          const VALID_FRESHNESS = /^(day|week|month|year)$/;
          
          const safeLanguage = language && VALID_LANGUAGES.test(language) ? language : undefined;
          const safeFreshness = freshness && VALID_FRESHNESS.test(freshness) ? freshness : undefined;
          
          try {
            const url = new URL(cfg.baseUrl);
            url.pathname = url.pathname.replace(/\/$/, "") + "/search";
            url.searchParams.set("q", query);
            url.searchParams.set("format", "json");
            if (safeLanguage) url.searchParams.set("language", safeLanguage);
            if (safeFreshness) url.searchParams.set("time_range", safeFreshness);

            const headers: Record<string, string> = {
              Accept: "application/json",
            };
            if (cfg.apiKey) {
              headers["Authorization"] = `Bearer ${cfg.apiKey}`;
            }

            const response = await fetch(url.toString(), {
              method: "GET",
              headers,
              signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
              const errorText = await response.text();
              // H-1: Sanitize error messages to prevent information leakage
              const safeMessage = response.status >= 500
                ? `SearXNG API error (${response.status})`
                : `Search API error: ${errorText.substring(0, 100)}`;
              throw new Error(safeMessage);
            }

            if (!response.body) throw new Error("Empty response body from SearXNG.");
            
            // M-3: No Content-Length Guard on HTTP Response
            const contentLength = parseInt(response.headers.get('content-length') || '0');
            if (contentLength > 5 * 1024 * 1024) throw new Error("SearXNG response too large");
            
            const reader = response.body.getReader();
            let receivedLength = 0;
            const chunks: Uint8Array[] = [];
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                receivedLength += value.length;
                if (receivedLength > 5 * 1024 * 1024) {
                  throw new Error("SearXNG response exceeded 5MB size limit.");
                }
                chunks.push(value);
              }
            }
            
            const buffer = new Uint8Array(receivedLength);
            let position = 0;
            for (const chunk of chunks) {
              buffer.set(chunk, position);
              position += chunk.length;
            }
            const data = JSON.parse(new TextDecoder().decode(buffer)) as any;
            const results = Array.isArray(data.results) ? data.results.slice(0, count) : [];
            
            if (results.length === 0) {
              return {
                content: [{ type: "text", text: "No results found." }],
                details: {}
              };
            }

            const escapeHtml = (s: string) => s
              .replace(/&/g, '&amp;').replace(/</g, '&lt;')
              .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');

            const formatted = results.map((entry: any, i: number) => {
              // L-1: Unchecked Result Fields - ensure null checks and escaping
              const title = entry?.title ? escapeHtml(entry.title) : "No Title";
              const url = entry?.url ? escapeHtml(entry.url) : "";
              const content = entry?.content ? escapeHtml(entry.content) : "";
              const published = entry?.publishedDate ? escapeHtml(entry.publishedDate) : "";

              const parts = [
                `${i + 1}. [${title}](${url})`,
                content ? `   Snippet: ${content}` : "",
                published ? `   Date: ${published}` : ""
              ].filter(Boolean);
              return parts.join("\n");
            }).join("\n\n");
            
            // Mitigate Prompt Injection by sanitizing termination tags and wrapping in a semantic untrusted block
            const sanitized = formatted.replace(/<\/external-content>/gi, "[external-content tag removed]");
            const safeContent = `<external-content source="web_search" provider="searxng" untrusted="true" wrapped="true">\nFound ${results.length} results:\n\n${sanitized}\n</external-content>`;

            return {
              content: [{ type: "text", text: safeContent }],
              details: { results }
            };
          } catch (err) {
            // H-1: Sanitize error messages in tool failure response
            const safeError = err instanceof Error ? err.message : 'Search service unavailable';
            api.logger.error(`search-searxng: tool failed - ${safeError}`);
            return {
              content: [{ type: "text", text: `SearXNG search error: ${safeError}` }],
              details: { error: safeError }
            };
          }
        },
      },
      { name: "searxng_search" },
    );
  },
};

export default searxngPlugin;
