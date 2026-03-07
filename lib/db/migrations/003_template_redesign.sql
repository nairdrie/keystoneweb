-- Migration: Add default_content column and repopulate template_metadata
-- Run this against your database to update templates

-- Step 1: Add default_content column
ALTER TABLE template_metadata ADD COLUMN IF NOT EXISTS default_content jsonb DEFAULT '{}'::jsonb;

-- Step 2: Clear old entries
TRUNCATE template_metadata;

-- Step 3: Insert new templates (3 styles × 15 categories = 45 rows)
-- Format: {style}_{category}

-- ============================================================
-- BOLD TEMPLATE (dark, authoritative — trades/services focused)
-- ============================================================

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url) VALUES
('bold_plumber', 'Bold — Plumbing', 'Dark, authoritative plumbing template', 'plumber', 'services',
 '{"Professional":{"primary":"#0f172a","secondary":"#3b82f6","accent":"#f0f9ff"},"Red Power":{"primary":"#1c1917","secondary":"#dc2626","accent":"#fef2f2"},"Ocean":{"primary":"#0c4a6e","secondary":"#06b6d4","accent":"#ecfeff"}}',
 '{"siteTitle":"Expert Plumbing","navButtonText":"Get Quote","blocks":[{"type":"hero","data":{"variant":"centered","title":"Fast, Reliable Plumbing Services","subtitle":"Licensed & insured plumbers available 24/7 for emergency repairs, installations, and maintenance.","buttonText":"Get a Free Quote"}},{"type":"stats","data":{"variant":"banner","items":[{"value":"500+","label":"Jobs Completed"},{"value":"15+","label":"Years Experience"},{"value":"24/7","label":"Emergency Service"},{"value":"100%","label":"Satisfaction"}]}},{"type":"servicesGrid","data":{"title":"Our Services","items":[{"title":"Pipe Repair","description":"Expert leak detection and pipe repair for residential and commercial properties."},{"title":"Drain Cleaning","description":"Professional drain clearing and maintenance to keep your plumbing flowing."},{"title":"Water Heater","description":"Installation, repair, and replacement of all water heater types."}]}},{"type":"testimonials","data":{"title":"What Our Clients Say","items":[{"name":"Sarah M.","role":"Homeowner","quote":"They fixed our burst pipe in under an hour. Incredible response time!","rating":5},{"name":"James R.","role":"Property Manager","quote":"Reliable, honest pricing, and top-quality work. Highly recommended.","rating":5},{"name":"Lisa K.","role":"Business Owner","quote":"Our go-to plumbers for years. Always professional and thorough.","rating":5}]}},{"type":"faq","data":{"title":"Common Questions","items":[{"question":"Do you offer emergency services?","answer":"Yes! We provide 24/7 emergency plumbing services and can typically arrive within 60 minutes."},{"question":"Are you licensed and insured?","answer":"Absolutely. We are fully licensed, bonded, and insured for your peace of mind."},{"question":"Do you provide free estimates?","answer":"Yes, we offer free no-obligation estimates for all plumbing work."}]}},{"type":"cta","data":{"title":"Need a Plumber Now?","subtitle":"Call us anytime for fast, professional service.","buttonText":"Call (555) 123-4567"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_handyman', 'Bold — Handyman', 'Dark, authoritative handyman template', 'handyman', 'services',
 '{"Professional":{"primary":"#1f2937","secondary":"#dc2626","accent":"#f3f4f6"},"Forest":{"primary":"#15803d","secondary":"#84cc16","accent":"#f7fee7"},"Blue Steel":{"primary":"#0f172a","secondary":"#3b82f6","accent":"#f0f9ff"}}',
 '{"siteTitle":"Reliable Handyman","navButtonText":"Book Now","blocks":[{"type":"hero","data":{"variant":"split","title":"Your Trusted Local Handyman","subtitle":"No job too big or small. Professional repairs, installations, and home improvements.","buttonText":"Schedule Service"}},{"type":"servicesGrid","data":{"title":"What We Fix","items":[{"title":"Home Repairs","description":"Drywall, doors, fixtures, and general home maintenance."},{"title":"Assembly","description":"Furniture assembly, shelving, and mounting services."},{"title":"Painting","description":"Interior and exterior painting for any room or surface."}]}},{"type":"testimonials","data":{"title":"Customer Reviews","items":[{"name":"Mike T.","role":"Homeowner","quote":"Fixed everything on my list in one visit. Fair pricing too!","rating":5},{"name":"Anna P.","role":"Renter","quote":"Quick, clean, and professional. My landlord was impressed!","rating":5}]}},{"type":"cta","data":{"title":"Ready to Get It Fixed?","subtitle":"Book your handyman service today.","buttonText":"Get a Free Estimate"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_electrical', 'Bold — Electrician', 'Dark, authoritative electrical template', 'electrical', 'services',
 '{"Electric":{"primary":"#1f2937","secondary":"#f59e0b","accent":"#fffbeb"},"Tech Blue":{"primary":"#0f172a","secondary":"#3b82f6","accent":"#f0f9ff"},"Purple Volt":{"primary":"#3b0764","secondary":"#a855f7","accent":"#faf5ff"}}',
 '{"siteTitle":"Pro Electric","navButtonText":"Get Quote","blocks":[{"type":"hero","data":{"variant":"centered","title":"Licensed Electrical Services","subtitle":"Safe, reliable electrical work for homes and businesses. Available 24/7.","buttonText":"Request Service"}},{"type":"servicesGrid","data":{"title":"Electrical Services","items":[{"title":"Panel Upgrades","description":"Modern electrical panel installations and upgrades."},{"title":"Wiring & Rewiring","description":"New construction wiring and full home rewiring services."},{"title":"Lighting","description":"LED upgrades, recessed lighting, and outdoor fixtures."}]}},{"type":"stats","data":{"variant":"banner","items":[{"value":"1000+","label":"Projects Done"},{"value":"20+","label":"Years Licensed"},{"value":"24/7","label":"Available"}]}},{"type":"cta","data":{"title":"Electrical Emergency?","subtitle":"Our licensed electricians are ready to help.","buttonText":"Call Now"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_hvac', 'Bold — HVAC', 'Dark, authoritative HVAC template', 'hvac', 'services',
 '{"Cool Blue":{"primary":"#0c4a6e","secondary":"#06b6d4","accent":"#ecfeff"},"Professional":{"primary":"#1f2937","secondary":"#3b82f6","accent":"#f0f9ff"},"Energy":{"primary":"#065f46","secondary":"#10b981","accent":"#ecfdf5"}}',
 '{"siteTitle":"Climate Pro HVAC","navButtonText":"Get Quote","blocks":[{"type":"hero","data":{"variant":"centered","title":"Expert Heating & Cooling","subtitle":"Keep your home comfortable year-round with professional HVAC services.","buttonText":"Schedule Service"}},{"type":"servicesGrid","data":{"title":"Our Services","items":[{"title":"AC Repair","description":"Fast diagnosis and repair for all air conditioning systems."},{"title":"Heating","description":"Furnace repair, installation, and seasonal maintenance."},{"title":"Installation","description":"New HVAC system design and professional installation."}]}},{"type":"cta","data":{"title":"Stay Comfortable","subtitle":"Book your HVAC service today.","buttonText":"Call (555) 123-4567"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_mechanic', 'Bold — Mechanic', 'Dark, authoritative auto mechanic template', 'mechanic', 'services',
 '{"Speed":{"primary":"#1c1917","secondary":"#dc2626","accent":"#fef2f2"},"Steel":{"primary":"#111827","secondary":"#6366f1","accent":"#eef2ff"},"Dark Tech":{"primary":"#0f172a","secondary":"#3b82f6","accent":"#f0f9ff"}}',
 '{"siteTitle":"Auto Pro Garage","navButtonText":"Book Service","blocks":[{"type":"hero","data":{"variant":"centered","title":"Expert Auto Repair","subtitle":"Honest, reliable automotive service for all makes and models.","buttonText":"Book Appointment"}},{"type":"servicesGrid","data":{"title":"Our Services","items":[{"title":"Engine Repair","description":"Complete engine diagnostics, repair, and rebuilds."},{"title":"Brake Service","description":"Brake inspection, pad replacement, and rotor service."},{"title":"Oil & Maintenance","description":"Oil changes, fluid checks, and scheduled maintenance."}]}},{"type":"cta","data":{"title":"Car Trouble?","subtitle":"Drive in or call for fast, honest auto repair.","buttonText":"Call Us Today"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_trades', 'Bold — Trades', 'Dark, authoritative trades template', 'trades', 'services',
 '{"Rustic":{"primary":"#78350f","secondary":"#d97706","accent":"#fef3c7"},"Professional":{"primary":"#1f2937","secondary":"#059669","accent":"#f0fdf4"},"Modern":{"primary":"#0f172a","secondary":"#3b82f6","accent":"#f0f9ff"}}',
 '{"siteTitle":"Master Craftsmen","navButtonText":"Get Quote","blocks":[{"type":"hero","data":{"variant":"split","title":"Quality Craftsmanship","subtitle":"Expert carpentry, welding, and skilled trade services built to last.","buttonText":"Request Estimate"}},{"type":"servicesGrid","data":{"title":"Our Craft","items":[{"title":"Custom Carpentry","description":"Bespoke woodwork, cabinetry, and furniture building."},{"title":"Welding","description":"Structural and decorative welding for any project."},{"title":"Renovation","description":"Complete renovation services from framing to finish."}]}},{"type":"cta","data":{"title":"Start Your Project","subtitle":"Quality work at fair prices.","buttonText":"Contact Us"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_cleaning', 'Bold — Cleaning', 'Dark, authoritative cleaning template', 'cleaning', 'services',
 '{"Fresh":{"primary":"#0e7490","secondary":"#06b6d4","accent":"#ecfeff"},"Clean":{"primary":"#1f2937","secondary":"#14b8a6","accent":"#f0fdfa"},"Sparkle":{"primary":"#6b21a8","secondary":"#d946ef","accent":"#fdf4ff"}}',
 '{"siteTitle":"Spotless Clean","navButtonText":"Book Now","blocks":[{"type":"hero","data":{"variant":"centered","title":"Professional Cleaning Services","subtitle":"Residential and commercial cleaning you can trust.","buttonText":"Get a Free Quote"}},{"type":"servicesGrid","data":{"title":"Our Services","items":[{"title":"House Cleaning","description":"Thorough regular and deep cleaning for your home."},{"title":"Office Cleaning","description":"Professional workspace cleaning and sanitization."},{"title":"Move-In/Out","description":"Complete cleaning for moving transitions."}]}},{"type":"cta","data":{"title":"Ready for a Spotless Space?","subtitle":"Book your cleaning today.","buttonText":"Schedule Cleaning"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_landscaping', 'Bold — Landscaping', 'Dark, authoritative landscaping template', 'landscaping', 'services',
 '{"Nature":{"primary":"#14532d","secondary":"#22c55e","accent":"#f0fdf4"},"Earth":{"primary":"#78350f","secondary":"#d97706","accent":"#fef3c7"},"Garden":{"primary":"#065f46","secondary":"#10b981","accent":"#ecfdf5"}}',
 '{"siteTitle":"Green Scapes","navButtonText":"Free Estimate","blocks":[{"type":"hero","data":{"variant":"split","title":"Beautiful Landscapes","subtitle":"Professional lawn care, garden design, and landscape maintenance.","buttonText":"Get Free Estimate"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Lawn Care","description":"Mowing, fertilization, and seasonal lawn treatments."},{"title":"Garden Design","description":"Custom garden planning and planting services."},{"title":"Hardscaping","description":"Patios, walkways, retaining walls, and outdoor structures."}]}},{"type":"cta","data":{"title":"Transform Your Yard","subtitle":"Free estimates for all landscaping projects.","buttonText":"Call Today"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_consulting', 'Bold — Consulting', 'Dark, authoritative consulting template', 'consulting', 'services',
 '{"Executive":{"primary":"#1e293b","secondary":"#3b82f6","accent":"#f0f9ff"},"Corporate":{"primary":"#1e3a8a","secondary":"#60a5fa","accent":"#eff6ff"},"Modern":{"primary":"#4c1d95","secondary":"#a78bfa","accent":"#f5f3ff"}}',
 '{"siteTitle":"Strategic Partners","navButtonText":"Contact Us","blocks":[{"type":"hero","data":{"variant":"centered","title":"Strategic Business Consulting","subtitle":"Data-driven insights and proven strategies to accelerate your growth.","buttonText":"Schedule Consultation"}},{"type":"servicesGrid","data":{"title":"Expertise","items":[{"title":"Strategy","description":"Business strategy development and market positioning."},{"title":"Operations","description":"Process optimization and operational efficiency."},{"title":"Growth","description":"Revenue growth strategies and market expansion."}]}},{"type":"cta","data":{"title":"Ready to Grow?","subtitle":"Let us help you reach your business goals.","buttonText":"Book a Call"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_freelance', 'Bold — Freelancer', 'Dark, authoritative freelancer template', 'freelance', 'services',
 '{"Creative":{"primary":"#6b21a8","secondary":"#e879f9","accent":"#fdf4ff"},"Modern":{"primary":"#0f172a","secondary":"#06b6d4","accent":"#ecfeff"},"Bold":{"primary":"#1c1917","secondary":"#f97316","accent":"#fff7ed"}}',
 '{"siteTitle":"Creative Pro","navButtonText":"Hire Me","blocks":[{"type":"hero","data":{"variant":"centered","title":"Freelance Creative Professional","subtitle":"Design, development, and creative solutions that deliver results.","buttonText":"View My Work"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Web Design","description":"Beautiful, responsive website design and development."},{"title":"Branding","description":"Logo design, brand identity, and style guides."},{"title":"Strategy","description":"Digital strategy and marketing consultation."}]}},{"type":"cta","data":{"title":"Let''s Work Together","subtitle":"Available for new projects.","buttonText":"Get in Touch"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_salon', 'Bold — Salon', 'Dark, authoritative salon template', 'salon', 'services',
 '{"Luxury":{"primary":"#1f2937","secondary":"#d946ef","accent":"#fdf4ff"},"Elegance":{"primary":"#4a044e","secondary":"#ec4899","accent":"#fdf2f8"},"Chic":{"primary":"#6b21a8","secondary":"#a78bfa","accent":"#f5f3ff"}}',
 '{"siteTitle":"Luxe Salon","navButtonText":"Book Now","blocks":[{"type":"hero","data":{"variant":"centered","title":"Luxury Hair & Beauty","subtitle":"Expert stylists delivering personalized beauty experiences.","buttonText":"Book Appointment"}},{"type":"servicesGrid","data":{"title":"Our Services","items":[{"title":"Hair Styling","description":"Cuts, color, highlights, and special event styling."},{"title":"Nail Care","description":"Manicures, pedicures, and nail art."},{"title":"Spa Treatments","description":"Facials, massages, and relaxation packages."}]}},{"type":"cta","data":{"title":"Treat Yourself","subtitle":"Book your beauty appointment today.","buttonText":"Reserve a Spot"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_fitness', 'Bold — Fitness', 'Dark, authoritative fitness template', 'fitness', 'services',
 '{"Power":{"primary":"#1c1917","secondary":"#ef4444","accent":"#fef2f2"},"Energy":{"primary":"#0f172a","secondary":"#f97316","accent":"#fff7ed"},"Fit":{"primary":"#065f46","secondary":"#10b981","accent":"#ecfdf5"}}',
 '{"siteTitle":"Iron Fitness","navButtonText":"Join Now","blocks":[{"type":"hero","data":{"variant":"centered","title":"Transform Your Body","subtitle":"Personal training, group classes, and nutrition coaching.","buttonText":"Start Free Trial"}},{"type":"servicesGrid","data":{"title":"Programs","items":[{"title":"Personal Training","description":"One-on-one customized fitness programs."},{"title":"Group Classes","description":"High-energy group workouts for all levels."},{"title":"Nutrition","description":"Personalized meal planning and nutrition coaching."}]}},{"type":"cta","data":{"title":"Start Your Journey","subtitle":"First session is free. No commitment required.","buttonText":"Sign Up Free"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_ecommerce', 'Bold — E-Commerce', 'Dark, authoritative e-commerce template', 'ecommerce', 'products',
 '{"Retail":{"primary":"#1f2937","secondary":"#ec4899","accent":"#fdf2f8"},"Bold":{"primary":"#1c1917","secondary":"#f59e0b","accent":"#fffbeb"},"Modern":{"primary":"#0f172a","secondary":"#3b82f6","accent":"#f0f9ff"}}',
 '{"siteTitle":"Premium Shop","navButtonText":"Shop Now","blocks":[{"type":"hero","data":{"variant":"centered","title":"Premium Products","subtitle":"Curated collections of exceptional quality at fair prices.","buttonText":"Browse Collection"}},{"type":"servicesGrid","data":{"title":"Categories","items":[{"title":"New Arrivals","description":"Check out the latest additions to our collection."},{"title":"Best Sellers","description":"Our most popular products loved by customers."},{"title":"Sale","description":"Limited-time deals on selected items."}]}},{"type":"cta","data":{"title":"Join Our Community","subtitle":"Sign up for exclusive offers and early access.","buttonText":"Subscribe"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_digital', 'Bold — Digital Products', 'Dark, authoritative digital products template', 'digital', 'products',
 '{"Tech":{"primary":"#0f172a","secondary":"#06b6d4","accent":"#ecfeff"},"Future":{"primary":"#1e1b4b","secondary":"#818cf8","accent":"#eef2ff"},"Modern":{"primary":"#1f2937","secondary":"#3b82f6","accent":"#f0f9ff"}}',
 '{"siteTitle":"Digital Studio","navButtonText":"Get Started","blocks":[{"type":"hero","data":{"variant":"centered","title":"Digital Products That Deliver","subtitle":"Tools, templates, and resources designed for modern creators.","buttonText":"Explore Products"}},{"type":"servicesGrid","data":{"title":"Products","items":[{"title":"Templates","description":"Professional templates for websites, presentations, and more."},{"title":"Tools","description":"Productivity tools to streamline your workflow."},{"title":"Courses","description":"In-depth courses taught by industry experts."}]}},{"type":"cta","data":{"title":"Ready to Level Up?","subtitle":"Browse our catalog of digital products.","buttonText":"Shop Now"}}]}',
 '/templates/thumbnails/bold.png'),

