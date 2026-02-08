import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import type {
  Conference,
  EvaluationCriterion,
  ExpertAssignment,
  ExpertAssignmentItem,
  ProjectScore,
} from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";

export function AssignmentsPage() {
  const [, paramsFromRoute] = useRoute("/conferences/:id/assignments");
  const conferenceIdFromRoute = paramsFromRoute?.id ? Number(paramsFromRoute.id) : null;
  const authUser = getAuthUserInfo();
  const roleCode = (authUser?.roleCode ?? "").toLowerCase();
  const isOrganizerRole = roleCode === "organizer";
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [assignments, setAssignments] = useState<ExpertAssignment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [conferenceFilter, setConferenceFilter] = useState("all");
  useEffect(() => {
    if (conferenceIdFromRoute != null) {
      setConferenceFilter(String(conferenceIdFromRoute));
      setForm(f => ({ ...f, conferenceId: String(conferenceIdFromRoute) }));
    }
  }, [conferenceIdFromRoute]);
  const [stageFilter, setStageFilter] = useState("all");
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const [assignmentItemsPage, setAssignmentItemsPage] = useState<Record<number, number>>({});
  const ASSIGNMENT_ITEMS_PER_PAGE = 10;
  const [form, setForm] = useState({
    conferenceId: "",
    stage: "online",
    perExpert: "3",
  });
  const [scores, setScores] = useState<ProjectScore[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [scoreModal, setScoreModal] = useState<{
    projectId: number;
    projectTitle: string;
    assignment: ExpertAssignment;
  } | null>(null);
  const [scoreForm, setScoreForm] = useState<Record<number, string>>({});
  const [scoreMessage, setScoreMessage] = useState<string | null>(null);

  const refreshAssignments = async () => {
    try {
      const items = await fetchList<ExpertAssignment>("/api/conf/assignments/");
      setAssignments(items);
    } catch {
      setAssignments([]);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const promises: Promise<unknown>[] = [
      fetchList<Conference>("/api/conf/conferences/", controller.signal),
      fetchList<ExpertAssignment>("/api/conf/assignments/", controller.signal),
    ];
    if (roleCode === "expert") {
      promises.push(
        fetchList<ProjectScore>("/api/conf/scores/", controller.signal),
        fetchList<EvaluationCriterion>("/api/conf/criteria/", controller.signal),
      );
    }
    Promise.allSettled(promises).then(results => {
      if (controller.signal.aborted) return;
      if (results[0].status === "fulfilled") setConferences(results[0].value as Conference[]);
      if (results[1].status === "fulfilled") setAssignments(results[1].value as ExpertAssignment[]);
      if (results[2]?.status === "fulfilled") setScores((results[2] as PromiseFulfilledResult<ProjectScore[]>).value);
      if (results[3]?.status === "fulfilled") setCriteria((results[3] as PromiseFulfilledResult<EvaluationCriterion[]>).value);
    });
    return () => controller.abort();
  }, [roleCode]);

  const isExpertRole = roleCode === "expert";
  const assignmentScoredCount = useMemo(() => {
    const map = new Map<number, number>();
    if (!authUser?.id) return map;
    const myScoresByProject = new Map<number, boolean>();
    scores.forEach(s => {
      if (s.evaluator?.id === authUser.id) myScoresByProject.set(s.project.id, true);
    });
    assignments.forEach(a => {
      const items = a.items ?? [];
      const n = items.filter(it => myScoresByProject.get(it.project.id)).length;
      map.set(a.id, n);
    });
    return map;
  }, [assignments, scores, authUser?.id]);
  const criteriaForAssignment = (assignment: ExpertAssignment) =>
    criteria.filter(
      c => c.conference?.id === assignment.conference.id && c.stage === assignment.stage,
    );
  const filteredAssignments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assignments.filter(item => {
      if (!isOrganizerRole && authUser?.id != null && item.expert?.id !== authUser.id) return false;
      if (conferenceFilter !== "all" && String(item.conference.id) !== conferenceFilter) return false;
      if (stageFilter !== "all" && item.stage !== stageFilter) return false;
      if (!needle) return true;
      const expertName = `${item.expert.last_name ?? ""} ${item.expert.first_name ?? ""}`.toLowerCase();
      return expertName.includes(needle) || item.conference.title.toLowerCase().includes(needle);
    });
  }, [assignments, conferenceFilter, query, stageFilter, isOrganizerRole, authUser?.id]);
  const perPage = 6;
  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / perPage));
  const paginatedAssignments = useMemo(() => {
    const start = (assignmentsPage - 1) * perPage;
    return filteredAssignments.slice(start, start + perPage);
  }, [assignmentsPage, filteredAssignments]);

  useEffect(() => {
    setAssignmentsPage(1);
  }, [query, conferenceFilter, stageFilter]);

  const assignProjects = async () => {
    setMessage(null);
    if (!form.conferenceId) {
      setMessage("Выберите конференцию.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(
      `${API_BASE_URL}/api/conf/conferences/${form.conferenceId}/assign_projects/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({
          stage: form.stage,
          per_expert: Number(form.perExpert),
        }),
      },
    );
    if (!response.ok) {
      setMessage("Не удалось распределить работы.");
      return;
    }
    const data = await response.json();
    setMessage(`Распределено: ${data.assigned}. Осталось: ${data.remaining}.`);
    await refreshAssignments();
  };

  const downloadZip = async (assignmentId: number) => {
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/assignments/${assignmentId}/download_zip/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage(response.status === 404 ? "В назначении нет файлов для скачивания." : "Не удалось скачать архив.");
      return;
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      setMessage("В назначении нет файлов для скачивания.");
      return;
    }
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `assignment_${assignmentId}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadProjectFile = async (projectId: number) => {
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/projects/${projectId}/download_file/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage("Не удалось скачать файл или у проекта нет файла.");
      return;
    }
    const blob = await response.blob();
    const disp = response.headers.get("Content-Disposition");
    const match = disp?.match(/filename="?([^";\n]+)"?/);
    const filename = match?.[1] ?? `project_${projectId}.bin`;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const openScoreModal = (item: ExpertAssignmentItem, assignment: ExpertAssignment) => {
    const projectId = item.project.id;
    const assignmentCriteria = criteriaForAssignment(assignment);
    const initial: Record<number, string> = {};
    assignmentCriteria.forEach(c => {
      const existing = scores.find(
        s => s.project.id === projectId && s.criterion.id === c.id && s.evaluator?.id === authUser?.id,
      );
      if (existing) initial[c.id] = String(existing.score);
      else initial[c.id] = "";
    });
    setScoreForm(initial);
    setScoreModal({ projectId, projectTitle: item.project.title, assignment });
    setScoreMessage(null);
  };

  const saveScores = async () => {
    if (!scoreModal || !getAuthToken()) return;
    setScoreMessage(null);
    const assignmentCriteria = criteriaForAssignment(scoreModal.assignment);
    for (const criterion of assignmentCriteria) {
      const value = scoreForm[criterion.id]?.trim();
      if (value === "") continue;
      const num = Number(value);
      if (Number.isNaN(num)) continue;
      const existing = scores.find(
        s =>
          s.project.id === scoreModal.projectId &&
          s.criterion.id === criterion.id &&
          s.evaluator?.id === authUser?.id,
      );
      const endpoint = existing ? `/api/conf/scores/${existing.id}/` : "/api/conf/scores/";
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${getAuthToken()}` },
        body: JSON.stringify({
          project_id: scoreModal.projectId,
          criterion_id: criterion.id,
          score: num,
        }),
      });
      if (!response.ok) {
        setScoreMessage("Не удалось сохранить оценку.");
        return;
      }
      const created = (await response.json()) as ProjectScore;
      setScores(prev => (existing ? prev.map(s => (s.id === existing.id ? created : s)) : [created, ...prev]));
    }
    setScoreMessage("Оценки сохранены.");
    setScoreModal(null);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">назначения</p>
          <h1 className="text-3xl font-semibold">{isOrganizerRole ? "Распределение работ" : "Мои назначения"}</h1>
        <p className="text-sm text-muted-foreground">
          {isOrganizerRole
            ? "Организатор распределяет проекты между экспертами."
            : "Здесь отображаются только ваши проекты на проверку."}
        </p>
        </div>
        {conferenceIdFromRoute != null ? (
          <Button variant="outline" asChild>
            <Link href={`/conferences/${conferenceIdFromRoute}`}>← К конференции</Link>
          </Button>
        ) : null}
      </div>

      {isOrganizerRole ? (
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Распределить автоматически</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
            <div className="space-y-2">
              <Label>Конференция</Label>
              {conferenceIdFromRoute != null ? (
                <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm">
                  {conferences.find(c => c.id === conferenceIdFromRoute)?.title ?? String(conferenceIdFromRoute)}
                </div>
              ) : (
                <Select value={form.conferenceId || undefined} onValueChange={value => setForm({ ...form, conferenceId: value })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите конференцию" />
                  </SelectTrigger>
                  <SelectContent>
                    {conferences.map(conf => (
                      <SelectItem key={conf.id} value={String(conf.id)}>
                        {conf.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Этап</Label>
              <Select value={form.stage} onValueChange={value => setForm({ ...form, stage: value })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Этап" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Заочный</SelectItem>
                  <SelectItem value="offline">Очный</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Работ на эксперта</Label>
              <Input
                type="number"
                min="1"
                value={form.perExpert}
                onChange={event => setForm({ ...form, perExpert: event.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={assignProjects}>Распределить</Button>
            </div>
            {message ? <p className="col-span-full">{message}</p> : null}
          </CardContent>
        </Card>
      ) : message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Поиск и фильтры</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <Label>Поиск</Label>
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Эксперт или конференция"
            />
          </div>
          <div className="space-y-2">
            <Label>Конференция</Label>
            {conferenceIdFromRoute != null ? (
              <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm">
                {conferences.find(c => c.id === conferenceIdFromRoute)?.title ?? String(conferenceIdFromRoute)}
              </div>
            ) : (
              <Select value={conferenceFilter} onValueChange={setConferenceFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Все конференции" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все конференции</SelectItem>
                  {conferences.map(conf => (
                    <SelectItem key={conf.id} value={String(conf.id)}>
                      {conf.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Этап</Label>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Все этапы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все этапы</SelectItem>
                <SelectItem value="online">Заочный</SelectItem>
                <SelectItem value="offline">Очный</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {paginatedAssignments.length ? (
          paginatedAssignments.map(assignment => {
            const items = assignment.items ?? [];
            const itemPage = assignmentItemsPage[assignment.id] ?? 1;
            const itemTotalPages = Math.max(1, Math.ceil(items.length / ASSIGNMENT_ITEMS_PER_PAGE));
            const start = (itemPage - 1) * ASSIGNMENT_ITEMS_PER_PAGE;
            const paginatedItems = items.slice(start, start + ASSIGNMENT_ITEMS_PER_PAGE);
            return (
              <Card key={assignment.id} className="border-border/70 bg-card/80">
                <CardHeader className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {isOrganizerRole ? `${assignment.expert.last_name} ${assignment.expert.first_name}` : assignment.conference.title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {isOrganizerRole
                          ? `${assignment.conference.title} · ${assignment.stage === "online" ? "заочный" : "очный"} · ${items.length} работ`
                          : `${assignment.stage === "online" ? "заочный" : "очный"} · ${items.length} работ`}
                        {isExpertRole ? ` · Оценено ${assignmentScoredCount.get(assignment.id) ?? 0} из ${items.length}` : null}
                      </p>
                      {isExpertRole && assignment.conference?.id ? (
                        <Link
                          href={`/conferences/${assignment.conference.id}/comments`}
                          className="text-xs text-primary hover:underline mt-1 inline-block"
                        >
                          Комментарии
                        </Link>
                      ) : null}
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => downloadZip(assignment.id)}>
                      ZIP
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="py-0">
                  {items.length ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                              <th className="py-1.5 pr-2">№</th>
                              <th className="py-1.5 pr-2">Проект</th>
                              <th className="py-1.5 pr-2">Секция</th>
                              {assignment.stage === "offline" ? <th className="py-1.5 pr-2">Аудитория</th> : null}
                              {(isExpertRole || isOrganizerRole) ? <th className="py-1.5">Действия</th> : null}
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedItems.map((item, idx) => (
                              <tr key={item.id} className="border-b border-border/40">
                                <td className="py-1.5 pr-2 text-muted-foreground">{start + idx + 1}</td>
                                <td className="py-1.5 pr-2 font-medium">{item.project.title}</td>
                                <td className="py-1.5 pr-2 text-muted-foreground">{item.project.section?.name || "—"}</td>
                                {assignment.stage === "offline" ? (
                                  <td className="py-1.5 pr-2 text-muted-foreground">{item.place?.name || "—"}</td>
                                ) : null}
                                {(isExpertRole || isOrganizerRole) ? (
                                  <td className="py-1.5">
                                    <div className="flex flex-wrap gap-1">
                                      {item.project.files ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs"
                                          onClick={() => downloadProjectFile(item.project.id)}
                                        >
                                          Скачать
                                        </Button>
                                      ) : null}
                                      {isExpertRole ? (
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          className="h-7 text-xs"
                                          onClick={() => openScoreModal(item, assignment)}
                                        >
                                          Оценить
                                        </Button>
                                      ) : null}
                                    </div>
                                  </td>
                                ) : null}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {items.length > ASSIGNMENT_ITEMS_PER_PAGE ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs text-muted-foreground">
                          <span>
                            Показано {start + 1}–{start + paginatedItems.length} из {items.length}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2"
                              disabled={itemPage <= 1}
                              onClick={() => setAssignmentItemsPage(prev => ({ ...prev, [assignment.id]: Math.max(1, itemPage - 1) }))}
                            >
                              ←
                            </Button>
                            <span>{itemPage} / {itemTotalPages}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2"
                              disabled={itemPage >= itemTotalPages}
                              onClick={() => setAssignmentItemsPage(prev => ({ ...prev, [assignment.id]: Math.min(itemTotalPages, itemPage + 1) }))}
                            >
                              →
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="py-2 text-sm text-muted-foreground">Работ пока нет.</p>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-border/70 bg-card/80">
            <CardContent className="p-6 text-sm text-muted-foreground">Назначений пока нет.</CardContent>
          </Card>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          Показано {paginatedAssignments.length} из {filteredAssignments.length}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={assignmentsPage <= 1}
            onClick={() => setAssignmentsPage(page => Math.max(1, page - 1))}
          >
            Назад
          </Button>
          <span>
            {assignmentsPage} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={assignmentsPage >= totalPages}
            onClick={() => setAssignmentsPage(page => Math.min(totalPages, page + 1))}
          >
            Вперёд
          </Button>
        </div>
      </div>

      {scoreModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg border-border/70 bg-card/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg">Оценка: {scoreModal.projectTitle}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setScoreModal(null)}>
                  Закрыть
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {criteriaForAssignment(scoreModal.assignment).length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет критериев для этого этапа конференции.</p>
              ) : (
                <div className="grid gap-3 text-sm">
                  {criteriaForAssignment(scoreModal.assignment).map(c => (
                    <div key={c.id} className="flex items-center gap-3">
                      <Label className="min-w-[140px] shrink-0">
                        {c.name} (макс. {c.max_score})
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={c.max_score}
                        className="w-24"
                        value={scoreForm[c.id] ?? ""}
                        onChange={e => setScoreForm(f => ({ ...f, [c.id]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}
              {scoreMessage ? <p className="text-sm text-muted-foreground">{scoreMessage}</p> : null}
              <div className="flex gap-2">
                <Button onClick={saveScores} disabled={criteriaForAssignment(scoreModal.assignment).length === 0}>
                  Сохранить оценки
                </Button>
                <Button variant="outline" onClick={() => setScoreModal(null)}>
                  Отмена
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
