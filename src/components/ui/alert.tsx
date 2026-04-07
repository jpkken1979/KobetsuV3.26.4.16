import { cn } from "@/lib/utils";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive";
}

function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-lg border px-4 py-3 text-sm",
        variant === "destructive"
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-border bg-background text-foreground",
        className
      )}
      {...props}
    />
  );
}

type AlertDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

function AlertDescription({
  className,
  ...props
}: AlertDescriptionProps) {
  return (
    <p className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  );
}

export { Alert, AlertDescription };
