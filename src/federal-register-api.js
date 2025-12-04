/**
 * Federal Register API Client
 *
 * A Node.js client for the Federal Register API v1, providing access to
 * executive orders, presidential documents, rules, notices, and agency information.
 *
 * API Documentation: https://www.federalregister.gov/developers/documentation/api/v1
 *
 * Key features:
 * - No API key required - all endpoints are publicly accessible
 * - Supports searching, filtering, and pagination
 * - Provides convenient helpers for common executive order queries
 *
 * @module federal-register-api
 */

// =============================================================================
// CONFIGURATION & CONSTANTS
// =============================================================================

/**
 * Base URL for all Federal Register API requests
 */
const BASE_URL = 'https://www.federalregister.gov/api/v1';

/**
 * Document type codes used by the Federal Register API.
 * Use these when filtering documents by type.
 */
const DOCUMENT_TYPES = {
  RULE: 'RULE',            // Final rules (regulations that have been finalized)
  PROPOSED_RULE: 'PRORULE', // Proposed rules (open for public comment)
  NOTICE: 'NOTICE',        // General notices from agencies
  PRESIDENTIAL: 'PRESDOCU' // Presidential documents (EOs, memoranda, proclamations)
};

/**
 * Presidential document subtypes.
 * Use these when filtering presidential documents by specific type.
 */
const PRESIDENTIAL_DOCUMENT_TYPES = {
  DETERMINATION: 'determination',    // Presidential determinations
  EXECUTIVE_ORDER: 'executive_order', // Executive orders (numbered directives)
  MEMORANDUM: 'memorandum',          // Presidential memoranda
  NOTICE: 'notice',                  // Presidential notices
  PROCLAMATION: 'proclamation'       // Presidential proclamations
};

// =============================================================================
// INTERNAL UTILITIES
// =============================================================================

/**
 * Builds a URL query string from a parameters object.
 *
 * Handles the Federal Register API's specific query format:
 * - conditions[key]=value for simple conditions
 * - conditions[key][subkey]=value for nested conditions (e.g., date ranges)
 * - conditions[key][]=value for array values
 * - fields[]=value for field selection
 *
 * @param {Object} params - Parameters to convert to query string
 * @param {Object} [params.conditions] - Search/filter conditions
 * @param {string[]} [params.fields] - Fields to include in response
 * @param {number} [params.per_page] - Results per page
 * @param {number} [params.page] - Page number
 * @param {string} [params.order] - Sort order
 * @returns {string} URL-encoded query string
 *
 * @example
 * buildQueryString({
 *   conditions: { president: 'joe-biden', publication_date: { year: 2024 } },
 *   per_page: 50
 * });
 * // Returns: "conditions[president]=joe-biden&conditions[publication_date][year]=2024&per_page=50"
 */
function buildQueryString(params) {
  const parts = [];

  // Helper to add a single key-value pair with URL encoding
  function addParam(key, value) {
    if (value !== undefined && value !== null) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }

  // Helper to recursively process conditions object
  function addConditions(conditions, prefix = 'conditions') {
    for (const [key, value] of Object.entries(conditions)) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Nested object: conditions[publication_date][year]=2024
        for (const [subKey, subValue] of Object.entries(value)) {
          addParam(`${prefix}[${key}][${subKey}]`, subValue);
        }
      } else if (Array.isArray(value)) {
        // Array: conditions[agencies][]=epa&conditions[agencies][]=fda
        for (const item of value) {
          addParam(`${prefix}[${key}][]`, item);
        }
      } else {
        // Simple value: conditions[president]=joe-biden
        addParam(`${prefix}[${key}]`, value);
      }
    }
  }

  // Process each parameter type
  if (params.conditions) {
    addConditions(params.conditions);
  }

  if (params.fields && params.fields.length > 0) {
    for (const field of params.fields) {
      addParam('fields[]', field);
    }
  }

  if (params.per_page) addParam('per_page', params.per_page);
  if (params.page) addParam('page', params.page);
  if (params.order) addParam('order', params.order);
  if (params.format) addParam('format', params.format);

  return parts.join('&');
}

