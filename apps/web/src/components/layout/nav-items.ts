import { CalendarHeart, Ellipsis, House, Users, Wallet, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/hoje', label: 'Hoje', icon: House },
  { href: '/agenda', label: 'Agenda', icon: CalendarHeart },
  { href: '/alunos', label: 'Alunos', icon: Users },
  { href: '/financeiro', label: 'Financeiro', icon: Wallet },
  { href: '/mais', label: 'Mais', icon: Ellipsis },
];
