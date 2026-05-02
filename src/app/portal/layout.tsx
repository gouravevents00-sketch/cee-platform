export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Branded top bar */}
      <div className="border-b border-gray-900 px-5 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-black text-black">CE</span>
        </div>
        <div>
          <p className="text-white text-sm font-bold leading-tight">Creative Era Events</p>
          <p className="text-gray-500 text-xs">creativeeraevents.com</p>
        </div>
      </div>
      <main className="p-4 md:p-6 max-w-3xl mx-auto">
        {children}
      </main>
    </div>
  )
}
