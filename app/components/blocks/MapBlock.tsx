'use client';

import { BlockData, useEditorContext } from '@/lib/editor-context';
import EditableText from '@/app/components/EditableText';

export default function MapBlock({ block, palette }: { block: BlockData, palette: Record<string, string> }) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;

    const updateData = (key: string, value: string) => {
        context?.updateBlockData?.(block.id, key, value);
    };

    const title = block.data.title !== undefined ? block.data.title : 'Find Us';
    // Saved address for the iframe; fall back to a placeholder location only for the map display
    const savedAddress = block.data.address || '';
    const address = savedAddress || '1600 Amphitheatre Parkway, Mountain View, CA';

    // Create safe embed URL
    const encodedAddress = encodeURIComponent(address);
    // Prevent arbitrary protocol injection
    const mapUrl = `https://www.google.com/maps?q=${encodedAddress}&output=embed`;

    return (
        <section className="py-16 bg-slate-50">
            <div className="max-w-6xl mx-auto px-4 flex flex-col items-center">
                <EditableText
                    as="h2"
                    contentKey="title"
                                    styleData={block.data['title__styles']}
                    content={title}
                    defaultValue="Find Us"
                    isEditMode={isEditMode}
                    onSave={(key, val) => updateData(key, val)}
                    className="text-3xl font-bold mb-8 text-center"
                />

                <div className="w-full h-96 rounded-xl overflow-hidden shadow-lg border border-slate-200 relative group">
                    {isEditMode && (
                        <div className="absolute top-4 left-4 z-10 bg-white shadow-md p-3 rounded-lg border border-slate-200">
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Edit Address</label>
                            <input
                                type="text"
                                defaultValue={savedAddress}
                                onBlur={(e) => updateData('address', e.target.value)}
                                className="text-sm text-slate-900 border p-2 rounded w-64 outline-none focus:border-blue-500"
                                placeholder="Enter an address or landmark..."
                            />
                        </div>
                    )}
                    <iframe
                        src={mapUrl}
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen={false}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="w-full h-full pointer-events-none"
                    />
                    {!isEditMode && (
                        <iframe
                            src={mapUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 0, position: 'absolute', top: 0, left: 0 }}
                            allowFullScreen={false}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            className="w-full h-full"
                        />
                    )}
                </div>
            </div>
        </section>
    );
}
