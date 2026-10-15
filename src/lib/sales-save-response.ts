import { ApiRequestError } from "@/lib/user-friendly-error";

/** Decode save responses without hiding HTTP failures behind browser JSON errors. */
export async function readSalesSaveResponse(response: Response, creating: boolean) {
  const uncertain = `Unable to confirm whether the invoice was saved (HTTP ${response.status}). Check the sales bill list before trying again.`;
  let data: any;
  try {
    data = await response.json();
  } catch {
    if (response.status === 401) throw new ApiRequestError("Your session has expired. Sign in again before saving the invoice.", response.status);
    if (response.status === 413) throw new ApiRequestError("The invoice is too large to submit. Reduce the number of items or rolls and try again.", response.status);
    if (response.status === 429) throw new ApiRequestError("Too many requests. Wait a moment before saving the invoice again.", response.status);
    throw new ApiRequestError(uncertain, response.status);
  }

  if (!response.ok || data?.success === false || data?.error) {
    throw new ApiRequestError(
      typeof data?.error === "string" && data.error.trim() ? data.error : `Failed to save invoice (HTTP ${response.status}).`,
      response.status,
      typeof data?.code === "string" ? data.code : undefined,
      data?.details,
    );
  }

  // A proxy/login response or an empty object must not open the success modal.
  const bill = data?.data || data?.bill || data;
  if (creating ? !(typeof bill?.id === "string" && bill.id.length > 0) : !(data?.success === true || bill?.id)) {
    throw new ApiRequestError(uncertain, response.status);
  }
  return data;
}
