export const CONTENT_NORMALIZATION_MODELS = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Use validated env settings when available, otherwise default to Claude Haiku 4.5.',
  },
  {
    value: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    description: 'Lowest cost Anthropic option for light normalization.',
  },
  {
    value: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    description: 'Recommended balance of quality and cost.',
  },
  {
    value: 'claude-opus-4-6',
    label: 'Claude Opus 4.6',
    description: 'Highest quality and highest cost.',
  },
] as const;

export type ContentNormalizationModel = (typeof CONTENT_NORMALIZATION_MODELS)[number]['value'];

export function isSupportedContentNormalizationModel(value: string): value is Exclude<ContentNormalizationModel, 'auto'> {
  return CONTENT_NORMALIZATION_MODELS.some((option) => option.value === value && option.value !== 'auto');
}
