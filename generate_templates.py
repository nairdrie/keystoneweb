#!/usr/bin/env python3
"""Generate template_inserts_v2.sql with all 136 template metadata entries."""

import json

# 8 template styles
STYLES = {
    'luxe': {
        'titleFont': 'Playfair Display',
        'bodyFont': 'Lato',
        'hero_variant': 'centered',
        'blocks_pattern': ['hero', 'logoCloud', 'servicesGrid', 'aboutImageText', 'testimonials', 'cta'],
        'testimonials_variant': 'single',
        'stats_variant': None,
    },
    'vivid': {
        'titleFont': 'Space Grotesk',
        'bodyFont': 'DM Sans',
        'hero_variant': 'split',
        'blocks_pattern': ['hero', 'stats', 'servicesGrid', 'gallery', 'testimonials', 'cta'],
        'testimonials_variant': 'cards',
        'stats_variant': 'banner',
    },
    'airy': {
        'titleFont': 'Nunito',
        'bodyFont': 'Nunito',
        'hero_variant': 'minimal',
        'blocks_pattern': ['hero', 'featuresList', 'aboutImageText', 'testimonials', 'faq', 'cta'],
        'testimonials_variant': 'cards',
        'stats_variant': None,
    },
    'edge': {
        'titleFont': 'JetBrains Mono',
        'bodyFont': 'Inter',
        'hero_variant': 'fullImage',
        'blocks_pattern': ['hero', 'stats', 'servicesGrid', 'team', 'testimonials', 'cta'],
        'testimonials_variant': 'cards',
        'stats_variant': 'cards',
    },
    'classic': {
        'titleFont': 'Merriweather',
        'bodyFont': 'Source Sans 3',
        'hero_variant': 'split',
        'blocks_pattern': ['hero', 'stats', 'servicesGrid', 'aboutImageText', 'testimonials', 'featuresList', 'cta'],
        'testimonials_variant': 'cards',
        'stats_variant': 'banner',
    },
    'organic': {
        'titleFont': 'Libre Baskerville',
        'bodyFont': 'Karla',
        'hero_variant': 'centered',
        'blocks_pattern': ['hero', 'aboutImageText', 'servicesGrid', 'gallery', 'testimonials', 'cta'],
        'testimonials_variant': 'single',
        'stats_variant': None,
    },
    'sleek': {
        'titleFont': 'Sora',
        'bodyFont': 'Inter',
        'hero_variant': 'minimal',
        'blocks_pattern': ['hero', 'logoCloud', 'servicesGrid', 'stats', 'testimonials', 'cta'],
        'testimonials_variant': 'cards',
        'stats_variant': 'cards',
    },
    'vibrant': {
        'titleFont': 'Plus Jakarta Sans',
        'bodyFont': 'Plus Jakarta Sans',
        'hero_variant': 'fullImage',
        'blocks_pattern': ['hero', 'stats', 'servicesGrid', 'team', 'testimonials', 'faq', 'cta'],
        'testimonials_variant': 'cards',
        'stats_variant': 'banner',
    },
}

