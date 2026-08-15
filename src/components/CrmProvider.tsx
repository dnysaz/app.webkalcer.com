"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Customer, Invoice, Note, Product, Quote, WebAsset } from "@/lib/crm";

type CrmData = {
  customers: Customer[];
  invoices: Invoice[];
  quotes: Quote[];
  products: Product[];
  webAssets: WebAsset[];
  notes: Note[];
};

const emptyData: CrmData = { customers: [], invoices: [], quotes: [], products: [], webAssets: [], notes: [] };

const STORAGE_KEY = "webkalcer:crm:v3";

function readLocal(): CrmData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData;
    const parsed = JSON.parse(raw) as Partial<CrmData>;
    return {
      customers: Array.isArray(parsed.customers) ? (parsed.customers as Customer[]) : [],
      invoices: Array.isArray(parsed.invoices) ? (parsed.invoices as Invoice[]) : [],
      quotes: Array.isArray(parsed.quotes) ? (parsed.quotes as Quote[]) : [],
      products: Array.isArray(parsed.products) ? (parsed.products as Product[]) : [],
      webAssets: Array.isArray(parsed.webAssets) ? (parsed.webAssets as WebAsset[]) : [],
      notes: Array.isArray(parsed.notes) ? (parsed.notes as Note[]) : [],
    };
  } catch {
    return emptyData;
  }
}

function hasLocalData(local: CrmData): boolean {
  return [local.customers, local.invoices, local.quotes, local.products, local.webAssets, local.notes].some((list) => list.length > 0);
}

type CrmContextValue = CrmData & {
  loading: boolean;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
  addQuote: (quote: Quote) => void;
  updateQuote: (quote: Quote) => void;
  deleteQuote: (id: string) => void;
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  addWebAsset: (asset: WebAsset) => void;
  updateWebAsset: (asset: WebAsset) => void;
  deleteWebAsset: (id: string) => void;
  addNote: (note: Note) => void;
  updateNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  resetData: () => Promise<void>;
  refresh: () => Promise<void>;
};

const CrmContext = createContext<CrmContextValue | null>(null);

async function loadAll() {
  const [customers, invoices, quotes, products, webAssets, notes] = await Promise.all([
    fetch("/api/customers").then((r) => r.json()),
    fetch("/api/invoices").then((r) => r.json()),
    fetch("/api/quotes").then((r) => r.json()),
    fetch("/api/products").then((r) => r.json()),
    fetch("/api/web-assets").then((r) => r.json()),
    fetch("/api/notes").then((r) => r.json()),
  ]);
  return { customers, invoices, quotes, products, webAssets, notes } as CrmData;
}

