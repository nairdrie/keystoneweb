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
        // Find which exact data field changed
        const allKeys = new Set([...Object.keys(oldB.data || {}), ...Object.keys(newB.data || {})]);

        for (const key of allKeys) {
          const oldVal = oldB.data?.[key];
          const newVal = newB.data?.[key];

          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            // Capitalize block type and field key for readability
            const blockTypeDisplay = newB.type.charAt(0).toUpperCase() + newB.type.slice(1);
            const keyDisplay = key.charAt(0).toUpperCase() + key.slice(1);

            // Handle complex types like arrays (e.g. servicesGrid items)
            const fromDisplay = typeof oldVal === 'object' ? JSON.stringify(oldVal).substring(0, 30) + (JSON.stringify(oldVal).length > 30 ? '...' : '') : String(oldVal || '(empty)');
            const toDisplay = typeof newVal === 'object' ? JSON.stringify(newVal).substring(0, 30) + (JSON.stringify(newVal).length > 30 ? '...' : '') : String(newVal || '(empty)');

            return {
              label: `${blockTypeDisplay} Block (${keyDisplay})`,
              from: fromDisplay,
              to: toDisplay,
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
