'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, CalendarDays, CheckSquare, Receipt, LogOut, Users, Building2, Truck, Menu, X, Share2, Sparkles, Bell, Star, Hammer, Package, Calendar, ListTodo, TrendingUp, BarChart2, Trophy, IndianRupee } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Profile, ROLE_LABELS } from '@/lib/types'
import NotificationBell from './NotificationBell'
import { useState } from 'react'

interface SidebarProps {
  profile: Profile
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isDirector = profile.role === 'director'
  const isAccounts = profile.role === 'accounts'
  const isAdmin = profile.role === 'admin'

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { href: '/dashboard/events', label: 'Events', icon: CalendarDays, show: true },
    { href: '/dashboard/calendar', label: 'Calendar', icon: Calendar, show: true },
    { href: '/dashboard/my-tasks', label: 'My Tasks', icon: ListTodo, show: !isDirector },
    { href: '/dashboard/approvals', label: 'Approvals', icon: CheckSquare, show: isDirector },
    { href: '/dashboard/expenses', label: 'Expenses', icon: Receipt, show: isDirector || isAccounts || profile.role === 'poc' },
    { href: '/dashboard/clients', label: 'Clients', icon: Building2, show: isDirector || isAccounts || isAdmin },
    { href: '/dashboard/vendors', label: 'Vendors', icon: Truck, show: isDirector || isAccounts || isAdmin },
    { href: '/dashboard/progress', label: 'Progress', icon: BarChart2, show: isDirector },
    { href: '/dashboard/team', label: 'Team', icon: Users, show: isDirector },
    { href: '/dashboard/social', label: 'Social Media', icon: Share2, show: isDirector || profile.role === 'design' || isAdmin },
    { href: '/dashboard/followup', label: 'Follow-Up', icon: Bell, show: isDirector || isAccounts || isAdmin },
    { href: '/dashboard/goldmine', label: 'Goldmine', icon: Star, show: isDirector },
    { href: '/dashboard/experiences', label: 'Experiences', icon: Sparkles, show: isDirector || isAdmin || profile.role === 'poc' },
    { href: '/dashboard/production', label: 'Production', icon: Hammer, show: isDirector || isAdmin || isAccounts },
    { href: '/dashboard/inventory', label: 'Inventory', icon: Package, show: isDirector || isAdmin },
    { href: '/dashboard/sales', label: 'Sales', icon: TrendingUp, show: isDirector || isAdmin },
    { href: '/dashboard/rates', label: 'Rate Master', icon: IndianRupee, show: isDirector || isAccounts },
    { href: '/dashboard/leaderboard', label: 'CEEstar', icon: Trophy, show: true },
  ].filter(item => item.show)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-gray-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-black text-black">CE</span>
          </div>
          <div>
            <p className="text-white text-sm font-bold leading-tight">Creative Era</p>
            <p className="text-gray-500 text-xs">Events Platform</p>
          </div>
        </div>
        <button onClick={() => setMobileOpen(false)} className="md:hidden text-gray-500 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Profile + Notification + Logout */}
      <div className="p-3 border-t border-gray-900">
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate">{profile.name}</p>
            <p className="text-gray-500 text-xs truncate">{ROLE_LABELS[profile.role]}</p>
          </div>
          <NotificationBell userId={profile.id} />
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-900 transition-colors w-full"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-gray-950 border-b border-gray-900 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileOpen(true)} className="text-gray-400 hover:text-white">
            <Menu size={20} />
          </button>
          <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center">
            <span className="text-[10px] font-black text-black">CE</span>
          </div>
          <span className="text-white text-sm font-bold">Creative Era</span>
        </div>
        <NotificationBell userId={profile.id} />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-gray-950 border-r border-gray-900 flex flex-col h-screen z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-gray-950 border-r border-gray-900 flex-col h-screen fixed left-0 top-0">
        {sidebarContent}
      </aside>
    </>
  )
}
