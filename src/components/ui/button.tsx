import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground hover:bg-[#1d3d57]",
      outline: "border-border bg-background hover:bg-muted hover:text-foreground",
      secondary: "bg-secondary text-secondary-foreground hover:bg-zinc-200",
      ghost: "hover:bg-muted hover:text-foreground",
      destructive: "border-red-300 bg-red-50 text-destructive hover:bg-red-100",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: { default: "h-9 px-3", xs: "h-7 px-2 text-xs", sm: "h-8 px-2.5 text-xs", lg: "h-11 px-5", icon: "size-9", "icon-xs": "size-7", "icon-sm": "size-8", "icon-lg": "size-11" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants, type ButtonProps };
