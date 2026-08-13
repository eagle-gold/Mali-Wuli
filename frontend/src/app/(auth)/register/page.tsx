// Page d'inscription
export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-sable-50 flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <h1 className="font-display text-2xl font-bold text-terre mb-2 text-center">
          Rejoindre Mali Wuli
        </h1>
        <p className="text-center text-sm text-terre-300 mb-6">
          Création de compte — environ 5 minutes
        </p>
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-terre mb-1">Prénom</label>
              <input type="text" className="w-full border border-sable-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-vert" />
            </div>
            <div>
              <label className="block text-sm font-medium text-terre mb-1">Nom</label>
              <input type="text" className="w-full border border-sable-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-vert" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-terre mb-1">Email</label>
            <input type="email" className="w-full border border-sable-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-vert" />
          </div>
          <div>
            <label className="block text-sm font-medium text-terre mb-1">Date de naissance</label>
            <input type="date" className="w-full border border-sable-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-vert" />
          </div>
          <div>
            <label className="block text-sm font-medium text-terre mb-1">Mot de passe</label>
            <input type="password" className="w-full border border-sable-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-vert" />
          </div>
          <div className="flex items-start gap-2">
            <input type="checkbox" id="cgu" className="mt-1" />
            <label htmlFor="cgu" className="text-sm text-terre-300">
              J'accepte les <a href="/cgu" className="text-vert underline">CGU</a> et la{" "}
              <a href="/confidentialite" className="text-vert underline">politique de confidentialité</a>
            </label>
          </div>
          <button type="submit" className="btn-primary w-full">Créer mon compte</button>
        </form>
        <p className="text-center mt-4 text-sm text-terre-300">
          Déjà membre ?{" "}
          <a href="/login" className="text-vert font-medium hover:underline">Se connecter</a>
        </p>
      </div>
    </div>
  );
}
