import type { Customer, Invoice, Product, Quote } from "./crm";

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

export const seedCustomers: Customer[] = [
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
  {
    id: "c6",
    code: codeFromDate(iso(-10)),
    name: "Dewi Lestari",
    businessName: "Toko Dewi Souvenir",
    email: "dewi.lestari@gmail.com",
    phones: ["0858-7878-6006"],
    domain: "dewitoko.id",
    address: "Jl. Pasar Baru No. 45, Jakarta Pusat",
    status: "Prospect",
    notes: "Local SME, needs an affordable solution for stock and sales management.",
    createdAt: iso(-10),
  },
];

export const seedProducts: Product[] = [
  {
    id: "p1",
    name: "Point of Sale Pro",
    detail: "Complete POS system for retail stores. Includes inventory tracking, cashier reports, and offline mode. Suitable for modern stores.",
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
    detail: "Web storefront with payment gateway integration and automated order routing to the closest store.",
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
    detail: "Real-time dashboards for sales trends, customer segments, and staff performance. Export-ready reports.",
    price: 1800000,
    promo: false,
    discount: 0,
    tax: 11,
    image: "",
    createdAt: iso(-6),
  },
];

export const seedInvoices: Invoice[] = [
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
];

export const seedQuotes: Quote[] = [
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
    number: `OFF-${codeFromDate(iso(-10))}-${yearOf(iso(-1))}-001`,
    customerId: "c6",
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
    items: [
      { id: "q3a", name: "Suite License Renewal", qty: 1, price: 3200000 },
    ],
    discount: 0,
    tax: 11,
    status: "Cancel",
    issueDate: iso(-30),
    validUntil: iso(-15),
    notes: "Client rejected due to different budget priorities. Try again in Q3.",
  },
];