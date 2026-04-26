export type TabStyle = 'underline' | 'pills' | 'tabs' | 'buttons';
export type TabAlign = 'left' | 'center' | 'right' | 'stretch';

export function getTabClass(style: TabStyle, active: boolean, align: TabAlign): string {
    const stretch = align === 'stretch' ? 'flex-1 justify-center text-center' : '';
    const base = `inline-flex items-center text-sm font-medium transition-all whitespace-nowrap ${stretch}`;

    switch (style) {
        case 'underline':
            return `${base} px-3 py-2 border-b-2 ${active ? 'border-current' : 'border-transparent hover:border-current/40'}`;
        case 'pills':
            return `${base} px-4 py-1.5 rounded-full ${active ? 'text-white' : 'hover:opacity-70'}`;
        case 'tabs':
            return `${base} px-4 py-2 rounded-t-lg border border-b-0 ${
                active ? 'bg-white border-slate-200' : 'bg-transparent border-transparent hover:border-slate-200'
            }`;
        case 'buttons':
            return `${base} px-4 py-2 rounded-lg border ${active ? 'text-white border-transparent' : 'border-current/30 hover:border-current/60'}`;
        default:
            return base;
    }
}

export function getTabStyle(style: TabStyle, active: boolean, activeColor: string): React.CSSProperties {
    switch (style) {
        case 'underline':
            return { color: activeColor };
        case 'pills':
            return active ? { backgroundColor: activeColor } : { color: activeColor };
        case 'tabs':
            return { color: activeColor };
        case 'buttons':
            return active ? { backgroundColor: activeColor } : { color: activeColor };
        default:
            return { color: activeColor };
    }
}
