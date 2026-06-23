import { Badge } from "./Badge";

interface StatusBadgeProps {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  className?: string;
}

export function StatusBadge({
  active,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
  className,
}: StatusBadgeProps) {
  return (
    <Badge variant={active ? "green" : "gray"} className={className}>
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}
