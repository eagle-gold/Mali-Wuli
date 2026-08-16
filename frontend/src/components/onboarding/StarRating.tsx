"use client";

interface StarRatingProps {
  label: string;
  description?: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

export default function StarRating({ label, description, value, onChange }: StarRatingProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-terre">{label}</p>
        {description && <p className="text-xs text-terre-300">{description}</p>}
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(value === star ? null : star)}
            className="transition-colors"
          >
            <svg
              className={`w-5 h-5 ${value !== null && star <= value ? "text-yellow-400" : "text-sable-200"}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
        {/* Bouton "Sans avis" */}
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`ml-1 text-xs px-2 py-0.5 rounded border transition-colors
            ${value === null ? "border-terre-300 text-terre-300 bg-sable-100" : "border-sable-200 text-sable-300 hover:border-terre-300"}
          `}
        >
          –
        </button>
      </div>
    </div>
  );
}
