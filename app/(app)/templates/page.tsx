import { getAllTemplateMetadata } from '@/lib/db/template-queries';
import Link from 'next/link';
import Header from '../../components/Header';

export default async function TemplatesPage() {
    const templates = await getAllTemplateMetadata();

    // Group templates by business type for display
    const groupedTemplates = templates.reduce((acc, template) => {
        const type = template.business_type || 'Other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(template);
        return acc;
    }, {} as Record<string, typeof templates>);

    return (
        <main className="min-h-screen bg-slate-50">
            <Header />

            {/* Hero Section */}
            <section className="pt-32 pb-16 px-4 bg-white border-b border-slate-200">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">
                        Website Templates for Every Business
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Browse our collection of professionally designed, mobile-responsive templates. Choose a starting point and customize it perfectly to fit your brand.
                    </p>
                </div>
            </section>

            {/* Templates Grid */}
            <section className="py-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto space-y-20">

                    {Object.entries(groupedTemplates).map(([type, items]) => (
                        <div key={type}>
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-bold text-slate-900 capitalize">{type} Templates</h2>
                                <span className="text-sm font-medium text-slate-500">{items.length} designs</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {items.map((template) => (
                                    <div key={template.template_id} className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-red-300 hover:shadow-xl transition-all duration-300">
                                        {/* Thumbnail Image */}
                                        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                                            <img
                                                src={template.thumbnail_url || `https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=600&h=450&fit=crop&q=80&t=${encodeURIComponent(template.template_id)}`}
                                                alt={template.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                loading="lazy"
                                            />
                                            {/* Overlay CTA */}
                                            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <Link
                                                    href="/onboarding"
                                                    className="px-6 py-2 bg-white text-slate-900 font-bold rounded-full hover:scale-105 transition-transform shadow-lg"
                                                >
                                                    Use Template
                                                </Link>
                                            </div>
                                        </div>

                                        {/* Meta Data */}
                                        <div className="p-6 flex flex-col flex-grow">
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="text-lg font-bold text-slate-900">{template.name}</h3>
                                                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md border border-slate-200">
                                                    {template.category}
                                                </span>
                                            </div>
                                            <p className="text-slate-500 text-sm mb-4 line-clamp-2">
                                                {template.description || "A clean, modern layout designed to convert visitors into customers."}
                                            </p>

                                            {/* Color Palette Preview */}
                                            <div className="mt-auto">
                                                <div className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Included Colors</div>
                                                <div className="flex gap-2">
                                                    {Object.entries(template.palettes || {}).map(([key, palette], idx) => {
                                                        // Only show up to 3 palette previews
                                                        if (idx > 3) return null;
                                                        const mainColor = (palette as any).primary || (palette as any).background || '#ccc';
                                                        return (
                                                            <div
                                                                key={key}
                                                                className="w-5 h-5 rounded-full border border-slate-200 shadow-sm"
                                                                style={{ backgroundColor: mainColor }}
                                                                title={key}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                </div>
            </section>

            {/* Footer CTA */}
            <section className="py-20 bg-red-600 text-center px-4">
                <h2 className="text-3xl font-black text-white mb-6">Found the perfect design?</h2>
                <Link
                    href="/onboarding"
                    className="inline-block px-8 py-4 rounded-full bg-white text-red-600 font-bold text-lg hover:bg-red-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                >
                    Start Building Now
                </Link>
            </section>

        </main>
    );
}
