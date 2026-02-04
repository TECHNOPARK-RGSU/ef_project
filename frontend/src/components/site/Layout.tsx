import { Button } from "@/components/ui/button";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import projectarisLogo from "@/assets/projectaris-logo.svg";

type NavItem = { label: string; href: string };

function getNavItems(roleCode: string): NavItem[] {
  if (roleCode === "organizer") {
    return [
      { label: "Главная", href: "/" },
      { label: "Конференции", href: "/conferences" },
      { label: "Заявки", href: "/apply" },
      { label: "Назначения", href: "/assignments" },
      { label: "Критерии", href: "/criteria" },
      { label: "Оценки", href: "/scores" },
      { label: "Комментарии", href: "/comments" },
      { label: "Пользователи", href: "/users" },
      { label: "Справочники", href: "/catalogs" },
    ];
  }
  if (roleCode === "expert") {
    return [
      { label: "Главная", href: "/" },
      { label: "Назначения", href: "/assignments" },
      { label: "Оценки", href: "/scores" },
      { label: "Комментарии", href: "/comments" },
    ];
  }
  if (roleCode === "tutor" || roleCode === "student" || roleCode === "student2" || roleCode === "student3") {
    return [
      { label: "Главная", href: "/" },
      { label: "Мои проекты", href: "/apply" },
    ];
  }
  return [{ label: "Главная", href: "/" }];
}

export function SiteLayout({ children, roleCode = "" }: { children: React.ReactNode; roleCode?: string }) {
  const [token, setToken] = useState(() => getAuthToken());
  const [location] = useLocation();
  const normalizedRole = roleCode.toLowerCase();
  const navItems = getNavItems(normalizedRole);
  const roleLabel =
    normalizedRole === "organizer"
      ? "Организатор"
      : normalizedRole === "expert"
        ? "Эксперт"
        : normalizedRole === "tutor"
          ? "Наставник"
          : normalizedRole === "student" || normalizedRole === "student2" || normalizedRole === "student3"
            ? "Ученик"
            : "";

  const handleLogout = () => {
    clearAuthToken();
    setToken(null);
    window.location.reload();
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grain" aria-hidden="true" />
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/75 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <img src={projectarisLogo} alt="Projectaris" className="size-10 rounded-full border border-border/60 bg-background/80 p-1" />
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground md:text-sm">projectaris</p>
              <p className="text-base font-semibold md:text-lg">Платформа конференций</p>
            </div>
          </Link>
          {token ? (
            <nav className="hidden items-center gap-4 text-sm font-medium text-muted-foreground lg:flex">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`transition-colors hover:text-foreground ${
                    location === item.href || location.startsWith(`${item.href}/`) ? "text-foreground" : ""
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
          <div className="flex items-center gap-3">
            {token ? (
              <>
                {roleLabel ? (
                  <span className="hidden rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground md:inline-flex">
                    {roleLabel}
                  </span>
                ) : null}
                <Button variant="outline" onClick={handleLogout}>
                  Выйти
                </Button>
                {normalizedRole === "organizer" ? (
                  <Button asChild>
                    <Link href="/conferences">Новая конференция</Link>
                  </Button>
                ) : normalizedRole === "expert" ? (
                  <Button asChild>
                    <Link href="/assignments">Мои назначения</Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link href="/apply">Мои проекты</Link>
                  </Button>
                )}
              </>
            ) : (
              <Button variant="outline" asChild>
                <Link href="/login">Войти</Link>
              </Button>
            )}
          </div>
        </div>
        {token ? (
          <div className="border-t border-border/60 lg:hidden">
            <nav className="mx-auto w-full max-w-6xl overflow-x-auto px-4 py-2">
              <div className="flex min-w-max items-center gap-2">
                {navItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      location === item.href || location.startsWith(`${item.href}/`)
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border/70 bg-background/80 text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 md:px-6 md:pt-12">{children}</main>

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
