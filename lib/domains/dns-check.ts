/**
 * Shared DNS resolution check for external custom domains.
 *
 * Used by:
 *  - POST /api/domains/verify-dns  (existing site-owner verify flow)
 *  - POST /api/ops/launch/[id]/check-dns  (operator pre-launch check)
 *  - POST /api/onboarding/launch/[token]/checkout  (pre-launch hard check)
 *
 * The contract matches the records returned by /api/domains/link-external:
 *  - A    record on the root pointing at Vercel's IP (76.76.21.21)
 *  - CNAME on `www` pointing at sites.{kswd.ca | staging.kswd.ca}
 *  - TXT  on the root containing `kswd-verify-{siteId.slice(0,8)}`
 *
 * The TXT verification token is what proves the operator/owner actually
 * controls this domain (vs. someone typing in a competitor's hostname).
 */
import dns from 'node:dns';
import { promisify } from 'node:util';
import { CUSTOM_DOMAIN_CNAME_TARGET } from '@/lib/env/domain';

const resolveCname = promisify(dns.resolveCname);
const resolveTxt = promisify(dns.resolveTxt);
const resolve4 = promisify(dns.resolve4);

const EXPECTED_A_RECORD = '76.76.21.21';

export interface DnsCheckResult {
  domain: string;
  verified: boolean;
  checks: {
    a: boolean;
    cname: boolean;
    txt: boolean;
  };
  expected: {
    a: string;
    cname: string;
    txt: string;
  };
  found: {
    a: string[];
    cname: string[];
    txt: string[];
  };
}

export function buildVerificationToken(siteId: string): string {
  return `kswd-verify-${siteId.slice(0, 8)}`;
}

export async function checkExternalDomainDns(domain: string, siteId: string): Promise<DnsCheckResult> {
  const expectedToken = buildVerificationToken(siteId);

  const result: DnsCheckResult = {
    domain,
    verified: false,
    checks: { a: false, cname: false, txt: false },
    expected: {
      a: EXPECTED_A_RECORD,
      cname: CUSTOM_DOMAIN_CNAME_TARGET,
      txt: expectedToken,
    },
    found: { a: [], cname: [], txt: [] },
  };

  await Promise.all([
    (async () => {
      try {
        const records = await resolve4(domain);
        result.found.a = records;
        result.checks.a = records.includes(EXPECTED_A_RECORD);
      } catch {
        // No A record — leave as []
      }
    })(),
    (async () => {
      try {
        const records = await resolveCname(`www.${domain}`);
        result.found.cname = records;
        result.checks.cname = records.some((r) => r.toLowerCase() === CUSTOM_DOMAIN_CNAME_TARGET);
      } catch {
        // No CNAME — leave as []
      }
    })(),
    (async () => {
      try {
        const records = await resolveTxt(domain);
        const flat = records.map((parts) => parts.join(''));
        result.found.txt = flat;
        result.checks.txt = flat.some((r) => r.includes(expectedToken));
      } catch {
        // No TXT — leave as []
      }
    })(),
  ]);

  // Apex A or www CNAME is enough to route traffic; the TXT proves ownership.
  // We treat verified as: TXT present AND at least one of (A or CNAME) present.
  result.verified = result.checks.txt && (result.checks.a || result.checks.cname);

  return result;
}

export interface DnsInstructionRecord {
  type: 'A' | 'CNAME' | 'TXT';
  name: string;
  value: string;
  description: string;
}

export function buildDnsInstructions(siteId: string): DnsInstructionRecord[] {
  return [
    {
      type: 'A',
      name: '@',
      value: EXPECTED_A_RECORD,
      description: 'Points the root of your domain to Keystone',
    },
    {
      type: 'CNAME',
      name: 'www',
      value: CUSTOM_DOMAIN_CNAME_TARGET,
      description: 'Points www.yourdomain → Keystone',
    },
    {
      type: 'TXT',
      name: '@',
      value: buildVerificationToken(siteId),
      description: 'Proves you own the domain',
    },
  ];
}
