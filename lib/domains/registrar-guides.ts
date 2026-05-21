/**
 * Registrar-specific DNS setup steps, shared by the ops Launch Config form
 * and the client-facing DNS-setup email.
 *
 * If the user's registrar isn't listed, fall back to GENERIC_STEPS — a
 * provider-agnostic walkthrough that works at any DNS host.
 */

export interface RegistrarGuide {
  id: string;
  name: string;
  /** Sign-in URL we can deep-link from the email. */
  signInUrl?: string;
  steps: string[];
}

export const REGISTRARS: RegistrarGuide[] = [
  {
    id: 'godaddy',
    name: 'GoDaddy',
    signInUrl: 'https://sso.godaddy.com',
    steps: [
      'Sign in to GoDaddy and open "My Products".',
      'Find your domain and click "DNS" (or "Manage DNS").',
      'Under "Records", click "Add" once for each record below.',
      'A record — Type: A, Name: @, Value: the IP shown below.',
      'CNAME record — Type: CNAME, Name: www, Value: the target shown below.',
      'TXT record — Type: TXT, Name: @, Value: the verification string shown below.',
      'Click Save on each one. Changes usually go live in a few minutes.',
    ],
  },
  {
    id: 'namecheap',
    name: 'Namecheap',
    signInUrl: 'https://www.namecheap.com/myaccount/login/',
    steps: [
      'Sign in to Namecheap and open "Domain List" in the sidebar.',
      'Click "Manage" next to your domain, then open the "Advanced DNS" tab.',
      'Click "Add New Record" once for each record below.',
      'A record — Type: A Record, Host: @, Value: the IP shown below.',
      'CNAME record — Type: CNAME Record, Host: www, Value: the target shown below.',
      'TXT record — Type: TXT Record, Host: @, Value: the verification string shown below.',
      'Click the green checkmark to save each one.',
    ],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    signInUrl: 'https://dash.cloudflare.com/login',
    steps: [
      'Sign in to Cloudflare and pick your domain.',
      'Open "DNS" → "Records" in the sidebar.',
      'Click "Add record" once for each record below.',
      'A record — Type: A, Name: @, IPv4 address: the IP shown below. Set Proxy status to "DNS only" (grey cloud).',
      'CNAME record — Type: CNAME, Name: www, Target: the target shown below. Set Proxy status to "DNS only".',
      'TXT record — Type: TXT, Name: @, Content: the verification string shown below.',
      'Save each record. Cloudflare changes propagate within a couple of minutes.',
    ],
  },
  {
    id: 'squarespace',
    name: 'Squarespace / Google Domains',
    signInUrl: 'https://account.squarespace.com/login',
    steps: [
      'Sign in to Squarespace Domains (formerly Google Domains) and select your domain.',
      'Open "DNS" in the sidebar, scroll to "Custom records", click "Manage custom records".',
      'A record — Host name: @ (or leave blank), Type: A, Data: the IP shown below.',
      'CNAME record — Host name: www, Type: CNAME, Data: the target shown below.',
      'TXT record — Host name: @ (or leave blank), Type: TXT, Data: the verification string shown below.',
      'Click Save once all three are added.',
    ],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    signInUrl: 'https://accounts.shopify.com/store-login',
    steps: [
      'Sign in to Shopify admin and go to Settings → Domains.',
      'Click your domain, then "DNS settings".',
      'Edit the A record on @ to the IP shown below.',
      'Add a CNAME record with Host: www and Points to: the target shown below.',
      'Add a TXT record with Host: @ and Value: the verification string shown below.',
      'Save the records.',
    ],
  },
  {
    id: 'wix',
    name: 'Wix',
    signInUrl: 'https://users.wix.com/signin',
    steps: [
      'Sign in to Wix and open Account Settings → Domains.',
      'Click "Show more" on your domain → Advanced → Edit DNS.',
      'Update the A record on @ to the IP shown below.',
      'Add a CNAME record with Host: www and Value: the target shown below.',
      'Add a TXT record with Host: @ and Value: the verification string shown below.',
      'Save your DNS changes.',
    ],
  },
  {
    id: 'other',
    name: 'Other / not sure',
    steps: [
      'Sign in to wherever you manage your domain (this is usually whoever you bought it from).',
      'Look for a "DNS" or "Manage DNS" or "DNS records" section.',
      "Add the three records below. They're standard DNS records, every provider supports them.",
      'If your provider asks for a "TTL", use the default — usually 1 hour or "Auto".',
      "If you can't find DNS settings, search your provider's help for \"add a DNS record\".",
    ],
  },
];

export function getRegistrar(id: string | null | undefined): RegistrarGuide {
  if (!id) return REGISTRARS[REGISTRARS.length - 1];
  return REGISTRARS.find((r) => r.id === id) ?? REGISTRARS[REGISTRARS.length - 1];
}
