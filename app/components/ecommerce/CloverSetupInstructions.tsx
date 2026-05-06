'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';

interface Props {
    siteUrl: string | null;
    siteUrlPlaceholder?: string;
}

export default function CloverSetupInstructions({ siteUrl }: Props) {
    const [open, setOpen] = useState(false);

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
                    <Step n={1} title="Create an Ecommerce API token">
                        <ol className="list-decimal ml-4 space-y-1 text-[11px] text-slate-600">
                            <li>
                                Sign in to your Clover Merchant Dashboard at{' '}
                                <a href="https://www.clover.com/dashboard" target="_blank" rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                                    clover.com/dashboard <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                            </li>
                            <li>
                                Go to <strong>Account &amp; Setup</strong> → <strong>Ecommerce</strong> → <strong>Ecommerce API Tokens</strong>.
                            </li>
                            <li>
                                Click <strong>Create Token</strong>. When prompted to choose a token type, select{' '}
                                <strong>Hosted iFrame + API/SDK</strong> (not "Hosted Checkout").
                            </li>
                            <li>
                                Copy both the <strong>Public Key</strong> and the <strong>Private Key</strong> that appear.
                                Paste them into the <strong>Public Key (ECOM)</strong> and <strong>Private Key (ECOM)</strong> fields above.
                            </li>
                        </ol>
                    </Step>

                    <Step n={2} title="Find your Merchant ID">
                        <p className="text-[11px] text-slate-600 mb-1.5">
                            The Merchant ID is <em>not</em> shown on the token screen — it's part of your account URL. While still in the Clover dashboard, look at the address bar:
                        </p>
                        <div className="bg-slate-100 border border-slate-200 rounded px-2 py-1.5 font-mono text-[10.5px] text-slate-700 break-all">
                            clover.com/dashboard/<span className="bg-yellow-200 rounded px-0.5">M1AB2CD3EF4GH</span>/...
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5">
                            The highlighted segment (starts with <code>M</code>, 13 characters) is your Merchant ID. Paste it into the <strong>Merchant ID</strong> field above.
                            You can also find it under <strong>Account &amp; Setup</strong> → <strong>About Your Business</strong>.
                        </p>
                    </Step>

                    <Step n={3} title="Save and enable">
                        <ol className="list-decimal ml-4 space-y-1 text-[11px] text-slate-600">
                            <li>Enter your Merchant ID, Public Key, and Private Key in the fields above.</li>
                            <li>Tick <strong>Sandbox mode</strong> if you're testing with sandbox credentials from{' '}
                                <a href="https://sandbox.dev.clover.com/" target="_blank" rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                                    sandbox.dev.clover.com <ExternalLink className="w-2.5 h-2.5" />
                                </a>.
                            </li>
                            <li>Click <strong>Save Clover Credentials</strong>.</li>
                            <li>Enable the <strong>Credit / Debit Card (Clover)</strong> payment method in your payment settings above.</li>
                        </ol>
                        <p className="text-[11px] text-slate-500 mt-1.5">
                            No webhook URLs or redirect URLs are needed — payments are processed inline and confirmed immediately.
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
