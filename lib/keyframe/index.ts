/**
 * Keyframe — safe, declarative scripting attached to blocks.
 *
 * Use `compileScript` to validate a script offline (editor preview, lint).
 * Use `runKeyframe` to attach a script's effects to a live block DOM root.
 */

export { parseKeyframe, KeyframeParseError } from './parse';
export type {
    Program,
    Statement,
    Action,
    Selector,
    Trigger,
    SetField,
    Frame,
    AnimatePreset,
    DomEvent,
    ParseIssue,
} from './parse';
export { runKeyframe } from './runtime';
export type { RunResult, RuntimeHooks } from './runtime';

import { parseKeyframe, KeyframeParseError, type Program, type ParseIssue } from './parse';

export interface CompileResult {
    program: Program | null;
    errors: ParseIssue[];
}

/** Parse + validate without executing. Returns errors instead of throwing. */
export function compileScript(source: string): CompileResult {
    if (!source || !source.trim()) return { program: null, errors: [] };
    try {
        const program = parseKeyframe(source);
        return { program, errors: [] };
    } catch (e) {
        if (e instanceof KeyframeParseError) return { program: null, errors: e.issues };
        return { program: null, errors: [{ line: 1, column: 1, message: (e as Error).message }] };
    }
}
