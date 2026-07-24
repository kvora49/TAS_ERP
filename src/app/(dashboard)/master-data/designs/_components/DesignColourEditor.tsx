"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, X } from "lucide-react";

const colorSchema = z.object({
  colour_name: z.string().min(1, "Colour Name is required"),
  colour_hex: z.string(),
  image_url: z.string().optional(),
});

type ColorFormValues = z.infer<typeof colorSchema>;

export interface DesignColour {
  id?: string;
  colour_name: string;
  colour_hex: string | null;
  image_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (colour: DesignColour) => void;
  activeColours: DesignColour[];
  onRemove: (index: number) => void;
}

export function DesignColourEditor({ open, onOpenChange, onAdd, activeColours, onRemove }: Props) {
  const {
    register, handleSubmit, setValue, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<ColorFormValues>({
    resolver: zodResolver(colorSchema),
    defaultValues: { colour_name: "", colour_hex: "#6366F1", image_url: "" },
  });

  const colorImageUrl = watch("image_url");
  const colorHexValue = watch("colour_hex");

  const handleOpen = (open: boolean) => {
    if (!open) reset({ colour_name: "", colour_hex: "#6366F1", image_url: "" });
    onOpenChange(open);
  };

  const onSubmit = (values: ColorFormValues) => {
    onAdd({
      colour_name: values.colour_name,
      colour_hex: values.colour_hex || null,
      image_url: values.image_url || null,
    });
    reset({ colour_name: "", colour_hex: "#6366F1", image_url: "" });
    onOpenChange(false);
  };

  return (
    <>
      {/* Colour Swatch list */}
      {activeColours.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {activeColours.map((c, idx) => (
            <div key={idx} className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
              {c.colour_hex && (
                <span className="w-3.5 h-3.5 rounded-full border border-[#D1D5DB] shrink-0" style={{ backgroundColor: c.colour_hex }} />
              )}
              {c.image_url && (
                <img src={c.image_url} alt={c.colour_name} className="w-5 h-5 rounded object-cover border border-slate-200" />
              )}
              <span>{c.colour_name}</span>
              <button type="button" onClick={() => onRemove(idx)} className="text-slate-400 hover:text-red-500 transition-colors ml-0.5">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Colour Dialog */}
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#0F172A]">Add Colour Swatch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label htmlFor="colour-name" className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Colour Name *</label>
              <input
                id="colour-name" type="text" placeholder="e.g. Navy Blue, Off White..."
                className="w-full h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                {...register("colour_name")}
              />
              {errors.colour_name && <p className="text-xs text-red-500">{errors.colour_name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="colour-hex" className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Hex Color Code</label>
              <div className="flex items-center gap-2">
                <input
                  id="colour-hex" type="color" value={colorHexValue || "#6366F1"}
                  onChange={(e) => setValue("colour_hex", e.target.value)}
                  className="h-10 w-14 border border-[#D1D5DB] rounded-lg p-1 bg-white cursor-pointer"
                />
                <input
                  type="text" placeholder="#6366F1" value={colorHexValue || ""}
                  onChange={(e) => setValue("colour_hex", e.target.value)}
                  className="flex-1 h-10 px-3 bg-white border border-[#D1D5DB] rounded-lg text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Colour Image (optional)</label>
              <ImageUpload
                value={colorImageUrl || ""}
                folder="design_colour_images"
                onChange={(url) => setValue("image_url", url)}
                onRemove={() => setValue("image_url", "")}
                label="Upload Colour Image"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => handleOpen(false)} className="h-9 px-4 border border-[#E5E7EB] rounded-lg text-sm font-semibold text-slate-600">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="h-9 px-4 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Colour
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
