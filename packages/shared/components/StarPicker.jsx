import { Star } from "lucide-react";

export function StarPicker({ value, onChange }) {
  return (
    <div className="star-picker" role="radiogroup" aria-label="Choose rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? "star-button active" : "star-button"}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
        >
          <Star size={22} fill="currentColor" />
        </button>
      ))}
    </div>
  );
}
