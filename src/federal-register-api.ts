/**
 * Federal Register API Client
 *
 * A Node.js client for the Federal Register API v1, providing access to
 * executive orders, presidential documents, rules, notices, and agency information.
 *
 * API Documentation: https://www.federalregister.gov/developers/documentation/api/v1
 */

// =============================================================================
// TYPES
// =============================================================================

export interface QueryParams {
  conditions?: Record<string, unknown>;
  fields?: string[];
  per_page?: number;
  page?: number;
  order?: string;
  format?: string;
}

export interface SearchResult<T = FederalRegisterDocument> {
  count: number;
  total_pages: number;
  results: T[];
}

export interface FederalRegisterDocument {
  document_number: string;
  title: string;
  abstract?: string;
  html_url: string;
  pdf_url?: string;
  json_url?: string;
  publication_date: string;
  type?: string;
  subtype?: string;
  agencies?: Agency[];
  raw_text_url?: string;
  body_html_url?: string;
  full_text_xml_url?: string;
}

export interface ExecutiveOrder extends FederalRegisterDocument {
  executive_order_number: number;
  executive_order_notes?: string;
  signing_date: string;
  president: PresidentInfo;
  citation?: string;
  start_page?: number;
  end_page?: number;
}

export interface ExecutiveOrderFullText {
  executive_order_number: number;
  document_number?: string;
  title: string;
  signing_date: string;
  president: PresidentInfo;
  abstract?: string;
  full_text: string | null;
  error?: string;
  html_url: string;
  pdf_url?: string;
}

export interface PresidentInfo {
  name: string;
  identifier: string;
}

export interface Agency {
  id: number;
  name: string;
  slug: string;
  url?: string;
  description?: string;
  short_name?: string;
  parent_id?: number;
  recent_articles_url?: string;
}

export interface PublicInspectionDocument {
  document_number: string;
  title: string;
  type: string;
  agencies: Agency[];
  html_url: string;
  pdf_url?: string;
  publication_date: string;
}

export interface SearchExecutiveOrdersOptions {
  president?: string;
  year?: number;
  term?: string;
  signingDateGte?: string;
  signingDateLte?: string;
  fields?: string[];
  per_page?: number;
  page?: number;
}

export interface SearchDocumentsOptions {
  conditions?: Record<string, unknown>;
  fields?: string[];
  per_page?: number;
  page?: number;
  order?: string;
}

export interface SearchPresidentialDocsOptions {
  president?: string;
  year?: number;
  term?: string;
  fields?: string[];
  per_page?: number;
  page?: number;
}

// =============================================================================
// CONFIGURATION & CONSTANTS
// =============================================================================

export const BASE_URL = 'https://www.federalregister.gov/api/v1';

export const DOCUMENT_TYPES = {
  RULE: 'RULE',
  PROPOSED_RULE: 'PRORULE',
  NOTICE: 'NOTICE',
  PRESIDENTIAL: 'PRESDOCU'
} as const;

export const PRESIDENTIAL_DOCUMENT_TYPES = {
  DETERMINATION: 'determination',
  EXECUTIVE_ORDER: 'executive_order',
  MEMORANDUM: 'memorandum',
  NOTICE: 'notice',
  PROCLAMATION: 'proclamation'
} as const;

// =============================================================================
// INTERNAL UTILITIES
// =============================================================================

function buildQueryString(params: QueryParams): string {
  const parts: string[] = [];

  function addParam(key: string, value: unknown): void {
    if (value !== undefined && value !== null) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  function addConditions(conditions: Record<string, unknown>, prefix = 'conditions'): void {
    for (const [key, value] of Object.entries(conditions)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          addParam(`${prefix}[${key}][${subKey}]`, subValue);
        }
      } else if (Array.isArray(value)) {
        for (const item of value) {
          addParam(`${prefix}[${key}][]`, item);
        }
      } else {
        addParam(`${prefix}[${key}]`, value);
      }
    }
  }

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

