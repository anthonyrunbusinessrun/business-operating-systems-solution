import { CalendarDays, ClipboardList, GanttChart, LayoutGrid, ListChecks, SquareKanban, StretchHorizontal, Table2, Rows3 } from "lucide-react";
import type { ViewType } from "@/lib/base/types";

export const VIEW_COLOR: Record<ViewType, string> = {
  grid: "var(--tone-blue-fg)",
  calendar: "var(--tone-orange-fg)",
  gallery: "var(--tone-purple-fg)",
  kanban: "var(--tone-green-fg)",
  timeline: "var(--tone-red-fg)",
  list: "var(--tone-blue-fg)",
  gantt: "var(--tone-cyan-fg)",
  form: "var(--tone-pink-fg)",
};

export function ViewIcon({ type, size = 16 }: { type: ViewType | "section"; size?: number }) {
  const p = { size, strokeWidth: 1.75, "aria-hidden": true } as const;
  const color = type === "section" ? "var(--text-secondary)" : VIEW_COLOR[type];
  const icon = (() => {
    switch (type) {
      case "grid": return <Table2 {...p} />;
      case "calendar": return <CalendarDays {...p} />;
      case "gallery": return <LayoutGrid {...p} />;
      case "kanban": return <SquareKanban {...p} />;
      case "timeline": return <StretchHorizontal {...p} />;
      case "list": return <ListChecks {...p} />;
      case "gantt": return <GanttChart {...p} />;
      case "form": return <ClipboardList {...p} />;
      default: return <Rows3 {...p} />;
    }
  })();
  return <span style={{ color, display: "inline-flex" }}>{icon}</span>;
}
