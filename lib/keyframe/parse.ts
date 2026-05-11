/**
 * Keyframe — a safe, declarative DSL for per-block scripting.
 *
 * This module is a hand-written tokenizer + recursive-descent parser.
 * It never evaluates strings as code; the runtime only executes verbs
 * defined in the AST below.
 */

export type Selector = {
    name: string;
    index?: number;
};

export type SetField =
    | { type: 'text' | 'html' | 'src' | 'href' }
    | { type: 'attr'; name: string }
    | { type: 'style'; name: string };

export type Action =
    | { kind: 'set'; selector: Selector; field: SetField; value: string }
    | { kind: 'cycle'; selector: Selector; field: SetField; values: string[] }
    | { kind: 'addClass'; selector: Selector; className: string }
    | { kind: 'removeClass'; selector: Selector; className: string }
    | { kind: 'toggleClass'; selector: Selector; className: string }
    | { kind: 'type'; selector: Selector; text: string; speedMs: number }
    | { kind: 'blink'; selector: Selector; text: string; everyMs: number }
    | { kind: 'animate'; selector: Selector; preset: AnimatePreset; durationMs: number }
    | { kind: 'show'; selector: Selector }
    | { kind: 'hide'; selector: Selector }
    | { kind: 'holdAnimations' }
    | { kind: 'releaseAnimations' };

export type AnimatePreset = 'fade-in' | 'fade-out' | 'slide-up' | 'slide-down' | 'pulse' | 'shake';

export type DomEvent = 'click' | 'hover' | 'hover-end' | 'focus' | 'blur';

export type Trigger =
    | { kind: 'every'; ms: number }
    | { kind: 'after'; ms: number }
    | { kind: 'onLoad' }
    | { kind: 'onVisible' }
    | { kind: 'onAnimationsComplete' };

export type Frame = { text: string; waitMs: number };

export type Statement =
    | { kind: 'trigger'; trigger: Trigger; body: Statement[] }
    | { kind: 'on'; event: DomEvent; selector?: Selector; body: Statement[] }
    | { kind: 'sequence'; selector: Selector; frames: Frame[]; tail?: Statement[] }
    | { kind: 'loop'; times?: number; body: Statement[] }
    | { kind: 'action'; action: Action };

export type Program = {
    statements: Statement[];
    usesHold: boolean;
};

export type ParseIssue = {
    line: number;
    column: number;
    message: string;
};

export class KeyframeParseError extends Error {
    constructor(public issues: ParseIssue[]) {
        super(issues.map(i => `Line ${i.line}:${i.column} — ${i.message}`).join('\n'));
        this.name = 'KeyframeParseError';
    }
}

// ---- Tokenizer ----

type Token =
    | { type: 'word'; value: string; line: number; col: number }
    | { type: 'string'; value: string; line: number; col: number }
    | { type: 'number'; value: number; line: number; col: number }
    | { type: 'duration'; ms: number; line: number; col: number }
    | { type: 'at'; name: string; index?: number; line: number; col: number }
    | { type: 'lbrace'; line: number; col: number }
    | { type: 'rbrace'; line: number; col: number }
    | { type: 'lbracket'; line: number; col: number }
    | { type: 'rbracket'; line: number; col: number }
    | { type: 'comma'; line: number; col: number }
    | { type: 'eof'; line: number; col: number };

const WORD_RE = /[A-Za-z_][A-Za-z0-9_-]*/;

