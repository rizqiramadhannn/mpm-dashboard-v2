"use client";

import type { ComponentProps } from "react";

type ConfirmFormProps = ComponentProps<"form"> & {
  confirmMessage?: string;
};

export function ConfirmForm({
  confirmMessage = "Lanjutkan submit data ini?",
  onSubmit,
  ...props
}: ConfirmFormProps) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }

        onSubmit?.(event);
      }}
    />
  );
}
