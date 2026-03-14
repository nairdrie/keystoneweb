-- Template Inserts V2 — 8 styles × 17 categories = 136 templates
-- Generated for the redesigned template system

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_handyman', 'Luxe — Handyman', 'Luxe template for handyman services', 'handyman', 'services',
 '{"Warm Pro": {"primary": "#78350f", "secondary": "#ea580c", "accent": "#fff7ed"}, "Cool Steel": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}, "Forest": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}}',
 '{"siteTitle": "Premier Handyman", "navButtonText": "Get Quote", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Expert Handyman Services", "subtitle": "From small fixes to major repairs, we handle it all with precision and care.", "buttonText": "Get Quote"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "General Repairs", "description": "Door hinges, drywall patches, furniture assembly, and more."}, {"title": "Painting & Finishing", "description": "Interior and exterior painting with premium materials."}, {"title": "Home Maintenance", "description": "Regular upkeep to keep your home in perfect condition."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed & Insured", "100% Satisfaction Guarantee", "Upfront Pricing", "Same-Day Service Available"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Sarah M.", "role": "Homeowner", "quote": "Fixed everything in one visit! Professional and efficient.", "rating": 5}, {"name": "James R.", "role": "Property Manager", "quote": "Reliable and always does quality work. Highly recommended.", "rating": 5}, {"name": "Lisa K.", "role": "Business Owner", "quote": "Fair pricing and excellent craftsmanship every time.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Need Something Fixed?", "subtitle": "Contact us today for a free estimate on any repair or maintenance project.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_handyman',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_handyman', 'Vivid — Handyman', 'Vivid template for handyman services', 'handyman', 'services',
 '{"Warm Pro": {"primary": "#78350f", "secondary": "#ea580c", "accent": "#fff7ed"}, "Cool Steel": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}, "Forest": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}}',
 '{"siteTitle": "FixIt Pro", "navButtonText": "Get Quote", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Expert Handyman Services", "subtitle": "From small fixes to major repairs, we handle it all with precision and care.", "buttonText": "Get Quote"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "500+", "label": "Jobs Done"}, {"value": "15+", "label": "Years Experience"}, {"value": "24/7", "label": "Availability"}, {"value": "100%", "label": "Satisfaction"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "General Repairs", "description": "Door hinges, drywall patches, furniture assembly, and more."}, {"title": "Painting & Finishing", "description": "Interior and exterior painting with premium materials."}, {"title": "Home Maintenance", "description": "Regular upkeep to keep your home in perfect condition."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Sarah M.", "role": "Homeowner", "quote": "Fixed everything in one visit! Professional and efficient.", "rating": 5}, {"name": "James R.", "role": "Property Manager", "quote": "Reliable and always does quality work. Highly recommended.", "rating": 5}, {"name": "Lisa K.", "role": "Business Owner", "quote": "Fair pricing and excellent craftsmanship every time.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Need Something Fixed?", "subtitle": "Contact us today for a free estimate on any repair or maintenance project.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_handyman',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_handyman', 'Airy — Handyman', 'Airy template for handyman services', 'handyman', 'services',
 '{"Warm Pro": {"primary": "#78350f", "secondary": "#ea580c", "accent": "#fff7ed"}, "Cool Steel": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}, "Forest": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}}',
 '{"siteTitle": "Handy Helper", "navButtonText": "Get Quote", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Expert Handyman Services", "subtitle": "From small fixes to major repairs, we handle it all with precision and care.", "buttonText": "Get Quote"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Licensed & Insured", "100% Satisfaction Guarantee", "Upfront Pricing", "Same-Day Service Available"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed & Insured", "100% Satisfaction Guarantee", "Upfront Pricing", "Same-Day Service Available"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Sarah M.", "role": "Homeowner", "quote": "Fixed everything in one visit! Professional and efficient.", "rating": 5}, {"name": "James R.", "role": "Property Manager", "quote": "Reliable and always does quality work. Highly recommended.", "rating": 5}, {"name": "Lisa K.", "role": "Business Owner", "quote": "Fair pricing and excellent craftsmanship every time.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Need Something Fixed?", "subtitle": "Contact us today for a free estimate on any repair or maintenance project.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_handyman',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_handyman', 'Edge — Handyman', 'Edge template for handyman services', 'handyman', 'services',
 '{"Warm Pro": {"primary": "#78350f", "secondary": "#ea580c", "accent": "#fff7ed"}, "Cool Steel": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}, "Forest": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}}',
 '{"siteTitle": "RepairTech", "navButtonText": "Get Quote", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Expert Handyman Services", "subtitle": "From small fixes to major repairs, we handle it all with precision and care.", "buttonText": "Get Quote"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "500+", "label": "Jobs Done"}, {"value": "15+", "label": "Years Experience"}, {"value": "24/7", "label": "Availability"}, {"value": "100%", "label": "Satisfaction"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "General Repairs", "description": "Door hinges, drywall patches, furniture assembly, and more."}, {"title": "Painting & Finishing", "description": "Interior and exterior painting with premium materials."}, {"title": "Home Maintenance", "description": "Regular upkeep to keep your home in perfect condition."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Sarah M.", "role": "Homeowner", "quote": "Fixed everything in one visit! Professional and efficient.", "rating": 5}, {"name": "James R.", "role": "Property Manager", "quote": "Reliable and always does quality work. Highly recommended.", "rating": 5}, {"name": "Lisa K.", "role": "Business Owner", "quote": "Fair pricing and excellent craftsmanship every time.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Need Something Fixed?", "subtitle": "Contact us today for a free estimate on any repair or maintenance project.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_handyman',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_handyman', 'Classic — Handyman', 'Classic template for handyman services', 'handyman', 'services',
 '{"Warm Pro": {"primary": "#78350f", "secondary": "#ea580c", "accent": "#fff7ed"}, "Cool Steel": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}, "Forest": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}}',
 '{"siteTitle": "Reliable Handyman", "navButtonText": "Get Quote", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Expert Handyman Services", "subtitle": "From small fixes to major repairs, we handle it all with precision and care.", "buttonText": "Get Quote"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "500+", "label": "Jobs Done"}, {"value": "15+", "label": "Years Experience"}, {"value": "24/7", "label": "Availability"}, {"value": "100%", "label": "Satisfaction"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "General Repairs", "description": "Door hinges, drywall patches, furniture assembly, and more."}, {"title": "Painting & Finishing", "description": "Interior and exterior painting with premium materials."}, {"title": "Home Maintenance", "description": "Regular upkeep to keep your home in perfect condition."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed & Insured", "100% Satisfaction Guarantee", "Upfront Pricing", "Same-Day Service Available"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Sarah M.", "role": "Homeowner", "quote": "Fixed everything in one visit! Professional and efficient.", "rating": 5}, {"name": "James R.", "role": "Property Manager", "quote": "Reliable and always does quality work. Highly recommended.", "rating": 5}, {"name": "Lisa K.", "role": "Business Owner", "quote": "Fair pricing and excellent craftsmanship every time.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Licensed & Insured", "100% Satisfaction Guarantee", "Upfront Pricing", "Same-Day Service Available"]}}, {"type": "cta", "data": {"title": "Need Something Fixed?", "subtitle": "Contact us today for a free estimate on any repair or maintenance project.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_handyman',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_handyman', 'Organic — Handyman', 'Organic template for handyman services', 'handyman', 'services',
 '{"Warm Pro": {"primary": "#78350f", "secondary": "#ea580c", "accent": "#fff7ed"}, "Cool Steel": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}, "Forest": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}}',
 '{"siteTitle": "Craftsman''s Touch", "navButtonText": "Get Quote", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Expert Handyman Services", "subtitle": "From small fixes to major repairs, we handle it all with precision and care.", "buttonText": "Get Quote"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed & Insured", "100% Satisfaction Guarantee", "Upfront Pricing", "Same-Day Service Available"]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "General Repairs", "description": "Door hinges, drywall patches, furniture assembly, and more."}, {"title": "Painting & Finishing", "description": "Interior and exterior painting with premium materials."}, {"title": "Home Maintenance", "description": "Regular upkeep to keep your home in perfect condition."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Sarah M.", "role": "Homeowner", "quote": "Fixed everything in one visit! Professional and efficient.", "rating": 5}, {"name": "James R.", "role": "Property Manager", "quote": "Reliable and always does quality work. Highly recommended.", "rating": 5}, {"name": "Lisa K.", "role": "Business Owner", "quote": "Fair pricing and excellent craftsmanship every time.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Need Something Fixed?", "subtitle": "Contact us today for a free estimate on any repair or maintenance project.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_handyman',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_handyman', 'Sleek — Handyman', 'Sleek template for handyman services', 'handyman', 'services',
 '{"Warm Pro": {"primary": "#78350f", "secondary": "#ea580c", "accent": "#fff7ed"}, "Cool Steel": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}, "Forest": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}}',
 '{"siteTitle": "Swift Repairs", "navButtonText": "Get Quote", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Expert Handyman Services", "subtitle": "From small fixes to major repairs, we handle it all with precision and care.", "buttonText": "Get Quote"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "General Repairs", "description": "Door hinges, drywall patches, furniture assembly, and more."}, {"title": "Painting & Finishing", "description": "Interior and exterior painting with premium materials."}, {"title": "Home Maintenance", "description": "Regular upkeep to keep your home in perfect condition."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "500+", "label": "Jobs Done"}, {"value": "15+", "label": "Years Experience"}, {"value": "24/7", "label": "Availability"}, {"value": "100%", "label": "Satisfaction"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Sarah M.", "role": "Homeowner", "quote": "Fixed everything in one visit! Professional and efficient.", "rating": 5}, {"name": "James R.", "role": "Property Manager", "quote": "Reliable and always does quality work. Highly recommended.", "rating": 5}, {"name": "Lisa K.", "role": "Business Owner", "quote": "Fair pricing and excellent craftsmanship every time.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Need Something Fixed?", "subtitle": "Contact us today for a free estimate on any repair or maintenance project.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_handyman',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_handyman', 'Vibrant — Handyman', 'Vibrant template for handyman services', 'handyman', 'services',
 '{"Warm Pro": {"primary": "#78350f", "secondary": "#ea580c", "accent": "#fff7ed"}, "Cool Steel": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}, "Forest": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}}',
 '{"siteTitle": "HandyHub", "navButtonText": "Get Quote", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Expert Handyman Services", "subtitle": "From small fixes to major repairs, we handle it all with precision and care.", "buttonText": "Get Quote"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "500+", "label": "Jobs Done"}, {"value": "15+", "label": "Years Experience"}, {"value": "24/7", "label": "Availability"}, {"value": "100%", "label": "Satisfaction"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "General Repairs", "description": "Door hinges, drywall patches, furniture assembly, and more."}, {"title": "Painting & Finishing", "description": "Interior and exterior painting with premium materials."}, {"title": "Home Maintenance", "description": "Regular upkeep to keep your home in perfect condition."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Sarah M.", "role": "Homeowner", "quote": "Fixed everything in one visit! Professional and efficient.", "rating": 5}, {"name": "James R.", "role": "Property Manager", "quote": "Reliable and always does quality work. Highly recommended.", "rating": 5}, {"name": "Lisa K.", "role": "Business Owner", "quote": "Fair pricing and excellent craftsmanship every time.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Need Something Fixed?", "subtitle": "Contact us today for a free estimate on any repair or maintenance project.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_handyman',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_plumber', 'Luxe — Plumber', 'Luxe template for plumber services', 'plumber', 'services',
 '{"Ocean": {"primary": "#0c4a6e", "secondary": "#0ea5e9", "accent": "#f0f9ff"}, "Navy Pro": {"primary": "#1e3a5f", "secondary": "#3b82f6", "accent": "#eff6ff"}, "Teal Fresh": {"primary": "#134e4a", "secondary": "#14b8a6", "accent": "#f0fdfa"}}',
 '{"siteTitle": "Aqua Plumbing", "navButtonText": "Get Quote", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Fast, Reliable Plumbing", "subtitle": "Licensed plumbers ready for any job. Emergency service available 24/7.", "buttonText": "Get Quote"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Emergency Repairs", "description": "24/7 emergency plumbing for burst pipes, leaks, and flooding."}, {"title": "Drain Cleaning", "description": "Professional drain and sewer cleaning for all fixtures."}, {"title": "Water Heater", "description": "Installation, repair, and maintenance of all water heater types."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed & Insured", "Free Estimates", "24/7 Emergency Service", "Upfront Pricing"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Mike T.", "role": "Homeowner", "quote": "Fixed our burst pipe in under an hour. Lifesaver!", "rating": 5}, {"name": "Karen S.", "role": "Property Manager", "quote": "Reliable and professional. We use them for all properties.", "rating": 5}, {"name": "David L.", "role": "Restaurant Owner", "quote": "Quick response and fair pricing. Excellent service.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Need a Plumber?", "subtitle": "Call us now for a free estimate. Available 24/7 for emergencies.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_plumber',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_plumber', 'Vivid — Plumber', 'Vivid template for plumber services', 'plumber', 'services',
 '{"Ocean": {"primary": "#0c4a6e", "secondary": "#0ea5e9", "accent": "#f0f9ff"}, "Navy Pro": {"primary": "#1e3a5f", "secondary": "#3b82f6", "accent": "#eff6ff"}, "Teal Fresh": {"primary": "#134e4a", "secondary": "#14b8a6", "accent": "#f0fdfa"}}',
 '{"siteTitle": "FlowFix Pro", "navButtonText": "Get Quote", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Fast, Reliable Plumbing", "subtitle": "Licensed plumbers ready for any job. Emergency service available 24/7.", "buttonText": "Get Quote"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "1000+", "label": "Repairs Done"}, {"value": "20+", "label": "Years Experience"}, {"value": "24/7", "label": "Emergency"}, {"value": "100%", "label": "Licensed"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Emergency Repairs", "description": "24/7 emergency plumbing for burst pipes, leaks, and flooding."}, {"title": "Drain Cleaning", "description": "Professional drain and sewer cleaning for all fixtures."}, {"title": "Water Heater", "description": "Installation, repair, and maintenance of all water heater types."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Mike T.", "role": "Homeowner", "quote": "Fixed our burst pipe in under an hour. Lifesaver!", "rating": 5}, {"name": "Karen S.", "role": "Property Manager", "quote": "Reliable and professional. We use them for all properties.", "rating": 5}, {"name": "David L.", "role": "Restaurant Owner", "quote": "Quick response and fair pricing. Excellent service.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Need a Plumber?", "subtitle": "Call us now for a free estimate. Available 24/7 for emergencies.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_plumber',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_plumber', 'Airy — Plumber', 'Airy template for plumber services', 'plumber', 'services',
 '{"Ocean": {"primary": "#0c4a6e", "secondary": "#0ea5e9", "accent": "#f0f9ff"}, "Navy Pro": {"primary": "#1e3a5f", "secondary": "#3b82f6", "accent": "#eff6ff"}, "Teal Fresh": {"primary": "#134e4a", "secondary": "#14b8a6", "accent": "#f0fdfa"}}',
 '{"siteTitle": "Clear Pipes", "navButtonText": "Get Quote", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Fast, Reliable Plumbing", "subtitle": "Licensed plumbers ready for any job. Emergency service available 24/7.", "buttonText": "Get Quote"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Licensed & Insured", "Free Estimates", "24/7 Emergency Service", "Upfront Pricing"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed & Insured", "Free Estimates", "24/7 Emergency Service", "Upfront Pricing"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Mike T.", "role": "Homeowner", "quote": "Fixed our burst pipe in under an hour. Lifesaver!", "rating": 5}, {"name": "Karen S.", "role": "Property Manager", "quote": "Reliable and professional. We use them for all properties.", "rating": 5}, {"name": "David L.", "role": "Restaurant Owner", "quote": "Quick response and fair pricing. Excellent service.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Need a Plumber?", "subtitle": "Call us now for a free estimate. Available 24/7 for emergencies.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_plumber',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_plumber', 'Edge — Plumber', 'Edge template for plumber services', 'plumber', 'services',
 '{"Ocean": {"primary": "#0c4a6e", "secondary": "#0ea5e9", "accent": "#f0f9ff"}, "Navy Pro": {"primary": "#1e3a5f", "secondary": "#3b82f6", "accent": "#eff6ff"}, "Teal Fresh": {"primary": "#134e4a", "secondary": "#14b8a6", "accent": "#f0fdfa"}}',
 '{"siteTitle": "HydroTech", "navButtonText": "Get Quote", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Fast, Reliable Plumbing", "subtitle": "Licensed plumbers ready for any job. Emergency service available 24/7.", "buttonText": "Get Quote"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "1000+", "label": "Repairs Done"}, {"value": "20+", "label": "Years Experience"}, {"value": "24/7", "label": "Emergency"}, {"value": "100%", "label": "Licensed"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Emergency Repairs", "description": "24/7 emergency plumbing for burst pipes, leaks, and flooding."}, {"title": "Drain Cleaning", "description": "Professional drain and sewer cleaning for all fixtures."}, {"title": "Water Heater", "description": "Installation, repair, and maintenance of all water heater types."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Mike T.", "role": "Homeowner", "quote": "Fixed our burst pipe in under an hour. Lifesaver!", "rating": 5}, {"name": "Karen S.", "role": "Property Manager", "quote": "Reliable and professional. We use them for all properties.", "rating": 5}, {"name": "David L.", "role": "Restaurant Owner", "quote": "Quick response and fair pricing. Excellent service.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Need a Plumber?", "subtitle": "Call us now for a free estimate. Available 24/7 for emergencies.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_plumber',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_plumber', 'Classic — Plumber', 'Classic template for plumber services', 'plumber', 'services',
 '{"Ocean": {"primary": "#0c4a6e", "secondary": "#0ea5e9", "accent": "#f0f9ff"}, "Navy Pro": {"primary": "#1e3a5f", "secondary": "#3b82f6", "accent": "#eff6ff"}, "Teal Fresh": {"primary": "#134e4a", "secondary": "#14b8a6", "accent": "#f0fdfa"}}',
 '{"siteTitle": "Expert Plumbing", "navButtonText": "Get Quote", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Fast, Reliable Plumbing", "subtitle": "Licensed plumbers ready for any job. Emergency service available 24/7.", "buttonText": "Get Quote"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "1000+", "label": "Repairs Done"}, {"value": "20+", "label": "Years Experience"}, {"value": "24/7", "label": "Emergency"}, {"value": "100%", "label": "Licensed"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Emergency Repairs", "description": "24/7 emergency plumbing for burst pipes, leaks, and flooding."}, {"title": "Drain Cleaning", "description": "Professional drain and sewer cleaning for all fixtures."}, {"title": "Water Heater", "description": "Installation, repair, and maintenance of all water heater types."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed & Insured", "Free Estimates", "24/7 Emergency Service", "Upfront Pricing"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Mike T.", "role": "Homeowner", "quote": "Fixed our burst pipe in under an hour. Lifesaver!", "rating": 5}, {"name": "Karen S.", "role": "Property Manager", "quote": "Reliable and professional. We use them for all properties.", "rating": 5}, {"name": "David L.", "role": "Restaurant Owner", "quote": "Quick response and fair pricing. Excellent service.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Licensed & Insured", "Free Estimates", "24/7 Emergency Service", "Upfront Pricing"]}}, {"type": "cta", "data": {"title": "Need a Plumber?", "subtitle": "Call us now for a free estimate. Available 24/7 for emergencies.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_plumber',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_plumber', 'Organic — Plumber', 'Organic template for plumber services', 'plumber', 'services',
 '{"Ocean": {"primary": "#0c4a6e", "secondary": "#0ea5e9", "accent": "#f0f9ff"}, "Navy Pro": {"primary": "#1e3a5f", "secondary": "#3b82f6", "accent": "#eff6ff"}, "Teal Fresh": {"primary": "#134e4a", "secondary": "#14b8a6", "accent": "#f0fdfa"}}',
 '{"siteTitle": "Natural Flow", "navButtonText": "Get Quote", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Fast, Reliable Plumbing", "subtitle": "Licensed plumbers ready for any job. Emergency service available 24/7.", "buttonText": "Get Quote"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed & Insured", "Free Estimates", "24/7 Emergency Service", "Upfront Pricing"]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Emergency Repairs", "description": "24/7 emergency plumbing for burst pipes, leaks, and flooding."}, {"title": "Drain Cleaning", "description": "Professional drain and sewer cleaning for all fixtures."}, {"title": "Water Heater", "description": "Installation, repair, and maintenance of all water heater types."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Mike T.", "role": "Homeowner", "quote": "Fixed our burst pipe in under an hour. Lifesaver!", "rating": 5}, {"name": "Karen S.", "role": "Property Manager", "quote": "Reliable and professional. We use them for all properties.", "rating": 5}, {"name": "David L.", "role": "Restaurant Owner", "quote": "Quick response and fair pricing. Excellent service.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Need a Plumber?", "subtitle": "Call us now for a free estimate. Available 24/7 for emergencies.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_plumber',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_plumber', 'Sleek — Plumber', 'Sleek template for plumber services', 'plumber', 'services',
 '{"Ocean": {"primary": "#0c4a6e", "secondary": "#0ea5e9", "accent": "#f0f9ff"}, "Navy Pro": {"primary": "#1e3a5f", "secondary": "#3b82f6", "accent": "#eff6ff"}, "Teal Fresh": {"primary": "#134e4a", "secondary": "#14b8a6", "accent": "#f0fdfa"}}',
 '{"siteTitle": "PipeLine Co", "navButtonText": "Get Quote", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Fast, Reliable Plumbing", "subtitle": "Licensed plumbers ready for any job. Emergency service available 24/7.", "buttonText": "Get Quote"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Emergency Repairs", "description": "24/7 emergency plumbing for burst pipes, leaks, and flooding."}, {"title": "Drain Cleaning", "description": "Professional drain and sewer cleaning for all fixtures."}, {"title": "Water Heater", "description": "Installation, repair, and maintenance of all water heater types."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "1000+", "label": "Repairs Done"}, {"value": "20+", "label": "Years Experience"}, {"value": "24/7", "label": "Emergency"}, {"value": "100%", "label": "Licensed"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Mike T.", "role": "Homeowner", "quote": "Fixed our burst pipe in under an hour. Lifesaver!", "rating": 5}, {"name": "Karen S.", "role": "Property Manager", "quote": "Reliable and professional. We use them for all properties.", "rating": 5}, {"name": "David L.", "role": "Restaurant Owner", "quote": "Quick response and fair pricing. Excellent service.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Need a Plumber?", "subtitle": "Call us now for a free estimate. Available 24/7 for emergencies.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_plumber',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_plumber', 'Vibrant — Plumber', 'Vibrant template for plumber services', 'plumber', 'services',
 '{"Ocean": {"primary": "#0c4a6e", "secondary": "#0ea5e9", "accent": "#f0f9ff"}, "Navy Pro": {"primary": "#1e3a5f", "secondary": "#3b82f6", "accent": "#eff6ff"}, "Teal Fresh": {"primary": "#134e4a", "secondary": "#14b8a6", "accent": "#f0fdfa"}}',
 '{"siteTitle": "Rush Plumbing", "navButtonText": "Get Quote", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Fast, Reliable Plumbing", "subtitle": "Licensed plumbers ready for any job. Emergency service available 24/7.", "buttonText": "Get Quote"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "1000+", "label": "Repairs Done"}, {"value": "20+", "label": "Years Experience"}, {"value": "24/7", "label": "Emergency"}, {"value": "100%", "label": "Licensed"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Emergency Repairs", "description": "24/7 emergency plumbing for burst pipes, leaks, and flooding."}, {"title": "Drain Cleaning", "description": "Professional drain and sewer cleaning for all fixtures."}, {"title": "Water Heater", "description": "Installation, repair, and maintenance of all water heater types."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Mike T.", "role": "Homeowner", "quote": "Fixed our burst pipe in under an hour. Lifesaver!", "rating": 5}, {"name": "Karen S.", "role": "Property Manager", "quote": "Reliable and professional. We use them for all properties.", "rating": 5}, {"name": "David L.", "role": "Restaurant Owner", "quote": "Quick response and fair pricing. Excellent service.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Need a Plumber?", "subtitle": "Call us now for a free estimate. Available 24/7 for emergencies.", "buttonText": "Get Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_plumber',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_electrical', 'Luxe — Electrical', 'Luxe template for electrical services', 'electrical', 'services',
 '{"Electric": {"primary": "#7c3aed", "secondary": "#fbbf24", "accent": "#fef9c3"}, "Industrial": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Volt Blue": {"primary": "#1e3a8a", "secondary": "#60a5fa", "accent": "#eff6ff"}}',
 '{"siteTitle": "Luxe Electric", "navButtonText": "Get Estimate", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Professional Electrical Services", "subtitle": "Certified electricians for residential and commercial projects.", "buttonText": "Get Estimate"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Wiring & Rewiring", "description": "Complete electrical wiring for new builds and renovations."}, {"title": "Panel Upgrades", "description": "Electrical panel upgrades to meet modern power demands."}, {"title": "Lighting Installation", "description": "Indoor and outdoor lighting design and installation."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Certified Electricians", "Code Compliant", "Free Estimates", "Warranty on All Work"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Tom W.", "role": "Homeowner", "quote": "Upgraded our entire panel. Clean work and on time.", "rating": 5}, {"name": "Amy B.", "role": "Contractor", "quote": "Our go-to electricians. Always reliable and professional.", "rating": 5}, {"name": "Chris P.", "role": "Business Owner", "quote": "Installed our commercial lighting. Excellent results.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Electrical Project?", "subtitle": "Get a free, no-obligation estimate from our certified electricians.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_electrical',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_electrical', 'Vivid — Electrical', 'Vivid template for electrical services', 'electrical', 'services',
 '{"Electric": {"primary": "#7c3aed", "secondary": "#fbbf24", "accent": "#fef9c3"}, "Industrial": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Volt Blue": {"primary": "#1e3a8a", "secondary": "#60a5fa", "accent": "#eff6ff"}}',
 '{"siteTitle": "Spark Pro", "navButtonText": "Get Estimate", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Professional Electrical Services", "subtitle": "Certified electricians for residential and commercial projects.", "buttonText": "Get Estimate"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "800+", "label": "Projects"}, {"value": "25+", "label": "Years"}, {"value": "0", "label": "Incidents"}, {"value": "100%", "label": "Code Compliant"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Wiring & Rewiring", "description": "Complete electrical wiring for new builds and renovations."}, {"title": "Panel Upgrades", "description": "Electrical panel upgrades to meet modern power demands."}, {"title": "Lighting Installation", "description": "Indoor and outdoor lighting design and installation."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Tom W.", "role": "Homeowner", "quote": "Upgraded our entire panel. Clean work and on time.", "rating": 5}, {"name": "Amy B.", "role": "Contractor", "quote": "Our go-to electricians. Always reliable and professional.", "rating": 5}, {"name": "Chris P.", "role": "Business Owner", "quote": "Installed our commercial lighting. Excellent results.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Electrical Project?", "subtitle": "Get a free, no-obligation estimate from our certified electricians.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_electrical',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_electrical', 'Airy — Electrical', 'Airy template for electrical services', 'electrical', 'services',
 '{"Electric": {"primary": "#7c3aed", "secondary": "#fbbf24", "accent": "#fef9c3"}, "Industrial": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Volt Blue": {"primary": "#1e3a8a", "secondary": "#60a5fa", "accent": "#eff6ff"}}',
 '{"siteTitle": "Bright Wire", "navButtonText": "Get Estimate", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Professional Electrical Services", "subtitle": "Certified electricians for residential and commercial projects.", "buttonText": "Get Estimate"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Certified Electricians", "Code Compliant", "Free Estimates", "Warranty on All Work"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Certified Electricians", "Code Compliant", "Free Estimates", "Warranty on All Work"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Tom W.", "role": "Homeowner", "quote": "Upgraded our entire panel. Clean work and on time.", "rating": 5}, {"name": "Amy B.", "role": "Contractor", "quote": "Our go-to electricians. Always reliable and professional.", "rating": 5}, {"name": "Chris P.", "role": "Business Owner", "quote": "Installed our commercial lighting. Excellent results.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Electrical Project?", "subtitle": "Get a free, no-obligation estimate from our certified electricians.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_electrical',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_electrical', 'Edge — Electrical', 'Edge template for electrical services', 'electrical', 'services',
 '{"Electric": {"primary": "#7c3aed", "secondary": "#fbbf24", "accent": "#fef9c3"}, "Industrial": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Volt Blue": {"primary": "#1e3a8a", "secondary": "#60a5fa", "accent": "#eff6ff"}}',
 '{"siteTitle": "VoltEdge", "navButtonText": "Get Estimate", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Professional Electrical Services", "subtitle": "Certified electricians for residential and commercial projects.", "buttonText": "Get Estimate"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "800+", "label": "Projects"}, {"value": "25+", "label": "Years"}, {"value": "0", "label": "Incidents"}, {"value": "100%", "label": "Code Compliant"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Wiring & Rewiring", "description": "Complete electrical wiring for new builds and renovations."}, {"title": "Panel Upgrades", "description": "Electrical panel upgrades to meet modern power demands."}, {"title": "Lighting Installation", "description": "Indoor and outdoor lighting design and installation."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Tom W.", "role": "Homeowner", "quote": "Upgraded our entire panel. Clean work and on time.", "rating": 5}, {"name": "Amy B.", "role": "Contractor", "quote": "Our go-to electricians. Always reliable and professional.", "rating": 5}, {"name": "Chris P.", "role": "Business Owner", "quote": "Installed our commercial lighting. Excellent results.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Electrical Project?", "subtitle": "Get a free, no-obligation estimate from our certified electricians.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_electrical',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_electrical', 'Classic — Electrical', 'Classic template for electrical services', 'electrical', 'services',
 '{"Electric": {"primary": "#7c3aed", "secondary": "#fbbf24", "accent": "#fef9c3"}, "Industrial": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Volt Blue": {"primary": "#1e3a8a", "secondary": "#60a5fa", "accent": "#eff6ff"}}',
 '{"siteTitle": "Reliable Electric", "navButtonText": "Get Estimate", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Professional Electrical Services", "subtitle": "Certified electricians for residential and commercial projects.", "buttonText": "Get Estimate"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "800+", "label": "Projects"}, {"value": "25+", "label": "Years"}, {"value": "0", "label": "Incidents"}, {"value": "100%", "label": "Code Compliant"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Wiring & Rewiring", "description": "Complete electrical wiring for new builds and renovations."}, {"title": "Panel Upgrades", "description": "Electrical panel upgrades to meet modern power demands."}, {"title": "Lighting Installation", "description": "Indoor and outdoor lighting design and installation."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Certified Electricians", "Code Compliant", "Free Estimates", "Warranty on All Work"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Tom W.", "role": "Homeowner", "quote": "Upgraded our entire panel. Clean work and on time.", "rating": 5}, {"name": "Amy B.", "role": "Contractor", "quote": "Our go-to electricians. Always reliable and professional.", "rating": 5}, {"name": "Chris P.", "role": "Business Owner", "quote": "Installed our commercial lighting. Excellent results.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Certified Electricians", "Code Compliant", "Free Estimates", "Warranty on All Work"]}}, {"type": "cta", "data": {"title": "Electrical Project?", "subtitle": "Get a free, no-obligation estimate from our certified electricians.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_electrical',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_electrical', 'Organic — Electrical', 'Organic template for electrical services', 'electrical', 'services',
 '{"Electric": {"primary": "#7c3aed", "secondary": "#fbbf24", "accent": "#fef9c3"}, "Industrial": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Volt Blue": {"primary": "#1e3a8a", "secondary": "#60a5fa", "accent": "#eff6ff"}}',
 '{"siteTitle": "Green Power", "navButtonText": "Get Estimate", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Professional Electrical Services", "subtitle": "Certified electricians for residential and commercial projects.", "buttonText": "Get Estimate"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Certified Electricians", "Code Compliant", "Free Estimates", "Warranty on All Work"]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Wiring & Rewiring", "description": "Complete electrical wiring for new builds and renovations."}, {"title": "Panel Upgrades", "description": "Electrical panel upgrades to meet modern power demands."}, {"title": "Lighting Installation", "description": "Indoor and outdoor lighting design and installation."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Tom W.", "role": "Homeowner", "quote": "Upgraded our entire panel. Clean work and on time.", "rating": 5}, {"name": "Amy B.", "role": "Contractor", "quote": "Our go-to electricians. Always reliable and professional.", "rating": 5}, {"name": "Chris P.", "role": "Business Owner", "quote": "Installed our commercial lighting. Excellent results.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Electrical Project?", "subtitle": "Get a free, no-obligation estimate from our certified electricians.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_electrical',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_electrical', 'Sleek — Electrical', 'Sleek template for electrical services', 'electrical', 'services',
 '{"Electric": {"primary": "#7c3aed", "secondary": "#fbbf24", "accent": "#fef9c3"}, "Industrial": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Volt Blue": {"primary": "#1e3a8a", "secondary": "#60a5fa", "accent": "#eff6ff"}}',
 '{"siteTitle": "Ohm Electric", "navButtonText": "Get Estimate", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Professional Electrical Services", "subtitle": "Certified electricians for residential and commercial projects.", "buttonText": "Get Estimate"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Wiring & Rewiring", "description": "Complete electrical wiring for new builds and renovations."}, {"title": "Panel Upgrades", "description": "Electrical panel upgrades to meet modern power demands."}, {"title": "Lighting Installation", "description": "Indoor and outdoor lighting design and installation."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "800+", "label": "Projects"}, {"value": "25+", "label": "Years"}, {"value": "0", "label": "Incidents"}, {"value": "100%", "label": "Code Compliant"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Tom W.", "role": "Homeowner", "quote": "Upgraded our entire panel. Clean work and on time.", "rating": 5}, {"name": "Amy B.", "role": "Contractor", "quote": "Our go-to electricians. Always reliable and professional.", "rating": 5}, {"name": "Chris P.", "role": "Business Owner", "quote": "Installed our commercial lighting. Excellent results.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Electrical Project?", "subtitle": "Get a free, no-obligation estimate from our certified electricians.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_electrical',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_electrical', 'Vibrant — Electrical', 'Vibrant template for electrical services', 'electrical', 'services',
 '{"Electric": {"primary": "#7c3aed", "secondary": "#fbbf24", "accent": "#fef9c3"}, "Industrial": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Volt Blue": {"primary": "#1e3a8a", "secondary": "#60a5fa", "accent": "#eff6ff"}}',
 '{"siteTitle": "Flash Electric", "navButtonText": "Get Estimate", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Professional Electrical Services", "subtitle": "Certified electricians for residential and commercial projects.", "buttonText": "Get Estimate"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "800+", "label": "Projects"}, {"value": "25+", "label": "Years"}, {"value": "0", "label": "Incidents"}, {"value": "100%", "label": "Code Compliant"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Wiring & Rewiring", "description": "Complete electrical wiring for new builds and renovations."}, {"title": "Panel Upgrades", "description": "Electrical panel upgrades to meet modern power demands."}, {"title": "Lighting Installation", "description": "Indoor and outdoor lighting design and installation."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Tom W.", "role": "Homeowner", "quote": "Upgraded our entire panel. Clean work and on time.", "rating": 5}, {"name": "Amy B.", "role": "Contractor", "quote": "Our go-to electricians. Always reliable and professional.", "rating": 5}, {"name": "Chris P.", "role": "Business Owner", "quote": "Installed our commercial lighting. Excellent results.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Electrical Project?", "subtitle": "Get a free, no-obligation estimate from our certified electricians.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_electrical',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_hvac', 'Luxe — Hvac', 'Luxe template for hvac services', 'hvac', 'services',
 '{"Cool Blue": {"primary": "#0369a1", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Professional": {"primary": "#1e3a5f", "secondary": "#60a5fa", "accent": "#f0f9ff"}, "Energy": {"primary": "#059669", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Climate Luxe", "navButtonText": "Schedule Service", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Heating & Cooling Experts", "subtitle": "Keep your home comfortable year-round with our professional HVAC services.", "buttonText": "Schedule Service"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "AC Installation", "description": "Professional air conditioning installation and setup."}, {"title": "Heating Repair", "description": "Expert furnace and heating system repair services."}, {"title": "Maintenance Plans", "description": "Preventive maintenance to keep systems running efficiently."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["EPA Certified", "Energy-Efficient Solutions", "Free Estimates", "Maintenance Plans"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Rachel D.", "role": "Homeowner", "quote": "New AC installed perfectly. House is so comfortable now!", "rating": 5}, {"name": "Greg M.", "role": "Property Manager", "quote": "They maintain all our buildings. Always professional.", "rating": 5}, {"name": "Sandra K.", "role": "Business Owner", "quote": "Saved us thousands with their energy-efficient solutions.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Stay Comfortable", "subtitle": "Schedule your HVAC service today. Free estimates on all installations.", "buttonText": "Schedule Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_hvac',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_hvac', 'Vivid — Hvac', 'Vivid template for hvac services', 'hvac', 'services',
 '{"Cool Blue": {"primary": "#0369a1", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Professional": {"primary": "#1e3a5f", "secondary": "#60a5fa", "accent": "#f0f9ff"}, "Energy": {"primary": "#059669", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "CoolForce", "navButtonText": "Schedule Service", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Heating & Cooling Experts", "subtitle": "Keep your home comfortable year-round with our professional HVAC services.", "buttonText": "Schedule Service"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "600+", "label": "Systems Installed"}, {"value": "18+", "label": "Years"}, {"value": "24/7", "label": "Service"}, {"value": "98%", "label": "Satisfaction"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "AC Installation", "description": "Professional air conditioning installation and setup."}, {"title": "Heating Repair", "description": "Expert furnace and heating system repair services."}, {"title": "Maintenance Plans", "description": "Preventive maintenance to keep systems running efficiently."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Rachel D.", "role": "Homeowner", "quote": "New AC installed perfectly. House is so comfortable now!", "rating": 5}, {"name": "Greg M.", "role": "Property Manager", "quote": "They maintain all our buildings. Always professional.", "rating": 5}, {"name": "Sandra K.", "role": "Business Owner", "quote": "Saved us thousands with their energy-efficient solutions.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Stay Comfortable", "subtitle": "Schedule your HVAC service today. Free estimates on all installations.", "buttonText": "Schedule Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_hvac',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_hvac', 'Airy — Hvac', 'Airy template for hvac services', 'hvac', 'services',
 '{"Cool Blue": {"primary": "#0369a1", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Professional": {"primary": "#1e3a5f", "secondary": "#60a5fa", "accent": "#f0f9ff"}, "Energy": {"primary": "#059669", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Fresh Air Co", "navButtonText": "Schedule Service", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Heating & Cooling Experts", "subtitle": "Keep your home comfortable year-round with our professional HVAC services.", "buttonText": "Schedule Service"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["EPA Certified", "Energy-Efficient Solutions", "Free Estimates", "Maintenance Plans"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["EPA Certified", "Energy-Efficient Solutions", "Free Estimates", "Maintenance Plans"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Rachel D.", "role": "Homeowner", "quote": "New AC installed perfectly. House is so comfortable now!", "rating": 5}, {"name": "Greg M.", "role": "Property Manager", "quote": "They maintain all our buildings. Always professional.", "rating": 5}, {"name": "Sandra K.", "role": "Business Owner", "quote": "Saved us thousands with their energy-efficient solutions.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Stay Comfortable", "subtitle": "Schedule your HVAC service today. Free estimates on all installations.", "buttonText": "Schedule Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_hvac',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_hvac', 'Edge — Hvac', 'Edge template for hvac services', 'hvac', 'services',
 '{"Cool Blue": {"primary": "#0369a1", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Professional": {"primary": "#1e3a5f", "secondary": "#60a5fa", "accent": "#f0f9ff"}, "Energy": {"primary": "#059669", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "ThermoTech", "navButtonText": "Schedule Service", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Heating & Cooling Experts", "subtitle": "Keep your home comfortable year-round with our professional HVAC services.", "buttonText": "Schedule Service"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "600+", "label": "Systems Installed"}, {"value": "18+", "label": "Years"}, {"value": "24/7", "label": "Service"}, {"value": "98%", "label": "Satisfaction"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "AC Installation", "description": "Professional air conditioning installation and setup."}, {"title": "Heating Repair", "description": "Expert furnace and heating system repair services."}, {"title": "Maintenance Plans", "description": "Preventive maintenance to keep systems running efficiently."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Rachel D.", "role": "Homeowner", "quote": "New AC installed perfectly. House is so comfortable now!", "rating": 5}, {"name": "Greg M.", "role": "Property Manager", "quote": "They maintain all our buildings. Always professional.", "rating": 5}, {"name": "Sandra K.", "role": "Business Owner", "quote": "Saved us thousands with their energy-efficient solutions.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Stay Comfortable", "subtitle": "Schedule your HVAC service today. Free estimates on all installations.", "buttonText": "Schedule Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_hvac',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_hvac', 'Classic — Hvac', 'Classic template for hvac services', 'hvac', 'services',
 '{"Cool Blue": {"primary": "#0369a1", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Professional": {"primary": "#1e3a5f", "secondary": "#60a5fa", "accent": "#f0f9ff"}, "Energy": {"primary": "#059669", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Pro HVAC", "navButtonText": "Schedule Service", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Heating & Cooling Experts", "subtitle": "Keep your home comfortable year-round with our professional HVAC services.", "buttonText": "Schedule Service"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "600+", "label": "Systems Installed"}, {"value": "18+", "label": "Years"}, {"value": "24/7", "label": "Service"}, {"value": "98%", "label": "Satisfaction"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "AC Installation", "description": "Professional air conditioning installation and setup."}, {"title": "Heating Repair", "description": "Expert furnace and heating system repair services."}, {"title": "Maintenance Plans", "description": "Preventive maintenance to keep systems running efficiently."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["EPA Certified", "Energy-Efficient Solutions", "Free Estimates", "Maintenance Plans"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Rachel D.", "role": "Homeowner", "quote": "New AC installed perfectly. House is so comfortable now!", "rating": 5}, {"name": "Greg M.", "role": "Property Manager", "quote": "They maintain all our buildings. Always professional.", "rating": 5}, {"name": "Sandra K.", "role": "Business Owner", "quote": "Saved us thousands with their energy-efficient solutions.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["EPA Certified", "Energy-Efficient Solutions", "Free Estimates", "Maintenance Plans"]}}, {"type": "cta", "data": {"title": "Stay Comfortable", "subtitle": "Schedule your HVAC service today. Free estimates on all installations.", "buttonText": "Schedule Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_hvac',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_hvac', 'Organic — Hvac', 'Organic template for hvac services', 'hvac', 'services',
 '{"Cool Blue": {"primary": "#0369a1", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Professional": {"primary": "#1e3a5f", "secondary": "#60a5fa", "accent": "#f0f9ff"}, "Energy": {"primary": "#059669", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Natural Climate", "navButtonText": "Schedule Service", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Heating & Cooling Experts", "subtitle": "Keep your home comfortable year-round with our professional HVAC services.", "buttonText": "Schedule Service"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["EPA Certified", "Energy-Efficient Solutions", "Free Estimates", "Maintenance Plans"]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "AC Installation", "description": "Professional air conditioning installation and setup."}, {"title": "Heating Repair", "description": "Expert furnace and heating system repair services."}, {"title": "Maintenance Plans", "description": "Preventive maintenance to keep systems running efficiently."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Rachel D.", "role": "Homeowner", "quote": "New AC installed perfectly. House is so comfortable now!", "rating": 5}, {"name": "Greg M.", "role": "Property Manager", "quote": "They maintain all our buildings. Always professional.", "rating": 5}, {"name": "Sandra K.", "role": "Business Owner", "quote": "Saved us thousands with their energy-efficient solutions.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Stay Comfortable", "subtitle": "Schedule your HVAC service today. Free estimates on all installations.", "buttonText": "Schedule Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_hvac',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_hvac', 'Sleek — Hvac', 'Sleek template for hvac services', 'hvac', 'services',
 '{"Cool Blue": {"primary": "#0369a1", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Professional": {"primary": "#1e3a5f", "secondary": "#60a5fa", "accent": "#f0f9ff"}, "Energy": {"primary": "#059669", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "AirFlow", "navButtonText": "Schedule Service", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Heating & Cooling Experts", "subtitle": "Keep your home comfortable year-round with our professional HVAC services.", "buttonText": "Schedule Service"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "AC Installation", "description": "Professional air conditioning installation and setup."}, {"title": "Heating Repair", "description": "Expert furnace and heating system repair services."}, {"title": "Maintenance Plans", "description": "Preventive maintenance to keep systems running efficiently."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "600+", "label": "Systems Installed"}, {"value": "18+", "label": "Years"}, {"value": "24/7", "label": "Service"}, {"value": "98%", "label": "Satisfaction"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Rachel D.", "role": "Homeowner", "quote": "New AC installed perfectly. House is so comfortable now!", "rating": 5}, {"name": "Greg M.", "role": "Property Manager", "quote": "They maintain all our buildings. Always professional.", "rating": 5}, {"name": "Sandra K.", "role": "Business Owner", "quote": "Saved us thousands with their energy-efficient solutions.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Stay Comfortable", "subtitle": "Schedule your HVAC service today. Free estimates on all installations.", "buttonText": "Schedule Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_hvac',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_hvac', 'Vibrant — Hvac', 'Vibrant template for hvac services', 'hvac', 'services',
 '{"Cool Blue": {"primary": "#0369a1", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Professional": {"primary": "#1e3a5f", "secondary": "#60a5fa", "accent": "#f0f9ff"}, "Energy": {"primary": "#059669", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "ClimatePro", "navButtonText": "Schedule Service", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Heating & Cooling Experts", "subtitle": "Keep your home comfortable year-round with our professional HVAC services.", "buttonText": "Schedule Service"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "600+", "label": "Systems Installed"}, {"value": "18+", "label": "Years"}, {"value": "24/7", "label": "Service"}, {"value": "98%", "label": "Satisfaction"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "AC Installation", "description": "Professional air conditioning installation and setup."}, {"title": "Heating Repair", "description": "Expert furnace and heating system repair services."}, {"title": "Maintenance Plans", "description": "Preventive maintenance to keep systems running efficiently."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Rachel D.", "role": "Homeowner", "quote": "New AC installed perfectly. House is so comfortable now!", "rating": 5}, {"name": "Greg M.", "role": "Property Manager", "quote": "They maintain all our buildings. Always professional.", "rating": 5}, {"name": "Sandra K.", "role": "Business Owner", "quote": "Saved us thousands with their energy-efficient solutions.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Stay Comfortable", "subtitle": "Schedule your HVAC service today. Free estimates on all installations.", "buttonText": "Schedule Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_hvac',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_mechanic', 'Luxe — Mechanic', 'Luxe template for mechanic services', 'mechanic', 'services',
 '{"Steel": {"primary": "#1f2937", "secondary": "#dc2626", "accent": "#f9fafb"}, "Speed": {"primary": "#dc2626", "secondary": "#f97316", "accent": "#fff7ed"}, "Chrome": {"primary": "#0f172a", "secondary": "#6366f1", "accent": "#f5f3ff"}}',
 '{"siteTitle": "Prestige Auto", "navButtonText": "Book Service", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Expert Auto Repair", "subtitle": "Certified mechanics you can trust. Quality parts, honest service.", "buttonText": "Book Service"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Engine Diagnostics", "description": "Advanced computer diagnostics for all makes and models."}, {"title": "Brake Service", "description": "Complete brake inspection, repair, and replacement."}, {"title": "Oil & Maintenance", "description": "Regular maintenance to keep your vehicle running smoothly."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["ASE Certified", "All Makes & Models", "Warranty on Parts", "Free Diagnostics"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Mark H.", "role": "Car Owner", "quote": "Finally found a mechanic I can trust. Fair and honest.", "rating": 5}, {"name": "Jennifer L.", "role": "Fleet Manager", "quote": "They service our entire fleet. Always reliable.", "rating": 5}, {"name": "Steve R.", "role": "Car Enthusiast", "quote": "Top-notch work on my classic car. Highly skilled team.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Vehicle Need Service?", "subtitle": "Book your appointment today. Free diagnostics with any repair.", "buttonText": "Book Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_mechanic',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_mechanic', 'Vivid — Mechanic', 'Vivid template for mechanic services', 'mechanic', 'services',
 '{"Steel": {"primary": "#1f2937", "secondary": "#dc2626", "accent": "#f9fafb"}, "Speed": {"primary": "#dc2626", "secondary": "#f97316", "accent": "#fff7ed"}, "Chrome": {"primary": "#0f172a", "secondary": "#6366f1", "accent": "#f5f3ff"}}',
 '{"siteTitle": "Turbo Garage", "navButtonText": "Book Service", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Expert Auto Repair", "subtitle": "Certified mechanics you can trust. Quality parts, honest service.", "buttonText": "Book Service"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "3000+", "label": "Cars Serviced"}, {"value": "20+", "label": "Years"}, {"value": "ASE", "label": "Certified"}, {"value": "5\u2605", "label": "Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Engine Diagnostics", "description": "Advanced computer diagnostics for all makes and models."}, {"title": "Brake Service", "description": "Complete brake inspection, repair, and replacement."}, {"title": "Oil & Maintenance", "description": "Regular maintenance to keep your vehicle running smoothly."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Mark H.", "role": "Car Owner", "quote": "Finally found a mechanic I can trust. Fair and honest.", "rating": 5}, {"name": "Jennifer L.", "role": "Fleet Manager", "quote": "They service our entire fleet. Always reliable.", "rating": 5}, {"name": "Steve R.", "role": "Car Enthusiast", "quote": "Top-notch work on my classic car. Highly skilled team.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Vehicle Need Service?", "subtitle": "Book your appointment today. Free diagnostics with any repair.", "buttonText": "Book Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_mechanic',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_mechanic', 'Airy — Mechanic', 'Airy template for mechanic services', 'mechanic', 'services',
 '{"Steel": {"primary": "#1f2937", "secondary": "#dc2626", "accent": "#f9fafb"}, "Speed": {"primary": "#dc2626", "secondary": "#f97316", "accent": "#fff7ed"}, "Chrome": {"primary": "#0f172a", "secondary": "#6366f1", "accent": "#f5f3ff"}}',
 '{"siteTitle": "Easy Auto", "navButtonText": "Book Service", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Expert Auto Repair", "subtitle": "Certified mechanics you can trust. Quality parts, honest service.", "buttonText": "Book Service"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["ASE Certified", "All Makes & Models", "Warranty on Parts", "Free Diagnostics"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["ASE Certified", "All Makes & Models", "Warranty on Parts", "Free Diagnostics"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Mark H.", "role": "Car Owner", "quote": "Finally found a mechanic I can trust. Fair and honest.", "rating": 5}, {"name": "Jennifer L.", "role": "Fleet Manager", "quote": "They service our entire fleet. Always reliable.", "rating": 5}, {"name": "Steve R.", "role": "Car Enthusiast", "quote": "Top-notch work on my classic car. Highly skilled team.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Vehicle Need Service?", "subtitle": "Book your appointment today. Free diagnostics with any repair.", "buttonText": "Book Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_mechanic',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_mechanic', 'Edge — Mechanic', 'Edge template for mechanic services', 'mechanic', 'services',
 '{"Steel": {"primary": "#1f2937", "secondary": "#dc2626", "accent": "#f9fafb"}, "Speed": {"primary": "#dc2626", "secondary": "#f97316", "accent": "#fff7ed"}, "Chrome": {"primary": "#0f172a", "secondary": "#6366f1", "accent": "#f5f3ff"}}',
 '{"siteTitle": "MechTech", "navButtonText": "Book Service", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Expert Auto Repair", "subtitle": "Certified mechanics you can trust. Quality parts, honest service.", "buttonText": "Book Service"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "3000+", "label": "Cars Serviced"}, {"value": "20+", "label": "Years"}, {"value": "ASE", "label": "Certified"}, {"value": "5\u2605", "label": "Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Engine Diagnostics", "description": "Advanced computer diagnostics for all makes and models."}, {"title": "Brake Service", "description": "Complete brake inspection, repair, and replacement."}, {"title": "Oil & Maintenance", "description": "Regular maintenance to keep your vehicle running smoothly."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Mark H.", "role": "Car Owner", "quote": "Finally found a mechanic I can trust. Fair and honest.", "rating": 5}, {"name": "Jennifer L.", "role": "Fleet Manager", "quote": "They service our entire fleet. Always reliable.", "rating": 5}, {"name": "Steve R.", "role": "Car Enthusiast", "quote": "Top-notch work on my classic car. Highly skilled team.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Vehicle Need Service?", "subtitle": "Book your appointment today. Free diagnostics with any repair.", "buttonText": "Book Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_mechanic',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_mechanic', 'Classic — Mechanic', 'Classic template for mechanic services', 'mechanic', 'services',
 '{"Steel": {"primary": "#1f2937", "secondary": "#dc2626", "accent": "#f9fafb"}, "Speed": {"primary": "#dc2626", "secondary": "#f97316", "accent": "#fff7ed"}, "Chrome": {"primary": "#0f172a", "secondary": "#6366f1", "accent": "#f5f3ff"}}',
 '{"siteTitle": "Pro Auto Shop", "navButtonText": "Book Service", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Expert Auto Repair", "subtitle": "Certified mechanics you can trust. Quality parts, honest service.", "buttonText": "Book Service"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "3000+", "label": "Cars Serviced"}, {"value": "20+", "label": "Years"}, {"value": "ASE", "label": "Certified"}, {"value": "5\u2605", "label": "Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Engine Diagnostics", "description": "Advanced computer diagnostics for all makes and models."}, {"title": "Brake Service", "description": "Complete brake inspection, repair, and replacement."}, {"title": "Oil & Maintenance", "description": "Regular maintenance to keep your vehicle running smoothly."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["ASE Certified", "All Makes & Models", "Warranty on Parts", "Free Diagnostics"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Mark H.", "role": "Car Owner", "quote": "Finally found a mechanic I can trust. Fair and honest.", "rating": 5}, {"name": "Jennifer L.", "role": "Fleet Manager", "quote": "They service our entire fleet. Always reliable.", "rating": 5}, {"name": "Steve R.", "role": "Car Enthusiast", "quote": "Top-notch work on my classic car. Highly skilled team.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["ASE Certified", "All Makes & Models", "Warranty on Parts", "Free Diagnostics"]}}, {"type": "cta", "data": {"title": "Vehicle Need Service?", "subtitle": "Book your appointment today. Free diagnostics with any repair.", "buttonText": "Book Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_mechanic',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_mechanic', 'Organic — Mechanic', 'Organic template for mechanic services', 'mechanic', 'services',
 '{"Steel": {"primary": "#1f2937", "secondary": "#dc2626", "accent": "#f9fafb"}, "Speed": {"primary": "#dc2626", "secondary": "#f97316", "accent": "#fff7ed"}, "Chrome": {"primary": "#0f172a", "secondary": "#6366f1", "accent": "#f5f3ff"}}',
 '{"siteTitle": "Honest Mechanic", "navButtonText": "Book Service", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Expert Auto Repair", "subtitle": "Certified mechanics you can trust. Quality parts, honest service.", "buttonText": "Book Service"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["ASE Certified", "All Makes & Models", "Warranty on Parts", "Free Diagnostics"]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Engine Diagnostics", "description": "Advanced computer diagnostics for all makes and models."}, {"title": "Brake Service", "description": "Complete brake inspection, repair, and replacement."}, {"title": "Oil & Maintenance", "description": "Regular maintenance to keep your vehicle running smoothly."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Mark H.", "role": "Car Owner", "quote": "Finally found a mechanic I can trust. Fair and honest.", "rating": 5}, {"name": "Jennifer L.", "role": "Fleet Manager", "quote": "They service our entire fleet. Always reliable.", "rating": 5}, {"name": "Steve R.", "role": "Car Enthusiast", "quote": "Top-notch work on my classic car. Highly skilled team.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Vehicle Need Service?", "subtitle": "Book your appointment today. Free diagnostics with any repair.", "buttonText": "Book Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_mechanic',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_mechanic', 'Sleek — Mechanic', 'Sleek template for mechanic services', 'mechanic', 'services',
 '{"Steel": {"primary": "#1f2937", "secondary": "#dc2626", "accent": "#f9fafb"}, "Speed": {"primary": "#dc2626", "secondary": "#f97316", "accent": "#fff7ed"}, "Chrome": {"primary": "#0f172a", "secondary": "#6366f1", "accent": "#f5f3ff"}}',
 '{"siteTitle": "Apex Auto", "navButtonText": "Book Service", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Expert Auto Repair", "subtitle": "Certified mechanics you can trust. Quality parts, honest service.", "buttonText": "Book Service"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Engine Diagnostics", "description": "Advanced computer diagnostics for all makes and models."}, {"title": "Brake Service", "description": "Complete brake inspection, repair, and replacement."}, {"title": "Oil & Maintenance", "description": "Regular maintenance to keep your vehicle running smoothly."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "3000+", "label": "Cars Serviced"}, {"value": "20+", "label": "Years"}, {"value": "ASE", "label": "Certified"}, {"value": "5\u2605", "label": "Rating"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Mark H.", "role": "Car Owner", "quote": "Finally found a mechanic I can trust. Fair and honest.", "rating": 5}, {"name": "Jennifer L.", "role": "Fleet Manager", "quote": "They service our entire fleet. Always reliable.", "rating": 5}, {"name": "Steve R.", "role": "Car Enthusiast", "quote": "Top-notch work on my classic car. Highly skilled team.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Vehicle Need Service?", "subtitle": "Book your appointment today. Free diagnostics with any repair.", "buttonText": "Book Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_mechanic',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_mechanic', 'Vibrant — Mechanic', 'Vibrant template for mechanic services', 'mechanic', 'services',
 '{"Steel": {"primary": "#1f2937", "secondary": "#dc2626", "accent": "#f9fafb"}, "Speed": {"primary": "#dc2626", "secondary": "#f97316", "accent": "#fff7ed"}, "Chrome": {"primary": "#0f172a", "secondary": "#6366f1", "accent": "#f5f3ff"}}',
 '{"siteTitle": "Rev Garage", "navButtonText": "Book Service", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Expert Auto Repair", "subtitle": "Certified mechanics you can trust. Quality parts, honest service.", "buttonText": "Book Service"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "3000+", "label": "Cars Serviced"}, {"value": "20+", "label": "Years"}, {"value": "ASE", "label": "Certified"}, {"value": "5\u2605", "label": "Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Engine Diagnostics", "description": "Advanced computer diagnostics for all makes and models."}, {"title": "Brake Service", "description": "Complete brake inspection, repair, and replacement."}, {"title": "Oil & Maintenance", "description": "Regular maintenance to keep your vehicle running smoothly."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Mark H.", "role": "Car Owner", "quote": "Finally found a mechanic I can trust. Fair and honest.", "rating": 5}, {"name": "Jennifer L.", "role": "Fleet Manager", "quote": "They service our entire fleet. Always reliable.", "rating": 5}, {"name": "Steve R.", "role": "Car Enthusiast", "quote": "Top-notch work on my classic car. Highly skilled team.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Vehicle Need Service?", "subtitle": "Book your appointment today. Free diagnostics with any repair.", "buttonText": "Book Service"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_mechanic',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_trades', 'Luxe — Trades', 'Luxe template for trades services', 'trades', 'services',
 '{"Rustic": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Professional": {"primary": "#1f2937", "secondary": "#059669", "accent": "#f0fdf4"}, "Modern": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}}',
 '{"siteTitle": "Master Craft", "navButtonText": "Request Quote", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Quality Craftsmanship", "subtitle": "Expert carpentry, welding, and construction services for every project.", "buttonText": "Request Quote"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Custom Carpentry", "description": "Built-in shelving, cabinets, and custom woodwork."}, {"title": "Renovations", "description": "Kitchen, bathroom, and whole-home renovation projects."}, {"title": "Structural Work", "description": "Framing, decks, and structural repair services."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed Contractors", "Custom Solutions", "Quality Materials", "Project Guarantee"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Paul D.", "role": "Homeowner", "quote": "Beautiful custom cabinets. True craftsmen at work.", "rating": 5}, {"name": "Linda M.", "role": "Architect", "quote": "Precision and attention to detail on every project.", "rating": 5}, {"name": "Bob T.", "role": "Developer", "quote": "They handle all our construction. Reliable and skilled.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Project", "subtitle": "Contact us for a free consultation and project estimate.", "buttonText": "Request Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_trades',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_trades', 'Vivid — Trades', 'Vivid template for trades services', 'trades', 'services',
 '{"Rustic": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Professional": {"primary": "#1f2937", "secondary": "#059669", "accent": "#f0fdf4"}, "Modern": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}}',
 '{"siteTitle": "BuildForce", "navButtonText": "Request Quote", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Quality Craftsmanship", "subtitle": "Expert carpentry, welding, and construction services for every project.", "buttonText": "Request Quote"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "400+", "label": "Projects"}, {"value": "22+", "label": "Years"}, {"value": "100%", "label": "Licensed"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Custom Carpentry", "description": "Built-in shelving, cabinets, and custom woodwork."}, {"title": "Renovations", "description": "Kitchen, bathroom, and whole-home renovation projects."}, {"title": "Structural Work", "description": "Framing, decks, and structural repair services."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Paul D.", "role": "Homeowner", "quote": "Beautiful custom cabinets. True craftsmen at work.", "rating": 5}, {"name": "Linda M.", "role": "Architect", "quote": "Precision and attention to detail on every project.", "rating": 5}, {"name": "Bob T.", "role": "Developer", "quote": "They handle all our construction. Reliable and skilled.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Project", "subtitle": "Contact us for a free consultation and project estimate.", "buttonText": "Request Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_trades',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_trades', 'Airy — Trades', 'Airy template for trades services', 'trades', 'services',
 '{"Rustic": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Professional": {"primary": "#1f2937", "secondary": "#059669", "accent": "#f0fdf4"}, "Modern": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}}',
 '{"siteTitle": "Craft & Build", "navButtonText": "Request Quote", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Quality Craftsmanship", "subtitle": "Expert carpentry, welding, and construction services for every project.", "buttonText": "Request Quote"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Licensed Contractors", "Custom Solutions", "Quality Materials", "Project Guarantee"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed Contractors", "Custom Solutions", "Quality Materials", "Project Guarantee"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Paul D.", "role": "Homeowner", "quote": "Beautiful custom cabinets. True craftsmen at work.", "rating": 5}, {"name": "Linda M.", "role": "Architect", "quote": "Precision and attention to detail on every project.", "rating": 5}, {"name": "Bob T.", "role": "Developer", "quote": "They handle all our construction. Reliable and skilled.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Start Your Project", "subtitle": "Contact us for a free consultation and project estimate.", "buttonText": "Request Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_trades',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_trades', 'Edge — Trades', 'Edge template for trades services', 'trades', 'services',
 '{"Rustic": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Professional": {"primary": "#1f2937", "secondary": "#059669", "accent": "#f0fdf4"}, "Modern": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}}',
 '{"siteTitle": "TradeWorks", "navButtonText": "Request Quote", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Quality Craftsmanship", "subtitle": "Expert carpentry, welding, and construction services for every project.", "buttonText": "Request Quote"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "400+", "label": "Projects"}, {"value": "22+", "label": "Years"}, {"value": "100%", "label": "Licensed"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Custom Carpentry", "description": "Built-in shelving, cabinets, and custom woodwork."}, {"title": "Renovations", "description": "Kitchen, bathroom, and whole-home renovation projects."}, {"title": "Structural Work", "description": "Framing, decks, and structural repair services."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Paul D.", "role": "Homeowner", "quote": "Beautiful custom cabinets. True craftsmen at work.", "rating": 5}, {"name": "Linda M.", "role": "Architect", "quote": "Precision and attention to detail on every project.", "rating": 5}, {"name": "Bob T.", "role": "Developer", "quote": "They handle all our construction. Reliable and skilled.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Project", "subtitle": "Contact us for a free consultation and project estimate.", "buttonText": "Request Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_trades',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_trades', 'Classic — Trades', 'Classic template for trades services', 'trades', 'services',
 '{"Rustic": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Professional": {"primary": "#1f2937", "secondary": "#059669", "accent": "#f0fdf4"}, "Modern": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}}',
 '{"siteTitle": "Pro Trades", "navButtonText": "Request Quote", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Quality Craftsmanship", "subtitle": "Expert carpentry, welding, and construction services for every project.", "buttonText": "Request Quote"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "400+", "label": "Projects"}, {"value": "22+", "label": "Years"}, {"value": "100%", "label": "Licensed"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Custom Carpentry", "description": "Built-in shelving, cabinets, and custom woodwork."}, {"title": "Renovations", "description": "Kitchen, bathroom, and whole-home renovation projects."}, {"title": "Structural Work", "description": "Framing, decks, and structural repair services."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed Contractors", "Custom Solutions", "Quality Materials", "Project Guarantee"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Paul D.", "role": "Homeowner", "quote": "Beautiful custom cabinets. True craftsmen at work.", "rating": 5}, {"name": "Linda M.", "role": "Architect", "quote": "Precision and attention to detail on every project.", "rating": 5}, {"name": "Bob T.", "role": "Developer", "quote": "They handle all our construction. Reliable and skilled.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Licensed Contractors", "Custom Solutions", "Quality Materials", "Project Guarantee"]}}, {"type": "cta", "data": {"title": "Start Your Project", "subtitle": "Contact us for a free consultation and project estimate.", "buttonText": "Request Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_trades',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_trades', 'Organic — Trades', 'Organic template for trades services', 'trades', 'services',
 '{"Rustic": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Professional": {"primary": "#1f2937", "secondary": "#059669", "accent": "#f0fdf4"}, "Modern": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}}',
 '{"siteTitle": "Timber & Stone", "navButtonText": "Request Quote", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Quality Craftsmanship", "subtitle": "Expert carpentry, welding, and construction services for every project.", "buttonText": "Request Quote"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed Contractors", "Custom Solutions", "Quality Materials", "Project Guarantee"]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Custom Carpentry", "description": "Built-in shelving, cabinets, and custom woodwork."}, {"title": "Renovations", "description": "Kitchen, bathroom, and whole-home renovation projects."}, {"title": "Structural Work", "description": "Framing, decks, and structural repair services."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Paul D.", "role": "Homeowner", "quote": "Beautiful custom cabinets. True craftsmen at work.", "rating": 5}, {"name": "Linda M.", "role": "Architect", "quote": "Precision and attention to detail on every project.", "rating": 5}, {"name": "Bob T.", "role": "Developer", "quote": "They handle all our construction. Reliable and skilled.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Project", "subtitle": "Contact us for a free consultation and project estimate.", "buttonText": "Request Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_trades',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_trades', 'Sleek — Trades', 'Sleek template for trades services', 'trades', 'services',
 '{"Rustic": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Professional": {"primary": "#1f2937", "secondary": "#059669", "accent": "#f0fdf4"}, "Modern": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}}',
 '{"siteTitle": "Construct Co", "navButtonText": "Request Quote", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Quality Craftsmanship", "subtitle": "Expert carpentry, welding, and construction services for every project.", "buttonText": "Request Quote"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Custom Carpentry", "description": "Built-in shelving, cabinets, and custom woodwork."}, {"title": "Renovations", "description": "Kitchen, bathroom, and whole-home renovation projects."}, {"title": "Structural Work", "description": "Framing, decks, and structural repair services."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "400+", "label": "Projects"}, {"value": "22+", "label": "Years"}, {"value": "100%", "label": "Licensed"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Paul D.", "role": "Homeowner", "quote": "Beautiful custom cabinets. True craftsmen at work.", "rating": 5}, {"name": "Linda M.", "role": "Architect", "quote": "Precision and attention to detail on every project.", "rating": 5}, {"name": "Bob T.", "role": "Developer", "quote": "They handle all our construction. Reliable and skilled.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Project", "subtitle": "Contact us for a free consultation and project estimate.", "buttonText": "Request Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_trades',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_trades', 'Vibrant — Trades', 'Vibrant template for trades services', 'trades', 'services',
 '{"Rustic": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Professional": {"primary": "#1f2937", "secondary": "#059669", "accent": "#f0fdf4"}, "Modern": {"primary": "#334155", "secondary": "#3b82f6", "accent": "#f1f5f9"}}',
 '{"siteTitle": "BuildBright", "navButtonText": "Request Quote", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Quality Craftsmanship", "subtitle": "Expert carpentry, welding, and construction services for every project.", "buttonText": "Request Quote"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "400+", "label": "Projects"}, {"value": "22+", "label": "Years"}, {"value": "100%", "label": "Licensed"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Custom Carpentry", "description": "Built-in shelving, cabinets, and custom woodwork."}, {"title": "Renovations", "description": "Kitchen, bathroom, and whole-home renovation projects."}, {"title": "Structural Work", "description": "Framing, decks, and structural repair services."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Paul D.", "role": "Homeowner", "quote": "Beautiful custom cabinets. True craftsmen at work.", "rating": 5}, {"name": "Linda M.", "role": "Architect", "quote": "Precision and attention to detail on every project.", "rating": 5}, {"name": "Bob T.", "role": "Developer", "quote": "They handle all our construction. Reliable and skilled.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Start Your Project", "subtitle": "Contact us for a free consultation and project estimate.", "buttonText": "Request Quote"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_trades',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_cleaning', 'Luxe — Cleaning', 'Luxe template for cleaning services', 'cleaning', 'services',
 '{"Fresh": {"primary": "#0d9488", "secondary": "#5eead4", "accent": "#f0fdfa"}, "Sky": {"primary": "#0369a1", "secondary": "#38bdf8", "accent": "#f0f9ff"}, "Mint": {"primary": "#059669", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Pristine Clean", "navButtonText": "Book Cleaning", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Professional Cleaning Services", "subtitle": "Spotless results for homes and offices. Eco-friendly products available.", "buttonText": "Book Cleaning"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Deep Cleaning", "description": "Thorough top-to-bottom cleaning for a fresh start."}, {"title": "Regular Service", "description": "Weekly or bi-weekly cleaning to keep spaces spotless."}, {"title": "Move In/Out", "description": "Complete cleaning for moving transitions."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Eco-Friendly Products", "Background Checked", "Satisfaction Guaranteed", "Flexible Scheduling"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Emily S.", "role": "Homeowner", "quote": "My house has never been this clean. Amazing service!", "rating": 5}, {"name": "Dan R.", "role": "Office Manager", "quote": "Reliable weekly service. Our office always looks great.", "rating": 5}, {"name": "Nina P.", "role": "Realtor", "quote": "Best move-out cleaning service. My clients love them.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Ready for a Clean Space?", "subtitle": "Book your cleaning today. First-time customers get 20% off!", "buttonText": "Book Cleaning"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_cleaning',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_cleaning', 'Vivid — Cleaning', 'Vivid template for cleaning services', 'cleaning', 'services',
 '{"Fresh": {"primary": "#0d9488", "secondary": "#5eead4", "accent": "#f0fdfa"}, "Sky": {"primary": "#0369a1", "secondary": "#38bdf8", "accent": "#f0f9ff"}, "Mint": {"primary": "#059669", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "SparkleForce", "navButtonText": "Book Cleaning", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Professional Cleaning Services", "subtitle": "Spotless results for homes and offices. Eco-friendly products available.", "buttonText": "Book Cleaning"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "700+", "label": "Homes Cleaned"}, {"value": "10+", "label": "Years"}, {"value": "100%", "label": "Eco-Friendly"}, {"value": "5\u2605", "label": "Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Deep Cleaning", "description": "Thorough top-to-bottom cleaning for a fresh start."}, {"title": "Regular Service", "description": "Weekly or bi-weekly cleaning to keep spaces spotless."}, {"title": "Move In/Out", "description": "Complete cleaning for moving transitions."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Emily S.", "role": "Homeowner", "quote": "My house has never been this clean. Amazing service!", "rating": 5}, {"name": "Dan R.", "role": "Office Manager", "quote": "Reliable weekly service. Our office always looks great.", "rating": 5}, {"name": "Nina P.", "role": "Realtor", "quote": "Best move-out cleaning service. My clients love them.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Ready for a Clean Space?", "subtitle": "Book your cleaning today. First-time customers get 20% off!", "buttonText": "Book Cleaning"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_cleaning',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_cleaning', 'Airy — Cleaning', 'Airy template for cleaning services', 'cleaning', 'services',
 '{"Fresh": {"primary": "#0d9488", "secondary": "#5eead4", "accent": "#f0fdfa"}, "Sky": {"primary": "#0369a1", "secondary": "#38bdf8", "accent": "#f0f9ff"}, "Mint": {"primary": "#059669", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Fresh & Clean", "navButtonText": "Book Cleaning", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Professional Cleaning Services", "subtitle": "Spotless results for homes and offices. Eco-friendly products available.", "buttonText": "Book Cleaning"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Eco-Friendly Products", "Background Checked", "Satisfaction Guaranteed", "Flexible Scheduling"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Eco-Friendly Products", "Background Checked", "Satisfaction Guaranteed", "Flexible Scheduling"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Emily S.", "role": "Homeowner", "quote": "My house has never been this clean. Amazing service!", "rating": 5}, {"name": "Dan R.", "role": "Office Manager", "quote": "Reliable weekly service. Our office always looks great.", "rating": 5}, {"name": "Nina P.", "role": "Realtor", "quote": "Best move-out cleaning service. My clients love them.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Ready for a Clean Space?", "subtitle": "Book your cleaning today. First-time customers get 20% off!", "buttonText": "Book Cleaning"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_cleaning',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_cleaning', 'Edge — Cleaning', 'Edge template for cleaning services', 'cleaning', 'services',
 '{"Fresh": {"primary": "#0d9488", "secondary": "#5eead4", "accent": "#f0fdfa"}, "Sky": {"primary": "#0369a1", "secondary": "#38bdf8", "accent": "#f0f9ff"}, "Mint": {"primary": "#059669", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "CleanTech Pro", "navButtonText": "Book Cleaning", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Professional Cleaning Services", "subtitle": "Spotless results for homes and offices. Eco-friendly products available.", "buttonText": "Book Cleaning"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "700+", "label": "Homes Cleaned"}, {"value": "10+", "label": "Years"}, {"value": "100%", "label": "Eco-Friendly"}, {"value": "5\u2605", "label": "Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Deep Cleaning", "description": "Thorough top-to-bottom cleaning for a fresh start."}, {"title": "Regular Service", "description": "Weekly or bi-weekly cleaning to keep spaces spotless."}, {"title": "Move In/Out", "description": "Complete cleaning for moving transitions."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Emily S.", "role": "Homeowner", "quote": "My house has never been this clean. Amazing service!", "rating": 5}, {"name": "Dan R.", "role": "Office Manager", "quote": "Reliable weekly service. Our office always looks great.", "rating": 5}, {"name": "Nina P.", "role": "Realtor", "quote": "Best move-out cleaning service. My clients love them.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Ready for a Clean Space?", "subtitle": "Book your cleaning today. First-time customers get 20% off!", "buttonText": "Book Cleaning"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_cleaning',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_cleaning', 'Classic — Cleaning', 'Classic template for cleaning services', 'cleaning', 'services',
 '{"Fresh": {"primary": "#0d9488", "secondary": "#5eead4", "accent": "#f0fdfa"}, "Sky": {"primary": "#0369a1", "secondary": "#38bdf8", "accent": "#f0f9ff"}, "Mint": {"primary": "#059669", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Expert Cleaners", "navButtonText": "Book Cleaning", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Professional Cleaning Services", "subtitle": "Spotless results for homes and offices. Eco-friendly products available.", "buttonText": "Book Cleaning"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "700+", "label": "Homes Cleaned"}, {"value": "10+", "label": "Years"}, {"value": "100%", "label": "Eco-Friendly"}, {"value": "5\u2605", "label": "Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Deep Cleaning", "description": "Thorough top-to-bottom cleaning for a fresh start."}, {"title": "Regular Service", "description": "Weekly or bi-weekly cleaning to keep spaces spotless."}, {"title": "Move In/Out", "description": "Complete cleaning for moving transitions."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Eco-Friendly Products", "Background Checked", "Satisfaction Guaranteed", "Flexible Scheduling"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Emily S.", "role": "Homeowner", "quote": "My house has never been this clean. Amazing service!", "rating": 5}, {"name": "Dan R.", "role": "Office Manager", "quote": "Reliable weekly service. Our office always looks great.", "rating": 5}, {"name": "Nina P.", "role": "Realtor", "quote": "Best move-out cleaning service. My clients love them.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Eco-Friendly Products", "Background Checked", "Satisfaction Guaranteed", "Flexible Scheduling"]}}, {"type": "cta", "data": {"title": "Ready for a Clean Space?", "subtitle": "Book your cleaning today. First-time customers get 20% off!", "buttonText": "Book Cleaning"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_cleaning',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_cleaning', 'Organic — Cleaning', 'Organic template for cleaning services', 'cleaning', 'services',
 '{"Fresh": {"primary": "#0d9488", "secondary": "#5eead4", "accent": "#f0fdfa"}, "Sky": {"primary": "#0369a1", "secondary": "#38bdf8", "accent": "#f0f9ff"}, "Mint": {"primary": "#059669", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Pure Clean", "navButtonText": "Book Cleaning", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Professional Cleaning Services", "subtitle": "Spotless results for homes and offices. Eco-friendly products available.", "buttonText": "Book Cleaning"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Eco-Friendly Products", "Background Checked", "Satisfaction Guaranteed", "Flexible Scheduling"]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Deep Cleaning", "description": "Thorough top-to-bottom cleaning for a fresh start."}, {"title": "Regular Service", "description": "Weekly or bi-weekly cleaning to keep spaces spotless."}, {"title": "Move In/Out", "description": "Complete cleaning for moving transitions."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Emily S.", "role": "Homeowner", "quote": "My house has never been this clean. Amazing service!", "rating": 5}, {"name": "Dan R.", "role": "Office Manager", "quote": "Reliable weekly service. Our office always looks great.", "rating": 5}, {"name": "Nina P.", "role": "Realtor", "quote": "Best move-out cleaning service. My clients love them.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Ready for a Clean Space?", "subtitle": "Book your cleaning today. First-time customers get 20% off!", "buttonText": "Book Cleaning"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_cleaning',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_cleaning', 'Sleek — Cleaning', 'Sleek template for cleaning services', 'cleaning', 'services',
 '{"Fresh": {"primary": "#0d9488", "secondary": "#5eead4", "accent": "#f0fdfa"}, "Sky": {"primary": "#0369a1", "secondary": "#38bdf8", "accent": "#f0f9ff"}, "Mint": {"primary": "#059669", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Spotless Co", "navButtonText": "Book Cleaning", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Professional Cleaning Services", "subtitle": "Spotless results for homes and offices. Eco-friendly products available.", "buttonText": "Book Cleaning"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Deep Cleaning", "description": "Thorough top-to-bottom cleaning for a fresh start."}, {"title": "Regular Service", "description": "Weekly or bi-weekly cleaning to keep spaces spotless."}, {"title": "Move In/Out", "description": "Complete cleaning for moving transitions."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "700+", "label": "Homes Cleaned"}, {"value": "10+", "label": "Years"}, {"value": "100%", "label": "Eco-Friendly"}, {"value": "5\u2605", "label": "Rating"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Emily S.", "role": "Homeowner", "quote": "My house has never been this clean. Amazing service!", "rating": 5}, {"name": "Dan R.", "role": "Office Manager", "quote": "Reliable weekly service. Our office always looks great.", "rating": 5}, {"name": "Nina P.", "role": "Realtor", "quote": "Best move-out cleaning service. My clients love them.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Ready for a Clean Space?", "subtitle": "Book your cleaning today. First-time customers get 20% off!", "buttonText": "Book Cleaning"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_cleaning',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_cleaning', 'Vibrant — Cleaning', 'Vibrant template for cleaning services', 'cleaning', 'services',
 '{"Fresh": {"primary": "#0d9488", "secondary": "#5eead4", "accent": "#f0fdfa"}, "Sky": {"primary": "#0369a1", "secondary": "#38bdf8", "accent": "#f0f9ff"}, "Mint": {"primary": "#059669", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "ShineTime", "navButtonText": "Book Cleaning", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Professional Cleaning Services", "subtitle": "Spotless results for homes and offices. Eco-friendly products available.", "buttonText": "Book Cleaning"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "700+", "label": "Homes Cleaned"}, {"value": "10+", "label": "Years"}, {"value": "100%", "label": "Eco-Friendly"}, {"value": "5\u2605", "label": "Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Deep Cleaning", "description": "Thorough top-to-bottom cleaning for a fresh start."}, {"title": "Regular Service", "description": "Weekly or bi-weekly cleaning to keep spaces spotless."}, {"title": "Move In/Out", "description": "Complete cleaning for moving transitions."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Emily S.", "role": "Homeowner", "quote": "My house has never been this clean. Amazing service!", "rating": 5}, {"name": "Dan R.", "role": "Office Manager", "quote": "Reliable weekly service. Our office always looks great.", "rating": 5}, {"name": "Nina P.", "role": "Realtor", "quote": "Best move-out cleaning service. My clients love them.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Ready for a Clean Space?", "subtitle": "Book your cleaning today. First-time customers get 20% off!", "buttonText": "Book Cleaning"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_cleaning',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_landscaping', 'Luxe — Landscaping', 'Luxe template for landscaping services', 'landscaping', 'services',
 '{"Garden": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}, "Earth": {"primary": "#78350f", "secondary": "#84cc16", "accent": "#fefce8"}, "Forest": {"primary": "#064e3b", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Eden Gardens", "navButtonText": "Get Estimate", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Beautiful Landscapes", "subtitle": "Transform your outdoor space with our professional landscaping services.", "buttonText": "Get Estimate"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Lawn Care", "description": "Mowing, edging, fertilizing, and weed control."}, {"title": "Garden Design", "description": "Custom garden design and planting services."}, {"title": "Hardscaping", "description": "Patios, walkways, retaining walls, and outdoor living spaces."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed & Insured", "Custom Designs", "Organic Options", "Seasonal Plans"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Patricia H.", "role": "Homeowner", "quote": "Our yard has never looked better. True artists!", "rating": 5}, {"name": "Robert J.", "role": "HOA President", "quote": "They maintain our entire community beautifully.", "rating": 5}, {"name": "Susan M.", "role": "Business Owner", "quote": "Our commercial property looks amazing year-round.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Transform Your Yard", "subtitle": "Get a free landscape design consultation today.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_landscaping',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_landscaping', 'Vivid — Landscaping', 'Vivid template for landscaping services', 'landscaping', 'services',
 '{"Garden": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}, "Earth": {"primary": "#78350f", "secondary": "#84cc16", "accent": "#fefce8"}, "Forest": {"primary": "#064e3b", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "GreenForce", "navButtonText": "Get Estimate", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Beautiful Landscapes", "subtitle": "Transform your outdoor space with our professional landscaping services.", "buttonText": "Get Estimate"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "300+", "label": "Properties"}, {"value": "12+", "label": "Years"}, {"value": "100%", "label": "Organic Options"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Lawn Care", "description": "Mowing, edging, fertilizing, and weed control."}, {"title": "Garden Design", "description": "Custom garden design and planting services."}, {"title": "Hardscaping", "description": "Patios, walkways, retaining walls, and outdoor living spaces."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Patricia H.", "role": "Homeowner", "quote": "Our yard has never looked better. True artists!", "rating": 5}, {"name": "Robert J.", "role": "HOA President", "quote": "They maintain our entire community beautifully.", "rating": 5}, {"name": "Susan M.", "role": "Business Owner", "quote": "Our commercial property looks amazing year-round.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Transform Your Yard", "subtitle": "Get a free landscape design consultation today.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_landscaping',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_landscaping', 'Airy — Landscaping', 'Airy template for landscaping services', 'landscaping', 'services',
 '{"Garden": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}, "Earth": {"primary": "#78350f", "secondary": "#84cc16", "accent": "#fefce8"}, "Forest": {"primary": "#064e3b", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Green Thumb", "navButtonText": "Get Estimate", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Beautiful Landscapes", "subtitle": "Transform your outdoor space with our professional landscaping services.", "buttonText": "Get Estimate"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Licensed & Insured", "Custom Designs", "Organic Options", "Seasonal Plans"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed & Insured", "Custom Designs", "Organic Options", "Seasonal Plans"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Patricia H.", "role": "Homeowner", "quote": "Our yard has never looked better. True artists!", "rating": 5}, {"name": "Robert J.", "role": "HOA President", "quote": "They maintain our entire community beautifully.", "rating": 5}, {"name": "Susan M.", "role": "Business Owner", "quote": "Our commercial property looks amazing year-round.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Transform Your Yard", "subtitle": "Get a free landscape design consultation today.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_landscaping',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_landscaping', 'Edge — Landscaping', 'Edge template for landscaping services', 'landscaping', 'services',
 '{"Garden": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}, "Earth": {"primary": "#78350f", "secondary": "#84cc16", "accent": "#fefce8"}, "Forest": {"primary": "#064e3b", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "LandTech", "navButtonText": "Get Estimate", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Beautiful Landscapes", "subtitle": "Transform your outdoor space with our professional landscaping services.", "buttonText": "Get Estimate"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "300+", "label": "Properties"}, {"value": "12+", "label": "Years"}, {"value": "100%", "label": "Organic Options"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Lawn Care", "description": "Mowing, edging, fertilizing, and weed control."}, {"title": "Garden Design", "description": "Custom garden design and planting services."}, {"title": "Hardscaping", "description": "Patios, walkways, retaining walls, and outdoor living spaces."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Patricia H.", "role": "Homeowner", "quote": "Our yard has never looked better. True artists!", "rating": 5}, {"name": "Robert J.", "role": "HOA President", "quote": "They maintain our entire community beautifully.", "rating": 5}, {"name": "Susan M.", "role": "Business Owner", "quote": "Our commercial property looks amazing year-round.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Transform Your Yard", "subtitle": "Get a free landscape design consultation today.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_landscaping',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_landscaping', 'Classic — Landscaping', 'Classic template for landscaping services', 'landscaping', 'services',
 '{"Garden": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}, "Earth": {"primary": "#78350f", "secondary": "#84cc16", "accent": "#fefce8"}, "Forest": {"primary": "#064e3b", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Pro Landscaping", "navButtonText": "Get Estimate", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Beautiful Landscapes", "subtitle": "Transform your outdoor space with our professional landscaping services.", "buttonText": "Get Estimate"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "300+", "label": "Properties"}, {"value": "12+", "label": "Years"}, {"value": "100%", "label": "Organic Options"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Lawn Care", "description": "Mowing, edging, fertilizing, and weed control."}, {"title": "Garden Design", "description": "Custom garden design and planting services."}, {"title": "Hardscaping", "description": "Patios, walkways, retaining walls, and outdoor living spaces."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed & Insured", "Custom Designs", "Organic Options", "Seasonal Plans"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Patricia H.", "role": "Homeowner", "quote": "Our yard has never looked better. True artists!", "rating": 5}, {"name": "Robert J.", "role": "HOA President", "quote": "They maintain our entire community beautifully.", "rating": 5}, {"name": "Susan M.", "role": "Business Owner", "quote": "Our commercial property looks amazing year-round.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Licensed & Insured", "Custom Designs", "Organic Options", "Seasonal Plans"]}}, {"type": "cta", "data": {"title": "Transform Your Yard", "subtitle": "Get a free landscape design consultation today.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_landscaping',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_landscaping', 'Organic — Landscaping', 'Organic template for landscaping services', 'landscaping', 'services',
 '{"Garden": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}, "Earth": {"primary": "#78350f", "secondary": "#84cc16", "accent": "#fefce8"}, "Forest": {"primary": "#064e3b", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Nature''s Way", "navButtonText": "Get Estimate", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Beautiful Landscapes", "subtitle": "Transform your outdoor space with our professional landscaping services.", "buttonText": "Get Estimate"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Licensed & Insured", "Custom Designs", "Organic Options", "Seasonal Plans"]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Lawn Care", "description": "Mowing, edging, fertilizing, and weed control."}, {"title": "Garden Design", "description": "Custom garden design and planting services."}, {"title": "Hardscaping", "description": "Patios, walkways, retaining walls, and outdoor living spaces."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Patricia H.", "role": "Homeowner", "quote": "Our yard has never looked better. True artists!", "rating": 5}, {"name": "Robert J.", "role": "HOA President", "quote": "They maintain our entire community beautifully.", "rating": 5}, {"name": "Susan M.", "role": "Business Owner", "quote": "Our commercial property looks amazing year-round.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Transform Your Yard", "subtitle": "Get a free landscape design consultation today.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_landscaping',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_landscaping', 'Sleek — Landscaping', 'Sleek template for landscaping services', 'landscaping', 'services',
 '{"Garden": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}, "Earth": {"primary": "#78350f", "secondary": "#84cc16", "accent": "#fefce8"}, "Forest": {"primary": "#064e3b", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Terrain Co", "navButtonText": "Get Estimate", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Beautiful Landscapes", "subtitle": "Transform your outdoor space with our professional landscaping services.", "buttonText": "Get Estimate"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Lawn Care", "description": "Mowing, edging, fertilizing, and weed control."}, {"title": "Garden Design", "description": "Custom garden design and planting services."}, {"title": "Hardscaping", "description": "Patios, walkways, retaining walls, and outdoor living spaces."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "300+", "label": "Properties"}, {"value": "12+", "label": "Years"}, {"value": "100%", "label": "Organic Options"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Patricia H.", "role": "Homeowner", "quote": "Our yard has never looked better. True artists!", "rating": 5}, {"name": "Robert J.", "role": "HOA President", "quote": "They maintain our entire community beautifully.", "rating": 5}, {"name": "Susan M.", "role": "Business Owner", "quote": "Our commercial property looks amazing year-round.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Transform Your Yard", "subtitle": "Get a free landscape design consultation today.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_landscaping',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_landscaping', 'Vibrant — Landscaping', 'Vibrant template for landscaping services', 'landscaping', 'services',
 '{"Garden": {"primary": "#14532d", "secondary": "#22c55e", "accent": "#f0fdf4"}, "Earth": {"primary": "#78350f", "secondary": "#84cc16", "accent": "#fefce8"}, "Forest": {"primary": "#064e3b", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "GardenGlow", "navButtonText": "Get Estimate", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Beautiful Landscapes", "subtitle": "Transform your outdoor space with our professional landscaping services.", "buttonText": "Get Estimate"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "300+", "label": "Properties"}, {"value": "12+", "label": "Years"}, {"value": "100%", "label": "Organic Options"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Lawn Care", "description": "Mowing, edging, fertilizing, and weed control."}, {"title": "Garden Design", "description": "Custom garden design and planting services."}, {"title": "Hardscaping", "description": "Patios, walkways, retaining walls, and outdoor living spaces."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Patricia H.", "role": "Homeowner", "quote": "Our yard has never looked better. True artists!", "rating": 5}, {"name": "Robert J.", "role": "HOA President", "quote": "They maintain our entire community beautifully.", "rating": 5}, {"name": "Susan M.", "role": "Business Owner", "quote": "Our commercial property looks amazing year-round.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Transform Your Yard", "subtitle": "Get a free landscape design consultation today.", "buttonText": "Get Estimate"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_landscaping',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_consulting', 'Luxe — Consulting', 'Luxe template for consulting services', 'consulting', 'services',
 '{"Navy Gold": {"primary": "#1e3a5f", "secondary": "#d97706", "accent": "#fffbeb"}, "Slate": {"primary": "#1e293b", "secondary": "#6366f1", "accent": "#f5f3ff"}, "Professional": {"primary": "#111827", "secondary": "#3b82f6", "accent": "#eff6ff"}}',
 '{"siteTitle": "Apex Consulting", "navButtonText": "Book Consultation", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Strategic Business Consulting", "subtitle": "Expert guidance to help your business grow and thrive in any market.", "buttonText": "Book Consultation"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Business Strategy", "description": "Develop winning strategies for growth and competitive advantage."}, {"title": "Operations", "description": "Optimize processes and systems for maximum efficiency."}, {"title": "Digital Transformation", "description": "Modernize your business with the latest technology solutions."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Proven Methodology", "Industry Expertise", "Data-Driven Insights", "Ongoing Support"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Richard C.", "role": "CEO", "quote": "Transformed our company strategy. Revenue doubled.", "rating": 5}, {"name": "Maria G.", "role": "Startup Founder", "quote": "Invaluable guidance during our growth phase.", "rating": 5}, {"name": "Alex W.", "role": "VP Operations", "quote": "Streamlined our operations and saved us millions.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Ready to Grow?", "subtitle": "Schedule a free 30-minute strategy session with our experts.", "buttonText": "Book Consultation"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_consulting',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_consulting', 'Vivid — Consulting', 'Vivid template for consulting services', 'consulting', 'services',
 '{"Navy Gold": {"primary": "#1e3a5f", "secondary": "#d97706", "accent": "#fffbeb"}, "Slate": {"primary": "#1e293b", "secondary": "#6366f1", "accent": "#f5f3ff"}, "Professional": {"primary": "#111827", "secondary": "#3b82f6", "accent": "#eff6ff"}}',
 '{"siteTitle": "Catalyst Co", "navButtonText": "Book Consultation", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Strategic Business Consulting", "subtitle": "Expert guidance to help your business grow and thrive in any market.", "buttonText": "Book Consultation"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "200+", "label": "Clients Served"}, {"value": "15+", "label": "Years"}, {"value": "$50M+", "label": "Revenue Generated"}, {"value": "95%", "label": "Retention"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Business Strategy", "description": "Develop winning strategies for growth and competitive advantage."}, {"title": "Operations", "description": "Optimize processes and systems for maximum efficiency."}, {"title": "Digital Transformation", "description": "Modernize your business with the latest technology solutions."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Richard C.", "role": "CEO", "quote": "Transformed our company strategy. Revenue doubled.", "rating": 5}, {"name": "Maria G.", "role": "Startup Founder", "quote": "Invaluable guidance during our growth phase.", "rating": 5}, {"name": "Alex W.", "role": "VP Operations", "quote": "Streamlined our operations and saved us millions.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Ready to Grow?", "subtitle": "Schedule a free 30-minute strategy session with our experts.", "buttonText": "Book Consultation"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_consulting',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_consulting', 'Airy — Consulting', 'Airy template for consulting services', 'consulting', 'services',
 '{"Navy Gold": {"primary": "#1e3a5f", "secondary": "#d97706", "accent": "#fffbeb"}, "Slate": {"primary": "#1e293b", "secondary": "#6366f1", "accent": "#f5f3ff"}, "Professional": {"primary": "#111827", "secondary": "#3b82f6", "accent": "#eff6ff"}}',
 '{"siteTitle": "Clear Path", "navButtonText": "Book Consultation", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Strategic Business Consulting", "subtitle": "Expert guidance to help your business grow and thrive in any market.", "buttonText": "Book Consultation"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Proven Methodology", "Industry Expertise", "Data-Driven Insights", "Ongoing Support"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Proven Methodology", "Industry Expertise", "Data-Driven Insights", "Ongoing Support"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Richard C.", "role": "CEO", "quote": "Transformed our company strategy. Revenue doubled.", "rating": 5}, {"name": "Maria G.", "role": "Startup Founder", "quote": "Invaluable guidance during our growth phase.", "rating": 5}, {"name": "Alex W.", "role": "VP Operations", "quote": "Streamlined our operations and saved us millions.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Ready to Grow?", "subtitle": "Schedule a free 30-minute strategy session with our experts.", "buttonText": "Book Consultation"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_consulting',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_consulting', 'Edge — Consulting', 'Edge template for consulting services', 'consulting', 'services',
 '{"Navy Gold": {"primary": "#1e3a5f", "secondary": "#d97706", "accent": "#fffbeb"}, "Slate": {"primary": "#1e293b", "secondary": "#6366f1", "accent": "#f5f3ff"}, "Professional": {"primary": "#111827", "secondary": "#3b82f6", "accent": "#eff6ff"}}',
 '{"siteTitle": "StratEdge", "navButtonText": "Book Consultation", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Strategic Business Consulting", "subtitle": "Expert guidance to help your business grow and thrive in any market.", "buttonText": "Book Consultation"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "200+", "label": "Clients Served"}, {"value": "15+", "label": "Years"}, {"value": "$50M+", "label": "Revenue Generated"}, {"value": "95%", "label": "Retention"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Business Strategy", "description": "Develop winning strategies for growth and competitive advantage."}, {"title": "Operations", "description": "Optimize processes and systems for maximum efficiency."}, {"title": "Digital Transformation", "description": "Modernize your business with the latest technology solutions."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Richard C.", "role": "CEO", "quote": "Transformed our company strategy. Revenue doubled.", "rating": 5}, {"name": "Maria G.", "role": "Startup Founder", "quote": "Invaluable guidance during our growth phase.", "rating": 5}, {"name": "Alex W.", "role": "VP Operations", "quote": "Streamlined our operations and saved us millions.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Ready to Grow?", "subtitle": "Schedule a free 30-minute strategy session with our experts.", "buttonText": "Book Consultation"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_consulting',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_consulting', 'Classic — Consulting', 'Classic template for consulting services', 'consulting', 'services',
 '{"Navy Gold": {"primary": "#1e3a5f", "secondary": "#d97706", "accent": "#fffbeb"}, "Slate": {"primary": "#1e293b", "secondary": "#6366f1", "accent": "#f5f3ff"}, "Professional": {"primary": "#111827", "secondary": "#3b82f6", "accent": "#eff6ff"}}',
 '{"siteTitle": "Premier Consulting", "navButtonText": "Book Consultation", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Strategic Business Consulting", "subtitle": "Expert guidance to help your business grow and thrive in any market.", "buttonText": "Book Consultation"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "200+", "label": "Clients Served"}, {"value": "15+", "label": "Years"}, {"value": "$50M+", "label": "Revenue Generated"}, {"value": "95%", "label": "Retention"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Business Strategy", "description": "Develop winning strategies for growth and competitive advantage."}, {"title": "Operations", "description": "Optimize processes and systems for maximum efficiency."}, {"title": "Digital Transformation", "description": "Modernize your business with the latest technology solutions."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Proven Methodology", "Industry Expertise", "Data-Driven Insights", "Ongoing Support"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Richard C.", "role": "CEO", "quote": "Transformed our company strategy. Revenue doubled.", "rating": 5}, {"name": "Maria G.", "role": "Startup Founder", "quote": "Invaluable guidance during our growth phase.", "rating": 5}, {"name": "Alex W.", "role": "VP Operations", "quote": "Streamlined our operations and saved us millions.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Proven Methodology", "Industry Expertise", "Data-Driven Insights", "Ongoing Support"]}}, {"type": "cta", "data": {"title": "Ready to Grow?", "subtitle": "Schedule a free 30-minute strategy session with our experts.", "buttonText": "Book Consultation"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_consulting',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_consulting', 'Organic — Consulting', 'Organic template for consulting services', 'consulting', 'services',
 '{"Navy Gold": {"primary": "#1e3a5f", "secondary": "#d97706", "accent": "#fffbeb"}, "Slate": {"primary": "#1e293b", "secondary": "#6366f1", "accent": "#f5f3ff"}, "Professional": {"primary": "#111827", "secondary": "#3b82f6", "accent": "#eff6ff"}}',
 '{"siteTitle": "Thoughtful Counsel", "navButtonText": "Book Consultation", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Strategic Business Consulting", "subtitle": "Expert guidance to help your business grow and thrive in any market.", "buttonText": "Book Consultation"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Proven Methodology", "Industry Expertise", "Data-Driven Insights", "Ongoing Support"]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Business Strategy", "description": "Develop winning strategies for growth and competitive advantage."}, {"title": "Operations", "description": "Optimize processes and systems for maximum efficiency."}, {"title": "Digital Transformation", "description": "Modernize your business with the latest technology solutions."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Richard C.", "role": "CEO", "quote": "Transformed our company strategy. Revenue doubled.", "rating": 5}, {"name": "Maria G.", "role": "Startup Founder", "quote": "Invaluable guidance during our growth phase.", "rating": 5}, {"name": "Alex W.", "role": "VP Operations", "quote": "Streamlined our operations and saved us millions.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Ready to Grow?", "subtitle": "Schedule a free 30-minute strategy session with our experts.", "buttonText": "Book Consultation"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_consulting',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_consulting', 'Sleek — Consulting', 'Sleek template for consulting services', 'consulting', 'services',
 '{"Navy Gold": {"primary": "#1e3a5f", "secondary": "#d97706", "accent": "#fffbeb"}, "Slate": {"primary": "#1e293b", "secondary": "#6366f1", "accent": "#f5f3ff"}, "Professional": {"primary": "#111827", "secondary": "#3b82f6", "accent": "#eff6ff"}}',
 '{"siteTitle": "Insight Co", "navButtonText": "Book Consultation", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Strategic Business Consulting", "subtitle": "Expert guidance to help your business grow and thrive in any market.", "buttonText": "Book Consultation"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Business Strategy", "description": "Develop winning strategies for growth and competitive advantage."}, {"title": "Operations", "description": "Optimize processes and systems for maximum efficiency."}, {"title": "Digital Transformation", "description": "Modernize your business with the latest technology solutions."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "200+", "label": "Clients Served"}, {"value": "15+", "label": "Years"}, {"value": "$50M+", "label": "Revenue Generated"}, {"value": "95%", "label": "Retention"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Richard C.", "role": "CEO", "quote": "Transformed our company strategy. Revenue doubled.", "rating": 5}, {"name": "Maria G.", "role": "Startup Founder", "quote": "Invaluable guidance during our growth phase.", "rating": 5}, {"name": "Alex W.", "role": "VP Operations", "quote": "Streamlined our operations and saved us millions.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Ready to Grow?", "subtitle": "Schedule a free 30-minute strategy session with our experts.", "buttonText": "Book Consultation"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_consulting',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_consulting', 'Vibrant — Consulting', 'Vibrant template for consulting services', 'consulting', 'services',
 '{"Navy Gold": {"primary": "#1e3a5f", "secondary": "#d97706", "accent": "#fffbeb"}, "Slate": {"primary": "#1e293b", "secondary": "#6366f1", "accent": "#f5f3ff"}, "Professional": {"primary": "#111827", "secondary": "#3b82f6", "accent": "#eff6ff"}}',
 '{"siteTitle": "BrightStrategy", "navButtonText": "Book Consultation", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Strategic Business Consulting", "subtitle": "Expert guidance to help your business grow and thrive in any market.", "buttonText": "Book Consultation"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "200+", "label": "Clients Served"}, {"value": "15+", "label": "Years"}, {"value": "$50M+", "label": "Revenue Generated"}, {"value": "95%", "label": "Retention"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Business Strategy", "description": "Develop winning strategies for growth and competitive advantage."}, {"title": "Operations", "description": "Optimize processes and systems for maximum efficiency."}, {"title": "Digital Transformation", "description": "Modernize your business with the latest technology solutions."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Richard C.", "role": "CEO", "quote": "Transformed our company strategy. Revenue doubled.", "rating": 5}, {"name": "Maria G.", "role": "Startup Founder", "quote": "Invaluable guidance during our growth phase.", "rating": 5}, {"name": "Alex W.", "role": "VP Operations", "quote": "Streamlined our operations and saved us millions.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Ready to Grow?", "subtitle": "Schedule a free 30-minute strategy session with our experts.", "buttonText": "Book Consultation"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_consulting',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_freelance', 'Luxe — Freelance', 'Luxe template for freelance services', 'freelance', 'services',
 '{"Indigo": {"primary": "#312e81", "secondary": "#818cf8", "accent": "#eef2ff"}, "Coral": {"primary": "#1f2937", "secondary": "#f43f5e", "accent": "#fff1f2"}, "Mint": {"primary": "#064e3b", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Studio Luxe", "navButtonText": "Start Project", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Creative Freelance Services", "subtitle": "Design, development, and creative solutions tailored to your vision.", "buttonText": "Start Project"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Web Design", "description": "Beautiful, responsive websites that convert visitors."}, {"title": "Brand Identity", "description": "Logo design, color systems, and brand guidelines."}, {"title": "Content Creation", "description": "Copywriting, photography, and social media content."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Custom Solutions", "Fast Turnaround", "Unlimited Revisions", "Ongoing Support"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Jane D.", "role": "Startup Founder", "quote": "Incredible design work. Exceeded all expectations.", "rating": 5}, {"name": "Tyler M.", "role": "Marketing Director", "quote": "Consistent quality and always meets deadlines.", "rating": 5}, {"name": "Priya S.", "role": "Small Business Owner", "quote": "Transformed our brand completely. Love the results!", "rating": 5}]}}, {"type": "cta", "data": {"title": "Let''s Create Together", "subtitle": "Share your vision and get a free project proposal.", "buttonText": "Start Project"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_freelance',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_freelance', 'Vivid — Freelance', 'Vivid template for freelance services', 'freelance', 'services',
 '{"Indigo": {"primary": "#312e81", "secondary": "#818cf8", "accent": "#eef2ff"}, "Coral": {"primary": "#1f2937", "secondary": "#f43f5e", "accent": "#fff1f2"}, "Mint": {"primary": "#064e3b", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Creative Spark", "navButtonText": "Start Project", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Creative Freelance Services", "subtitle": "Design, development, and creative solutions tailored to your vision.", "buttonText": "Start Project"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "150+", "label": "Projects"}, {"value": "8+", "label": "Years"}, {"value": "50+", "label": "Happy Clients"}, {"value": "100%", "label": "On-Time Delivery"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Web Design", "description": "Beautiful, responsive websites that convert visitors."}, {"title": "Brand Identity", "description": "Logo design, color systems, and brand guidelines."}, {"title": "Content Creation", "description": "Copywriting, photography, and social media content."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Jane D.", "role": "Startup Founder", "quote": "Incredible design work. Exceeded all expectations.", "rating": 5}, {"name": "Tyler M.", "role": "Marketing Director", "quote": "Consistent quality and always meets deadlines.", "rating": 5}, {"name": "Priya S.", "role": "Small Business Owner", "quote": "Transformed our brand completely. Love the results!", "rating": 5}]}}, {"type": "cta", "data": {"title": "Let''s Create Together", "subtitle": "Share your vision and get a free project proposal.", "buttonText": "Start Project"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_freelance',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_freelance', 'Airy — Freelance', 'Airy template for freelance services', 'freelance', 'services',
 '{"Indigo": {"primary": "#312e81", "secondary": "#818cf8", "accent": "#eef2ff"}, "Coral": {"primary": "#1f2937", "secondary": "#f43f5e", "accent": "#fff1f2"}, "Mint": {"primary": "#064e3b", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Open Canvas", "navButtonText": "Start Project", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Creative Freelance Services", "subtitle": "Design, development, and creative solutions tailored to your vision.", "buttonText": "Start Project"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Custom Solutions", "Fast Turnaround", "Unlimited Revisions", "Ongoing Support"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Custom Solutions", "Fast Turnaround", "Unlimited Revisions", "Ongoing Support"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Jane D.", "role": "Startup Founder", "quote": "Incredible design work. Exceeded all expectations.", "rating": 5}, {"name": "Tyler M.", "role": "Marketing Director", "quote": "Consistent quality and always meets deadlines.", "rating": 5}, {"name": "Priya S.", "role": "Small Business Owner", "quote": "Transformed our brand completely. Love the results!", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Let''s Create Together", "subtitle": "Share your vision and get a free project proposal.", "buttonText": "Start Project"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_freelance',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_freelance', 'Edge — Freelance', 'Edge template for freelance services', 'freelance', 'services',
 '{"Indigo": {"primary": "#312e81", "secondary": "#818cf8", "accent": "#eef2ff"}, "Coral": {"primary": "#1f2937", "secondary": "#f43f5e", "accent": "#fff1f2"}, "Mint": {"primary": "#064e3b", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "CodeEdge", "navButtonText": "Start Project", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Creative Freelance Services", "subtitle": "Design, development, and creative solutions tailored to your vision.", "buttonText": "Start Project"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "150+", "label": "Projects"}, {"value": "8+", "label": "Years"}, {"value": "50+", "label": "Happy Clients"}, {"value": "100%", "label": "On-Time Delivery"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Web Design", "description": "Beautiful, responsive websites that convert visitors."}, {"title": "Brand Identity", "description": "Logo design, color systems, and brand guidelines."}, {"title": "Content Creation", "description": "Copywriting, photography, and social media content."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Jane D.", "role": "Startup Founder", "quote": "Incredible design work. Exceeded all expectations.", "rating": 5}, {"name": "Tyler M.", "role": "Marketing Director", "quote": "Consistent quality and always meets deadlines.", "rating": 5}, {"name": "Priya S.", "role": "Small Business Owner", "quote": "Transformed our brand completely. Love the results!", "rating": 5}]}}, {"type": "cta", "data": {"title": "Let''s Create Together", "subtitle": "Share your vision and get a free project proposal.", "buttonText": "Start Project"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_freelance',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_freelance', 'Classic — Freelance', 'Classic template for freelance services', 'freelance', 'services',
 '{"Indigo": {"primary": "#312e81", "secondary": "#818cf8", "accent": "#eef2ff"}, "Coral": {"primary": "#1f2937", "secondary": "#f43f5e", "accent": "#fff1f2"}, "Mint": {"primary": "#064e3b", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Pro Freelance", "navButtonText": "Start Project", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Creative Freelance Services", "subtitle": "Design, development, and creative solutions tailored to your vision.", "buttonText": "Start Project"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "150+", "label": "Projects"}, {"value": "8+", "label": "Years"}, {"value": "50+", "label": "Happy Clients"}, {"value": "100%", "label": "On-Time Delivery"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Web Design", "description": "Beautiful, responsive websites that convert visitors."}, {"title": "Brand Identity", "description": "Logo design, color systems, and brand guidelines."}, {"title": "Content Creation", "description": "Copywriting, photography, and social media content."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Custom Solutions", "Fast Turnaround", "Unlimited Revisions", "Ongoing Support"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Jane D.", "role": "Startup Founder", "quote": "Incredible design work. Exceeded all expectations.", "rating": 5}, {"name": "Tyler M.", "role": "Marketing Director", "quote": "Consistent quality and always meets deadlines.", "rating": 5}, {"name": "Priya S.", "role": "Small Business Owner", "quote": "Transformed our brand completely. Love the results!", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Custom Solutions", "Fast Turnaround", "Unlimited Revisions", "Ongoing Support"]}}, {"type": "cta", "data": {"title": "Let''s Create Together", "subtitle": "Share your vision and get a free project proposal.", "buttonText": "Start Project"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_freelance',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_freelance', 'Organic — Freelance', 'Organic template for freelance services', 'freelance', 'services',
 '{"Indigo": {"primary": "#312e81", "secondary": "#818cf8", "accent": "#eef2ff"}, "Coral": {"primary": "#1f2937", "secondary": "#f43f5e", "accent": "#fff1f2"}, "Mint": {"primary": "#064e3b", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Artisan Works", "navButtonText": "Start Project", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Creative Freelance Services", "subtitle": "Design, development, and creative solutions tailored to your vision.", "buttonText": "Start Project"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Custom Solutions", "Fast Turnaround", "Unlimited Revisions", "Ongoing Support"]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Web Design", "description": "Beautiful, responsive websites that convert visitors."}, {"title": "Brand Identity", "description": "Logo design, color systems, and brand guidelines."}, {"title": "Content Creation", "description": "Copywriting, photography, and social media content."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Jane D.", "role": "Startup Founder", "quote": "Incredible design work. Exceeded all expectations.", "rating": 5}, {"name": "Tyler M.", "role": "Marketing Director", "quote": "Consistent quality and always meets deadlines.", "rating": 5}, {"name": "Priya S.", "role": "Small Business Owner", "quote": "Transformed our brand completely. Love the results!", "rating": 5}]}}, {"type": "cta", "data": {"title": "Let''s Create Together", "subtitle": "Share your vision and get a free project proposal.", "buttonText": "Start Project"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_freelance',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_freelance', 'Sleek — Freelance', 'Sleek template for freelance services', 'freelance', 'services',
 '{"Indigo": {"primary": "#312e81", "secondary": "#818cf8", "accent": "#eef2ff"}, "Coral": {"primary": "#1f2937", "secondary": "#f43f5e", "accent": "#fff1f2"}, "Mint": {"primary": "#064e3b", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Mono Studio", "navButtonText": "Start Project", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Creative Freelance Services", "subtitle": "Design, development, and creative solutions tailored to your vision.", "buttonText": "Start Project"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Web Design", "description": "Beautiful, responsive websites that convert visitors."}, {"title": "Brand Identity", "description": "Logo design, color systems, and brand guidelines."}, {"title": "Content Creation", "description": "Copywriting, photography, and social media content."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "150+", "label": "Projects"}, {"value": "8+", "label": "Years"}, {"value": "50+", "label": "Happy Clients"}, {"value": "100%", "label": "On-Time Delivery"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Jane D.", "role": "Startup Founder", "quote": "Incredible design work. Exceeded all expectations.", "rating": 5}, {"name": "Tyler M.", "role": "Marketing Director", "quote": "Consistent quality and always meets deadlines.", "rating": 5}, {"name": "Priya S.", "role": "Small Business Owner", "quote": "Transformed our brand completely. Love the results!", "rating": 5}]}}, {"type": "cta", "data": {"title": "Let''s Create Together", "subtitle": "Share your vision and get a free project proposal.", "buttonText": "Start Project"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_freelance',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_freelance', 'Vibrant — Freelance', 'Vibrant template for freelance services', 'freelance', 'services',
 '{"Indigo": {"primary": "#312e81", "secondary": "#818cf8", "accent": "#eef2ff"}, "Coral": {"primary": "#1f2937", "secondary": "#f43f5e", "accent": "#fff1f2"}, "Mint": {"primary": "#064e3b", "secondary": "#34d399", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Pixel Pop", "navButtonText": "Start Project", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Creative Freelance Services", "subtitle": "Design, development, and creative solutions tailored to your vision.", "buttonText": "Start Project"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "150+", "label": "Projects"}, {"value": "8+", "label": "Years"}, {"value": "50+", "label": "Happy Clients"}, {"value": "100%", "label": "On-Time Delivery"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Web Design", "description": "Beautiful, responsive websites that convert visitors."}, {"title": "Brand Identity", "description": "Logo design, color systems, and brand guidelines."}, {"title": "Content Creation", "description": "Copywriting, photography, and social media content."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Jane D.", "role": "Startup Founder", "quote": "Incredible design work. Exceeded all expectations.", "rating": 5}, {"name": "Tyler M.", "role": "Marketing Director", "quote": "Consistent quality and always meets deadlines.", "rating": 5}, {"name": "Priya S.", "role": "Small Business Owner", "quote": "Transformed our brand completely. Love the results!", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Let''s Create Together", "subtitle": "Share your vision and get a free project proposal.", "buttonText": "Start Project"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_freelance',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_salon', 'Luxe — Salon', 'Luxe template for salon services', 'salon', 'services',
 '{"Rose": {"primary": "#831843", "secondary": "#f472b6", "accent": "#fdf2f8"}, "Gold": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Lavender": {"primary": "#581c87", "secondary": "#c084fc", "accent": "#faf5ff"}}',
 '{"siteTitle": "Luna Salon", "navButtonText": "Book Now", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Salon & Spa Experience", "subtitle": "Relax, rejuvenate, and leave feeling your absolute best.", "buttonText": "Book Now"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Hair Styling", "description": "Cuts, color, highlights, and treatments by expert stylists."}, {"title": "Nail Services", "description": "Manicures, pedicures, gel, and nail art."}, {"title": "Spa Treatments", "description": "Facials, massages, and body treatments for total relaxation."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Expert Stylists", "Premium Products", "Relaxing Atmosphere", "Online Booking"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Amanda R.", "role": "Regular Client", "quote": "Best salon experience ever! My hair looks amazing.", "rating": 5}, {"name": "Michelle T.", "role": "Bride", "quote": "Made my wedding day perfect. The whole party looked stunning.", "rating": 5}, {"name": "Olivia P.", "role": "Regular Client", "quote": "The spa treatments here are pure bliss. I go every month.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Time to Treat Yourself", "subtitle": "Book your appointment today and discover your best look.", "buttonText": "Book Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_salon',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_salon', 'Vivid — Salon', 'Vivid template for salon services', 'salon', 'services',
 '{"Rose": {"primary": "#831843", "secondary": "#f472b6", "accent": "#fdf2f8"}, "Gold": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Lavender": {"primary": "#581c87", "secondary": "#c084fc", "accent": "#faf5ff"}}',
 '{"siteTitle": "Glow Studio", "navButtonText": "Book Now", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Salon & Spa Experience", "subtitle": "Relax, rejuvenate, and leave feeling your absolute best.", "buttonText": "Book Now"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "1000+", "label": "Happy Clients"}, {"value": "10+", "label": "Years"}, {"value": "15+", "label": "Stylists"}, {"value": "5\u2605", "label": "Google Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Hair Styling", "description": "Cuts, color, highlights, and treatments by expert stylists."}, {"title": "Nail Services", "description": "Manicures, pedicures, gel, and nail art."}, {"title": "Spa Treatments", "description": "Facials, massages, and body treatments for total relaxation."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Amanda R.", "role": "Regular Client", "quote": "Best salon experience ever! My hair looks amazing.", "rating": 5}, {"name": "Michelle T.", "role": "Bride", "quote": "Made my wedding day perfect. The whole party looked stunning.", "rating": 5}, {"name": "Olivia P.", "role": "Regular Client", "quote": "The spa treatments here are pure bliss. I go every month.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Time to Treat Yourself", "subtitle": "Book your appointment today and discover your best look.", "buttonText": "Book Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_salon',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_salon', 'Airy — Salon', 'Airy template for salon services', 'salon', 'services',
 '{"Rose": {"primary": "#831843", "secondary": "#f472b6", "accent": "#fdf2f8"}, "Gold": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Lavender": {"primary": "#581c87", "secondary": "#c084fc", "accent": "#faf5ff"}}',
 '{"siteTitle": "Soft Touch", "navButtonText": "Book Now", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Salon & Spa Experience", "subtitle": "Relax, rejuvenate, and leave feeling your absolute best.", "buttonText": "Book Now"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Expert Stylists", "Premium Products", "Relaxing Atmosphere", "Online Booking"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Expert Stylists", "Premium Products", "Relaxing Atmosphere", "Online Booking"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Amanda R.", "role": "Regular Client", "quote": "Best salon experience ever! My hair looks amazing.", "rating": 5}, {"name": "Michelle T.", "role": "Bride", "quote": "Made my wedding day perfect. The whole party looked stunning.", "rating": 5}, {"name": "Olivia P.", "role": "Regular Client", "quote": "The spa treatments here are pure bliss. I go every month.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Time to Treat Yourself", "subtitle": "Book your appointment today and discover your best look.", "buttonText": "Book Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_salon',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_salon', 'Edge — Salon', 'Edge template for salon services', 'salon', 'services',
 '{"Rose": {"primary": "#831843", "secondary": "#f472b6", "accent": "#fdf2f8"}, "Gold": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Lavender": {"primary": "#581c87", "secondary": "#c084fc", "accent": "#faf5ff"}}',
 '{"siteTitle": "Neon Salon", "navButtonText": "Book Now", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Salon & Spa Experience", "subtitle": "Relax, rejuvenate, and leave feeling your absolute best.", "buttonText": "Book Now"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "1000+", "label": "Happy Clients"}, {"value": "10+", "label": "Years"}, {"value": "15+", "label": "Stylists"}, {"value": "5\u2605", "label": "Google Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Hair Styling", "description": "Cuts, color, highlights, and treatments by expert stylists."}, {"title": "Nail Services", "description": "Manicures, pedicures, gel, and nail art."}, {"title": "Spa Treatments", "description": "Facials, massages, and body treatments for total relaxation."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Amanda R.", "role": "Regular Client", "quote": "Best salon experience ever! My hair looks amazing.", "rating": 5}, {"name": "Michelle T.", "role": "Bride", "quote": "Made my wedding day perfect. The whole party looked stunning.", "rating": 5}, {"name": "Olivia P.", "role": "Regular Client", "quote": "The spa treatments here are pure bliss. I go every month.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Time to Treat Yourself", "subtitle": "Book your appointment today and discover your best look.", "buttonText": "Book Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_salon',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_salon', 'Classic — Salon', 'Classic template for salon services', 'salon', 'services',
 '{"Rose": {"primary": "#831843", "secondary": "#f472b6", "accent": "#fdf2f8"}, "Gold": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Lavender": {"primary": "#581c87", "secondary": "#c084fc", "accent": "#faf5ff"}}',
 '{"siteTitle": "Classic Beauty", "navButtonText": "Book Now", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Salon & Spa Experience", "subtitle": "Relax, rejuvenate, and leave feeling your absolute best.", "buttonText": "Book Now"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "1000+", "label": "Happy Clients"}, {"value": "10+", "label": "Years"}, {"value": "15+", "label": "Stylists"}, {"value": "5\u2605", "label": "Google Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Hair Styling", "description": "Cuts, color, highlights, and treatments by expert stylists."}, {"title": "Nail Services", "description": "Manicures, pedicures, gel, and nail art."}, {"title": "Spa Treatments", "description": "Facials, massages, and body treatments for total relaxation."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Expert Stylists", "Premium Products", "Relaxing Atmosphere", "Online Booking"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Amanda R.", "role": "Regular Client", "quote": "Best salon experience ever! My hair looks amazing.", "rating": 5}, {"name": "Michelle T.", "role": "Bride", "quote": "Made my wedding day perfect. The whole party looked stunning.", "rating": 5}, {"name": "Olivia P.", "role": "Regular Client", "quote": "The spa treatments here are pure bliss. I go every month.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Expert Stylists", "Premium Products", "Relaxing Atmosphere", "Online Booking"]}}, {"type": "cta", "data": {"title": "Time to Treat Yourself", "subtitle": "Book your appointment today and discover your best look.", "buttonText": "Book Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_salon',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_salon', 'Organic — Salon', 'Organic template for salon services', 'salon', 'services',
 '{"Rose": {"primary": "#831843", "secondary": "#f472b6", "accent": "#fdf2f8"}, "Gold": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Lavender": {"primary": "#581c87", "secondary": "#c084fc", "accent": "#faf5ff"}}',
 '{"siteTitle": "Natural Glow", "navButtonText": "Book Now", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Salon & Spa Experience", "subtitle": "Relax, rejuvenate, and leave feeling your absolute best.", "buttonText": "Book Now"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Expert Stylists", "Premium Products", "Relaxing Atmosphere", "Online Booking"]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Hair Styling", "description": "Cuts, color, highlights, and treatments by expert stylists."}, {"title": "Nail Services", "description": "Manicures, pedicures, gel, and nail art."}, {"title": "Spa Treatments", "description": "Facials, massages, and body treatments for total relaxation."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Amanda R.", "role": "Regular Client", "quote": "Best salon experience ever! My hair looks amazing.", "rating": 5}, {"name": "Michelle T.", "role": "Bride", "quote": "Made my wedding day perfect. The whole party looked stunning.", "rating": 5}, {"name": "Olivia P.", "role": "Regular Client", "quote": "The spa treatments here are pure bliss. I go every month.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Time to Treat Yourself", "subtitle": "Book your appointment today and discover your best look.", "buttonText": "Book Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_salon',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_salon', 'Sleek — Salon', 'Sleek template for salon services', 'salon', 'services',
 '{"Rose": {"primary": "#831843", "secondary": "#f472b6", "accent": "#fdf2f8"}, "Gold": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Lavender": {"primary": "#581c87", "secondary": "#c084fc", "accent": "#faf5ff"}}',
 '{"siteTitle": "Minimal Beauty", "navButtonText": "Book Now", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Salon & Spa Experience", "subtitle": "Relax, rejuvenate, and leave feeling your absolute best.", "buttonText": "Book Now"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Hair Styling", "description": "Cuts, color, highlights, and treatments by expert stylists."}, {"title": "Nail Services", "description": "Manicures, pedicures, gel, and nail art."}, {"title": "Spa Treatments", "description": "Facials, massages, and body treatments for total relaxation."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "1000+", "label": "Happy Clients"}, {"value": "10+", "label": "Years"}, {"value": "15+", "label": "Stylists"}, {"value": "5\u2605", "label": "Google Rating"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Amanda R.", "role": "Regular Client", "quote": "Best salon experience ever! My hair looks amazing.", "rating": 5}, {"name": "Michelle T.", "role": "Bride", "quote": "Made my wedding day perfect. The whole party looked stunning.", "rating": 5}, {"name": "Olivia P.", "role": "Regular Client", "quote": "The spa treatments here are pure bliss. I go every month.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Time to Treat Yourself", "subtitle": "Book your appointment today and discover your best look.", "buttonText": "Book Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_salon',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_salon', 'Vibrant — Salon', 'Vibrant template for salon services', 'salon', 'services',
 '{"Rose": {"primary": "#831843", "secondary": "#f472b6", "accent": "#fdf2f8"}, "Gold": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}, "Lavender": {"primary": "#581c87", "secondary": "#c084fc", "accent": "#faf5ff"}}',
 '{"siteTitle": "Color Pop Salon", "navButtonText": "Book Now", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Salon & Spa Experience", "subtitle": "Relax, rejuvenate, and leave feeling your absolute best.", "buttonText": "Book Now"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "1000+", "label": "Happy Clients"}, {"value": "10+", "label": "Years"}, {"value": "15+", "label": "Stylists"}, {"value": "5\u2605", "label": "Google Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Hair Styling", "description": "Cuts, color, highlights, and treatments by expert stylists."}, {"title": "Nail Services", "description": "Manicures, pedicures, gel, and nail art."}, {"title": "Spa Treatments", "description": "Facials, massages, and body treatments for total relaxation."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Amanda R.", "role": "Regular Client", "quote": "Best salon experience ever! My hair looks amazing.", "rating": 5}, {"name": "Michelle T.", "role": "Bride", "quote": "Made my wedding day perfect. The whole party looked stunning.", "rating": 5}, {"name": "Olivia P.", "role": "Regular Client", "quote": "The spa treatments here are pure bliss. I go every month.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Time to Treat Yourself", "subtitle": "Book your appointment today and discover your best look.", "buttonText": "Book Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_salon',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_fitness', 'Luxe — Fitness', 'Luxe template for fitness services', 'fitness', 'services',
 '{"Power": {"primary": "#0f172a", "secondary": "#dc2626", "accent": "#fef2f2"}, "Energy": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Fresh": {"primary": "#065f46", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Elite Fitness", "navButtonText": "Join Now", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Transform Your Body", "subtitle": "Personal training, group classes, and nutrition coaching to reach your goals.", "buttonText": "Join Now"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Personal Training", "description": "One-on-one sessions tailored to your fitness goals."}, {"title": "Group Classes", "description": "HIIT, yoga, spin, and more in an energizing environment."}, {"title": "Nutrition Coaching", "description": "Customized meal plans and nutritional guidance."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Certified Trainers", "State-of-the-Art Equipment", "Flexible Schedules", "Community Support"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Jason K.", "role": "Member", "quote": "Lost 30 lbs and gained confidence. Life-changing!", "rating": 5}, {"name": "Stephanie R.", "role": "Member", "quote": "The trainers are incredible. Best gym I have been to.", "rating": 5}, {"name": "Derek M.", "role": "Athlete", "quote": "Top-notch facilities and programming. Highly recommend.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Journey", "subtitle": "Join today and get your first week free. No commitment required.", "buttonText": "Join Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_fitness',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_fitness', 'Vivid — Fitness', 'Vivid template for fitness services', 'fitness', 'services',
 '{"Power": {"primary": "#0f172a", "secondary": "#dc2626", "accent": "#fef2f2"}, "Energy": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Fresh": {"primary": "#065f46", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Iron Force", "navButtonText": "Join Now", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Transform Your Body", "subtitle": "Personal training, group classes, and nutrition coaching to reach your goals.", "buttonText": "Join Now"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "500+", "label": "Members"}, {"value": "10+", "label": "Trainers"}, {"value": "50+", "label": "Classes/Week"}, {"value": "95%", "label": "Goal Achievement"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Personal Training", "description": "One-on-one sessions tailored to your fitness goals."}, {"title": "Group Classes", "description": "HIIT, yoga, spin, and more in an energizing environment."}, {"title": "Nutrition Coaching", "description": "Customized meal plans and nutritional guidance."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Jason K.", "role": "Member", "quote": "Lost 30 lbs and gained confidence. Life-changing!", "rating": 5}, {"name": "Stephanie R.", "role": "Member", "quote": "The trainers are incredible. Best gym I have been to.", "rating": 5}, {"name": "Derek M.", "role": "Athlete", "quote": "Top-notch facilities and programming. Highly recommend.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Journey", "subtitle": "Join today and get your first week free. No commitment required.", "buttonText": "Join Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_fitness',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_fitness', 'Airy — Fitness', 'Airy template for fitness services', 'fitness', 'services',
 '{"Power": {"primary": "#0f172a", "secondary": "#dc2626", "accent": "#fef2f2"}, "Energy": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Fresh": {"primary": "#065f46", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Zen Fitness", "navButtonText": "Join Now", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Transform Your Body", "subtitle": "Personal training, group classes, and nutrition coaching to reach your goals.", "buttonText": "Join Now"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Certified Trainers", "State-of-the-Art Equipment", "Flexible Schedules", "Community Support"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Certified Trainers", "State-of-the-Art Equipment", "Flexible Schedules", "Community Support"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Jason K.", "role": "Member", "quote": "Lost 30 lbs and gained confidence. Life-changing!", "rating": 5}, {"name": "Stephanie R.", "role": "Member", "quote": "The trainers are incredible. Best gym I have been to.", "rating": 5}, {"name": "Derek M.", "role": "Athlete", "quote": "Top-notch facilities and programming. Highly recommend.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Start Your Journey", "subtitle": "Join today and get your first week free. No commitment required.", "buttonText": "Join Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_fitness',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_fitness', 'Edge — Fitness', 'Edge template for fitness services', 'fitness', 'services',
 '{"Power": {"primary": "#0f172a", "secondary": "#dc2626", "accent": "#fef2f2"}, "Energy": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Fresh": {"primary": "#065f46", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Beast Mode", "navButtonText": "Join Now", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Transform Your Body", "subtitle": "Personal training, group classes, and nutrition coaching to reach your goals.", "buttonText": "Join Now"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "500+", "label": "Members"}, {"value": "10+", "label": "Trainers"}, {"value": "50+", "label": "Classes/Week"}, {"value": "95%", "label": "Goal Achievement"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Personal Training", "description": "One-on-one sessions tailored to your fitness goals."}, {"title": "Group Classes", "description": "HIIT, yoga, spin, and more in an energizing environment."}, {"title": "Nutrition Coaching", "description": "Customized meal plans and nutritional guidance."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Jason K.", "role": "Member", "quote": "Lost 30 lbs and gained confidence. Life-changing!", "rating": 5}, {"name": "Stephanie R.", "role": "Member", "quote": "The trainers are incredible. Best gym I have been to.", "rating": 5}, {"name": "Derek M.", "role": "Athlete", "quote": "Top-notch facilities and programming. Highly recommend.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Journey", "subtitle": "Join today and get your first week free. No commitment required.", "buttonText": "Join Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_fitness',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_fitness', 'Classic — Fitness', 'Classic template for fitness services', 'fitness', 'services',
 '{"Power": {"primary": "#0f172a", "secondary": "#dc2626", "accent": "#fef2f2"}, "Energy": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Fresh": {"primary": "#065f46", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Pro Fitness", "navButtonText": "Join Now", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Transform Your Body", "subtitle": "Personal training, group classes, and nutrition coaching to reach your goals.", "buttonText": "Join Now"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "500+", "label": "Members"}, {"value": "10+", "label": "Trainers"}, {"value": "50+", "label": "Classes/Week"}, {"value": "95%", "label": "Goal Achievement"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Personal Training", "description": "One-on-one sessions tailored to your fitness goals."}, {"title": "Group Classes", "description": "HIIT, yoga, spin, and more in an energizing environment."}, {"title": "Nutrition Coaching", "description": "Customized meal plans and nutritional guidance."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Certified Trainers", "State-of-the-Art Equipment", "Flexible Schedules", "Community Support"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Jason K.", "role": "Member", "quote": "Lost 30 lbs and gained confidence. Life-changing!", "rating": 5}, {"name": "Stephanie R.", "role": "Member", "quote": "The trainers are incredible. Best gym I have been to.", "rating": 5}, {"name": "Derek M.", "role": "Athlete", "quote": "Top-notch facilities and programming. Highly recommend.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Certified Trainers", "State-of-the-Art Equipment", "Flexible Schedules", "Community Support"]}}, {"type": "cta", "data": {"title": "Start Your Journey", "subtitle": "Join today and get your first week free. No commitment required.", "buttonText": "Join Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_fitness',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_fitness', 'Organic — Fitness', 'Organic template for fitness services', 'fitness', 'services',
 '{"Power": {"primary": "#0f172a", "secondary": "#dc2626", "accent": "#fef2f2"}, "Energy": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Fresh": {"primary": "#065f46", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Wholesome Fitness", "navButtonText": "Join Now", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Transform Your Body", "subtitle": "Personal training, group classes, and nutrition coaching to reach your goals.", "buttonText": "Join Now"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Certified Trainers", "State-of-the-Art Equipment", "Flexible Schedules", "Community Support"]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Personal Training", "description": "One-on-one sessions tailored to your fitness goals."}, {"title": "Group Classes", "description": "HIIT, yoga, spin, and more in an energizing environment."}, {"title": "Nutrition Coaching", "description": "Customized meal plans and nutritional guidance."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Jason K.", "role": "Member", "quote": "Lost 30 lbs and gained confidence. Life-changing!", "rating": 5}, {"name": "Stephanie R.", "role": "Member", "quote": "The trainers are incredible. Best gym I have been to.", "rating": 5}, {"name": "Derek M.", "role": "Athlete", "quote": "Top-notch facilities and programming. Highly recommend.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Journey", "subtitle": "Join today and get your first week free. No commitment required.", "buttonText": "Join Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_fitness',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_fitness', 'Sleek — Fitness', 'Sleek template for fitness services', 'fitness', 'services',
 '{"Power": {"primary": "#0f172a", "secondary": "#dc2626", "accent": "#fef2f2"}, "Energy": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Fresh": {"primary": "#065f46", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "Peak Performance", "navButtonText": "Join Now", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Transform Your Body", "subtitle": "Personal training, group classes, and nutrition coaching to reach your goals.", "buttonText": "Join Now"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Personal Training", "description": "One-on-one sessions tailored to your fitness goals."}, {"title": "Group Classes", "description": "HIIT, yoga, spin, and more in an energizing environment."}, {"title": "Nutrition Coaching", "description": "Customized meal plans and nutritional guidance."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "500+", "label": "Members"}, {"value": "10+", "label": "Trainers"}, {"value": "50+", "label": "Classes/Week"}, {"value": "95%", "label": "Goal Achievement"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Jason K.", "role": "Member", "quote": "Lost 30 lbs and gained confidence. Life-changing!", "rating": 5}, {"name": "Stephanie R.", "role": "Member", "quote": "The trainers are incredible. Best gym I have been to.", "rating": 5}, {"name": "Derek M.", "role": "Athlete", "quote": "Top-notch facilities and programming. Highly recommend.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Journey", "subtitle": "Join today and get your first week free. No commitment required.", "buttonText": "Join Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_fitness',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_fitness', 'Vibrant — Fitness', 'Vibrant template for fitness services', 'fitness', 'services',
 '{"Power": {"primary": "#0f172a", "secondary": "#dc2626", "accent": "#fef2f2"}, "Energy": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Fresh": {"primary": "#065f46", "secondary": "#10b981", "accent": "#ecfdf5"}}',
 '{"siteTitle": "FitVibe", "navButtonText": "Join Now", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Transform Your Body", "subtitle": "Personal training, group classes, and nutrition coaching to reach your goals.", "buttonText": "Join Now"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "500+", "label": "Members"}, {"value": "10+", "label": "Trainers"}, {"value": "50+", "label": "Classes/Week"}, {"value": "95%", "label": "Goal Achievement"}]}}, {"type": "servicesGrid", "data": {"title": "Our Services", "subtitle": "What we offer", "items": [{"title": "Personal Training", "description": "One-on-one sessions tailored to your fitness goals."}, {"title": "Group Classes", "description": "HIIT, yoga, spin, and more in an energizing environment."}, {"title": "Nutrition Coaching", "description": "Customized meal plans and nutritional guidance."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Jason K.", "role": "Member", "quote": "Lost 30 lbs and gained confidence. Life-changing!", "rating": 5}, {"name": "Stephanie R.", "role": "Member", "quote": "The trainers are incredible. Best gym I have been to.", "rating": 5}, {"name": "Derek M.", "role": "Athlete", "quote": "Top-notch facilities and programming. Highly recommend.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Start Your Journey", "subtitle": "Join today and get your first week free. No commitment required.", "buttonText": "Join Now"}}], "extra_pages": [{"slug": "booking", "title": "Book Service", "display_name": "Book Service", "is_visible_in_nav": true, "blocks": [{"type": "booking", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Book Service", "linkType": "page", "pageSlug": "booking"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_fitness',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_ecommerce', 'Luxe — Ecommerce', 'Luxe template for ecommerce products', 'ecommerce', 'products',
 '{"Boutique": {"primary": "#7c3aed", "secondary": "#a78bfa", "accent": "#f5f3ff"}, "Modern": {"primary": "#111827", "secondary": "#6366f1", "accent": "#eef2ff"}, "Fresh": {"primary": "#0f766e", "secondary": "#2dd4bf", "accent": "#f0fdfa"}}',
 '{"siteTitle": "Luxe Store", "navButtonText": "Shop Now", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Shop the Latest Collection", "subtitle": "Curated products with fast shipping and hassle-free returns.", "buttonText": "Shop Now"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "New Arrivals", "description": "Discover our latest products, handpicked for quality."}, {"title": "Best Sellers", "description": "See what everyone is loving right now."}, {"title": "Special Offers", "description": "Limited-time deals and exclusive discounts."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Free Shipping", "30-Day Returns", "Secure Checkout", "24/7 Support"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Alex R.", "role": "Verified Buyer", "quote": "Amazing quality products. Fast shipping too!", "rating": 5}, {"name": "Maria S.", "role": "Repeat Customer", "quote": "My go-to store. Never disappointed.", "rating": 5}, {"name": "Chris L.", "role": "Verified Buyer", "quote": "Great prices and the customer service is excellent.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Don''t Miss Out", "subtitle": "Sign up for exclusive deals and new arrival notifications.", "buttonText": "Shop Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_ecommerce',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_ecommerce', 'Vivid — Ecommerce', 'Vivid template for ecommerce products', 'ecommerce', 'products',
 '{"Boutique": {"primary": "#7c3aed", "secondary": "#a78bfa", "accent": "#f5f3ff"}, "Modern": {"primary": "#111827", "secondary": "#6366f1", "accent": "#eef2ff"}, "Fresh": {"primary": "#0f766e", "secondary": "#2dd4bf", "accent": "#f0fdfa"}}',
 '{"siteTitle": "ShopVivid", "navButtonText": "Shop Now", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Shop the Latest Collection", "subtitle": "Curated products with fast shipping and hassle-free returns.", "buttonText": "Shop Now"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "10K+", "label": "Happy Customers"}, {"value": "500+", "label": "Products"}, {"value": "Free", "label": "Shipping"}, {"value": "30-Day", "label": "Returns"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "New Arrivals", "description": "Discover our latest products, handpicked for quality."}, {"title": "Best Sellers", "description": "See what everyone is loving right now."}, {"title": "Special Offers", "description": "Limited-time deals and exclusive discounts."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Alex R.", "role": "Verified Buyer", "quote": "Amazing quality products. Fast shipping too!", "rating": 5}, {"name": "Maria S.", "role": "Repeat Customer", "quote": "My go-to store. Never disappointed.", "rating": 5}, {"name": "Chris L.", "role": "Verified Buyer", "quote": "Great prices and the customer service is excellent.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Don''t Miss Out", "subtitle": "Sign up for exclusive deals and new arrival notifications.", "buttonText": "Shop Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_ecommerce',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_ecommerce', 'Airy — Ecommerce', 'Airy template for ecommerce products', 'ecommerce', 'products',
 '{"Boutique": {"primary": "#7c3aed", "secondary": "#a78bfa", "accent": "#f5f3ff"}, "Modern": {"primary": "#111827", "secondary": "#6366f1", "accent": "#eef2ff"}, "Fresh": {"primary": "#0f766e", "secondary": "#2dd4bf", "accent": "#f0fdfa"}}',
 '{"siteTitle": "Light Market", "navButtonText": "Shop Now", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Shop the Latest Collection", "subtitle": "Curated products with fast shipping and hassle-free returns.", "buttonText": "Shop Now"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Free Shipping", "30-Day Returns", "Secure Checkout", "24/7 Support"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Free Shipping", "30-Day Returns", "Secure Checkout", "24/7 Support"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Alex R.", "role": "Verified Buyer", "quote": "Amazing quality products. Fast shipping too!", "rating": 5}, {"name": "Maria S.", "role": "Repeat Customer", "quote": "My go-to store. Never disappointed.", "rating": 5}, {"name": "Chris L.", "role": "Verified Buyer", "quote": "Great prices and the customer service is excellent.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Don''t Miss Out", "subtitle": "Sign up for exclusive deals and new arrival notifications.", "buttonText": "Shop Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_ecommerce',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_ecommerce', 'Edge — Ecommerce', 'Edge template for ecommerce products', 'ecommerce', 'products',
 '{"Boutique": {"primary": "#7c3aed", "secondary": "#a78bfa", "accent": "#f5f3ff"}, "Modern": {"primary": "#111827", "secondary": "#6366f1", "accent": "#eef2ff"}, "Fresh": {"primary": "#0f766e", "secondary": "#2dd4bf", "accent": "#f0fdfa"}}',
 '{"siteTitle": "TechStore", "navButtonText": "Shop Now", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Shop the Latest Collection", "subtitle": "Curated products with fast shipping and hassle-free returns.", "buttonText": "Shop Now"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "10K+", "label": "Happy Customers"}, {"value": "500+", "label": "Products"}, {"value": "Free", "label": "Shipping"}, {"value": "30-Day", "label": "Returns"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "New Arrivals", "description": "Discover our latest products, handpicked for quality."}, {"title": "Best Sellers", "description": "See what everyone is loving right now."}, {"title": "Special Offers", "description": "Limited-time deals and exclusive discounts."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Alex R.", "role": "Verified Buyer", "quote": "Amazing quality products. Fast shipping too!", "rating": 5}, {"name": "Maria S.", "role": "Repeat Customer", "quote": "My go-to store. Never disappointed.", "rating": 5}, {"name": "Chris L.", "role": "Verified Buyer", "quote": "Great prices and the customer service is excellent.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Don''t Miss Out", "subtitle": "Sign up for exclusive deals and new arrival notifications.", "buttonText": "Shop Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_ecommerce',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_ecommerce', 'Classic — Ecommerce', 'Classic template for ecommerce products', 'ecommerce', 'products',
 '{"Boutique": {"primary": "#7c3aed", "secondary": "#a78bfa", "accent": "#f5f3ff"}, "Modern": {"primary": "#111827", "secondary": "#6366f1", "accent": "#eef2ff"}, "Fresh": {"primary": "#0f766e", "secondary": "#2dd4bf", "accent": "#f0fdfa"}}',
 '{"siteTitle": "Classic Shop", "navButtonText": "Shop Now", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Shop the Latest Collection", "subtitle": "Curated products with fast shipping and hassle-free returns.", "buttonText": "Shop Now"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "10K+", "label": "Happy Customers"}, {"value": "500+", "label": "Products"}, {"value": "Free", "label": "Shipping"}, {"value": "30-Day", "label": "Returns"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "New Arrivals", "description": "Discover our latest products, handpicked for quality."}, {"title": "Best Sellers", "description": "See what everyone is loving right now."}, {"title": "Special Offers", "description": "Limited-time deals and exclusive discounts."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Free Shipping", "30-Day Returns", "Secure Checkout", "24/7 Support"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Alex R.", "role": "Verified Buyer", "quote": "Amazing quality products. Fast shipping too!", "rating": 5}, {"name": "Maria S.", "role": "Repeat Customer", "quote": "My go-to store. Never disappointed.", "rating": 5}, {"name": "Chris L.", "role": "Verified Buyer", "quote": "Great prices and the customer service is excellent.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Free Shipping", "30-Day Returns", "Secure Checkout", "24/7 Support"]}}, {"type": "cta", "data": {"title": "Don''t Miss Out", "subtitle": "Sign up for exclusive deals and new arrival notifications.", "buttonText": "Shop Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_ecommerce',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_ecommerce', 'Organic — Ecommerce', 'Organic template for ecommerce products', 'ecommerce', 'products',
 '{"Boutique": {"primary": "#7c3aed", "secondary": "#a78bfa", "accent": "#f5f3ff"}, "Modern": {"primary": "#111827", "secondary": "#6366f1", "accent": "#eef2ff"}, "Fresh": {"primary": "#0f766e", "secondary": "#2dd4bf", "accent": "#f0fdfa"}}',
 '{"siteTitle": "Artisan Market", "navButtonText": "Shop Now", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Shop the Latest Collection", "subtitle": "Curated products with fast shipping and hassle-free returns.", "buttonText": "Shop Now"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Free Shipping", "30-Day Returns", "Secure Checkout", "24/7 Support"]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "New Arrivals", "description": "Discover our latest products, handpicked for quality."}, {"title": "Best Sellers", "description": "See what everyone is loving right now."}, {"title": "Special Offers", "description": "Limited-time deals and exclusive discounts."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Alex R.", "role": "Verified Buyer", "quote": "Amazing quality products. Fast shipping too!", "rating": 5}, {"name": "Maria S.", "role": "Repeat Customer", "quote": "My go-to store. Never disappointed.", "rating": 5}, {"name": "Chris L.", "role": "Verified Buyer", "quote": "Great prices and the customer service is excellent.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Don''t Miss Out", "subtitle": "Sign up for exclusive deals and new arrival notifications.", "buttonText": "Shop Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_ecommerce',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_ecommerce', 'Sleek — Ecommerce', 'Sleek template for ecommerce products', 'ecommerce', 'products',
 '{"Boutique": {"primary": "#7c3aed", "secondary": "#a78bfa", "accent": "#f5f3ff"}, "Modern": {"primary": "#111827", "secondary": "#6366f1", "accent": "#eef2ff"}, "Fresh": {"primary": "#0f766e", "secondary": "#2dd4bf", "accent": "#f0fdfa"}}',
 '{"siteTitle": "Mono Shop", "navButtonText": "Shop Now", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Shop the Latest Collection", "subtitle": "Curated products with fast shipping and hassle-free returns.", "buttonText": "Shop Now"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "New Arrivals", "description": "Discover our latest products, handpicked for quality."}, {"title": "Best Sellers", "description": "See what everyone is loving right now."}, {"title": "Special Offers", "description": "Limited-time deals and exclusive discounts."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "10K+", "label": "Happy Customers"}, {"value": "500+", "label": "Products"}, {"value": "Free", "label": "Shipping"}, {"value": "30-Day", "label": "Returns"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Alex R.", "role": "Verified Buyer", "quote": "Amazing quality products. Fast shipping too!", "rating": 5}, {"name": "Maria S.", "role": "Repeat Customer", "quote": "My go-to store. Never disappointed.", "rating": 5}, {"name": "Chris L.", "role": "Verified Buyer", "quote": "Great prices and the customer service is excellent.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Don''t Miss Out", "subtitle": "Sign up for exclusive deals and new arrival notifications.", "buttonText": "Shop Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_ecommerce',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_ecommerce', 'Vibrant — Ecommerce', 'Vibrant template for ecommerce products', 'ecommerce', 'products',
 '{"Boutique": {"primary": "#7c3aed", "secondary": "#a78bfa", "accent": "#f5f3ff"}, "Modern": {"primary": "#111827", "secondary": "#6366f1", "accent": "#eef2ff"}, "Fresh": {"primary": "#0f766e", "secondary": "#2dd4bf", "accent": "#f0fdfa"}}',
 '{"siteTitle": "PopStore", "navButtonText": "Shop Now", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Shop the Latest Collection", "subtitle": "Curated products with fast shipping and hassle-free returns.", "buttonText": "Shop Now"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "10K+", "label": "Happy Customers"}, {"value": "500+", "label": "Products"}, {"value": "Free", "label": "Shipping"}, {"value": "30-Day", "label": "Returns"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "New Arrivals", "description": "Discover our latest products, handpicked for quality."}, {"title": "Best Sellers", "description": "See what everyone is loving right now."}, {"title": "Special Offers", "description": "Limited-time deals and exclusive discounts."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Alex R.", "role": "Verified Buyer", "quote": "Amazing quality products. Fast shipping too!", "rating": 5}, {"name": "Maria S.", "role": "Repeat Customer", "quote": "My go-to store. Never disappointed.", "rating": 5}, {"name": "Chris L.", "role": "Verified Buyer", "quote": "Great prices and the customer service is excellent.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Don''t Miss Out", "subtitle": "Sign up for exclusive deals and new arrival notifications.", "buttonText": "Shop Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_ecommerce',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_handmade', 'Luxe — Handmade', 'Luxe template for handmade products', 'handmade', 'products',
 '{"Terracotta": {"primary": "#92400e", "secondary": "#c2410c", "accent": "#fff7ed"}, "Sage": {"primary": "#365314", "secondary": "#84cc16", "accent": "#f7fee7"}, "Clay": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}}',
 '{"siteTitle": "Maison Craft", "navButtonText": "Browse Collection", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Handcrafted With Love", "subtitle": "Unique, artisan-made products crafted with care and attention to detail.", "buttonText": "Browse Collection"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Ceramics", "description": "Hand-thrown pottery and ceramic pieces for your home."}, {"title": "Textiles", "description": "Woven, knitted, and sewn goods made with natural fibers."}, {"title": "Custom Orders", "description": "Commission a unique piece tailored just for you."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["100% Handmade", "Sustainable Materials", "Custom Orders", "Gift Wrapping"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Emma T.", "role": "Collector", "quote": "Each piece is truly unique. Beautiful craftsmanship.", "rating": 5}, {"name": "Noah B.", "role": "Gift Buyer", "quote": "Perfect gifts that people actually love and keep.", "rating": 5}, {"name": "Sophie M.", "role": "Interior Designer", "quote": "These pieces add soul to any space. Stunning.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Find Your Piece", "subtitle": "Browse our collection or commission a custom creation.", "buttonText": "Browse Collection"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_handmade',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_handmade', 'Vivid — Handmade', 'Vivid template for handmade products', 'handmade', 'products',
 '{"Terracotta": {"primary": "#92400e", "secondary": "#c2410c", "accent": "#fff7ed"}, "Sage": {"primary": "#365314", "secondary": "#84cc16", "accent": "#f7fee7"}, "Clay": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}}',
 '{"siteTitle": "CraftBurst", "navButtonText": "Browse Collection", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Handcrafted With Love", "subtitle": "Unique, artisan-made products crafted with care and attention to detail.", "buttonText": "Browse Collection"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "2000+", "label": "Items Sold"}, {"value": "100%", "label": "Handmade"}, {"value": "Eco", "label": "Materials"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Ceramics", "description": "Hand-thrown pottery and ceramic pieces for your home."}, {"title": "Textiles", "description": "Woven, knitted, and sewn goods made with natural fibers."}, {"title": "Custom Orders", "description": "Commission a unique piece tailored just for you."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Emma T.", "role": "Collector", "quote": "Each piece is truly unique. Beautiful craftsmanship.", "rating": 5}, {"name": "Noah B.", "role": "Gift Buyer", "quote": "Perfect gifts that people actually love and keep.", "rating": 5}, {"name": "Sophie M.", "role": "Interior Designer", "quote": "These pieces add soul to any space. Stunning.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Find Your Piece", "subtitle": "Browse our collection or commission a custom creation.", "buttonText": "Browse Collection"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_handmade',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_handmade', 'Airy — Handmade', 'Airy template for handmade products', 'handmade', 'products',
 '{"Terracotta": {"primary": "#92400e", "secondary": "#c2410c", "accent": "#fff7ed"}, "Sage": {"primary": "#365314", "secondary": "#84cc16", "accent": "#f7fee7"}, "Clay": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}}',
 '{"siteTitle": "Gentle Craft", "navButtonText": "Browse Collection", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Handcrafted With Love", "subtitle": "Unique, artisan-made products crafted with care and attention to detail.", "buttonText": "Browse Collection"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["100% Handmade", "Sustainable Materials", "Custom Orders", "Gift Wrapping"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["100% Handmade", "Sustainable Materials", "Custom Orders", "Gift Wrapping"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Emma T.", "role": "Collector", "quote": "Each piece is truly unique. Beautiful craftsmanship.", "rating": 5}, {"name": "Noah B.", "role": "Gift Buyer", "quote": "Perfect gifts that people actually love and keep.", "rating": 5}, {"name": "Sophie M.", "role": "Interior Designer", "quote": "These pieces add soul to any space. Stunning.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Find Your Piece", "subtitle": "Browse our collection or commission a custom creation.", "buttonText": "Browse Collection"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_handmade',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_handmade', 'Edge — Handmade', 'Edge template for handmade products', 'handmade', 'products',
 '{"Terracotta": {"primary": "#92400e", "secondary": "#c2410c", "accent": "#fff7ed"}, "Sage": {"primary": "#365314", "secondary": "#84cc16", "accent": "#f7fee7"}, "Clay": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}}',
 '{"siteTitle": "MakerEdge", "navButtonText": "Browse Collection", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Handcrafted With Love", "subtitle": "Unique, artisan-made products crafted with care and attention to detail.", "buttonText": "Browse Collection"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "2000+", "label": "Items Sold"}, {"value": "100%", "label": "Handmade"}, {"value": "Eco", "label": "Materials"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Ceramics", "description": "Hand-thrown pottery and ceramic pieces for your home."}, {"title": "Textiles", "description": "Woven, knitted, and sewn goods made with natural fibers."}, {"title": "Custom Orders", "description": "Commission a unique piece tailored just for you."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Emma T.", "role": "Collector", "quote": "Each piece is truly unique. Beautiful craftsmanship.", "rating": 5}, {"name": "Noah B.", "role": "Gift Buyer", "quote": "Perfect gifts that people actually love and keep.", "rating": 5}, {"name": "Sophie M.", "role": "Interior Designer", "quote": "These pieces add soul to any space. Stunning.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Find Your Piece", "subtitle": "Browse our collection or commission a custom creation.", "buttonText": "Browse Collection"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_handmade',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_handmade', 'Classic — Handmade', 'Classic template for handmade products', 'handmade', 'products',
 '{"Terracotta": {"primary": "#92400e", "secondary": "#c2410c", "accent": "#fff7ed"}, "Sage": {"primary": "#365314", "secondary": "#84cc16", "accent": "#f7fee7"}, "Clay": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}}',
 '{"siteTitle": "Heritage Crafts", "navButtonText": "Browse Collection", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Handcrafted With Love", "subtitle": "Unique, artisan-made products crafted with care and attention to detail.", "buttonText": "Browse Collection"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "2000+", "label": "Items Sold"}, {"value": "100%", "label": "Handmade"}, {"value": "Eco", "label": "Materials"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Ceramics", "description": "Hand-thrown pottery and ceramic pieces for your home."}, {"title": "Textiles", "description": "Woven, knitted, and sewn goods made with natural fibers."}, {"title": "Custom Orders", "description": "Commission a unique piece tailored just for you."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["100% Handmade", "Sustainable Materials", "Custom Orders", "Gift Wrapping"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Emma T.", "role": "Collector", "quote": "Each piece is truly unique. Beautiful craftsmanship.", "rating": 5}, {"name": "Noah B.", "role": "Gift Buyer", "quote": "Perfect gifts that people actually love and keep.", "rating": 5}, {"name": "Sophie M.", "role": "Interior Designer", "quote": "These pieces add soul to any space. Stunning.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["100% Handmade", "Sustainable Materials", "Custom Orders", "Gift Wrapping"]}}, {"type": "cta", "data": {"title": "Find Your Piece", "subtitle": "Browse our collection or commission a custom creation.", "buttonText": "Browse Collection"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_handmade',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_handmade', 'Organic — Handmade', 'Organic template for handmade products', 'handmade', 'products',
 '{"Terracotta": {"primary": "#92400e", "secondary": "#c2410c", "accent": "#fff7ed"}, "Sage": {"primary": "#365314", "secondary": "#84cc16", "accent": "#f7fee7"}, "Clay": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}}',
 '{"siteTitle": "Earth & Thread", "navButtonText": "Browse Collection", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Handcrafted With Love", "subtitle": "Unique, artisan-made products crafted with care and attention to detail.", "buttonText": "Browse Collection"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["100% Handmade", "Sustainable Materials", "Custom Orders", "Gift Wrapping"]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Ceramics", "description": "Hand-thrown pottery and ceramic pieces for your home."}, {"title": "Textiles", "description": "Woven, knitted, and sewn goods made with natural fibers."}, {"title": "Custom Orders", "description": "Commission a unique piece tailored just for you."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Emma T.", "role": "Collector", "quote": "Each piece is truly unique. Beautiful craftsmanship.", "rating": 5}, {"name": "Noah B.", "role": "Gift Buyer", "quote": "Perfect gifts that people actually love and keep.", "rating": 5}, {"name": "Sophie M.", "role": "Interior Designer", "quote": "These pieces add soul to any space. Stunning.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Find Your Piece", "subtitle": "Browse our collection or commission a custom creation.", "buttonText": "Browse Collection"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_handmade',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_handmade', 'Sleek — Handmade', 'Sleek template for handmade products', 'handmade', 'products',
 '{"Terracotta": {"primary": "#92400e", "secondary": "#c2410c", "accent": "#fff7ed"}, "Sage": {"primary": "#365314", "secondary": "#84cc16", "accent": "#f7fee7"}, "Clay": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}}',
 '{"siteTitle": "Pure Craft", "navButtonText": "Browse Collection", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Handcrafted With Love", "subtitle": "Unique, artisan-made products crafted with care and attention to detail.", "buttonText": "Browse Collection"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Ceramics", "description": "Hand-thrown pottery and ceramic pieces for your home."}, {"title": "Textiles", "description": "Woven, knitted, and sewn goods made with natural fibers."}, {"title": "Custom Orders", "description": "Commission a unique piece tailored just for you."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "2000+", "label": "Items Sold"}, {"value": "100%", "label": "Handmade"}, {"value": "Eco", "label": "Materials"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Emma T.", "role": "Collector", "quote": "Each piece is truly unique. Beautiful craftsmanship.", "rating": 5}, {"name": "Noah B.", "role": "Gift Buyer", "quote": "Perfect gifts that people actually love and keep.", "rating": 5}, {"name": "Sophie M.", "role": "Interior Designer", "quote": "These pieces add soul to any space. Stunning.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Find Your Piece", "subtitle": "Browse our collection or commission a custom creation.", "buttonText": "Browse Collection"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_handmade',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_handmade', 'Vibrant — Handmade', 'Vibrant template for handmade products', 'handmade', 'products',
 '{"Terracotta": {"primary": "#92400e", "secondary": "#c2410c", "accent": "#fff7ed"}, "Sage": {"primary": "#365314", "secondary": "#84cc16", "accent": "#f7fee7"}, "Clay": {"primary": "#78350f", "secondary": "#d97706", "accent": "#fffbeb"}}',
 '{"siteTitle": "CraftJoy", "navButtonText": "Browse Collection", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Handcrafted With Love", "subtitle": "Unique, artisan-made products crafted with care and attention to detail.", "buttonText": "Browse Collection"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "2000+", "label": "Items Sold"}, {"value": "100%", "label": "Handmade"}, {"value": "Eco", "label": "Materials"}, {"value": "5\u2605", "label": "Reviews"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Ceramics", "description": "Hand-thrown pottery and ceramic pieces for your home."}, {"title": "Textiles", "description": "Woven, knitted, and sewn goods made with natural fibers."}, {"title": "Custom Orders", "description": "Commission a unique piece tailored just for you."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Emma T.", "role": "Collector", "quote": "Each piece is truly unique. Beautiful craftsmanship.", "rating": 5}, {"name": "Noah B.", "role": "Gift Buyer", "quote": "Perfect gifts that people actually love and keep.", "rating": 5}, {"name": "Sophie M.", "role": "Interior Designer", "quote": "These pieces add soul to any space. Stunning.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Find Your Piece", "subtitle": "Browse our collection or commission a custom creation.", "buttonText": "Browse Collection"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_handmade',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_digital', 'Luxe — Digital', 'Luxe template for digital products', 'digital', 'products',
 '{"Tech": {"primary": "#0f172a", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Neon": {"primary": "#1e1b4b", "secondary": "#818cf8", "accent": "#eef2ff"}, "Cyber": {"primary": "#111827", "secondary": "#22d3ee", "accent": "#cffafe"}}',
 '{"siteTitle": "Luxe Digital", "navButtonText": "Browse Products", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Premium Digital Products", "subtitle": "Templates, courses, and tools to supercharge your workflow.", "buttonText": "Browse Products"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Templates", "description": "Professional templates for design, business, and productivity."}, {"title": "Online Courses", "description": "Learn new skills with our comprehensive video courses."}, {"title": "Digital Tools", "description": "Software tools and plugins to boost your productivity."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Instant Download", "Money-Back Guarantee", "Regular Updates", "Community Access"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Taylor H.", "role": "Designer", "quote": "These templates saved me hours of work. Worth every penny.", "rating": 5}, {"name": "Jordan P.", "role": "Developer", "quote": "High quality digital tools. Customer support is great too.", "rating": 5}, {"name": "Morgan K.", "role": "Entrepreneur", "quote": "The courses are excellent. Learned so much.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Level Up Today", "subtitle": "Instant download after purchase. 30-day money-back guarantee.", "buttonText": "Browse Products"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_digital',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_digital', 'Vivid — Digital', 'Vivid template for digital products', 'digital', 'products',
 '{"Tech": {"primary": "#0f172a", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Neon": {"primary": "#1e1b4b", "secondary": "#818cf8", "accent": "#eef2ff"}, "Cyber": {"primary": "#111827", "secondary": "#22d3ee", "accent": "#cffafe"}}',
 '{"siteTitle": "ByteForce", "navButtonText": "Browse Products", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Premium Digital Products", "subtitle": "Templates, courses, and tools to supercharge your workflow.", "buttonText": "Browse Products"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "5K+", "label": "Downloads"}, {"value": "100+", "label": "Products"}, {"value": "Instant", "label": "Delivery"}, {"value": "4.9\u2605", "label": "Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Templates", "description": "Professional templates for design, business, and productivity."}, {"title": "Online Courses", "description": "Learn new skills with our comprehensive video courses."}, {"title": "Digital Tools", "description": "Software tools and plugins to boost your productivity."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Taylor H.", "role": "Designer", "quote": "These templates saved me hours of work. Worth every penny.", "rating": 5}, {"name": "Jordan P.", "role": "Developer", "quote": "High quality digital tools. Customer support is great too.", "rating": 5}, {"name": "Morgan K.", "role": "Entrepreneur", "quote": "The courses are excellent. Learned so much.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Level Up Today", "subtitle": "Instant download after purchase. 30-day money-back guarantee.", "buttonText": "Browse Products"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_digital',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_digital', 'Airy — Digital', 'Airy template for digital products', 'digital', 'products',
 '{"Tech": {"primary": "#0f172a", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Neon": {"primary": "#1e1b4b", "secondary": "#818cf8", "accent": "#eef2ff"}, "Cyber": {"primary": "#111827", "secondary": "#22d3ee", "accent": "#cffafe"}}',
 '{"siteTitle": "Cloud Store", "navButtonText": "Browse Products", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Premium Digital Products", "subtitle": "Templates, courses, and tools to supercharge your workflow.", "buttonText": "Browse Products"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Instant Download", "Money-Back Guarantee", "Regular Updates", "Community Access"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Instant Download", "Money-Back Guarantee", "Regular Updates", "Community Access"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Taylor H.", "role": "Designer", "quote": "These templates saved me hours of work. Worth every penny.", "rating": 5}, {"name": "Jordan P.", "role": "Developer", "quote": "High quality digital tools. Customer support is great too.", "rating": 5}, {"name": "Morgan K.", "role": "Entrepreneur", "quote": "The courses are excellent. Learned so much.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Level Up Today", "subtitle": "Instant download after purchase. 30-day money-back guarantee.", "buttonText": "Browse Products"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_digital',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_digital', 'Edge — Digital', 'Edge template for digital products', 'digital', 'products',
 '{"Tech": {"primary": "#0f172a", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Neon": {"primary": "#1e1b4b", "secondary": "#818cf8", "accent": "#eef2ff"}, "Cyber": {"primary": "#111827", "secondary": "#22d3ee", "accent": "#cffafe"}}',
 '{"siteTitle": "DataEdge", "navButtonText": "Browse Products", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Premium Digital Products", "subtitle": "Templates, courses, and tools to supercharge your workflow.", "buttonText": "Browse Products"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "5K+", "label": "Downloads"}, {"value": "100+", "label": "Products"}, {"value": "Instant", "label": "Delivery"}, {"value": "4.9\u2605", "label": "Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Templates", "description": "Professional templates for design, business, and productivity."}, {"title": "Online Courses", "description": "Learn new skills with our comprehensive video courses."}, {"title": "Digital Tools", "description": "Software tools and plugins to boost your productivity."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Taylor H.", "role": "Designer", "quote": "These templates saved me hours of work. Worth every penny.", "rating": 5}, {"name": "Jordan P.", "role": "Developer", "quote": "High quality digital tools. Customer support is great too.", "rating": 5}, {"name": "Morgan K.", "role": "Entrepreneur", "quote": "The courses are excellent. Learned so much.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Level Up Today", "subtitle": "Instant download after purchase. 30-day money-back guarantee.", "buttonText": "Browse Products"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_digital',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_digital', 'Classic — Digital', 'Classic template for digital products', 'digital', 'products',
 '{"Tech": {"primary": "#0f172a", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Neon": {"primary": "#1e1b4b", "secondary": "#818cf8", "accent": "#eef2ff"}, "Cyber": {"primary": "#111827", "secondary": "#22d3ee", "accent": "#cffafe"}}',
 '{"siteTitle": "Digital Pro", "navButtonText": "Browse Products", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Premium Digital Products", "subtitle": "Templates, courses, and tools to supercharge your workflow.", "buttonText": "Browse Products"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "5K+", "label": "Downloads"}, {"value": "100+", "label": "Products"}, {"value": "Instant", "label": "Delivery"}, {"value": "4.9\u2605", "label": "Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Templates", "description": "Professional templates for design, business, and productivity."}, {"title": "Online Courses", "description": "Learn new skills with our comprehensive video courses."}, {"title": "Digital Tools", "description": "Software tools and plugins to boost your productivity."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Instant Download", "Money-Back Guarantee", "Regular Updates", "Community Access"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Taylor H.", "role": "Designer", "quote": "These templates saved me hours of work. Worth every penny.", "rating": 5}, {"name": "Jordan P.", "role": "Developer", "quote": "High quality digital tools. Customer support is great too.", "rating": 5}, {"name": "Morgan K.", "role": "Entrepreneur", "quote": "The courses are excellent. Learned so much.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Instant Download", "Money-Back Guarantee", "Regular Updates", "Community Access"]}}, {"type": "cta", "data": {"title": "Level Up Today", "subtitle": "Instant download after purchase. 30-day money-back guarantee.", "buttonText": "Browse Products"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_digital',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_digital', 'Organic — Digital', 'Organic template for digital products', 'digital', 'products',
 '{"Tech": {"primary": "#0f172a", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Neon": {"primary": "#1e1b4b", "secondary": "#818cf8", "accent": "#eef2ff"}, "Cyber": {"primary": "#111827", "secondary": "#22d3ee", "accent": "#cffafe"}}',
 '{"siteTitle": "Mindful Digital", "navButtonText": "Browse Products", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Premium Digital Products", "subtitle": "Templates, courses, and tools to supercharge your workflow.", "buttonText": "Browse Products"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Instant Download", "Money-Back Guarantee", "Regular Updates", "Community Access"]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Templates", "description": "Professional templates for design, business, and productivity."}, {"title": "Online Courses", "description": "Learn new skills with our comprehensive video courses."}, {"title": "Digital Tools", "description": "Software tools and plugins to boost your productivity."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Taylor H.", "role": "Designer", "quote": "These templates saved me hours of work. Worth every penny.", "rating": 5}, {"name": "Jordan P.", "role": "Developer", "quote": "High quality digital tools. Customer support is great too.", "rating": 5}, {"name": "Morgan K.", "role": "Entrepreneur", "quote": "The courses are excellent. Learned so much.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Level Up Today", "subtitle": "Instant download after purchase. 30-day money-back guarantee.", "buttonText": "Browse Products"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_digital',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_digital', 'Sleek — Digital', 'Sleek template for digital products', 'digital', 'products',
 '{"Tech": {"primary": "#0f172a", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Neon": {"primary": "#1e1b4b", "secondary": "#818cf8", "accent": "#eef2ff"}, "Cyber": {"primary": "#111827", "secondary": "#22d3ee", "accent": "#cffafe"}}',
 '{"siteTitle": "Zero Digital", "navButtonText": "Browse Products", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Premium Digital Products", "subtitle": "Templates, courses, and tools to supercharge your workflow.", "buttonText": "Browse Products"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Templates", "description": "Professional templates for design, business, and productivity."}, {"title": "Online Courses", "description": "Learn new skills with our comprehensive video courses."}, {"title": "Digital Tools", "description": "Software tools and plugins to boost your productivity."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "5K+", "label": "Downloads"}, {"value": "100+", "label": "Products"}, {"value": "Instant", "label": "Delivery"}, {"value": "4.9\u2605", "label": "Rating"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Taylor H.", "role": "Designer", "quote": "These templates saved me hours of work. Worth every penny.", "rating": 5}, {"name": "Jordan P.", "role": "Developer", "quote": "High quality digital tools. Customer support is great too.", "rating": 5}, {"name": "Morgan K.", "role": "Entrepreneur", "quote": "The courses are excellent. Learned so much.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Level Up Today", "subtitle": "Instant download after purchase. 30-day money-back guarantee.", "buttonText": "Browse Products"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_digital',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_digital', 'Vibrant — Digital', 'Vibrant template for digital products', 'digital', 'products',
 '{"Tech": {"primary": "#0f172a", "secondary": "#06b6d4", "accent": "#ecfeff"}, "Neon": {"primary": "#1e1b4b", "secondary": "#818cf8", "accent": "#eef2ff"}, "Cyber": {"primary": "#111827", "secondary": "#22d3ee", "accent": "#cffafe"}}',
 '{"siteTitle": "PixelPop", "navButtonText": "Browse Products", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Premium Digital Products", "subtitle": "Templates, courses, and tools to supercharge your workflow.", "buttonText": "Browse Products"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "5K+", "label": "Downloads"}, {"value": "100+", "label": "Products"}, {"value": "Instant", "label": "Delivery"}, {"value": "4.9\u2605", "label": "Rating"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Templates", "description": "Professional templates for design, business, and productivity."}, {"title": "Online Courses", "description": "Learn new skills with our comprehensive video courses."}, {"title": "Digital Tools", "description": "Software tools and plugins to boost your productivity."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Taylor H.", "role": "Designer", "quote": "These templates saved me hours of work. Worth every penny.", "rating": 5}, {"name": "Jordan P.", "role": "Developer", "quote": "High quality digital tools. Customer support is great too.", "rating": 5}, {"name": "Morgan K.", "role": "Entrepreneur", "quote": "The courses are excellent. Learned so much.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Level Up Today", "subtitle": "Instant download after purchase. 30-day money-back guarantee.", "buttonText": "Browse Products"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_digital',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_dropship', 'Luxe — Dropship', 'Luxe template for dropship products', 'dropship', 'products',
 '{"Deal": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Modern": {"primary": "#0f172a", "secondary": "#8b5cf6", "accent": "#f5f3ff"}, "Pop": {"primary": "#111827", "secondary": "#ec4899", "accent": "#fdf2f8"}}',
 '{"siteTitle": "Premium Drop", "navButtonText": "Shop Deals", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Trending Products", "subtitle": "Discover the latest trending products at unbeatable prices.", "buttonText": "Shop Deals"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Trending Now", "description": "The hottest products everyone is talking about."}, {"title": "Best Value", "description": "Premium quality at the most competitive prices."}, {"title": "Flash Sales", "description": "Limited-time offers you don''t want to miss."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Free Worldwide Shipping", "Easy Returns", "Secure Payment", "Fast Processing"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Casey W.", "role": "Shopper", "quote": "Great prices and my order arrived faster than expected!", "rating": 5}, {"name": "Riley J.", "role": "Repeat Customer", "quote": "Always finding cool stuff here. Quality is consistent.", "rating": 5}, {"name": "Pat N.", "role": "Verified Buyer", "quote": "Excellent customer service when I had a question.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Deals Ending Soon", "subtitle": "Don''t miss out on our limited-time offers. Free shipping on all orders.", "buttonText": "Shop Deals"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_dropship',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_dropship', 'Vivid — Dropship', 'Vivid template for dropship products', 'dropship', 'products',
 '{"Deal": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Modern": {"primary": "#0f172a", "secondary": "#8b5cf6", "accent": "#f5f3ff"}, "Pop": {"primary": "#111827", "secondary": "#ec4899", "accent": "#fdf2f8"}}',
 '{"siteTitle": "DropVivid", "navButtonText": "Shop Deals", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Trending Products", "subtitle": "Discover the latest trending products at unbeatable prices.", "buttonText": "Shop Deals"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "50K+", "label": "Orders Shipped"}, {"value": "1000+", "label": "Products"}, {"value": "Free", "label": "Shipping"}, {"value": "4.8\u2605", "label": "Trustpilot"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Trending Now", "description": "The hottest products everyone is talking about."}, {"title": "Best Value", "description": "Premium quality at the most competitive prices."}, {"title": "Flash Sales", "description": "Limited-time offers you don''t want to miss."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Casey W.", "role": "Shopper", "quote": "Great prices and my order arrived faster than expected!", "rating": 5}, {"name": "Riley J.", "role": "Repeat Customer", "quote": "Always finding cool stuff here. Quality is consistent.", "rating": 5}, {"name": "Pat N.", "role": "Verified Buyer", "quote": "Excellent customer service when I had a question.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Deals Ending Soon", "subtitle": "Don''t miss out on our limited-time offers. Free shipping on all orders.", "buttonText": "Shop Deals"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_dropship',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_dropship', 'Airy — Dropship', 'Airy template for dropship products', 'dropship', 'products',
 '{"Deal": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Modern": {"primary": "#0f172a", "secondary": "#8b5cf6", "accent": "#f5f3ff"}, "Pop": {"primary": "#111827", "secondary": "#ec4899", "accent": "#fdf2f8"}}',
 '{"siteTitle": "Easy Drop", "navButtonText": "Shop Deals", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Trending Products", "subtitle": "Discover the latest trending products at unbeatable prices.", "buttonText": "Shop Deals"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Free Worldwide Shipping", "Easy Returns", "Secure Payment", "Fast Processing"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Free Worldwide Shipping", "Easy Returns", "Secure Payment", "Fast Processing"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Casey W.", "role": "Shopper", "quote": "Great prices and my order arrived faster than expected!", "rating": 5}, {"name": "Riley J.", "role": "Repeat Customer", "quote": "Always finding cool stuff here. Quality is consistent.", "rating": 5}, {"name": "Pat N.", "role": "Verified Buyer", "quote": "Excellent customer service when I had a question.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Deals Ending Soon", "subtitle": "Don''t miss out on our limited-time offers. Free shipping on all orders.", "buttonText": "Shop Deals"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_dropship',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_dropship', 'Edge — Dropship', 'Edge template for dropship products', 'dropship', 'products',
 '{"Deal": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Modern": {"primary": "#0f172a", "secondary": "#8b5cf6", "accent": "#f5f3ff"}, "Pop": {"primary": "#111827", "secondary": "#ec4899", "accent": "#fdf2f8"}}',
 '{"siteTitle": "DropEdge", "navButtonText": "Shop Deals", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Trending Products", "subtitle": "Discover the latest trending products at unbeatable prices.", "buttonText": "Shop Deals"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "50K+", "label": "Orders Shipped"}, {"value": "1000+", "label": "Products"}, {"value": "Free", "label": "Shipping"}, {"value": "4.8\u2605", "label": "Trustpilot"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Trending Now", "description": "The hottest products everyone is talking about."}, {"title": "Best Value", "description": "Premium quality at the most competitive prices."}, {"title": "Flash Sales", "description": "Limited-time offers you don''t want to miss."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Casey W.", "role": "Shopper", "quote": "Great prices and my order arrived faster than expected!", "rating": 5}, {"name": "Riley J.", "role": "Repeat Customer", "quote": "Always finding cool stuff here. Quality is consistent.", "rating": 5}, {"name": "Pat N.", "role": "Verified Buyer", "quote": "Excellent customer service when I had a question.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Deals Ending Soon", "subtitle": "Don''t miss out on our limited-time offers. Free shipping on all orders.", "buttonText": "Shop Deals"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_dropship',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_dropship', 'Classic — Dropship', 'Classic template for dropship products', 'dropship', 'products',
 '{"Deal": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Modern": {"primary": "#0f172a", "secondary": "#8b5cf6", "accent": "#f5f3ff"}, "Pop": {"primary": "#111827", "secondary": "#ec4899", "accent": "#fdf2f8"}}',
 '{"siteTitle": "Classic Drop", "navButtonText": "Shop Deals", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Trending Products", "subtitle": "Discover the latest trending products at unbeatable prices.", "buttonText": "Shop Deals"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "50K+", "label": "Orders Shipped"}, {"value": "1000+", "label": "Products"}, {"value": "Free", "label": "Shipping"}, {"value": "4.8\u2605", "label": "Trustpilot"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Trending Now", "description": "The hottest products everyone is talking about."}, {"title": "Best Value", "description": "Premium quality at the most competitive prices."}, {"title": "Flash Sales", "description": "Limited-time offers you don''t want to miss."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Free Worldwide Shipping", "Easy Returns", "Secure Payment", "Fast Processing"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Casey W.", "role": "Shopper", "quote": "Great prices and my order arrived faster than expected!", "rating": 5}, {"name": "Riley J.", "role": "Repeat Customer", "quote": "Always finding cool stuff here. Quality is consistent.", "rating": 5}, {"name": "Pat N.", "role": "Verified Buyer", "quote": "Excellent customer service when I had a question.", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Free Worldwide Shipping", "Easy Returns", "Secure Payment", "Fast Processing"]}}, {"type": "cta", "data": {"title": "Deals Ending Soon", "subtitle": "Don''t miss out on our limited-time offers. Free shipping on all orders.", "buttonText": "Shop Deals"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_dropship',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_dropship', 'Organic — Dropship', 'Organic template for dropship products', 'dropship', 'products',
 '{"Deal": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Modern": {"primary": "#0f172a", "secondary": "#8b5cf6", "accent": "#f5f3ff"}, "Pop": {"primary": "#111827", "secondary": "#ec4899", "accent": "#fdf2f8"}}',
 '{"siteTitle": "Natural Drop", "navButtonText": "Shop Deals", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Trending Products", "subtitle": "Discover the latest trending products at unbeatable prices.", "buttonText": "Shop Deals"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Free Worldwide Shipping", "Easy Returns", "Secure Payment", "Fast Processing"]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Trending Now", "description": "The hottest products everyone is talking about."}, {"title": "Best Value", "description": "Premium quality at the most competitive prices."}, {"title": "Flash Sales", "description": "Limited-time offers you don''t want to miss."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Casey W.", "role": "Shopper", "quote": "Great prices and my order arrived faster than expected!", "rating": 5}, {"name": "Riley J.", "role": "Repeat Customer", "quote": "Always finding cool stuff here. Quality is consistent.", "rating": 5}, {"name": "Pat N.", "role": "Verified Buyer", "quote": "Excellent customer service when I had a question.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Deals Ending Soon", "subtitle": "Don''t miss out on our limited-time offers. Free shipping on all orders.", "buttonText": "Shop Deals"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_dropship',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_dropship', 'Sleek — Dropship', 'Sleek template for dropship products', 'dropship', 'products',
 '{"Deal": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Modern": {"primary": "#0f172a", "secondary": "#8b5cf6", "accent": "#f5f3ff"}, "Pop": {"primary": "#111827", "secondary": "#ec4899", "accent": "#fdf2f8"}}',
 '{"siteTitle": "SlimDrop", "navButtonText": "Shop Deals", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Trending Products", "subtitle": "Discover the latest trending products at unbeatable prices.", "buttonText": "Shop Deals"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Trending Now", "description": "The hottest products everyone is talking about."}, {"title": "Best Value", "description": "Premium quality at the most competitive prices."}, {"title": "Flash Sales", "description": "Limited-time offers you don''t want to miss."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "50K+", "label": "Orders Shipped"}, {"value": "1000+", "label": "Products"}, {"value": "Free", "label": "Shipping"}, {"value": "4.8\u2605", "label": "Trustpilot"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Casey W.", "role": "Shopper", "quote": "Great prices and my order arrived faster than expected!", "rating": 5}, {"name": "Riley J.", "role": "Repeat Customer", "quote": "Always finding cool stuff here. Quality is consistent.", "rating": 5}, {"name": "Pat N.", "role": "Verified Buyer", "quote": "Excellent customer service when I had a question.", "rating": 5}]}}, {"type": "cta", "data": {"title": "Deals Ending Soon", "subtitle": "Don''t miss out on our limited-time offers. Free shipping on all orders.", "buttonText": "Shop Deals"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_dropship',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_dropship', 'Vibrant — Dropship', 'Vibrant template for dropship products', 'dropship', 'products',
 '{"Deal": {"primary": "#1f2937", "secondary": "#f59e0b", "accent": "#fffbeb"}, "Modern": {"primary": "#0f172a", "secondary": "#8b5cf6", "accent": "#f5f3ff"}, "Pop": {"primary": "#111827", "secondary": "#ec4899", "accent": "#fdf2f8"}}',
 '{"siteTitle": "DropZone", "navButtonText": "Shop Deals", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Trending Products", "subtitle": "Discover the latest trending products at unbeatable prices.", "buttonText": "Shop Deals"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "50K+", "label": "Orders Shipped"}, {"value": "1000+", "label": "Products"}, {"value": "Free", "label": "Shipping"}, {"value": "4.8\u2605", "label": "Trustpilot"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Trending Now", "description": "The hottest products everyone is talking about."}, {"title": "Best Value", "description": "Premium quality at the most competitive prices."}, {"title": "Flash Sales", "description": "Limited-time offers you don''t want to miss."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Casey W.", "role": "Shopper", "quote": "Great prices and my order arrived faster than expected!", "rating": 5}, {"name": "Riley J.", "role": "Repeat Customer", "quote": "Always finding cool stuff here. Quality is consistent.", "rating": 5}, {"name": "Pat N.", "role": "Verified Buyer", "quote": "Excellent customer service when I had a question.", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Deals Ending Soon", "subtitle": "Don''t miss out on our limited-time offers. Free shipping on all orders.", "buttonText": "Shop Deals"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_dropship',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('luxe_subscription', 'Luxe — Subscription', 'Luxe template for subscription products', 'subscription', 'products',
 '{"Teal Pop": {"primary": "#0f766e", "secondary": "#f97316", "accent": "#fff7ed"}, "Berry": {"primary": "#831843", "secondary": "#ec4899", "accent": "#fdf2f8"}, "Ocean": {"primary": "#0c4a6e", "secondary": "#06b6d4", "accent": "#ecfeff"}}',
 '{"siteTitle": "Luxe Box", "navButtonText": "Subscribe Now", "titleFont": "Playfair Display", "bodyFont": "Lato", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Curated Subscription Boxes", "subtitle": "Discover something new every month. Curated with care, delivered to your door.", "buttonText": "Subscribe Now"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Monthly Box", "description": "5-7 curated items delivered to your door every month."}, {"title": "Seasonal Special", "description": "Quarterly boxes with seasonal themed products."}, {"title": "Gift Subscriptions", "description": "The perfect gift that keeps on giving."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Free First Box", "Cancel Anytime", "Curated Selection", "Member Perks"]}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Zoe L.", "role": "Subscriber", "quote": "The best surprise every month! Always love what I get.", "rating": 5}, {"name": "Matt K.", "role": "6-Month Subscriber", "quote": "Great value and the curation is spot-on.", "rating": 5}, {"name": "Ava R.", "role": "Gift Recipient", "quote": "Best gift I have ever received. Subscribed myself now!", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Subscription", "subtitle": "First box ships free. Cancel or skip anytime.", "buttonText": "Subscribe Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=luxe_subscription',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vivid_subscription', 'Vivid — Subscription', 'Vivid template for subscription products', 'subscription', 'products',
 '{"Teal Pop": {"primary": "#0f766e", "secondary": "#f97316", "accent": "#fff7ed"}, "Berry": {"primary": "#831843", "secondary": "#ec4899", "accent": "#fdf2f8"}, "Ocean": {"primary": "#0c4a6e", "secondary": "#06b6d4", "accent": "#ecfeff"}}',
 '{"siteTitle": "BoxBurst", "navButtonText": "Subscribe Now", "titleFont": "Space Grotesk", "bodyFont": "DM Sans", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Curated Subscription Boxes", "subtitle": "Discover something new every month. Curated with care, delivered to your door.", "buttonText": "Subscribe Now"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "3K+", "label": "Subscribers"}, {"value": "50+", "label": "Boxes Shipped"}, {"value": "5-7", "label": "Items/Box"}, {"value": "97%", "label": "Love It"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Monthly Box", "description": "5-7 curated items delivered to your door every month."}, {"title": "Seasonal Special", "description": "Quarterly boxes with seasonal themed products."}, {"title": "Gift Subscriptions", "description": "The perfect gift that keeps on giving."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Zoe L.", "role": "Subscriber", "quote": "The best surprise every month! Always love what I get.", "rating": 5}, {"name": "Matt K.", "role": "6-Month Subscriber", "quote": "Great value and the curation is spot-on.", "rating": 5}, {"name": "Ava R.", "role": "Gift Recipient", "quote": "Best gift I have ever received. Subscribed myself now!", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Subscription", "subtitle": "First box ships free. Cancel or skip anytime.", "buttonText": "Subscribe Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vivid_subscription',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('airy_subscription', 'Airy — Subscription', 'Airy template for subscription products', 'subscription', 'products',
 '{"Teal Pop": {"primary": "#0f766e", "secondary": "#f97316", "accent": "#fff7ed"}, "Berry": {"primary": "#831843", "secondary": "#ec4899", "accent": "#fdf2f8"}, "Ocean": {"primary": "#0c4a6e", "secondary": "#06b6d4", "accent": "#ecfeff"}}',
 '{"siteTitle": "Joy Box", "navButtonText": "Subscribe Now", "titleFont": "Nunito", "bodyFont": "Nunito", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Curated Subscription Boxes", "subtitle": "Discover something new every month. Curated with care, delivered to your door.", "buttonText": "Subscribe Now"}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Free First Box", "Cancel Anytime", "Curated Selection", "Member Perks"]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Free First Box", "Cancel Anytime", "Curated Selection", "Member Perks"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Zoe L.", "role": "Subscriber", "quote": "The best surprise every month! Always love what I get.", "rating": 5}, {"name": "Matt K.", "role": "6-Month Subscriber", "quote": "Great value and the curation is spot-on.", "rating": 5}, {"name": "Ava R.", "role": "Gift Recipient", "quote": "Best gift I have ever received. Subscribed myself now!", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Start Your Subscription", "subtitle": "First box ships free. Cancel or skip anytime.", "buttonText": "Subscribe Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=airy_subscription',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('edge_subscription', 'Edge — Subscription', 'Edge template for subscription products', 'subscription', 'products',
 '{"Teal Pop": {"primary": "#0f766e", "secondary": "#f97316", "accent": "#fff7ed"}, "Berry": {"primary": "#831843", "secondary": "#ec4899", "accent": "#fdf2f8"}, "Ocean": {"primary": "#0c4a6e", "secondary": "#06b6d4", "accent": "#ecfeff"}}',
 '{"siteTitle": "CrateEdge", "navButtonText": "Subscribe Now", "titleFont": "JetBrains Mono", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Curated Subscription Boxes", "subtitle": "Discover something new every month. Curated with care, delivered to your door.", "buttonText": "Subscribe Now"}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "3K+", "label": "Subscribers"}, {"value": "50+", "label": "Boxes Shipped"}, {"value": "5-7", "label": "Items/Box"}, {"value": "97%", "label": "Love It"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Monthly Box", "description": "5-7 curated items delivered to your door every month."}, {"title": "Seasonal Special", "description": "Quarterly boxes with seasonal themed products."}, {"title": "Gift Subscriptions", "description": "The perfect gift that keeps on giving."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Zoe L.", "role": "Subscriber", "quote": "The best surprise every month! Always love what I get.", "rating": 5}, {"name": "Matt K.", "role": "6-Month Subscriber", "quote": "Great value and the curation is spot-on.", "rating": 5}, {"name": "Ava R.", "role": "Gift Recipient", "quote": "Best gift I have ever received. Subscribed myself now!", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Subscription", "subtitle": "First box ships free. Cancel or skip anytime.", "buttonText": "Subscribe Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=edge_subscription',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('classic_subscription', 'Classic — Subscription', 'Classic template for subscription products', 'subscription', 'products',
 '{"Teal Pop": {"primary": "#0f766e", "secondary": "#f97316", "accent": "#fff7ed"}, "Berry": {"primary": "#831843", "secondary": "#ec4899", "accent": "#fdf2f8"}, "Ocean": {"primary": "#0c4a6e", "secondary": "#06b6d4", "accent": "#ecfeff"}}',
 '{"siteTitle": "Classic Crate", "navButtonText": "Subscribe Now", "titleFont": "Merriweather", "bodyFont": "Source Sans 3", "blocks": [{"type": "hero", "data": {"variant": "split", "title": "Curated Subscription Boxes", "subtitle": "Discover something new every month. Curated with care, delivered to your door.", "buttonText": "Subscribe Now"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "3K+", "label": "Subscribers"}, {"value": "50+", "label": "Boxes Shipped"}, {"value": "5-7", "label": "Items/Box"}, {"value": "97%", "label": "Love It"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Monthly Box", "description": "5-7 curated items delivered to your door every month."}, {"title": "Seasonal Special", "description": "Quarterly boxes with seasonal themed products."}, {"title": "Gift Subscriptions", "description": "The perfect gift that keeps on giving."}]}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Free First Box", "Cancel Anytime", "Curated Selection", "Member Perks"]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Zoe L.", "role": "Subscriber", "quote": "The best surprise every month! Always love what I get.", "rating": 5}, {"name": "Matt K.", "role": "6-Month Subscriber", "quote": "Great value and the curation is spot-on.", "rating": 5}, {"name": "Ava R.", "role": "Gift Recipient", "quote": "Best gift I have ever received. Subscribed myself now!", "rating": 5}]}}, {"type": "featuresList", "data": {"title": "Why Choose Us?", "items": ["Free First Box", "Cancel Anytime", "Curated Selection", "Member Perks"]}}, {"type": "cta", "data": {"title": "Start Your Subscription", "subtitle": "First box ships free. Cancel or skip anytime.", "buttonText": "Subscribe Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=classic_subscription',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('organic_subscription', 'Organic — Subscription', 'Organic template for subscription products', 'subscription', 'products',
 '{"Teal Pop": {"primary": "#0f766e", "secondary": "#f97316", "accent": "#fff7ed"}, "Berry": {"primary": "#831843", "secondary": "#ec4899", "accent": "#fdf2f8"}, "Ocean": {"primary": "#0c4a6e", "secondary": "#06b6d4", "accent": "#ecfeff"}}',
 '{"siteTitle": "Nature Box", "navButtonText": "Subscribe Now", "titleFont": "Libre Baskerville", "bodyFont": "Karla", "blocks": [{"type": "hero", "data": {"variant": "centered", "title": "Curated Subscription Boxes", "subtitle": "Discover something new every month. Curated with care, delivered to your door.", "buttonText": "Subscribe Now"}}, {"type": "aboutImageText", "data": {"title": "Why Choose Us?", "description": "We bring years of experience and dedication to every project.", "items": ["Free First Box", "Cancel Anytime", "Curated Selection", "Member Perks"]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Monthly Box", "description": "5-7 curated items delivered to your door every month."}, {"title": "Seasonal Special", "description": "Quarterly boxes with seasonal themed products."}, {"title": "Gift Subscriptions", "description": "The perfect gift that keeps on giving."}]}}, {"type": "gallery", "data": {"title": "Our Work", "subtitle": "Browse our portfolio of recent projects.", "columns": 3}}, {"type": "testimonials", "data": {"variant": "single", "title": "What Our Customers Say", "items": [{"name": "Zoe L.", "role": "Subscriber", "quote": "The best surprise every month! Always love what I get.", "rating": 5}, {"name": "Matt K.", "role": "6-Month Subscriber", "quote": "Great value and the curation is spot-on.", "rating": 5}, {"name": "Ava R.", "role": "Gift Recipient", "quote": "Best gift I have ever received. Subscribed myself now!", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Subscription", "subtitle": "First box ships free. Cancel or skip anytime.", "buttonText": "Subscribe Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=organic_subscription',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('sleek_subscription', 'Sleek — Subscription', 'Sleek template for subscription products', 'subscription', 'products',
 '{"Teal Pop": {"primary": "#0f766e", "secondary": "#f97316", "accent": "#fff7ed"}, "Berry": {"primary": "#831843", "secondary": "#ec4899", "accent": "#fdf2f8"}, "Ocean": {"primary": "#0c4a6e", "secondary": "#06b6d4", "accent": "#ecfeff"}}',
 '{"siteTitle": "Curate", "navButtonText": "Subscribe Now", "titleFont": "Sora", "bodyFont": "Inter", "blocks": [{"type": "hero", "data": {"variant": "minimal", "title": "Curated Subscription Boxes", "subtitle": "Discover something new every month. Curated with care, delivered to your door.", "buttonText": "Subscribe Now"}}, {"type": "logoCloud", "data": {"variant": "inline", "title": "Trusted By"}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Monthly Box", "description": "5-7 curated items delivered to your door every month."}, {"title": "Seasonal Special", "description": "Quarterly boxes with seasonal themed products."}, {"title": "Gift Subscriptions", "description": "The perfect gift that keeps on giving."}]}}, {"type": "stats", "data": {"variant": "cards", "items": [{"value": "3K+", "label": "Subscribers"}, {"value": "50+", "label": "Boxes Shipped"}, {"value": "5-7", "label": "Items/Box"}, {"value": "97%", "label": "Love It"}]}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Zoe L.", "role": "Subscriber", "quote": "The best surprise every month! Always love what I get.", "rating": 5}, {"name": "Matt K.", "role": "6-Month Subscriber", "quote": "Great value and the curation is spot-on.", "rating": 5}, {"name": "Ava R.", "role": "Gift Recipient", "quote": "Best gift I have ever received. Subscribed myself now!", "rating": 5}]}}, {"type": "cta", "data": {"title": "Start Your Subscription", "subtitle": "First box ships free. Cancel or skip anytime.", "buttonText": "Subscribe Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=sleek_subscription',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;

INSERT INTO template_metadata (template_id, name, description, category, business_type, palettes, default_content, thumbnail_url, multi_page, has_blog, has_gallery) VALUES
('vibrant_subscription', 'Vibrant — Subscription', 'Vibrant template for subscription products', 'subscription', 'products',
 '{"Teal Pop": {"primary": "#0f766e", "secondary": "#f97316", "accent": "#fff7ed"}, "Berry": {"primary": "#831843", "secondary": "#ec4899", "accent": "#fdf2f8"}, "Ocean": {"primary": "#0c4a6e", "secondary": "#06b6d4", "accent": "#ecfeff"}}',
 '{"siteTitle": "UnboxJoy", "navButtonText": "Subscribe Now", "titleFont": "Plus Jakarta Sans", "bodyFont": "Plus Jakarta Sans", "blocks": [{"type": "hero", "data": {"variant": "fullImage", "title": "Curated Subscription Boxes", "subtitle": "Discover something new every month. Curated with care, delivered to your door.", "buttonText": "Subscribe Now"}}, {"type": "stats", "data": {"variant": "banner", "items": [{"value": "3K+", "label": "Subscribers"}, {"value": "50+", "label": "Boxes Shipped"}, {"value": "5-7", "label": "Items/Box"}, {"value": "97%", "label": "Love It"}]}}, {"type": "servicesGrid", "data": {"title": "Our Collection", "subtitle": "What we offer", "items": [{"title": "Monthly Box", "description": "5-7 curated items delivered to your door every month."}, {"title": "Seasonal Special", "description": "Quarterly boxes with seasonal themed products."}, {"title": "Gift Subscriptions", "description": "The perfect gift that keeps on giving."}]}}, {"type": "team", "data": {"variant": "grid", "title": "Meet Our Team"}}, {"type": "testimonials", "data": {"variant": "cards", "title": "What Our Customers Say", "items": [{"name": "Zoe L.", "role": "Subscriber", "quote": "The best surprise every month! Always love what I get.", "rating": 5}, {"name": "Matt K.", "role": "6-Month Subscriber", "quote": "Great value and the curation is spot-on.", "rating": 5}, {"name": "Ava R.", "role": "Gift Recipient", "quote": "Best gift I have ever received. Subscribed myself now!", "rating": 5}]}}, {"type": "faq", "data": {"title": "Frequently Asked Questions"}}, {"type": "cta", "data": {"title": "Start Your Subscription", "subtitle": "First box ships free. Cancel or skip anytime.", "buttonText": "Subscribe Now"}}], "extra_pages": [{"slug": "products", "title": "Shop", "display_name": "Shop", "is_visible_in_nav": true, "blocks": [{"type": "productGrid", "data": {}}]}], "__navItems": [{"label": "Home", "linkType": "page", "pageSlug": "home"}, {"label": "Shop", "linkType": "page", "pageSlug": "products"}]}',
 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop&t=vibrant_subscription',
 true, false, false)
ON CONFLICT (template_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  business_type = EXCLUDED.business_type,
  palettes = EXCLUDED.palettes,
  default_content = EXCLUDED.default_content,
  thumbnail_url = EXCLUDED.thumbnail_url,
  multi_page = EXCLUDED.multi_page;
