// Page de connexion
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-sable-50 flex items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <h1 className="font-display text-2xl font-bold text-terre mb-6 text-center">
          Se connecter
        </h1>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-terre mb-1">Email</label>
            <input type="email" className="w-full border border-sable-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-vert" />
          </div>
          <div>
            <label className="block text-sm font-medium text-terre mb-1">Mot de passe</label>
            <input type="password" className="w-full border border-sable-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-vert" />
          </div>
          <button type="submit" className="btn-primary w-full">Se connecter</button>
        </form>
        <p className="text-center mt-4 text-sm text-terre-300">
          Pas encore membre ?{" "}
          <a href="/register" className="text-vert font-medium hover:underline">S'inscrire</a>
        </p>
      </div>
    </div>
  );
}
