"use client";

interface StarRatingProps {
  label: string;
  description?: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

export default function StarRating({ label, description, value, onChange }: StarRatingProps) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-base font-semibold text-[#2e261f]">{label}</p>
        {description && <p className="text-sm text-[#56493e]">{description}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} étoile${star > 1 ? "s" : ""} sur 5 pour ${label}`}
            aria-pressed={value === star}
            onClick={() => onChange(value === star ? null : star)}
            className="rounded transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#0d6738]/30"
          >
            <svg
              className={`h-7 w-7 ${value !== null && star <= value ? "text-[#c45b2a]" : "text-[#dfcfb3]"}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
        <span className="ml-3 min-w-8 text-sm font-medium text-[#2e261f]">
          {value === null ? "—" : `${value}/5`}
        </span>
      </div>
    </div>
  );
}
