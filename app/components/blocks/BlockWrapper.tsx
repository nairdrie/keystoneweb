'use client';

import { ReactNode, useState } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import { ArrowUp, ArrowDown, Trash2, Settings } from 'lucide-react';
import BlockSettingsModal from './BlockSettingsModal';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/motion';

interface BlockWrapperProps {
    id: string;
    type: string;
    children: ReactNode;
    customCss?: string;
    onUpdateCustomCss?: (css: string) => void;
}

export default function BlockWrapper({ id, type, children, customCss, onUpdateCustomCss }: BlockWrapperProps) {
    const context = useEditorContext();
    const isEditMode = context?.isEditMode || false;
    const isProUser = context?.isProUser || false;
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Build scoped CSS: wrap all rules under #blockId selector
    const scopedCss = customCss
        ? customCss
            .split('}')
            .filter(rule => rule.trim())
            .map(rule => {
                const trimmed = rule.trim();
                if (!trimmed) return '';
                // Prefix each rule with the block's unique ID selector
                return `#${id} ${trimmed}}`;
            })
            .join('\n')
        : '';

    const animationProps = {
        variants: staggerContainer as any,
        initial: "hidden",
        whileInView: "show",
        viewport: { once: true, margin: "-50px" }
    };

    if (!isEditMode) {
        return (
            <motion.div 
                id={id} 
                {...animationProps}
                className={`w-full ks-block ks-block-${type}`}
            >
                {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
                {children}
            </motion.div>
        );
    }

    return (
        <motion.div 
            id={id} 
            {...animationProps}
            className={`relative group w-full border-2 border-transparent hover:border-slate-300 transition-colors ks-block ks-block-${type}`}
        >
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-md border border-slate-200 rounded-md flex overflow-hidden z-[100]">
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
            {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
            {children}

            <BlockSettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                blockId={id}
                blockType={type}
                customCss={customCss || ''}
                onSaveCustomCss={(css) => onUpdateCustomCss?.(css)}
                isProUser={isProUser}
            />
        </motion.div>
    );
}
