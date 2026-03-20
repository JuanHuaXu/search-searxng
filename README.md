# OpenClaw Search (SearXNG) Plugin

A privacy-respecting search plugin for OpenClaw that integrates with [SearXNG](https://github.com/searxng/searxng).

## Features

- **Privacy-First**: Metasearch that aggregates results without tracking.
- **Structured Results**: Returns clean, Markdown-formatted results to providers.
- **Safety**: Includes built-in prompt injection mitigation for external content.
- **Configurable**: Support for results count, language, and freshness filters.

## Installation

1. Clone this repository into your OpenClaw extensions directory:
   ```bash
   cd ~/.openclaw/extensions
   git clone <repository-url> search-searxng
   ```
2. Install dependencies:
   ```bash
   cd search-searxng
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```

## Configuration

Add the plugin to your `openclaw.json` configuration:

```json
{
  "plugins": {
    "entries": {
      "search-searxng": {
        "config": {
          "baseUrl": "https://searx.be",
          "maxResults": 5
        }
      }
    },
    "allow": ["search-searxng"]
  }
}
```

### Configuration Options

| Option | Type | Description |
| :--- | :--- | :--- |
| `baseUrl` | `string` | **Required.** The base URL of your SearXNG instance. |
| `apiKey` | `string` | *Optional.* API key if your instance requires authentication. |
| `maxResults` | `number` | *Optional.* Default number of results to fetch (default: 5). |

## Usage

Once enabled, the plugin registers a new tool: `searxng_search`.

### Tool: `searxng_search`

Aggregates web results based on a query.

**Parameters:**
- `query` (string): The search term.
- `count` (number, optional): Number of results (1-10).
- `language` (string, optional): ISO language code (e.g., 'en').
- `freshness` (string, optional): Time filter ('day', 'week', 'month', 'year').