# Categories with niche-specific content
SERVICES_CATEGORIES = {
    'handyman': {
        'site_titles': {'luxe': 'Premier Handyman', 'vivid': 'FixIt Pro', 'airy': 'Handy Helper', 'edge': 'RepairTech', 'classic': 'Reliable Handyman', 'organic': 'Craftsman\'s Touch', 'sleek': 'Swift Repairs', 'vibrant': 'HandyHub'},
        'hero_title': 'Expert Handyman Services',
        'hero_subtitle': 'From small fixes to major repairs, we handle it all with precision and care.',
        'nav_button': 'Get Quote',
        'services': [
            {'title': 'General Repairs', 'description': 'Door hinges, drywall patches, furniture assembly, and more.'},
            {'title': 'Painting & Finishing', 'description': 'Interior and exterior painting with premium materials.'},
            {'title': 'Home Maintenance', 'description': 'Regular upkeep to keep your home in perfect condition.'},
        ],
        'stats': [{'value': '500+', 'label': 'Jobs Done'}, {'value': '15+', 'label': 'Years Experience'}, {'value': '24/7', 'label': 'Availability'}, {'value': '100%', 'label': 'Satisfaction'}],
        'testimonials': [
            {'name': 'Sarah M.', 'role': 'Homeowner', 'quote': 'Fixed everything in one visit! Professional and efficient.', 'rating': 5},
            {'name': 'James R.', 'role': 'Property Manager', 'quote': 'Reliable and always does quality work. Highly recommended.', 'rating': 5},
            {'name': 'Lisa K.', 'role': 'Business Owner', 'quote': 'Fair pricing and excellent craftsmanship every time.', 'rating': 5},
        ],
        'cta_title': 'Need Something Fixed?',
        'cta_subtitle': 'Contact us today for a free estimate on any repair or maintenance project.',
        'features': ['Licensed & Insured', '100% Satisfaction Guarantee', 'Upfront Pricing', 'Same-Day Service Available'],
        'palettes': {
            'Warm Pro': {'primary': '#78350f', 'secondary': '#ea580c', 'accent': '#fff7ed'},
            'Cool Steel': {'primary': '#334155', 'secondary': '#3b82f6', 'accent': '#f1f5f9'},
            'Forest': {'primary': '#14532d', 'secondary': '#22c55e', 'accent': '#f0fdf4'},
        },
    },
    'plumber': {
        'site_titles': {'luxe': 'Aqua Plumbing', 'vivid': 'FlowFix Pro', 'airy': 'Clear Pipes', 'edge': 'HydroTech', 'classic': 'Expert Plumbing', 'organic': 'Natural Flow', 'sleek': 'PipeLine Co', 'vibrant': 'Rush Plumbing'},
        'hero_title': 'Fast, Reliable Plumbing',
        'hero_subtitle': 'Licensed plumbers ready for any job. Emergency service available 24/7.',
        'nav_button': 'Get Quote',
        'services': [
            {'title': 'Emergency Repairs', 'description': '24/7 emergency plumbing for burst pipes, leaks, and flooding.'},
            {'title': 'Drain Cleaning', 'description': 'Professional drain and sewer cleaning for all fixtures.'},
            {'title': 'Water Heater', 'description': 'Installation, repair, and maintenance of all water heater types.'},
        ],
        'stats': [{'value': '1000+', 'label': 'Repairs Done'}, {'value': '20+', 'label': 'Years Experience'}, {'value': '24/7', 'label': 'Emergency'}, {'value': '100%', 'label': 'Licensed'}],
        'testimonials': [
            {'name': 'Mike T.', 'role': 'Homeowner', 'quote': 'Fixed our burst pipe in under an hour. Lifesaver!', 'rating': 5},
            {'name': 'Karen S.', 'role': 'Property Manager', 'quote': 'Reliable and professional. We use them for all properties.', 'rating': 5},
            {'name': 'David L.', 'role': 'Restaurant Owner', 'quote': 'Quick response and fair pricing. Excellent service.', 'rating': 5},
        ],
        'cta_title': 'Need a Plumber?',
        'cta_subtitle': 'Call us now for a free estimate. Available 24/7 for emergencies.',
        'features': ['Licensed & Insured', 'Free Estimates', '24/7 Emergency Service', 'Upfront Pricing'],
        'palettes': {
            'Ocean': {'primary': '#0c4a6e', 'secondary': '#0ea5e9', 'accent': '#f0f9ff'},
            'Navy Pro': {'primary': '#1e3a5f', 'secondary': '#3b82f6', 'accent': '#eff6ff'},
            'Teal Fresh': {'primary': '#134e4a', 'secondary': '#14b8a6', 'accent': '#f0fdfa'},
        },
    },
    'electrical': {
        'site_titles': {'luxe': 'Luxe Electric', 'vivid': 'Spark Pro', 'airy': 'Bright Wire', 'edge': 'VoltEdge', 'classic': 'Reliable Electric', 'organic': 'Green Power', 'sleek': 'Ohm Electric', 'vibrant': 'Flash Electric'},
        'hero_title': 'Professional Electrical Services',
        'hero_subtitle': 'Certified electricians for residential and commercial projects.',
        'nav_button': 'Get Estimate',
        'services': [
            {'title': 'Wiring & Rewiring', 'description': 'Complete electrical wiring for new builds and renovations.'},
            {'title': 'Panel Upgrades', 'description': 'Electrical panel upgrades to meet modern power demands.'},
            {'title': 'Lighting Installation', 'description': 'Indoor and outdoor lighting design and installation.'},
        ],
        'stats': [{'value': '800+', 'label': 'Projects'}, {'value': '25+', 'label': 'Years'}, {'value': '0', 'label': 'Incidents'}, {'value': '100%', 'label': 'Code Compliant'}],
        'testimonials': [
            {'name': 'Tom W.', 'role': 'Homeowner', 'quote': 'Upgraded our entire panel. Clean work and on time.', 'rating': 5},
            {'name': 'Amy B.', 'role': 'Contractor', 'quote': 'Our go-to electricians. Always reliable and professional.', 'rating': 5},
            {'name': 'Chris P.', 'role': 'Business Owner', 'quote': 'Installed our commercial lighting. Excellent results.', 'rating': 5},
        ],
        'cta_title': 'Electrical Project?',
        'cta_subtitle': 'Get a free, no-obligation estimate from our certified electricians.',
        'features': ['Certified Electricians', 'Code Compliant', 'Free Estimates', 'Warranty on All Work'],
        'palettes': {
            'Electric': {'primary': '#7c3aed', 'secondary': '#fbbf24', 'accent': '#fef9c3'},
            'Industrial': {'primary': '#1f2937', 'secondary': '#f59e0b', 'accent': '#fffbeb'},
            'Volt Blue': {'primary': '#1e3a8a', 'secondary': '#60a5fa', 'accent': '#eff6ff'},
        },
    },
    'hvac': {
        'site_titles': {'luxe': 'Climate Luxe', 'vivid': 'CoolForce', 'airy': 'Fresh Air Co', 'edge': 'ThermoTech', 'classic': 'Pro HVAC', 'organic': 'Natural Climate', 'sleek': 'AirFlow', 'vibrant': 'ClimatePro'},
        'hero_title': 'Heating & Cooling Experts',
        'hero_subtitle': 'Keep your home comfortable year-round with our professional HVAC services.',
        'nav_button': 'Schedule Service',
        'services': [
            {'title': 'AC Installation', 'description': 'Professional air conditioning installation and setup.'},
            {'title': 'Heating Repair', 'description': 'Expert furnace and heating system repair services.'},
            {'title': 'Maintenance Plans', 'description': 'Preventive maintenance to keep systems running efficiently.'},
        ],
        'stats': [{'value': '600+', 'label': 'Systems Installed'}, {'value': '18+', 'label': 'Years'}, {'value': '24/7', 'label': 'Service'}, {'value': '98%', 'label': 'Satisfaction'}],
        'testimonials': [
            {'name': 'Rachel D.', 'role': 'Homeowner', 'quote': 'New AC installed perfectly. House is so comfortable now!', 'rating': 5},
            {'name': 'Greg M.', 'role': 'Property Manager', 'quote': 'They maintain all our buildings. Always professional.', 'rating': 5},
            {'name': 'Sandra K.', 'role': 'Business Owner', 'quote': 'Saved us thousands with their energy-efficient solutions.', 'rating': 5},
        ],
        'cta_title': 'Stay Comfortable',
        'cta_subtitle': 'Schedule your HVAC service today. Free estimates on all installations.',
        'features': ['EPA Certified', 'Energy-Efficient Solutions', 'Free Estimates', 'Maintenance Plans'],
        'palettes': {
            'Cool Blue': {'primary': '#0369a1', 'secondary': '#06b6d4', 'accent': '#ecfeff'},
            'Professional': {'primary': '#1e3a5f', 'secondary': '#60a5fa', 'accent': '#f0f9ff'},
            'Energy': {'primary': '#059669', 'secondary': '#10b981', 'accent': '#ecfdf5'},
        },
    },
    'mechanic': {
        'site_titles': {'luxe': 'Prestige Auto', 'vivid': 'Turbo Garage', 'airy': 'Easy Auto', 'edge': 'MechTech', 'classic': 'Pro Auto Shop', 'organic': 'Honest Mechanic', 'sleek': 'Apex Auto', 'vibrant': 'Rev Garage'},
        'hero_title': 'Expert Auto Repair',
        'hero_subtitle': 'Certified mechanics you can trust. Quality parts, honest service.',
        'nav_button': 'Book Service',
        'services': [
            {'title': 'Engine Diagnostics', 'description': 'Advanced computer diagnostics for all makes and models.'},
            {'title': 'Brake Service', 'description': 'Complete brake inspection, repair, and replacement.'},
            {'title': 'Oil & Maintenance', 'description': 'Regular maintenance to keep your vehicle running smoothly.'},
        ],
        'stats': [{'value': '3000+', 'label': 'Cars Serviced'}, {'value': '20+', 'label': 'Years'}, {'value': 'ASE', 'label': 'Certified'}, {'value': '5★', 'label': 'Rating'}],
        'testimonials': [
            {'name': 'Mark H.', 'role': 'Car Owner', 'quote': 'Finally found a mechanic I can trust. Fair and honest.', 'rating': 5},
            {'name': 'Jennifer L.', 'role': 'Fleet Manager', 'quote': 'They service our entire fleet. Always reliable.', 'rating': 5},
            {'name': 'Steve R.', 'role': 'Car Enthusiast', 'quote': 'Top-notch work on my classic car. Highly skilled team.', 'rating': 5},
        ],
        'cta_title': 'Vehicle Need Service?',
        'cta_subtitle': 'Book your appointment today. Free diagnostics with any repair.',
        'features': ['ASE Certified', 'All Makes & Models', 'Warranty on Parts', 'Free Diagnostics'],
        'palettes': {
            'Steel': {'primary': '#1f2937', 'secondary': '#dc2626', 'accent': '#f9fafb'},
            'Speed': {'primary': '#dc2626', 'secondary': '#f97316', 'accent': '#fff7ed'},
            'Chrome': {'primary': '#0f172a', 'secondary': '#6366f1', 'accent': '#f5f3ff'},
        },
    },
    'trades': {
        'site_titles': {'luxe': 'Master Craft', 'vivid': 'BuildForce', 'airy': 'Craft & Build', 'edge': 'TradeWorks', 'classic': 'Pro Trades', 'organic': 'Timber & Stone', 'sleek': 'Construct Co', 'vibrant': 'BuildBright'},
        'hero_title': 'Quality Craftsmanship',
        'hero_subtitle': 'Expert carpentry, welding, and construction services for every project.',
        'nav_button': 'Request Quote',
        'services': [
            {'title': 'Custom Carpentry', 'description': 'Built-in shelving, cabinets, and custom woodwork.'},
            {'title': 'Renovations', 'description': 'Kitchen, bathroom, and whole-home renovation projects.'},
            {'title': 'Structural Work', 'description': 'Framing, decks, and structural repair services.'},
        ],
        'stats': [{'value': '400+', 'label': 'Projects'}, {'value': '22+', 'label': 'Years'}, {'value': '100%', 'label': 'Licensed'}, {'value': '5★', 'label': 'Reviews'}],
        'testimonials': [
            {'name': 'Paul D.', 'role': 'Homeowner', 'quote': 'Beautiful custom cabinets. True craftsmen at work.', 'rating': 5},
            {'name': 'Linda M.', 'role': 'Architect', 'quote': 'Precision and attention to detail on every project.', 'rating': 5},
            {'name': 'Bob T.', 'role': 'Developer', 'quote': 'They handle all our construction. Reliable and skilled.', 'rating': 5},
        ],
        'cta_title': 'Start Your Project',
        'cta_subtitle': 'Contact us for a free consultation and project estimate.',
        'features': ['Licensed Contractors', 'Custom Solutions', 'Quality Materials', 'Project Guarantee'],
        'palettes': {
            'Rustic': {'primary': '#78350f', 'secondary': '#d97706', 'accent': '#fffbeb'},
            'Professional': {'primary': '#1f2937', 'secondary': '#059669', 'accent': '#f0fdf4'},
            'Modern': {'primary': '#334155', 'secondary': '#3b82f6', 'accent': '#f1f5f9'},
        },
    },
    'cleaning': {
        'site_titles': {'luxe': 'Pristine Clean', 'vivid': 'SparkleForce', 'airy': 'Fresh & Clean', 'edge': 'CleanTech Pro', 'classic': 'Expert Cleaners', 'organic': 'Pure Clean', 'sleek': 'Spotless Co', 'vibrant': 'ShineTime'},
        'hero_title': 'Professional Cleaning Services',
        'hero_subtitle': 'Spotless results for homes and offices. Eco-friendly products available.',
        'nav_button': 'Book Cleaning',
        'services': [
            {'title': 'Deep Cleaning', 'description': 'Thorough top-to-bottom cleaning for a fresh start.'},
            {'title': 'Regular Service', 'description': 'Weekly or bi-weekly cleaning to keep spaces spotless.'},
            {'title': 'Move In/Out', 'description': 'Complete cleaning for moving transitions.'},
        ],
        'stats': [{'value': '700+', 'label': 'Homes Cleaned'}, {'value': '10+', 'label': 'Years'}, {'value': '100%', 'label': 'Eco-Friendly'}, {'value': '5★', 'label': 'Rating'}],
        'testimonials': [
            {'name': 'Emily S.', 'role': 'Homeowner', 'quote': 'My house has never been this clean. Amazing service!', 'rating': 5},
            {'name': 'Dan R.', 'role': 'Office Manager', 'quote': 'Reliable weekly service. Our office always looks great.', 'rating': 5},
            {'name': 'Nina P.', 'role': 'Realtor', 'quote': 'Best move-out cleaning service. My clients love them.', 'rating': 5},
        ],
        'cta_title': 'Ready for a Clean Space?',
        'cta_subtitle': 'Book your cleaning today. First-time customers get 20% off!',
        'features': ['Eco-Friendly Products', 'Background Checked', 'Satisfaction Guaranteed', 'Flexible Scheduling'],
        'palettes': {
            'Fresh': {'primary': '#0d9488', 'secondary': '#5eead4', 'accent': '#f0fdfa'},
            'Sky': {'primary': '#0369a1', 'secondary': '#38bdf8', 'accent': '#f0f9ff'},
            'Mint': {'primary': '#059669', 'secondary': '#34d399', 'accent': '#ecfdf5'},
        },
    },
    'landscaping': {
        'site_titles': {'luxe': 'Eden Gardens', 'vivid': 'GreenForce', 'airy': 'Green Thumb', 'edge': 'LandTech', 'classic': 'Pro Landscaping', 'organic': 'Nature\'s Way', 'sleek': 'Terrain Co', 'vibrant': 'GardenGlow'},
        'hero_title': 'Beautiful Landscapes',
        'hero_subtitle': 'Transform your outdoor space with our professional landscaping services.',
        'nav_button': 'Get Estimate',
        'services': [
            {'title': 'Lawn Care', 'description': 'Mowing, edging, fertilizing, and weed control.'},
            {'title': 'Garden Design', 'description': 'Custom garden design and planting services.'},
            {'title': 'Hardscaping', 'description': 'Patios, walkways, retaining walls, and outdoor living spaces.'},
        ],
        'stats': [{'value': '300+', 'label': 'Properties'}, {'value': '12+', 'label': 'Years'}, {'value': '100%', 'label': 'Organic Options'}, {'value': '5★', 'label': 'Reviews'}],
        'testimonials': [
            {'name': 'Patricia H.', 'role': 'Homeowner', 'quote': 'Our yard has never looked better. True artists!', 'rating': 5},
            {'name': 'Robert J.', 'role': 'HOA President', 'quote': 'They maintain our entire community beautifully.', 'rating': 5},
            {'name': 'Susan M.', 'role': 'Business Owner', 'quote': 'Our commercial property looks amazing year-round.', 'rating': 5},
        ],
        'cta_title': 'Transform Your Yard',
        'cta_subtitle': 'Get a free landscape design consultation today.',
        'features': ['Licensed & Insured', 'Custom Designs', 'Organic Options', 'Seasonal Plans'],
        'palettes': {
            'Garden': {'primary': '#14532d', 'secondary': '#22c55e', 'accent': '#f0fdf4'},
            'Earth': {'primary': '#78350f', 'secondary': '#84cc16', 'accent': '#fefce8'},
            'Forest': {'primary': '#064e3b', 'secondary': '#10b981', 'accent': '#ecfdf5'},
        },
    },
    'consulting': {
        'site_titles': {'luxe': 'Apex Consulting', 'vivid': 'Catalyst Co', 'airy': 'Clear Path', 'edge': 'StratEdge', 'classic': 'Premier Consulting', 'organic': 'Thoughtful Counsel', 'sleek': 'Insight Co', 'vibrant': 'BrightStrategy'},
        'hero_title': 'Strategic Business Consulting',
        'hero_subtitle': 'Expert guidance to help your business grow and thrive in any market.',
        'nav_button': 'Book Consultation',
        'services': [
            {'title': 'Business Strategy', 'description': 'Develop winning strategies for growth and competitive advantage.'},
            {'title': 'Operations', 'description': 'Optimize processes and systems for maximum efficiency.'},
            {'title': 'Digital Transformation', 'description': 'Modernize your business with the latest technology solutions.'},
        ],
        'stats': [{'value': '200+', 'label': 'Clients Served'}, {'value': '15+', 'label': 'Years'}, {'value': '$50M+', 'label': 'Revenue Generated'}, {'value': '95%', 'label': 'Retention'}],
        'testimonials': [
            {'name': 'Richard C.', 'role': 'CEO', 'quote': 'Transformed our company strategy. Revenue doubled.', 'rating': 5},
            {'name': 'Maria G.', 'role': 'Startup Founder', 'quote': 'Invaluable guidance during our growth phase.', 'rating': 5},
            {'name': 'Alex W.', 'role': 'VP Operations', 'quote': 'Streamlined our operations and saved us millions.', 'rating': 5},
        ],
        'cta_title': 'Ready to Grow?',
        'cta_subtitle': 'Schedule a free 30-minute strategy session with our experts.',
        'features': ['Proven Methodology', 'Industry Expertise', 'Data-Driven Insights', 'Ongoing Support'],
        'palettes': {
            'Navy Gold': {'primary': '#1e3a5f', 'secondary': '#d97706', 'accent': '#fffbeb'},
            'Slate': {'primary': '#1e293b', 'secondary': '#6366f1', 'accent': '#f5f3ff'},
            'Professional': {'primary': '#111827', 'secondary': '#3b82f6', 'accent': '#eff6ff'},
        },
    },
    'freelance': {
        'site_titles': {'luxe': 'Studio Luxe', 'vivid': 'Creative Spark', 'airy': 'Open Canvas', 'edge': 'CodeEdge', 'classic': 'Pro Freelance', 'organic': 'Artisan Works', 'sleek': 'Mono Studio', 'vibrant': 'Pixel Pop'},
        'hero_title': 'Creative Freelance Services',
        'hero_subtitle': 'Design, development, and creative solutions tailored to your vision.',
        'nav_button': 'Start Project',
        'services': [
            {'title': 'Web Design', 'description': 'Beautiful, responsive websites that convert visitors.'},
            {'title': 'Brand Identity', 'description': 'Logo design, color systems, and brand guidelines.'},
            {'title': 'Content Creation', 'description': 'Copywriting, photography, and social media content.'},
        ],
        'stats': [{'value': '150+', 'label': 'Projects'}, {'value': '8+', 'label': 'Years'}, {'value': '50+', 'label': 'Happy Clients'}, {'value': '100%', 'label': 'On-Time Delivery'}],
        'testimonials': [
            {'name': 'Jane D.', 'role': 'Startup Founder', 'quote': 'Incredible design work. Exceeded all expectations.', 'rating': 5},
            {'name': 'Tyler M.', 'role': 'Marketing Director', 'quote': 'Consistent quality and always meets deadlines.', 'rating': 5},
            {'name': 'Priya S.', 'role': 'Small Business Owner', 'quote': 'Transformed our brand completely. Love the results!', 'rating': 5},
        ],
        'cta_title': 'Let\'s Create Together',
        'cta_subtitle': 'Share your vision and get a free project proposal.',
        'features': ['Custom Solutions', 'Fast Turnaround', 'Unlimited Revisions', 'Ongoing Support'],
        'palettes': {
            'Indigo': {'primary': '#312e81', 'secondary': '#818cf8', 'accent': '#eef2ff'},
            'Coral': {'primary': '#1f2937', 'secondary': '#f43f5e', 'accent': '#fff1f2'},
            'Mint': {'primary': '#064e3b', 'secondary': '#34d399', 'accent': '#ecfdf5'},
        },
    },
    'salon': {
        'site_titles': {'luxe': 'Luna Salon', 'vivid': 'Glow Studio', 'airy': 'Soft Touch', 'edge': 'Neon Salon', 'classic': 'Classic Beauty', 'organic': 'Natural Glow', 'sleek': 'Minimal Beauty', 'vibrant': 'Color Pop Salon'},
        'hero_title': 'Salon & Spa Experience',
        'hero_subtitle': 'Relax, rejuvenate, and leave feeling your absolute best.',
        'nav_button': 'Book Now',
        'services': [
            {'title': 'Hair Styling', 'description': 'Cuts, color, highlights, and treatments by expert stylists.'},
            {'title': 'Nail Services', 'description': 'Manicures, pedicures, gel, and nail art.'},
            {'title': 'Spa Treatments', 'description': 'Facials, massages, and body treatments for total relaxation.'},
        ],
        'stats': [{'value': '1000+', 'label': 'Happy Clients'}, {'value': '10+', 'label': 'Years'}, {'value': '15+', 'label': 'Stylists'}, {'value': '5★', 'label': 'Google Rating'}],
        'testimonials': [
            {'name': 'Amanda R.', 'role': 'Regular Client', 'quote': 'Best salon experience ever! My hair looks amazing.', 'rating': 5},
            {'name': 'Michelle T.', 'role': 'Bride', 'quote': 'Made my wedding day perfect. The whole party looked stunning.', 'rating': 5},
            {'name': 'Olivia P.', 'role': 'Regular Client', 'quote': 'The spa treatments here are pure bliss. I go every month.', 'rating': 5},
        ],
        'cta_title': 'Time to Treat Yourself',
        'cta_subtitle': 'Book your appointment today and discover your best look.',
        'features': ['Expert Stylists', 'Premium Products', 'Relaxing Atmosphere', 'Online Booking'],
        'palettes': {
            'Rose': {'primary': '#831843', 'secondary': '#f472b6', 'accent': '#fdf2f8'},
            'Gold': {'primary': '#78350f', 'secondary': '#d97706', 'accent': '#fffbeb'},
            'Lavender': {'primary': '#581c87', 'secondary': '#c084fc', 'accent': '#faf5ff'},
        },
    },
    'fitness': {
        'site_titles': {'luxe': 'Elite Fitness', 'vivid': 'Iron Force', 'airy': 'Zen Fitness', 'edge': 'Beast Mode', 'classic': 'Pro Fitness', 'organic': 'Wholesome Fitness', 'sleek': 'Peak Performance', 'vibrant': 'FitVibe'},
        'hero_title': 'Transform Your Body',
        'hero_subtitle': 'Personal training, group classes, and nutrition coaching to reach your goals.',
        'nav_button': 'Join Now',
        'services': [
            {'title': 'Personal Training', 'description': 'One-on-one sessions tailored to your fitness goals.'},
            {'title': 'Group Classes', 'description': 'HIIT, yoga, spin, and more in an energizing environment.'},
            {'title': 'Nutrition Coaching', 'description': 'Customized meal plans and nutritional guidance.'},
        ],
        'stats': [{'value': '500+', 'label': 'Members'}, {'value': '10+', 'label': 'Trainers'}, {'value': '50+', 'label': 'Classes/Week'}, {'value': '95%', 'label': 'Goal Achievement'}],
        'testimonials': [
            {'name': 'Jason K.', 'role': 'Member', 'quote': 'Lost 30 lbs and gained confidence. Life-changing!', 'rating': 5},
            {'name': 'Stephanie R.', 'role': 'Member', 'quote': 'The trainers are incredible. Best gym I have been to.', 'rating': 5},
            {'name': 'Derek M.', 'role': 'Athlete', 'quote': 'Top-notch facilities and programming. Highly recommend.', 'rating': 5},
        ],
        'cta_title': 'Start Your Journey',
        'cta_subtitle': 'Join today and get your first week free. No commitment required.',
        'features': ['Certified Trainers', 'State-of-the-Art Equipment', 'Flexible Schedules', 'Community Support'],
        'palettes': {
            'Power': {'primary': '#0f172a', 'secondary': '#dc2626', 'accent': '#fef2f2'},
            'Energy': {'primary': '#1f2937', 'secondary': '#f59e0b', 'accent': '#fffbeb'},
            'Fresh': {'primary': '#065f46', 'secondary': '#10b981', 'accent': '#ecfdf5'},
        },
    },
}

