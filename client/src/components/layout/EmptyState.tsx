import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = Readonly<{
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}>;

/** Estado honesto para contenido aún no validado: nunca datos de relleno. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "card flex flex-col items-start gap-4 p-6 sm:p-8",
        className
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-aqua-100 text-royal-700">
        <Icon size={22} aria-hidden="true" />
      </span>
      <h3 className="text-xl font-bold text-ink">{title}</h3>
      <div className="max-w-xl text-base leading-7 text-ink-soft">
        {children}
      </div>
      {action}
    </div>
  );
}
