"use client";

import { Layers, ClipboardList, Hammer } from "lucide-react";
import { ModuleHubPage } from "@/components/shared/ModuleHubPage";

export default function ProductionPage() {
  return (
    <ModuleHubPage
      title="Production"
      subtitle="Manage lots, stage tracking, and job work"
      sections={[
        {
          title: "Production",
          items: [
            {
              label: "Production Lots",
              href: "/production/lots",
              icon: Layers,
              accent: "text-indigo-500",
              description: "Create and manage production batches",
            },
            {
              label: "Stage Entries",
              href: "/production/stage-entries",
              icon: ClipboardList,
              accent: "text-emerald-500",
              description: "Track production progress by stage",
            },
            {
              label: "Job Work",
              href: "/production/job-work",
              icon: Hammer,
              accent: "text-amber-500",
              description: "Outsourced work tracking and payments",
            },
          ],
        },
      ]}
    />
  );
}