PRODUCTS_CATEGORIES = {
    'ecommerce': {
        'site_titles': {'luxe': 'Luxe Store', 'vivid': 'ShopVivid', 'airy': 'Light Market', 'edge': 'TechStore', 'classic': 'Classic Shop', 'organic': 'Artisan Market', 'sleek': 'Mono Shop', 'vibrant': 'PopStore'},
        'hero_title': 'Shop the Latest Collection',
        'hero_subtitle': 'Curated products with fast shipping and hassle-free returns.',
        'nav_button': 'Shop Now',
        'services': [
            {'title': 'New Arrivals', 'description': 'Discover our latest products, handpicked for quality.'},
            {'title': 'Best Sellers', 'description': 'See what everyone is loving right now.'},
            {'title': 'Special Offers', 'description': 'Limited-time deals and exclusive discounts.'},
        ],
        'stats': [{'value': '10K+', 'label': 'Happy Customers'}, {'value': '500+', 'label': 'Products'}, {'value': 'Free', 'label': 'Shipping'}, {'value': '30-Day', 'label': 'Returns'}],
        'testimonials': [
            {'name': 'Alex R.', 'role': 'Verified Buyer', 'quote': 'Amazing quality products. Fast shipping too!', 'rating': 5},
            {'name': 'Maria S.', 'role': 'Repeat Customer', 'quote': 'My go-to store. Never disappointed.', 'rating': 5},
            {'name': 'Chris L.', 'role': 'Verified Buyer', 'quote': 'Great prices and the customer service is excellent.', 'rating': 5},
        ],
        'cta_title': 'Don\'t Miss Out',
        'cta_subtitle': 'Sign up for exclusive deals and new arrival notifications.',
        'features': ['Free Shipping', '30-Day Returns', 'Secure Checkout', '24/7 Support'],
        'palettes': {
            'Boutique': {'primary': '#7c3aed', 'secondary': '#a78bfa', 'accent': '#f5f3ff'},
            'Modern': {'primary': '#111827', 'secondary': '#6366f1', 'accent': '#eef2ff'},
            'Fresh': {'primary': '#0f766e', 'secondary': '#2dd4bf', 'accent': '#f0fdfa'},
        },
    },
    'handmade': {
        'site_titles': {'luxe': 'Maison Craft', 'vivid': 'CraftBurst', 'airy': 'Gentle Craft', 'edge': 'MakerEdge', 'classic': 'Heritage Crafts', 'organic': 'Earth & Thread', 'sleek': 'Pure Craft', 'vibrant': 'CraftJoy'},
        'hero_title': 'Handcrafted With Love',
        'hero_subtitle': 'Unique, artisan-made products crafted with care and attention to detail.',
        'nav_button': 'Browse Collection',
        'services': [
            {'title': 'Ceramics', 'description': 'Hand-thrown pottery and ceramic pieces for your home.'},
            {'title': 'Textiles', 'description': 'Woven, knitted, and sewn goods made with natural fibers.'},
            {'title': 'Custom Orders', 'description': 'Commission a unique piece tailored just for you.'},
        ],
        'stats': [{'value': '2000+', 'label': 'Items Sold'}, {'value': '100%', 'label': 'Handmade'}, {'value': 'Eco', 'label': 'Materials'}, {'value': '5★', 'label': 'Reviews'}],
        'testimonials': [
            {'name': 'Emma T.', 'role': 'Collector', 'quote': 'Each piece is truly unique. Beautiful craftsmanship.', 'rating': 5},
            {'name': 'Noah B.', 'role': 'Gift Buyer', 'quote': 'Perfect gifts that people actually love and keep.', 'rating': 5},
            {'name': 'Sophie M.', 'role': 'Interior Designer', 'quote': 'These pieces add soul to any space. Stunning.', 'rating': 5},
        ],
        'cta_title': 'Find Your Piece',
        'cta_subtitle': 'Browse our collection or commission a custom creation.',
        'features': ['100% Handmade', 'Sustainable Materials', 'Custom Orders', 'Gift Wrapping'],
        'palettes': {
            'Terracotta': {'primary': '#92400e', 'secondary': '#c2410c', 'accent': '#fff7ed'},
            'Sage': {'primary': '#365314', 'secondary': '#84cc16', 'accent': '#f7fee7'},
            'Clay': {'primary': '#78350f', 'secondary': '#d97706', 'accent': '#fffbeb'},
        },
    },
    'digital': {
        'site_titles': {'luxe': 'Luxe Digital', 'vivid': 'ByteForce', 'airy': 'Cloud Store', 'edge': 'DataEdge', 'classic': 'Digital Pro', 'organic': 'Mindful Digital', 'sleek': 'Zero Digital', 'vibrant': 'PixelPop'},
        'hero_title': 'Premium Digital Products',
        'hero_subtitle': 'Templates, courses, and tools to supercharge your workflow.',
        'nav_button': 'Browse Products',
        'services': [
            {'title': 'Templates', 'description': 'Professional templates for design, business, and productivity.'},
            {'title': 'Online Courses', 'description': 'Learn new skills with our comprehensive video courses.'},
            {'title': 'Digital Tools', 'description': 'Software tools and plugins to boost your productivity.'},
        ],
        'stats': [{'value': '5K+', 'label': 'Downloads'}, {'value': '100+', 'label': 'Products'}, {'value': 'Instant', 'label': 'Delivery'}, {'value': '4.9★', 'label': 'Rating'}],
        'testimonials': [
            {'name': 'Taylor H.', 'role': 'Designer', 'quote': 'These templates saved me hours of work. Worth every penny.', 'rating': 5},
            {'name': 'Jordan P.', 'role': 'Developer', 'quote': 'High quality digital tools. Customer support is great too.', 'rating': 5},
            {'name': 'Morgan K.', 'role': 'Entrepreneur', 'quote': 'The courses are excellent. Learned so much.', 'rating': 5},
        ],
        'cta_title': 'Level Up Today',
        'cta_subtitle': 'Instant download after purchase. 30-day money-back guarantee.',
        'features': ['Instant Download', 'Money-Back Guarantee', 'Regular Updates', 'Community Access'],
        'palettes': {
            'Tech': {'primary': '#0f172a', 'secondary': '#06b6d4', 'accent': '#ecfeff'},
            'Neon': {'primary': '#1e1b4b', 'secondary': '#818cf8', 'accent': '#eef2ff'},
            'Cyber': {'primary': '#111827', 'secondary': '#22d3ee', 'accent': '#cffafe'},
        },
    },
    'dropship': {
        'site_titles': {'luxe': 'Premium Drop', 'vivid': 'DropVivid', 'airy': 'Easy Drop', 'edge': 'DropEdge', 'classic': 'Classic Drop', 'organic': 'Natural Drop', 'sleek': 'SlimDrop', 'vibrant': 'DropZone'},
        'hero_title': 'Trending Products',
        'hero_subtitle': 'Discover the latest trending products at unbeatable prices.',
        'nav_button': 'Shop Deals',
        'services': [
            {'title': 'Trending Now', 'description': 'The hottest products everyone is talking about.'},
            {'title': 'Best Value', 'description': 'Premium quality at the most competitive prices.'},
            {'title': 'Flash Sales', 'description': 'Limited-time offers you don\'t want to miss.'},
        ],
        'stats': [{'value': '50K+', 'label': 'Orders Shipped'}, {'value': '1000+', 'label': 'Products'}, {'value': 'Free', 'label': 'Shipping'}, {'value': '4.8★', 'label': 'Trustpilot'}],
        'testimonials': [
            {'name': 'Casey W.', 'role': 'Shopper', 'quote': 'Great prices and my order arrived faster than expected!', 'rating': 5},
            {'name': 'Riley J.', 'role': 'Repeat Customer', 'quote': 'Always finding cool stuff here. Quality is consistent.', 'rating': 5},
            {'name': 'Pat N.', 'role': 'Verified Buyer', 'quote': 'Excellent customer service when I had a question.', 'rating': 5},
        ],
        'cta_title': 'Deals Ending Soon',
        'cta_subtitle': 'Don\'t miss out on our limited-time offers. Free shipping on all orders.',
        'features': ['Free Worldwide Shipping', 'Easy Returns', 'Secure Payment', 'Fast Processing'],
        'palettes': {
            'Deal': {'primary': '#1f2937', 'secondary': '#f59e0b', 'accent': '#fffbeb'},
            'Modern': {'primary': '#0f172a', 'secondary': '#8b5cf6', 'accent': '#f5f3ff'},
            'Pop': {'primary': '#111827', 'secondary': '#ec4899', 'accent': '#fdf2f8'},
        },
    },
    'subscription': {
        'site_titles': {'luxe': 'Luxe Box', 'vivid': 'BoxBurst', 'airy': 'Joy Box', 'edge': 'CrateEdge', 'classic': 'Classic Crate', 'organic': 'Nature Box', 'sleek': 'Curate', 'vibrant': 'UnboxJoy'},
        'hero_title': 'Curated Subscription Boxes',
        'hero_subtitle': 'Discover something new every month. Curated with care, delivered to your door.',
        'nav_button': 'Subscribe Now',
        'services': [
            {'title': 'Monthly Box', 'description': '5-7 curated items delivered to your door every month.'},
            {'title': 'Seasonal Special', 'description': 'Quarterly boxes with seasonal themed products.'},
            {'title': 'Gift Subscriptions', 'description': 'The perfect gift that keeps on giving.'},
        ],
        'stats': [{'value': '3K+', 'label': 'Subscribers'}, {'value': '50+', 'label': 'Boxes Shipped'}, {'value': '5-7', 'label': 'Items/Box'}, {'value': '97%', 'label': 'Love It'}],
        'testimonials': [
            {'name': 'Zoe L.', 'role': 'Subscriber', 'quote': 'The best surprise every month! Always love what I get.', 'rating': 5},
            {'name': 'Matt K.', 'role': '6-Month Subscriber', 'quote': 'Great value and the curation is spot-on.', 'rating': 5},
            {'name': 'Ava R.', 'role': 'Gift Recipient', 'quote': 'Best gift I have ever received. Subscribed myself now!', 'rating': 5},
        ],
        'cta_title': 'Start Your Subscription',
        'cta_subtitle': 'First box ships free. Cancel or skip anytime.',
        'features': ['Free First Box', 'Cancel Anytime', 'Curated Selection', 'Member Perks'],
        'palettes': {
            'Teal Pop': {'primary': '#0f766e', 'secondary': '#f97316', 'accent': '#fff7ed'},
            'Berry': {'primary': '#831843', 'secondary': '#ec4899', 'accent': '#fdf2f8'},
            'Ocean': {'primary': '#0c4a6e', 'secondary': '#06b6d4', 'accent': '#ecfeff'},
        },
    },
}


