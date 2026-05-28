'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';

export default function PayPalSetupInstructions() {
    const [open, setOpen] = useState(false);

    return (
        <div className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100 transition-colors"
            >
                <span className="text-xs font-semibold text-slate-700">How to set up PayPal (step-by-step)</span>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="px-3 pb-3 pt-1 space-y-4 text-xs text-slate-700 border-t border-slate-200 bg-white">
                    <Step n={1} title="Create a REST API app">
                        <ol className="list-decimal ml-4 space-y-1 text-[11px] text-slate-600">
                            <li>
                                Sign in to the PayPal Developer Dashboard at{' '}
                                <a href="https://developer.paypal.com/dashboard/applications/live" target="_blank" rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                                    developer.paypal.com <ExternalLink className="w-2.5 h-2.5" />
                                </a>{' '}
                                using your PayPal <strong>business</strong> account.
                            </li>
                            <li>
                                Make sure the toggle at the top right is set to <strong>Live</strong> (use <strong>Sandbox</strong> only for testing).
                            </li>
                            <li>
                                Under <strong>Apps &amp; Credentials</strong>, click <strong>Create App</strong>. Give it a name
                                (e.g. "My Website Store") and choose the <strong>Merchant</strong> app type.
                            </li>
                        </ol>
                    </Step>

                    <Step n={2} title="Copy your Client ID and Secret">
                        <ol className="list-decimal ml-4 space-y-1 text-[11px] text-slate-600">
                            <li>
                                On the app's page, copy the <strong>Client ID</strong> and paste it into the <strong>Client ID</strong> field above.
                            </li>
                            <li>
                                Click <strong>Show</strong> next to <strong>Secret key</strong>, copy it, and paste it into the <strong>Secret</strong> field above.
                            </li>
                            <li>
                                Keep the secret private — treat it like a password. It's stored encrypted and never shown in full again.
                            </li>
                        </ol>
                    </Step>

                    <Step n={3} title="Save and enable">
                        <ol className="list-decimal ml-4 space-y-1 text-[11px] text-slate-600">
                            <li>Tick <strong>Sandbox mode</strong> only if you pasted Sandbox credentials for testing; leave it off for real payments.</li>
                            <li>Click <strong>Save Settings</strong> at the bottom of this panel.</li>
                            <li>Select <strong>PayPal (PayPal &amp; cards)</strong> as your payment method above.</li>
                        </ol>
                        <p className="text-[11px] text-slate-500 mt-1.5">
                            Funds settle directly to your PayPal account — you are the merchant of record and PayPal's
                            fees are charged to you. No webhook or redirect URLs are required; payments are captured
                            inline and confirmed immediately.
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
