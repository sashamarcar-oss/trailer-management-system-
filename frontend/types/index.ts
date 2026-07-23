export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Shape returned by GET /api/core/audit-logs/. */
export interface AuditLog {
  id: number;
  user: number | null;
  user_email: string | null;
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "VIEW";
  model_name: string;
  object_id: string;
  path: string;
  method: string;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type Notification = AuditLog;

export type TrailerStatus =
  | "Available" | "Reserved" | "Rented" | "Under Maintenance" | "Damaged" | "Retired";

export interface Trailer {
  id: string;
  trailerNumber: string;
  registrationNumber: string;
  vin: string;
  type: string;
  brand: string;
  model: string;
  year: number;
  capacity: string;
  status: TrailerStatus;
  location: string;
  nextInspection: string;
  insuranceExpiry: string;
}

export type ClientType = "Individual" | "Company";

export interface Client {
  id: string;
  code: string;
  client_type: ClientType;
  name: string;
  contact_person: string;
  contact_phone: string;
  email: string;
  pin?: string;
  address: string;
  city: string;
  country: string;
  kra_pin?: string;
  national_id?: string;
  passport?: string;
  business_registration?: string;
  credit_limit: number;
  outstanding_balance: number;
  preferred_payment_terms: "Cash" | "Net 7" | "Net 15" | "Net 30" | "Net 60";
  notes?: string;
  rating: number;
  blacklisted: boolean;
}

export interface Expense {
  id: string;
  date: string;
  trailer: string;
  category: string;
  vendor: string;
  amount: number;
  paymentMethod: string;
  status: "Pending" | "Approved" | "Rejected";
  notes?: string;
}

export interface Rental {
  id: string;
  client: string;
  trailer: string;
  rentalType: "Daily" | "Weekly" | "Monthly" | "Long Term";
  pickupDate: string;
  returnDate: string;
  status: "Draft" | "Reserved" | "Active" | "Completed" | "Cancelled" | "Overdue";
}

export interface Quotation {
  id: string;
  client: string;
  issueDate: string;
  expiryDate: string;
  value: number;
  status: "Draft" | "Pending" | "Accepted" | "Rejected" | "Expired";
}

export interface Invoice {
  id: string;
  client: string;
  date: string;
  dueDate: string;
  total: number;
  balance: number;
  status: "Draft" | "Pending" | "Paid" | "Partially Paid" | "Overdue" | "Cancelled";
}
