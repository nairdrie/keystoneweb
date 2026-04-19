/**
 * Converge (Elavon) payment integration helpers.
 *
 * Flow for a single charge:
 *   1. Server: requestSessionToken() → plain-text ssl_txn_auth_token (15 min, single-use)
 *   2. Client: window.PayWithConverge.open({ ssl_txn_auth_token }, callbacks)
 *   3. onApproval returns { ssl_txn_id, ssl_approval_code, ... }
 *   4. Server: verifyTransaction(ssl_txn_id) via XML API (ccquerytxn) to confirm authoritatively
 */

export interface ConvergeCredentials {
    merchantId: string;
    userId: string;
    pin: string;
    demoMode?: boolean;
}

function apiBase(demoMode: boolean) {
    return demoMode
        ? 'https://api.demo.convergepay.com'
        : 'https://api.convergepay.com';
}

function xmlPath(demoMode: boolean) {
    return demoMode
        ? '/VirtualMerchantDemo/processxml.do'
        : '/VirtualMerchant/processxml.do';
}

export interface SessionTokenParams {
    amount: number;              // total in dollars (e.g. 25.00)
    invoiceNumber?: string;
    description?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    // Billing / shipping addresses
    avsAddress?: string;
    avsZip?: string;
    city?: string;
    state?: string;
    country?: string;
    shipToFirstName?: string;
    shipToLastName?: string;
    shipToAddress1?: string;
    shipToAddress2?: string;
    shipToCity?: string;
    shipToState?: string;
    shipToZip?: string;
    shipToCountry?: string;
    shipToPhone?: string;
}

/**
 * Request a single-use session token for the Lightbox.
 * Returns the raw token string on success, or throws on error.
 */
export async function requestSessionToken(creds: ConvergeCredentials, params: SessionTokenParams): Promise<string> {
    const body = new URLSearchParams({
        ssl_merchant_id: creds.merchantId,
        ssl_user_id: creds.userId,
        ssl_pin: creds.pin,
        ssl_transaction_type: 'ccsale',
        ssl_amount: params.amount.toFixed(2),
    });

    // Optional fields
    if (params.invoiceNumber) body.set('ssl_invoice_number', params.invoiceNumber);
    if (params.description) body.set('ssl_description', params.description);
    if (params.firstName) body.set('ssl_first_name', params.firstName);
    if (params.lastName) body.set('ssl_last_name', params.lastName);
    if (params.email) body.set('ssl_email', params.email);
    if (params.phone) body.set('ssl_phone', params.phone);
    if (params.avsAddress) body.set('ssl_avs_address', params.avsAddress);
    if (params.avsZip) body.set('ssl_avs_zip', params.avsZip);
    if (params.city) body.set('ssl_city', params.city);
    if (params.state) body.set('ssl_state', params.state);
    if (params.country) body.set('ssl_country', params.country);

    if (params.shipToFirstName) body.set('ssl_ship_to_first_name', params.shipToFirstName);
    if (params.shipToLastName) body.set('ssl_ship_to_last_name', params.shipToLastName);
    if (params.shipToAddress1) body.set('ssl_ship_to_address1', params.shipToAddress1);
    if (params.shipToAddress2) body.set('ssl_ship_to_address2', params.shipToAddress2);
    if (params.shipToCity) body.set('ssl_ship_to_city', params.shipToCity);
    if (params.shipToState) body.set('ssl_ship_to_state', params.shipToState);
    if (params.shipToZip) body.set('ssl_ship_to_zip', params.shipToZip);
    if (params.shipToCountry) body.set('ssl_ship_to_country', params.shipToCountry);
    if (params.shipToPhone) body.set('ssl_ship_to_phone', params.shipToPhone);

    const url = `${apiBase(!!creds.demoMode)}/hosted-payments/transaction_token`;
    const res = await fetch(url, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const text = (await res.text()).trim();
    // Converge returns plain text: either the token or an error message like "4025 The credentials..."
    // A valid token is base64-like; error responses start with a numeric code + space + human message.
    if (/^\d{4}\s/.test(text) || text.includes('error') || text.length < 20) {
        throw new Error(`Converge token error: ${text}`);
    }
    return text;
}

/**
 * Extract a field value from a Converge XML response.
 * Converge returns flat <txn><ssl_result>0</ssl_result>... responses.
 */
function extractXml(xml: string, field: string): string | null {
    const match = xml.match(new RegExp(`<${field}>([^<]*)</${field}>`));
    return match ? match[1].trim() : null;
}

export interface ConvergeTransaction {
    approved: boolean;
    resultCode: string | null;      // ssl_result ("0" = approved)
    resultMessage: string | null;   // ssl_result_message
    txnId: string | null;
    approvalCode: string | null;
    amount: string | null;
    cardLast4: string | null;       // extracted from masked ssl_card_number
    cardBrand: string | null;
    txnTime: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    raw: string;
}

/**
 * Server-side verify a transaction (after onApproval) via XML ccquerytxn.
 * Returns the authoritative result.
 */
export async function verifyTransaction(creds: ConvergeCredentials, sslTxnId: string): Promise<ConvergeTransaction> {
    const xmlBody = `<txn>` +
        `<ssl_merchant_id>${creds.merchantId}</ssl_merchant_id>` +
        `<ssl_user_id>${creds.userId}</ssl_user_id>` +
        `<ssl_pin>${creds.pin}</ssl_pin>` +
        `<ssl_transaction_type>ccquerytxn</ssl_transaction_type>` +
        `<ssl_txn_id>${sslTxnId}</ssl_txn_id>` +
        `</txn>`;

    const url = `${apiBase(!!creds.demoMode)}${xmlPath(!!creds.demoMode)}`;
    const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ xmldata: xmlBody }),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const xml = await res.text();

    const resultCode = extractXml(xml, 'ssl_result');
    const cardNumber = extractXml(xml, 'ssl_card_number');

    return {
        approved: resultCode === '0',
        resultCode,
        resultMessage: extractXml(xml, 'ssl_result_message'),
        txnId: extractXml(xml, 'ssl_txn_id'),
        approvalCode: extractXml(xml, 'ssl_approval_code'),
        amount: extractXml(xml, 'ssl_amount'),
        cardLast4: cardNumber ? cardNumber.replace(/[^0-9]/g, '').slice(-4) : null,
        cardBrand: extractXml(xml, 'ssl_card_short_description'),
        txnTime: extractXml(xml, 'ssl_txn_time'),
        errorCode: extractXml(xml, 'errorCode'),
        errorMessage: extractXml(xml, 'errorMessage'),
        raw: xml,
    };
}

/**
 * Validate that a vendor has all required Converge credentials.
 */
export function hasValidConvergeCredentials(vendor: any): boolean {
    return !!(vendor?.converge_merchant_id && vendor?.converge_user_id && vendor?.converge_pin);
}
