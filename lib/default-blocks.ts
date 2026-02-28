import { v4 as uuidv4 } from 'uuid';

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
                title: "Expert Services You Can Trust",
                subtitle: "We provide top-notch professional guarantees with decades of combined experience. Available 24/7 for all your needs.",
                buttonText: "Get a Free Quote",
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
                title: "Simplicity is the ultimate sophistication.",
                subtitle: "Elevating your everyday experience through focused, intentional service execution.",
                buttonText: "Discover Our Method",
                // Passing a hint for the block renderer to know it should render minimalist
                align: 'center'
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
                title: "Modern Solutions for Modern Problems.",
                subtitle: "Fast, reliable, and technologically advanced service delivery right to your door.",
                buttonText: "Schedule Service",
                align: 'left'
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
