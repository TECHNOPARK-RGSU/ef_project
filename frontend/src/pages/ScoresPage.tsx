import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import type { EvaluationCriterion, Project, ProjectScore, User } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";

export function ScoresPage() {
  const [, paramsFromRoute] = useRoute("/conferences/:id/scores");
  const conferenceIdFromRoute = paramsFromRoute?.id ? Number(paramsFromRoute.id) : null;
  const authUser = getAuthUserInfo();
  const roleCode = (authUser?.roleCode ?? "").toLowerCase();
  const isOrganizerRole = roleCode === "organizer";
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [scores, setScores] = useState<ProjectScore[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [conferenceFilter, setConferenceFilter] = useState("all");
  useEffect(() => {
    if (conferenceIdFromRoute != null) setConferenceFilter(String(conferenceIdFromRoute));
  }, [conferenceIdFromRoute]);
  const [sectionFilter, setSectionFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [evaluatorFilter, setEvaluatorFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    projectId: "",
    criterionId: "",
    evaluatorId: "none",
    score: "",
  });
  const expertUsers = useMemo(
    () => users.filter(user => (user.role?.code ?? "").toLowerCase() === "expert"),
    [users],
  );
  const selectedProject = useMemo(() => {
    if (!form.projectId) return null;
    return projects.find(project => String(project.id) === form.projectId) ?? null;
  }, [form.projectId, projects]);

  const availableCriteria = useMemo(() => {
    if (!selectedProject?.section?.conference?.id) return [];
    const conferenceId = selectedProject.section.conference.id;
    const unique = new Map<string, EvaluationCriterion>();
    criteria.forEach(item => {
      if (item.conference?.id !== conferenceId) return;
      const key = `${item.name.trim().toLowerCase()}-${item.stage}-${conferenceId}`;
      if (!unique.has(key)) unique.set(key, item);
    });
    return Array.from(unique.values());
  }, [criteria, selectedProject]);
  const conferenceOptions = useMemo(() => {
    const map = new Map<number, string>();
    projects.forEach(project => {
      const conf = project.section?.conference;
      if (conf?.id && conf.title) map.set(conf.id, conf.title);
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [projects]);
  const sectionOptions = useMemo(() => {
    const map = new Map<number, string>();
    projects.forEach(project => {
      const section = project.section;
      if (section?.id && section.name) map.set(section.id, section.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [projects]);
  const filteredScores = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scores.filter(score => {
      if (conferenceFilter !== "all" && String(score.project.section?.conference?.id) !== conferenceFilter)
        return false;
      if (sectionFilter !== "all" && String(score.project.section?.id) !== sectionFilter) return false;
      if (stageFilter !== "all" && score.criterion.stage !== stageFilter) return false;
      if (evaluatorFilter !== "all" && String(score.evaluator?.id ?? "") !== evaluatorFilter) return false;
      if (!needle) return true;
      return score.project.title.toLowerCase().includes(needle);
    });
  }, [conferenceFilter, evaluatorFilter, query, scores, sectionFilter, stageFilter]);
  const perPage = 8;
  const totalPages = Math.max(1, Math.ceil(filteredScores.length / perPage));
  const paginatedScores = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredScores.slice(start, start + perPage);
  }, [filteredScores, page]);

  useEffect(() => {
    setPage(1);
  }, [query, conferenceFilter, sectionFilter, stageFilter, evaluatorFilter]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetchList<EvaluationCriterion>("/api/conf/criteria/", controller.signal),
      fetchList<Project>("/api/conf/projects/", controller.signal),
      fetchList<User>("/api/users/users/", controller.signal),
      fetchList<ProjectScore>("/api/conf/scores/", controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return;
      if (results[0].status === "fulfilled") setCriteria(results[0].value);
      if (results[1].status === "fulfilled") setProjects(results[1].value);
      if (results[2].status === "fulfilled") setUsers(results[2].value);
      if (results[3].status === "fulfilled") setScores(results[3].value);
    });
    return () => controller.abort();
  }, []);

  const submitScore = async () => {
    setMessage(null);
    if (!form.projectId || !form.criterionId || !form.score) {
      setMessage("Заполните проект, критерий и баллы.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен эксперта или организатора.");
      return;
    }
    const endpoint = editingId ? `/api/conf/scores/${editingId}/` : "/api/conf/scores/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        project_id: Number(form.projectId),
        criterion_id: Number(form.criterionId),
        evaluator_id: isOrganizerRole
          ? (form.evaluatorId === "none" ? null : Number(form.evaluatorId))
          : (authUser?.id ?? null),
        score: Number(form.score),
      }),
    });
    if (!response.ok) {
      setMessage("Не удалось сохранить оценку.");
      return;
    }
    const created = (await response.json()) as ProjectScore;
    setScores(current =>
      editingId ? current.map(item => (item.id === editingId ? created : item)) : [created, ...current],
    );
    setForm({ projectId: "", criterionId: "", evaluatorId: "none", score: "" });
    setEditingId(null);
    setMessage(editingId ? "Оценка обновлена." : "Оценка сохранена.");
    setIsScoreModalOpen(false);
  };

  const startEdit = (score: ProjectScore) => {
    setEditingId(score.id);
    setForm({
      projectId: String(score.project.id),
      criterionId: String(score.criterion.id),
      evaluatorId: score.evaluator?.id ? String(score.evaluator.id) : "none",
      score: String(score.score),
    });
    setIsScoreModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ projectId: "", criterionId: "", evaluatorId: "none", score: "" });
    setIsScoreModalOpen(false);
  };

  const openCreateScore = () => {
    setEditingId(null);
    setForm({ projectId: "", criterionId: "", evaluatorId: "none", score: "" });
    setMessage(null);
    setIsScoreModalOpen(true);
  };

  const deleteScore = async (id: number) => {
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен эксперта или организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/scores/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage("Не удалось удалить оценку.");
      return;
    }
    setScores(current => current.filter(item => item.id !== id));
    if (editingId === id) cancelEdit();
    setMessage("Оценка удалена.");
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">оценки</p>
          <h1 className="text-3xl font-semibold">Оценки проектов</h1>
        </div>
        <div className="flex items-center gap-2">
          {conferenceIdFromRoute != null ? (
            <Button variant="outline" asChild>
              <Link href={`/conferences/${conferenceIdFromRoute}`}>← К конференции</Link>
            </Button>
          ) : null}
          <Button onClick={openCreateScore}>Создать оценку</Button>
        </div>
      </div>

      {isScoreModalOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-3xl border-border/70 bg-card/95">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">
              {editingId ? "Редактирование оценки" : "Новая оценка"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              Закрыть
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <Label>Проект</Label>
            <Select
              value={form.projectId || undefined}
              onValueChange={value => setForm({ ...form, projectId: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите проект" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Критерий</Label>
            {!selectedProject ? (
              <p className="text-xs text-muted-foreground">Сначала выберите проект</p>
            ) : (
              <Select
                value={form.criterionId || undefined}
                onValueChange={value => setForm({ ...form, criterionId: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите критерий" />
                </SelectTrigger>
                <SelectContent>
                  {availableCriteria.length ? (
                    availableCriteria.map(item => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="0" disabled>
                      Нет критериев для этой работы
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
          {isOrganizerRole ? (
            <div className="space-y-2">
              <Label>Оценщик</Label>
              <Select value={form.evaluatorId} onValueChange={value => setForm({ ...form, evaluatorId: value })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Опционально" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без оценщика</SelectItem>
                  {expertUsers.map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.last_name} {user.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Баллы</Label>
            <Input
              type="number"
              value={form.score}
              onChange={e => setForm({ ...form, score: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Button onClick={submitScore}>{editingId ? "Сохранить" : "Создать"}</Button>
              {editingId ? (
                <Button variant="outline" onClick={cancelEdit}>
                  Отмена
                </Button>
              ) : null}
            </div>
          </div>
          {message ? <p className="col-span-full">{message}</p> : null}
        </CardContent>
      </Card>
      </div>
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
              placeholder="Название проекта"
            />
          </div>
          <div className="space-y-2">
            <Label>Конференция</Label>
            {conferenceIdFromRoute != null ? (
              <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm">
                {conferenceOptions.find(c => c.id === conferenceIdFromRoute)?.title ?? String(conferenceIdFromRoute)}
              </div>
            ) : (
              <Select value={conferenceFilter} onValueChange={setConferenceFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Все конференции" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все конференции</SelectItem>
                  {conferenceOptions.map(conf => (
                    <SelectItem key={conf.id} value={String(conf.id)}>
                      {conf.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Секция</Label>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Все секции" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все секции</SelectItem>
                {sectionOptions.map(section => (
                  <SelectItem key={section.id} value={String(section.id)}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          {isOrganizerRole ? (
            <div className="space-y-2">
              <Label>Оценщик</Label>
              <Select value={evaluatorFilter} onValueChange={setEvaluatorFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Все эксперты" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все эксперты</SelectItem>
                  {expertUsers.map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.last_name} {user.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {paginatedScores.length ? (
          paginatedScores.map(score => (
            <Card key={score.id} className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="text-lg">{score.project.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>Критерий: {score.criterion.name}</p>
                <p>Этап: {score.criterion.stage === "online" ? "заочный" : "очный"}</p>
                <p>Секция: {score.project.section?.name || "—"}</p>
                <p>Оценщик: {score.evaluator ? `${score.evaluator.last_name} ${score.evaluator.first_name}` : "—"}</p>
                <p>Баллы: {score.score}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(score)}>
                    Редактировать
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteScore(score.id)}>
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-border/70 bg-card/80">
            <CardContent className="p-6 text-sm text-muted-foreground">Оценок пока нет.</CardContent>
          </Card>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          Показано {paginatedScores.length} из {filteredScores.length}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            Назад
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Вперёд
          </Button>
        </div>
      </div>
    </section>
  );
}
