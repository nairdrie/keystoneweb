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

// Human-readable labels for site-level content keys
const SITE_CONTENT_LABELS: Record<string, string> = {
  siteTitle: 'Site Title',
  headerCTA: 'Header Button',
  headerCtaText: 'Header Button Text',
  headerCtaLink: 'Header Button Link',
  siteLogo: 'Site Logo',
  titleFont: 'Heading Font',
  bodyFont: 'Body Font',
  __customPalette_primary: 'Primary Color',
  __customPalette_secondary: 'Secondary Color',
  __customPalette_accent: 'Accent Color',
  headerTitle: 'Header Title',
  headerSubtitle: 'Header Subtitle',
  footerText: 'Footer Text',
  footerCopyright: 'Footer Copyright',
  socialLinks: 'Social Links',
  __navItems: 'Navigation Menu',
  navItems: 'Navigation Menu',
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

// Convert a camelCase or snake_case key to Title Case
function humanizeKey(key: string): string {
  const clean = key.replace(/^__/, '');
  return clean
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

// Format a value for display, catching stray JSON, HTML, URLs
function formatDisplayValue(val: string): string {
  if (!val || val === '') return '(empty)';

  // Detect JSON arrays/objects and summarize
  if ((val.startsWith('[') || val.startsWith('{')) && val.length > 2) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return '(empty)';
        // Try to extract meaningful labels from items
        const labels = parsed
          .slice(0, 3)
          .map((item: any) => {
            if (typeof item === 'string') return truncate(item, 25);
            if (item?.label) return item.label;
            if (item?.title) return item.title;
            if (item?.name) return item.name;
            return null;
          })
          .filter(Boolean);
        if (labels.length > 0) {
          const suffix = parsed.length > 3 ? ` + ${parsed.length - 3} more` : '';
          return labels.join(', ') + suffix;
        }
        return `${parsed.length} items`;
      }
      // Object
      if (parsed.label) return parsed.label;
      if (parsed.title) return parsed.title;
      if (parsed.name) return parsed.name;
      // Small objects — show key count
      const keys = Object.keys(parsed);
      if (keys.length <= 3) {
        return keys.map(k => `${k}: ${truncate(String(parsed[k] ?? ''), 15)}`).join(', ');
      }
      return `${keys.length} properties`;
    } catch {
      // Not valid JSON, treat as string
    }
  }

  // Strip HTML
  if (val.includes('<') && val.includes('>')) {
    return truncate(stripHtml(val)) || '(empty)';
  }

  // URLs — show shortened
  if (val.startsWith('http') || val.startsWith('data:')) {
    if (val.startsWith('data:')) return '(uploaded image)';
    return truncate(val, 40);
  }

  return truncate(val);
}

