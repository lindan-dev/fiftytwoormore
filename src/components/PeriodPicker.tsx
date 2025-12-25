import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PeriodOption = "this-month" | "last-8-weeks" | "this-year" | "all-time";
export type ComparisonOption = "previous-period" | "same-period-last-year" | "all-time-average";

interface PeriodPickerProps {
  period: PeriodOption;
  comparison: ComparisonOption;
  onPeriodChange: (period: PeriodOption) => void;
  onComparisonChange: (comparison: ComparisonOption) => void;
  className?: string;
}

export const periodLabels: Record<PeriodOption, string> = {
  "this-month": "This month",
  "last-8-weeks": "Last 8 weeks",
  "this-year": "This year",
  "all-time": "All time",
};

export const comparisonLabels: Record<ComparisonOption, string> = {
  "previous-period": "Previous period",
  "same-period-last-year": "Same period last year",
  "all-time-average": "All time average",
};

export default function PeriodPicker({
  period,
  comparison,
  onPeriodChange,
  onComparisonChange,
  className = "",
}: PeriodPickerProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <Select value={period} onValueChange={(v) => onPeriodChange(v as PeriodOption)}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this-month">This month</SelectItem>
          <SelectItem value="last-8-weeks">Last 8 weeks</SelectItem>
          <SelectItem value="this-year">This year</SelectItem>
          <SelectItem value="all-time">All time</SelectItem>
        </SelectContent>
      </Select>
      
      <Select value={comparison} onValueChange={(v) => onComparisonChange(v as ComparisonOption)}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Compare to" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="previous-period">vs Previous period</SelectItem>
          <SelectItem value="same-period-last-year">vs Last year</SelectItem>
          <SelectItem value="all-time-average">vs All time avg</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
