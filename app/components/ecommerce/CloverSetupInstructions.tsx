'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Copy, Check, ExternalLink } from 'lucide-react';

interface Props {
    /** The published URL of the merchant's storefront, e.g. "https://acme.com" or "https://acme.kswd.ca". */
    siteUrl: string | null;
    /** Set true while the merchant is still picking a slug / hooking up their domain. */
    siteUrlPlaceholder?: string;
}

const PLACEHOLDER = 'https://your-store.com';

export default function CloverSetupInstructions({ siteUrl, siteUrlPlaceholder }: Props) {
    const [open, setOpen] = useState(false);
    const base = (siteUrl || siteUrlPlaceholder || PLACEHOLDER).replace(/\/$/, '');

    const successUrl = `${base}/checkout/clover/return?status=success`;
    const failureUrl = `${base}/checkout/clover/return?status=failed`;
    const cancelUrl = `${base}/checkout/clover/return?status=cancelled`;
    const webhookUrl = `${base}/api/clover/webhook`;

    return (
        <div className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100 transition-colors"
            >
                <span className="text-xs font-semibold text-slate-700">How to set up Clover (step-by-step)</span>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="px-3 pb-3 pt-1 space-y-4 text-xs text-slate-700 border-t border-slate-200 bg-white">
                    {!siteUrl && (
                        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-800 text-[11px]">
                            Publish your site first so we can show your real URLs. The URLs below use a placeholder.
                        </div>
                    )}

                    <Step n={1} title="Find your Merchant ID and Private API Token">
                        <ol className="list-decimal ml-4 space-y-1 text-[11px] text-slate-600">
                            <li>
                                Sign in to your Clover Merchant Dashboard at{' '}
                                <a href="https://www.clover.com/dashboard" target="_blank" rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                                    clover.com/dashboard <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                            </li>
                            <li>Open <strong>Account &amp; Setup</strong> → <strong>API Tokens</strong> (or <strong>Settings</strong> → <strong>Ecommerce</strong> → <strong>Ecommerce API Tokens</strong>).</li>
                            <li>Click <strong>Create Token</strong> if no token exists yet. Grant it the permissions to read merchant info and read/write orders &amp; payments.</li>
                            <li>Copy the <strong>Merchant ID</strong> (visible in the URL or top of the page) and the <strong>Private Token</strong> into the fields above.</li>
                        </ol>
                    </Step>

                    <Step n={2} title="Configure Hosted Checkout redirect URLs">
                        <p className="text-[11px] text-slate-600 mb-2">
                            Clover sends the customer back to your site after checkout. In the Clover Dashboard go to{' '}
                            <strong>Account &amp; Setup</strong> → <strong>Hosted Checkout Settings</strong> (or{' '}
                            <strong>Settings</strong> → <strong>Ecommerce</strong> → <strong>Hosted Checkout</strong>) and paste:
                        </p>
                        <UrlRow label="Success URL" value={successUrl} />
                        <UrlRow label="Failure URL" value={failureUrl} />
                        <UrlRow label="Cancel URL" value={cancelUrl} />
                        <p className="text-[10px] text-slate-400 mt-1.5">Clover will append <code>?ick=&lt;sessionId&gt;</code> automatically — leave the query string above as-is.</p>
                    </Step>

                    <Step n={3} title="Configure the webhook">
                        <p className="text-[11px] text-slate-600 mb-2">
                            The webhook is how we confirm payments and mark orders paid. In the same{' '}
                            <strong>Hosted Checkout Settings</strong> page (or under <strong>Webhooks</strong>):
                        </p>
                        <UrlRow label="Webhook URL" value={webhookUrl} />
                        <ol className="list-decimal ml-4 space-y-1 mt-2 text-[11px] text-slate-600">
                            <li>Paste the URL above into Clover's <strong>Webhook URL</strong> field.</li>
                            <li>Click <strong>Generate</strong> next to the <strong>Signing Secret</strong> and copy it.</li>
                            <li>Paste that signing secret into the <strong>Webhook Secret</strong> field above and click <strong>Save Clover Credentials</strong>.</li>
                            <li>Use Clover's <strong>Send Test</strong> button to verify the webhook is reaching us (you should see a 200 response).</li>
                        </ol>
                    </Step>

                    <Step n={4} title="Test in sandbox first">
                        <p className="text-[11px] text-slate-600">
                            Tick <strong>Sandbox mode</strong> above and enter sandbox credentials from{' '}
                            <a href="https://sandbox.dev.clover.com/" target="_blank" rel="noopener noreferrer"
                                className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                                sandbox.dev.clover.com <ExternalLink className="w-2.5 h-2.5" />
                            </a>{' '}
                            to run test transactions before going live.
                        </p>
                    </Step>
                </div>
            )}
        </div>
    );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
    return (
        <div>
            <p className="text-xs font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-900 text-white text-[10px] font-bold">{n}</span>
                {title}
            </p>
            <div className="ml-5">{children}</div>
        </div>
    );
}

function UrlRow({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);
    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {}
    };
    return (
        <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-medium text-slate-500 w-20 flex-shrink-0">{label}</span>
            <code className="flex-1 px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10.5px] text-slate-800 font-mono truncate">
                {value}
            </code>
            <button
                type="button"
                onClick={onCopy}
                title="Copy"
                className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
            >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
        </div>
    );
}
