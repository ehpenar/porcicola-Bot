import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type QueueDef = { value: string; label: string; count: number; content: ReactNode; hint?: string };

export function QueueTabs({ queues, value, onChange }: { queues: QueueDef[]; value: string; onChange: (v: string) => void }) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <TabsList className="h-auto justify-start rounded-md border bg-card p-1">
          {queues.map((q) => (
            <TabsTrigger
              key={q.value}
              value={q.value}
              className="gap-2 rounded-sm px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {q.label}
              <span className="rounded-sm bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground">{q.count}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {queues.map((q) => (
        <TabsContent key={q.value} value={q.value} className="mt-4">
          {q.hint && <p className="mb-3 text-sm text-muted-foreground">{q.hint}</p>}
          {q.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