function tokenize(src: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    let line = 1;
    let lineStart = 0;

    const here = (): { line: number; col: number } => ({ line, col: i - lineStart + 1 });

    const fail = (msg: string): never => {
        const pos = here();
        throw new KeyframeParseError([{ line: pos.line, column: pos.col, message: msg }]);
    };

    while (i < src.length) {
        const ch = src[i];

        // Newline
        if (ch === '\n') {
            line++;
            i++;
            lineStart = i;
            continue;
        }
        // Whitespace
        if (ch === ' ' || ch === '\t' || ch === '\r') {
            i++;
            continue;
        }
        // Comment to end of line
        if (ch === '#') {
            while (i < src.length && src[i] !== '\n') i++;
            continue;
        }
        // Braces / brackets / comma
        if (ch === '{') { tokens.push({ type: 'lbrace', ...here() }); i++; continue; }
        if (ch === '}') { tokens.push({ type: 'rbrace', ...here() }); i++; continue; }
        if (ch === '[') { tokens.push({ type: 'lbracket', ...here() }); i++; continue; }
        if (ch === ']') { tokens.push({ type: 'rbracket', ...here() }); i++; continue; }
        if (ch === ',') { tokens.push({ type: 'comma', ...here() }); i++; continue; }

        // Strings: "..." or '...'  (no escapes except \" \' \\ \n)
        if (ch === '"' || ch === "'") {
            const startPos = here();
            const quote = ch;
            i++;
            let out = '';
            while (i < src.length && src[i] !== quote) {
                if (src[i] === '\\' && i + 1 < src.length) {
                    const n = src[i + 1];
                    if (n === 'n') out += '\n';
                    else if (n === 't') out += '\t';
                    else if (n === '\\') out += '\\';
                    else if (n === '"') out += '"';
                    else if (n === "'") out += "'";
                    else out += n;
                    i += 2;
                    continue;
                }
                if (src[i] === '\n') { line++; lineStart = i + 1; }
                out += src[i];
                i++;
            }
            if (i >= src.length) fail('Unterminated string');
            i++; // skip closing quote
            tokens.push({ type: 'string', value: out, ...startPos });
            continue;
        }

        // @selector — @ident or @ident[n]
        if (ch === '@') {
            const startPos = here();
            i++;
            const m = src.slice(i).match(WORD_RE);
            if (!m || m.index !== 0) { fail("Expected identifier after '@'"); }
            const name = m![0];
            i += name.length;
            let index: number | undefined;
            if (src[i] === '[') {
                i++;
                const numMatch = src.slice(i).match(/^\d+/);
                if (!numMatch) { fail("Expected integer in selector index"); }
                index = parseInt(numMatch![0], 10);
                i += numMatch![0].length;
                if (src[i] !== ']') { fail("Expected ']' after selector index"); }
                i++;
            }
            tokens.push({ type: 'at', name, index, ...startPos });
            continue;
        }

        // Number or duration
        if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
            const startPos = here();
            const m = src.slice(i).match(/^\d+(?:\.\d+)?/);
            if (!m) { fail('Invalid number'); }
            const num = parseFloat(m![0]);
            i += m![0].length;
            // duration suffix?
            if (src[i] === 'm' && src[i + 1] === 's') {
                tokens.push({ type: 'duration', ms: num, ...startPos });
                i += 2;
                continue;
            }
            if (src[i] === 's') {
                tokens.push({ type: 'duration', ms: Math.round(num * 1000), ...startPos });
                i += 1;
                continue;
            }
            tokens.push({ type: 'number', value: num, ...startPos });
            continue;
        }

        // Word / keyword / identifier
        const wm = src.slice(i).match(WORD_RE);
        if (wm && wm.index === 0) {
            const startPos = here();
            tokens.push({ type: 'word', value: wm[0], ...startPos });
            i += wm[0].length;
            continue;
        }

        fail(`Unexpected character '${ch}'`);
    }
    tokens.push({ type: 'eof', line, col: i - lineStart + 1 });
    return tokens;
}

// ---- Parser ----

class Parser {
    private i = 0;
    public issues: ParseIssue[] = [];
    public usesHold = false;

    constructor(private tokens: Token[]) {}

    private peek(): Token { return this.tokens[this.i]; }
    private peekAt(off: number): Token { return this.tokens[this.i + off] ?? this.tokens[this.tokens.length - 1]; }
    private next(): Token { return this.tokens[this.i++]; }
    private eof(): boolean { return this.peek().type === 'eof'; }

