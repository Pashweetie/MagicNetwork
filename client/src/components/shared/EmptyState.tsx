import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon | string; // Lucide icon component or emoji string
  title: string;
  description?: string;
  className?: string;
  iconClassName?: string;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  className,
  iconClassName 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-8 text-center text-slate-400",
      className
    )}>
      {Icon && (
        <div className={cn("mb-4", iconClassName)}>
          {typeof Icon === 'string' ? (
            // Emoji icon
            <span className="text-6xl">{Icon}</span>
          ) : (
            // Lucide icon component
            <Icon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          )}
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-300 mb-2">{title}</h3>
      {description && (
        <p className="text-slate-400 max-w-md">{description}</p>
      )}
    </div>
  );
}