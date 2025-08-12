import * as React from "react";
import { cn } from "../../lib/utils";

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

const Collapsible = ({
  open = false,
  onOpenChange,
  children,
  className,
}: CollapsibleProps) => {
  const [internalOpen, setInternalOpen] = React.useState(open);

  const isOpen = onOpenChange ? open : internalOpen;
  const handleOpenChange = onOpenChange || setInternalOpen;

  return (
    <div className={cn("space-y-2", className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === CollapsibleTrigger) {
            return React.cloneElement(child as React.ReactElement, {
              onClick: () => handleOpenChange(!isOpen),
              "aria-expanded": isOpen,
            });
          }
          if (child.type === CollapsibleContent) {
            return isOpen ? child : null;
          }
        }
        return child;
      })}
    </div>
  );
};

const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "flex w-full items-center justify-between py-2 text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
      className
    )}
    {...props}
  >
    {children}
  </button>
));
CollapsibleTrigger.displayName = "CollapsibleTrigger";

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("overflow-hidden text-sm", className)}
    {...props}
  >
    <div className="pb-4 pt-0">{children}</div>
  </div>
));
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