    private fail(msg: string, tok?: Token): never {
        const t = tok ?? this.peek();
        throw new KeyframeParseError([{ line: t.line, column: t.col, message: msg }]);
    }

    private expectWord(...words: string[]): Extract<Token, { type: 'word' }> {
        const t = this.peek();
        if (t.type === 'word' && (words.length === 0 || words.includes(t.value))) {
            this.i++;
            return t;
        }
        this.fail(`Expected ${words.length ? words.map(w => `'${w}'`).join(' or ') : 'identifier'}, got ${describe(t)}`);
    }

    private consumeWord(...words: string[]): boolean {
        const t = this.peek();
        if (t.type === 'word' && words.includes(t.value)) {
            this.i++;
            return true;
        }
        return false;
    }

    private expectType(type: Token['type']): Token {
        const t = this.peek();
        if (t.type !== type) this.fail(`Expected ${type}, got ${describe(t)}`);
        this.i++;
        return t;
    }

    parseProgram(): Program {
        const statements: Statement[] = [];
        while (!this.eof()) {
            statements.push(this.parseStatement());
        }
        return { statements, usesHold: this.usesHold };
    }

    private parseBlock(): Statement[] {
        this.expectType('lbrace');
        const out: Statement[] = [];
        while (this.peek().type !== 'rbrace' && !this.eof()) {
            out.push(this.parseStatement());
        }
        if (this.eof()) this.fail("Unclosed '{'");
        this.expectType('rbrace');
        return out;
    }

    private parseStatement(): Statement {
        const t = this.peek();
        if (t.type !== 'word') this.fail(`Expected statement, got ${describe(t)}`);

        switch (t.value) {
            case 'every': return this.parseEvery();
            case 'after': return this.parseAfter();
            case 'on': return this.parseOn();
            case 'sequence': return this.parseSequence();
            case 'loop': return this.parseLoop();
            case 'set':
            case 'cycle':
            case 'toggle':
            case 'add':
            case 'remove':
            case 'type':
            case 'blink':
            case 'animate':
            case 'show':
            case 'hide':
            case 'hold':
            case 'release':
                return { kind: 'action', action: this.parseAction() };
            default:
                this.fail(`Unknown statement '${t.value}'`);
        }
    }

    private parseEvery(): Statement {
        this.expectWord('every');
        const ms = this.expectDuration();
        const body = this.parseBlock();
        return { kind: 'trigger', trigger: { kind: 'every', ms }, body };
    }

    private parseAfter(): Statement {
        this.expectWord('after');
        const ms = this.expectDuration();
        const body = this.parseBlock();
        return { kind: 'trigger', trigger: { kind: 'after', ms }, body };
    }

    private parseOn(): Statement {
        this.expectWord('on');
        const w = this.expectWord('load', 'visible', 'animations-complete', 'click', 'hover', 'hover-end', 'focus', 'blur');
        if (w.value === 'load') {
            const body = this.parseBlock();
            return { kind: 'trigger', trigger: { kind: 'onLoad' }, body };
        }
        if (w.value === 'visible') {
            const body = this.parseBlock();
            return { kind: 'trigger', trigger: { kind: 'onVisible' }, body };
        }
        if (w.value === 'animations-complete') {
            const body = this.parseBlock();
            return { kind: 'trigger', trigger: { kind: 'onAnimationsComplete' }, body };
        }
        // DOM events
        const event = w.value as DomEvent;
        let selector: Selector | undefined;
        if (this.peek().type === 'at') selector = this.parseSelector();
        const body = this.parseBlock();
        return { kind: 'on', event, selector, body };
    }

