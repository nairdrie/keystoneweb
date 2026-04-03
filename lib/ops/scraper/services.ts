import { load } from 'cheerio';
import {
  BROWSER_UA,
  buildCsv,
  escapeCsvValue,
  fetchHtml,
  normalizeWhitespace,
  parseCsvLine,
  stripHtml,
  toDecimalString,
  uniqueStrings,
} from './shared';
import type { ScraperResult } from './types';

const SERVICES_CSV_HEADERS = [
  'name',
  'description',
  'duration_minutes',
  'price',
  'currency',
  'category',
  'is_featured',
  'compare_at_price',
  'status',
];

const SERVICES_SYSTEM_PROMPT = `You are a data extraction assistant. You will be given the content of a business website. Your task is to extract all services (treatments, appointments, classes, or similar offerings) from the page.

Return ONLY a CSV with these exact columns in this exact order:
name,description,duration_minutes,price,currency,category,is_featured,compare_at_price,status

Rules:
- name: required, the service name
- description: optional, a short description of the service (max 200 chars, escape commas with quotes)
- duration_minutes: integer, duration in minutes (default 30 if unknown)
- price: decimal dollar amount (e.g. 75.00), 0 if free or unknown
- currency: CAD or USD (default CAD)
- category: optional category/group name this service belongs to
- is_featured: true or false (default false)
- compare_at_price: optional original/crossed-out price in dollars, blank if none
- status: always "draft"

Quote any field that contains commas or newlines. Do not include a header row. Do not add any explanation before or after the CSV. If no services are found, return exactly: NO_SERVICES_FOUND`;

const VAGARO_SERVICE_ENDPOINT = 'https://www.vagaro.com/websiteapi/homepage/getshopdetailcompositeservice';

interface VagaroServiceCategory {
  ServiceCategoryID?: number;
  ServiceCategoryTitle?: string;
}

interface VagaroServiceRecord {
  ServiceID?: number;
  ParentServiceID?: number;
  RootParentID?: number;
  ServiceLevel?: number;
  ServiceTitle?: string;
  ServiceTitleDisplay?: string;
  ServiceDesc?: string;
  Price?: number;
  MaxPrice?: number;
  ServiceOldPrice?: number;
  Duration?: number;
  IsActive?: boolean;
  IsSoftDeleted?: boolean;
  ShowOnline?: boolean;
  IsShowPriceOnline?: boolean;
  PromotionID?: number;
}