async function makeRequest<T>(endpoint: string, params: QueryParams = {}): Promise<T> {
  const queryString = buildQueryString(params);
  const url = queryString
    ? `${BASE_URL}${endpoint}?${queryString}`
    : `${BASE_URL}${endpoint}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Federal Register API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// =============================================================================
// CORE DOCUMENT FUNCTIONS
// =============================================================================

export async function getDocument(
  documentNumber: string,
  fields: string[] | null = null
): Promise<FederalRegisterDocument> {
  const params: QueryParams = {};
  if (fields && fields.length > 0) {
    params.fields = fields;
  }
  return makeRequest<FederalRegisterDocument>(`/documents/${documentNumber}.json`, params);
}

export async function getDocuments(
  documentNumbers: string[],
  fields: string[] | null = null
): Promise<{ results: FederalRegisterDocument[] }> {
  const params: QueryParams = {};
  if (fields && fields.length > 0) {
    params.fields = fields;
  }
  const numbers = documentNumbers.join(',');
  return makeRequest(`/documents/${numbers}.json`, params);
}

export async function searchDocuments(
  options: SearchDocumentsOptions = {}
): Promise<SearchResult> {
  return makeRequest<SearchResult>('/documents.json', options);
}

// =============================================================================
// EXECUTIVE ORDER FUNCTIONS
// =============================================================================

export async function searchExecutiveOrders(
  options: SearchExecutiveOrdersOptions = {}
): Promise<SearchResult<ExecutiveOrder>> {
  const conditions: Record<string, unknown> = {
    type: DOCUMENT_TYPES.PRESIDENTIAL,
    presidential_document_type: PRESIDENTIAL_DOCUMENT_TYPES.EXECUTIVE_ORDER,
    correction: 0
  };

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
    conditions.signing_date = {} as Record<string, string>;
    if (options.signingDateGte) (conditions.signing_date as Record<string, string>).gte = options.signingDateGte;
    if (options.signingDateLte) (conditions.signing_date as Record<string, string>).lte = options.signingDateLte;
  }

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
  }) as Promise<SearchResult<ExecutiveOrder>>;
}

export async function getExecutiveOrderByNumber(
  eoNumber: number,
  fields: string[] | null = null
): Promise<ExecutiveOrder | null> {
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

  const allResults = await searchDocuments({
    conditions: {
      type: DOCUMENT_TYPES.PRESIDENTIAL,
      presidential_document_type: PRESIDENTIAL_DOCUMENT_TYPES.EXECUTIVE_ORDER,
      correction: 0,
      term: String(eoNumber)
    },
    fields: fields || defaultFields,
    per_page: 100
  }) as SearchResult<ExecutiveOrder>;

  const match = allResults.results?.find(r => Number(r.executive_order_number) === targetNum);
  return match || null;
}

export async function getExecutiveOrdersByPresident(
  president: string,
  fields: string[] | null = null
): Promise<ExecutiveOrder[]> {
  const allResults: ExecutiveOrder[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await searchExecutiveOrders({
      president,
      fields: fields || undefined,
      per_page: 1000,
      page
    });

    if (response.results && response.results.length > 0) {
      allResults.push(...response.results);
      hasMore = page < response.total_pages && page < 2;
      page++;
    } else {
      hasMore = false;
    }
  }

  return allResults;
}

export async function getRecentExecutiveOrders(
  fields: string[] | null = null
): Promise<SearchResult<ExecutiveOrder>> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  return searchExecutiveOrders({
    signingDateGte: dateStr,
    fields: fields || undefined
  });
}

export async function getExecutiveOrderFullText(
  eoNumber: number
): Promise<ExecutiveOrderFullText | null> {
  const eo = await getExecutiveOrderByNumber(eoNumber);
  if (!eo) {
    return null;
  }

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
  ]) as ExecutiveOrder;

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

export async function searchPresidentialMemoranda(
  options: SearchPresidentialDocsOptions = {}
): Promise<SearchResult> {
  const conditions: Record<string, unknown> = {
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

export async function searchProclamations(
  options: SearchPresidentialDocsOptions = {}
): Promise<SearchResult> {
  const conditions: Record<string, unknown> = {
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

export async function getPublicInspectionDocuments(
  fields: string[] | null = null
): Promise<{ results: PublicInspectionDocument[] }> {
  const params: QueryParams = {};
  if (fields && fields.length > 0) {
    params.fields = fields;
  }
  return makeRequest('/public-inspection-documents/current.json', params);
}

export async function getPublicInspectionByDate(
  date: string,
  fields: string[] | null = null
): Promise<{ results: PublicInspectionDocument[] }> {
  const params: QueryParams = {};
  if (fields && fields.length > 0) {
    params.fields = fields;
  }
  return makeRequest(`/public-inspection-documents/${date}.json`, params);
}

export async function getPublicInspectionDocument(
  documentNumber: string
): Promise<PublicInspectionDocument> {
  return makeRequest(`/public-inspection-documents/${documentNumber}.json`);
}

export async function searchPublicInspection(
  options: SearchDocumentsOptions = {}
): Promise<SearchResult<PublicInspectionDocument>> {
  return makeRequest('/public-inspection-documents.json', options);
}

// =============================================================================
// AGENCY FUNCTIONS
// =============================================================================

export async function getAgencies(): Promise<Agency[]> {
  return makeRequest<Agency[]>('/agencies.json');
}

export async function getAgency(slug: string): Promise<Agency> {
  return makeRequest<Agency>(`/agencies/${slug}.json`);
}

// =============================================================================
// DOCUMENT CONTENT UTILITIES
// =============================================================================

export async function fetchDocumentText(rawTextUrl: string): Promise<string> {
  const response = await fetch(rawTextUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch document text: ${response.status}`);
  }
  return response.text();
}

export async function fetchDocumentHtml(bodyHtmlUrl: string): Promise<string> {
  const response = await fetch(bodyHtmlUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch document HTML: ${response.status}`);
  }
  return response.text();
}

// =============================================================================
// PAGINATION UTILITIES
// =============================================================================

type SearchFunction<T> = (options: SearchDocumentsOptions) => Promise<SearchResult<T>>;

export async function getAllResults<T>(
  searchFn: SearchFunction<T>,
  options: SearchDocumentsOptions,
  maxResults = 2000
): Promise<T[]> {
  const allResults: T[] = [];
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

export { buildQueryString };
