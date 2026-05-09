import type { LucideIcon } from 'lucide-react';
import {
    BarChart3,
    BookOpen,
    CalendarDays,
    ClipboardList,
    Code,
    Columns2,
    Contact,
    FileText,
    Grid3X3,
    HelpCircle,
    History,
    Image,
    Images,
    LayoutTemplate,
    ListChecks,
    Lock,
    Mail,
    MapPin,
    Megaphone,
    MessageCircle,
    MessageSquareQuote,
    Package,
    PanelTop,
    Phone,
    Quote,
    ShoppingBag,
    Smartphone,
    Sparkles,
    Tags,
    Truck,
    Type,
    User,
    Users,
    UtensilsCrossed,
} from 'lucide-react';

export const BLOCK_ICON_MAP: Record<string, LucideIcon> = {
    hero: Sparkles,
    text: Type,
    image: Image,
    map: MapPin,
    custom_html: Code,
    servicesGrid: Grid3X3,
    featuresList: ListChecks,
    aboutImageText: Contact,
    cta: Megaphone,
    testimonials: MessageSquareQuote,
    stats: BarChart3,
    gallery: Images,
    contact: Phone,
    faq: HelpCircle,
    booking: CalendarDays,
    productGrid: ShoppingBag,
    contact_form: Mail,
    estimateForm: ClipboardList,
    logoCloud: Package,
    pricing: Tags,
    team: Users,
    blog: FileText,
    menu: UtensilsCrossed,
    events: CalendarDays,
    pdf: FileText,
    resources: BookOpen,
    deliveryLinks: Truck,
    featuredQuote: Quote,
    carousel: LayoutTemplate,
    chatSupport: MessageCircle,
    video: PanelTop,
    socialFeed: Smartphone,
    tabBar: LayoutTemplate,
    timeline: History,
    userProfile: User,
    membershipGate: Lock,
    sideBySide: Columns2,
};

export function getBlockIcon(type: string): LucideIcon {
    return BLOCK_ICON_MAP[type] || LayoutTemplate;
}

export function getBlockDisplayLabel(label: string): string {
    const cleanLabel = label
        .replace(/[^\x20-\x7E]/g, '')
        .replace(/^[^A-Za-z0-9]+/, '')
        .trim();

    return cleanLabel || label;
}