/**
 * Makes an HTTP request to the Federal Register API.
 *
 * @param {string} endpoint - API endpoint path (e.g., '/documents.json')
 * @param {Object} [params={}] - Query parameters
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} If the API returns a non-OK status
 */
async function makeRequest(endpoint, params = {}) {
  const queryString = buildQueryString(params);
  const url = queryString
    ? `${BASE_URL}${endpoint}?${queryString}`
    : `${BASE_URL}${endpoint}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Federal Register API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// =============================================================================
// CORE DOCUMENT FUNCTIONS
// =============================================================================

/**
 * Fetches a single document by its Federal Register document number.
 *
 * Document numbers are unique identifiers assigned to each Federal Register
 * publication, formatted as YYYY-NNNNN (e.g., "2024-02154").
 *
 * @param {string} documentNumber - The document number (e.g., '2024-02154')
 * @param {string[]} [fields] - Specific fields to include (omit for all fields)
 * @returns {Promise<Object>} The document object
 *
 * @example
 * // Get all fields
 * const doc = await getDocument('2024-02154');
 *
 * // Get specific fields only
 * const doc = await getDocument('2024-02154', ['title', 'abstract', 'pdf_url']);
 */
async function getDocument(documentNumber, fields = null) {
  const params = {};
  if (fields && fields.length > 0) {
    params.fields = fields;
  }
  return makeRequest(`/documents/${documentNumber}.json`, params);
}

/**
 * Fetches multiple documents by their document numbers in a single request.
 *
 * More efficient than calling getDocument() multiple times when you need
 * several specific documents.
 *
 * @param {string[]} documentNumbers - Array of document numbers
 * @param {string[]} [fields] - Specific fields to include
 * @returns {Promise<Object>} Object containing results array
 *
 * @example
 * const docs = await getDocuments(['2024-02154', '2024-02155', '2024-02156']);
 */
async function getDocuments(documentNumbers, fields = null) {
  const params = {};
  if (fields && fields.length > 0) {
    params.fields = fields;
  }
  const numbers = documentNumbers.join(',');
  return makeRequest(`/documents/${numbers}.json`, params);
}

/**
 * Searches Federal Register documents with flexible filtering options.
 *
 * This is the most powerful search function, supporting:
 * - Full-text search
 * - Document type filtering
 * - Date range filtering
 * - President filtering (for presidential documents)
 * - Agency filtering
 * - Pagination
 *
 * @param {Object} [options={}] - Search options
 * @param {Object} [options.conditions] - Filter conditions
 * @param {string} [options.conditions.term] - Full-text search term
 * @param {string|string[]} [options.conditions.type] - Document type(s)
 * @param {string} [options.conditions.presidential_document_type] - Presidential doc subtype
 * @param {string} [options.conditions.president] - President slug (e.g., 'joe-biden')
 * @param {Object} [options.conditions.publication_date] - Date filter {year, gte, lte}
 * @param {Object} [options.conditions.signing_date] - Signing date filter {gte, lte}
 * @param {string|string[]} [options.conditions.agencies] - Agency slug(s)
 * @param {number} [options.conditions.correction] - 0=regular docs, 1=corrections only
 * @param {string[]} [options.fields] - Fields to include in response
 * @param {number} [options.per_page=20] - Results per page (max 1000)
 * @param {number} [options.page=1] - Page number
 * @param {string} [options.order] - Sort order ('relevance', 'newest', 'oldest', etc.)
 * @returns {Promise<Object>} Search results {count, total_pages, results[]}
 *
 * @example
 * const results = await searchDocuments({
 *   conditions: {
 *     term: 'climate change',
 *     type: 'PRESDOCU',
 *     presidential_document_type: 'executive_order',
 *     president: 'joe-biden'
 *   },
 *   fields: ['title', 'executive_order_number', 'signing_date'],
 *   per_page: 50
 * });
 */
async function searchDocuments(options = {}) {
  return makeRequest('/documents.json', options);
}

// =============================================================================
// EXECUTIVE ORDER FUNCTIONS
// =============================================================================

/**
 * Searches executive orders with a simplified interface.
 *
 * This is a convenience wrapper around searchDocuments() that pre-configures
 * the search for executive orders and provides a cleaner parameter interface.
 *
 * @param {Object} [options={}] - Search options
 * @param {string} [options.president] - President slug (e.g., 'donald-trump', 'joe-biden')
 * @param {number} [options.year] - Publication year (e.g., 2024)
 * @param {string} [options.term] - Full-text search term
 * @param {string} [options.signingDateGte] - Minimum signing date (YYYY-MM-DD)
 * @param {string} [options.signingDateLte] - Maximum signing date (YYYY-MM-DD)
 * @param {string[]} [options.fields] - Fields to include
 * @param {number} [options.per_page=100] - Results per page
 * @param {number} [options.page=1] - Page number
 * @returns {Promise<Object>} Search results {count, total_pages, results[]}
 *
 * @example
 * // Get Biden's 2024 executive orders
 * const orders = await searchExecutiveOrders({
 *   president: 'joe-biden',
 *   year: 2024
 * });
 *
 * // Search for executive orders mentioning "tariff"
 * const orders = await searchExecutiveOrders({
 *   term: 'tariff',
 *   president: 'donald-trump'
 * });
 */
async function searchExecutiveOrders(options = {}) {
  // Build conditions specific to executive orders
  const conditions = {
    type: DOCUMENT_TYPES.PRESIDENTIAL,
    presidential_document_type: PRESIDENTIAL_DOCUMENT_TYPES.EXECUTIVE_ORDER,
    correction: 0 // Exclude correction documents
  };

  // Add optional filters
  if (options.president) {
    conditions.president = options.president;
  }

  if (options.year) {
    conditions.publication_date = { year: options.year };
  }

  if (options.term) {
    conditions.term = options.term;
  }

  if (options.signingDateGte || options.signingDateLte) {
    conditions.signing_date = {};
    if (options.signingDateGte) conditions.signing_date.gte = options.signingDateGte;
    if (options.signingDateLte) conditions.signing_date.lte = options.signingDateLte;
  }

  // Default fields that are most useful for executive orders
  const defaultFields = [
    'document_number',
    'executive_order_number',
    'title',
    'signing_date',
    'publication_date',
    'president',
    'html_url',
    'pdf_url',
    'json_url'
  ];

  return searchDocuments({
    conditions,
    fields: options.fields || defaultFields,
    per_page: options.per_page || 100,
    page: options.page || 1,
    order: 'executive_order_number'
  });
}

/**
 * Fetches a specific executive order by its EO number.
 *
 * Note: The Federal Register API doesn't support direct EO number lookup,
 * so this function searches for the EO number and filters the results.
 *
 * @param {number} eoNumber - The executive order number (e.g., 14067)
 * @param {string[]} [fields] - Fields to include
 * @returns {Promise<Object|null>} The executive order, or null if not found
 *
 * @example
 * const eo = await getExecutiveOrderByNumber(14067);
 * if (eo) {
 *   console.log(eo.title);
 * }
 */
async function getExecutiveOrderByNumber(eoNumber, fields = null) {
  const defaultFields = [
    'document_number',
    'executive_order_number',
    'executive_order_notes',
    'title',
    'abstract',
    'signing_date',
    'publication_date',
    'president',
    'html_url',
    'pdf_url',
    'full_text_xml_url',
    'body_html_url',
    'citation',
    'start_page',
    'end_page'
  ];

  const targetNum = Number(eoNumber);

  // Search using the EO number as a search term to narrow results
  const allResults = await searchDocuments({
    conditions: {
      type: DOCUMENT_TYPES.PRESIDENTIAL,
      presidential_document_type: PRESIDENTIAL_DOCUMENT_TYPES.EXECUTIVE_ORDER,
      correction: 0,
      term: String(eoNumber)
    },
    fields: fields || defaultFields,
    per_page: 100
  });

  // Find exact match by comparing EO numbers as numbers
  const match = allResults.results?.find(r => Number(r.executive_order_number) === targetNum);
  return match || null;
}

/**
 * Fetches all executive orders for a specific president.
 *
 * Automatically handles pagination to retrieve all results.
 * Note: The API limits results to 2000 per query. For presidents with more
 * executive orders, use date ranges to segment your queries.
 *
 * @param {string} president - President slug (e.g., 'joe-biden')
 * @param {string[]} [fields] - Fields to include
 * @returns {Promise<Object[]>} Array of all executive orders
 *
 * @example
 * const bidenOrders = await getExecutiveOrdersByPresident('joe-biden');
 * console.log(`Biden signed ${bidenOrders.length} executive orders`);
 */
async function getExecutiveOrdersByPresident(president, fields = null) {
  const allResults = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await searchExecutiveOrders({
      president,
      fields,
      per_page: 1000,
      page
    });

    if (response.results && response.results.length > 0) {
      allResults.push(...response.results);
      // API limits to ~2000 results total (2 pages of 1000)
      hasMore = page < response.total_pages && page < 2;
      page++;
    } else {
      hasMore = false;
    }
  }

  return allResults;
}

/**
 * Fetches executive orders from the last 30 days.
 *
 * Useful for monitoring recent executive actions.
 *
 * @param {string[]} [fields] - Fields to include
 * @returns {Promise<Object>} Search results with recent executive orders
 *
 * @example
 * const recent = await getRecentExecutiveOrders();
 * console.log(`${recent.count} executive orders in the last 30 days`);
 */
async function getRecentExecutiveOrders(fields = null) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0]; // Format: YYYY-MM-DD

  return searchExecutiveOrders({
    signingDateGte: dateStr,
    fields
  });
}

/**
 * Fetches the full text content of an executive order by its EO number.
 *
 * This is a convenience function that:
 * 1. Looks up the executive order by number
 * 2. Fetches the document details including the raw text URL
 * 3. Downloads and returns the full text
 *
 * @param {number} eoNumber - The executive order number (e.g., 14067)
 * @returns {Promise<Object|null>} Object with EO metadata and full_text, or null if not found
 *
 * @example
 * const eo = await getExecutiveOrderFullText(14067);
 * if (eo && eo.full_text) {
 *   console.log(eo.full_text);
 * }
 */
async function getExecutiveOrderFullText(eoNumber) {
  // Step 1: Find the EO to get its document number
  const eo = await getExecutiveOrderByNumber(eoNumber);
  if (!eo) {
    return null;
  }

  // Step 2: Get the full document with raw_text_url
  const fullDoc = await getDocument(eo.document_number, [
    'document_number',
    'executive_order_number',
    'title',
    'signing_date',
    'president',
    'abstract',
    'raw_text_url',
    'html_url',
    'pdf_url'
  ]);

  // Handle case where full text isn't available
  if (!fullDoc.raw_text_url) {
    return {
      executive_order_number: eoNumber,
      title: fullDoc.title,
      signing_date: fullDoc.signing_date,
      president: fullDoc.president,
      abstract: fullDoc.abstract,
      full_text: null,
      error: 'Full text not available for this executive order',
      html_url: fullDoc.html_url,
      pdf_url: fullDoc.pdf_url
    };
  }

  // Step 3: Fetch the full text content
  const fullText = await fetchDocumentText(fullDoc.raw_text_url);

  return {
    executive_order_number: eoNumber,
    document_number: fullDoc.document_number,
    title: fullDoc.title,
    signing_date: fullDoc.signing_date,
    president: fullDoc.president,
    abstract: fullDoc.abstract,
    full_text: fullText,
    html_url: fullDoc.html_url,
    pdf_url: fullDoc.pdf_url
  };
}

// =============================================================================
// OTHER PRESIDENTIAL DOCUMENTS
// =============================================================================

/**
 * Searches presidential memoranda.
 *
 * Presidential memoranda are similar to executive orders but are typically
 * used for less formal directives to executive agencies.
 *
 * @param {Object} [options={}] - Search options
 * @param {string} [options.president] - President slug
 * @param {number} [options.year] - Publication year
 * @param {string} [options.term] - Search term
 * @param {string[]} [options.fields] - Fields to include
 * @param {number} [options.per_page=100] - Results per page
 * @param {number} [options.page=1] - Page number
 * @returns {Promise<Object>} Search results
 */
async function searchPresidentialMemoranda(options = {}) {
  const conditions = {
    type: DOCUMENT_TYPES.PRESIDENTIAL,
    presidential_document_type: PRESIDENTIAL_DOCUMENT_TYPES.MEMORANDUM,
    correction: 0
  };

  if (options.president) conditions.president = options.president;
  if (options.year) conditions.publication_date = { year: options.year };
  if (options.term) conditions.term = options.term;

  const defaultFields = [
    'document_number',
    'title',
    'signing_date',
    'publication_date',
    'president',
    'html_url',
    'pdf_url'
  ];

  return searchDocuments({
    conditions,
    fields: options.fields || defaultFields,
    per_page: options.per_page || 100,
    page: options.page || 1
  });
}

/**
 * Searches presidential proclamations.
 *
 * Proclamations are formal announcements, often used for commemorative
 * purposes (holidays, awareness months) or trade/tariff actions.
 *
 * @param {Object} [options={}] - Search options
 * @param {string} [options.president] - President slug
 * @param {number} [options.year] - Publication year
 * @param {string} [options.term] - Search term
 * @param {string[]} [options.fields] - Fields to include
 * @param {number} [options.per_page=100] - Results per page
 * @param {number} [options.page=1] - Page number
 * @returns {Promise<Object>} Search results
 */
async function searchProclamations(options = {}) {
  const conditions = {
    type: DOCUMENT_TYPES.PRESIDENTIAL,
    presidential_document_type: PRESIDENTIAL_DOCUMENT_TYPES.PROCLAMATION,
    correction: 0
  };

  if (options.president) conditions.president = options.president;
  if (options.year) conditions.publication_date = { year: options.year };
  if (options.term) conditions.term = options.term;

  const defaultFields = [
    'document_number',
    'title',
    'signing_date',
    'publication_date',
    'president',
    'html_url',
    'pdf_url'
  ];

  return searchDocuments({
    conditions,
    fields: options.fields || defaultFields,
    per_page: options.per_page || 100,
    page: options.page || 1
  });
}

// =============================================================================
// PUBLIC INSPECTION DOCUMENTS
// =============================================================================

/**
 * Fetches documents currently on public inspection.
 *
 * Public inspection documents are made available before their official
 * publication in the Federal Register, typically the day before.
 *
 * @param {string[]} [fields] - Fields to include
 * @returns {Promise<Object>} Public inspection documents
 */
async function getPublicInspectionDocuments(fields = null) {
  const params = {};
  if (fields && fields.length > 0) {
    params.fields = fields;
  }
  return makeRequest('/public-inspection-documents/current.json', params);
}

/**
 * Fetches public inspection documents for a specific date.
 *
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string[]} [fields] - Fields to include
 * @returns {Promise<Object>} Public inspection documents for that date
 */
async function getPublicInspectionByDate(date, fields = null) {
  const params = {};
  if (fields && fields.length > 0) {
    params.fields = fields;
  }
  return makeRequest(`/public-inspection-documents/${date}.json`, params);
}

/**
 * Fetches a single public inspection document by document number.
 *
 * @param {string} documentNumber - The document number
 * @returns {Promise<Object>} The public inspection document
 */
async function getPublicInspectionDocument(documentNumber) {
  return makeRequest(`/public-inspection-documents/${documentNumber}.json`);
}

/**
 * Searches public inspection documents.
 *
 * @param {Object} [options={}] - Search options (same format as searchDocuments)
 * @returns {Promise<Object>} Search results
 */
async function searchPublicInspection(options = {}) {
  return makeRequest('/public-inspection-documents.json', options);
}

// =============================================================================
// AGENCY FUNCTIONS
// =============================================================================

/**
 * Fetches all federal agencies in the Federal Register system.
 *
 * Returns basic information about each agency including name, slug,
 * and description.
 *
 * @returns {Promise<Object[]>} Array of agency objects
 */
async function getAgencies() {
  return makeRequest('/agencies.json');
}

/**
 * Fetches detailed information about a specific agency.
 *
 * @param {string} slug - Agency slug (e.g., 'environmental-protection-agency')
 * @returns {Promise<Object>} Agency details
 *
 * @example
 * const epa = await getAgency('environmental-protection-agency');
 */
async function getAgency(slug) {
  return makeRequest(`/agencies/${slug}.json`);
}

// =============================================================================
// DOCUMENT CONTENT UTILITIES
// =============================================================================

/**
 * Fetches the plain text content of a document.
 *
 * Use this with the raw_text_url field from a document response.
 * Note: Despite the name, the Federal Register often returns HTML-formatted text.
 *
 * @param {string} rawTextUrl - The raw_text_url from a document
 * @returns {Promise<string>} The document text content
 *
 * @example
 * const doc = await getDocument('2024-02154', ['raw_text_url']);
 * const text = await fetchDocumentText(doc.raw_text_url);
 */
async function fetchDocumentText(rawTextUrl) {
  const response = await fetch(rawTextUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch document text: ${response.status}`);
  }
  return response.text();
}

