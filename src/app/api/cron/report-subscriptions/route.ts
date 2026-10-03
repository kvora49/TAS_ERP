import { NextResponse } from "next/server";
import { runReportSubscriptionsJob } from "@/lib/cron/report-subscriptions";
import { timingSafeEqual } from "node:crypto";

export async function POST(req:Request) {
 const secret=process.env.CRON_SECRET, token=req.headers.get("authorization")?.replace(/^Bearer /,"");
 if(!secret)return NextResponse.json({error:"Report scheduler is not configured"},{status:503});
 if(!token||Buffer.byteLength(token)!==Buffer.byteLength(secret)||!timingSafeEqual(Buffer.from(token),Buffer.from(secret)))return NextResponse.json({error:"Unauthorized"},{status:401});
 try { return NextResponse.json(await runReportSubscriptionsJob()); }
 catch(error){console.error("[report-subscriptions]",error);return NextResponse.json({error:"Report scheduler failed"},{status:500});}
}
