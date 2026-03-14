-- IMPORTANT: Because of Supabase security rules, you CANNOT create buckets via SQL directly.
-- FIRST: Go to the Supabase Dashboard -> Storage -> Create new bucket
-- Name the bucket exactly "site-assets", and set it to PUBLIC.
-- THEN: Run this SQL script to apply the correct security policies for uploading and deleting images.

-- Enable RLS on the storage.objects table if not already enabled
alter table storage.objects enable row level security;

-- Drop existing policies if any to avoid conflicts when re-running
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Authenticated users can upload site assets" on storage.objects;
drop policy if exists "Users can update their own site assets" on storage.objects;
drop policy if exists "Users can delete their own site assets" on storage.objects;

-- Create policies for the site-assets bucket

-- 1. Allow public read access to all files in the site-assets bucket
create policy "Public Access"
on storage.objects for select
to public
using ( bucket_id = 'site-assets' );

-- 2. Allow authenticated users to upload files to the site-assets bucket
create policy "Authenticated users can upload site assets"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'site-assets' 
    -- The API route already verifies site ownership before uploading, 
    -- but this ensures only logged-in users can interact with storage directly.
);

-- 3. Allow authenticated users to update their own uploads (optional, but good practice)
create policy "Users can update their own site assets"
on storage.objects for update
to authenticated
using ( bucket_id = 'site-assets' and auth.uid() = owner )
with check ( bucket_id = 'site-assets' and auth.uid() = owner );

-- 4. Allow authenticated users to delete their own uploads
create policy "Users can delete their own site assets"
on storage.objects for delete
to authenticated
using ( bucket_id = 'site-assets' and auth.uid() = owner );
