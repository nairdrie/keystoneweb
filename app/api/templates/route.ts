import { NextRequest, NextResponse } from 'next/server';

interface Template {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  tags: string[];
}

// Mock template database - later replace with Supabase queries
const mockTemplates: Record<string, Template[]> = {
  handyman: [
    {
      id: 'handyman-modern-1',
      name: 'Modern Service Pro',
      category: 'handyman',
      imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop',
      tags: ['modern', 'professional', 'services'],
    },
    {
      id: 'handyman-gallery-1',
      name: 'Gallery Showcase',
      category: 'handyman',
      imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=300&fit=crop',
      tags: ['gallery', 'portfolio', 'services'],
    },
    {
      id: 'handyman-booking-1',
      name: 'Booking Ready',
      category: 'handyman',
      imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop',
      tags: ['booking', 'schedule', 'services'],
    },
    {
      id: 'handyman-minimal-1',
      name: 'Minimal & Clean',
      category: 'handyman',
      imageUrl: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=300&fit=crop',
      tags: ['minimal', 'clean', 'modern'],
    },
  ],
  plumber: [
    {
      id: 'plumber-emergency-1',
      name: 'Emergency Response',
      category: 'plumber',
      imageUrl: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop',
      tags: ['emergency', '24/7', 'professional'],
    },
    {
      id: 'plumber-professional-1',
      name: 'Professional Trust',
      category: 'plumber',
      imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop',
      tags: ['professional', 'trustworthy', 'service'],
    },
    {
      id: 'plumber-modern-1',
      name: 'Modern Plumbing',
      category: 'plumber',
      imageUrl: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=300&fit=crop',
      tags: ['modern', 'clean', 'services'],
    },
  ],
  electrical: [
    {
      id: 'electrical-industrial-1',
      name: 'Industrial Grade',
      category: 'electrical',
      imageUrl: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop',
      tags: ['industrial', 'professional', 'technical'],
    },
    {
      id: 'electrical-modern-1',
      name: 'Modern Electric',
      category: 'electrical',
      imageUrl: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=300&fit=crop',
      tags: ['modern', 'clean', 'services'],
    },
  ],
  ecommerce: [
    {
      id: 'shop-modern-1',
      name: 'Modern Shop',
      category: 'ecommerce',
      imageUrl: 'https://images.unsplash.com/photo-1460925895917-aeb19be489c7?w=400&h=300&fit=crop',
      tags: ['modern', 'shop', 'ecommerce'],
    },
    {
      id: 'shop-premium-1',
      name: 'Premium Luxury',
      category: 'ecommerce',
      imageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=300&fit=crop',
      tags: ['premium', 'luxury', 'ecommerce'],
    },
    {
      id: 'shop-minimal-1',
      name: 'Minimal Store',
      category: 'ecommerce',
      imageUrl: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&h=300&fit=crop',
      tags: ['minimal', 'clean', 'shop'],
    },
  ],
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    // Get templates for this category (or empty array if not found)
    const categoryTemplates = mockTemplates[category] || [];

    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTemplates = categoryTemplates.slice(startIndex, endIndex);

    return NextResponse.json({
      templates: paginatedTemplates,
      total: categoryTemplates.length,
      page,
      hasMore: endIndex < categoryTemplates.length,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
