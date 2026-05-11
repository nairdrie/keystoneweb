/**
 * Keyframe runtime — walks a parsed Program and applies its effects
 * to a single block's DOM subtree. Hard-scoped to `rootEl`; selectors
 * are resolved with `rootEl.querySelectorAll`, so a script can never
 * reach outside its own block.
 */

import sanitizeHtml from 'sanitize-html';
import type {
    Program,
    Statement,
    Action,
    Selector,
    Frame,
    AnimatePreset,
    SetField,
} from './parse';

const MIN_INTERVAL_MS = 50;
const MAX_TIMERS_PER_BLOCK = 32;

const HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ['b', 'i', 'u', 's', 'em', 'strong', 'span', 'br', 'a'],
    allowedAttributes: { a: ['href', 'target', 'rel'], span: ['style', 'class'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
};

const PRESET_KEYFRAMES: Record<AnimatePreset, string> = {
    'fade-in': '@keyframes ks-kf-fade-in { from { opacity:0 } to { opacity:1 } }',
    'fade-out': '@keyframes ks-kf-fade-out { from { opacity:1 } to { opacity:0 } }',
    'slide-up': '@keyframes ks-kf-slide-up { from { opacity:0; transform: translateY(12px) } to { opacity:1; transform: translateY(0) } }',
    'slide-down': '@keyframes ks-kf-slide-down { from { opacity:0; transform: translateY(-12px) } to { opacity:1; transform: translateY(0) } }',
    'pulse': '@keyframes ks-kf-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.05) } }',
    'shake': '@keyframes ks-kf-shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-4px) } 75% { transform: translateX(4px) } }',
};

export interface RuntimeHooks {
    onHoldAnimations?: () => void;
    onReleaseAnimations?: () => void;
}

export interface RunResult {
    teardown: () => void;
}

export function runKeyframe(rootEl: HTMLElement, program: Program, hooks: RuntimeHooks = {}): RunResult {
    const ctx = new RuntimeContext(rootEl, hooks);
    ctx.installSharedStyles();
    ctx.runStatements(program.statements);
    return { teardown: () => ctx.teardown() };
}

class RuntimeContext {
    private timers: number[] = [];
    private cleanups: Array<() => void> = [];
    private observer: IntersectionObserver | null = null;
    private installedPresets = new Set<AnimatePreset>();
    private styleEl: HTMLStyleElement | null = null;
    private destroyed = false;

    constructor(public root: HTMLElement, public hooks: RuntimeHooks) {}

    installSharedStyles(): void {
        const doc = this.root.ownerDocument;
        if (!doc) return;
        if (doc.getElementById('ks-kf-shared-styles')) return;
        const s = doc.createElement('style');
        s.id = 'ks-kf-shared-styles';
        s.textContent = '.ks-kf-shown { opacity: 1 !important; transform: none !important; visibility: visible !important; }\n.ks-kf-hidden { opacity: 0 !important; visibility: hidden !important; }';
        doc.head.appendChild(s);
    }

    teardown(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        for (const id of this.timers) clearTimeout(id);
        this.timers = [];
        for (const fn of this.cleanups) { try { fn(); } catch { /* ignore */ } }
        this.cleanups = [];
        if (this.observer) { this.observer.disconnect(); this.observer = null; }
        if (this.styleEl && this.styleEl.parentNode) this.styleEl.parentNode.removeChild(this.styleEl);
    }

    private scheduleTimeout(fn: () => void, ms: number): void {
        if (this.destroyed) return;
        if (this.timers.length >= MAX_TIMERS_PER_BLOCK) return;
        const clamped = Math.max(MIN_INTERVAL_MS, ms);
        const id = window.setTimeout(() => {
            this.timers = this.timers.filter(t => t !== id);
            if (!this.destroyed) {
                try { fn(); } catch { /* ignore */ }
            }
        }, clamped);
        this.timers.push(id);
    }

    private scheduleInterval(fn: () => void, ms: number): void {
        if (this.destroyed) return;
        const clamped = Math.max(MIN_INTERVAL_MS, ms);
        const loop = () => {
            if (this.destroyed) return;
            try { fn(); } catch { /* ignore */ }
            if (this.timers.length >= MAX_TIMERS_PER_BLOCK) return;
            const id = window.setTimeout(() => {
                this.timers = this.timers.filter(t => t !== id);
                loop();
            }, clamped);
            this.timers.push(id);
        };
        const id = window.setTimeout(loop, clamped);
        this.timers.push(id);
    }

    private resolve(selector: Selector): HTMLElement[] {
        const sel = `[data-ks-field="${cssEscape(selector.name)}"]`;
        const all = Array.from(this.root.querySelectorAll<HTMLElement>(sel));
        if (selector.index !== undefined) {
            const match = all.filter(el => el.getAttribute('data-ks-index') === String(selector.index));
            return match.length ? match : (all[selector.index] ? [all[selector.index]] : []);
        }
        return all;
    }

    runStatements(stmts: Statement[]): void {
        for (const s of stmts) this.runStatement(s);
    }

    private runStatement(s: Statement): void {
        switch (s.kind) {
            case 'trigger':
                this.runTrigger(s);
                return;
            case 'on':
                this.bindDomEvent(s);
                return;
            case 'sequence':
                this.runSequence(s.selector, s.frames, s.tail);
                return;
            case 'loop':
                this.runLoop(s.times, s.body);
                return;
            case 'action':
                this.runAction(s.action);
                return;
        }
    }

    private runTrigger(s: Extract<Statement, { kind: 'trigger' }>): void {
        const t = s.trigger;
        if (t.kind === 'onLoad') {
            this.runStatements(s.body);
            return;
        }
        if (t.kind === 'after') {
            this.scheduleTimeout(() => this.runStatements(s.body), t.ms);
            return;
        }
        if (t.kind === 'every') {
            this.scheduleInterval(() => this.runStatements(s.body), t.ms);
            return;
        }
        if (t.kind === 'onVisible') {
            this.onVisible(() => this.runStatements(s.body));
            return;
        }
        if (t.kind === 'onAnimationsComplete') {
            // The block fires this when its stagger reveal finishes. We listen for
            // a custom event that BlockWrapper dispatches.
            const handler = () => this.runStatements(s.body);
            this.root.addEventListener('ks:kf:animations-complete', handler, { once: true });
            this.cleanups.push(() => this.root.removeEventListener('ks:kf:animations-complete', handler));
            return;
        }
    }

    private bindDomEvent(s: Extract<Statement, { kind: 'on' }>): void {
        const targets = s.selector ? this.resolve(s.selector) : [this.root];
        const eventName = ({
            click: 'click',
            hover: 'mouseenter',
            'hover-end': 'mouseleave',
            focus: 'focusin',
            blur: 'focusout',
        } as const)[s.event];
        for (const el of targets) {
            const handler = () => this.runStatements(s.body);
            el.addEventListener(eventName, handler);
            this.cleanups.push(() => el.removeEventListener(eventName, handler));
        }
    }

    private runSequence(sel: Selector, frames: Frame[], tail?: Statement[]): void {
        const targets = this.resolve(sel);
        if (targets.length === 0) return;
        let acc = 0;
        for (const frame of frames) {
            const value = frame.text;
            this.scheduleTimeout(() => {
                for (const el of targets) el.textContent = value;
            }, acc);
            acc += Math.max(MIN_INTERVAL_MS, frame.waitMs);
        }
        if (tail) {
            this.scheduleTimeout(() => this.runStatements(tail), acc);
        }
    }

    private runLoop(times: number | undefined, body: Statement[]): void {
        let count = 0;
        const tick = () => {
            if (this.destroyed) return;
            if (times !== undefined && count >= times) return;
            count++;
            this.runStatements(body);
            // The loop body itself must contain a wait (validated at parse time),
            // so we schedule the next iteration only after that wait passes.
            // We approximate by computing the body's max accumulated wait.
            const delay = estimateBodyDuration(body);
            this.scheduleTimeout(tick, Math.max(MIN_INTERVAL_MS, delay));
        };
        tick();
    }

    private runAction(action: Action): void {
        switch (action.kind) {
            case 'set': this.applySet(action); return;
            case 'cycle': this.applyCycle(action); return;
            case 'addClass': this.applyClassOp(action.selector, action.className, 'add'); return;
            case 'removeClass': this.applyClassOp(action.selector, action.className, 'remove'); return;
            case 'toggleClass': this.applyClassOp(action.selector, action.className, 'toggle'); return;
            case 'type': this.applyType(action); return;
            case 'blink': this.applyBlink(action); return;
            case 'animate': this.applyAnimate(action); return;
            case 'show': this.applyShowHide(action.selector, true); return;
            case 'hide': this.applyShowHide(action.selector, false); return;
            case 'holdAnimations': this.hooks.onHoldAnimations?.(); return;
            case 'releaseAnimations': this.hooks.onReleaseAnimations?.(); return;
        }
    }

    private applySet(action: Extract<Action, { kind: 'set' }>): void {
        const targets = this.resolve(action.selector);
        for (const el of targets) this.assignField(el, action.field, action.value);
    }

    private applyCycle(action: Extract<Action, { kind: 'cycle' }>): void {
        // Apply the first value synchronously so the very first call to a `cycle`
        // sets a value; the trigger that contains it (e.g. `every 3s`) advances.
        // Each subsequent call advances one step.
        const targets = this.resolve(action.selector);
        if (targets.length === 0) return;
        const key = cycleKey(action);
        for (const el of targets) {
            const idx = (cycleState.get(`${getElId(el)}::${key}`) ?? -1) + 1;
            const value = action.values[idx % action.values.length];
            cycleState.set(`${getElId(el)}::${key}`, idx);
            this.assignField(el, action.field, value);
        }
    }

    private applyClassOp(sel: Selector, className: string, op: 'add' | 'remove' | 'toggle'): void {
        const targets = this.resolve(sel);
        for (const el of targets) el.classList[op](className);
    }

    private applyType(action: Extract<Action, { kind: 'type' }>): void {
        const targets = this.resolve(action.selector);
        if (targets.length === 0) return;
        let acc = 0;
        for (let i = 0; i <= action.text.length; i++) {
            const slice = action.text.slice(0, i);
            this.scheduleTimeout(() => {
                for (const el of targets) el.textContent = slice;
            }, acc);
            acc += action.speedMs;
        }
    }

    private applyBlink(action: Extract<Action, { kind: 'blink' }>): void {
        const targets = this.resolve(action.selector);
        if (targets.length === 0) return;
        const original = targets.map(el => el.textContent ?? '');
        let visible = true;
        this.scheduleInterval(() => {
            for (let i = 0; i < targets.length; i++) {
                const el = targets[i];
                el.textContent = visible ? `${original[i]}${action.text}` : original[i];
            }
            visible = !visible;
        }, action.everyMs);
    }

    private applyAnimate(action: Extract<Action, { kind: 'animate' }>): void {
        this.installPreset(action.preset);
        const targets = this.resolve(action.selector);
        for (const el of targets) {
            el.style.animation = `ks-kf-${action.preset} ${action.durationMs}ms forwards`;
        }
    }

    private applyShowHide(selector: Selector, show: boolean): void {
        const targets = this.resolve(selector);
        for (const el of targets) {
            if (show) {
                el.classList.add('ks-kf-shown');
                el.classList.remove('ks-kf-hidden');
            } else {
                el.classList.add('ks-kf-hidden');
                el.classList.remove('ks-kf-shown');
            }
        }
    }

    private installPreset(preset: AnimatePreset): void {
        if (this.installedPresets.has(preset)) return;
        this.installedPresets.add(preset);
        const doc = this.root.ownerDocument;
        if (!doc) return;
        const id = `ks-kf-preset-${preset}`;
        if (doc.getElementById(id)) return;
        const s = doc.createElement('style');
        s.id = id;
        s.textContent = PRESET_KEYFRAMES[preset];
        doc.head.appendChild(s);
    }

    private assignField(el: HTMLElement, field: SetField, value: string): void {
        switch (field.type) {
            case 'text':
                el.textContent = value;
                return;
            case 'html':
                el.innerHTML = sanitizeHtml(value, HTML_SANITIZE_OPTIONS);
                return;
            case 'src':
                if (el instanceof HTMLImageElement) el.src = value;
                else el.setAttribute('src', value);
                return;
            case 'href':
                if (el instanceof HTMLAnchorElement) el.href = value;
                else el.setAttribute('href', value);
                return;
            case 'attr':
                if (isDangerousAttr(field.name)) return;
                el.setAttribute(field.name, value);
                return;
            case 'style':
                el.style.setProperty(field.name, value);
                return;
        }
    }

    private onVisible(cb: () => void): void {
        if (!this.observer) {
            this.observer = new IntersectionObserver((entries, obs) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        obs.unobserve(entry.target);
                        const handler = visibleHandlers.get(entry.target);
                        if (handler) handler();
                        visibleHandlers.delete(entry.target);
                    }
                }
            }, { threshold: 0.1 });
        }
        visibleHandlers.set(this.root, cb);
        this.observer.observe(this.root);
    }
}