/**
 * Fetches the HTML body content of a document.
 *
 * Use this with the body_html_url field from a document response.
 *
 * @param {string} bodyHtmlUrl - The body_html_url from a document
 * @returns {Promise<string>} The document HTML content
 */
async function fetchDocumentHtml(bodyHtmlUrl) {
  const response = await fetch(bodyHtmlUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch document HTML: ${response.status}`);
  }
  return response.text();
}

// =============================================================================
// PAGINATION UTILITIES
// =============================================================================

/**
 * Fetches all results from a paginated search.
 *
 * Automatically handles pagination, calling the search function multiple
 * times until all results are retrieved or the maximum is reached.
 *
 * Note: The Federal Register API limits total results to 2000. For larger
 * datasets, use date ranges to segment your queries.
 *
 * @param {Function} searchFn - Search function to call (e.g., searchExecutiveOrders)
 * @param {Object} options - Search options to pass to the function
 * @param {number} [maxResults=2000] - Maximum results to fetch
 * @returns {Promise<Object[]>} Array of all matching results
 *
 * @example
 * const allOrders = await getAllResults(searchExecutiveOrders, {
 *   president: 'barack-obama'
 * });
 */
async function getAllResults(searchFn, options, maxResults = 2000) {
  const allResults = [];
  let page = 1;
  const perPage = Math.min(options.per_page || 100, 1000);

  while (allResults.length < maxResults) {
    const response = await searchFn({ ...options, page, per_page: perPage });

    if (!response.results || response.results.length === 0) {
      break;
    }

    allResults.push(...response.results);

    if (page >= response.total_pages) {
      break;
    }

    page++;
  }

  return allResults.slice(0, maxResults);
}

// =============================================================================
// MODULE EXPORTS
// =============================================================================

module.exports = {
  // Constants
  BASE_URL,
  DOCUMENT_TYPES,
  PRESIDENTIAL_DOCUMENT_TYPES,

  // Core document functions
  getDocument,
  getDocuments,
  searchDocuments,

  // Executive order functions
  searchExecutiveOrders,
  getExecutiveOrderByNumber,
  getExecutiveOrdersByPresident,
  getExecutiveOrderFullText,
  getRecentExecutiveOrders,

  // Other presidential documents
  searchPresidentialMemoranda,
  searchProclamations,

  // Public inspection documents
  getPublicInspectionDocuments,
  getPublicInspectionByDate,
  getPublicInspectionDocument,
  searchPublicInspection,

  // Agency functions
  getAgencies,
  getAgency,

  // Content utilities
  fetchDocumentText,
  fetchDocumentHtml,

  // Pagination utilities
  getAllResults,
  buildQueryString
};
