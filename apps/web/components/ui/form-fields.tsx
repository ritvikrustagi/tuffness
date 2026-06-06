import { Input } from "@/components/ui/input";

export function FormTextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`text-xs font-medium text-zinc-600 dark:text-zinc-400 ${className}`}>
      {label}
      <Input
        className="mt-1"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function FormTextAreaField({
  label,
  value,
  onChange,
  minHeightClass = "min-h-24",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minHeightClass?: string;
}) {
  return (
    <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
      {label}
      <textarea
        className={`mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-orange-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 ${minHeightClass}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function FormSelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  formatOption,
  className = "",
}: {
  label: string;
  value: T | "";
  options: readonly T[];
  onChange: (value: T | "") => void;
  formatOption?: (value: T) => string;
  className?: string;
}) {
  return (
    <label className={`text-xs font-medium text-zinc-600 dark:text-zinc-400 ${className}`}>
      {label}
      <select
        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm capitalize text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        value={value}
        onChange={(event) => onChange(event.target.value as T | "")}
      >
        <option value="">Not specified</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOption ? formatOption(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}