// Per-block state for cycle indices (keyed by element id + action signature)
const cycleState = new Map<string, number>();
const visibleHandlers = new WeakMap<Element, () => void>();
let elIdSeq = 0;
const elIds = new WeakMap<HTMLElement, number>();

function getElId(el: HTMLElement): number {
    let id = elIds.get(el);
    if (id === undefined) {
        id = ++elIdSeq;
        elIds.set(el, id);
    }
    return id;
}

function cycleKey(action: Extract<Action, { kind: 'cycle' }>): string {
    return `${action.selector.name}::${action.selector.index ?? ''}::${describeField(action.field)}::${action.values.length}`;
}

function describeField(f: SetField): string {
    return f.type === 'attr' || f.type === 'style' ? `${f.type}:${f.name}` : f.type;
}

function isDangerousAttr(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.startsWith('on') || lower === 'href' || lower === 'src' || lower === 'srcset' || lower === 'formaction' || lower === 'action';
}

// Approximate runtime duration of a body for `loop` pacing. We use the sum of
// the longest path through any sequence/type/blink/animate inside the body.
function estimateBodyDuration(body: Statement[]): number {
    let max = 0;
    for (const s of body) {
        if (s.kind === 'trigger' && (s.trigger.kind === 'every' || s.trigger.kind === 'after')) {
            max = Math.max(max, s.trigger.ms);
        }
        if (s.kind === 'action') {
            const a = s.action;
            if (a.kind === 'type') max = Math.max(max, (a.text.length + 1) * a.speedMs);
            else if (a.kind === 'animate') max = Math.max(max, a.durationMs);
            else if (a.kind === 'blink') max = Math.max(max, a.everyMs);
        }
        if (s.kind === 'sequence') {
            let acc = 0;
            for (const f of s.frames) acc += f.waitMs;
            max = Math.max(max, acc);
        }
    }
    return max;
}

function cssEscape(s: string): string {
    return s.replace(/["\\]/g, '\\$&');
}
