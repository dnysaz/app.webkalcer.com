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

async function api(path: string, method: string, body?: unknown): Promise<void> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status})`);
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CrmData>(emptyData);
  const [loading, setLoading] = useState(true);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

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

  /**
   * Optimistic mutation with a FUNCTIONAL undo.
   *
   * `apply` runs immediately on the current state; if the API call fails,
   * `undo` is applied to whatever state exists at that moment — it only
   * reverses THIS operation, so concurrent mutations (e.g. addInvoice +
   * updateQuote in "process to invoice") never clobber each other and a
   * failed write can't roll back changes that actually succeeded.
   */
  const mutate = useCallback(
    (apply: (prev: CrmData) => CrmData, undo: (prev: CrmData) => CrmData, request: () => Promise<void>) => {
      setData(apply);
      void request().catch(() => setData(undo));
    },
    [],
  );

  const addCustomer = useCallback((customer: Customer) => {
    void (async () => {
      setData((p) => ({ ...p, customers: [customer, ...p.customers] }));
      try {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(customer),
        });
        if (!res.ok) throw new Error("POST /api/customers failed");
        const saved = (await res.json()) as Customer;
        // If the server had to regenerate the code (collision), adopt it locally.
        if (saved.code && saved.code !== customer.code) {
          setData((p) => ({
            ...p,
            customers: p.customers.map((c) => (c.id === saved.id ? { ...c, code: saved.code } : c)),
          }));
        }
      } catch {
        setData((p) => ({ ...p, customers: p.customers.filter((c) => c.id !== customer.id) }));
      }
    })();
  }, []);
  const updateCustomer = useCallback((customer: Customer) => {
    const before = dataRef.current.customers.find((c) => c.id === customer.id);
    mutate(
      (prev) => ({ ...prev, customers: prev.customers.map((c) => (c.id === customer.id ? customer : c)) }),
      (prev) => ({
        ...prev,
        customers: prev.customers.map((c) => (c.id === customer.id ? (before ?? c) : c)),
      }),
      () => api(`/api/customers/${customer.id}`, "PATCH", customer),
    );
  }, [mutate]);
  const deleteCustomer = useCallback((id: string) => {
    const before = dataRef.current.customers.find((c) => c.id === id);
    const index = dataRef.current.customers.findIndex((c) => c.id === id);
    mutate(
      (prev) => ({ ...prev, customers: prev.customers.filter((c) => c.id !== id) }),
      (prev) => {
        if (!before || index < 0) return prev;
        const customers = [...prev.customers];
        customers.splice(Math.min(index, customers.length), 0, before);
        return { ...prev, customers };
      },
      () => api(`/api/customers/${id}`, "DELETE"),
    );
  }, [mutate]);

  const addInvoice = useCallback((invoice: Invoice) => {
    void (async () => {
      setData((p) => ({ ...p, invoices: [invoice, ...p.invoices] }));
      try {
        const res = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invoice),
        });
        if (!res.ok) throw new Error("POST /api/invoices failed");
        const saved = (await res.json()) as Invoice;
        // The server may have regenerated the number on a collision — adopt it.
        if (saved.number && saved.number !== invoice.number) {
          setData((p) => ({
            ...p,
            invoices: p.invoices.map((i) => (i.id === saved.id ? { ...i, number: saved.number } : i)),
          }));
        }
      } catch {
        setData((p) => ({ ...p, invoices: p.invoices.filter((i) => i.id !== invoice.id) }));
      }
    })();
  }, []);
  const updateInvoice = useCallback((invoice: Invoice) => {
    const before = dataRef.current.invoices.find((i) => i.id === invoice.id);
    mutate(
      (prev) => ({ ...prev, invoices: prev.invoices.map((i) => (i.id === invoice.id ? invoice : i)) }),
      (prev) => ({
        ...prev,
        invoices: prev.invoices.map((i) => (i.id === invoice.id ? (before ?? i) : i)),
      }),
      () => api(`/api/invoices/${invoice.id}`, "PATCH", invoice),
    );
  }, [mutate]);
  const deleteInvoice = useCallback((id: string) => {
    const before = dataRef.current.invoices.find((i) => i.id === id);
    const index = dataRef.current.invoices.findIndex((i) => i.id === id);
    mutate(
      (prev) => ({ ...prev, invoices: prev.invoices.filter((i) => i.id !== id) }),
      (prev) => {
        if (!before || index < 0) return prev;
        const invoices = [...prev.invoices];
        invoices.splice(Math.min(index, invoices.length), 0, before);
        return { ...prev, invoices };
      },
      () => api(`/api/invoices/${id}`, "DELETE"),
    );
  }, [mutate]);

  const addQuote = useCallback((quote: Quote) => {
    void (async () => {
      setData((p) => ({ ...p, quotes: [quote, ...p.quotes] }));
      try {
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quote),
        });
        if (!res.ok) throw new Error("POST /api/quotes failed");
        const saved = (await res.json()) as Quote;
        // The server may have regenerated the number on a collision — adopt it.
        if (saved.number && saved.number !== quote.number) {
          setData((p) => ({
            ...p,
            quotes: p.quotes.map((q) => (q.id === saved.id ? { ...q, number: saved.number } : q)),
          }));
        }
      } catch {
        setData((p) => ({ ...p, quotes: p.quotes.filter((q) => q.id !== quote.id) }));
      }
    })();
  }, []);
  const updateQuote = useCallback((quote: Quote) => {
    const before = dataRef.current.quotes.find((q) => q.id === quote.id);
    mutate(
      (prev) => ({ ...prev, quotes: prev.quotes.map((q) => (q.id === quote.id ? quote : q)) }),
      (prev) => ({
        ...prev,
        quotes: prev.quotes.map((q) => (q.id === quote.id ? (before ?? q) : q)),
      }),
      () => api(`/api/quotes/${quote.id}`, "PATCH", quote),
    );
  }, [mutate]);
  const deleteQuote = useCallback((id: string) => {
    const before = dataRef.current.quotes.find((q) => q.id === id);
    const index = dataRef.current.quotes.findIndex((q) => q.id === id);
    mutate(
      (prev) => ({ ...prev, quotes: prev.quotes.filter((q) => q.id !== id) }),
      (prev) => {
        if (!before || index < 0) return prev;
        const quotes = [...prev.quotes];
        quotes.splice(Math.min(index, quotes.length), 0, before);
        return { ...prev, quotes };
      },
      () => api(`/api/quotes/${id}`, "DELETE"),
    );
  }, [mutate]);

  const addProduct = useCallback((product: Product) => {
    mutate(
      (prev) => ({ ...prev, products: [product, ...prev.products] }),
      (prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== product.id) }),
      () => api("/api/products", "POST", product),
    );
  }, [mutate]);
  const updateProduct = useCallback((product: Product) => {
    const before = dataRef.current.products.find((p) => p.id === product.id);
    mutate(
      (prev) => ({ ...prev, products: prev.products.map((p) => (p.id === product.id ? product : p)) }),
      (prev) => ({
        ...prev,
        products: prev.products.map((p) => (p.id === product.id ? (before ?? p) : p)),
      }),
      () => api(`/api/products/${product.id}`, "PATCH", product),
    );
  }, [mutate]);
  const deleteProduct = useCallback((id: string) => {
    const before = dataRef.current.products.find((p) => p.id === id);
    const index = dataRef.current.products.findIndex((p) => p.id === id);
    mutate(
      (prev) => ({ ...prev, products: prev.products.filter((p) => p.id !== id) }),
      (prev) => {
        if (!before || index < 0) return prev;
        const products = [...prev.products];
        products.splice(Math.min(index, products.length), 0, before);
        return { ...prev, products };
      },
      () => api(`/api/products/${id}`, "DELETE"),
    );
  }, [mutate]);

  const addWebAsset = useCallback((asset: WebAsset) => {
    mutate(
      (prev) => ({ ...prev, webAssets: [asset, ...prev.webAssets] }),
      (prev) => ({ ...prev, webAssets: prev.webAssets.filter((a) => a.id !== asset.id) }),
      () => api("/api/web-assets", "POST", asset),
    );
  }, [mutate]);
  const updateWebAsset = useCallback((asset: WebAsset) => {
    const before = dataRef.current.webAssets.find((a) => a.id === asset.id);
    mutate(
      (prev) => ({ ...prev, webAssets: prev.webAssets.map((a) => (a.id === asset.id ? asset : a)) }),
      (prev) => ({
        ...prev,
        webAssets: prev.webAssets.map((a) => (a.id === asset.id ? (before ?? a) : a)),
      }),
      () => api(`/api/web-assets/${asset.id}`, "PATCH", asset),
    );
  }, [mutate]);
  const deleteWebAsset = useCallback((id: string) => {
    const before = dataRef.current.webAssets.find((a) => a.id === id);
    const index = dataRef.current.webAssets.findIndex((a) => a.id === id);
    mutate(
      (prev) => ({ ...prev, webAssets: prev.webAssets.filter((a) => a.id !== id) }),
      (prev) => {
        if (!before || index < 0) return prev;
        const webAssets = [...prev.webAssets];
        webAssets.splice(Math.min(index, webAssets.length), 0, before);
        return { ...prev, webAssets };
      },
      () => api(`/api/web-assets/${id}`, "DELETE"),
    );
  }, [mutate]);

  const addNote = useCallback((note: Note) => {
    mutate(
      (prev) => ({ ...prev, notes: [note, ...prev.notes] }),
      (prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== note.id) }),
      () => api("/api/notes", "POST", note),
    );
  }, [mutate]);
  const updateNote = useCallback((note: Note) => {
    const before = dataRef.current.notes.find((n) => n.id === note.id);
    mutate(
      (prev) => ({ ...prev, notes: prev.notes.map((n) => (n.id === note.id ? note : n)) }),
      (prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === note.id ? (before ?? n) : n)),
      }),
      () => api(`/api/notes/${note.id}`, "PATCH", note),
    );
  }, [mutate]);
  const deleteNote = useCallback((id: string) => {
    const before = dataRef.current.notes.find((n) => n.id === id);
    const index = dataRef.current.notes.findIndex((n) => n.id === id);
    mutate(
      (prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== id) }),
      (prev) => {
        if (!before || index < 0) return prev;
        const notes = [...prev.notes];
        notes.splice(Math.min(index, notes.length), 0, before);
        return { ...prev, notes };
      },
      () => api(`/api/notes/${id}`, "DELETE"),
    );
  }, [mutate]);

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
