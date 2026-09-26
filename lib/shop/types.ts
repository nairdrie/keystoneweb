/**
 * Shared types for the Shop tab. Client-safe: no server imports.
 * Row shapes mirror migrations/094_shop.sql; money is integer cents.
 */

export type Stage = 'dropped' | 'estimate' | 'waiting' | 'approved' | 'done';
export type LineKind = 'labour' | 'part' | 'supply' | 'fee' | 'discount' | 'sublet';
export type LineDecision = 'include' | 'declined';
export type PartCondition = 'new_oem' | 'new_non_oem' | 'used' | 'reconditioned';
export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'declined' | 'replaced';
export type AuthKind = 'estimate_fee' | 'estimate' | 'max_amount';
export type AuthMethod = 'phone' | 'in_person' | 'online' | 'email' | 'text';
export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'etransfer' | 'cheque' | 'stripe' | 'paypal' | 'other';
export type JobSource = 'walk_in' | 'key_drop' | 'phone' | 'website_form' | 'booking' | 'other';
export type EventKind =
  | 'intake' | 'note' | 'voice' | 'photo' | 'call' | 'move' | 'diagnosis' | 'estimate'
  | 'authorization' | 'parts' | 'invoice' | 'payment' | 'lien' | 'email' | 'system';
export type BillStatus = 'needs_match' | 'matched' | 'stock' | 'returned';
export type LienStatus = 'active' | 'paid' | 'discharged' | 'cancelled';
export type CustomerType = 'consumer' | 'business';

export interface Bay { id: string; label: string }
export interface StaffMember { name: string; role: 'tech' | 'desk' | 'owner' }

export interface ShopSettings {
  site_id: string;
  legal_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  hst_number: string | null;
  tax_label: string;
  tax_rate_bps: number;
  labour_rate_cents: number;
  estimate_fee_cents: number;
  estimate_valid_days: number;
  payment_terms: string;
  payment_methods_note: string;
  etransfer_email: string | null;
  warranty_extra: string | null;
  diagnostic_policy: string | null;
  flat_rate_policy: string | null;
  parts_commission_policy: string;
  other_charges: string | null;
  bays: Bay[];
  staff: StaffMember[];
  intake_dismissed: string[];
  province: string;
  key_tag_max: number;
  tech_code: string | null;
  has_tech_pin: boolean;
}

export interface Customer {
  id: string;
  site_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  customer_type: CustomerType;
  business_reason: string | null;
  preferences: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  site_id: string;
  customer_id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  vin: string | null;
  plate: string | null;
  color: string | null;
  engine: string | null;
  notes: string | null;
  last_odometer: number | null;
  archived_at: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  site_id: string;
  name: string;
  account_number: string | null;
  rep_name: string | null;
  phone: string | null;
  email: string | null;
  terms: string | null;
  archived_at: string | null;
}

export interface Alternate {
  description: string;
  supplier_id?: string | null;
  part_number?: string | null;
  condition?: PartCondition | null;
  unit_price_cents?: number | null;
  unit_cost_cents?: number | null;
  note?: string | null;
}

export interface EstimateLine {
  id: string;
  estimate_id: string;
  position: number;
  kind: LineKind;
  description: string;
  decision: LineDecision;
  qty: number;
  hours: number | null;
  rate_cents: number | null;
  unit_price_cents: number | null;
  amount_cents: number | null;
  unit_cost_cents: number | null;
  supplier_id: string | null;
  part_number: string | null;
  brand: string | null;
  condition: PartCondition | null;
  quoted_at: string | null;
  quoted_by: string | null;
  eta: string | null;
  core_charge_cents: number | null;
  no_warranty: boolean;
  is_added_work: boolean;
  alternates: Alternate[];
  ordered_at: string | null;
}

/** A line as edited in the UI before it has an id. */
export type EstimateLineInput = Omit<EstimateLine, 'id' | 'estimate_id' | 'position'> & { id?: string };

export interface Estimate {
  id: string;
  job_id: string;
  version: number;
  status: EstimateStatus;
  is_revision: boolean;
  needs_review: boolean;
  sent_at: string | null;
  sent_via: string | null;
  valid_until: string | null;
  ready_by: string | null;
  public_token: string | null;
  approved_at: string | null;
  declined_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines: EstimateLine[];
}

