import { EInvoiceAdapter } from "./types";
import { MockEInvoiceAdapter } from "./adapters/mock.adapter";
import { IrisEInvoiceAdapter } from "./adapters/iris.adapter";

let activeAdapter: EInvoiceAdapter | null = null;

/**
 * Returns the configured GSP E-Invoice Adapter
 * Automatically resolves to IrisEInvoiceAdapter in production or when EINVOICE_ADAPTER=iris,
 * or MockEInvoiceAdapter for local development/testing.
 */
export function getEInvoiceAdapter(): EInvoiceAdapter {
  if (activeAdapter) {
    return activeAdapter;
  }

  const adapterType = process.env.EINVOICE_ADAPTER || (process.env.NODE_ENV === "production" ? "iris" : "mock");

  if (adapterType.toLowerCase() === "iris") {
    activeAdapter = new IrisEInvoiceAdapter();
  } else {
    activeAdapter = new MockEInvoiceAdapter();
  }

  return activeAdapter;
}

/**
 * Allows overriding adapter instance for unit tests
 */
export function setEInvoiceAdapterForTesting(adapter: EInvoiceAdapter | null): void {
  activeAdapter = adapter;
}
