'use client';

import { useMemo } from 'react';
import { Crown } from 'lucide-react';
import { compileScript } from '@/lib/keyframe';

interface KeyframeEditorProps {
    blockId: string;
    blockType: string;
    value: string;
    onChange: (value: string) => void;
    isProUser: boolean;
    /** Optional list of contentKeys to surface as available selectors. */
    fieldNames?: string[];
}

const PLACEHOLDER = `# Keyframe — safe per-block scripting.
# Selectors target editable fields in this block: @<fieldName>
# Example: cycle the title every 3 seconds.

# every 3s {
#   cycle text on @title with ["Build faster", "Ship sooner", "Win bigger"]
# }

# Typewriter effect on a title, then blink cursor.
# on load {
#   hold animations
#   show @title
#   type "Hello" on @title speed 200ms
#   release animations
#   blink "_" on @title every 500ms
# }
`;

export default function KeyframeEditor({
    blockId,
    blockType,
    value,
    onChange,
    isProUser,
    fieldNames,
}: KeyframeEditorProps) {
    const { errors } = useMemo(() => compileScript(value), [value]);

    if (!isProUser) {
        return (
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-center gap-2 font-bold">
                    <Crown className="h-4 w-4" />
                    Keyframe scripting is a Pro feature
                </div>
                <p className="mt-1 text-xs text-amber-700">
                    Add safe, declarative interactions like loops, typewriter effects, and hover behaviors to this block.
                </p>
            </div>
        );
    }

    return (
        <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor={`${blockId}-keyframe`}>
                Keyframe Script
            </label>
            <p className="mt-1 text-[11px] text-slate-500">
                Safe scripting for this block. Target fields with <code className="rounded bg-slate-100 px-1 py-px font-mono text-[10px]">@fieldName</code>.
            </p>

            {fieldNames && fieldNames.length > 0 && (
                <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Available selectors:</span>{' '}
                    {fieldNames.map((name, i) => (
                        <span key={name}>
                            <code className="rounded bg-white px-1 py-px font-mono text-[10px] text-slate-700 ring-1 ring-slate-200">@{name}</code>
                            {i < fieldNames.length - 1 && ' '}
                        </span>
                    ))}
                </div>
            )}

            <textarea
                id={`${blockId}-keyframe`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={PLACEHOLDER}
                className="mt-2 min-h-40 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-cyan-300 outline-none selection:bg-cyan-900 focus:ring-2 focus:ring-blue-500"
                spellCheck={false}
            />

            {errors.length > 0 && (
                <ul className="mt-2 space-y-1 rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
                    {errors.map((err, idx) => (
                        <li key={idx} className="font-mono">
                            Line {err.line}:{err.column} — {err.message}
                        </li>
                    ))}
                </ul>
            )}

            <p className="mt-2 text-[10px] text-slate-400">
                Block scope: <code className="font-mono">{`[data-block-id="${blockId}"]`}</code>
                {' · '}
                Type: <code className="font-mono">{blockType}</code>
            </p>
        </div>
    );
}

/** Extract candidate field names from a block's data object — keys that are simple strings or strings on EditableImage settings. */
export function inferFieldNames(blockData: unknown): string[] {
    if (!blockData || typeof blockData !== 'object') return [];
    const record = blockData as Record<string, unknown>;
    const names: string[] = [];
    for (const key of Object.keys(record)) {
        if (key.startsWith('__')) continue;
        if (key.endsWith('__styles') || key.endsWith('__settings') || key.endsWith('__attribution') || key.endsWith('__textReveal')) continue;
        if (key.endsWith('Link') || key.endsWith('Icon')) continue;
        const v = record[key];
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            names.push(key);
        }
    }
    return names.sort();
}