export interface Authorization {
  id: string;
  job_id: string;
  estimate_id: string | null;
  kind: AuthKind;
  method: AuthMethod;
  authorized_by: string;
  phone: string | null;
  contact: string | null;
  authorized_at: string;
  taken_by: string | null;
  amount_cents: number | null;
  line_ids: string[];
  parts_back: boolean | null;
  signature_path: string | null;
  typed_name: string | null;
  ip_address: string | null;
  notes: string | null;
  created_at: string;
}

export interface JobEvent {
  id: string;
  job_id: string;
  kind: EventKind;
  actor: string | null;
  body: string | null;
  quote: string | null;
  file_path: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface BillLine {
  id: string;
  bill_id: string;
  position: number;
  description: string;
  part_number: string | null;
  qty: number;
  unit_cost_cents: number;
  line_total_cents: number;
  is_core: boolean;
  core_returned_at: string | null;
  job_id: string | null;
}

export interface SupplierBill {
  id: string;
  site_id: string;
  supplier_id: string | null;
  supplier_name_raw: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  subtotal_cents: number | null;
  tax_cents: number | null;
  total_cents: number | null;
  file_path: string | null;
  file_mime: string | null;
  handwritten_note: string | null;
  status: BillStatus;
  suggested_job_id: string | null;
  suggestion_reason: string | null;
  ai_error: string | null;
  paid_at: string | null;
  created_by: string | null;
  created_at: string;
  lines: BillLine[];
}

export interface InvoiceLine {
  estimate_line_id: string | null;
  kind: LineKind;
  description: string;
  qty: number;
  hours: number | null;
  rate_cents: number | null;
  unit_price_cents: number | null;
  amount_cents: number;
  condition: PartCondition | null;
  part_number: string | null;
  no_warranty: boolean;
  is_added_work: boolean;
}

/** Everything printed on an invoice, frozen when it is issued. */
export interface InvoiceSnapshot {
  number_label: string;
  issued_on: string;
  kind: 'repair' | 'estimate_fee';
  shop: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    hst_number: string | null;
  };
  customer: { name: string; phone: string | null; email: string | null; address: string | null; customer_type: CustomerType };
  vehicle: {
    description: string;
    vin: string | null;
    plate: string | null;
    odometer_in: number | null;
    odometer_out: number | null;
  };
  ro_number: number;
  work_requested: string;
  dates: { authorized: string | null; completed: string | null; returned: string | null };
  lines: InvoiceLine[];
  declined: { description: string; amount_cents: number }[];
  totals: { labour_cents: number; parts_cents: number; supplies_cents: number; subtotal_cents: number; tax_cents: number; total_cents: number; tax_label: string; tax_rate_bps: number };
  estimate: { label: string; total_cents: number } | null;
  authorization: { method: AuthMethod; by: string; phone: string | null; when: string; taken_by: string | null } | null;
  estimate_fee_note: string | null;
  parts_returned: boolean | null;
  payment_terms: string;
  payment_methods: string;
  warranty_text: string;
  warranty_extra: string | null;
  statutory_statement: string;
}

export interface Invoice {
  id: string;
  job_id: string;
  invoice_number: number;
  status: 'issued' | 'void';
  issued_at: string;
  estimate_id: string | null;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  snapshot: InvoiceSnapshot;
  public_token: string | null;
  voided_at: string | null;
  void_reason: string | null;
}

export interface Payment {
  id: string;
  invoice_id: string;
  job_id: string;
  lien_id: string | null;
  amount_cents: number;
  method: PaymentMethod;
  reference: string | null;
  provider_ref: string | null;
  received_at: string;
  recorded_by: string | null;
  notes: string | null;
}

export interface ScheduleItem { due: string; amount_cents: number }

export interface Lien {
  id: string;
  job_id: string;
  invoice_id: string;
  status: LienStatus;
  released_at: string;
  amount_owing_cents: number;
  down_payment_cents: number;
  plan_kind: 'single' | 'instalments';
  frequency: 'weekly' | 'biweekly' | 'monthly' | null;
  instalment_cents: number | null;
  schedule: ScheduleItem[];
  ack_signer_name: string;
  ack_signer_capacity: 'owner' | 'authorized_agent';
  ack_signature_path: string | null;
  ack_signed_at: string;
  credit_disclosure_given: boolean;
  debtor_legal_name: string | null;
  debtor_dob: string | null;
  debtor_address: string | null;
  ppsr_registration_number: string | null;
  ppsr_registered_at: string | null;
  ppsr_years: number | null;
  ppsr_expires_on: string | null;
  paid_off_at: string | null;
  discharge_due_on: string | null;
  discharge_registered_at: string | null;
  discharge_reference: string | null;
  notes: string | null;
}

