import { SupabaseClient } from "@supabase/supabase-js";

export class RawMaterialRepository {
  constructor(public supabase: SupabaseClient) {}

  async list(businessId: string) {
    const { data, error } = await this.supabase
      .from("raw_material_types")
      .select("*")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async insert(businessId: string, params: {
    name: string;
    description?: string | null;
    category?: string | null;
    unit: string;
    image_url?: string | null;
    default_supplier_id?: string | null;
    reorder_level: number;
    hsn_code?: string | null;
    gst_percent?: number | null;
    is_active: boolean;
  }) {
    const { data, error } = await this.supabase
      .from("raw_material_types")
      .insert({
        business_id: businessId,
        name: params.name,
        description: params.description || null,
        category: params.category || null,
        unit: params.unit,
        image_url: params.image_url || null,
        default_supplier_id: params.default_supplier_id || null,
        reorder_level: params.reorder_level,
        hsn_code: params.hsn_code || null,
        gst_percent: params.gst_percent ?? null,
        is_active: params.is_active,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, businessId: string, params: {
    name: string;
    description?: string | null;
    category?: string | null;
    unit: string;
    image_url?: string | null;
    default_supplier_id?: string | null;
    reorder_level: number;
    hsn_code?: string | null;
    gst_percent?: number | null;
    is_active: boolean;
    lastKnownUpdatedAt: string;
  }) {
    const { data, error } = await this.supabase
      .from("raw_material_types")
      .update({
        name: params.name,
        description: params.description || null,
        category: params.category || null,
        unit: params.unit,
        image_url: params.image_url || null,
        default_supplier_id: params.default_supplier_id || null,
        reorder_level: params.reorder_level,
        hsn_code: params.hsn_code || null,
        gst_percent: params.gst_percent ?? null,
        is_active: params.is_active,
      })
      .eq("id", id)
      .eq("business_id", businessId)
      .eq("updated_at", params.lastKnownUpdatedAt)
      .select();

    if (error) throw error;
    return data;
  }

  async softDelete(id: string, businessId: string) {
    const { error } = await this.supabase
      .from("raw_material_types")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("business_id", businessId);

    if (error) throw error;
    return true;
  }
}