('bold_agency', 'Bold — Agency', 'Dark, authoritative agency template', 'agency', 'both',
 '{"Professional":{"primary":"#0f172a","secondary":"#3b82f6","accent":"#f0f9ff"},"Creative":{"primary":"#4c1d95","secondary":"#8b5cf6","accent":"#f5f3ff"},"Bold":{"primary":"#1c1917","secondary":"#f97316","accent":"#fff7ed"}}',
 '{"siteTitle":"Agency Co.","navButtonText":"Start Project","blocks":[{"type":"hero","data":{"variant":"centered","title":"We Build Brands","subtitle":"Full-service creative agency specializing in branding, design, and digital marketing.","buttonText":"See Our Work"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Branding","description":"Brand strategy, identity design, and guidelines."},{"title":"Design","description":"Web design, UI/UX, and creative campaigns."},{"title":"Marketing","description":"Digital marketing, SEO, and social media management."}]}},{"type":"cta","data":{"title":"Let''s Create Something Great","subtitle":"Tell us about your project.","buttonText":"Contact Us"}}]}',
 '/templates/thumbnails/bold.png');

-- ============================================================
-- ELEGANT TEMPLATE (frosted glass, premium — salons/agencies)
-- ============================================================

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url) VALUES
('elegant_plumber', 'Elegant — Plumbing', 'Premium plumbing template', 'plumber', 'services',
 '{"Ocean":{"primary":"#0369a1","secondary":"#06b6d4","accent":"#f0f9ff"},"Slate":{"primary":"#475569","secondary":"#64748b","accent":"#f8fafc"},"Navy":{"primary":"#1e3a8a","secondary":"#3b82f6","accent":"#eff6ff"}}',
 '{"siteTitle":"AquaFlow Plumbing","navButtonText":"Book Online","blocks":[{"type":"hero","data":{"variant":"split","title":"Modern Plumbing Solutions","subtitle":"Bringing precision and care to every plumbing project.","buttonText":"Book Service"}},{"type":"servicesGrid","data":{"title":"What We Offer","items":[{"title":"Residential","description":"Complete home plumbing services and renovations."},{"title":"Commercial","description":"Business plumbing solutions and maintenance contracts."},{"title":"Emergency","description":"24/7 rapid response for plumbing emergencies."}]}},{"type":"testimonials","data":{"title":"Client Experiences","items":[{"name":"David L.","role":"Homeowner","quote":"Elegant, professional service from start to finish.","rating":5},{"name":"Rachel S.","role":"Interior Designer","quote":"Our go-to plumbing partner for renovation projects.","rating":5}]}},{"type":"cta","data":{"title":"Experience Better Plumbing","subtitle":"Book your appointment online in minutes.","buttonText":"Schedule Now"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_handyman', 'Elegant — Handyman', 'Premium handyman template', 'handyman', 'services',
 '{"Professional":{"primary":"#374151","secondary":"#6366f1","accent":"#eef2ff"},"Warm":{"primary":"#78350f","secondary":"#f59e0b","accent":"#fffbeb"},"Modern":{"primary":"#0369a1","secondary":"#06b6d4","accent":"#ecfeff"}}',
 '{"siteTitle":"Precision Home","navButtonText":"Get Estimate","blocks":[{"type":"hero","data":{"variant":"split","title":"Premium Home Services","subtitle":"Expert handyman services with attention to detail.","buttonText":"Request Estimate"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Repairs","description":"Expert home repair for every room."},{"title":"Installation","description":"Professional mounting, assembly, and setup."},{"title":"Renovation","description":"Small to medium home improvement projects."}]}},{"type":"cta","data":{"title":"Elevate Your Home","subtitle":"Professional service, guaranteed satisfaction.","buttonText":"Contact Us"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_electrical', 'Elegant — Electrician', 'Premium electrical template', 'electrical', 'services',
 '{"Electric":{"primary":"#7c3aed","secondary":"#f59e0b","accent":"#fffbeb"},"Tech":{"primary":"#0369a1","secondary":"#06b6d4","accent":"#ecfeff"},"Industrial":{"primary":"#374151","secondary":"#f59e0b","accent":"#fffbeb"}}',
 '{"siteTitle":"Volt Electric","navButtonText":"Get Quote","blocks":[{"type":"hero","data":{"variant":"split","title":"Modern Electrical Solutions","subtitle":"Safe, efficient electrical services for modern living.","buttonText":"Request Quote"}},{"type":"servicesGrid","data":{"title":"Expertise","items":[{"title":"Smart Home","description":"Automation, smart lighting, and connected systems."},{"title":"Electrical Safety","description":"Inspections, grounding, and code compliance."},{"title":"Commercial","description":"Business electrical design and installation."}]}},{"type":"cta","data":{"title":"Power Up Your Space","subtitle":"Licensed electricians ready to help.","buttonText":"Schedule Service"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_hvac', 'Elegant — HVAC', 'Premium HVAC template', 'hvac', 'services',
 '{"Cool":{"primary":"#0369a1","secondary":"#06b6d4","accent":"#ecfeff"},"Green":{"primary":"#065f46","secondary":"#10b981","accent":"#ecfdf5"},"Pro":{"primary":"#374151","secondary":"#60a5fa","accent":"#eff6ff"}}',
 '{"siteTitle":"Climate Comfort","navButtonText":"Schedule","blocks":[{"type":"hero","data":{"variant":"split","title":"Premium Climate Control","subtitle":"Energy-efficient heating and cooling solutions for your comfort.","buttonText":"Get Estimate"}},{"type":"servicesGrid","data":{"title":"Solutions","items":[{"title":"Smart Thermostats","description":"Intelligent climate control for maximum efficiency."},{"title":"System Design","description":"Custom HVAC solutions for any space."},{"title":"Maintenance Plans","description":"Preventive care to extend system life."}]}},{"type":"cta","data":{"title":"Upgrade Your Comfort","subtitle":"Energy-efficient solutions that save money.","buttonText":"Learn More"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_mechanic', 'Elegant — Mechanic', 'Premium auto mechanic template', 'mechanic', 'services',
 '{"Steel":{"primary":"#374151","secondary":"#6366f1","accent":"#eef2ff"},"Speed":{"primary":"#991b1b","secondary":"#f97316","accent":"#fff7ed"},"Dark":{"primary":"#1f2937","secondary":"#3b82f6","accent":"#f0f9ff"}}',
 '{"siteTitle":"Precision Auto","navButtonText":"Book Now","blocks":[{"type":"hero","data":{"variant":"split","title":"Precision Auto Care","subtitle":"Expert diagnostics and repair with transparent pricing.","buttonText":"Schedule Service"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Diagnostics","description":"State-of-the-art computer diagnostics."},{"title":"Full Service","description":"Complete automotive maintenance and repair."},{"title":"Performance","description":"Upgrades and performance tuning."}]}},{"type":"cta","data":{"title":"Drive With Confidence","subtitle":"Book your service appointment today.","buttonText":"Get Started"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_trades', 'Elegant — Trades', 'Premium trades template', 'trades', 'services',
 '{"Craft":{"primary":"#78350f","secondary":"#d97706","accent":"#fef3c7"},"Modern":{"primary":"#0369a1","secondary":"#06b6d4","accent":"#ecfeff"},"Pro":{"primary":"#374151","secondary":"#059669","accent":"#f0fdf4"}}',
 '{"siteTitle":"Artisan Works","navButtonText":"Get Quote","blocks":[{"type":"hero","data":{"variant":"split","title":"Artisan Craftsmanship","subtitle":"Bespoke woodwork, metalwork, and skilled trades.","buttonText":"View Portfolio"}},{"type":"gallery","data":{"title":"Our Portfolio","subtitle":"Recent projects showcasing our craftsmanship."}},{"type":"cta","data":{"title":"Commission Your Project","subtitle":"Every piece crafted with care and precision.","buttonText":"Request Quote"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_cleaning', 'Elegant — Cleaning', 'Premium cleaning template', 'cleaning', 'services',
 '{"Fresh":{"primary":"#0891b2","secondary":"#06b6d4","accent":"#ecfeff"},"Pure":{"primary":"#374151","secondary":"#14b8a6","accent":"#f0fdfa"},"Lavender":{"primary":"#6b21a8","secondary":"#c084fc","accent":"#faf5ff"}}',
 '{"siteTitle":"Crystal Clean","navButtonText":"Book","blocks":[{"type":"hero","data":{"variant":"split","title":"Premium Cleaning Service","subtitle":"Immaculate results with eco-friendly products.","buttonText":"Book Online"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Deep Clean","description":"Thorough top-to-bottom cleaning."},{"title":"Regular Service","description":"Scheduled weekly or bi-weekly visits."},{"title":"Eco-Friendly","description":"Green cleaning with safe products."}]}},{"type":"cta","data":{"title":"A Cleaner Space Awaits","subtitle":"Book your first cleaning today.","buttonText":"Get Started"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_landscaping', 'Elegant — Landscaping', 'Premium landscaping template', 'landscaping', 'services',
 '{"Garden":{"primary":"#065f46","secondary":"#10b981","accent":"#ecfdf5"},"Nature":{"primary":"#15803d","secondary":"#84cc16","accent":"#f7fee7"},"Earth":{"primary":"#78350f","secondary":"#d97706","accent":"#fef3c7"}}',
 '{"siteTitle":"Eden Gardens","navButtonText":"Consult","blocks":[{"type":"hero","data":{"variant":"split","title":"Landscape Architecture","subtitle":"Designing beautiful outdoor living spaces.","buttonText":"Free Consultation"}},{"type":"gallery","data":{"title":"Featured Projects","subtitle":"Transformations that inspire."}},{"type":"cta","data":{"title":"Design Your Dream Garden","subtitle":"Schedule a free landscape consultation.","buttonText":"Book Consultation"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_consulting', 'Elegant — Consulting', 'Premium consulting template', 'consulting', 'services',
 '{"Corporate":{"primary":"#1e3a8a","secondary":"#60a5fa","accent":"#eff6ff"},"Executive":{"primary":"#374151","secondary":"#3b82f6","accent":"#f0f9ff"},"Purple":{"primary":"#5b21b6","secondary":"#a78bfa","accent":"#f5f3ff"}}',
 '{"siteTitle":"Apex Consulting","navButtonText":"Book Call","blocks":[{"type":"hero","data":{"variant":"centered","title":"Strategic Growth Partners","subtitle":"Helping businesses scale with data-driven strategy and expert insight.","buttonText":"Schedule Call"}},{"type":"stats","data":{"variant":"cards","items":[{"value":"$50M+","label":"Revenue Generated"},{"value":"200+","label":"Clients Served"},{"value":"95%","label":"Client Retention"}]}},{"type":"cta","data":{"title":"Accelerate Your Growth","subtitle":"Book a free strategy session.","buttonText":"Get Started"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_freelance', 'Elegant — Freelancer', 'Premium freelancer template', 'freelance', 'services',
 '{"Creative":{"primary":"#6b21a8","secondary":"#ec4899","accent":"#fdf2f8"},"Modern":{"primary":"#0369a1","secondary":"#06b6d4","accent":"#ecfeff"},"Warm":{"primary":"#92400e","secondary":"#f97316","accent":"#fff7ed"}}',
 '{"siteTitle":"Creative Studio","navButtonText":"Hire Me","blocks":[{"type":"hero","data":{"variant":"split","title":"Creative Solutions","subtitle":"Bringing ideas to life through design and technology.","buttonText":"See My Work"}},{"type":"gallery","data":{"title":"Portfolio","subtitle":"Selected works and case studies."}},{"type":"cta","data":{"title":"Let''s Collaborate","subtitle":"Open for freelance projects.","buttonText":"Get in Touch"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_salon', 'Elegant — Salon', 'Premium salon template', 'salon', 'services',
 '{"Luxury":{"primary":"#6b21a8","secondary":"#d946ef","accent":"#fdf4ff"},"Rose":{"primary":"#9f1239","secondary":"#fb7185","accent":"#fff1f2"},"Chic":{"primary":"#374151","secondary":"#a78bfa","accent":"#f5f3ff"}}',
 '{"siteTitle":"Luxe Beauty","navButtonText":"Book Now","blocks":[{"type":"hero","data":{"variant":"centered","title":"Luxury Beauty Experience","subtitle":"Where artistry meets self-care. Premium hair, nail, and spa services.","buttonText":"Book Appointment"}},{"type":"servicesGrid","data":{"title":"Treatments","items":[{"title":"Hair","description":"Precision cuts, color, and styling."},{"title":"Nails","description":"Manicures, pedicures, and nail art."},{"title":"Wellness","description":"Facials, massages, and body treatments."}]}},{"type":"testimonials","data":{"title":"Client Love","items":[{"name":"Emma W.","role":"Regular Client","quote":"The best salon experience. Always leave feeling amazing!","rating":5},{"name":"Sophie L.","role":"Bride","quote":"Made my wedding day hair absolutely perfect.","rating":5}]}},{"type":"cta","data":{"title":"You Deserve This","subtitle":"Book your pampering session today.","buttonText":"Reserve Now"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_fitness', 'Elegant — Fitness', 'Premium fitness template', 'fitness', 'services',
 '{"Energy":{"primary":"#dc2626","secondary":"#f97316","accent":"#fff7ed"},"Zen":{"primary":"#065f46","secondary":"#10b981","accent":"#ecfdf5"},"Power":{"primary":"#1f2937","secondary":"#8b5cf6","accent":"#f5f3ff"}}',
 '{"siteTitle":"Elevate Fitness","navButtonText":"Join","blocks":[{"type":"hero","data":{"variant":"centered","title":"Elevate Your Fitness","subtitle":"Premium personal training and wellness coaching.","buttonText":"Start Your Journey"}},{"type":"stats","data":{"variant":"cards","items":[{"value":"500+","label":"Members"},{"value":"15+","label":"Certified Trainers"},{"value":"50+","label":"Weekly Classes"}]}},{"type":"cta","data":{"title":"Your Transformation Starts Here","subtitle":"First week free for new members.","buttonText":"Claim Free Week"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_ecommerce', 'Elegant — E-Commerce', 'Premium e-commerce template', 'ecommerce', 'products',
 '{"Luxury":{"primary":"#1f2937","secondary":"#d97706","accent":"#fffbeb"},"Modern":{"primary":"#0369a1","secondary":"#06b6d4","accent":"#ecfeff"},"Rose":{"primary":"#9f1239","secondary":"#fb7185","accent":"#fff1f2"}}',
 '{"siteTitle":"Curated","navButtonText":"Shop","blocks":[{"type":"hero","data":{"variant":"split","title":"Curated Collections","subtitle":"Handpicked products for the discerning customer.","buttonText":"Shop Now"}},{"type":"servicesGrid","data":{"title":"Collections","items":[{"title":"New Season","description":"Fresh arrivals for this season."},{"title":"Bestsellers","description":"Customer favorites and top picks."},{"title":"Exclusive","description":"Limited edition and premium selections."}]}},{"type":"cta","data":{"title":"Join the Club","subtitle":"Members get early access and exclusive deals.","buttonText":"Sign Up"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_digital', 'Elegant — Digital', 'Premium digital products template', 'digital', 'products',
 '{"Tech":{"primary":"#0369a1","secondary":"#06b6d4","accent":"#ecfeff"},"Purple":{"primary":"#5b21b6","secondary":"#8b5cf6","accent":"#f5f3ff"},"Modern":{"primary":"#374151","secondary":"#3b82f6","accent":"#f0f9ff"}}',
 '{"siteTitle":"Digital Lab","navButtonText":"Browse","blocks":[{"type":"hero","data":{"variant":"split","title":"Digital Products","subtitle":"Premium tools and resources for modern creators.","buttonText":"Explore Catalog"}},{"type":"servicesGrid","data":{"title":"Products","items":[{"title":"Design Assets","description":"Professional templates and design resources."},{"title":"Development Tools","description":"Code snippets, libraries, and frameworks."},{"title":"Online Courses","description":"Expert-led courses and tutorials."}]}},{"type":"cta","data":{"title":"Create Something Amazing","subtitle":"Get the tools you need.","buttonText":"Get Started"}}]}',
 '/templates/thumbnails/elegant.png'),

