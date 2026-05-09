'use client';

import React from 'react';
import EditableText from './EditableText';
import { readableTextColorForBackground, resolvePaletteColor } from '@/lib/palette-colors';

export type PretextStyle = 'text' | 'pill' | 'outline' | 'underline';
export type PretextAlignment = 'left' | 'center';

export const PRETEXT_STYLES: PretextStyle[] = ['text', 'pill', 'outline', 'underline'];
export const PRETEXT_ALIGNMENTS: PretextAlignment[] = ['left', 'center'];

export interface PretextData {
    pretextEnabled?: boolean;
    pretext?: string;
    pretextStyle?: PretextStyle;
    pretextColor?: string;
    pretextAlignment?: PretextAlignment;
}

interface BlockPretextProps {
    data: PretextData & Record<string, unknown>;
    isEditMode: boolean;
    palette: Record<string, string>;
    updateContent: (key: string, value: unknown) => void;
    defaultText?: string;
    contentKey?: string;
}

export default function BlockPretext({
    data,
    isEditMode,
    palette,
    updateContent,
    defaultText = 'Label',
    contentKey = 'pretext',
}: BlockPretextProps) {
    if (!data?.pretextEnabled) return null;

    const style: PretextStyle = isPretextStyle(data.pretextStyle) ? data.pretextStyle : 'text';
    const align: PretextAlignment = data.pretextAlignment === 'center' ? 'center' : 'left';
    const colorToken = typeof data.pretextColor === 'string' && data.pretextColor.length > 0
        ? data.pretextColor
        : 'palette:secondary';
    const color = resolvePaletteColor(colorToken, palette, palette.secondary || '#dc2626');

    const alignClass = align === 'center' ? 'text-center' : 'text-left';

    const baseTypography = 'text-xs font-bold uppercase tracking-[0.2em]';
    let className = baseTypography;
    let elementStyle: React.CSSProperties = { color };

    if (style === 'pill') {
        className = `inline-block ${baseTypography} px-3 py-1.5 rounded-full`;
        elementStyle = {
            backgroundColor: color,
            color: readableTextColorForBackground(color, '#ffffff'),
        };
    } else if (style === 'outline') {
        className = `inline-block ${baseTypography} px-3 py-1 rounded-full border`;
        elementStyle = { borderColor: color, color };
    } else if (style === 'underline') {
        className = `inline-block ${baseTypography} pb-1 border-b-2`;
        elementStyle = { borderColor: color, color };
    }

    const content = typeof data[contentKey] === 'string' ? (data[contentKey] as string) : undefined;

    return (
        <div className={`${alignClass} mb-3`}>
            <EditableText
                as="span"
                contentKey={contentKey}
                content={content}
                defaultValue={defaultText}
                isEditMode={isEditMode}
                onSave={(key, value) => updateContent(key, value)}
                className={className}
                style={elementStyle}
            />
        </div>
    );
}

function isPretextStyle(value: unknown): value is PretextStyle {
    return typeof value === 'string' && (PRETEXT_STYLES as string[]).includes(value);
}
