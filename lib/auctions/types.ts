export type AuctionStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';
export type LotStatus = 'pending' | 'live' | 'sold' | 'passed' | 'skipped';
export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'banned';
export type BidStatus = 'accepted' | 'retracted';
export type ChargeStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface Auction {
  id: string;
  siteId: string;
  slug: string;
  title: string;
  description: string | null;
  scheduledStart: string;
  status: AuctionStatus;
  currentLotId: string | null;
  softCloseSeconds: number;
  initialLotSeconds: number;
  autoApproveRegistrations: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuctionLot {
  id: string;
  auctionId: string;
  lotNumber: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startingBidCents: number;
  bidIncrementCents: number;
  status: LotStatus;
  currentBidCents: number | null;
  currentWinnerRegistrationId: string | null;
  endsAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  soldPriceCents: number | null;
  winnerRegistrationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuctionRegistration {
  id: string;
  auctionId: string;
  memberId: string;
  siteId: string;
  status: RegistrationStatus;
  aliasColor: string;
  aliasAnimal: string;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface AuctionBid {
  id: string;
  auctionId: string;
  lotId: string;
  registrationId: string;
  amountCents: number;
  status: BidStatus;
  retractedAt: string | null;
  retractedReason: string | null;
  createdAt: string;
}

// Snake-case DB row mappers ---------------------------------------------------

type Row = Record<string, unknown>;

export function mapAuction(r: Row): Auction {
  return {
    id: r.id as string,
    siteId: r.site_id as string,
    slug: r.slug as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    scheduledStart: r.scheduled_start as string,
    status: r.status as AuctionStatus,
    currentLotId: (r.current_lot_id as string) ?? null,
    softCloseSeconds: r.soft_close_seconds as number,
    initialLotSeconds: r.initial_lot_seconds as number,
    autoApproveRegistrations: r.auto_approve_registrations as boolean,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapLot(r: Row): AuctionLot {
  return {
    id: r.id as string,
    auctionId: r.auction_id as string,
    lotNumber: r.lot_number as number,
    title: r.title as string,
    description: (r.description as string) ?? null,
    imageUrl: (r.image_url as string) ?? null,
    startingBidCents: r.starting_bid_cents as number,
    bidIncrementCents: r.bid_increment_cents as number,
    status: r.status as LotStatus,
    currentBidCents: (r.current_bid_cents as number) ?? null,
    currentWinnerRegistrationId: (r.current_winner_registration_id as string) ?? null,
    endsAt: (r.ends_at as string) ?? null,
    startedAt: (r.started_at as string) ?? null,
    endedAt: (r.ended_at as string) ?? null,
    soldPriceCents: (r.sold_price_cents as number) ?? null,
    winnerRegistrationId: (r.winner_registration_id as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapRegistration(r: Row): AuctionRegistration {
  return {
    id: r.id as string,
    auctionId: r.auction_id as string,
    memberId: r.member_id as string,
    siteId: r.site_id as string,
    status: r.status as RegistrationStatus,
    aliasColor: r.alias_color as string,
    aliasAnimal: r.alias_animal as string,
    stripeCustomerId: r.stripe_customer_id as string,
    stripePaymentMethodId: r.stripe_payment_method_id as string,
    approvedAt: (r.approved_at as string) ?? null,
    createdAt: r.created_at as string,
  };
}

export function mapBid(r: Row): AuctionBid {
  return {
    id: r.id as string,
    auctionId: r.auction_id as string,
    lotId: r.lot_id as string,
    registrationId: r.registration_id as string,
    amountCents: r.amount_cents as number,
    status: r.status as BidStatus,
    retractedAt: (r.retracted_at as string) ?? null,
    retractedReason: (r.retracted_reason as string) ?? null,
    createdAt: r.created_at as string,
  };
}

export const STATUS_LABELS: Record<AuctionStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live',
  ended: 'Ended',
  cancelled: 'Cancelled',
};

export const STATUS_COLORS: Record<AuctionStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  live: 'bg-emerald-100 text-emerald-700',
  ended: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-700',
};
