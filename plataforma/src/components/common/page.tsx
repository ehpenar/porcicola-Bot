import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b bg-card px-4 py-4 sm:flex-row sm:items-end sm:justify-between md:px-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-5 md:px-8", className)}>{children}</div>;
}

export function EmptyState({ title, description, icon }: { title: string; description?: string | undefined; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed bg-card px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted-foreground [&_svg]:size-8">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function Panel({ title, children, actions, className }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-md border bg-card shadow-card", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          {title && <h2 className="label-caps">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageSkeleton() {
  return (
    <div>
      <div className="border-b bg-card px-4 py-5 md:px-8">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="space-y-3 px-4 py-5 md:px-8">
        <Skeleton className="h-9 w-full max-w-xl" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
