/** Variantes statiques : aucun traitement d’image côté serveur au chargement. */
export default function LogoMaliWuliImage({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src="/images/optimized/logo-mali-wuli-128-d2b3b2f296.webp"
      srcSet="/images/optimized/logo-mali-wuli-64-a9fea92c35.webp 64w, /images/optimized/logo-mali-wuli-128-d2b3b2f296.webp 128w, /images/optimized/logo-mali-wuli-192-a20ec012bd.webp 192w, /images/optimized/logo-mali-wuli-288-f92be6a04c.webp 288w"
      sizes={compact ? "(min-width: 640px) 64px, 56px" : "(min-width: 1024px) 92px, (min-width: 640px) 80px, 56px"}
      alt="Mali Wuli"
      width={1280}
      height={1280}
      fetchPriority="high"
      decoding="async"
      className={`${compact ? "h-14 w-14 sm:h-16 sm:w-16" : "h-14 w-14 sm:h-20 sm:w-20 lg:h-[92px] lg:w-[92px]"} object-contain`}
    />
  );
}

export function LogoArbreImage() {
  return (
    <img
      src="/images/optimized/mali-wuli-arbre-96-ac67b3de00.webp"
      srcSet="/images/optimized/mali-wuli-arbre-48-7270efc8d2.webp 48w, /images/optimized/mali-wuli-arbre-96-ac67b3de00.webp 96w, /images/optimized/mali-wuli-arbre-144-c64cd3448f.webp 144w"
      sizes="(max-width: 700px) 36px, 46px"
      alt=""
      width={46}
      height={46}
      fetchPriority="high"
      decoding="async"
    />
  );
}
