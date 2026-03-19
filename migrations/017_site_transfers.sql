-- Site transfers: allows a site owner to generate a transfer link
-- that another user can accept to take ownership of the site.

CREATE TABLE public.site_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL,
  from_user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled')),
  accepted_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '7 days'),
  accepted_at timestamp with time zone,
  CONSTRAINT site_transfers_pkey PRIMARY KEY (id),
  CONSTRAINT site_transfers_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id),
  CONSTRAINT site_transfers_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id),
  CONSTRAINT site_transfers_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES public.users(id)
);
