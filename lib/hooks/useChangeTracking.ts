import { useState, useCallback } from 'react';

export interface Change {
  id: string;
  field: string;
  label: string;
  from: string;
  to: string;
  rawFrom?: string; // Stored for full undo/redo state restoration
  rawTo?: string;
  timestamp: number;
}

export interface ChangeTrackingState {
  changes: Change[];
  history: Change[][];
  historyIndex: number;
}

// Human-readable block type names
const BLOCK_TYPE_LABELS: Record<string, string> = {
  hero: 'Hero',
  text: 'Rich Text',
  image: 'Image',
  servicesGrid: 'Services Grid',
  featuresList: 'Features',
  aboutImageText: 'About',
  testimonials: 'Testimonials',
  stats: 'Stats',
  gallery: 'Gallery',
  contact: 'Contact Info',
  faq: 'FAQ',
  cta: 'Call to Action',
  booking: 'Booking',
  productGrid: 'Product Catalog',
  contact_form: 'Contact Form',
  logoCloud: 'Logo Cloud',
  pricing: 'Pricing',
  team: 'Team',
  map: 'Map',
  blog: 'Blog',
  custom_html: 'Custom HTML',
};

// Human-readable field labels
const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  subtitle: 'subtitle',
  html: 'text content',
  description: 'description',
  buttonText: 'button text',
  buttonTextLink: 'button link',
  backgroundColor: 'background color',
  textColor: 'text color',
  image: 'image',
  images: 'images',
  videoUrl: 'video',
  variant: 'layout style',
  columns: 'column count',
  showPattern: 'decorative pattern',
  items: 'items',
  members: 'team members',
  tiers: 'pricing tiers',
  questions: 'questions',
  services: 'services',
  features: 'features',
  logos: 'logos',
  posts: 'posts',
  products: 'products',
  phone: 'phone number',
  email: 'email address',
  address: 'address',
  mapUrl: 'map link',
  quote: 'quote',
  name: 'name',
  role: 'role',
  bio: 'bio',
  price: 'price',
  period: 'billing period',
  rating: 'rating',
  highlighted: 'highlighted',
  label: 'label',
  value: 'value',
  question: 'question',
  answer: 'answer',
};

