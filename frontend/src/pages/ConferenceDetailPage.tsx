import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE_URL, fetchList, fetchOne } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import { formatDateRange, formatFormat } from "@/lib/format";
import { isStudentRole as checkStudentRole } from "@/lib/roles";
import type {
  AgeCategory,
  Conference,
  ConferenceExpert,
  EvaluationCriterion,
  Project,
  ProjectResult,
  Section,
  User,
} from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ConferenceDetailPage() {
  const authUser = getAuthUserInfo();
  const roleCode = (authUser?.roleCode ?? "").toLowerCase();
  const isOrganizerRole = roleCode === "organizer";
  const isExpertRole = roleCode === "expert";
  const isTutorRole = roleCode === "tutor";
  const isStudentRole = checkStudentRole(roleCode);
  const [, params] = useRoute("/conferences/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? Number(params.id) : null;
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [conference, setConference] = useState<Conference | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [results, setResults] = useState<ProjectResult[]>([]);
  const [projectsForConference, setProjectsForConference] = useState<Project[]>([]);
  const [categories, setCategories] = useState<AgeCategory[]>([]);
  const [criteriaMessage, setCriteriaMessage] = useState<string | null>(null);
  const [conferenceExperts, setConferenceExperts] = useState<ConferenceExpert[]>([]);
  const [expertUsers, setExpertUsers] = useState<User[]>([]);
  const [isExpertModalOpen, setIsExpertModalOpen] = useState(false);
  const [editingExpertId, setEditingExpertId] = useState<number | null>(null);
  const [expertForm, setExpertForm] = useState<{ expertId: string; sectionIds: string[] }>({
    expertId: "",
    sectionIds: [],
  });
  const [criteriaForm, setCriteriaForm] = useState({
    name: "",
    description: "",
    maxScore: "10",
    stage: "online",
  });
  const [editingCriterionId, setEditingCriterionId] = useState<number | null>(null);
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [criteriaPage, setCriteriaPage] = useState(1);
  const [sectionsPage, setSectionsPage] = useState(1);
  const [expertsPage, setExpertsPage] = useState(1);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState({ name: "", categoryId: "" });
  const [sectionMessage, setSectionMessage] = useState<string | null>(null);
  const [leadersPage, setLeadersPage] = useState(1);

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

      if (confResult.status === "fulfilled") {
        setConference(confResult.value);
      }
      if (sectionsResult.status === "fulfilled") {
        setSections(sectionsResult.value);
      }

      setState(confResult.status === "fulfilled" ? "ready" : "error");
    };

    load();
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const loadMeta = async () => {
      const tasks = await Promise.allSettled([
        fetchList<EvaluationCriterion>(`/api/conf/criteria/?conference=${id}`, controller.signal),
        fetchList<ProjectResult>(`/api/conf/results/?conference=${id}`, controller.signal),
        fetchList<Project>(`/api/conf/projects/?section__conference=${id}`, controller.signal),
        isOrganizerRole
          ? fetchList<ConferenceExpert>(`/api/conf/conference-experts/?conference=${id}`, controller.signal)
          : Promise.resolve([] as ConferenceExpert[]),
        isOrganizerRole ? fetchList<User>(`/api/users/users/`, controller.signal) : Promise.resolve([] as User[]),
        isOrganizerRole ? fetchList<AgeCategory>("/api/conf/age-categories/", controller.signal) : Promise.resolve([] as AgeCategory[]),
      ]);
      if (controller.signal.aborted) return;
      if (tasks[0].status === "fulfilled") setCriteria(tasks[0].value);
      if (tasks[1].status === "fulfilled") setResults(tasks[1].value);
      if (tasks[2].status === "fulfilled") setProjectsForConference(tasks[2].value);
      if (tasks[3].status === "fulfilled") setConferenceExperts(tasks[3].value);
      if (tasks[4].status === "fulfilled") setExpertUsers(tasks[4].value);
      if (tasks[5].status === "fulfilled") setCategories(tasks[5].value);
    };
    loadMeta();
    return () => controller.abort();
  }, [id, isOrganizerRole]);

  const visibleConference = conference || null;
  const conferenceSections = useMemo(() => {
    if (!sections.length) return [];
    return sections.filter(section => section.conference?.id === id);
  }, [sections, id]);
  const sectionsForDisplay = useMemo(
    () =>
      conferenceSections.map(section => ({
        id: section.id,
        name: section.name,
        age: section.category?.name ?? "Категория не указана",
        format: section.conference?.title ?? "Конференция не указана",
      })),
    [conferenceSections],
  );
  const CRITERIA_PER_PAGE = 6;
  const SECTIONS_PER_PAGE = 6;
  const EXPERTS_PER_PAGE = 5;
  const LEADERS_PER_PAGE = 8;
  const criteriaTotalPages = Math.max(1, Math.ceil(criteria.length / CRITERIA_PER_PAGE));
  const paginatedCriteria = useMemo(() => {
    const start = (criteriaPage - 1) * CRITERIA_PER_PAGE;
    return criteria.slice(start, start + CRITERIA_PER_PAGE);
  }, [criteria, criteriaPage]);
  const sectionsTotalPages = Math.max(1, Math.ceil(sectionsForDisplay.length / SECTIONS_PER_PAGE));
  const paginatedSectionsForDisplay = useMemo(() => {
    const start = (sectionsPage - 1) * SECTIONS_PER_PAGE;
    return sectionsForDisplay.slice(start, start + SECTIONS_PER_PAGE);
  }, [sectionsForDisplay, sectionsPage]);
  const expertsTotalPages = Math.max(1, Math.ceil(conferenceExperts.length / EXPERTS_PER_PAGE));
  const paginatedExperts = useMemo(() => {
    const start = (expertsPage - 1) * EXPERTS_PER_PAGE;
    return conferenceExperts.slice(start, start + EXPERTS_PER_PAGE);
  }, [conferenceExperts, expertsPage]);
  const projectLeaders = useMemo(() => {
    const seen = new Set<number>();
    const list: User[] = [];
    for (const p of projectsForConference) {
      const leader = p.leader;
      if (leader?.id && !seen.has(leader.id)) {
        seen.add(leader.id);
        list.push(leader);
      }
    }
    return list;
  }, [projectsForConference]);
  const leadersTotalPages = Math.max(1, Math.ceil(projectLeaders.length / LEADERS_PER_PAGE));
  const paginatedLeaders = useMemo(() => {
    const start = (leadersPage - 1) * LEADERS_PER_PAGE;
    return projectLeaders.slice(start, start + LEADERS_PER_PAGE);
  }, [projectLeaders, leadersPage]);
  const availableExperts = useMemo(() => {
    return expertUsers.filter(user => (user.role?.code ?? "").toLowerCase() === "expert");
  }, [expertUsers]);
  const selectableExperts = useMemo(() => {
    const used = new Set(conferenceExperts.map(item => item.expert?.id).filter(Boolean) as number[]);
    return availableExperts.filter(user => !used.has(user.id) || String(user.id) === expertForm.expertId);
  }, [availableExperts, conferenceExperts, expertForm.expertId]);

  const submitCriterion = async () => {
    setCriteriaMessage(null);
    if (!id || !criteriaForm.name.trim()) return;
    const token = getAuthToken();
    if (!token) {
      setCriteriaMessage("Нужен токен для добавления критерия.");
      return;
    }
    const endpoint = editingCriterionId
      ? `/api/conf/criteria/${editingCriterionId}/`
      : "/api/conf/criteria/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: editingCriterionId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        conference_id: id,
        name: criteriaForm.name,
        description: criteriaForm.description,
        max_score: Number(criteriaForm.maxScore),
        stage: criteriaForm.stage,
      }),
    });
    if (!response.ok) {
      setCriteriaMessage("Не удалось добавить критерий.");
      return;
    }
    const created = (await response.json()) as EvaluationCriterion;
    setCriteria(current =>
      editingCriterionId
        ? current.map(item => (item.id === editingCriterionId ? created : item))
        : [created, ...current],
    );
    setCriteriaForm({ name: "", description: "", maxScore: "10", stage: "online" });
    setCriteriaMessage(editingCriterionId ? "Критерий обновлен." : "Критерий добавлен.");
    setEditingCriterionId(null);
    setIsCriteriaModalOpen(false);
  };

  const saveConferenceExpert = async () => {
    if (!id || !expertForm.expertId) return;
    const token = getAuthToken();
    if (!token) return;
    const endpoint = editingExpertId
      ? `/api/conf/conference-experts/${editingExpertId}/`
      : "/api/conf/conference-experts/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: editingExpertId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        conference_id: id,
        expert_id: Number(expertForm.expertId),
        section_ids: expertForm.sectionIds.map(idItem => Number(idItem)),
      }),
    });
    if (!response.ok) return;
    const updated = (await response.json()) as ConferenceExpert;
    setConferenceExperts(current =>
      editingExpertId ? current.map(item => (item.id === editingExpertId ? updated : item)) : [updated, ...current],
    );
    setEditingExpertId(null);
    setExpertForm({ expertId: "", sectionIds: [] });
    setIsExpertModalOpen(false);
  };

  const removeConferenceExpert = async (itemId: number) => {
    const token = getAuthToken();
    if (!token) return;
    const response = await fetch(`${API_BASE_URL}/api/conf/conference-experts/${itemId}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) return;
    setConferenceExperts(current => current.filter(item => item.id !== itemId));
  };

  const submitSection = async () => {
    setSectionMessage(null);
    if (!id || !sectionForm.name.trim()) return;
    const token = getAuthToken();
    if (!token) {
      setSectionMessage("Нужен токен для добавления секции.");
      return;
    }
    const body: { conference_id: number; name: string; category_id?: number } = {
      conference_id: id,
      name: sectionForm.name.trim(),
    };
    if (sectionForm.categoryId) body.category_id = Number(sectionForm.categoryId);
    const response = await fetch(`${API_BASE_URL}/api/conf/sections/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setSectionMessage("Не удалось добавить секцию.");
      return;
    }
    const updated = await fetchList<Section>("/api/conf/sections/");
    setSections(updated);
    setSectionForm({ name: "", categoryId: "" });
    setIsSectionModalOpen(false);
  };

  if (!id) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Некорректный идентификатор конференции.
        </CardContent>
      </Card>
    );
  }

  if (state === "ready" && !conference) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Конференция не найдена или доступ ограничен.
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">карточка конференции</p>
          <h1 className="text-3xl font-semibold">{visibleConference?.title ?? "Конференция"}</h1>
          <p className="text-sm text-muted-foreground">
            {visibleConference
              ? formatDateRange(visibleConference.start_date, visibleConference.end_date)
              : "Даты уточняются"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {id ? (
            <>
              {(isOrganizerRole || isTutorRole || isStudentRole) ? (
                <Button variant="outline" asChild>
                  <Link href={`/conferences/${id}/projects`}>Заявки</Link>
                </Button>
              ) : null}
              {isOrganizerRole ? (
                <Button variant="outline" asChild>
                  <Link href={`/conferences/${id}/results`}>Результаты</Link>
                </Button>
              ) : null}
              {(isOrganizerRole || isExpertRole) ? (
                <Button variant="outline" asChild>
                  <Link href={`/conferences/${id}/assignments`}>Назначения</Link>
                </Button>
              ) : null}
              {(isOrganizerRole || isExpertRole) ? (
                <Button variant="outline" asChild>
                  <Link href={`/conferences/${id}/scores`}>Оценки</Link>
                </Button>
              ) : null}
              {isOrganizerRole ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (id) {
                      try { sessionStorage.setItem("conferenceEditId", String(id)); } catch (_) {}
                      setLocation("/conferences");
                    }
                  }}
                >
                  Редактировать конференцию
                </Button>
              ) : null}
            </>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/conferences">Назад к списку</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Описание</p>
            <CardTitle className="text-lg">Детали конференции</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              {visibleConference?.description ||
                "Краткое описание появится после заполнения карточки организатором."}
            </p>
            <div className="rounded-lg border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Формат</p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {visibleConference ? formatFormat(visibleConference) : "Не определён"}
              </p>
              <p className="mt-2">
                {visibleConference?.location || "Место проведения уточняется"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/85">
          <CardHeader className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Заявки</p>
            <CardTitle className="text-lg">Проекты конференции</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Заявок: {projectsForConference.length}. С результатами: {results.length}.</p>
            <Button variant="outline" asChild>
              <Link href={`/conferences/${id}/projects`}>Перейти к заявкам</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg">Критерии оценки</CardTitle>
              {isOrganizerRole ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingCriterionId(null);
                    setCriteriaForm({ name: "", description: "", maxScore: "10", stage: "online" });
                    setIsCriteriaModalOpen(true);
                  }}
                >
                  Добавить
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              {paginatedCriteria.length ? (
                paginatedCriteria.map(criterion => (
                  <div key={criterion.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <p className="font-semibold text-foreground">{criterion.name}</p>
                    <p>Этап: {criterion.stage === "online" ? "заочный" : "очный"}</p>
                    <p>Максимум: {criterion.max_score}</p>
                    {isOrganizerRole ? (
                      <div className="pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingCriterionId(criterion.id);
                            setCriteriaForm({
                              name: criterion.name,
                              description: criterion.description ?? "",
                              maxScore: String(criterion.max_score),
                              stage: criterion.stage,
                            });
                            setIsCriteriaModalOpen(true);
                          }}
                        >
                          Редактировать
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p>Критерии пока не заданы.</p>
              )}
            </div>
            {criteria.length > CRITERIA_PER_PAGE ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-muted-foreground">
                <span>
                  Показано {paginatedCriteria.length} из {criteria.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={criteriaPage <= 1}
                    onClick={() => setCriteriaPage(p => Math.max(1, p - 1))}
                  >
                    Назад
                  </Button>
                  <span>
                    {criteriaPage} / {criteriaTotalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={criteriaPage >= criteriaTotalPages}
                    onClick={() => setCriteriaPage(p => Math.min(criteriaTotalPages, p + 1))}
                  >
                    Вперёд
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

      </div>

      {isCriteriaModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl border-border/70 bg-card/95">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">
                  {editingCriterionId ? "Редактирование критерия" : "Новый критерий"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Критерий будет доступен только для этой конференции.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsCriteriaModalOpen(false)}>
                Закрыть
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Критерий</Label>
                  <Input
                    value={criteriaForm.name}
                    onChange={event => setCriteriaForm(current => ({ ...current, name: event.target.value }))}
                    placeholder="Название критерия"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Этап</Label>
                  <Select
                    value={criteriaForm.stage}
                    onValueChange={value => setCriteriaForm(current => ({ ...current, stage: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Этап" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Заочный</SelectItem>
                      <SelectItem value="offline">Очный</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Максимум баллов</Label>
                  <Input
                    type="number"
                    value={criteriaForm.maxScore}
                    onChange={event => setCriteriaForm(current => ({ ...current, maxScore: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Описание</Label>
                  <Textarea
                    value={criteriaForm.description}
                    onChange={event => setCriteriaForm(current => ({ ...current, description: event.target.value }))}
                    placeholder="Краткое описание"
                  />
                </div>
              </div>
              {criteriaMessage ? <p>{criteriaMessage}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button onClick={submitCriterion}>
                  {editingCriterionId ? "Сохранить" : "Добавить критерий"}
                </Button>
                <Button variant="outline" onClick={() => setIsCriteriaModalOpen(false)}>
                  Отмена
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isExpertModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl border-border/70 bg-card/95">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">
                  {editingExpertId ? "Настройка эксперта" : "Добавить эксперта"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Выберите эксперта и секции, которые он может оценивать.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsExpertModalOpen(false)}>
                Закрыть
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="space-y-2">
                <Label>Эксперт</Label>
                <Select
                  value={expertForm.expertId || undefined}
                  onValueChange={value => setExpertForm(current => ({ ...current, expertId: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите эксперта" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableExperts.length ? (
                      selectableExperts.map(user => (
                        <SelectItem key={user.id} value={String(user.id)}>
                          {user.last_name} {user.first_name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="0" disabled>
                        Нет экспертов
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Секции</Label>
                <div className="grid gap-2">
                  {conferenceSections.length ? (
                    conferenceSections.map(section => (
                      <label key={section.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-background/70 p-2">
                        <input
                          type="checkbox"
                          checked={expertForm.sectionIds.includes(String(section.id))}
                          onChange={event => {
                            setExpertForm(current => {
                              const next = new Set(current.sectionIds);
                              if (event.target.checked) {
                                next.add(String(section.id));
                              } else {
                                next.delete(String(section.id));
                              }
                              return { ...current, sectionIds: Array.from(next) };
                            });
                          }}
                        />
                        <span>{section.name}</span>
                      </label>
                    ))
                  ) : (
                    <p>Секции конференции не найдены.</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Если секции не выбраны, эксперт видит все секции.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveConferenceExpert}>
                  {editingExpertId ? "Сохранить" : "Добавить"}
                </Button>
                <Button variant="outline" onClick={() => setIsExpertModalOpen(false)}>
                  Отмена
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isOrganizerRole ? (
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg">Эксперты конференции</CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setEditingExpertId(null);
                setExpertForm({ expertId: "", sectionIds: [] });
                setIsExpertModalOpen(true);
              }}
            >
              Добавить эксперта
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {paginatedExperts.length ? (
              paginatedExperts.map(item => (
                <div key={item.id} className="rounded-md border border-border/60 bg-background/70 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground text-sm">
                        {item.expert?.last_name} {item.expert?.first_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.sections?.length ? item.sections.map(s => s.name).join(", ") : "все секции"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingExpertId(item.id); setExpertForm({ expertId: item.expert?.id ? String(item.expert.id) : "", sectionIds: item.sections?.map(s => String(s.id)) ?? [] }); setIsExpertModalOpen(true); }}>
                        Настроить
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => removeConferenceExpert(item.id)}>Удалить</Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p>Эксперты пока не приглашены.</p>
            )}
            {conferenceExperts.length > EXPERTS_PER_PAGE ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                <span>Показано {paginatedExperts.length} из {conferenceExperts.length}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 px-2" disabled={expertsPage <= 1} onClick={() => setExpertsPage(p => Math.max(1, p - 1))}>←</Button>
                  <span>{expertsPage} / {expertsTotalPages}</span>
                  <Button size="sm" variant="outline" className="h-7 px-2" disabled={expertsPage >= expertsTotalPages} onClick={() => setExpertsPage(p => Math.min(expertsTotalPages, p + 1))}>→</Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Секции конференции</h2>
          {isOrganizerRole ? (
            <Button
              size="sm"
              onClick={() => {
                setSectionForm({ name: "", categoryId: "" });
                setSectionMessage(null);
                setIsSectionModalOpen(true);
              }}
            >
              Добавить секцию
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {paginatedSectionsForDisplay.length ? (
            paginatedSectionsForDisplay.map(section => (
              <Card key={section.id} className="border-border/70 bg-card/80">
                <CardHeader className="py-3">
                  <CardTitle className="text-base">{section.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{section.age}</p>
                </CardHeader>
                <CardContent className="py-0 text-sm text-muted-foreground">
                  <p>{section.format}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-border/70 bg-card/80">
              <CardContent className="p-6 text-sm text-muted-foreground">
                Секции пока не добавлены.
              </CardContent>
            </Card>
          )}
        </div>
        {sectionsForDisplay.length > SECTIONS_PER_PAGE ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Показано {paginatedSectionsForDisplay.length} из {sectionsForDisplay.length}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7" disabled={sectionsPage <= 1} onClick={() => setSectionsPage(p => Math.max(1, p - 1))}>Назад</Button>
              <span>{sectionsPage} / {sectionsTotalPages}</span>
              <Button size="sm" variant="outline" className="h-7" disabled={sectionsPage >= sectionsTotalPages} onClick={() => setSectionsPage(p => Math.min(sectionsTotalPages, p + 1))}>Вперёд</Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Результаты</h2>
        <Card className="border-border/70 bg-card/80">
          <CardContent className="p-6 text-sm text-muted-foreground">
            <p>Пересчёт, публикация, экспорт и протокол — на отдельной странице результатов.</p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href={id ? `/conferences/${id}/results` : "/conferences"}>Перейти к результатам</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {isOrganizerRole && projectLeaders.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Участники конференции</h2>
          <p className="text-sm text-muted-foreground">Руководители проектов (уникальные по заявкам)</p>
          <Card className="border-border/70 bg-card/80">
            <CardContent className="p-4 space-y-2 text-sm">
              {paginatedLeaders.map(leader => (
                <div key={leader.id} className="rounded-md border border-border/60 bg-background/70 px-3 py-2">
                  <span className="font-medium text-foreground">{leader.last_name} {leader.first_name}</span>
                  {leader.email ? <span className="text-muted-foreground"> · {leader.email}</span> : null}
                </div>
              ))}
              {projectLeaders.length > LEADERS_PER_PAGE ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
                  <span>Показано {paginatedLeaders.length} из {projectLeaders.length}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7" disabled={leadersPage <= 1} onClick={() => setLeadersPage(p => Math.max(1, p - 1))}>←</Button>
                    <span>{leadersPage} / {leadersTotalPages}</span>
                    <Button size="sm" variant="outline" className="h-7" disabled={leadersPage >= leadersTotalPages} onClick={() => setLeadersPage(p => Math.min(leadersTotalPages, p + 1))}>→</Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isSectionModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md border-border/70 bg-card/95">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle className="text-lg">Добавить секцию</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsSectionModalOpen(false)}>Закрыть</Button>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <Label>Название секции</Label>
                <Input
                  value={sectionForm.name}
                  onChange={e => setSectionForm(current => ({ ...current, name: e.target.value }))}
                  placeholder="Название"
                />
              </div>
              <div className="space-y-2">
                <Label>Возрастная категория</Label>
                <Select
                  value={sectionForm.categoryId || undefined}
                  onValueChange={v => setSectionForm(current => ({ ...current, categoryId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sectionMessage ? <p className="text-destructive">{sectionMessage}</p> : null}
              <div className="flex gap-2">
                <Button onClick={submitSection}>Добавить</Button>
                <Button variant="outline" onClick={() => setIsSectionModalOpen(false)}>Отмена</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
