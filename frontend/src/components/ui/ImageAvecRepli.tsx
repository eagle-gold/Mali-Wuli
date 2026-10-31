"use client";

import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";

/**
 * Photo (de profil, d'association…) avec repli : si l'adresse est vide ou si
 * l'image ne se charge pas (fichier supprimé, réseau), le repli s'affiche à
 * la place — en général les initiales — au lieu d'une image cassée.
 */
export default function ImageAvecRepli({
  src,
  repli,
  alt = "",
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string | null; repli: ReactNode }) {
  const [echec, setEchec] = useState(false);
  // Une nouvelle adresse (photo modifiée) mérite un nouvel essai.
  useEffect(() => { setEchec(false); }, [src]);
  if (!src || echec) return <>{repli}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setEchec(true)} {...props} />;
}