async function api(path: string, method: string, body?: unknown) {
  await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CrmData>(emptyData);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const fresh = await loadAll();
      setData(fresh);
    } catch {
      const local = readLocal();
      if (hasLocalData(local)) setData(local);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/setup", { method: "POST" });
        const fresh = await loadAll();
        setData(fresh);
      } catch {
        const local = readLocal();
        if (hasLocalData(local)) setData(local);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const skipFirstPersist = useRef(true);
  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage full or blocked — ignore
    }
  }, [data]);

  const addCustomer = useCallback((customer: Customer) => {
    setData((prev) => ({ ...prev, customers: [customer, ...prev.customers] }));
    void (async () => {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customer),
      });
      if (res.ok) {
        const saved = (await res.json()) as Customer;
        // If the server had to regenerate the code (collision), adopt it locally.
        if (saved.code && saved.code !== customer.code) {
          setData((prev) => ({
            ...prev,
            customers: prev.customers.map((c) => (c.id === saved.id ? { ...c, code: saved.code } : c)),
          }));
        }
      }
    })();
  }, []);
  const updateCustomer = useCallback((customer: Customer) => {
    setData((prev) => ({ ...prev, customers: prev.customers.map((c) => (c.id === customer.id ? customer : c)) }));
    void api(`/api/customers/${customer.id}`, "PATCH", customer);
  }, []);
  const deleteCustomer = useCallback((id: string) => {
    setData((prev) => ({ ...prev, customers: prev.customers.filter((c) => c.id !== id) }));
    void api(`/api/customers/${id}`, "DELETE");
  }, []);

  const addInvoice = useCallback((invoice: Invoice) => {
    setData((prev) => ({ ...prev, invoices: [invoice, ...prev.invoices] }));
    void api("/api/invoices", "POST", invoice);
  }, []);
  const updateInvoice = useCallback((invoice: Invoice) => {
    setData((prev) => ({ ...prev, invoices: prev.invoices.map((i) => (i.id === invoice.id ? invoice : i)) }));
    void api(`/api/invoices/${invoice.id}`, "PATCH", invoice);
  }, []);
  const deleteInvoice = useCallback((id: string) => {
    setData((prev) => ({ ...prev, invoices: prev.invoices.filter((i) => i.id !== id) }));
    void api(`/api/invoices/${id}`, "DELETE");
  }, []);

  const addQuote = useCallback((quote: Quote) => {
    setData((prev) => ({ ...prev, quotes: [quote, ...prev.quotes] }));
    void api("/api/quotes", "POST", quote);
  }, []);
  const updateQuote = useCallback((quote: Quote) => {
    setData((prev) => ({ ...prev, quotes: prev.quotes.map((q) => (q.id === quote.id ? quote : q)) }));
    void api(`/api/quotes/${quote.id}`, "PATCH", quote);
  }, []);
  const deleteQuote = useCallback((id: string) => {
    setData((prev) => ({ ...prev, quotes: prev.quotes.filter((q) => q.id !== id) }));
    void api(`/api/quotes/${id}`, "DELETE");
  }, []);

  const addProduct = useCallback((product: Product) => {
    setData((prev) => ({ ...prev, products: [product, ...prev.products] }));
    void api("/api/products", "POST", product);
  }, []);
  const updateProduct = useCallback((product: Product) => {
    setData((prev) => ({ ...prev, products: prev.products.map((p) => (p.id === product.id ? product : p)) }));
    void api(`/api/products/${product.id}`, "PATCH", product);
  }, []);  const deleteProduct = useCallback((id: string) => {
    setData((prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== id) }));
    void api(`/api/products/${id}`, "DELETE");
  }, []);

  const addWebAsset = useCallback((asset: WebAsset) => {
    setData((prev) => ({ ...prev, webAssets: [asset, ...prev.webAssets] }));
    void api("/api/web-assets", "POST", asset);
  }, []);
  const updateWebAsset = useCallback((asset: WebAsset) => {
    setData((prev) => ({ ...prev, webAssets: prev.webAssets.map((a) => (a.id === asset.id ? asset : a)) }));
    void api(`/api/web-assets/${asset.id}`, "PATCH", asset);
  }, []);
  const deleteWebAsset = useCallback((id: string) => {
    setData((prev) => ({ ...prev, webAssets: prev.webAssets.filter((a) => a.id !== id) }));
    void api(`/api/web-assets/${id}`, "DELETE");
  }, []);

  const addNote = useCallback((note: Note) => {
    setData((prev) => ({ ...prev, notes: [note, ...prev.notes] }));
    void api("/api/notes", "POST", note);
  }, []);
  const updateNote = useCallback((note: Note) => {
    setData((prev) => ({ ...prev, notes: prev.notes.map((n) => (n.id === note.id ? note : n)) }));
    void api(`/api/notes/${note.id}`, "PATCH", note);
  }, []);
  const deleteNote = useCallback((id: string) => {
    setData((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== id) }));
    void api(`/api/notes/${id}`, "DELETE");
  }, []);

  const resetData = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/setup", { method: "POST" });
      const fresh = await loadAll();
      setData(fresh);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<CrmContextValue>(
    () => ({
      ...data,
      loading,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      addQuote,
      updateQuote,
      deleteQuote,
      addProduct,
      updateProduct,
      deleteProduct,
      addWebAsset,
      updateWebAsset,
      deleteWebAsset,
      addNote,
      updateNote,
      deleteNote,
      resetData,
      refresh,
    }),
    [
      data,
      loading,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      addQuote,
      updateQuote,
      deleteQuote,
      addProduct,
      updateProduct,
      deleteProduct,
      addWebAsset,
      updateWebAsset,
      deleteWebAsset,
      addNote,
      updateNote,
      deleteNote,
      resetData,
      refresh,
    ],
  );

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm(): CrmContextValue {
  const ctx = useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used within CrmProvider");
  return ctx;
}