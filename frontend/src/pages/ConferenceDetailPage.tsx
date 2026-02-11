import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchList, fetchOne } from "@/lib/api";
import { getAuthUserInfo } from "@/lib/auth";
import { formatDateRange, formatFormat } from "@/lib/format";
import { useUserRole } from "@/lib/useUserRole";
import type { Conference, EvaluationCriterion, Project, ProjectResult, Section } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";

export function ConferenceDetailPage() {
  const authUser = getAuthUserInfo();
  const { isOrganizer, isExpert, isTutor, isStudent } = useUserRole(authUser?.roleCode);

  const [, params] = useRoute("/conferences/:id");
  const id = params?.id ? Number(params.id) : null;
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [conference, setConference] = useState<Conference | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [projectsCount, setProjectsCount] = useState(0);
  const [resultsCount, setResultsCount] = useState(0);

  const conferenceSections = useMemo(
    () => (id ? sections.filter(s => Number(s.conference?.id) === id) : []),
    [sections, id],
  );

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const load = async () => {
      setState("loading");
      const [confResult, sectionsResult] = await Promise.allSettled([
        fetchOne<Conference>(`/api/conf/conferences/${id}/`, controller.signal),
        fetchList<Section>("/api/conf/sections/", controller.signal),
      ]);
      if (controller.signal.aborted) return;
      if (confResult.status === "fulfilled") setConference(confResult.value);
      if (sectionsResult.status === "fulfilled") setSections(sectionsResult.value);
      setState(confResult.status === "fulfilled" ? "ready" : "error");
    };
    load();
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const load = async () => {
      const [criteriaRes, projectsRes, resultsRes] = await Promise.allSettled([
        fetchList<EvaluationCriterion>(`/api/conf/criteria/?conference=${id}`, controller.signal),
        fetchList<Project>(`/api/conf/projects/?section__conference=${id}`, controller.signal),
        fetchList<ProjectResult>(`/api/conf/results/?conference=${id}`, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      if (criteriaRes.status === "fulfilled") setCriteria(criteriaRes.value);
      if (projectsRes.status === "fulfilled") setProjectsCount(projectsRes.value.length);
      if (resultsRes.status === "fulfilled") setResultsCount(resultsRes.value.length);
    };
    load();
    return () => controller.abort();
  }, [id]);

  if (!id) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-6 text-sm text-muted-foreground">Некорректный идентификатор конференции.</CardContent>
      </Card>
    );
  }

  if (state === "ready" && !conference) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-6 text-sm text-muted-foreground">Конференция не найдена или доступ ограничен.</CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Конференция</p>
          <h1 className="text-2xl font-semibold">{conference?.title ?? "Конференция"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {conference ? formatDateRange(conference.start_date, conference.end_date) : "—"} · {conference ? formatFormat(conference) : "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOrganizer && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/conferences/${id}/projects`}>Заявки</Link>
            </Button>
          )}
          {(isTutor || isStudent) && (
            <Button size="sm" asChild>
              <Link href={`/conferences/${id}/projects?create=1`}>Подать заявку</Link>
            </Button>
          )}
          {isOrganizer && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/conferences/${id}/results`}>Результаты</Link>
            </Button>
          )}
          {(isOrganizer || isExpert) && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/conferences/${id}/assignments`}>Назначения</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/conferences/${id}/scores`}>Оценки</Link>
              </Button>
            </>
          )}
          {isOrganizer && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/conferences/${id}/edit`}>Редактировать</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/conferences">К списку</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">О конференции</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {conference?.description ? (
              <p className="text-foreground/90">{conference.description}</p>
            ) : (
              <p className="italic">Описание не заполнено.</p>
            )}
            {conference?.location && (
              <p><span className="text-muted-foreground">Место:</span> {conference.location}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Сводка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Секции ({conferenceSections.length})</p>
              {conferenceSections.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {conferenceSections.map(s => (
                    <li key={s.id} className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-xs">{s.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-xs">Секции не добавлены</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Критерии оценки ({criteria.length})</p>
              {criteria.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {criteria.map(c => (
                    <li key={c.id} className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-xs">{c.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-xs">Критерии не заданы</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Заявок: {projectsCount}
              {resultsCount > 0 && ` · С результатами: ${resultsCount}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {(isTutor || isStudent) && (
                <Button size="sm" asChild>
                  <Link href={`/conferences/${id}/projects?create=1`}>Подать заявку</Link>
                </Button>
              )}
              {isOrganizer && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/conferences/${id}/projects`}>К списку заявок</Link>
                </Button>
              )}
              {isOrganizer && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/conferences/${id}/results`}>Страница результатов</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
