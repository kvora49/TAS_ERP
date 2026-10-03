import { z } from "zod";
import type { ExcelSheet } from "@/lib/report-export";

export const scheduledReportKeys = ["analysis", "payments", "pl", "balance", "ledger", "stock"] as const;
export const subscriptionSchema = z.object({
  cadence: z.enum(["daily","weekly","monthly"]), enabled:z.boolean(),
  report_key:z.enum(scheduledReportKeys).default("analysis"),
  party_id:z.string().uuid().optional(),
}).strict().refine(value=>value.report_key!=="ledger"||!!value.party_id,"Choose a party for the ledger snapshot");

export function scheduledReportRPC(key: string, business: string, from: string, to: string, params: { party_id?: string } = {}) {
  switch(key){
    case "analysis": return {name:"fn_report_analysis",args:{p_business_id:business,p_from:from,p_to:to,p_compare:"prev_period"}};
    case "payments": return {name:"fn_report_payments",args:{p_business_id:business,p_from:from,p_to:to,p_tab:"all_transactions"}};
    case "pl": return {name:"fn_report_financial_pl",args:{p_business_id:business,p_from:from,p_to:to}};
    case "balance": return {name:"fn_report_financial_balance",args:{p_business_id:business,p_to:to}};
    case "stock": return {name:"fn_report_stock_valuation",args:{p_business_id:business}};
    case "ledger": if(z.string().uuid().safeParse(params.party_id).success)return {name:"fn_party_ledger",args:{p_business_id:business,p_party_id:params.party_id}};
  }
  throw new Error("Invalid scheduled report scope");
}

/** Complete bounded snapshot export: preserve every scalar and every array field. */
export function reportSnapshotSheets(payload: any): ExcelSheet[] {
  const metrics: Record<string, unknown>[] = [], sheets: ExcelSheet[] = [];
  const encoded=(value:unknown)=>value!=null&&typeof value==="object"?JSON.stringify(value):value;
  const visit=(value:any,path:string)=>{
    if(Array.isArray(value)){
      if(!value.length){metrics.push({field:path,value:"Empty register"});return;}
      const objects=value.map(row=>row!=null&&typeof row==="object"&&!Array.isArray(row)?row:{value:row});
      const keys=Array.from(new Set(objects.flatMap(row=>Object.keys(row))));
      sheets.push({name:`${path.replace(/[\\/?*\[\]:]/g,"_").slice(0,24)}_${sheets.length+1}`,columns:keys.map(key=>({key,label:key,width:24})),rows:objects.map(row=>Object.fromEntries(keys.map(key=>[key,encoded(row[key])]))) });
    }else if(value!=null&&typeof value==="object")for(const [key,child]of Object.entries(value))visit(child,path?`${path}.${key}`:key);
    else metrics.push({field:path,value:value??"Not available"});
  };
  visit(payload,"");
  return [{name:"Metrics and Basis",columns:[{key:"field",label:"Field",width:45},{key:"value",label:"Recorded value",width:60}],rows:metrics},...sheets];
}
