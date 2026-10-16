import { EInvoiceAdapter } from "./types";
import { MockEInvoiceAdapter } from "./adapters/mock.adapter";
import { IrisEInvoiceAdapter } from "./adapters/iris.adapter";

let activeAdapter: EInvoiceAdapter | null = null;

/**
 * Returns the configured GSP E-Invoice Adapter
 * Automatically resolves to IrisEInvoiceAdapter in production or when EINVOICE_ADAPTER=iris.
 * The mock adapter is deliberately limited to non-production environments: a typo in a
 * production environment variable must never simulate a statutory registration.
 */
export function getEInvoiceAdapter(): EInvoiceAdapter {
  if (activeAdapter) {
    return activeAdapter;
  }

  const adapterType = (process.env.EINVOICE_ADAPTER || (process.env.NODE_ENV === "production" ? "iris" : "mock"))
    .trim()
    .toLowerCase();

  if (adapterType === "iris") {
    activeAdapter = new IrisEInvoiceAdapter();
  } else if (adapterType === "mock" && process.env.NODE_ENV !== "production") {
    activeAdapter = new MockEInvoiceAdapter();
  } else {
    throw new Error(
      `Invalid e-invoice adapter configuration: ${adapterType || "(empty)"}. ` +
      "Production requires EINVOICE_ADAPTER=iris."
    );
  }

  return activeAdapter;
}

/**
 * Allows overriding adapter instance for unit tests
 */
export function setEInvoiceAdapterForTesting(adapter: EInvoiceAdapter | null): void {
  activeAdapter = adapter;
}