function getBlockLabel(type: string): string {
  return BLOCK_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function getFieldLabel(key: string): string {
  // Handle style fields like title__styles, subtitle__styles
  if (key.endsWith('__styles')) {
    const base = key.replace('__styles', '');
    return `${FIELD_LABELS[base] || base} formatting`;
  }
  return FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
}

// Strip HTML tags for clean text display
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// Truncate text for display
function truncate(text: string, max: number = 50): string {
  if (text.length <= max) return text;
  return text.substring(0, max) + '...';
}

// Summarize what changed in an array field (items, members, tiers, etc.)
function summarizeArrayChange(oldArr: any[], newArr: any[], fieldLabel: string): { from: string; to: string } {
  if (oldArr.length !== newArr.length) {
    return {
      from: `${oldArr.length} ${fieldLabel}`,
      to: `${newArr.length} ${fieldLabel}`,
    };
  }

  // Same length — find what changed within the array
  for (let i = 0; i < oldArr.length; i++) {
    const oldItem = oldArr[i];
    const newItem = newArr[i];
    if (JSON.stringify(oldItem) === JSON.stringify(newItem)) continue;

    // Simple string items
    if (typeof oldItem === 'string' && typeof newItem === 'string') {
      return {
        from: truncate(oldItem),
        to: truncate(newItem),
      };
    }

    // Object items — find the specific property that changed
    if (typeof oldItem === 'object' && typeof newItem === 'object') {
      for (const prop of Object.keys(newItem)) {
        if (JSON.stringify(oldItem[prop]) !== JSON.stringify(newItem[prop])) {
          const propLabel = FIELD_LABELS[prop] || prop;
          const oldDisplay = typeof oldItem[prop] === 'string' ? truncate(oldItem[prop]) : String(oldItem[prop] ?? '(empty)');
          const newDisplay = typeof newItem[prop] === 'string' ? truncate(newItem[prop]) : String(newItem[prop] ?? '(empty)');
          return {
            from: `Item ${i + 1} ${propLabel}: ${oldDisplay}`,
            to: `Item ${i + 1} ${propLabel}: ${newDisplay}`,
          };
        }
      }
    }
  }

  return { from: `${oldArr.length} ${fieldLabel}`, to: `${newArr.length} ${fieldLabel} (modified)` };
}

// Format a simple value for display
function formatValue(val: any, fieldKey: string): string {
  if (val === undefined || val === null || val === '') return '(empty)';

  // Booleans
  if (typeof val === 'boolean') return val ? 'on' : 'off';

  // Numbers
  if (typeof val === 'number') return String(val);

  // Strings
  if (typeof val === 'string') {
    // HTML content — strip tags for readable display
    if (val.includes('<') && val.includes('>')) {
      const stripped = stripHtml(val);
      return truncate(stripped) || '(empty)';
    }

    // Color hex values — keep them short
    if (/^#[0-9a-fA-F]{3,8}$/.test(val)) return val;

    // URLs — just show truncated
    if (val.startsWith('http') || val.startsWith('/')) return truncate(val, 40);

    return truncate(val);
  }

  // Objects/arrays that somehow got here
  if (typeof val === 'object') {
    return truncate(JSON.stringify(val), 40);
  }

  return String(val);
}

// Format style objects into readable descriptions
function formatStyleChange(oldStyles: any, newStyles: any): { from: string; to: string } | null {
  const oldParts: string[] = [];
  const newParts: string[] = [];

  const allKeys = new Set([...Object.keys(oldStyles || {}), ...Object.keys(newStyles || {})]);
  for (const key of allKeys) {
    const ov = oldStyles?.[key];
    const nv = newStyles?.[key];
    if (JSON.stringify(ov) !== JSON.stringify(nv)) {
      const label = key === 'fontFamily' ? 'font' : key === 'fontSize' ? 'size' : key === 'fontWeight' ? 'weight' : key === 'color' ? 'color' : key === 'textAlign' ? 'alignment' : key;
      oldParts.push(`${label}: ${ov ?? '(default)'}`);
      newParts.push(`${label}: ${nv ?? '(default)'}`);
    }
  }

  if (oldParts.length === 0) return null;
  return { from: oldParts.join(', '), to: newParts.join(', ') };
}

// Helper to diff blocks array and create a human-readable change
function diffBlocks(oldBlocksRaw: string, newBlocksRaw: string): Partial<Change> | null {
  try {
    const oldBlocks = JSON.parse(oldBlocksRaw || '[]');
    const newBlocks = JSON.parse(newBlocksRaw || '[]');

    if (oldBlocks.length !== newBlocks.length) {
      return {
        label: 'Layout Blocks',
        from: `${oldBlocks.length} blocks`,
        to: `${newBlocks.length} blocks`,
      };
    }

    // Find which exact block changed
    for (let i = 0; i < oldBlocks.length; i++) {
      const oldB = oldBlocks[i];
      const newB = newBlocks[i];

      if (JSON.stringify(oldB.data) !== JSON.stringify(newB.data)) {
        const blockLabel = getBlockLabel(newB.type);

        // Find which exact data field changed
        const allKeys = new Set([...Object.keys(oldB.data || {}), ...Object.keys(newB.data || {})]);

        for (const key of allKeys) {
          const oldVal = oldB.data?.[key];
          const newVal = newB.data?.[key];

          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            const fieldLabel = getFieldLabel(key);

            // Style object changes (fonts, formatting)
            if (key.endsWith('__styles') && typeof oldVal === 'object' && typeof newVal === 'object') {
              const styleDiff = formatStyleChange(oldVal, newVal);
              if (styleDiff) {
                return {
                  label: `${blockLabel} — ${fieldLabel}`,
                  from: styleDiff.from,
                  to: styleDiff.to,
                };
              }
            }

            // Array changes (items, members, tiers, etc.)
            if (Array.isArray(oldVal) && Array.isArray(newVal)) {
              const summary = summarizeArrayChange(oldVal, newVal, fieldLabel);
              return {
                label: `${blockLabel} — ${fieldLabel}`,
                from: summary.from,
                to: summary.to,
              };
            }

            // Simple value changes
            return {
              label: `${blockLabel} — ${fieldLabel}`,
              from: formatValue(oldVal, key),
              to: formatValue(newVal, key),
            };
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to diff blocks', e);
  }
  return null;
}

/**
 * Hook to track changes in the editor
 * Maintains change history, supports undo/redo
 */
export function useChangeTracking() {
  const [state, setState] = useState<ChangeTrackingState>({
    changes: [],
    history: [[]],
    historyIndex: 0,
  });

  const [lastAction, setLastAction] = useState<{ type: 'undo' | 'redo', timestamp: number, changes: Change[] } | null>(null);

  // Add a new change and update history
  const addChange = useCallback((
    field: string,
    label: string,
    from: string,
    to: string
  ) => {
    if (from === to) return; // No actual change

    setState((prev) => {
      // Remove any redo history if we're making a new change
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);

      // Default change payload
      let finalLabel = label;
      let finalFrom = from;
      let finalTo = to;
      let rawFrom = from;
      let rawTo = to;

      if (field === 'blocks') {
        const diff = diffBlocks(from, to);
        if (diff) {
          finalLabel = diff.label || label;
          finalFrom = diff.from || from;
          finalTo = diff.to || to;
        }
      }

      // Create new change
      const newChange: Change = {
        id: `${field}-${Date.now()}`,
        field,
        label: finalLabel,
        from: finalFrom,
        to: finalTo,
        rawFrom,
        rawTo,
        timestamp: Date.now(),
      };

      // Check if we're modifying an existing field change
      const existingChangeIndex = prev.changes.findIndex(
        (c) => c.field === field
      );

      let updatedChanges: Change[];
      if (existingChangeIndex !== -1) {
        // Update existing change, preserving the ORIGINAL starting point (both clean and raw)
        updatedChanges = prev.changes.map((c, i) =>
          i === existingChangeIndex
            ? { ...newChange, from: c.from, rawFrom: c.rawFrom || c.from }
            : c
        );
      } else {
        // Add new change
        updatedChanges = [...prev.changes, newChange];
      }

      newHistory.push(updatedChanges);

      return {
        changes: updatedChanges,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
  }, []);

  // Undo last change
  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex <= 0) return prev;

      const newIndex = prev.historyIndex - 1;
      const newChanges = prev.history[newIndex];

      setLastAction({ type: 'undo', timestamp: Date.now(), changes: newChanges });

      return {
        ...prev,
        changes: newChanges,
        historyIndex: newIndex,
      };
    });
  }, []);

  // Redo last undone change
  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;

      const newIndex = prev.historyIndex + 1;
      const newChanges = prev.history[newIndex];

      setLastAction({ type: 'redo', timestamp: Date.now(), changes: newChanges });

      return {
        ...prev,
        changes: newChanges,
        historyIndex: newIndex,
      };
    });
  }, []);

  // Clear all changes
  const clearChanges = useCallback(() => {
    setState({
      changes: [],
      history: [[]],
      historyIndex: 0,
    });
  }, []);

  return {
    changes: state.changes,
    addChange,
    undo,
    redo,
    canUndo: state.historyIndex > 0,
    canRedo: state.historyIndex < state.history.length - 1,
    hasChanges: state.changes.length > 0,
    clearChanges,
    lastAction,
  };
}
