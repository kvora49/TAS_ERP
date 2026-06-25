"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[size=default]:h-[20px] data-[size=default]:w-[36px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 bg-[#D1D5DB] data-[checked]:bg-[#6366F1] transition-colors duration-200",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-white ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[checked]/switch:translate-x-[18px] group-data-[unchecked]/switch:translate-x-0.5 group-data-[size=sm]/switch:group-data-[checked]/switch:translate-x-[10px] group-data-[size=sm]/switch:group-data-[unchecked]/switch:translate-x-0.5 shadow-sm duration-200"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
