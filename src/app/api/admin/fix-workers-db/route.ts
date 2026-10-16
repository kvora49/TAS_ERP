import { NextResponse } from "next/server";

// Emergency schema repair must run through a reviewed migration, never an ERP
// HTTP request. Keeping the route non-discoverable also protects old bookmarks.
export async function GET() {
  return new NextResponse(null, { status: 404 });
}
