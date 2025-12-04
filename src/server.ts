/**
 * Federal Register MCP Server
 *
 * A Model Context Protocol (MCP) server that provides AI assistants with
 * access to the Federal Register API. This enables searching and retrieving
 * executive orders, presidential documents, rules, and agency information.
 *
 * Supports two transport modes:
 *   - stdio: For local use with Claude Desktop (default)
 *   - http: For remote use with Claude Code, ChatGPT, and other clients
 *
 * Usage:
 *   stdio mode: node dist/server.js
 *   http mode:  node dist/server.js --http [--port 3000]
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import express, { Request, Response } from 'express';

import * as api from './federal-register-api.js';

// =============================================================================
// TYPES & HELPERS
// =============================================================================

interface TextContent {
  type: 'text';
  text: string;
  [key: string]: unknown;
}

interface ToolResult {
  content: TextContent[];
  [key: string]: unknown;
}

function textResult(text: string): ToolResult {
  return {
    content: [{ type: 'text' as const, text }]
  };
}

function jsonResult(data: unknown): ToolResult {
  return textResult(JSON.stringify(data, null, 2));
}

// =============================================================================
// COMMAND LINE ARGUMENT PARSING
// =============================================================================

const args = process.argv.slice(2);
const useHttp = args.includes('--http');
const portIndex = args.indexOf('--port');
const HTTP_PORT = portIndex !== -1 && args[portIndex + 1]
  ? parseInt(args[portIndex + 1], 10)
  : (process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3000);

// =============================================================================
// SERVER INITIALIZATION
// =============================================================================

/**
 * Create the MCP server instance.
 * Returns a new instance each time for HTTP mode (per-session servers).
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: 'federal-register',
    version: '1.0.0'
  });

  // ===========================================================================
  // TOOL REGISTRATION
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Executive Order Tools
  // ---------------------------------------------------------------------------

  server.registerTool(
    'search_executive_orders',
    {
      description: 'Search for executive orders by president, year, date range, or keyword. Returns a list of matching executive orders with metadata including title, signing date, and document links.',
      inputSchema: {
        president: z.string().optional().describe('President slug (e.g., "joe-biden", "donald-trump", "barack-obama", "george-w-bush")'),
        year: z.number().optional().describe('Publication year (e.g., 2024)'),
        term: z.string().optional().describe('Search term to find in executive orders'),
        signing_date_gte: z.string().optional().describe('Signing date greater than or equal to (YYYY-MM-DD format)'),
        signing_date_lte: z.string().optional().describe('Signing date less than or equal to (YYYY-MM-DD format)'),
        per_page: z.number().optional().describe('Number of results per page (default 20, max 1000)'),
        page: z.number().optional().describe('Page number for pagination')
      }
    },
    async (args) => {
      const result = await api.searchExecutiveOrders({
        president: args.president,
        year: args.year,
        term: args.term,
        signingDateGte: args.signing_date_gte,
        signingDateLte: args.signing_date_lte,
        per_page: args.per_page,
        page: args.page
      });
      return jsonResult(result);
    }
  );

  server.registerTool(
    'get_executive_order',
    {
      description: 'Get a specific executive order by its EO number (e.g., 14067). Returns detailed information including title, abstract, signing date, and links to full text.',
      inputSchema: {
        eo_number: z.number().describe('The executive order number (e.g., 14067)')
      }
    },
    async (args) => {
      const result = await api.getExecutiveOrderByNumber(args.eo_number);
      if (!result) {
        return textResult(`Executive order ${args.eo_number} not found.`);
      }
      return jsonResult(result);
    }
  );

  server.registerTool(
    'get_executive_order_full_text',
    {
      description: 'Fetch the complete full text of a specific executive order by its EO number. The full text provides detailed policy language, specific directives, legal citations, and implementation details that are not available in abstracts or titles.',
      inputSchema: {
        eo_number: z.number().describe('The executive order number (e.g., 14067, 13769)')
      }
    },
    async (args) => {
      const result = await api.getExecutiveOrderFullText(args.eo_number);
      if (!result) {
        return textResult(`Executive order ${args.eo_number} not found.`);
      }
      return jsonResult(result);
    }
  );

  server.registerTool(
    'get_recent_executive_orders',
    {
      description: 'Get executive orders signed in the last 30 days. Useful for monitoring recent executive actions.'
    },
    async () => {
      const result = await api.getRecentExecutiveOrders();
      return jsonResult(result);
    }
  );

  // ---------------------------------------------------------------------------
  // General Document Tools
  // ---------------------------------------------------------------------------

  server.registerTool(
    'get_document',
    {
      description: 'Fetch a Federal Register document by its document number. Works for any document type (rules, notices, presidential documents). Document numbers are formatted as YYYY-NNNNN.',
      inputSchema: {
        document_number: z.string().describe('The Federal Register document number (e.g., "2024-02154")'),
        fields: z.array(z.string()).optional().describe('Specific fields to include (e.g., ["title", "abstract", "pdf_url"]). If omitted, returns all fields.')
      }
    },
    async (args) => {
      const result = await api.getDocument(args.document_number, args.fields ?? null);
      return jsonResult(result);
    }
  );

  server.registerTool(
    'get_document_text',
    {
      description: 'Fetch the full plain text content of a Federal Register document. First use get_document to get the raw_text_url, then pass it here.',
      inputSchema: {
        raw_text_url: z.string().describe('The raw_text_url from a document response')
      }
    },
    async (args) => {
      const result = await api.fetchDocumentText(args.raw_text_url);
      return textResult(result);
    }
  );

  server.registerTool(
    'search_documents',
    {
      description: 'Search all Federal Register documents with flexible filtering. Use for rules, proposed rules, notices, or presidential documents. Supports full-text search, date ranges, and filtering by agency or president.',
      inputSchema: {
        term: z.string().optional().describe('Full text search term'),
        type: z.enum(['RULE', 'PRORULE', 'NOTICE', 'PRESDOCU']).optional().describe('Document type: RULE (final rule), PRORULE (proposed rule), NOTICE, PRESDOCU (presidential document)'),
        presidential_document_type: z.enum(['executive_order', 'memorandum', 'proclamation', 'determination', 'notice']).optional().describe('For presidential documents, the specific type'),
        president: z.string().optional().describe('President slug (e.g., "joe-biden")'),
        agency: z.string().optional().describe('Agency slug (e.g., "environmental-protection-agency")'),
        publication_date_gte: z.string().optional().describe('Publication date >= (YYYY-MM-DD)'),
        publication_date_lte: z.string().optional().describe('Publication date <= (YYYY-MM-DD)'),
        publication_year: z.number().optional().describe('Exact publication year'),
        per_page: z.number().optional().describe('Results per page (default 20, max 1000)'),
        page: z.number().optional().describe('Page number')
      }
    },
    async (args) => {
      const conditions: Record<string, unknown> = {};
      if (args.term) conditions.term = args.term;
      if (args.type) conditions.type = args.type;
      if (args.presidential_document_type) {
        conditions.presidential_document_type = args.presidential_document_type;
      }
      if (args.president) conditions.president = args.president;
      if (args.agency) conditions.agencies = args.agency;

      if (args.publication_year) {
        conditions.publication_date = { year: args.publication_year };
      } else if (args.publication_date_gte || args.publication_date_lte) {
        conditions.publication_date = {} as Record<string, string>;
        if (args.publication_date_gte) {
          (conditions.publication_date as Record<string, string>).gte = args.publication_date_gte;
        }
        if (args.publication_date_lte) {
          (conditions.publication_date as Record<string, string>).lte = args.publication_date_lte;
        }
      }

      const result = await api.searchDocuments({
        conditions,
        per_page: args.per_page,
        page: args.page
      });
      return jsonResult(result);
    }
  );

  // ---------------------------------------------------------------------------
  // Other Presidential Document Tools
  // ---------------------------------------------------------------------------

  server.registerTool(
    'search_presidential_memoranda',
    {
      description: 'Search for presidential memoranda by president, year, or keyword. Memoranda are similar to executive orders but typically used for less formal directives.',
      inputSchema: {
        president: z.string().optional().describe('President slug (e.g., "joe-biden")'),
        year: z.number().optional().describe('Publication year'),
        term: z.string().optional().describe('Search term'),
        per_page: z.number().optional().describe('Results per page'),
        page: z.number().optional().describe('Page number')
      }
    },
    async (args) => {
      const result = await api.searchPresidentialMemoranda({
        president: args.president,
        year: args.year,
        term: args.term,
        per_page: args.per_page,
        page: args.page
      });
      return jsonResult(result);
    }
  );

  server.registerTool(
    'search_proclamations',
    {
      description: 'Search for presidential proclamations by president, year, or keyword. Proclamations are formal announcements often used for holidays, awareness months, or trade actions.',
      inputSchema: {
        president: z.string().optional().describe('President slug (e.g., "joe-biden")'),
        year: z.number().optional().describe('Publication year'),
        term: z.string().optional().describe('Search term'),
        per_page: z.number().optional().describe('Results per page'),
        page: z.number().optional().describe('Page number')
      }
    },
    async (args) => {
      const result = await api.searchProclamations({
        president: args.president,
        year: args.year,
        term: args.term,
        per_page: args.per_page,
        page: args.page
      });
      return jsonResult(result);
    }
  );

  // ---------------------------------------------------------------------------
  // Public Inspection Tools
  // ---------------------------------------------------------------------------

  server.registerTool(
    'get_public_inspection_documents',
    {
      description: 'Get documents currently on public inspection (available before official publication in the Federal Register). Useful for seeing what will be published tomorrow.'
    },
    async () => {
      const result = await api.getPublicInspectionDocuments();
      return jsonResult(result);
    }
  );

  // ---------------------------------------------------------------------------
  // Agency Tools
  // ---------------------------------------------------------------------------

  server.registerTool(
    'get_agencies',
    {
      description: 'Get a list of all federal agencies in the Federal Register system. Returns name, slug, and description for each agency.'
    },
    async () => {
      const result = await api.getAgencies();
      return jsonResult(result);
    }
  );

  server.registerTool(
    'get_agency',
    {
      description: 'Get detailed information about a specific federal agency including description, URL, and recent document counts.',
      inputSchema: {
        slug: z.string().describe('Agency slug (e.g., "environmental-protection-agency", "securities-and-exchange-commission")')
      }
    },
    async (args) => {
      const result = await api.getAgency(args.slug);
      return jsonResult(result);
    }
  );

  return server;
}

// =============================================================================
// TRANSPORT: STDIO MODE
// =============================================================================

async function runStdioServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// =============================================================================
// TRANSPORT: HTTP MODE (Streamable HTTP)
// =============================================================================

async function runHttpServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  // Store transports by session ID
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  // Helper to check if request is an initialization request
  function isInitializeRequest(body: unknown): boolean {
    return typeof body === 'object' && body !== null && (body as { method?: string }).method === 'initialize';
  }

  // POST /mcp - Main MCP endpoint
  app.post('/mcp', async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport for this session
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request - create new transport and server
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId: string) => {
            console.log(`Session initialized: ${newSessionId}`);
            transports[newSessionId] = transport;
          }
        });

        // Clean up on close
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            console.log(`Session closed: ${sid}`);
            delete transports[sid];
          }
        };

        // Create and connect a new server instance for this session
        const server = createServer();
        await server.connect(transport);

        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        // Invalid request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided'
          },
          id: null
        });
        return;
      }

      // Handle request with existing transport
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        });
      }
    }
  });

  // GET /mcp - SSE stream for server-to-client notifications
  app.get('/mcp', async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  // DELETE /mcp - Session termination
  app.delete('/mcp', async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    try {
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('Error handling session termination:', error);
      if (!res.headersSent) {
        res.status(500).send('Error processing session termination');
      }
    }
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response): void => {
    res.json({ status: 'ok', mode: 'http', sessions: Object.keys(transports).length });
  });

  // Start the server
  app.listen(HTTP_PORT, () => {
    console.log(`Federal Register MCP Server (HTTP mode)`);
    console.log(`Listening on http://localhost:${HTTP_PORT}`);
    console.log(`MCP endpoint: http://localhost:${HTTP_PORT}/mcp`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    for (const sessionId in transports) {
      try {
        await transports[sessionId].close();
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error);
      }
    }
    process.exit(0);
  });
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  if (useHttp) {
    console.log('Starting in HTTP mode...');
    await runHttpServer();
  } else {
    await runStdioServer();
  }
}

main().catch(console.error);
