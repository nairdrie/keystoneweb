import { useState, useCallback } from 'react';

export interface Change {
  id: string;
  field: string;
  label: string;
  from: string;
  to: string;
  timestamp: number;
}

export interface ChangeTrackingState {
  changes: Change[];
  history: Change[][];
  historyIndex: number;
}

/**
 * Hook to track changes in the editor
 * Maintains change history, supports undo/redo
 * 
 * Usage:
 * const {
 *   changes,
 *   addChange,
 *   undo,
 *   redo,
 *   canUndo,
 *   canRedo,
 *   hasChanges,
 *   clearChanges
 * } = useChangeTracking();
 * 
 * // When user changes site title
 * addChange('siteTitle', 'Site Title', oldValue, newValue);
 */
export function useChangeTracking() {
  const [state, setState] = useState<ChangeTrackingState>({
    changes: [],
    history: [[]],
    historyIndex: 0,
  });

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

      // Create new change
      const newChange: Change = {
        id: `${field}-${Date.now()}`,
        field,
        label,
        from,
        to,
        timestamp: Date.now(),
      };

      // Check if we're modifying an existing field change
      const existingChangeIndex = prev.changes.findIndex(
        (c) => c.field === field
      );

      let updatedChanges: Change[];
      if (existingChangeIndex !== -1) {
        // Update existing change
        updatedChanges = prev.changes.map((c, i) =>
          i === existingChangeIndex
            ? { ...newChange, from: c.from } // Keep original 'from'
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
      return {
        ...prev,
        changes: prev.history[newIndex],
        historyIndex: newIndex,
      };
    });
  }, []);

  // Redo last undone change
  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;

      const newIndex = prev.historyIndex + 1;
      return {
        ...prev,
        changes: prev.history[newIndex],
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
  };
}