    private parseSequence(): Statement {
        this.expectWord('sequence');
        this.expectWord('on');
        const selector = this.parseSelector();
        this.expectType('lbrace');
        const frames: Frame[] = [];
        let tail: Statement[] | undefined;
        while (this.peek().type !== 'rbrace' && !this.eof()) {
            const t = this.peek();
            if (t.type === 'word' && t.value === 'step') {
                this.i++;
                const text = this.expectType('string') as Extract<Token, { type: 'string' }>;
                let waitMs = 200;
                if (this.peek().type === 'word' && (this.peek() as { value: string }).value === 'wait') {
                    this.i++;
                    waitMs = this.expectDuration();
                }
                frames.push({ text: text.value, waitMs });
            } else if (t.type === 'word' && t.value === 'loop') {
                tail = [this.parseLoop()];
                break;
            } else {
                this.fail(`Expected 'step' or 'loop' inside sequence, got ${describe(t)}`);
            }
        }
        if (this.eof()) this.fail("Unclosed '{' in sequence");
        this.expectType('rbrace');
        return { kind: 'sequence', selector, frames, tail };
    }

    private parseLoop(): Statement {
        this.expectWord('loop');
        let times: number | undefined;
        if (this.peek().type === 'number') {
            const n = this.next() as Extract<Token, { type: 'number' }>;
            this.expectWord('times');
            times = Math.floor(n.value);
        }
        const body = this.parseBlock();
        validateLoopBody(body, (msg, l, c) => this.fail(msg, { type: 'word', value: 'loop', line: l, col: c } as Token));
        return { kind: 'loop', times, body };
    }

    private parseAction(): Action {
        const head = this.next();
        if (head.type !== 'word') this.fail('Expected action verb', head);
        const h = head as Extract<Token, { type: 'word' }>;
        switch (h.value) {
            case 'set': return this.parseSet();
            case 'cycle': return this.parseCycle();
            case 'toggle': return this.parseClassOp('toggleClass');
            case 'add': return this.parseClassOp('addClass');
            case 'remove': return this.parseClassOp('removeClass');
            case 'type': return this.parseType();
            case 'blink': return this.parseBlink();
            case 'animate': return this.parseAnimate();
            case 'show': return { kind: 'show', selector: this.parseSelector() };
            case 'hide': return { kind: 'hide', selector: this.parseSelector() };
            case 'hold':
                this.expectWord('animations');
                this.usesHold = true;
                return { kind: 'holdAnimations' };
            case 'release':
                this.expectWord('animations');
                return { kind: 'releaseAnimations' };
            default:
                this.fail(`Unknown action '${h.value}'`, head);
        }
    }

    private parseSet(): Action {
        const field = this.parseField();
        this.expectWord('on');
        const selector = this.parseSelector();
        this.expectWord('to');
        const value = this.parseStringOrWord();
        return { kind: 'set', selector, field, value };
    }

    private parseCycle(): Action {
        const field = this.parseField();
        this.expectWord('on');
        const selector = this.parseSelector();
        this.expectWord('with');
        const values = this.parseStringList();
        if (values.length === 0) this.fail('cycle requires at least one value');
        return { kind: 'cycle', selector, field, values };
    }

    private parseClassOp(kind: 'addClass' | 'removeClass' | 'toggleClass'): Action {
        this.expectWord('class');
        const className = this.parseClassName();
        this.expectWord('on');
        const selector = this.parseSelector();
        return { kind, selector, className };
    }

    private parseType(): Action {
        const text = this.expectType('string') as Extract<Token, { type: 'string' }>;
        this.expectWord('on');
        const selector = this.parseSelector();
        let speedMs = 120;
        if (this.peek().type === 'word' && (this.peek() as { value: string }).value === 'speed') {
            this.i++;
            speedMs = this.expectDuration();
        }
        return { kind: 'type', selector, text: text.value, speedMs };
    }

    private parseBlink(): Action {
        const text = this.expectType('string') as Extract<Token, { type: 'string' }>;
        this.expectWord('on');
        const selector = this.parseSelector();
        let everyMs = 500;
        if (this.peek().type === 'word' && (this.peek() as { value: string }).value === 'every') {
            this.i++;
            everyMs = this.expectDuration();
        }
        return { kind: 'blink', selector, text: text.value, everyMs };
    }

