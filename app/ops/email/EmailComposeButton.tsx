'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import EmailComposer from './EmailComposer';

export default function EmailComposeButton({
  availableFromEmails,
  senderName,
}: {
  availableFromEmails: string[];
  senderName: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
      >
        <Plus className="h-4 w-4" />
        Compose
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="my-12 w-full max-w-2xl rounded-xl border border-gray-800 bg-gray-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-3">
              <h2 className="text-base font-semibold text-white">New Email</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-2 sm:p-4">
              <EmailComposer
                availableFromEmails={availableFromEmails}
                senderName={senderName}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
