"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingText?: string | null;
};

export function SubmitButton({
  children,
  disabled,
  pendingText = "Đang xử lý...",
  type = "submit",
  ...props
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin shrink-0" size={16} />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}
