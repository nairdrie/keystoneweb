'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import { ArrowUp, ArrowDown, Trash2, Settings } from 'lucide-react';
import BlockSettingsModal from './BlockSettingsModal';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/motion';

const WALKTHROUGH_RESET_EVENT = 'ks:walkthrough-reset-ui';

interface BlockWrapperEditorProps {
    id: string;
    type: string;
    children: ReactNode;
    data?: any;
    onUpdateBlockData?: (key: string, value: any) => void;
    customCss?: string;
    onUpdateCustomCss?: (css: string) => void;
    palette?: Record<string, string>;
    slug: string;
    scopedCss: string;
    paletteVars?: React.CSSProperties;
}

export default function BlockWrapperEditor({
    id,
    type,
    children,
    data,
    onUpdateBlockData,
    customCss,
    onUpdateCustomCss,
    palette,
    slug,
    scopedCss,
    paletteVars,
}: BlockWrapperEditorProps) {
    const context = useEditorContext();
    const isProUser = context?.isProUser || false;
    const [settingsOpen, setSettingsOpen] = useState(false);

    useEffect(() => {
        const handleWalkthroughReset = () => setSettingsOpen(false);

        window.addEventListener(WALKTHROUGH_RESET_EVENT, handleWalkthroughReset);
        return () => window.removeEventListener(WALKTHROUGH_RESET_EVENT, handleWalkthroughReset);
    }, []);

    return (
        <motion.div
            key={`${id}-edit`}
            id={slug}
            data-tour="builder-section"
            variants={staggerContainer as any}
            initial="show"
            animate="show"
            style={paletteVars}
            className={`relative group w-full border-2 border-transparent hover:border-slate-300 [@media(hover:none)]:border-slate-300/60 transition-colors ks-block ks-block-${type}`}
        >
            {/* Editor controls are intentionally outside data-block-id so block __customCss cannot affect them */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity bg-white shadow-md border border-slate-200 rounded-md flex overflow-hidden z-[100]">
                <button
                    onClick={() => setSettingsOpen(true)}
                    className="p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                    title="Block Settings"
                >
                    <Settings className="w-4 h-4" />
                </button>
                <button
                    onClick={() => context?.moveBlock?.(id, 'up')}
                    className="p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                    title="Move Up"
                >
                    <ArrowUp className="w-4 h-4" />
                </button>
                <button
                    onClick={() => context?.moveBlock?.(id, 'down')}
                    className="p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                    title="Move Down"
                >
                    <ArrowDown className="w-4 h-4" />
                </button>
                <button
                    onClick={() => context?.removeBlock?.(id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete Block"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
            <div data-block-id={id}>
                {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
                {children}
            </div>

            <BlockSettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                blockId={id}
                blockType={type}
                blockData={data}
                onUpdateBlockData={onUpdateBlockData}
                customCss={customCss || ''}
                onSaveCustomCss={(css) => onUpdateCustomCss?.(css)}
                isProUser={isProUser}
                palette={palette}
            />
        </motion.div>
    );
}
