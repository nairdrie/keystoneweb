-- Add options_required flag to booking_services
-- When true (default): customer must select an option if options are configured
-- When false: options are optional (customer can skip / proceed with base service)

ALTER TABLE booking_services
    ADD COLUMN IF NOT EXISTS options_required boolean NOT NULL DEFAULT true;
