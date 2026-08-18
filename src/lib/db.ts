import { neon } from "@neondatabase/serverless";
import type { BankAccount, Contact, Customer, CustomerStatus, Invoice, InvoiceItem, InvoiceStatus, Note, PaymentSettings, Product, Quote, QuoteStatus, WebAsset, WebAssetType } from "./crm";

let _sql: ReturnType<typeof neon> | null = null;

export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
  }
  return _sql;
}

export async function query<T>(sqlText: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  const result = await getSql()(sqlText, ...values);
  return result as unknown as T[];
}

export interface CustomerRow {
  id: string;
  code: string | null;
  name: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  phones: unknown[] | null;
  domain: string | null;
  address: string | null;
  status: string;
  notes: string | null;
  created_at: Date | string;
}

export interface InvoiceRow {
  id: string;
  number: string;
  customer_id: string;
  items: InvoiceItem[] | null;
  discount: number | null;
  tax: number | null;
  status: string;
  issue_date: string;
  due_date: string;
  notes: string | null;
  created_at: Date | string;
}

export interface QuoteRow {
  id: string;
  number: string;
  customer_id: string;
  items: InvoiceItem[] | null;
  discount: number | null;
  tax: number | null;
  status: string;
  issue_date: string;
  valid_until: string;
  notes: string | null;
  created_at: Date | string;
}

export interface ProductRow {
  id: string;
  name: string;
  detail: string | null;
  price: number | null;
  promo: boolean | null;
  discount: number | null;
  tax: number | null;
  image: string | null;
  created_at: Date | string;
}

export interface PaymentSettingsRow {
  id: string;
  qris_image: string | null;
  bank_accounts: unknown[] | null;
}

export interface NoteRow {
  id: string;
  title: string;
  content: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface WebAssetRow {
  id: string;
  type: string;
  name: string;
  customer_id: string;
  provider: string | null;
  start_date: string | null;
  expiry_date: string | null;
  price: number | null;
  notes: string | null;
  created_at: Date | string;
}

export interface ContactRow {
  id: string;
  name: string;
  phone: string;
  note: string | null;
  has_web: boolean | null;
  csv_url: string | null;
  created_at: Date | string;
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function rowToCustomer(row: CustomerRow): Customer {
  const phones = Array.isArray(row.phones)
    ? row.phones.filter((p): p is string => typeof p === "string")
    : row.phone
      ? [row.phone]
      : [];
  return {
    id: row.id,
    code: row.code ?? "",
    name: row.name,
    businessName: row.business_name ?? "",
    email: row.email ?? "",
    phones,
    domain: row.domain ?? "",
    address: row.address ?? "",
    status: row.status as CustomerStatus,
    notes: row.notes ?? "",
    createdAt: toIso(row.created_at),
  };
}

export function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    number: row.number,
    customerId: row.customer_id,
    items: row.items ?? [],
    discount: Number(row.discount ?? 0),
    tax: Number(row.tax ?? 11),
    status: row.status as InvoiceStatus,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    notes: row.notes ?? "",
  };
}

export function rowToQuote(row: QuoteRow): Quote {
  return {
    id: row.id,
    number: row.number,
    customerId: row.customer_id,
    items: row.items ?? [],
    discount: Number(row.discount ?? 0),
    tax: Number(row.tax ?? 11),
    status: row.status as QuoteStatus,
    issueDate: row.issue_date,
    validUntil: row.valid_until,
    notes: row.notes ?? "",
  };
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    detail: row.detail ?? "",
    price: Number(row.price ?? 0),
    promo: !!row.promo,
    discount: Number(row.discount ?? 0),
    tax: Number(row.tax ?? 11),
    image: row.image ?? "",
    createdAt: toIso(row.created_at),
  };
}

export function rowToPaymentSettings(row: PaymentSettingsRow): PaymentSettings {
  const bankAccounts = Array.isArray(row.bank_accounts)
    ? (row.bank_accounts as Partial<BankAccount>[]).filter(
        (b): b is BankAccount => typeof b === "object" && b !== null && typeof b.id === "string",
      )
    : [];
  return {
    qrisImage: row.qris_image ?? "",
    bankAccounts,
  };
}

export function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function rowToWebAsset(row: WebAssetRow): WebAsset {
  return {
    id: row.id,
    type: row.type as WebAssetType,
    name: row.name,
    customerId: row.customer_id,
    provider: row.provider ?? "",
    startDate: row.start_date ?? "",
    expiryDate: row.expiry_date ?? "",
    price: Number(row.price ?? 0),
    notes: row.notes ?? "",
    createdAt: toIso(row.created_at),
  };
}

export function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    note: row.note ?? "",
    hasWeb: !!row.has_web,
    csvUrl: row.csv_url ?? "",
    createdAt: toIso(row.created_at),
  };
}