// Diff navigation items and produce human-readable from/to
function diffNavItems(oldJson: string, newJson: string): { label: string; from: string; to: string } | null {
  try {
    const oldItems: any[] = JSON.parse(oldJson || '[]');
    const newItems: any[] = JSON.parse(newJson || '[]');

    const oldMap = new Map(oldItems.map(i => [i.id, i]));
    const newMap = new Map(newItems.map(i => [i.id, i]));
    const summaryParts: string[] = [];

    // Additions
    for (const item of newItems) {
      if (!oldMap.has(item.id)) summaryParts.push(`Added "${item.label}"`);
    }
    // Removals
    for (const item of oldItems) {
      if (!newMap.has(item.id)) summaryParts.push(`Removed "${item.label}"`);
    }
    // Renames & link changes
    for (const item of newItems) {
      const old = oldMap.get(item.id);
      if (!old) continue;
      if (old.label !== item.label) summaryParts.push(`Renamed "${old.label}" to "${item.label}"`);
      else if (old.href !== item.href) summaryParts.push(`Updated link for "${item.label}"`);
    }
    // Reorder detection
    if (summaryParts.length === 0 && oldItems.length === newItems.length) {
      const oldOrder = oldItems.map(i => i.id).join(',');
      const newOrder = newItems.map(i => i.id).join(',');
      if (oldOrder !== newOrder) summaryParts.push('Reordered menu items');
    }

    const oldLabels = oldItems.map(i => i.label).join(', ') || '(empty)';
    const newLabels = newItems.map(i => i.label).join(', ') || '(empty)';

    return {
      label: summaryParts.length > 0 ? `Navigation: ${summaryParts.join(', ')}` : 'Navigation Menu',
      from: oldLabels,
      to: newLabels,
    };
  } catch {
    return null;
  }
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
function diffBlocks(oldBlocksRaw: string, newBlocksRaw: string, callerLabel?: string): Partial<Change> | null {
  try {
    const oldBlocks: any[] = JSON.parse(oldBlocksRaw || '[]');
    const newBlocks: any[] = JSON.parse(newBlocksRaw || '[]');

    const oldIds = new Set(oldBlocks.map(b => b.id));
    const newIds = new Set(newBlocks.map(b => b.id));

    // Blocks added
    const added = newBlocks.filter(b => !oldIds.has(b.id));
    if (added.length > 0 && newBlocks.length > oldBlocks.length) {
      const blockNames = added.map(b => getBlockLabel(b.type));
      return {
        label: added.length === 1
          ? `Added ${blockNames[0]} Block`
          : `Added ${added.length} Blocks`,
        from: oldBlocks.length === 0 ? '(empty)' : `${oldBlocks.length} blocks`,
        to: added.length === 1 ? blockNames[0] : blockNames.join(', '),
      };
    }

    // Blocks removed
    const removed = oldBlocks.filter(b => !newIds.has(b.id));
    if (removed.length > 0 && newBlocks.length < oldBlocks.length) {
      const blockNames = removed.map(b => getBlockLabel(b.type));
      return {
        label: removed.length === 1
          ? `Removed ${blockNames[0]} Block`
          : `Removed ${removed.length} Blocks`,
        from: removed.length === 1 ? blockNames[0] : blockNames.join(', '),
        to: newBlocks.length === 0 ? '(empty)' : `${newBlocks.length} blocks remaining`,
      };
    }

    // Same count — check for reorder vs content changes
    if (oldBlocks.length === newBlocks.length && oldBlocks.length > 0) {
      const oldMap = new Map(oldBlocks.map(b => [b.id, b]));

      // Find content change by matching block IDs
      for (const newB of newBlocks) {
        const oldB = oldMap.get(newB.id);
        if (!oldB || JSON.stringify(oldB.data) === JSON.stringify(newB.data)) continue;

        const blockLabel = getBlockLabel(newB.type);
        const allKeys = new Set([...Object.keys(oldB.data || {}), ...Object.keys(newB.data || {})]);

        for (const key of allKeys) {
          const oldVal = oldB.data?.[key];
          const newVal = newB.data?.[key];
          if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

          const fieldLabel = getFieldLabel(key);

          // Style object changes (fonts, formatting)
          if (key.endsWith('__styles') && typeof oldVal === 'object' && typeof newVal === 'object') {
            const styleDiff = formatStyleChange(oldVal, newVal);
            if (styleDiff) {
              return { label: `${blockLabel} — ${fieldLabel}`, from: styleDiff.from, to: styleDiff.to };
            }
          }

          // Array changes (items, members, tiers, etc.)
          if (Array.isArray(oldVal) && Array.isArray(newVal)) {
            const summary = summarizeArrayChange(oldVal, newVal, fieldLabel);
            return { label: `${blockLabel} — ${fieldLabel}`, from: summary.from, to: summary.to };
          }

          // Simple value changes
          return { label: `${blockLabel} — ${fieldLabel}`, from: formatValue(oldVal, key), to: formatValue(newVal, key) };
        }
      }

      // Pure reorder (IDs same, order different)
      const oldIdOrder = oldBlocks.map(b => b.id);
      const newIdOrder = newBlocks.map(b => b.id);
      if (oldIdOrder.some((id: string, i: number) => id !== newIdOrder[i])) {
        return {
          label: 'Reordered Blocks',
          from: oldBlocks.map(b => getBlockLabel(b.type)).join(' → '),
          to: newBlocks.map(b => getBlockLabel(b.type)).join(' → '),
        };
      }
    }

    // Complete replacement (all different IDs, e.g. AI redesign)
    if (oldBlocks.length > 0 || newBlocks.length > 0) {
      const allNew = newBlocks.every(b => !oldIds.has(b.id));
      if (allNew && newBlocks.length > 0) {
        return {
          label: callerLabel || 'Redesigned Layout',
          from: oldBlocks.length === 0 ? '(empty)' : `${oldBlocks.length} blocks`,
          to: `${newBlocks.length} blocks`,
        };
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

      // === BLOCKS ===
      if (field === 'blocks') {
        const diff = diffBlocks(from, to, label);
        if (diff) {
          finalLabel = diff.label || label;
          finalFrom = diff.from || from;
          finalTo = diff.to || to;
        } else {
          // Fallback: never show raw JSON for blocks
          try {
            const oldLen = JSON.parse(from || '[]').length;
            const newLen = JSON.parse(to || '[]').length;
            finalFrom = oldLen === 0 ? '(empty)' : `${oldLen} blocks`;
            finalTo = newLen === 0 ? '(empty)' : `${newLen} blocks`;
          } catch {
            finalFrom = '(previous layout)';
            finalTo = '(updated layout)';
          }
        }
      }
      // === NAV ITEMS ===
      else if (field === 'siteContent:navItems' || field === 'siteContent:__navItems') {
        const navDiff = diffNavItems(from, to);
        if (navDiff) {
          finalLabel = navDiff.label;
          finalFrom = navDiff.from;
          finalTo = navDiff.to;
        } else {
          finalLabel = 'Navigation Menu';
          finalFrom = formatDisplayValue(from);
          finalTo = formatDisplayValue(to);
        }
      }
      // === SITE CONTENT ===
      else if (field.startsWith('siteContent:')) {
        const key = field.replace('siteContent:', '');
        finalLabel = SITE_CONTENT_LABELS[key] || humanizeKey(key);
        finalFrom = formatDisplayValue(from);
        finalTo = formatDisplayValue(to);
      }
      // === PAGE CONTENT ===
      else if (field.startsWith('content:')) {
        const key = field.replace('content:', '');
        finalLabel = humanizeKey(key);
        finalFrom = formatDisplayValue(from);
        finalTo = formatDisplayValue(to);
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
