import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE_URL } from "@/lib/api";
import { useEffect, useState } from "react";
import { Link } from "wouter";

export function HomePage() {
  const [publicStats, setPublicStats] = useState<{
    conferences: number;
    sections: number;
    projects: number;
    participants: number;
    experts: number;
  } | null>(null);

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
      value: publicStats ? String(publicStats.conferences) : "—",
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
            Для участников, наставников, экспертов и организаторов — единая платформа с понятными сценариями работы.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/login">Войти</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/register">Регистрация</Link>
            </Button>
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
            <CardTitle className="text-xl">Начать работу</CardTitle>
            <p className="text-sm text-muted-foreground">
              Зарегистрируйтесь или войдите, чтобы получить доступ к личному кабинету.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground relative z-10">
            <div className="grid gap-2">
              <Button className="w-full" variant="outline" asChild>
                <Link href="/login">Войти</Link>
              </Button>
              <Button className="w-full" asChild>
                <Link href="/register">Регистрация</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              После входа откроется раздел, доступный вашей роли.
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