    private parseAnimate(): Action {
        const selector = this.parseSelector();
        const presetWord = this.expectWord('fade-in', 'fade-out', 'slide-up', 'slide-down', 'pulse', 'shake');
        const preset = presetWord.value as AnimatePreset;
        let durationMs = 400;
        if (this.peek().type === 'word' && (this.peek() as { value: string }).value === 'duration') {
            this.i++;
            durationMs = this.expectDuration();
        }
        return { kind: 'animate', selector, preset, durationMs };
    }

    private parseField(): SetField {
        const t = this.next();
        if (t.type !== 'word') this.fail(`Expected field name, got ${describe(t)}`, t);
        const w = t as Extract<Token, { type: 'word' }>;
        if (w.value === 'text' || w.value === 'html' || w.value === 'src' || w.value === 'href') {
            return { type: w.value };
        }
        if (w.value === 'attr') {
            const name = this.expectWord();
            return { type: 'attr', name: name.value };
        }
        if (w.value === 'style') {
            const name = this.expectWord();
            return { type: 'style', name: name.value };
        }
        this.fail(`Unknown field '${w.value}'. Expected text|html|src|href|attr <name>|style <name>`, t);
    }

    private parseSelector(): Selector {
        const t = this.next();
        if (t.type !== 'at') this.fail(`Expected selector starting with '@'`, t);
        return { name: t.name, index: t.index };
    }

    private parseClassName(): string {
        const t = this.next();
        if (t.type === 'word') return t.value;
        if (t.type === 'string') return t.value;
        this.fail(`Expected class name, got ${describe(t)}`, t);
    }

    private parseStringOrWord(): string {
        const t = this.next();
        if (t.type === 'string') return t.value;
        if (t.type === 'word') return t.value;
        if (t.type === 'number') return String(t.value);
        this.fail(`Expected value, got ${describe(t)}`, t);
    }

    private parseStringList(): string[] {
        this.expectType('lbracket');
        const out: string[] = [];
        if (this.peek().type === 'rbracket') { this.i++; return out; }
        for (;;) {
            const t = this.expectType('string') as Extract<Token, { type: 'string' }>;
            out.push(t.value);
            if (this.peek().type === 'comma') { this.i++; continue; }
            break;
        }
        this.expectType('rbracket');
        return out;
    }

    private expectDuration(): number {
        const t = this.next();
        if (t.type !== 'duration') this.fail(`Expected a duration (e.g. 200ms or 3s), got ${describe(t)}`, t);
        return t.ms;
    }
}

function describe(t: Token): string {
    switch (t.type) {
        case 'word': return `'${t.value}'`;
        case 'string': return `string`;
        case 'number': return `number`;
        case 'duration': return `duration`;
        case 'at': return `selector @${t.name}`;
        case 'lbrace': return `'{'`;
        case 'rbrace': return `'}'`;
        case 'lbracket': return `'['`;
        case 'rbracket': return `']'`;
        case 'comma': return `','`;
        case 'eof': return 'end of script';
    }
}

// Reject `loop` bodies that have no waiting step — they'd freeze the page.
function validateLoopBody(body: Statement[], fail: (msg: string, l: number, c: number) => never): void {
    let hasWait = false;
    const walk = (stmts: Statement[]): void => {
        for (const s of stmts) {
            if (s.kind === 'trigger' && (s.trigger.kind === 'every' || s.trigger.kind === 'after')) {
                if (s.trigger.ms >= 50) hasWait = true;
            }
            if (s.kind === 'sequence') {
                for (const f of s.frames) if (f.waitMs >= 50) { hasWait = true; break; }
            }
            if (s.kind === 'action' && (s.action.kind === 'type' || s.action.kind === 'blink' || s.action.kind === 'animate')) {
                hasWait = true;
            }
        }
    };
    walk(body);
    if (!hasWait) fail("'loop' body must contain a wait of at least 50ms (every/after/sequence step wait/type/blink/animate)", 1, 1);
}

export function parseKeyframe(src: string): Program {
    const tokens = tokenize(src);
    const parser = new Parser(tokens);
    return parser.parseProgram();
}
