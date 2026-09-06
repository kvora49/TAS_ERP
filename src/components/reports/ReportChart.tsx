"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useChartTheme } from "@/hooks/useChartTheme";
import { fmtINR, fmtNum } from "@/lib/report-export";

// Dynamic Recharts code-splitting for high-speed page transition (<100ms)
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

// ─── Palette ──────────────────────────────────────────────────────────────────

export const CHART_COLORS = [
  "#6366F1", // indigo
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // rose
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#F97316", // orange
  "#06B6D4", // cyan
];

// ─── Shared tooltip formatter ─────────────────────────────────────────────────

type ValueFormat = "currency" | "number" | "percent";

function formatValue(value: number, format: ValueFormat): string {
  if (format === "currency") return fmtINR(value);
  if (format === "percent") return `${value.toFixed(2)}%`;
  return fmtNum(value);
}

// ─── Line Chart ──────────────────────────────────────────────────────────────

export interface LineChartProps {
  data: Record<string, any>[];
  xKey: string;
  lines: { key: string; label: string; color?: string }[];
  valueFormat?: ValueFormat;
  height?: number;
}

export function ReportLineChart({
  data,
  xKey,
  lines,
  valueFormat = "currency",
  height = 260,
}: LineChartProps) {
  const ct = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
        <XAxis dataKey={xKey} tick={{ fill: ct.axisText, fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: ct.axisText, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (valueFormat === "currency" ? `₹${(v / 100000).toFixed(1)}L` : fmtNum(v))}
        />
        <Tooltip
          contentStyle={{
            background: ct.tooltipBg,
            border: `1px solid ${ct.tooltipBorder}`,
            borderRadius: 8,
            fontSize: 11,
            color: ct.text,
          }}
          formatter={(value: any) => [formatValue(Number(value || 0), valueFormat)]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: ct.axisText }} />
        {lines.map((l, i) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label}
            stroke={l.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Area Chart ──────────────────────────────────────────────────────────────

export function ReportAreaChart({
  data,
  xKey,
  lines,
  valueFormat = "currency",
  height = 260,
}: LineChartProps) {
  const ct = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
        <defs>
          {lines.map((l, i) => (
            <linearGradient key={l.key} id={`grad-${l.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={l.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={l.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
        <XAxis dataKey={xKey} tick={{ fill: ct.axisText, fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: ct.axisText, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (valueFormat === "currency" ? `₹${(v / 100000).toFixed(1)}L` : fmtNum(v))}
        />
        <Tooltip
          contentStyle={{
            background: ct.tooltipBg,
            border: `1px solid ${ct.tooltipBorder}`,
            borderRadius: 8,
            fontSize: 11,
            color: ct.text,
          }}
          formatter={(value: any) => [formatValue(Number(value || 0), valueFormat)]}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: ct.axisText }} />
        {lines.map((l, i) => (
          <Area
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label}
            stroke={l.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            fill={`url(#grad-${l.key})`}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

export interface BarChartProps {
  data: Record<string, any>[];
  xKey: string;
  bars: { key: string; label: string; color?: string }[];
  valueFormat?: ValueFormat;
  height?: number;
  layout?: "horizontal" | "vertical";
}

export function ReportBarChart({
  data,
  xKey,
  bars,
  valueFormat = "currency",
  height = 260,
}: BarChartProps) {
  const ct = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: ct.axisText, fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: ct.axisText, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (valueFormat === "currency" ? `₹${(v / 100000).toFixed(1)}L` : fmtNum(v))}
        />
        <Tooltip
          contentStyle={{
            background: ct.tooltipBg,
            border: `1px solid ${ct.tooltipBorder}`,
            borderRadius: 8,
            fontSize: 11,
            color: ct.text,
          }}
          formatter={(value: any) => [formatValue(Number(value || 0), valueFormat)]}
          cursor={{ fill: ct.grid, opacity: 0.4 }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: ct.axisText }} />
        {bars.map((b, i) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.label}
            fill={b.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Donut / Pie Chart ────────────────────────────────────────────────────────

export interface DonutChartProps {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  centerLabel?: string;
  centerValue?: string;
  valueFormat?: ValueFormat;
  legendPosition?: "bottom" | "right";
}

export function ReportDonutChart({
  data,
  height = 220,
  innerRadius = 45,
  outerRadius = 70,
  centerLabel,
  centerValue,
  valueFormat = "currency",
  legendPosition = "bottom",
}: DonutChartProps) {
  const ct = useChartTheme();
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ overflow: "visible", position: "relative" }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart
          margin={{ top: 15, right: 15, bottom: 15, left: 15 }}
          style={{ overflow: "visible" }}
        >
          <Pie
            data={data}
            cx="50%"
            cy={legendPosition === "bottom" ? "42%" : "50%"}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={entry.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: ct.tooltipBg,
              border: `1px solid ${ct.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 11,
              color: ct.text,
            }}
            formatter={(value: any, name: any) => [
              formatValue(Number(value || 0), valueFormat),
              String(name || ""),
            ]}
          />
          <Legend
            layout={legendPosition === "bottom" ? "horizontal" : "vertical"}
            align={legendPosition === "bottom" ? "center" : "right"}
            verticalAlign={legendPosition === "bottom" ? "bottom" : "middle"}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 10, color: ct.axisText, paddingTop: legendPosition === "bottom" ? 8 : 0 }}
            formatter={(value, entry: any) => {
              const pct = total > 0 ? ((entry.payload.value / total) * 100).toFixed(1) : "0";
              return `${value} (${pct}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}


// ─── Chart Card Wrapper ───────────────────────────────────────────────────────

export function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-[var(--shadow-sm)] p-4 ${className ?? ""}`}
    >
      <h3 className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-muted)] mb-3">{title}</h3>
      {children}
    </div>
  );
}
