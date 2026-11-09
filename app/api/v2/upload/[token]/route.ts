/**
 * Image upload link for one site (token from the create_upload_link MCP tool).
 *
 * GET  → a small drop-zone page the owner opens to send their photos.
 * POST → multipart/form-data with one or more `file` fields, or a raw image
 *        body (e.g. `curl --data-binary @photo.jpg -H "Content-Type: image/jpeg"`).
 *        Returns { images: [{ url, width, height, bytes, name }], errors: [...] }.
 *
 * Files go through the same pipeline as import_media (re-encoded, resized,
 * moderated) and appear in the site's media library, where the agent finds
 * them with list_media.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { importImageBuffer, MAX_IMAGE_BYTES } from '@/lib/v2/media';
import { OpError } from '@/lib/v2/ops';
import { escapeHtml } from '@/lib/v2/sanitize';
import { loadSiteRow } from '@/lib/v2/store';
import { verifyUploadToken, type UploadGrant } from '@/lib/v2/upload-token';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILES = 10;

type Grant = UploadGrant & { siteName: string };

async function resolveGrant(token: string): Promise<Grant | { error: string; status: number }> {
  const grant = await verifyUploadToken(token);
  if (!grant) return { error: 'This upload link is invalid or has expired. Ask your AI assistant for a new one.', status: 401 };
  const site = await loadSiteRow(createAdminClient(), grant.siteId);
  // A transferred or deleted site invalidates links made for the previous owner.
  if (!site || site.deleted_at || site.user_id !== grant.ownerUserId) {
    return { error: 'This upload link is no longer valid for this site.', status: 410 };
  }
  const profile = (site.business_profile || {}) as { name?: unknown };
  const siteName = (typeof profile.name === 'string' && profile.name.trim()) || site.site_slug || 'your site';
  return { ...grant, siteName };
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const grant = await resolveGrant(token);
  const html = 'error' in grant ? errorPage(grant.error) : uploadPage(grant);
  return new NextResponse(html, {
    status: 'error' in grant ? grant.status : 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
    },
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const grant = await resolveGrant(token);
  if ('error' in grant) return NextResponse.json({ error: grant.error }, { status: grant.status });

  const files: Array<{ name: string; data: Buffer }> = [];
  const type = request.headers.get('content-type') || '';
  try {
    if (type.startsWith('multipart/form-data')) {
      const form = await request.formData();
      for (const entry of form.getAll('file')) {
        if (typeof entry === 'string') continue;
        if (files.length >= MAX_FILES) break;
        if (entry.size > MAX_IMAGE_BYTES) {
          return NextResponse.json({ error: `${entry.name || 'A file'} is larger than 12MB` }, { status: 413 });
        }
        files.push({ name: entry.name || 'image', data: Buffer.from(await entry.arrayBuffer()) });
      }
    } else if (type.startsWith('image/') || type === 'application/octet-stream') {
      const data = Buffer.from(await request.arrayBuffer());
      if (data.length > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image is larger than 12MB' }, { status: 413 });
      const name = request.nextUrl.searchParams.get('name') || request.headers.get('x-file-name') || 'image';
      files.push({ name, data });
    } else {
      return NextResponse.json({ error: 'Send multipart/form-data with "file" fields, or a raw image body with an image/* Content-Type' }, { status: 415 });
    }
  } catch {
    return NextResponse.json({ error: 'Could not read the upload' }, { status: 400 });
  }
  if (!files.length) return NextResponse.json({ error: 'No image files were sent (use the "file" form field)' }, { status: 400 });

  const db = createAdminClient();
  const images: Array<{ url: string; width: number | null; height: number | null; bytes: number; name: string }> = [];
  const errors: Array<{ name: string; error: string }> = [];
  for (const file of files) {
    try {
      const result = await importImageBuffer(db, { siteId: grant.siteId, ownerUserId: grant.ownerUserId, data: file.data, name: file.name });
      images.push({ ...result, name: file.name });
    } catch (e) {
      const message = e instanceof OpError ? e.message : 'Upload failed';
      if (!(e instanceof OpError)) console.error('[v2 upload]', e);
      errors.push({ name: file.name, error: message });
    }
  }
  const status = images.length ? 200 : errors.some((e) => e.error === 'Content policy violation') ? 422 : 400;
  return NextResponse.json({ images, errors }, { status });
}

// ── pages ───────────────────────────────────────────────────────────────────

const STYLE = `
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f5f4;color:#1c1917}
main{max-width:560px;margin:0 auto;padding:40px 20px}h1{font-size:22px;margin:0 0 6px}p{margin:0 0 16px;color:#57534e}
.drop{display:block;border:2px dashed #a8a29e;border-radius:14px;background:#fff;padding:36px 20px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s}
.drop.over{border-color:#2563eb;background:#eff6ff}.drop strong{display:block;font-size:17px;color:#1c1917}.drop span{font-size:14px;color:#78716c}
input[type=file]{position:absolute;width:1px;height:1px;opacity:0}
ul{list-style:none;margin:20px 0 0;padding:0;display:grid;gap:10px}
li{display:flex;align-items:center;gap:12px;background:#fff;border-radius:10px;padding:8px;font-size:14px}
li img{width:56px;height:56px;object-fit:cover;border-radius:6px;background:#e7e5e4;flex:none}
li .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ok{color:#15803d}.err{color:#b91c1c}
.done{margin-top:20px;padding:14px 16px;border-radius:10px;background:#ecfdf5;color:#065f46;display:none}
footer{margin-top:28px;font-size:13px;color:#a8a29e}`;

function errorPage(message: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Upload link expired · Keystone</title><style>${STYLE}</style></head>
<body><main><h1>Upload link unavailable</h1><p>${escapeHtml(message)}</p></main></body></html>`;
}

function uploadPage(grant: Grant): string {
  const name = escapeHtml(grant.siteName);
  const expires = grant.expiresAt.toISOString();
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Send photos to ${name} · Keystone</title><style>${STYLE}</style></head>
<body><main>
<h1>Send photos for ${name}</h1>
<p>Add the images you want on your website. They go straight into your site's media library, and your AI assistant can use them right away.</p>
<label class="drop" id="drop"><input type="file" id="file" accept="image/*" multiple>
<strong>Choose photos or drop them here</strong><span>JPEG, PNG, WebP or GIF · up to ${MAX_FILES} at a time</span></label>
<ul id="list"></ul>
<div class="done" id="done">Done! Go back to your AI assistant and tell it your photos are uploaded.</div>
<footer>This link works until <time id="exp" datetime="${expires}">${expires}</time>. Anyone with it can add images to this site, so only share it with people you trust.</footer>
</main>
<script>
(function(){
  var exp=document.getElementById('exp');try{exp.textContent=new Date(exp.getAttribute('datetime')).toLocaleString()}catch(e){}
  var input=document.getElementById('file'),drop=document.getElementById('drop'),list=document.getElementById('list'),done=document.getElementById('done');
  // Request bodies are capped (~4.5MB on our host), so big photos are scaled down here first; the server re-encodes anyway.
  var SEND_AS_IS=3.5*1024*1024,MAX_EDGE=2400;
  function shrink(file){
    var keep=/^image\\/(jpeg|png|webp|gif)$/.test(file.type);
    if(keep&&file.size<=SEND_AS_IS)return Promise.resolve(file);
    return new Promise(function(resolve,reject){
      var url=URL.createObjectURL(file),img=new Image();
      img.onload=function(){
        var s=Math.min(1,MAX_EDGE/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');
        c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
        var alpha=/png|webp|gif/.test(file.type),type=alpha?'image/webp':'image/jpeg';
        (function attempt(q){c.toBlob(function(b){
          if(!b)return reject(new Error('This browser could not read that image'));
          if(b.size>SEND_AS_IS&&q>0.5)return attempt(q-0.15);
          resolve(new File([b],file.name.replace(/\\.[^.]+$/,'')+(alpha?'.webp':'.jpg'),{type:type}));
        },type,q)})(0.88);
      };
      img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('This file could not be read as an image'))};
      img.src=url;
    });
  }
  function row(file){
    var li=document.createElement('li'),im=document.createElement('img'),n=document.createElement('span'),st=document.createElement('span');
    im.alt='';try{im.src=URL.createObjectURL(file)}catch(e){}
    n.className='n';n.textContent=file.name;st.textContent='Uploading…';
    li.appendChild(im);li.appendChild(n);li.appendChild(st);list.appendChild(li);return st;
  }
  function send(file){
    var st=row(file);
    return shrink(file).then(function(f){
      var fd=new FormData();fd.append('file',f,f.name);
      return fetch(location.pathname,{method:'POST',body:fd}).then(function(r){return r.json().catch(function(){return{error:'Upload failed ('+r.status+')'}})});
    }).then(function(j){
      if(j.images&&j.images.length){st.textContent='Uploaded';st.className='ok';return true}
      st.textContent=(j.errors&&j.errors[0]&&j.errors[0].error)||j.error||'Upload failed';st.className='err';return false;
    }).catch(function(e){st.textContent=e.message||'Upload failed';st.className='err';return false});
  }
  function handle(files){
    files=Array.prototype.slice.call(files||[]).filter(function(f){return /^image\\//.test(f.type)||/\\.(heic|heif|avif)$/i.test(f.name)}).slice(0,${MAX_FILES});
    if(!files.length)return;
    var chain=Promise.resolve(),ok=0;
    files.forEach(function(f){chain=chain.then(function(){return send(f).then(function(x){if(x)ok++})})});
    chain.then(function(){if(ok)done.style.display='block'});
  }
  input.addEventListener('change',function(){handle(input.files);input.value=''});
  ['dragenter','dragover'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add('over')})});
  ['dragleave','drop'].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove('over')})});
  drop.addEventListener('drop',function(e){handle(e.dataTransfer&&e.dataTransfer.files)});
})();
</script></body></html>`;
}
