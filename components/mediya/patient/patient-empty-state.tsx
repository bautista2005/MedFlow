import { Activity, ClipboardList } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PatientEmptyStateProps = {
  title: string;
  description: string;
  variant?: "treatments" | "requests";
};

export function PatientEmptyState({
  title,
  description,
  variant = "treatments",
}: PatientEmptyStateProps) {
  const Icon = variant === "requests" ? ClipboardList : Activity;

  return (
    <Card className="border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
      <CardHeader className="items-center pb-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-blue-100 bg-blue-50 text-blue-700 shadow-[0_12px_24px_rgba(37,99,235,0.10)]">
          <Icon className="h-6 w-6" />
        </div>
        <CardTitle className="text-[1.55rem]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-center">
        <p className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <div className="mx-auto h-1.5 w-20 rounded-full bg-blue-100" />
      </CardContent>
    </Card>
  );
}
