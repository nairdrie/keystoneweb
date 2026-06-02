'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Sparkles, Upload, X } from 'lucide-react';
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, type LeadSource } from '@/lib/ops/leads';

const INPUT_CLASSES =
  'w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500';

export default function NewLeadButton({ opsBasePath = '' }: { opsBasePath?: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractStatus, setExtractStatus] = useState<string | null>(null);

  const [contactName, setContactName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState<LeadSource>('cold_call');
  const [sourceDetail, setSourceDetail] = useState('');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  function reset() {
    setContactName('');
    setBusinessName('');
    setEmail('');
    setPhone('');
    setWebsite('');
    setAddress('');
    setCity('');
    setBusinessType('');
    setNotes('');
    setSource('cold_call');
    setSourceDetail('');
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setError(null);
    setExtractStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    setExtractStatus(null);
    // Default the source to physical_ad when user attaches an image — they
    // can override via the dropdown.
    if (source === 'cold_call') setSource('physical_ad');
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setExtractStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function extractFromImage() {
    if (!imageFile) return;
    setExtracting(true);
    setError(null);
    setExtractStatus(null);
    try {
      const fd = new FormData();
      fd.append('file', imageFile);
      const res = await fetch('/api/ops/leads/extract-from-image', {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[ops/leads/extract-from-image]', res);
        throw new Error(data.error ?? 'Extraction failed');
      }
      const data = await res.json();
      // Only fill empty fields — don't blow away anything the user already typed.
      let filled = 0;
      const setIfEmpty = (
        current: string,
        next: string | null,
        setter: (v: string) => void,
      ) => {
        if (!current && next) {
          setter(next);
          filled += 1;
        }
      };
      setIfEmpty(contactName, data.contact_name, setContactName);
      setIfEmpty(businessName, data.business_name, setBusinessName);
      setIfEmpty(email, data.email, setEmail);
      setIfEmpty(phone, data.phone, setPhone);
      setIfEmpty(website, data.website, setWebsite);
      setIfEmpty(address, data.address, setAddress);
      setIfEmpty(city, data.city, setCity);
      setIfEmpty(businessType, data.business_type, setBusinessType);
      setIfEmpty(notes, data.notes, setNotes);
      if (data.suggested_source && source === 'cold_call') {
        setSource(data.suggested_source);
      }
      setExtractStatus(
        filled === 0
          ? "Couldn't read anything new — fields already filled or image unclear."
          : `Filled ${filled} field${filled === 1 ? '' : 's'} from the image.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let res: Response;
      if (imageFile) {
        // Multipart submit so the server can upload the image atomically.
        const fd = new FormData();
        fd.append('file', imageFile);
        fd.append('contact_name', contactName.trim());
        fd.append('business_name', businessName.trim());
        fd.append('email', email.trim());
        fd.append('phone', phone.trim());
        fd.append('website', website.trim());
        fd.append('address', address.trim());
        fd.append('city', city.trim());
        fd.append('business_type', businessType.trim());
        fd.append('notes', notes.trim());
        fd.append('source', source);
        fd.append('source_detail', sourceDetail.trim());
        res = await fetch('/api/ops/leads', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/ops/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_name: contactName.trim() || null,
            business_name: businessName.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            website: website.trim() || null,
            address: address.trim() || null,
            city: city.trim() || null,
            business_type: businessType.trim() || null,
            notes: notes.trim() || null,
            source,
            source_detail: sourceDetail.trim() || null,
          }),
        });
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Create failed');
      }
      const lead = await res.json();
      reset();
      setOpen(false);
      router.push(`${opsBasePath}/leads/${lead.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
      >
        + New lead
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4 overflow-y-auto py-8">
            <div className="w-full max-w-lg rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
                <h3 className="text-sm font-semibold text-white">New lead</h3>
                <button
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  className="text-gray-500 hover:text-white text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
                {/* Image upload + AI extract */}
                <div className="rounded-md border border-dashed border-gray-700 bg-gray-950 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">
                      Photo of card / ad / sign
                    </span>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={clearImage}
                        className="text-[11px] text-gray-500 hover:text-white flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> remove
                      </button>
                    )}
                  </div>

                  {imagePreview ? (
                    // Using <img> rather than next/image because the URL is a
                    // local blob: URL that next/image can't optimize anyway.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreview}
                      alt="Lead source preview"
                      className="w-full max-h-64 object-contain rounded bg-gray-900"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 rounded border border-gray-700 bg-gray-800 px-3 py-6 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Upload an image
                    </button>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onFilePick}
                    className="hidden"
                  />

                  {imagePreview && (
                    <button
                      type="button"
                      onClick={extractFromImage}
                      disabled={extracting}
                      className="w-full flex items-center justify-center gap-2 rounded bg-violet-600 hover:bg-violet-500 px-3 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {extracting ? 'Reading the image…' : 'Extract details with AI'}
                    </button>
                  )}

                  {extractStatus && (
                    <p className="text-[11px] text-emerald-400">{extractStatus}</p>
                  )}
                </div>

                <Field label="Contact name">
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Jane Doe"
                    className={INPUT_CLASSES}
                  />
                </Field>

                <Field label="Business name">
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Doe Plumbing Co."
                    className={INPUT_CLASSES}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@doeplumbing.com"
                      className={INPUT_CLASSES}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className={INPUT_CLASSES}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Website">
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://…"
                      className={INPUT_CLASSES}
                    />
                  </Field>
                  <Field label="Business type">
                    <input
                      type="text"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      placeholder="plumber, restaurant…"
                      className={INPUT_CLASSES}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-[2fr_1fr] gap-3">
                  <Field label="Address">
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className={INPUT_CLASSES}
                    />
                  </Field>
                  <Field label="City">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={INPUT_CLASSES}
                    />
                  </Field>
                </div>

                <Field label="Source">
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as LeadSource)}
                    className={INPUT_CLASSES}
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {LEAD_SOURCE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Source detail (campaign, event, location…)">
                  <input
                    type="text"
                    value={sourceDetail}
                    onChange={(e) => setSourceDetail(e.target.value)}
                    placeholder="e.g. Bus stop ad on Yonge St, Chamber meetup"
                    className={INPUT_CLASSES}
                  />
                </Field>

                <Field label="Notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Any extra context…"
                    className={`${INPUT_CLASSES} resize-y`}
                  />
                </Field>

                {error && (
                  <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      reset();
                    }}
                    className="rounded-md bg-gray-800 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Creating…' : 'Create lead'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
