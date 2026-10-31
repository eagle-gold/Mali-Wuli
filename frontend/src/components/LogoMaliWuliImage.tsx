/** Variantes statiques : aucun traitement d’image côté serveur au chargement. */
export default function LogoMaliWuliImage({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src="/images/optimized/logo-mali-wuli-128-d2b3b2f296.webp"
      srcSet="/images/optimized/logo-mali-wuli-64-a9fea92c35.webp 64w, /images/optimized/logo-mali-wuli-128-d2b3b2f296.webp 128w, /images/optimized/logo-mali-wuli-192-a20ec012bd.webp 192w, /images/optimized/logo-mali-wuli-288-f92be6a04c.webp 288w"
      sizes={compact ? "(min-width: 1024px) 52px, 44px" : "(min-width: 1024px) 56px, 48px"}
      alt="Mali Wuli"
      width={1280}
      height={1280}
      fetchPriority="high"
      decoding="async"
      className={`${compact ? "h-11 w-11 lg:h-[52px] lg:w-[52px]" : "h-12 w-12 lg:h-14 lg:w-14"} object-contain`}
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
