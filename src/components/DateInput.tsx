import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DateInputProps {
  date?: string;
  onDateChange: (date: string) => void;
  placeholder?: string;
}

export function DateInput({ date, onDateChange, placeholder = "Select date" }: DateInputProps) {
  const parseDate = (dateStr: string) => {
    if (!dateStr) return { day: "", month: "", year: "" };
    const [year, month, day] = dateStr.split('-');
    // Remove leading zeros to match SelectItem values
    return { 
      day: day ? String(parseInt(day, 10)) : "", 
      month: month ? String(parseInt(month, 10)) : "", 
      year 
    };
  };

  const { day, month, year } = parseDate(date || "");

  const handleChange = (newDay: string, newMonth: string, newYear: string) => {
    if (newDay && newMonth && newYear) {
      onDateChange(`${newYear}-${newMonth.padStart(2, '0')}-${newDay.padStart(2, '0')}`);
    }
  };

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i));

  return (
    <div className="grid grid-cols-3 gap-2">
      <Select value={day} onValueChange={(newDay) => handleChange(newDay, month, year)}>
        <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
          <SelectValue placeholder="Day" />
        </SelectTrigger>
        <SelectContent>
          {days.map((d) => (
            <SelectItem key={d} value={d}>{d}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={month} onValueChange={(newMonth) => handleChange(day, newMonth, year)}>
        <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={year} onValueChange={(newYear) => handleChange(day, month, newYear)}>
        <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
