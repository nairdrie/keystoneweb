import type { ComponentType, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { BlockPanelProps } from '../block-panel-registry';
import type { EditorContextType } from '@/lib/editor-context';

export const SETTINGS_SECTION_ORDER = [
    'content',
    'layout',
    'display',
    'style',
    'integrations',
    'advanced',
] as const;

export type SettingsSectionId = typeof SETTINGS_SECTION_ORDER[number];

export type SettingsValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | SettingsValue[]
    | { [key: string]: SettingsValue };

export type SettingsDraft = Record<string, SettingsValue>;

export type SettingsOption = {
    value: string | number | boolean;
    label: string;
    description?: string;
};

export type SettingsVisibilityRule = {
    field: string;
    equals?: SettingsValue;
    notEquals?: SettingsValue;
    in?: SettingsValue[];
    notIn?: SettingsValue[];
    exists?: boolean;
};

export type SettingsVisibility = SettingsVisibilityRule | SettingsVisibilityRule[];

type BaseSettingsControl = {
    id: string;
    label?: string;
    description?: string;
    visibleWhen?: SettingsVisibility;
};

type FieldSettingsControl = BaseSettingsControl & {
    field: string;
    defaultValue: SettingsValue;
};

export type ToggleSettingsControl = FieldSettingsControl & {
    kind: 'toggle';
    defaultValue: boolean;
};

export type SelectSettingsControl = FieldSettingsControl & {
    kind: 'select';
    defaultValue: string | number | boolean;
    options: SettingsOption[];
};

export type SegmentedSettingsControl = FieldSettingsControl & {
    kind: 'segmented';
    defaultValue: string | number | boolean;
    options: SettingsOption[];
};

export type RangeSettingsControl = FieldSettingsControl & {
    kind: 'range';
    defaultValue: number;
    min: number;
    max: number;
    step?: number;
    suffix?: string;
    format?: 'percent' | 'seconds' | 'pixels';
};

export type NumberSettingsControl = FieldSettingsControl & {
    kind: 'number';
    defaultValue: number;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
};

export type TextSettingsControl = FieldSettingsControl & {
    kind: 'text' | 'url' | 'textarea';
    defaultValue: string;
    placeholder?: string;
};

export type ColorSettingsControl = FieldSettingsControl & {
    kind: 'color';
    defaultValue: string;
    fallback: string;
    placeholder?: string;
};

export type GradientSettingsControl = FieldSettingsControl & {
    kind: 'gradient';
    fromFallback?: string;
    toFallback?: string;
};

export type LayoutSettingsControl = BaseSettingsControl & {
    kind: 'layout';
};

export type ResponsiveColumnsSettingsControl = BaseSettingsControl & {
    kind: 'responsiveColumns';
    maxColumns?: number;
};

export type PretextSettingsControl = BaseSettingsControl & {
    kind: 'pretext';
    labelName?: string;
};

export type CardStyleSettingsControl = BaseSettingsControl & {
    kind: 'cardStyle';
    presetField?: string;
    settingsField?: string;
    fallbackPreset?: string;
    supportsMedia?: boolean;
    supportsIcon?: boolean;
    supportsMarker?: boolean;
    supportsTextAlign?: boolean;
    mediaControls?: {
        layout?: boolean;
        aspect?: boolean;
        size?: boolean;
        radius?: boolean;
    };
};

export type MediaStyleSettingsControl = BaseSettingsControl & {
    kind: 'mediaStyle';
    settingsField?: string;
    fallbackPreset?: string;
    showSize?: boolean;
    showRadius?: boolean;
};

export type AdvancedCssSettingsControl = BaseSettingsControl & {
    kind: 'advancedCss';
};

export type CardMediaLayoutSettingsControl = BaseSettingsControl & {
    kind: 'cardMediaLayout';
    settingsField?: string;
    fallbackPreset?: string;
    options?: SettingsOption[];
};

export type CustomSettingsControl = BaseSettingsControl & {
    kind: 'custom';
    renderKey: string;
};

export type SettingsControl =
    | ToggleSettingsControl
    | SelectSettingsControl
    | SegmentedSettingsControl
    | RangeSettingsControl
    | NumberSettingsControl
    | TextSettingsControl
    | ColorSettingsControl
    | GradientSettingsControl
    | LayoutSettingsControl
    | ResponsiveColumnsSettingsControl
    | PretextSettingsControl
    | CardStyleSettingsControl
    | MediaStyleSettingsControl
    | AdvancedCssSettingsControl
    | CardMediaLayoutSettingsControl
    | CustomSettingsControl;

export type SettingsSection = {
    id: SettingsSectionId;
    title?: string;
    description?: string;
    visibleWhen?: SettingsVisibility;
    controls: SettingsControl[];
};

export type PanelSecondaryActionSchema = {
    id: string;
    label: string;
    icon: LucideIcon;
    suffixIcon?: LucideIcon;
    getHref?: (ctx: EditorContextType | null, blockId: string) => string | null;
};

export type BlockSettingsSchema = {
    blockType: string;
    title: string;
    subtitle?: string;
    sections: SettingsSection[];
    secondaryActions?: PanelSecondaryActionSchema[];
};

export type CustomSettingsRendererProps = BlockPanelProps & {
    schema: BlockSettingsSchema;
    draft: SettingsDraft;
    updateDraft: (field: string, value: SettingsValue) => void;
};

export type CustomSettingsRenderer = ComponentType<CustomSettingsRendererProps>;

export type CustomSettingsRenderers = Record<string, CustomSettingsRenderer>;

export function getSettingsSectionTitle(id: SettingsSectionId): string {
    switch (id) {
        case 'content':
            return 'Content';
        case 'layout':
            return 'Layout';
        case 'display':
            return 'Display';
        case 'style':
            return 'Style';
        case 'integrations':
            return 'Integrations';
        case 'advanced':
            return 'Advanced';
        default:
            return id;
    }
}

export function isCanonicalSectionId(value: string): value is SettingsSectionId {
    return (SETTINGS_SECTION_ORDER as readonly string[]).includes(value);
}

export function isVisible(visibleWhen: SettingsVisibility | undefined, draft: SettingsDraft): boolean {
    if (!visibleWhen) return true;
    const rules = Array.isArray(visibleWhen) ? visibleWhen : [visibleWhen];
    return rules.every((rule) => evaluateVisibilityRule(rule, draft));
}

function evaluateVisibilityRule(rule: SettingsVisibilityRule, draft: SettingsDraft): boolean {
    const value = readDraftPath(draft, rule.field);

    if (typeof rule.exists === 'boolean') {
        const exists = value !== undefined && value !== null && value !== '';
        if (exists !== rule.exists) return false;
    }

    if ('equals' in rule && !settingsValuesEqual(value, rule.equals)) return false;
    if ('notEquals' in rule && settingsValuesEqual(value, rule.notEquals)) return false;
    if (rule.in && !rule.in.some((entry) => settingsValuesEqual(value, entry))) return false;
    if (rule.notIn && rule.notIn.some((entry) => settingsValuesEqual(value, entry))) return false;

    return true;
}

export function readDraftPath(draft: SettingsDraft, path: string): SettingsValue {
    const parts = path.split('.');
    let value: SettingsValue = draft;

    for (const part of parts) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
        value = (value as Record<string, SettingsValue>)[part];
    }

    return value;
}

export function settingsValuesEqual(a: SettingsValue, b: SettingsValue): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

export function collectSchemaFieldDefaults(schema: BlockSettingsSchema): SettingsDraft {
    const defaults: SettingsDraft = {};

    for (const section of schema.sections) {
        for (const control of section.controls) {
            if ('field' in control) defaults[control.field] = control.defaultValue;
        }
    }

    return defaults;
}

export function getSectionIds(schema: BlockSettingsSchema): string[] {
    return schema.sections.map((section) => section.id);
}

export function renderCustomSettingsNode(node: ReactNode): ReactNode {
    return node;
}
