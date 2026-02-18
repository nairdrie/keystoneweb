import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

interface CreateSiteRequest {
  selectedTemplateId: string;
  businessType: string;
  category: string;
}

interface SiteData {
  id: string;
  userId: string | null; // null until authenticated
  selectedTemplateId: string;
  businessType: string;
  category: string;
  designData: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Mock in-memory storage (later: Supabase)
// In production, this would be in a database
const sites = new Map<string, SiteData>();

export async function POST(request: NextRequest) {
  try {
    const body: CreateSiteRequest = await request.json();
    const { selectedTemplateId, businessType, category } = body;

    if (!selectedTemplateId || !businessType || !category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate new site ID
    const siteId = uuidv4();
    const now = new Date().toISOString();

    const newSite: SiteData = {
      id: siteId,
      userId: null, // Set when user authenticates
      selectedTemplateId,
      businessType,
      category,
      designData: {}, // Empty until user customizes
      createdAt: now,
      updatedAt: now,
    };

    // Store in memory (later: Supabase)
    sites.set(siteId, newSite);

    // Also store in a file for persistence during this session
    // Later: use Supabase

    return NextResponse.json(
      {
        siteId,
        message: 'Site created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating site:', error);
    return NextResponse.json(
      { error: 'Failed to create site' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('id');

    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID is required' },
        { status: 400 }
      );
    }

    const site = sites.get(siteId);
    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(site);
  } catch (error) {
    console.error('Error fetching site:', error);
    return NextResponse.json(
      { error: 'Failed to fetch site' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, designData } = body;

    if (!siteId) {
      return NextResponse.json(
        { error: 'Site ID is required' },
        { status: 400 }
      );
    }

    const site = sites.get(siteId);
    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    // Update design data
    site.designData = { ...site.designData, ...designData };
    site.updatedAt = new Date().toISOString();
    sites.set(siteId, site);

    return NextResponse.json({
      message: 'Site updated successfully',
      site,
    });
  } catch (error) {
    console.error('Error updating site:', error);
    return NextResponse.json(
      { error: 'Failed to update site' },
      { status: 500 }
    );
  }
}
