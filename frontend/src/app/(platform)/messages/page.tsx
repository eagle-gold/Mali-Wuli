// Messagerie — conversations privées et groupes
export default function MessagesPage() {
  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Liste des conversations */}
      <aside className="w-72 border-r border-sable-200 bg-white flex flex-col">
        <div className="p-4 border-b border-sable-200">
          <input type="text" placeholder="Rechercher une conversation..." className="w-full border border-sable-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 text-sm text-terre-300 italic">
          Aucune conversation.
        </div>
      </aside>
      {/* Zone de conversation */}
      <main className="flex-1 flex flex-col items-center justify-center text-terre-300 text-sm italic">
        Sélectionnez une conversation pour commencer.
      </main>
    </div>
  );
}
