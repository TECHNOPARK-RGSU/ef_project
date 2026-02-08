import { Button } from "@/components/ui/button";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { getRoleLabel, isStudentRole, normalizeRoleCode } from "@/lib/roles";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import projectarisLogo from "@/assets/projectaris-logo.svg";

type NavItem = { label: string; href: string };

function getNavItems(roleCode: string): NavItem[] {
  const normalizedRole = normalizeRoleCode(roleCode);
  if (normalizedRole === "organizer") {
    return [
      { label: "Главная", href: "/" },
      { label: "Конференции", href: "/conferences" },
    ];
  }
  if (normalizedRole === "expert" || normalizedRole === "tutor" || isStudentRole(normalizedRole)) {
    return [
      { label: "Главная", href: "/" },
      { label: "Конференции", href: "/conferences" },
    ];
  }
  return [{ label: "Главная", href: "/" }];
}

export function SiteLayout({ children, roleCode = "" }: { children: React.ReactNode; roleCode?: string }) {
  const [token, setToken] = useState(() => getAuthToken());
  const [location] = useLocation();
  const normalizedRole = normalizeRoleCode(roleCode);
  const navItems = getNavItems(normalizedRole);
  const roleLabel =
    normalizedRole === "organizer"
      ? "Организатор"
      : normalizedRole === "expert"
        ? "Эксперт"
        : normalizedRole === "tutor"
          ? "Наставник"
          : isStudentRole(normalizedRole)
            ? getRoleLabel({ code: normalizedRole, name: "Ученик" })
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
              <p className="text-base font-semibold md:text-lg">Projectaris</p>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground md:text-sm">
                платформа конференций
              </p>
            </div>
          </Link>
          {token ? (
            <nav className="hidden max-w-[60vw] items-center gap-4 overflow-x-auto whitespace-nowrap text-sm font-medium text-muted-foreground lg:flex">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 transition-colors hover:text-foreground ${
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
                ) : (
                  <Button asChild>
                    <Link href="/conferences">Конференции</Link>
                  </Button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                  <Link href="/login">Войти</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Регистрация</Link>
                </Button>
              </div>
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
          <p>Projectaris • Платформа конференций</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/policy" className="hover:text-foreground transition-colors">
              Политика
            </Link>
            <Link href="/contacts" className="hover:text-foreground transition-colors">
              Контакты
            </Link>
            <Link href="/documents" className="hover:text-foreground transition-colors">
              Документы
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
