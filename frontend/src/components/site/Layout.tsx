import { Button } from "@/components/ui/button";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { useState } from "react";
import { Link } from "wouter";

const navItems = [
  { label: "Главная", href: "/" },
  { label: "Конференции", href: "/conferences" },
  { label: "Секции", href: "/sections" },
  { label: "Проекты", href: "/apply" },
  { label: "Назначения", href: "/assignments" },
  { label: "Пользователи", href: "/users" },
  { label: "Справочники", href: "/catalogs" },
];

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState(() => getAuthToken());

  const handleLogout = () => {
    clearAuthToken();
    setToken(null);
    window.location.reload();
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grain" aria-hidden="true" />
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/75 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              ЭФ
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">конференции</p>
              <p className="text-lg font-semibold">EF Platform</p>
            </div>
          </Link>
          {token ? (
            <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
          <div className="flex items-center gap-3">
            {token ? (
              <>
                <Button variant="outline" onClick={handleLogout}>
                  Выйти
                </Button>
                <Button asChild>
                  <Link href="/conferences">Создать конференцию</Link>
                </Button>
              </>
            ) : (
              <Button variant="outline" asChild>
                <Link href="/login">Войти</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-12">{children}</main>

      <footer className="border-t border-border/70 bg-background/70 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>EF Platform • Учебный проект для конференций</p>
          <div className="flex flex-wrap gap-4">
            <span>Политика</span>
            <span>Контакты</span>
            <span>Документы</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
