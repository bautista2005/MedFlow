import * as React from "react";

import { cn } from "@/lib/utils";

function Badge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-900",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
