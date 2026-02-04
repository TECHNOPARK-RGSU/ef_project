import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchList } from "@/lib/api";
import { getAuthUserInfo } from "@/lib/auth";
import { FEATURES, STEPS } from "@/lib/content";
import { formatDateRange, formatFormat } from "@/lib/format";
import type { Conference, ProjectStatus, Role, Section } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

const toTrackCards = (sections: Section[]) =>
  sections.slice(0, 3).map(section => ({
    name: section.name,
    age: section.category?.name ?? "Категория не указана",
    format: section.conference?.title ?? "Конференция не указана",
  }));

export function HomePage() {
  const authUser = getAuthUserInfo();
  const roleCode = (authUser?.roleCode ?? "").toLowerCase();
  const isStudentRole = roleCode === "student" || roleCode === "student2" || roleCode === "student3";
  const isTutorRole = roleCode === "tutor";
  const isExpertRole = roleCode === "expert";
  const [apiState, setApiState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [metaState, setMetaState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [selectedConference, setSelectedConference] = useState<Conference | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setApiState("loading");
      try {
        const items = await fetchList<Conference>("/api/conf/conferences/", controller.signal);
        setConferences(items.slice(0, 6));
        setApiState("ready");
      } catch (error) {
        if (!controller.signal.aborted) setApiState("error");
      }
    };

    load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadMeta = async () => {
      setMetaState("loading");
      const requests = [
        fetchList<Section>("/api/conf/sections/", controller.signal).then(setSections),
        fetchList<ProjectStatus>("/api/conf/project-statuses/", controller.signal).then(setStatuses),
        fetchList<Role>("/api/users/roles/", controller.signal).then(setRoles),
      ];

      const results = await Promise.allSettled(requests);
      if (controller.signal.aborted) return;
      setMetaState(results.some(result => result.status === "fulfilled") ? "ready" : "error");
    };

    loadMeta();
    return () => controller.abort();
  }, []);

  const visibleConferences = useMemo(() => conferences, [conferences]);
  const visibleTracks = useMemo(() => toTrackCards(sections), [sections]);
  const visibleStatuses = useMemo(() => statuses.slice(0, 4).map(item => item.name), [statuses]);
  const visibleRoles = useMemo(() => roles.map(role => `${role.name} — ${role.code}`), [roles]);

  useEffect(() => {
    if (!selectedConference && visibleConferences.length) {
      setSelectedConference(visibleConferences[0]);
    }
  }, [selectedConference, visibleConferences]);

  const stats = [
    { value: String(sections.length), label: "Секций" },
    { value: String(conferences.length), label: "Конференций" },
    { value: String(statuses.length), label: "Статусов проекта" },
  ];

  if (isStudentRole || isTutorRole) {
    return (
      <section className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {isTutorRole ? "наставник" : "участник"}
          </p>
          <h1 className="text-3xl font-semibold">
            {isTutorRole ? "Работа с проектами" : "Мои заявки"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isTutorRole
              ? "Добавляйте и редактируйте проекты учеников в одном разделе."
              : "Создавайте и обновляйте проекты в упрощенном интерфейсе."}
          </p>
        </div>
        <Card className="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle className="text-xl">Что делать дальше</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Перейдите в раздел «Мои проекты».</p>
            <p>2. Заполните форму и добавьте файл проекта.</p>
            <p>3. Проверяйте список сохраненных проектов справа.</p>
            <Button className="w-full sm:w-auto" asChild>
              <Link href="/apply">Открыть мои проекты</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (isExpertRole) {
    return (
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">эксперт</p>
          <h1 className="text-3xl font-semibold">Проверка работ</h1>
          <p className="text-sm text-muted-foreground">
            Откройте назначения, скачайте архив работ и выставляйте оценки по критериям.
          </p>
        </div>
        <Card className="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle className="text-xl">Быстрый старт</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Перейдите в «Назначения».</p>
            <p>2. Скачайте ZIP с работами по каждому назначению.</p>
            <p>3. Для очных этапов ориентируйтесь на аудиторию в карточке назначения.</p>
            <Button className="w-full sm:w-auto" asChild>
              <Link href="/assignments">Открыть назначения</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <>
      <section className="grid gap-10 md:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground shadow-sm">
            учебная платформа
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-balance md:text-5xl">
            Управляйте очными и заочными конференциями без лишних табличек
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Минимальный, понятный и аккуратный интерфейс для организаторов, участников и экспертов. Всё, что нужно для
            учебного проекта — и ничего лишнего.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/apply">Открыть приём заявок</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#events">К событиям</a>
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
        </div>

        <Card className="relative overflow-hidden border-border/70 bg-card/90 shadow-lg animate-rise">
          <div className="absolute -right-20 -top-16 size-64 rounded-full bg-accent/60 blur-3xl" />
          <div className="absolute -bottom-24 -left-12 size-48 rounded-full bg-primary/20 blur-3xl" />
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Ближайшая конференция</CardTitle>
            <p className="text-sm text-muted-foreground">Подготовка к весенней сессии</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">24–26 апреля</p>
              <p className="mt-2 text-lg font-semibold">Межвузовские дни науки</p>
              <p className="mt-2 text-sm text-muted-foreground">Очный формат + онлайн-доклады</p>
            </div>
            <div className="space-y-3">
              {["Открыть секции", "Назначить экспертов", "Сформировать протокол"].map(item => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-background/80 px-4 py-3 text-sm"
                >
                  <span>{item}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">готово</span>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/conferences">Перейти к настройкам</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-16 space-y-6" id="events">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">конференции</p>
            <h2 className="text-2xl font-semibold">Ближайшие события</h2>
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span
              className={`rounded-full px-3 py-1 ${apiState === "ready" ? "bg-primary/10 text-primary" : "bg-muted"}`}
            >
              {apiState === "ready" ? "данные загружены" : "нет данных"}
            </span>
            <Button variant="outline" asChild>
              <Link href="/conferences">Все конференции</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="grid gap-4 md:grid-cols-2">
            {apiState === "loading" && !conferences.length ? (
              <Card className="border-border/70 bg-card/80">
                <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
                  Загружаем список конференций…
                </CardContent>
              </Card>
            ) : visibleConferences.length ? (
              visibleConferences.map((conf, index) => (
                <Card
                  key={conf.id}
                  className={`border-border/70 bg-card/80 animate-rise ${
                    selectedConference?.id === conf.id ? "ring-1 ring-primary/40" : ""
                  }`}
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <CardHeader className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {formatDateRange(conf.start_date, conf.end_date)}
                    </p>
                    <CardTitle className="text-lg">{conf.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{conf.location || "Место уточняется"}</p>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{formatFormat(conf)}</span>
                    <Button size="sm" variant="secondary" onClick={() => setSelectedConference(conf)}>
                      Подробнее
                    </Button>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-border/70 bg-card/80">
                <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
                  Конференции пока не созданы.
                </CardContent>
              </Card>
            )}
          </div>
          <Card className="border-border/70 bg-card/85">
            <CardHeader className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">детали</p>
              <CardTitle className="text-xl">{selectedConference?.title ?? "Выберите конференцию"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              {selectedConference ? (
                <>
                  <div className="rounded-lg border border-border/60 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {formatDateRange(selectedConference.start_date, selectedConference.end_date)}
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {formatFormat(selectedConference)}
                    </p>
                    <p className="mt-2">{selectedConference.location || "Место уточняется"}</p>
                  </div>
                  <div className="space-y-2">
                    <p>Приём заявок открыт до окончания конференции.</p>
                    <p>Можно добавить секции и распределить экспертов.</p>
                  </div>
                  <Button className="w-full" asChild>
                    <Link href={`/conferences/${selectedConference.id}`}>Открыть карточку</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p>Нажмите «Подробнее» у нужного события.</p>
                  <Button className="w-full" disabled>
                    Открыть карточку
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-16 space-y-6" id="tracks">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">секции</p>
            <h2 className="text-2xl font-semibold">Шаблоны направлений</h2>
          </div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span
              className={`rounded-full px-3 py-1 ${metaState === "ready" ? "bg-primary/10 text-primary" : "bg-muted"}`}
            >
              {metaState === "ready" ? "данные загружены" : "нет данных"}
            </span>
            <Button variant="outline" asChild>
              <Link href="/sections">Добавить секцию</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {visibleTracks.length ? (
            visibleTracks.map((track, index) => (
              <Card
                key={track.name}
                className="border-border/70 bg-card/80 animate-rise"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <CardHeader className="space-y-3">
                  <CardTitle className="text-lg">{track.name}</CardTitle>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{track.age}</p>
                    <p>{track.format}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full" asChild>
                    <Link href="/sections">Открыть секцию</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-border/70 bg-card/80">
              <CardContent className="p-6 text-sm text-muted-foreground">
                Секций пока нет. Добавьте направления в разделе «Секции».
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-[0.9fr_1.1fr]" id="process">
        <Card className="border-border/70 bg-card/85 animate-rise">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">Что контролируем</CardTitle>
            <p className="text-sm text-muted-foreground">Структура понятна, роли разграничены.</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {FEATURES.map(feature => (
              <div key={feature.title} className="space-y-1 rounded-lg border border-border/60 bg-background/70 p-4">
                <p className="text-base font-semibold text-foreground">{feature.title}</p>
                <p>{feature.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {STEPS.map((step, index) => (
            <Card
              key={step.title}
              className="border-border/70 bg-card/80 animate-rise"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex size-11 items-center justify-center rounded-full border border-border/60 bg-background/80 text-sm font-semibold">
                  0{index + 1}
                </div>
                <div>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{step.text}</p>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-[1.1fr_0.9fr]" id="submit">
        <Card className="border-border/70 bg-card/85 animate-rise">
          <CardHeader>
            <CardTitle className="text-xl">Форма заявки (пример)</CardTitle>
            <p className="text-sm text-muted-foreground">Поля и структура перед заполнением в рабочем разделе.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project">Название проекта</Label>
                <Input id="project" placeholder="Например, Энергоэффективный кампус" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leader">Руководитель</Label>
                <Input id="leader" placeholder="Фамилия Имя" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Секция</Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите направление" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="science">Научные исследования</SelectItem>
                    <SelectItem value="engineering">Инженерные проекты</SelectItem>
                    <SelectItem value="humanities">Гуманитарные практики</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Формат</Label>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Очный или заочный" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">Очный</SelectItem>
                    <SelectItem value="online">Заочный</SelectItem>
                    <SelectItem value="hybrid">Гибридный</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Краткое описание</Label>
              <Textarea
                id="desc"
                placeholder="Опишите цель проекта и ожидаемый результат"
                className="min-h-[120px]"
              />
            </div>
            <Button className="w-full" asChild>
              <Link href="/apply">Перейти к заявке</Link>
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 bg-card/80 animate-floaty">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Статусы проекта</CardTitle>
              <span
                className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                  metaState === "ready" ? "bg-primary/10 text-primary" : "bg-muted"
                }`}
              >
                {metaState === "ready" ? "данные загружены" : "нет данных"}
              </span>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {visibleStatuses.length ? (
                visibleStatuses.map(status => (
                  <div key={status} className="flex items-center justify-between">
                    <span>{status}</span>
                    <span className="h-2 w-12 rounded-full bg-primary/30" />
                  </div>
                ))
              ) : (
                <p>Статусов пока нет.</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-border/70 bg-card/80">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Роли</CardTitle>
              <span
                className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                  metaState === "ready" ? "bg-primary/10 text-primary" : "bg-muted"
                }`}
              >
                {metaState === "ready" ? "данные загружены" : "нет данных"}
              </span>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {visibleRoles.length ? visibleRoles.map(role => <p key={role}>{role}</p>) : <p>Ролей пока нет.</p>}
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
