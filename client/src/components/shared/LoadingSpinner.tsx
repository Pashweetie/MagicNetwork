import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "slate" | "purple" | "blue" | "yellow";
  message?: string;
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6", 
  lg: "w-8 h-8"
};

const colorClasses = {
  slate: "border-slate-400",
  purple: "border-purple-400",
  blue: "border-blue-400", 
  yellow: "border-yellow-400"
};

export function LoadingSpinner({ 
  size = "md", 
  color = "slate", 
  message,
  className 
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className={cn(
        "animate-spin rounded-full border-2 border-t-transparent",
        sizeClasses[size],
        colorClasses[color]
      )} />
      {message && (
        <span className={cn(
          "ml-2 text-sm",
          `text-${color}-400`
        )}>
          {message}
        </span>
      )}
    </div>
  );
}