import { NextRequest, NextResponse } from 'next/server';
import { ShopRuleError, readJson, requireShopAccess, requireShopTechOrOwner, shopErrorResponse, siteIdFrom, type ShopAccess } from './access';

/** Run a route body and turn rule errors into JSON responses. */
export async function run(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    const out = await fn();
    if (out instanceof NextResponse) return out;
    if (out instanceof Response) return out as NextResponse;
    return NextResponse.json(out ?? { ok: true });
  } catch (err) {
    return shopErrorResponse(err);
  }
}

export function fileResponse(buffer: Buffer, filename: string, type: string, download = false): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export function pdfResponse(buffer: Buffer, filename: string, request: NextRequest): NextResponse {
  return fileResponse(buffer, filename, 'application/pdf', request.nextUrl.searchParams.get('download') === '1');
}

/** Owner (or ops "Manage Site") access with a JSON body. */
export async function ownerJson<T extends Record<string, unknown>>(request: NextRequest): Promise<{ access: ShopAccess; body: T }> {
  const body = await readJson<T>(request);
  const access = await requireShopAccess(siteIdFrom(request, body), request);
  return { access, body };
}

export async function owner(request: NextRequest): Promise<ShopAccess> {
  return requireShopAccess(siteIdFrom(request), request);
}

/** Tech device or owner, with a JSON body. */
export async function techJson<T extends Record<string, unknown>>(request: NextRequest): Promise<{ access: ShopAccess; body: T }> {
  const body = await readJson<T>(request);
  const access = await requireShopTechOrOwner(siteIdFrom(request, body), request);
  return { access, body };
}

export async function tech(request: NextRequest): Promise<ShopAccess> {
  return requireShopTechOrOwner(siteIdFrom(request), request);
}

export function ownerOnly(access: ShopAccess) {
  if (access.isTech) throw new ShopRuleError('Ask the service desk to do this.', undefined, 403);
}

export async function readForm(request: NextRequest): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new ShopRuleError('The upload didn’t come through. Try again.', undefined, 400);
  }
}

export async function fileFrom(form: FormData, field: string): Promise<{ buffer: Buffer; mime: string; name: string } | null> {
  const f = form.get(field);
  if (!f || typeof f === 'string') return null;
  const file = f as File;
  return { buffer: Buffer.from(await file.arrayBuffer()), mime: file.type || 'application/octet-stream', name: file.name || 'upload' };
}