def build_blocks(style_config, cat_data, business_type):
    """Build the blocks array based on style pattern and category data."""
    blocks = []
    pattern = style_config['blocks_pattern']

    for block_type in pattern:
        if block_type == 'hero':
            blocks.append({
                'type': 'hero',
                'data': {
                    'variant': style_config['hero_variant'],
                    'title': cat_data['hero_title'],
                    'subtitle': cat_data['hero_subtitle'],
                    'buttonText': cat_data['nav_button'],
                }
            })
        elif block_type == 'stats' and style_config.get('stats_variant'):
            blocks.append({
                'type': 'stats',
                'data': {
                    'variant': style_config['stats_variant'],
                    'items': cat_data['stats'],
                }
            })
        elif block_type == 'servicesGrid':
            title = 'Our Services' if business_type == 'services' else 'Our Collection'
            blocks.append({
                'type': 'servicesGrid',
                'data': {
                    'title': title,
                    'subtitle': 'What we offer',
                    'items': cat_data['services'],
                }
            })
        elif block_type == 'testimonials':
            blocks.append({
                'type': 'testimonials',
                'data': {
                    'variant': style_config['testimonials_variant'],
                    'title': 'What Our Customers Say',
                    'items': cat_data['testimonials'],
                }
            })
        elif block_type == 'cta':
            blocks.append({
                'type': 'cta',
                'data': {
                    'title': cat_data['cta_title'],
                    'subtitle': cat_data['cta_subtitle'],
                    'buttonText': cat_data['nav_button'],
                }
            })
        elif block_type == 'aboutImageText':
            blocks.append({
                'type': 'aboutImageText',
                'data': {
                    'title': 'Why Choose Us?',
                    'description': 'We bring years of experience and dedication to every project.',
                    'items': cat_data['features'],
                }
            })
        elif block_type == 'featuresList':
            blocks.append({
                'type': 'featuresList',
                'data': {
                    'title': 'Why Choose Us?',
                    'items': cat_data['features'],
                }
            })
        elif block_type == 'gallery':
            blocks.append({
                'type': 'gallery',
                'data': {
                    'title': 'Our Work',
                    'subtitle': 'Browse our portfolio of recent projects.',
                    'columns': 3,
                }
            })
        elif block_type == 'team':
            blocks.append({
                'type': 'team',
                'data': {
                    'variant': 'grid' if style_config['hero_variant'] == 'fullImage' else 'cards',
                    'title': 'Meet Our Team',
                }
            })
        elif block_type == 'logoCloud':
            blocks.append({
                'type': 'logoCloud',
                'data': {
                    'variant': 'inline',
                    'title': 'Trusted By',
                }
            })
        elif block_type == 'faq':
            blocks.append({
                'type': 'faq',
                'data': {
                    'title': 'Frequently Asked Questions',
                }
            })

    return blocks


