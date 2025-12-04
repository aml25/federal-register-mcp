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

### With Claude Desktop

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

### With Claude Code

Add this to your Claude Code MCP settings:

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

### Running Directly

```bash
npm start
```

The server communicates via stdio and is designed to be run as a subprocess by an MCP client.

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
