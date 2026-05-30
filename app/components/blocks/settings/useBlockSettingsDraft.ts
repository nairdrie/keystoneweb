'use client';

import { useEffect, useMemo, useState } from 'react';
import { useEditorContext } from '@/lib/editor-context';
import {
    areSectionSettingsEqual,
    normalizeSectionSettings,
    type SectionSettings,
} from '@/lib/builder/layout-settings';
import {
    PRETEXT_DEFAULTS,
    readPretextFromBlockData,
} from '../panel-shared';
import type {
    BlockSettingsSchema,
    SettingsControl,
    SettingsDraft,
    SettingsValue,
} from './schema';
import { settingsValuesEqual } from './schema';

type UseBlockSettingsDraftArgs = {
    blockId: string;
    schema: BlockSettingsSchema;
    blockData: Record<string, unknown> | undefined;
    customCss: string;
    onDraftBlockDataChange?: (data: Record<string, unknown> | null) => void;
};

const EMPTY_BLOCK_DATA: Record<string, unknown> = {};

export function useBlockSettingsDraft({
    blockId,
    schema,
    blockData,
    customCss,
    onDraftBlockDataChange,
}: UseBlockSettingsDraftArgs) {
    const context = useEditorContext();
    const source = blockData || EMPTY_BLOCK_DATA;
    const initialDraft = useMemo(
        () => buildInitialDraft(schema, source, customCss),
        [schema, source, customCss],
    );
    const persistedSectionSettings = useMemo(
        () => normalizeSectionSettings(source.sectionSettings),
        [source.sectionSettings],
    );
    const [draft, setDraft] = useState<SettingsDraft>(initialDraft);
    const [sectionSettings, setSectionSettings] = useState<SectionSettings>(persistedSectionSettings);

    useEffect(() => {
        if (!onDraftBlockDataChange) return;
        onDraftBlockDataChange({
            ...source,
            ...draft,
            sectionSettings,
        });
    }, [draft, onDraftBlockDataChange, sectionSettings, source]);

    useEffect(() => {
        if (!context?.updateBlockDataBatch) return;
        const updates: Record<string, unknown> = {};

        for (const [field, value] of Object.entries(draft)) {
            if (!settingsValuesEqual(value, initialDraft[field])) updates[field] = value;
        }

        if (!areSectionSettingsEqual(sectionSettings, persistedSectionSettings)) {
            updates.sectionSettings = normalizeSectionSettings(sectionSettings);
        }

        if (Object.keys(updates).length > 0) {
            context.updateBlockDataBatch(blockId, updates);
        }
    }, [blockId, context, draft, initialDraft, persistedSectionSettings, sectionSettings]);

    const updateDraft = (field: string, value: SettingsValue) => {
        setDraft((current) => ({ ...current, [field]: value }));
    };

    return {
        draft,
        setDraft,
        updateDraft,
        sectionSettings,
        setSectionSettings,
    };
}

function buildInitialDraft(
    schema: BlockSettingsSchema,
    blockData: Record<string, unknown>,
    customCss: string,
): SettingsDraft {
    const draft: SettingsDraft = {};

    for (const control of getSchemaControls(schema)) {
        applyControlInitialValue(control, blockData, customCss, draft);
    }

    return draft;
}

function applyControlInitialValue(
    control: SettingsControl,
    blockData: Record<string, unknown>,
    customCss: string,
    draft: SettingsDraft,
) {
    if ('field' in control) {
        draft[control.field] = readSetting(blockData[control.field], control.defaultValue);
        return;
    }

    if (control.kind === 'pretext') {
        const pretext = readPretextFromBlockData(blockData);
        draft.pretextEnabled = pretext.pretextEnabled;
        draft.pretextStyle = pretext.pretextStyle || PRETEXT_DEFAULTS.pretextStyle;
        draft.pretextColor = pretext.pretextColor || PRETEXT_DEFAULTS.pretextColor;
        draft.pretextAlignment = pretext.pretextAlignment || PRETEXT_DEFAULTS.pretextAlignment;
        return;
    }

    if (control.kind === 'cardStyle') {
        const presetField = control.presetField || 'cardStyle';
        const settingsField = control.settingsField || 'cardSettings';
        draft[presetField] = readSetting(blockData[presetField], control.fallbackPreset || 'soft');
        if (blockData[settingsField] && typeof blockData[settingsField] === 'object' && !Array.isArray(blockData[settingsField])) {
            draft[settingsField] = blockData[settingsField] as Record<string, SettingsValue>;
        }
        return;
    }

    if (control.kind === 'cardMediaLayout' || control.kind === 'mediaStyle') {
        const settingsField = control.settingsField || 'cardSettings';
        if (blockData[settingsField] && typeof blockData[settingsField] === 'object' && !Array.isArray(blockData[settingsField])) {
            draft[settingsField] = blockData[settingsField] as Record<string, SettingsValue>;
        }
        if (draft.cardStyle === undefined) draft.cardStyle = readSetting(blockData.cardStyle, control.fallbackPreset || 'soft');
        return;
    }

    if (control.kind === 'advancedCss') {
        draft.__customCss = customCss;
        draft.__customScript = typeof blockData.__customScript === 'string' ? blockData.__customScript : '';
    }
}

function getSchemaControls(schema: BlockSettingsSchema): SettingsControl[] {
    return schema.sections.flatMap((section) => section.controls);
}

function readSetting(value: unknown, defaultValue: SettingsValue): SettingsValue {
    if (value === undefined || value === null) return defaultValue;
    if (Array.isArray(defaultValue)) return Array.isArray(value) ? value as SettingsValue[] : defaultValue;
    if (typeof defaultValue === 'number') {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : defaultValue;
    }
    if (typeof defaultValue === 'boolean') return Boolean(value);
    if (typeof defaultValue === 'string') return String(value);
    if (typeof defaultValue === 'object') {
        return typeof value === 'object' && !Array.isArray(value) ? value as Record<string, SettingsValue> : defaultValue;
    }
    return value as SettingsValue;
}
