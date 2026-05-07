'use client';

import { useMemo, useState } from 'react';
import Header from '@/app/components/Header';
import MarketingFooter from '@/app/components/MarketingFooter';
import { blockDocs, blockGroups } from './block-docs';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function BuilderBlocksDocsPage() {
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');

  const groups = useMemo(() => ['All', ...blockGroups], []);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredBlocks = useMemo(() => {
    return blockDocs.filter((doc) => {
      const matchesGroup = activeGroup === 'All' || doc.group === activeGroup;
      if (!matchesGroup) return false;
      if (!normalizedQuery) return true;

      const searchableText = [
        doc.name,
        doc.group,
        doc.plan || '',
        doc.summary,
        ...doc.bestUsedFor,
        ...doc.features,
        ...doc.tips,
        ...(doc.notes || []),
        ...doc.settings.flatMap((setting) => [
          setting.label,
          setting.description,
          setting.notes || '',
        ]),
      ].join(' ');

      return searchableText.toLowerCase().includes(normalizedQuery);
    });
  }, [activeGroup, normalizedQuery]);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <Header />

      <section className="border-b border-slate-200 bg-white px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-4xl">
            <p className="mb-4 inline-flex rounded-full border border-red-100 bg-red-50 px-4 py-2 text-sm font-bold text-red-700">
              Builder Guide
            </p>
            <h1 className="text-5xl font-black leading-tight text-slate-950 md:text-6xl">
              Keystone Web Builder Blocks
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
              This guide explains the blocks available in the Keystone Web Builder,
              what each one is best for, and which visible settings users can adjust
              while building pages.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">Add blocks</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Blocks are page sections that can be added, selected, moved, edited,
                and removed in the builder.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">Edit content</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Many blocks let you click directly into text, images, buttons, or
                repeated items to change what visitors see.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">Open settings</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Settings open in the side panel for the selected block. Opening another
                block closes the previous panel, and changes can be applied or discarded.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label htmlFor="block-doc-search" className="text-sm font-semibold text-slate-900">
              Search blocks
            </label>
            <input
              id="block-doc-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by block or setting"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
            />

            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-900">Browse</p>
              <div className="mt-2 flex flex-wrap gap-2 lg:block lg:space-y-1">
                {groups.map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setActiveGroup(group)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition lg:flex lg:w-full lg:items-center lg:justify-between lg:rounded-lg ${
                      activeGroup === group
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    <span>{group}</span>
                    {group !== 'All' && (
                      <span className="hidden text-xs opacity-80 lg:inline">
                        {blockDocs.filter((doc) => doc.group === group).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <nav className="mt-6 hidden border-t border-slate-100 pt-5 lg:block" aria-label="Block list">
              <p className="text-sm font-semibold text-slate-900">Blocks</p>
              <ol className="mt-2 max-h-[48vh] space-y-1 overflow-auto pr-1">
                {filteredBlocks.map((doc) => (
                  <li key={doc.name}>
                    <a
                      href={`#${slugify(doc.name)}`}
                      className="block rounded-lg px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-red-700"
                    >
                      {doc.name}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </aside>

        <section className="min-w-0 space-y-6" aria-live="polite">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Available Blocks</h2>
              <p className="mt-1 text-sm text-slate-600">
                Showing {filteredBlocks.length} of {blockDocs.length} blocks.
              </p>
            </div>
            {(query || activeGroup !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setActiveGroup('All');
                }}
                className="w-fit rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
              >
                Clear filters
              </button>
            )}
          </div>

          {filteredBlocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <h3 className="text-lg font-semibold text-slate-950">No blocks found</h3>
              <p className="mt-2 text-sm text-slate-600">
                Try a different search term or browse all blocks.
              </p>
            </div>
          ) : (
            filteredBlocks.map((doc) => (
              <article
                key={doc.name}
                id={slugify(doc.name)}
                className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:scroll-mt-32 sm:p-6"
              >
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-2xl font-bold text-slate-950">{doc.name}</h3>
                      {doc.plan && (
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-200">
                          {doc.plan}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
                      {doc.summary}
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {doc.group}
                  </span>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
                  <div className="space-y-5">
                    <section>
                      <h4 className="text-sm font-bold uppercase text-slate-500">
                        Best used for
                      </h4>
                      <ul className="mt-2 space-y-2">
                        {doc.bestUsedFor.map((item) => (
                          <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-sm font-bold uppercase text-slate-500">
                        Key features
                      </h4>
                      <ul className="mt-2 space-y-2">
                        {doc.features.map((item) => (
                          <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>

                  <section>
                    <h4 className="text-sm font-bold uppercase text-slate-500">
                      Available settings
                    </h4>
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="w-1/3 px-4 py-3 font-semibold">Setting</th>
                            <th className="px-4 py-3 font-semibold">What it does</th>
                            <th className="hidden px-4 py-3 font-semibold md:table-cell">Options / notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {doc.settings.map((setting) => (
                            <tr key={`${doc.name}-${setting.label}`} className="align-top">
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                {setting.label}
                              </td>
                              <td className="px-4 py-3 leading-6 text-slate-600">
                                {setting.description}
                                {setting.notes && (
                                  <p className="mt-1 text-xs leading-5 text-slate-500 md:hidden">
                                    {setting.notes}
                                  </p>
                                )}
                              </td>
                              <td className="hidden px-4 py-3 leading-6 text-slate-500 md:table-cell">
                                {setting.notes || ' '}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <section className="rounded-xl bg-red-50 p-4 ring-1 ring-red-100">
                    <h4 className="text-sm font-bold uppercase text-red-700">Tips</h4>
                    <ul className="mt-2 space-y-2">
                      {doc.tips.map((tip) => (
                        <li key={tip} className="text-sm leading-6 text-slate-700">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                    <h4 className="text-sm font-bold uppercase text-slate-500">Notes</h4>
                    {doc.notes?.length ? (
                      <ul className="mt-2 space-y-2">
                        {doc.notes.map((note) => (
                          <li key={note} className="text-sm leading-6 text-slate-700">
                            {note}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        This block does not appear to have additional user-facing notes.
                      </p>
                    )}
                  </section>
                </div>
              </article>
            ))
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Documentation Coverage</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              This page covers the blocks that are available from the builder and focuses
              on visible, user-facing controls. Some connected blocks rely on content
              managed elsewhere, such as products, posts, events, bookings, membership,
              or menus. If a block has fewer settings listed, it is usually edited
              directly on the page or through its related management area.
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Where the builder provides image or link fields, use descriptive image
              text and clear link labels so visitors understand the content and actions.
              Blocks with unfinished links may show edit-mode warnings so builders can
              find missing destinations before publishing.
            </p>
          </section>
        </section>
      </div>
      </div>

      <MarketingFooter />
    </main>
  );
}
