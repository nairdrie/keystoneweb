import { v4 as uuidv4 } from 'uuid';

const responsiveHeroHeight = (mode: 'fitContent' | 'fitScreen' | 'manual' = 'fitContent', valuePx = 600) => ({
    desktop: { mode, valuePx, revealNext: 0 },
    tablet: { mode, valuePx: Math.max(520, valuePx - 40), revealNext: 0 },
    mobile: { mode: mode === 'fitScreen' ? 'fitContent' : mode, valuePx: Math.max(480, valuePx - 80), revealNext: 0 },
});

/**
 * Defines the initial array of completely pre-filled blocks to inject into the `design_data.blocks`
 * when a fresh "Home" page is generated based on the selected Template.
 */
export const DEFAULT_TEMPLATE_BLOCKS: Record<string, any[]> = {
    // ------------------------------------------------------------------------
    // CLASSIC PRO
    // The classic template focuses on strong contrasting sections.
    // ------------------------------------------------------------------------
    '_classic': [
        {
            id: uuidv4(),
            type: 'hero',
            data: {
                cards: [{
                    id: 'classic-hero-1',
                    content: {
                        title: { enabled: true, value: 'Expert Services You Can Trust', align: 'left' },
                        subtitle: { enabled: true, value: 'We provide top-notch professional guarantees with decades of combined experience. Available 24/7 for all your needs.', align: 'left' },
                        cta: { enabled: true, label: 'Get a Free Quote', align: 'left' },
                        image: { enabled: false, url: '', side: 'right' },
                    },
                    background: { type: 'gradient', gradient: { from: 'palette:accent', to: 'palette:accent', angle: 0 }, overlay: { color: '#000000', opacity: 0 } },
                }],
                transition: { type: 'fade', intervalSec: 5, pauseOnHover: true },
                height: responsiveHeroHeight(),
            }
        },
        {
            id: uuidv4(),
            type: 'servicesGrid',
            data: {
                title: "Our Core Services",
                subtitle: "",
                items: [
                    { title: "Premium Service 1", description: "Comprehensive diagnostic, repair, and installation services handled by our certified professionals." },
                    { title: "Premium Service 2", description: "Comprehensive diagnostic, repair, and installation services handled by our certified professionals." },
                    { title: "Premium Service 3", description: "Comprehensive diagnostic, repair, and installation services handled by our certified professionals." },
                    { title: "Premium Service 4", description: "Comprehensive diagnostic, repair, and installation services handled by our certified professionals." },
                    { title: "Premium Service 5", description: "Comprehensive diagnostic, repair, and installation services handled by our certified professionals." },
                    { title: "Premium Service 6", description: "Comprehensive diagnostic, repair, and installation services handled by our certified professionals." }
                ]
            }
        },
        {
            id: uuidv4(),
            type: 'aboutImageText',
            data: {
                title: "Why Choose Us?",
                imagePosition: 'left',
                items: [
                    'Licensed & Insured Experts',
                    '100% Satisfaction Guarantee',
                    'Upfront Honest Pricing',
                    '24/7 Emergency Support',
                    'Decades of Experience'
                ]
            }
        },
        {
            id: uuidv4(),
            type: 'estimateForm',
            data: {
                title: "Request an Estimate",
                description: "Tell us about your project and we'll provide a custom quote.",
                submitText: "Get My Estimate",
                successMessage: "Thank you! We'll review your request and get back to you shortly.",
                variant: 'simple',
                fields: [
                    { id: uuidv4(), label: 'Service Type', type: 'select', required: true, options: ['Consultation', 'Installation', 'Repair', 'Other'] },
                    { id: uuidv4(), label: 'Project Details', type: 'textarea', required: true },
                ],
                pricingEnabled: false,
                pricingBasePrice: 0,
                pricingCurrency: 'CAD',
                pricingRangeSpread: 0.15,
                pricingDisclaimer: 'This is an estimate only. Final pricing may vary.',
                showName: true,
                showEmail: true,
                showPhone: true,
                showMessage: false,
            }
        },
        {
            id: uuidv4(),
            type: 'cta',
            data: {
                title: "Ready to start your project?",
                subtitle: "Contact our professional team today for a free, no-obligation estimate.",
                buttonText: "Call Us Now"
            }
        }
    ],

    // ------------------------------------------------------------------------
    // MINIMAL WHITE
    // The minimal template uses lots of whitespace, elegant typography, and focused lists.
    // ------------------------------------------------------------------------
    '_minimal': [
        {
            id: uuidv4(),
            type: 'hero',
            data: {
                cards: [{
                    id: 'minimal-hero-1',
                    content: {
                        title: { enabled: true, value: 'Simplicity is the ultimate sophistication.', align: 'center' },
                        subtitle: { enabled: true, value: 'Elevating your everyday experience through focused, intentional service execution.', align: 'center' },
                        cta: { enabled: true, label: 'Discover Our Method', align: 'center' },
                        image: { enabled: false, url: '', side: 'right' },
                    },
                    background: { type: 'gradient', gradient: { from: 'palette:accent', to: 'palette:accent', angle: 0 }, overlay: { color: '#000000', opacity: 0 } },
                }],
                transition: { type: 'fade', intervalSec: 5, pauseOnHover: true },
                height: responsiveHeroHeight(),
            }
        },
        {
            id: uuidv4(),
            type: 'image',
            data: {
                // A massive full-width feature image
                caption: ""
            }
        },
        {
            id: uuidv4(),
            type: 'servicesGrid',
            data: {
                title: "Focused Capabilities",
                subtitle: "",
                items: [
                    { title: "Curated Service 1", description: "A refined approach to addressing complex necessities with elegant, sustainable solutions." },
                    { title: "Curated Service 2", description: "A refined approach to addressing complex necessities with elegant, sustainable solutions." },
                    { title: "Curated Service 3", description: "A refined approach to addressing complex necessities with elegant, sustainable solutions." }
                ]
            }
        },
        {
            id: uuidv4(),
            type: 'cta',
            data: {
                title: "Let's create something together.",
                subtitle: "",
                buttonText: "Contact"
            }
        }
    ],

    // ------------------------------------------------------------------------
    // MODERN BLUE
    // Heavy use of backgrounds, 6-grid services, split hero banner
    // ------------------------------------------------------------------------
    '_modern': [
        {
            id: uuidv4(),
            type: 'hero',
            data: {
                cards: [{
                    id: 'modern-hero-1',
                    content: {
                        title: { enabled: true, value: 'Modern Solutions for Modern Problems.', align: 'left' },
                        subtitle: { enabled: true, value: 'Fast, reliable, and technologically advanced service delivery right to your door.', align: 'left' },
                        cta: { enabled: true, label: 'Schedule Service', align: 'left' },
                        image: { enabled: false, url: '', side: 'right' },
                    },
                    background: { type: 'gradient', gradient: { from: 'palette:primary', to: 'palette:secondary', angle: 135 }, overlay: { color: '#000000', opacity: 0 } },
                }],
                transition: { type: 'fade', intervalSec: 5, pauseOnHover: true },
                height: responsiveHeroHeight(),
            }
        },
        {
            id: uuidv4(),
            type: 'image',
            data: {
                title: "Our Work"
            }
        },
        {
            id: uuidv4(),
            type: 'servicesGrid',
            data: {
                title: "Our Specializations",
                subtitle: "Industry leading expertise across the board.",
                items: [
                    { title: "Modern Service 1", description: "Next-generation techniques applied to solve your complex requirements with minimal downtime." },
                    { title: "Modern Service 2", description: "Next-generation techniques applied to solve your complex requirements with minimal downtime." },
                    { title: "Modern Service 3", description: "Next-generation techniques applied to solve your complex requirements with minimal downtime." },
                    { title: "Modern Service 4", description: "Next-generation techniques applied to solve your complex requirements with minimal downtime." },
                    { title: "Modern Service 5", description: "Next-generation techniques applied to solve your complex requirements with minimal downtime." },
                    { title: "Modern Service 6", description: "Next-generation techniques applied to solve your complex requirements with minimal downtime." }
                ]
            }
        },
        {
            id: uuidv4(),
            type: 'cta',
            data: {
                title: "Experience the Difference.",
                subtitle: "Join thousands of satisfied customers who have upgraded their service experience.",
                buttonText: "Get Started Today",
                showPattern: true
            }
        }
    ]
};