def generate_sql():
    lines = []
    lines.append('-- Template Inserts V2 — 8 styles × 17 categories = 136 templates')
    lines.append('-- Generated for the redesigned template system')
    lines.append('')

    all_categories = []

    # Services categories
    for cat_id, cat_data in SERVICES_CATEGORIES.items():
        for style_name, style_config in STYLES.items():
            template_id = f"{style_name}_{cat_id}"
            site_title = cat_data['site_titles'][style_name]
            name = f"{style_name.capitalize()} — {cat_id.replace('_', ' ').title()}"

            blocks = build_blocks(style_config, cat_data, 'services')

            default_content = {
                'siteTitle': site_title,
                'navButtonText': cat_data['nav_button'],
                'titleFont': style_config['titleFont'],
                'bodyFont': style_config['bodyFont'],
                'blocks': blocks,
                'extra_pages': [
                    {
                        'slug': 'booking',
                        'title': 'Book Service',
                        'display_name': 'Book Service',
                        'is_visible_in_nav': True,
                        'blocks': [{'type': 'booking', 'data': {}}],
                    }
                ],
                '__navItems': [
                    {'label': 'Home', 'linkType': 'page', 'pageSlug': 'home'},
                    {'label': 'Book Service', 'linkType': 'page', 'pageSlug': 'booking'},
                ],
            }

            palettes = cat_data['palettes']
            desc = f"{style_name.capitalize()} template for {cat_id} services"

            all_categories.append((template_id, name, desc, cat_id, 'services', palettes, default_content))

    # Products categories
    for cat_id, cat_data in PRODUCTS_CATEGORIES.items():
        for style_name, style_config in STYLES.items():
            template_id = f"{style_name}_{cat_id}"
            site_title = cat_data['site_titles'][style_name]
            name = f"{style_name.capitalize()} — {cat_id.replace('_', ' ').title()}"

            blocks = build_blocks(style_config, cat_data, 'products')

            default_content = {
                'siteTitle': site_title,
                'navButtonText': cat_data['nav_button'],
                'titleFont': style_config['titleFont'],
                'bodyFont': style_config['bodyFont'],
                'blocks': blocks,
                'extra_pages': [
                    {
                        'slug': 'products',
                        'title': 'Shop',
                        'display_name': 'Shop',
                        'is_visible_in_nav': True,
                        'blocks': [{'type': 'productGrid', 'data': {}}],
                    }
                ],
                '__navItems': [
                    {'label': 'Home', 'linkType': 'page', 'pageSlug': 'home'},
                    {'label': 'Shop', 'linkType': 'page', 'pageSlug': 'products'},
                ],
            }

            palettes = cat_data['palettes']
            desc = f"{style_name.capitalize()} template for {cat_id} products"

            all_categories.append((template_id, name, desc, cat_id, 'products', palettes, default_content))

    # Generate SQL
    for template_id, name, desc, category, business_type, palettes, default_content in all_categories:
        palettes_json = json.dumps(palettes).replace("'", "''")
        content_json = json.dumps(default_content).replace("'", "''")
        name_esc = name.replace("'", "''")
        desc_esc = desc.replace("'", "''")

        lines.append(f"INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES")
        lines.append(f"('{template_id}', '{name_esc}', '{desc_esc}', '{category}', '{business_type}',")
        lines.append(f" '{palettes_json}',")
        lines.append(f" '{content_json}',")
        lines.append(f" 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t={template_id}',")
        lines.append(f" true, false, false)")
        lines.append(f"ON CONFLICT (template_id) DO UPDATE SET")
        lines.append(f"  name = EXCLUDED.name,")
        lines.append(f"  description = EXCLUDED.description,")
        lines.append(f"  category = EXCLUDED.category,")
        lines.append(f"  business_type = EXCLUDED.business_type,")
        lines.append(f"  palettes = EXCLUDED.palettes,")
        lines.append(f"  default_content = EXCLUDED.default_content,")
        lines.append(f"  thumbnail_url = EXCLUDED.thumbnail_url,")
        lines.append(f"  multi_page = EXCLUDED.multi_page;")
        lines.append('')

    return '\n'.join(lines)


if __name__ == '__main__':
    sql = generate_sql()
    with open('/home/user/keystoneweb/template_inserts_v2.sql', 'w') as f:
        f.write(sql)
    print(f"Generated {sql.count('INSERT INTO')} template inserts")
