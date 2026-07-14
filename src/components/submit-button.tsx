"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({ children, pendingLabel = "Saving…", ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" {...props} disabled={pending || props.disabled} aria-disabled={pending || props.disabled}>{pending ? pendingLabel : children}</Button>;
}

export function ConfirmSubmitButton({ confirmMessage, children, pendingLabel = "Working…", ...props }: ButtonProps & { confirmMessage: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" {...props} disabled={pending || props.disabled} onClick={(event) => { if (!window.confirm(confirmMessage)) event.preventDefault(); }}>{pending ? pendingLabel : children}</Button>;
}
