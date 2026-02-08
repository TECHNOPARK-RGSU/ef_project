import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchList, fetchOne } from "@/lib/api";
import { getAuthUserInfo } from "@/lib/auth";
import { formatDateRange, formatFormat } from "@/lib/format";
import { isStudentRole as checkStudentRole } from "@/lib/roles";
import type { Conference, EvaluationCriterion, Project, ProjectResult, Section } from "@/lib/types";
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";

export function ConferenceDetailPage() {
  const roleCode = (getAuthUserInfo()?.roleCode ?? "").toLowerCase();
  const isOrganizer = roleCode === "organizer";
  const isExpert = roleCode === "expert";
  const isTutor = roleCode === "tutor";
  const isStudent = checkStudentRole(roleCode);

  const [, params] = useRoute("/conferences/:id");
  const id = params?.id ? Number(params.id) : null;
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [conference, setConference] = useState<Conference | null>(null);
  const [sectionsCount, setSectionsCount] = useState(0);
  const [criteriaCount, setCriteriaCount] = useState(0);
  const [projectsCount, setProjectsCount] = useState(0);
  const [resultsCount, setResultsCount] = useState(0);

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
      if (sectionsResult.status === "fulfilled") {
        const list = sectionsResult.value.filter((s: Section) => s.conference?.id === id);
        setSectionsCount(list.length);
      }
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
      if (criteriaRes.status === "fulfilled") setCriteriaCount(criteriaRes.value.length);
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
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{conference?.title ?? "Конференция"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {(isOrganizer || isTutor || isStudent) && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/conferences/${id}/projects`}>Заявки</Link>
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

      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-5 space-y-4 text-sm text-muted-foreground">
          <p>
            {conference ? formatDateRange(conference.start_date, conference.end_date) : "—"} · {conference ? formatFormat(conference) : "—"}
            {conference?.location && ` · ${conference.location}`}
          </p>
          {conference?.description && <p className="text-foreground/90">{conference.description}</p>}
          <p className="text-xs text-muted-foreground">
            Секций: {sectionsCount} · Критериев: {criteriaCount} · Заявок: {projectsCount}
            {resultsCount > 0 && ` · С результатами: ${resultsCount}`}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/conferences/${id}/projects`}>Перейти к заявкам</Link>
            </Button>
            {isOrganizer && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/conferences/${id}/results`}>Страница результатов</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
