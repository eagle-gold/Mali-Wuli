import { Star } from "lucide-react";

export default function NoteEtoiles({ note, compacte = false }: { note: number; compacte?: boolean }) {
  const remplies = Math.round(note);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Note ${note.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sur 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          size={compacte ? 17 : 21}
          strokeWidth={2}
          className="text-gold"
          fill={index < remplies ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}
