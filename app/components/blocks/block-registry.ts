/**
 * Shared block component registry.
 * Imported by both BlockRenderer and MembershipGateBlock (child-block rendering).
 * MembershipGateBlock itself is intentionally NOT listed here — BlockRenderer adds it
 * after-the-fact to avoid a circular import.
 */
import HeroBlock from './HeroBlock';
import TextBlock from './TextBlock';
import CustomHTMLBlock from './CustomHTMLBlock';
import ImageBlock from './ImageBlock';
import MapBlock from './MapBlock';
import ServicesGridBlock from './ServicesGridBlock';
import FeaturesListBlock from './FeaturesListBlock';
import AboutImageTextBlock from './AboutImageTextBlock';
import CtaBlock from './CtaBlock';
import TestimonialsBlock from './TestimonialsBlock';
import StatsBlock from './StatsBlock';
import GalleryBlock from './GalleryBlock';
import ContactBlock from './ContactBlock';
import FAQBlock from './FAQBlock';
import BookingBlock from './BookingBlock';
import ProductGridBlock from './ProductGridBlock';
import ContactFormBlock from './ContactFormBlock';
import LogoCloudBlock from './LogoCloudBlock';
import PricingBlock from './PricingBlock';
import TeamBlock from './TeamBlock';
import BlogBlock from './BlogBlock';
import MenuBlock from './MenuBlock';
import EventsBlock from './EventsBlock';
import PDFBlock from './PDFBlock';
import ResourcesBlock from './ResourcesBlock';
import DeliveryLinksBlock from './DeliveryLinksBlock';
import FeaturedQuoteBlock from './FeaturedQuoteBlock';
import CarouselBlock from './CarouselBlock';
import TabBarBlock from './TabBarBlock';
import UserProfileBlock from './UserProfileBlock';
import ChatSupportBlock from './ChatSupportBlock';
import VideoBlock from './VideoBlock';
import EstimateFormBlock from './EstimateFormBlock';
import SocialFeedBlock from './SocialFeedBlock';

export const BLOCK_COMPONENTS: Record<string, React.ComponentType<any>> = {
    tabBar: TabBarBlock,
    userProfile: UserProfileBlock,
    hero: HeroBlock,
    text: TextBlock,
    image: ImageBlock,
    map: MapBlock,
    custom_html: CustomHTMLBlock,
    servicesGrid: ServicesGridBlock,
    featuresList: FeaturesListBlock,
    aboutImageText: AboutImageTextBlock,
    cta: CtaBlock,
    testimonials: TestimonialsBlock,
    stats: StatsBlock,
    gallery: GalleryBlock,
    contact: ContactBlock,
    faq: FAQBlock,
    booking: BookingBlock,
    productGrid: ProductGridBlock,
    contact_form: ContactFormBlock,
    logoCloud: LogoCloudBlock,
    pricing: PricingBlock,
    team: TeamBlock,
    blog: BlogBlock,
    menu: MenuBlock,
    events: EventsBlock,
    pdf: PDFBlock,
    resources: ResourcesBlock,
    deliveryLinks: DeliveryLinksBlock,
    featuredQuote: FeaturedQuoteBlock,
    carousel: CarouselBlock,
    chatSupport: ChatSupportBlock,
    video: VideoBlock,
    estimateForm: EstimateFormBlock,
    socialFeed: SocialFeedBlock,
};

/** All addable block types (used in both main renderer and inside gates). */
export const AVAILABLE_BLOCKS: Array<{ type: string; label: string; proOnly?: boolean }> = [
    { type: 'hero', label: 'Hero Section' },
    { type: 'text', label: 'Rich Text Paragraph' },
    { type: 'image', label: 'Image Section' },
    { type: 'servicesGrid', label: 'Services Grid' },
    { type: 'featuresList', label: 'Features / Why Us' },
    { type: 'aboutImageText', label: 'About (Image + Text)' },
    { type: 'testimonials', label: 'Testimonials' },
    { type: 'stats', label: 'Stats / Numbers' },
    { type: 'gallery', label: 'Image Gallery' },
    { type: 'contact', label: 'Contact Info' },
    { type: 'faq', label: 'FAQ Accordion' },
    { type: 'cta', label: 'Call to Action' },
    { type: 'booking', label: '📅 Booking / Appointments' },
    { type: 'productGrid', label: '🛍️ Product Catalog' },
    { type: 'contact_form', label: 'Contact Form' },
    { type: 'estimateForm', label: 'Estimate / Quote Form' },
    { type: 'logoCloud', label: 'Logo Cloud / Partners' },
    { type: 'pricing', label: 'Pricing Table' },
    { type: 'team', label: 'Team Members' },
    { type: 'map', label: 'Google Map' },
    { type: 'blog', label: '📝 Blog / News' },
    { type: 'menu', label: '🍽️ Menu' },
    { type: 'deliveryLinks', label: '🛵 Delivery App Links' },
    { type: 'events', label: '📅 Events' },
    { type: 'pdf', label: '📄 PDF Viewer' },
    { type: 'resources', label: '📚 Resources' },
    { type: 'custom_html', label: 'Custom HTML / Embed', proOnly: true },
    { type: 'featuredQuote', label: 'Featured Quote' },
    { type: 'carousel', label: 'Content Carousel' },
    { type: 'video', label: '▶ Video Embed' },
    { type: 'socialFeed', label: '📱 Social Media Embeds' },
    { type: 'tabBar', label: '🗂️ Tab Bar / Menu Bar' },
    { type: 'userProfile', label: '👤 User Profile', proOnly: true },
    // { type: 'chatSupport', label: '💬 AI Chat Support', proOnly: true }, // Hidden — not yet released
];
