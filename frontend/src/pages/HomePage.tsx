import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthUserInfo } from "@/lib/auth";
import { isStudentRole as isStudentRoleCode, normalizeRoleCode } from "@/lib/roles";
import type { Conference, Section } from "@/lib/types";
import { useEffect, useState } from "react";
import { Link } from "wouter";

export function HomePage() {
  const authUser = getAuthUserInfo();
  const isGuest = !authUser?.id;
  const roleCode = normalizeRoleCode(authUser?.roleCode ?? "");
  const isStudentRole = isStudentRoleCode(roleCode);
  const isTutorRole = roleCode === "tutor";
  const isExpertRole = roleCode === "expert";
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [publicStats, setPublicStats] = useState<{
    conferences: number;
    sections: number;
    projects: number;
    participants: number;
    experts: number;
  } | null>(null);
  const roleContext =
    isStudentRole || isTutorRole
      ? {
          label: isTutorRole ? "Наставник" : "Участник",
          title: isTutorRole ? "Работа с проектами" : "Мои заявки",
          description: isTutorRole
            ? "Добавляйте и редактируйте проекты учеников."
            : "Создавайте и обновляйте проекты в личном кабинете.",
          actions: [{ label: "Открыть проекты", href: "/apply" }],
          primaryHref: "/apply",
          primaryLabel: "Мои проекты",
        }
      : isExpertRole
        ? {
            label: "Эксперт",
            title: "Проверка работ",
            description: "Скачивайте работы и выставляйте оценки по критериям.",
            actions: [
              { label: "Назначения", href: "/assignments" },
              { label: "Оценки", href: "/scores" },
              { label: "Комментарии", href: "/comments" },
            ],
            primaryHref: "/assignments",
            primaryLabel: "Мои назначения",
          }
        : roleCode === "organizer"
          ? {
              label: "Организатор",
              title: "Рабочая панель",
              description: "Управляйте конференциями, секциями и пользователями.",
              actions: [
                { label: "Конференции", href: "/conferences" },
                { label: "Секции", href: "/sections" },
                { label: "Пользователи", href: "/users" },
                { label: "Критерии", href: "/criteria" },
                { label: "Назначения", href: "/assignments" },
                { label: "Оценки", href: "/scores" },
              ],
              primaryHref: "/conferences",
              primaryLabel: "Конференции",
            }
          : null;

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const items = await fetchList<Conference>("/api/conf/conferences/", controller.signal);
        setConferences(items.slice(0, 6));
      } catch (error) {
        if (!controller.signal.aborted) setConferences([]);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadMeta = async () => {
      try {
        const items = await fetchList<Section>("/api/conf/sections/", controller.signal);
        setSections(items);
      } catch {
        setSections([]);
      }
    };

    loadMeta();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/conf/public-stats/`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          conferences?: number;
          sections?: number;
          projects?: number;
          participants?: number;
          experts?: number;
        };
        setPublicStats({
          conferences: data.conferences ?? 0,
          sections: data.sections ?? 0,
          projects: data.projects ?? 0,
          participants: data.participants ?? 0,
          experts: data.experts ?? 0,
        });
      } catch {
        setPublicStats(null);
      }
    };
    loadStats();
    return () => controller.abort();
  }, []);

  const stats = [
    {
      value: publicStats ? String(publicStats.conferences) : String(conferences.length),
      label: "Проведено конференций",
    },
    {
      value: publicStats ? String(publicStats.participants) : "—",
      label: "Участников",
    },
    {
      value: publicStats ? String(publicStats.projects) : "—",
      label: "Проектов",
    },
  ];

  return (
    <>
      <section className="grid gap-10 md:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground shadow-sm">
            projectaris
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-balance md:text-5xl">
            Projectaris помогает работать с конференциями, проектами и экспертизой в одном месте
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Участникам — быстрые заявки, наставникам — контроль проектов, экспертам — оценка, организаторам — управление процессом.
          </p>
          <div className="flex flex-wrap gap-3">
            {isGuest ? (
              <>
                <Button size="lg" asChild>
                  <Link href="/login">Войти</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/register">Регистрация</Link>
                </Button>
              </>
            ) : roleContext ? (
              <Button size="lg" asChild>
                <Link href={roleContext.primaryHref}>{roleContext.primaryLabel}</Link>
              </Button>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {stats.map(item => (
              <Card key={item.label} className="border-border/60 bg-card/80">
                <CardContent className="space-y-1 p-4">
                  <p className="text-2xl font-semibold">{item.value}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Статистика обновляется автоматически.</p>
        </div>

        <Card className="relative overflow-hidden border-border/70 bg-card/95 shadow-lg animate-rise">
          <div className="pointer-events-none absolute -right-20 -top-16 size-64 rounded-full bg-accent/30 blur-3xl opacity-70" />
          <div className="pointer-events-none absolute -bottom-24 -left-12 size-48 rounded-full bg-primary/15 blur-3xl opacity-70" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-background/10 to-background/40" />
          <CardHeader className="space-y-1 relative z-10">
            <CardTitle className="text-xl">{roleContext ? roleContext.title : "Начать работу"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {roleContext ? roleContext.description : "Создайте аккаунт или войдите, чтобы получить доступ к личному кабинету."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground relative z-10">
            {roleContext ? (
              <div className="grid gap-2">
                {roleContext.actions.map(action => (
                  <Button key={action.href} variant="outline" className="w-full" asChild>
                    <Link href={action.href}>{action.label}</Link>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="grid gap-2">
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/login">Войти</Link>
                </Button>
                <Button className="w-full" asChild>
                  <Link href="/register">Регистрация</Link>
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {roleContext ? "Функции доступны согласно вашей роли." : "Регистрация открывает доступ к личному кабинету."}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Участникам",
            text: "Подавайте проекты, прикрепляйте материалы и отслеживайте статус в личном кабинете.",
          },
          {
            title: "Наставникам",
            text: "Ведите проекты, оставляйте комментарии и сопровождайте авторов до защиты.",
          },
          {
            title: "Экспертам",
            text: "Работайте с назначениями, оценивайте по критериям и формируйте результаты.",
          },
        ].map(item => (
          <Card key={item.title} className="border-border/70 bg-card/85">
            <CardHeader>
              <CardTitle className="text-lg">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{item.text}</CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Единый кабинет",
            text: "Один интерфейс для всех ролей без лишних переключений и повторного ввода.",
          },
          {
            title: "Прозрачные этапы",
            text: "Понятная цепочка: подача → проверка → доработка → итоговый протокол.",
          },
          {
            title: "Контроль качества",
            text: "Критерии, оценки и комментарии собраны в одной карточке проекта.",
          },
        ].map(item => (
          <Card key={item.title} className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="text-lg">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{item.text}</CardContent>
          </Card>
        ))}
      </section>

    </>
  );
}