interface VagaroServicesResponse {
  Services?: VagaroServiceCategory[];
  ServicesData?: VagaroServiceRecord[];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseOptionalNumber(value: string | null) {
  if (value === null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalBoolean(value: string | null) {
  if (value === null) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function extractInputValue(html: string, id: string) {
  const pattern = new RegExp(`<input[^>]+id=["']${escapeRegExp(id)}["'][^>]+value=["']([^"']*)["']`, 'i');
  return html.match(pattern)?.[1]?.trim() || '';
}

function extractJsonishValue(html: string, key: string) {
  const escapedKey = escapeRegExp(key);
  const pattern = new RegExp(
    `(?:\\\\?")${escapedKey}(?:\\\\?")\\s*:\\s*((?:\\\\?")[\\s\\S]*?(?:\\\\?")|true|false|null|-?\\d+(?:\\.\\d+)?)`,
    'i'
  );
  const rawValue = html.match(pattern)?.[1];
  if (!rawValue) return null;

  if (rawValue === 'null') return null;
  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;

  if (/^-?\d+(?:\.\d+)?$/.test(rawValue)) {
    const parsed = Number.parseFloat(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return rawValue.replace(/^\\?"/, '').replace(/\\?"$/, '').replace(/\\"/g, '"').trim();
}

function isVagaroServicesUrl(url: URL) {
  return /(^|\.)vagaro\.com$/i.test(url.hostname) && /\/services(?:\/|$)/i.test(url.pathname);
}

function getCookieHeader(response: Response, groupToken: string) {
  const cookies =
    ((response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() || []).map((value) => value.split(';')[0]);

  const values = uniqueStrings([...cookies, `tenant_group=${groupToken.toLowerCase()}`]);
  return values.join('; ');
}

function buildServicesResult(
  sourceUrl: string,
  csvRows: string,
  warnings: string[],
  provider: ScraperResult['provider'] = 'generic',
  providerLabel = 'Generic services page',
  strategy = 'HTML text + LLM extraction',
  rawPayload?: unknown
): ScraperResult {
  const parsedRows = csvRows.split('\n').map((line) => parseCsvLine(line));
  const csv = buildCsv(SERVICES_CSV_HEADERS, parsedRows);
  const previewRows = csv.split('\n').slice(0, 11).map((line) => parseCsvLine(line));

  return {
    preset: 'services',
    provider,
    providerLabel,
    csv,
    filename: `keystone-services-${Date.now()}.csv`,
    rawJson: JSON.stringify(rawPayload ?? { sourceUrl, csvRows, warnings }, null, 2),
    warnings,
    summary: {
      discoveredPages: 1,
      productsExtracted: parsedRows.length,
      csvRows: parsedRows.length,
      failedPages: 0,
      skippedProducts: 0,
    },
    previewRows,
    metadata: {
      sourceUrl,
      strategy,
    },
  };
}

async function runVagaroServicesScraper(parsedUrl: URL): Promise<ScraperResult> {
  const pageResponse = await fetch(parsedUrl.toString(), {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });

  if (!pageResponse.ok) {
    throw new Error(`Vagaro page request failed with HTTP ${pageResponse.status}.`);
  }

  const pageHtml = await pageResponse.text();
  const businessId = parseOptionalNumber(extractInputValue(pageHtml, 'hdnSiteBuilderBusinessID'));
  const token2 = extractInputValue(pageHtml, 'hdnToken2');
  const groupToken = String(extractJsonishValue(pageHtml, 'GroupId') ?? '').trim();
  const currency = String(extractJsonishValue(pageHtml, 'CurrencyCode') ?? '').trim() || 'CAD';
  const merchantAccount = parseOptionalNumber(String(extractJsonishValue(pageHtml, 'MerchantAccount') ?? ''));
  const isShowCustomPackage = parseOptionalBoolean(String(extractJsonishValue(pageHtml, 'IsShowCustomPackage') ?? ''));
  const isOutcallMandatory = parseOptionalBoolean(String(extractJsonishValue(pageHtml, 'IsOutcallMandatory') ?? ''));
  const outcallPointRedeem = parseOptionalNumber(String(extractJsonishValue(pageHtml, 'OutcallPointRedeem') ?? ''));
  const outCallPrice = parseOptionalNumber(String(extractJsonishValue(pageHtml, 'OutCallPrice') ?? ''));
  const isMobileServiceMandatory = parseOptionalNumber(String(extractJsonishValue(pageHtml, 'IsMobileServiceMandatory') ?? ''));

  if (!businessId || !token2 || !groupToken || merchantAccount === null || isShowCustomPackage === null || isOutcallMandatory === null) {
    throw new Error('Vagaro page metadata was incomplete.');
  }

  const cookieHeader = getCookieHeader(pageResponse, groupToken);
  const payload = {
    businessID: businessId,
    loginUserID: 0,
    pageIndex: 1,
    pageSize: null,
    IsForNewCustomer: 0,
    IsPackageInclude: 1,
    bookText: 'Book',
    classBookText: 'Book',
    currencySymbol: '$',
    MerchantAccount: merchantAccount,
    IsShowCustomPackage: isShowCustomPackage,
    IsOutcallMandatory: isOutcallMandatory,
    OutcallPointRedeem: outcallPointRedeem ?? 0,
    OutCallPrice: outCallPrice ?? 0,
    IsMobileServiceMandatory: isMobileServiceMandatory ?? 0,
    ServiceProviderId: null,
    Referral: 0,
  };

  const response = await fetch(VAGARO_SERVICE_ENDPOINT, {
    method: 'POST',
    headers: {
      'User-Agent': BROWSER_UA,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
      'Content-Type': 'application/json; charset=UTF-8',
      Origin: parsedUrl.origin,
      Referer: parsedUrl.toString(),
      'X-Requested-With': 'XMLHttpRequest',
      token0: 'brandedApp: false',
      token2,
      grouptoken: groupToken,
      Version: '1',
      Device: 'website',
      DeviceID: 'masterpage',
      Cookie: cookieHeader,
    },
    body: JSON.stringify(payload),
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Vagaro service request failed with HTTP ${response.status}.`);
  }

  const data = (await response.json()) as VagaroServicesResponse;
  const rawServices = Array.isArray(data.ServicesData) ? data.ServicesData : [];
  const serviceRows = rawServices.filter(
    (service) =>
      service.ServiceLevel === 1 &&
      service.IsActive !== false &&
      service.IsSoftDeleted !== true &&
      service.ShowOnline !== false
  );

  if (!serviceRows.length) {
    throw new Error('No services were returned by Vagaro.');
  }

  const categoryMap = new Map<number, string>();
  for (const category of rawServices.filter((service) => service.ServiceLevel === 0)) {
    if (!category.ServiceID) continue;
    const title = normalizeWhitespace(category.ServiceTitleDisplay || category.ServiceTitle);
    if (title) categoryMap.set(category.ServiceID, title);
  }

  for (const category of Array.isArray(data.Services) ? data.Services : []) {
    if (!category.ServiceCategoryID) continue;
    const title = normalizeWhitespace(category.ServiceCategoryTitle);
    if (title) categoryMap.set(category.ServiceCategoryID, title);
  }

  const rows = serviceRows.map((service) => {
    const name = normalizeWhitespace(service.ServiceTitleDisplay || service.ServiceTitle);
    const description = normalizeWhitespace(stripHtml(service.ServiceDesc));
    const category =
      categoryMap.get(service.RootParentID || 0) ||
      categoryMap.get(service.ParentServiceID || 0) ||
      '';
    const price = service.IsShowPriceOnline === false ? '' : toDecimalString(service.Price);
    const compareAtPrice =
      typeof service.ServiceOldPrice === 'number' && service.ServiceOldPrice > 0 && service.ServiceOldPrice > (service.Price || 0)
        ? toDecimalString(service.ServiceOldPrice)
        : '';
    const isFeatured = category.toLowerCase().includes('promo') || Boolean(service.PromotionID);

    return [
      name,
      description,
      String(Math.max(0, Math.round(service.Duration || 0))),
      price,
      currency,
      category,
      String(isFeatured),
      compareAtPrice,
      'draft',
    ];
  });

  const csvRows = rows.map((row) => row.map((value) => escapeCsvValue(value)).join(',')).join('\n');
  return buildServicesResult(
    parsedUrl.toString(),
    csvRows,
    [],
    'vagaro',
    'Vagaro',
    'Vagaro public services endpoint',
    {
      sourceUrl: parsedUrl.toString(),
      provider: 'vagaro',
      payload,
      categories: Array.from(categoryMap.entries()).map(([id, title]) => ({ id, title })),
      serviceCount: serviceRows.length,
      services: serviceRows,
    }
  );
}

function findIframeSrcs(html: string, baseUrl: string) {
  const srcs: string[] = [];
  const re = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    try {
      srcs.push(new URL(match[1], baseUrl).toString());
    } catch {
      // Ignore invalid URLs.
    }
  }

  return uniqueStrings(srcs);
}

export async function runServicesScraper(inputUrl: string): Promise<ScraperResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(inputUrl);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (isVagaroServicesUrl(parsedUrl)) {
    return runVagaroServicesScraper(parsedUrl);
  }

  const mainPage = await fetchHtml(parsedUrl.toString());
  let text = stripHtml(mainPage.html);
  const warnings: string[] = [];

  for (const iframeUrl of findIframeSrcs(mainPage.html, mainPage.url).slice(0, 3)) {
    try {
      const iframePage = await fetchHtml(iframeUrl);
      text += `\n\n${stripHtml(iframePage.html)}`;
    } catch {
      warnings.push(`Iframe content could not be fetched from ${iframeUrl}.`);
    }
  }

  const $ = load(mainPage.html);
  $('script').each((_, element) => {
    const scriptText = $(element).html() || '';
    const lower = scriptText.toLowerCase();
    if (lower.includes('service') || lower.includes('treatment') || lower.includes('price')) {
      text += `\n\n${scriptText.slice(0, 20000)}`;
    }
  });

  text = text.slice(0, 60000);
  if (text.length < 50) {
    throw new Error('Page returned very little content. It may require JavaScript or block automated access.');
  }

  const apiKey = process.env.AI_BUILDER_API_KEY;
  const model = process.env.AI_BUILDER_MODEL || 'claude-sonnet-4-6';
  if (!apiKey) {
    throw new Error('AI not configured.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SERVICES_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Extract services from this page:\n\n${text}` }],
    }),
  });

  if (!response.ok) {
    throw new Error('AI extraction failed.');
  }

  const data = await response.json();
  const csvRows = String(data.content?.[0]?.text || '').trim();
  if (!csvRows || csvRows === 'NO_SERVICES_FOUND') {
    throw new Error('No services found on this page. The page may require JavaScript rendering or block automated access.');
  }

  return buildServicesResult(mainPage.url, csvRows, warnings);
}
