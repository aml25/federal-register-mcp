# Federal Register MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that provides AI assistants with access to the [Federal Register API](https://www.federalregister.gov/developers/documentation/api/v1). This enables searching and retrieving executive orders, presidential documents, rules, and agency information.

## What is MCP?

MCP is a protocol that allows AI assistants like Claude to interact with external tools and data sources. This server exposes Federal Register data as a set of tools that can be called by AI assistants.

## Features

- **Executive Orders**: Search, retrieve, and get full text of executive orders by president, year, date range, or keyword
- **Presidential Documents**: Search memoranda and proclamations
- **Federal Register Documents**: Search and retrieve any document type (rules, proposed rules, notices)
- **Agency Information**: List all federal agencies or get details about specific agencies
- **Public Inspection**: View documents before official publication

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/federal-register-mcp.git
cd federal-register-mcp

# Install dependencies
npm install
```

## Usage

This server supports two transport modes:

| Mode | Transport | Use Case |
|------|-----------|----------|
| **stdio** (default) | Standard I/O | Claude Desktop (local) |
| **http** | Streamable HTTP | Claude Code, ChatGPT, remote clients |

### Claude Desktop (stdio mode)

Add this to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "federal-register": {
      "command": "node",
      "args": ["/path/to/federal-register-mcp/src/server.js"]
    }
  }
}
```

### Claude Code (stdio or HTTP mode)

**Option 1: stdio (local)**

```json
{
  "mcpServers": {
    "federal-register": {
      "command": "node",
      "args": ["/path/to/federal-register-mcp/src/server.js"]
    }
  }
}
```

**Option 2: HTTP (local or remote)**

Start the server in HTTP mode:
```bash
npm run start:http
```

Then configure Claude Code to connect to the HTTP endpoint:
```json
{
  "mcpServers": {
    "federal-register": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### ChatGPT (HTTP mode, requires public URL)

ChatGPT cannot connect to localhost. You need to expose the server publicly:

**Option 1: ngrok (for development)**

```bash
# Terminal 1: Start the server
npm run start:http

# Terminal 2: Create a tunnel
ngrok http 3000
```

Then use the ngrok URL (e.g., `https://abc123.ngrok.io/mcp`) in ChatGPT.

**Option 2: Deploy to a cloud host (for production)**

Deploy to any HTTPS-capable host:
- Cloudflare Workers
- Fly.io
- Railway
- Vercel
- AWS / GCP / Azure

The MCP endpoint will be at `https://your-host.com/mcp`.

### Running Directly

```bash
# stdio mode (default) - for Claude Desktop
npm start

# HTTP mode - for Claude Code, ChatGPT
npm run start:http

# HTTP mode with custom port
node src/server.js --http --port 8080

# Or use environment variable
MCP_PORT=8080 npm run start:http
```

### Health Check (HTTP mode)

When running in HTTP mode, a health endpoint is available:

```bash
curl http://localhost:3000/health
# {"status":"ok","mode":"http","sessions":0}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `search_executive_orders` | Search for executive orders by president, year, date range, or keyword |
| `get_executive_order` | Get a specific executive order by its EO number |
| `get_executive_order_full_text` | Fetch the complete full text of an executive order |
| `get_recent_executive_orders` | Get executive orders signed in the last 30 days |
| `search_documents` | Search all Federal Register documents with flexible filtering |
| `get_document` | Fetch a Federal Register document by its document number |
| `get_document_text` | Fetch the full plain text content of a document |
| `search_presidential_memoranda` | Search for presidential memoranda |
| `search_proclamations` | Search for presidential proclamations |
| `get_public_inspection_documents` | Get documents currently on public inspection |
| `get_agencies` | Get a list of all federal agencies |
| `get_agency` | Get detailed information about a specific agency |

## Example Queries

Once configured, you can ask Claude questions like:

- "What executive orders has Joe Biden signed about climate change?"
- "Show me Trump's executive orders from his second term (2025)"
- "Get the full text of Executive Order 14067"
- "What documents are on public inspection today?"
- "Find all proposed rules from the EPA in 2024"

## API Reference

This server uses the Federal Register API v1. The API is free and requires no authentication.

- [Federal Register API Documentation](https://www.federalregister.gov/developers/documentation/api/v1)
- [Federal Register Developers Page](https://www.federalregister.gov/developers)

## Project Structure

```
federal-register-mcp/
├── src/
│   ├── server.js              # MCP server implementation
│   └── federal-register-api.js # Federal Register API client
├── package.json
└── README.md
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
