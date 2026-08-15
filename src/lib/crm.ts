export type CustomerStatus = "Prospect" | "Active" | "Suspend" | "Cancel";

export type Customer = {
  id: string;
  /** Public customer identifier that links invoices, quotes and web assets, e.g. "webk-ab3x9k2m". */
  code: string;
  name: string;
  businessName: string;
  email: string;
  /** One or more phone numbers. */
  phones: string[];
  /** Optional domain name owned by the customer. */
  domain: string;
  address: string;
  status: CustomerStatus;
  notes: string;
  createdAt: string;
};

export function generateCustomerCode(): string {
  // Short & unique: webk- + 6 random base36 chars (36^6 ≈ 2.18 billion combos).
  // The DB also has a UNIQUE constraint + the API retries on collision.
  try {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return `webk-${Array.from(bytes, (b) => b % 36).map((n) => n.toString(36)).join("")}`;
  } catch {
    return `webk-${Math.random().toString(36).slice(2, 8).padEnd(6, "0")}`;
  }
}

export function formatPhones(phones: string[]): string {
  return phones.filter(Boolean).join(", ");
}

export type InvoiceItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
};

export type InvoiceStatus = "Draft" | "Active" | "Process" | "Done" | "Cancel";

export type Invoice = {
  id: string;
  number: string;
  customerId: string;
  items: InvoiceItem[];
  discount: number;
  tax: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  notes: string;
};

export type QuoteStatus = "Draft" | "Active" | "Process" | "Done" | "Cancel";

export type Quote = {
  id: string;
  number: string;
  customerId: string;
  items: InvoiceItem[];
  discount: number;
  tax: number;
  status: QuoteStatus;
  issueDate: string;
  validUntil: string;
  notes: string;
};

export type Product = {
  id: string;
  name: string;
  detail: string;
  price: number;
  promo: boolean;
  discount: number;
  tax: number;
  image: string;
  createdAt: string;
};

export type BankAccount = {
  id: string;
  bank: string;
  number: string;
  name: string;
};

export type PaymentSettings = {
  qrisImage: string;
  bankAccounts: BankAccount[];
};

export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type WebAssetType = "domain" | "hosting";

export type WebAsset = {
  id: string;
  type: WebAssetType;
  name: string;
  customerId: string;
  provider: string;
  startDate: string;
  expiryDate: string;
  price: number;
  notes: string;
  createdAt: string;
};

export function productEffectivePrice(product: Pick<Product, "price" | "promo" | "discount">): number {
  if (!product.promo) return product.price;
  return Math.round(product.price * (1 - product.discount / 100));
}

export type Totals = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
};

export function computeTotals(items: InvoiceItem[], discount: number, tax: number): Totals {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discountAmount = (subtotal * discount) / 100;
  const taxAmount = ((subtotal - discountAmount) * tax) / 100;
  const total = subtotal - discountAmount + taxAmount;
  return { subtotal, discountAmount, taxAmount, total };
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRupiahShort(value: number): string {
  if (value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}M`;
  }
  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  }
  if (value >= 1_000) {
    return `Rp ${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })}rb`;
  }
  return formatRupiah(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function nextNumber(prefix: string, existing: string[]): string {
  const year = new Date().getFullYear();
  let max = 0;
  existing.forEach((num) => {
    const match = num.match(new RegExp(`${prefix}-${year}-(\\d+)`));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  return `${prefix}-${year}-${String(max + 1).padStart(3, "0")}`;
}

export const CUSTOMER_STATUSES: CustomerStatus[] = ["Prospect", "Active", "Suspend", "Cancel"];
export const INVOICE_STATUSES: InvoiceStatus[] = ["Draft", "Active", "Process", "Done", "Cancel"];
export const QUOTE_STATUSES: QuoteStatus[] = ["Draft", "Active", "Process", "Done", "Cancel"];
export const WEB_ASSET_TYPES: WebAssetType[] = ["domain", "hosting"];
