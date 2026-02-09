'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  Truck,
  Users,
  Building2,
  MapPin,
  FileText,
  LogOut,
  ChevronDown,
  MessageSquare,
  Settings,
  Brain,
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Fretes', href: '/fretes', icon: FileText },
  { name: 'Oportunidades', href: '/oportunidades', icon: MessageSquare },
  {
    name: 'Cadastros',
    key: 'cadastros',
    icon: ChevronDown,
    children: [
      { name: 'Motoristas', href: '/cadastros/motoristas', icon: Users },
      { name: 'Caminhões', href: '/cadastros/caminhoes', icon: Truck },
      { name: 'Transportadoras', href: '/cadastros/transportadoras', icon: Building2 },
      { name: 'Origens/Destinos', href: '/cadastros/origens-destinos', icon: MapPin },
    ],
  },
  {
    name: 'Configurações',
    key: 'config',
    icon: ChevronDown,
    children: [
      { name: 'WhatsApp', href: '/configuracoes/whatsapp', icon: Settings },
      { name: 'IA & Prompts', href: '/configuracoes/ia', icon: Brain },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    cadastros: pathname.startsWith('/cadastros'),
    config: pathname.startsWith('/configuracoes'),
  });

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <h1 className="text-lg font-bold text-arteita-blue-500">Arteita Fretes</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) =>
          item.children ? (
            <div key={item.key}>
              <button
                onClick={() => toggleMenu(item.key!)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100',
                )}
              >
                <span>{item.name}</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    openMenus[item.key!] && 'rotate-180',
                  )}
                />
              </button>
              {openMenus[item.key!] && (
                <div className="ml-2 mt-1 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                        pathname === child.href
                          ? 'bg-arteita-blue-50 font-medium text-arteita-blue-500'
                          : 'text-gray-600 hover:bg-gray-100',
                      )}
                    >
                      <child.icon className="h-4 w-4" />
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                pathname === item.href
                  ? 'bg-arteita-blue-50 font-medium text-arteita-blue-500'
                  : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ),
        )}
      </nav>

      {/* Logout */}
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
