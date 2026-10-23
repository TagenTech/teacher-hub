'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn, haptic } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[var(--nav-bg)] pb-safe backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={() => !active && haptic(8)}
                aria-current={active ? 'page' : undefined}
                className="group flex flex-col items-center gap-1 pb-2 pt-2.5"
              >
                <span
                  className={cn(
                    'grid h-8 w-14 place-items-center rounded-full transition-all duration-200',
                    active ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground group-active:scale-90',
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                </span>
                <span
                  className={cn(
                    'text-[11px] font-semibold',
                    active ? 'text-primary-soft-foreground' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
