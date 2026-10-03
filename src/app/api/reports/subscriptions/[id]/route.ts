import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { createClient,getSessionBusinessId } from "@/lib/supabase/server";
export async function GET(req:NextRequest,{params}:{params:{id:string}}) {
 const client=createClient(),business=await getSessionBusinessId(),{data:{user}}=await client.auth.getUser();
 if(!business||!user)return NextResponse.json({error:"Unauthorized"},{status:401});
 if(!z.uuid().safeParse(params.id).success)return NextResponse.json({error:"Invalid export"},{status:400});
 const {data,error}=await client.from("report_subscription_runs").select("payload,status,from_date,to_date,report_key").eq("id",params.id).eq("business_id",business).eq("user_id",user.id).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(error)return NextResponse.json({error:"Unable to load export"},{status:500});
 if(!data||data.status!=="ready")return NextResponse.json({error:"Export not available"},{status:404});
 return NextResponse.json(data);
}
