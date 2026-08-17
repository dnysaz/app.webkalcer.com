import { getSql, query } from "./db";

const today = new Date();
const iso = (offsetDays: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

/** Cust ID format: webk-<4 digit date (MMDD) of created_at>. */
const codeFromDate = (createdAt: string) => {
  const d = new Date(createdAt);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `webk-${mm}${dd}`;
};

const yearOf = (dateStr: string) => String(new Date(dateStr).getFullYear());

async function runSetupDatabase() {
  const sql = getSql();

  await sql`CREATE TABLE IF NOT EXISTS customers (
    id text PRIMARY KEY,
    code text DEFAULT '',
    name text NOT NULL,
    business_name text DEFAULT '',
    email text DEFAULT '',
    phone text DEFAULT '',
    address text DEFAULT '',
    status text NOT NULL DEFAULT 'Prospect',
    notes text DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS code text DEFAULT ''`;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS phones jsonb NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS domain text DEFAULT ''`;
  await sql`UPDATE customers SET code = 'webk-' || id WHERE code IS NULL OR code = ''`;
  // Deduplicate any existing codes (use unique id as suffix) before enforcing uniqueness
  await sql`UPDATE customers SET code = 'webk-' || id WHERE code IN (SELECT code FROM customers GROUP BY code HAVING count(*) > 1)`;
  // Enforce uniqueness so two customers can never share the same Cust ID
  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_code_key') THEN
      ALTER TABLE customers ADD CONSTRAINT customers_code_key UNIQUE (code);
    END IF;
  END $$;`;
  await sql`UPDATE customers SET phones = jsonb_build_array(phone)
    WHERE (phones IS NULL OR jsonb_array_length(phones) = 0) AND phone IS NOT NULL AND phone != ''`;
  await sql`CREATE TABLE IF NOT EXISTS invoices (
    id text PRIMARY KEY,
    number text NOT NULL UNIQUE,
    customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    discount integer NOT NULL DEFAULT 0,
    tax integer NOT NULL DEFAULT 11,
    status text NOT NULL DEFAULT 'Draft',
    issue_date text NOT NULL,
    due_date text NOT NULL,
    notes text DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS quotes (
    id text PRIMARY KEY,
    number text NOT NULL UNIQUE,
    customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    discount integer NOT NULL DEFAULT 0,
    tax integer NOT NULL DEFAULT 11,
    status text NOT NULL DEFAULT 'Draft',
    issue_date text NOT NULL,
    valid_until text NOT NULL,
    notes text DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS products (
    id text PRIMARY KEY,
    name text NOT NULL,
    detail text DEFAULT '',
    price integer NOT NULL DEFAULT 0,
    promo boolean NOT NULL DEFAULT false,
    discount integer NOT NULL DEFAULT 0,
    tax integer NOT NULL DEFAULT 11,
    image text DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS notes (
    id text PRIMARY KEY,
    title text NOT NULL DEFAULT '',
    content text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS web_assets (
    id text PRIMARY KEY,
    type text NOT NULL DEFAULT 'domain',
    name text NOT NULL,
    customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    provider text DEFAULT '',
    start_date text DEFAULT '',
    expiry_date text DEFAULT '',
    price integer NOT NULL DEFAULT 0,
    notes text DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    name text NOT NULL DEFAULT '',
    role text NOT NULL DEFAULT 'admin',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT ''`;

  await sql`CREATE TABLE IF NOT EXISTS payment_settings (
    id text PRIMARY KEY,
    qris_image text DEFAULT '',
    bank_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`INSERT INTO payment_settings (id) VALUES ('site') ON CONFLICT (id) DO NOTHING`;

  await sql`CREATE TABLE IF NOT EXISTS shares (
    token text PRIMARY KEY,
    doc_type text NOT NULL,
    doc_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS settings (
    id text PRIMARY KEY,
    site_name text NOT NULL DEFAULT 'webkalcerCRM',
    theme text NOT NULL DEFAULT 'emerald',
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS seeded boolean NOT NULL DEFAULT false`;
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS font_size text NOT NULL DEFAULT 'md'`;
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS gemini_api_key text NOT NULL DEFAULT ''`;
  await sql`INSERT INTO settings (id) VALUES ('site') ON CONFLICT (id) DO NOTHING`;

  await sql`UPDATE invoices SET status = CASE status
    WHEN 'Paid' THEN 'Done'
    WHEN 'Sent' THEN 'Active'
    WHEN 'Overdue' THEN 'Process'
    ELSE status END`;
  await sql`UPDATE quotes SET status = CASE status
    WHEN 'Accepted' THEN 'Done'
    WHEN 'Sent' THEN 'Active'
    WHEN 'Rejected' THEN 'Cancel'
    ELSE status END`;

  const customers = [
    {
      id: "c1",
      code: codeFromDate(iso(-120)),
      name: "Raka Pratama",
      businessName: "Bukalapak Retail",
      email: "raka.pratama@bukalapak.com",
      phones: ["0812-3456-1001", "0812-3456-1002"],
      domain: "bukalapak-retail.id",
      address: "Jl. Tebet Barat Dalam VI No. 12, Jakarta Selatan",
      status: "Active",
      notes: "Primary contact: Raka. Enterprise client, monthly billing via bank transfer.",
      createdAt: iso(-120),
    },
    {
      id: "c2",
      code: codeFromDate(iso(-95)),
      name: "Nadia Suryani",
      businessName: "J&T Express Cab. Depok",
      email: "nadia.suryani@jntexpress.co.id",
      phones: ["0813-9876-2002", "0813-9876-2044"],
      domain: "jntdepok.store",
      address: "Jl. Margonda Raya No. 88, Depok, Jawa Barat",
      status: "Active",
      notes: "Prefers WhatsApp communication. Requests daily installment invoices.",
      createdAt: iso(-95),
    },
    {
      id: "c3",
      code: codeFromDate(iso(-30)),
      name: "Aditya Wibowo",
      businessName: "Traveloka Mitra",
      email: "aditya.wibowo@traveloka.com",
      phones: ["0857-1111-3003"],
      domain: "travelokamitra.my.id",
      address: "Jl. TB Simatupang Kav. 38, Jakarta Selatan",
      status: "Prospect",
      notes: "Still negotiating CPM pricing. Needs a quote after the demo.",
      createdAt: iso(-30),
    },
    {
      id: "c4",
      code: codeFromDate(iso(-200)),
      name: "Sarah Lim",
      businessName: "Mekari Sign",
      email: "sarah.lim@mekari.com",
      phones: ["0821-2222-4004", "0821-2222-4099"],
      domain: "mekarisign.id",
      address: "JW Tower, Lt. 23, Jl. Sudirman Kav. 29, Jakarta",
      status: "Active",
      notes: "Yearly contract. Requests a separate tax invoice for compliance purposes.",
      createdAt: iso(-200),
    },
    {
      id: "c5",
      code: codeFromDate(iso(-300)),
      name: "Bagus Santoso",
      businessName: "Xendit ID",
      email: "bagus.santoso@xendit.co",
      phones: ["0856-4444-5005"],
      domain: "",
      address: "Jl. H.R. Rasuna Said X5 No. 12, Jakarta Selatan",
      status: "Suspend",
      notes: "Project finished, waiting for contract renewal next quarter.",
      createdAt: iso(-300),
    },
  ];

  const invoices = [
    {
      id: "i1",
      number: `INV-${codeFromDate(iso(-120))}-${yearOf(iso(-25))}-001`,
      customerId: "c1",
      items: [
        { id: "i1a", name: "Basic Platform Package", qty: 1, price: 1500000 },
        { id: "i1b", name: "Monthly Maintenance Service", qty: 1, price: 400000 },
      ],
      discount: 0,
      tax: 11,
      status: "Done",
      issueDate: iso(-25),
      dueDate: iso(5),
      notes: "March monthly invoice. Paid on time via transfer.",
    },
    {
      id: "i2",
      number: `INV-${codeFromDate(iso(-95))}-${yearOf(iso(-7))}-001`,
      customerId: "c2",
      items: [
        { id: "i2a", name: "POS App Development", qty: 2, price: 4500000 },
        { id: "i2b", name: "Installation & Configuration", qty: 1, price: 750000 },
      ],
      discount: 5,
      tax: 11,
      status: "Active",
      issueDate: iso(-7),
      dueDate: iso(23),
      notes: "Second project installment. Attach handover report upon payment.",
    },
    {
      id: "i3",
      number: `INV-${codeFromDate(iso(-200))}-${yearOf(iso(-40))}-001`,
      customerId: "c4",
      items: [
        { id: "i3a", name: "Annual License", qty: 12, price: 350000 },
        { id: "i3b", name: "Priority Support", qty: 1, price: 1200000 },
      ],
      discount: 10,
      tax: 11,
      status: "Process",
      issueDate: iso(-40),
      dueDate: iso(-10),
      notes: "Follow-up on payment this week, already contacted via email.",
    },
    {
      id: "i4",
      number: `INV-${codeFromDate(iso(-120))}-${yearOf(iso(0))}-002`,
      customerId: "c1",
      items: [{ id: "i4a", name: "Team Training Session (4 people)", qty: 1, price: 2000000 }],
      discount: 0,
      tax: 11,
      status: "Draft",
      issueDate: iso(0),
      dueDate: iso(30),
      notes: "Not sent yet, waiting for participant count confirmation.",
    },
    {
      id: "i5",
      number: `INV-${codeFromDate(iso(-30))}-${yearOf(iso(-15))}-001`,
      customerId: "c3",
      items: [
        { id: "i5a", name: "Partner Dashboard Subscription", qty: 3, price: 1750000 },
        { id: "i5b", name: "Onboarding & Training", qty: 1, price: 2500000 },
      ],
      discount: 5,
      tax: 11,
      status: "Done",
      issueDate: iso(-15),
      dueDate: iso(15),
      notes: "Paid in full via virtual account.",
    },
  ];

  const quotes = [
    {
      id: "q1",
      number: `OFF-${codeFromDate(iso(-30))}-${yearOf(iso(-6))}-001`,
      customerId: "c3",
      items: [
        { id: "q1a", name: "Partner Dashboard Subscription", qty: 3, price: 1750000 },
        { id: "q1b", name: "Onboarding & Training", qty: 1, price: 2500000 },
      ],
      discount: 5,
      tax: 11,
      status: "Active",
      issueDate: iso(-6),
      validUntil: iso(24),
      notes: "Initial campaign quote. Special price for a 3-month pilot.",
    },
    {
      id: "q2",
      number: `OFF-${codeFromDate(iso(-300))}-${yearOf(iso(-1))}-001`,
      customerId: "c5",
      items: [{ id: "q2a", name: "SME Starter Package", qty: 1, price: 950000 }],
      discount: 10,
      tax: 11,
      status: "Draft",
      issueDate: iso(-1),
      validUntil: iso(14),
      notes: "Standard SME quote, 3x installments allowed.",
    },
    {
      id: "q3",
      number: `OFF-${codeFromDate(iso(-300))}-${yearOf(iso(-30))}-002`,
      customerId: "c5",
      items: [{ id: "q3a", name: "Suite License Renewal", qty: 1, price: 3200000 }],
      discount: 0,
      tax: 11,
      status: "Cancel",
      issueDate: iso(-30),
      validUntil: iso(-15),
      notes: "Client rejected due to different budget priorities. Try again in Q3.",
    },
    {
      id: "q4",
      number: `OFF-${codeFromDate(iso(-95))}-${yearOf(iso(-20))}-001`,
      customerId: "c2",
      items: [
        { id: "q4a", name: "Fleet Tracking Platform", qty: 2, price: 2600000 },
        { id: "q4b", name: "Warehouse Integration", qty: 1, price: 1800000 },
      ],
      discount: 0,
      tax: 11,
      status: "Done",
      issueDate: iso(-20),
      validUntil: iso(10),
      notes: "Accepted after negotiation. Moving to invoice.",
    },
    {
      id: "q5",
      number: `OFF-${codeFromDate(iso(-120))}-${yearOf(iso(-2))}-001`,
      customerId: "c1",
      items: [{ id: "q5a", name: "Retail Analytics Add-on", qty: 5, price: 900000 }],
      discount: 8,
      tax: 11,
      status: "Draft",
      issueDate: iso(-2),
      validUntil: iso(28),
      notes: "Draft proposal, awaiting product team feedback.",
    },
  ];

  const products = [
    {
      id: "p1",
      name: "Point of Sale Pro",
      detail: "Complete POS system for retail stores. Includes inventory tracking, cashier reports, and offline mode.",
      price: 4500000,
      promo: true,
      discount: 15,
      tax: 11,
      image: "",
      createdAt: iso(-40),
    },
    {
      id: "p2",
      name: "Inventory Manager",
      detail: "Centralized stock management with barcode scanning, low-stock alerts, and multi-warehouse sync.",
      price: 2900000,
      promo: false,
      discount: 0,
      tax: 11,
      image: "",
      createdAt: iso(-25),
    },
    {
      id: "p3",
      name: "Online Order Platform",
      detail: "Web storefront with payment gateway integration and automated order routing.",
      price: 6000000,
      promo: true,
      discount: 10,
      tax: 11,
      image: "",
      createdAt: iso(-12),
    },
    {
      id: "p4",
      name: "Store Analytics Suite",
      detail: "Real-time dashboards for sales trends, customer segments, and staff performance.",
      price: 1800000,
      promo: false,
      discount: 0,
      tax: 11,
      image: "",
      createdAt: iso(-6),
    },
    {
      id: "p5",
      name: "Loyalty & Promo Engine",
      detail: "Points, vouchers, and targeted promotions to boost repeat purchases.",
      price: 2400000,
      promo: true,
      discount: 20,
      tax: 11,
      image: "",
      createdAt: iso(-3),
    },
  ];

  const webAssets = [
    {
      id: "d1",
      type: "domain",
      name: "bukalapak-retail.id",
      customerId: "c1",
      provider: "Niagahoster",
      startDate: iso(-320),
      expiryDate: iso(45),
      price: 285000,
      notes: "Main company domain, renewed annually.",
    },
    {
      id: "h1",
      type: "hosting",
      name: "Starter Web Hosting",
      customerId: "c1",
      provider: "Niagahoster",
      startDate: iso(-320),
      expiryDate: iso(45),
      price: 240000,
      notes: "3GB storage, 3 databases, free SSL. Renews with the domain.",
    },
    {
      id: "d2",
      type: "domain",
      name: "jntdepok.store",
      customerId: "c2",
      provider: "Domainesia",
      startDate: iso(-150),
      expiryDate: iso(215),
      price: 165000,
      notes: "Domain for the e-commerce storefront.",
    },
    {
      id: "h2",
      type: "hosting",
      name: "Cloud Hosting 2GB",
      customerId: "c2",
      provider: "Domainesia",
      startDate: iso(-150),
      expiryDate: iso(215),
      price: 650000,
      notes: "2GB RAM, SSD storage, daily backup.",
    },
    {
      id: "d3",
      type: "domain",
      name: "travelokamitra.my.id",
      customerId: "c3",
      provider: "Niagahoster",
      startDate: iso(-30),
      expiryDate: iso(335),
      price: 35000,
      notes: "Promo .my.id domain for the partner dashboard pilot.",
    },
  ];

  const counts = await query<{ customers: number; invoices: number; quotes: number; products: number; webAssets: number }>`
    SELECT
      (SELECT count(*)::int FROM customers) AS customers,
      (SELECT count(*)::int FROM invoices) AS invoices,
      (SELECT count(*)::int FROM quotes) AS quotes,
      (SELECT count(*)::int FROM products) AS products,
      (SELECT count(*)::int FROM web_assets) AS webAssets`;
  const c = counts[0];

  // Seed only once ever: if the app was already seeded (settings.seeded = true),
  // never re-insert dummy data even when tables are emptied by the user.
  const seedRow = await query<{ seeded: boolean }>`SELECT seeded FROM settings WHERE id = 'site'`;
  const seeded = !!seedRow[0]?.seeded;

  if (!seeded && c.customers === 0) {
    for (const row of customers) {
      await sql`
        INSERT INTO customers (id, code, name, business_name, email, phones, domain, address, status, notes, created_at)
        VALUES (${row.id}, ${row.code}, ${row.name}, ${row.businessName}, ${row.email}, ${JSON.stringify(row.phones)}::jsonb, ${row.domain}, ${row.address}, ${row.status}, ${row.notes}, ${row.createdAt})`;
    }
  }

  if (!seeded && c.invoices === 0) {
    for (const row of invoices) {
      await sql`
        INSERT INTO invoices (id, number, customer_id, items, discount, tax, status, issue_date, due_date, notes)
        VALUES (${row.id}, ${row.number}, ${row.customerId}, ${JSON.stringify(row.items)}::jsonb, ${row.discount}, ${row.tax}, ${row.status}, ${row.issueDate}, ${row.dueDate}, ${row.notes})`;
    }
  }

  if (!seeded && c.quotes === 0) {
    for (const row of quotes) {
      await sql`
        INSERT INTO quotes (id, number, customer_id, items, discount, tax, status, issue_date, valid_until, notes)
        VALUES (${row.id}, ${row.number}, ${row.customerId}, ${JSON.stringify(row.items)}::jsonb, ${row.discount}, ${row.tax}, ${row.status}, ${row.issueDate}, ${row.validUntil}, ${row.notes})`;
    }
  }

  if (!seeded && c.products === 0) {
    for (const row of products) {
      await sql`
        INSERT INTO products (id, name, detail, price, promo, discount, tax, image, created_at)
        VALUES (${row.id}, ${row.name}, ${row.detail}, ${row.price}, ${row.promo}, ${row.discount}, ${row.tax}, ${row.image}, ${row.createdAt})`;
    }
  }

  if (!seeded && c.webAssets === 0) {
    for (const row of webAssets) {
      await sql`
        INSERT INTO web_assets (id, type, name, customer_id, provider, start_date, expiry_date, price, notes, created_at)
        VALUES (${row.id}, ${row.type}, ${row.name}, ${row.customerId}, ${row.provider}, ${row.startDate}, ${row.expiryDate}, ${row.price}, ${row.notes}, ${row.startDate})`;
    }
  }

  // Mark seeding as done so deleted data never comes back on reload.
  if (!seeded) {
    await sql`UPDATE settings SET seeded = true, updated_at = now() WHERE id = 'site'`;
  }

  const after = await query<{ customers: number; invoices: number; quotes: number; products: number; webAssets: number }>`
    SELECT
      (SELECT count(*)::int FROM customers) AS customers,
      (SELECT count(*)::int FROM invoices) AS invoices,
      (SELECT count(*)::int FROM quotes) AS quotes,
      (SELECT count(*)::int FROM products) AS products,
      (SELECT count(*)::int FROM web_assets) AS webAssets`;
  return after[0];
}

export interface DbCounts {
  customers: number;
  invoices: number;
  quotes: number;
  products: number;
  webAssets: number;
}

let setupPromise: Promise<DbCounts> | null = null;

/**
 * Ensures the schema + seed data are set up, running the migration at most once
 * per serverless instance. Subsequent calls resolve instantly so API routes
 * (e.g. /api/payment) don't re-run ~30 queries on every request.
 * If setup fails, the cache is cleared so the next call retries.
 */
export function setupDatabase(): Promise<DbCounts> {
  if (!setupPromise) {
    setupPromise = runSetupDatabase().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  return setupPromise;
}
