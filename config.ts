import { Type } from "@sinclair/typebox";

export const searxngConfigSchema = Type.Object({
  baseUrl: Type.String({
    description: "The base URL for the SearXNG instance (e.g. 'https://searx.example.com').",
  }),
  apiKey: Type.Optional(
    Type.String({
      description: "Optional API key for authenticated instances. Sent as Bearer token.",
    })
  ),
  maxResults: Type.Optional(
    Type.Number({
      description: "Default maximum number of results to return.",
      default: 5
    })
  )
});
