'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, DollarSign, LayoutDashboard, Package, Settings, Smartphone, Users } from 'lucide-react';
import { deskTasks } from '@/lib/shop/board';
import { useShop } from './ShopContext';

const VIEWS = [
  { path: '', label: 'Board', icon: LayoutDashboard },
  { path: '/desk', label: 'My desk', icon: ClipboardList },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/parts', label: 'Parts', icon: Package },
  { path: '/money', label: 'Money', icon: DollarSign },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function ShopNav() {
  const pathname = usePathname();
  const { ws, href, siteId, basePath } = useShop();
  const current = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname;
  const active = current.startsWith('/jobs') ? '' : VIEWS.find(v => v.path && current.startsWith(v.path))?.path ?? '';
  const badges: Record<string, number> = {
    '/desk': ws ? deskTasks(ws).filter(t => t.group === 'now').length : 0,
    '/parts': ws?.pile_count ?? 0,
  };
  return (
    <nav className="subnav gutter" aria-label="Shop">
      {VIEWS.map(v => (
        <Link key={v.path} href={href(v.path)} aria-current={active === v.path ? 'page' : undefined}>
          <v.icon className="i" />{v.label}{badges[v.path] ? <span className="badge">{badges[v.path]}</span> : null}
        </Link>
      ))}
      <a href={`/shop-tech?siteId=${siteId}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto' }}>
        <Smartphone className="i" />Tech view
      </a>
    </nav>
  );
}