('elegant_agency', 'Elegant — Agency', 'Premium agency template', 'agency', 'both',
 '{"Modern":{"primary":"#0369a1","secondary":"#06b6d4","accent":"#ecfeff"},"Creative":{"primary":"#6b21a8","secondary":"#a78bfa","accent":"#f5f3ff"},"Warm":{"primary":"#92400e","secondary":"#d97706","accent":"#fef3c7"}}',
 '{"siteTitle":"Nova Agency","navButtonText":"Let''s Talk","blocks":[{"type":"hero","data":{"variant":"centered","title":"Creative Agency","subtitle":"We craft digital experiences that inspire and convert.","buttonText":"View Our Work"}},{"type":"stats","data":{"variant":"cards","items":[{"value":"100+","label":"Projects"},{"value":"50+","label":"Clients"},{"value":"8+","label":"Years"}]}},{"type":"cta","data":{"title":"Start Your Project","subtitle":"Let''s bring your vision to life.","buttonText":"Contact Us"}}]}',
 '/templates/thumbnails/elegant.png');

-- ============================================================
-- STARTER TEMPLATE (clean, minimal — freelancers/portfolios)
-- ============================================================

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url) VALUES
('starter_plumber', 'Starter — Plumbing', 'Clean plumbing template', 'plumber', 'services',
 '{"Clean":{"primary":"#374151","secondary":"#0ea5e9","accent":"#ffffff"},"Navy":{"primary":"#1e3a8a","secondary":"#60a5fa","accent":"#f8fafc"},"Green":{"primary":"#065f46","secondary":"#34d399","accent":"#ffffff"}}',
 '{"siteTitle":"Local Plumbing","navButtonText":"Call Us","blocks":[{"type":"hero","data":{"variant":"split","title":"Honest Plumbing Service","subtitle":"Simple, reliable plumbing for your home.","buttonText":"Get a Quote"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Repairs","description":"Quick fixes and leak repair."},{"title":"Installation","description":"Fixtures and appliance hookups."},{"title":"Maintenance","description":"Preventive care and inspections."}]}},{"type":"contact","data":{"title":"Contact Us"}},{"type":"cta","data":{"title":"Need Help?","subtitle":"We are just a phone call away.","buttonText":"Call Now"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_handyman', 'Starter — Handyman', 'Clean handyman template', 'handyman', 'services',
 '{"Warm":{"primary":"#374151","secondary":"#f59e0b","accent":"#ffffff"},"Green":{"primary":"#166534","secondary":"#4ade80","accent":"#f8fafc"},"Blue":{"primary":"#1e40af","secondary":"#60a5fa","accent":"#ffffff"}}',
 '{"siteTitle":"Handy Helper","navButtonText":"Book","blocks":[{"type":"hero","data":{"variant":"split","title":"Reliable Home Repairs","subtitle":"Your neighborhood handyman for every job.","buttonText":"Get Estimate"}},{"type":"servicesGrid","data":{"title":"What I Fix","items":[{"title":"Small Repairs","description":"Leaky faucets, squeaky doors, and more."},{"title":"Assembly","description":"Furniture and fixture assembly."},{"title":"Odd Jobs","description":"Whatever you need done around the house."}]}},{"type":"contact","data":{"title":"Get In Touch"}},{"type":"cta","data":{"title":"Let Me Help","subtitle":"No job too small.","buttonText":"Contact Me"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_electrical', 'Starter — Electrician', 'Clean electrical template', 'electrical', 'services',
 '{"Electric":{"primary":"#374151","secondary":"#eab308","accent":"#ffffff"},"Blue":{"primary":"#1e40af","secondary":"#38bdf8","accent":"#f8fafc"},"Dark":{"primary":"#1f2937","secondary":"#a78bfa","accent":"#ffffff"}}',
 '{"siteTitle":"Spark Electric","navButtonText":"Call","blocks":[{"type":"hero","data":{"variant":"split","title":"Safe, Reliable Electrical","subtitle":"Licensed electrician for homes and businesses.","buttonText":"Get a Quote"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Repairs","description":"Outlet, switch, and wiring repairs."},{"title":"Upgrades","description":"Panel and circuit upgrades."},{"title":"New Install","description":"Lighting and fixture installations."}]}},{"type":"cta","data":{"title":"Need an Electrician?","subtitle":"Licensed and insured.","buttonText":"Call Today"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_hvac', 'Starter — HVAC', 'Clean HVAC template', 'hvac', 'services',
 '{"Cool":{"primary":"#374151","secondary":"#06b6d4","accent":"#ffffff"},"Green":{"primary":"#065f46","secondary":"#34d399","accent":"#f8fafc"},"Blue":{"primary":"#1e40af","secondary":"#60a5fa","accent":"#ffffff"}}',
 '{"siteTitle":"Cool Air HVAC","navButtonText":"Call","blocks":[{"type":"hero","data":{"variant":"split","title":"Heating & Cooling","subtitle":"Keeping homes comfortable year-round.","buttonText":"Schedule Service"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"AC Service","description":"Repair and maintenance for cooling systems."},{"title":"Heating","description":"Furnace and heat pump services."},{"title":"Duct Work","description":"Cleaning and duct installation."}]}},{"type":"cta","data":{"title":"Stay Comfortable","subtitle":"Call for a free estimate.","buttonText":"Get Estimate"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_mechanic', 'Starter — Mechanic', 'Clean auto mechanic template', 'mechanic', 'services',
 '{"Auto":{"primary":"#374151","secondary":"#ef4444","accent":"#ffffff"},"Steel":{"primary":"#1f2937","secondary":"#94a3b8","accent":"#f8fafc"},"Speed":{"primary":"#7f1d1d","secondary":"#f97316","accent":"#ffffff"}}',
 '{"siteTitle":"Quick Fix Auto","navButtonText":"Book","blocks":[{"type":"hero","data":{"variant":"split","title":"Honest Auto Repair","subtitle":"Fair prices and quality work you can trust.","buttonText":"Book Service"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Oil Change","description":"Quick oil and filter changes."},{"title":"Brakes","description":"Brake inspection and repair."},{"title":"Tune-Up","description":"Full vehicle inspections."}]}},{"type":"cta","data":{"title":"Time for Service?","subtitle":"Walk-ins welcome.","buttonText":"Call Us"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_trades', 'Starter — Trades', 'Clean trades template', 'trades', 'services',
 '{"Craft":{"primary":"#78350f","secondary":"#b45309","accent":"#ffffff"},"Modern":{"primary":"#374151","secondary":"#059669","accent":"#f8fafc"},"Blue":{"primary":"#1e40af","secondary":"#3b82f6","accent":"#ffffff"}}',
 '{"siteTitle":"Skilled Trades","navButtonText":"Quote","blocks":[{"type":"hero","data":{"variant":"split","title":"Skilled Craftsmanship","subtitle":"Quality work built to last.","buttonText":"Get Quote"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Carpentry","description":"Custom woodwork and construction."},{"title":"Welding","description":"Fabrication and repair."},{"title":"General","description":"Skilled trade services."}]}},{"type":"cta","data":{"title":"Start Your Project","subtitle":"Free estimates available.","buttonText":"Contact Us"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_cleaning', 'Starter — Cleaning', 'Clean cleaning template', 'cleaning', 'services',
 '{"Fresh":{"primary":"#374151","secondary":"#14b8a6","accent":"#ffffff"},"Blue":{"primary":"#0e7490","secondary":"#22d3ee","accent":"#f8fafc"},"Lavender":{"primary":"#6b21a8","secondary":"#c084fc","accent":"#ffffff"}}',
 '{"siteTitle":"Fresh Clean Co","navButtonText":"Book","blocks":[{"type":"hero","data":{"variant":"split","title":"Sparkling Clean Spaces","subtitle":"Professional cleaning services for homes and offices.","buttonText":"Book Cleaning"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Home","description":"Regular and deep house cleaning."},{"title":"Office","description":"Commercial cleaning services."},{"title":"Special","description":"Move-in/out and event cleaning."}]}},{"type":"cta","data":{"title":"Book Your Clean","subtitle":"First cleaning 20% off.","buttonText":"Get Started"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_landscaping', 'Starter — Landscaping', 'Clean landscaping template', 'landscaping', 'services',
 '{"Green":{"primary":"#166534","secondary":"#4ade80","accent":"#ffffff"},"Earth":{"primary":"#78350f","secondary":"#a3e635","accent":"#f8fafc"},"Nature":{"primary":"#374151","secondary":"#22c55e","accent":"#ffffff"}}',
 '{"siteTitle":"Green Thumb","navButtonText":"Estimate","blocks":[{"type":"hero","data":{"variant":"split","title":"Beautiful Landscapes","subtitle":"Lawn care and garden services.","buttonText":"Free Estimate"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Mowing","description":"Regular lawn mowing service."},{"title":"Planting","description":"Flower beds and garden design."},{"title":"Clean-Up","description":"Seasonal yard clean-up."}]}},{"type":"cta","data":{"title":"Love Your Yard","subtitle":"Free estimates for all projects.","buttonText":"Call Today"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_consulting', 'Starter — Consulting', 'Clean consulting template', 'consulting', 'services',
 '{"Pro":{"primary":"#374151","secondary":"#3b82f6","accent":"#ffffff"},"Executive":{"primary":"#1e3a8a","secondary":"#818cf8","accent":"#f8fafc"},"Warm":{"primary":"#78350f","secondary":"#f59e0b","accent":"#ffffff"}}',
 '{"siteTitle":"Clarity Consulting","navButtonText":"Talk to Us","blocks":[{"type":"hero","data":{"variant":"centered","title":"Business Consulting","subtitle":"Clear strategy for sustainable growth.","buttonText":"Book Consultation"}},{"type":"servicesGrid","data":{"title":"How We Help","items":[{"title":"Strategy","description":"Business planning and positioning."},{"title":"Growth","description":"Revenue and market expansion."},{"title":"Ops","description":"Efficiency and process improvement."}]}},{"type":"cta","data":{"title":"Let''s Talk Strategy","subtitle":"Free 30-minute discovery call.","buttonText":"Schedule Call"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_freelance', 'Starter — Freelancer', 'Clean freelancer template', 'freelance', 'services',
 '{"Creative":{"primary":"#6b21a8","secondary":"#e879f9","accent":"#ffffff"},"Modern":{"primary":"#374151","secondary":"#06b6d4","accent":"#f8fafc"},"Warm":{"primary":"#92400e","secondary":"#fb923c","accent":"#ffffff"}}',
 '{"siteTitle":"My Portfolio","navButtonText":"Contact","blocks":[{"type":"hero","data":{"variant":"centered","title":"Hi, I''m a Freelancer","subtitle":"Design and development for the modern web.","buttonText":"See My Work"}},{"type":"gallery","data":{"title":"Selected Work","subtitle":"Recent projects and case studies."}},{"type":"contact","data":{"title":"Let''s Connect"}},{"type":"cta","data":{"title":"Available for Projects","subtitle":"Let''s make something great together.","buttonText":"Hire Me"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_salon', 'Starter — Salon', 'Clean salon template', 'salon', 'services',
 '{"Pink":{"primary":"#9f1239","secondary":"#fb7185","accent":"#ffffff"},"Purple":{"primary":"#6b21a8","secondary":"#c084fc","accent":"#faf5ff"},"Neutral":{"primary":"#374151","secondary":"#f472b6","accent":"#ffffff"}}',
 '{"siteTitle":"Beauty Studio","navButtonText":"Book","blocks":[{"type":"hero","data":{"variant":"split","title":"Your Beauty Destination","subtitle":"Hair, nails, and spa services.","buttonText":"Book Today"}},{"type":"servicesGrid","data":{"title":"Services","items":[{"title":"Hair","description":"Cuts, color, and styling."},{"title":"Nails","description":"Manicures and pedicures."},{"title":"Spa","description":"Facials and relaxation."}]}},{"type":"cta","data":{"title":"Pamper Yourself","subtitle":"Online booking available.","buttonText":"Book Now"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_fitness', 'Starter — Fitness', 'Clean fitness template', 'fitness', 'services',
 '{"Energy":{"primary":"#374151","secondary":"#ef4444","accent":"#ffffff"},"Green":{"primary":"#065f46","secondary":"#34d399","accent":"#f8fafc"},"Purple":{"primary":"#5b21b6","secondary":"#a78bfa","accent":"#ffffff"}}',
 '{"siteTitle":"FitLife","navButtonText":"Join","blocks":[{"type":"hero","data":{"variant":"centered","title":"Get Fit, Stay Strong","subtitle":"Personal training and fitness coaching.","buttonText":"Start Free Trial"}},{"type":"servicesGrid","data":{"title":"Programs","items":[{"title":"Training","description":"1-on-1 personal training."},{"title":"Classes","description":"Group fitness classes."},{"title":"Nutrition","description":"Meal planning guidance."}]}},{"type":"cta","data":{"title":"First Session Free","subtitle":"No commitment, no pressure.","buttonText":"Sign Up"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_ecommerce', 'Starter — E-Commerce', 'Clean e-commerce template', 'ecommerce', 'products',
 '{"Shop":{"primary":"#374151","secondary":"#f59e0b","accent":"#ffffff"},"Modern":{"primary":"#1f2937","secondary":"#06b6d4","accent":"#f8fafc"},"Rose":{"primary":"#9f1239","secondary":"#fb7185","accent":"#ffffff"}}',
 '{"siteTitle":"The Shop","navButtonText":"Shop","blocks":[{"type":"hero","data":{"variant":"split","title":"Quality Products","subtitle":"Simple, honest products at fair prices.","buttonText":"Browse Products"}},{"type":"servicesGrid","data":{"title":"Categories","items":[{"title":"New","description":"Latest arrivals."},{"title":"Popular","description":"Best sellers."},{"title":"Deals","description":"Current promotions."}]}},{"type":"cta","data":{"title":"Stay Updated","subtitle":"Get notified about new products.","buttonText":"Subscribe"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_digital', 'Starter — Digital', 'Clean digital products template', 'digital', 'products',
 '{"Tech":{"primary":"#374151","secondary":"#06b6d4","accent":"#ffffff"},"Purple":{"primary":"#5b21b6","secondary":"#818cf8","accent":"#f8fafc"},"Modern":{"primary":"#1f2937","secondary":"#3b82f6","accent":"#ffffff"}}',
 '{"siteTitle":"Digital Store","navButtonText":"Browse","blocks":[{"type":"hero","data":{"variant":"centered","title":"Digital Resources","subtitle":"Templates, tools, and tutorials.","buttonText":"Explore"}},{"type":"servicesGrid","data":{"title":"Products","items":[{"title":"Templates","description":"Ready-to-use templates."},{"title":"Tools","description":"Productivity tools."},{"title":"Guides","description":"How-to resources."}]}},{"type":"cta","data":{"title":"Start Creating","subtitle":"Everything you need in one place.","buttonText":"Get Started"}}]}',
 '/templates/thumbnails/starter.png'),

('starter_agency', 'Starter — Agency', 'Clean agency template', 'agency', 'both',
 '{"Pro":{"primary":"#374151","secondary":"#3b82f6","accent":"#ffffff"},"Creative":{"primary":"#6b21a8","secondary":"#a78bfa","accent":"#f8fafc"},"Warm":{"primary":"#92400e","secondary":"#f97316","accent":"#ffffff"}}',
 '{"siteTitle":"Studio","navButtonText":"Contact","blocks":[{"type":"hero","data":{"variant":"centered","title":"Creative Studio","subtitle":"Design, branding, and digital solutions.","buttonText":"Our Work"}},{"type":"gallery","data":{"title":"Work","subtitle":"Selected projects."}},{"type":"cta","data":{"title":"Start a Project","subtitle":"Let''s create something together.","buttonText":"Say Hello"}}]}',
 '/templates/thumbnails/starter.png');