export interface Job {
  id: string;
  site_id: string;
  ro_number: number;
  customer_id: string;
  vehicle_id: string;
  key_tag: string | null;
  stage: Stage;
  bay: string | null;
  sort_order: number;
  assigned_tech: string | null;
  complaint: string;
  diagnosis: string | null;
  source: JobSource;
  source_ref: string | null;
  odometer_in: number | null;
  odometer_out: number | null;
  estimate_fee_cents: number;
  estimate_fee_note: string | null;
  estimate_fee_agreed_at: string | null;
  next_step: string | null;
  promised_date: string | null;
  invoice_adjustments: Record<string, LineAdjustment>;
  owner_is_customer: boolean;
  registered_owner_name: string | null;
  diagnosed_at: string | null;
  completed_at: string | null;
  returned_at: string | null;
  holding_since: string | null;
  status: 'open' | 'closed';
  closed_reason: 'paid' | 'released_on_plan' | 'no_charge' | 'cancelled' | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LineAdjustment {
  hours?: number;
  qty?: number;
  unit_price_cents?: number;
  amount_cents?: number;
}

/** Board card data, built server-side from a job and its related rows. */
export interface JobSummary {
  id: string;
  ro_number: number;
  key_tag: string | null;
  stage: Stage;
  bay: string | null;
  sort_order: number;
  assigned_tech: string | null;
  complaint: string;
  source: JobSource;
  next_step: string | null;
  holding_since: string | null;
  created_at: string;
  updated_at: string;
  status: 'open' | 'closed';
  customer: Pick<Customer, 'id' | 'name' | 'phone' | 'email' | 'preferences' | 'customer_type'>;
  vehicle: Pick<Vehicle, 'id' | 'year' | 'make' | 'model' | 'trim' | 'plate' | 'color' | 'vin'>;
  estimate: {
    id: string;
    version: number;
    status: EstimateStatus;
    is_revision: boolean;
    total_cents: number;
    needs_price: number;
    sent_at: string | null;
  } | null;
  approved: { id: string; version: number; total_cents: number } | null;
  pending_revision: { id: string; version: number; added_cents: number; added_lines: number } | null;
  parts: { expected: number; received: number; next_eta: string | null };
  invoice: { id: string; number: number; total_cents: number; paid_cents: number; balance_cents: number; issued_at: string } | null;
  voice_ready: boolean;
  last_voice_at: string | null;
}

export interface IntakeItem {
  ref: string;
  kind: 'website_form' | 'booking';
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  when: string;
  detail: string | null;
}

export interface LienSummary extends Lien {
  customer_name: string;
  vehicle_label: string;
  vin: string | null;
  invoice_label: string;
  balance_cents: number;
  next_due: ScheduleItem | null;
  overdue: boolean;
}

export interface Workspace {
  settings: ShopSettings;
  jobs: JobSummary[];
  suppliers: Supplier[];
  pile_count: number;
  liens: LienSummary[];
  intake: IntakeItem[];
  site: { name: string; base_url: string | null; stripe: boolean; paypal: boolean };
}

export interface PartReceived extends BillLine {
  bill_invoice_number: string | null;
  bill_invoice_date: string | null;
  supplier_name: string | null;
  bill_file_path: string | null;
}

export interface ExpectedPart {
  line_id: string;
  description: string;
  part_number: string | null;
  supplier_id: string | null;
  eta: string | null;
  received: boolean;
  from_stock: boolean;
}

export interface JobDetail {
  job: Job;
  customer: Customer;
  vehicle: Vehicle;
  estimates: Estimate[];
  authorizations: Authorization[];
  events: JobEvent[];
  parts_received: PartReceived[];
  parts_expected: ExpectedPart[];
  invoice: Invoice | null;
  void_invoices: Invoice[];
  payments: Payment[];
  lien: Lien | null;
  suppliers: Supplier[];
  settings: ShopSettings;
  site: { name: string; base_url: string | null; stripe: boolean; paypal: boolean };
  other_jobs: { id: string; ro_number: number; created_at: string; status: string }[];
}
