import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE_URL, fetchList, fetchOne } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import { formatDateRange, formatFormat } from "@/lib/format";
import { isStudentRole as checkStudentRole } from "@/lib/roles";
import type {
  Conference,
  ConferenceExpert,
  EvaluationCriterion,
  ProjectResult,
  Section,
  User,
} from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
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
  const id = params?.id ? Number(params.id) : null;
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [conference, setConference] = useState<Conference | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [results, setResults] = useState<ProjectResult[]>([]);
  const [criteriaMessage, setCriteriaMessage] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
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
        isOrganizerRole
          ? fetchList<ConferenceExpert>(`/api/conf/conference-experts/?conference=${id}`, controller.signal)
          : Promise.resolve([] as ConferenceExpert[]),
        isOrganizerRole ? fetchList<User>(`/api/users/users/`, controller.signal) : Promise.resolve([] as User[]),
      ]);
      if (controller.signal.aborted) return;
      if (tasks[0].status === "fulfilled") setCriteria(tasks[0].value);
      if (tasks[1].status === "fulfilled") setResults(tasks[1].value);
      if (tasks[2].status === "fulfilled") setConferenceExperts(tasks[2].value);
      if (tasks[3].status === "fulfilled") setExpertUsers(tasks[3].value);
    };
    loadMeta();
    return () => controller.abort();
  }, [id, isOrganizerRole]);

  const visibleConference = conference || null;
  const visibleSections = useMemo(() => {
    if (!sections.length) return [];
    return sections
      .filter(section => section.conference?.id === id)
      .slice(0, 6)
      .map(section => ({
        name: section.name,
        age: section.category?.name ?? "Категория не указана",
        format: section.conference?.title ?? "Конференция не указана",
      }));
  }, [sections, id]);
  const conferenceSections = useMemo(() => {
    if (!sections.length) return [];
    return sections.filter(section => section.conference?.id === id);
  }, [sections, id]);
  const CRITERIA_PER_PAGE = 8;
  const criteriaTotalPages = Math.max(1, Math.ceil(criteria.length / CRITERIA_PER_PAGE));
  const paginatedCriteria = useMemo(() => {
    const start = (criteriaPage - 1) * CRITERIA_PER_PAGE;
    return criteria.slice(start, start + CRITERIA_PER_PAGE);
  }, [criteria, criteriaPage]);
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

  const runCalculation = async () => {
    setResultMessage(null);
    const token = getAuthToken();
    if (!token) {
      setResultMessage("Нужен токен для расчёта результатов.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/conferences/${id}/calculate_results/`, {
      method: "POST",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setResultMessage("Не удалось рассчитать результаты.");
      return;
    }
    const updated = await fetchList<ProjectResult>(`/api/conf/results/?conference=${id}`);
    setResults(updated);
    setResultMessage("Результаты пересчитаны.");
  };

  const publishResults = async () => {
    setResultMessage(null);
    const token = getAuthToken();
    if (!token) {
      setResultMessage("Нужен токен для публикации результатов.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/conferences/${id}/publish_results/`, {
      method: "POST",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setResultMessage("Не удалось опубликовать результаты.");
      return;
    }
    if (conference) {
      setConference({ ...conference, results_published: true });
    }
    setResultMessage("Результаты опубликованы.");
  };

  const downloadResults = async (format: "csv" | "xlsx") => {
    setResultMessage(null);
    const token = getAuthToken();
    if (!token) {
      setResultMessage("Нужен токен для экспорта результатов.");
      return;
    }
    const endpoint =
      format === "csv" ? "export_results" : "export_results_excel";
    const response = await fetch(
      `${API_BASE_URL}/api/conf/conferences/${id}/${endpoint}/`,
      { headers: { Authorization: `Token ${token}` } }
    );
    if (!response.ok) {
      setResultMessage("Не удалось скачать файл.");
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conference_${id}_results.${format}`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const openPrintProtocol = async () => {
    setResultMessage(null);
    const token = getAuthToken();
    if (!token) {
      setResultMessage("Нужен токен для печати протокола.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/conferences/${id}/print_protocol/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setResultMessage("Не удалось открыть протокол.");
      return;
    }
    const html = await response.text();
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setResultMessage("Браузер заблокировал окно печати.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
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
              {(isOrganizerRole || isExpertRole || isTutorRole) ? (
                <Button variant="outline" asChild>
                  <Link href={`/conferences/${id}/comments`}>Комментарии</Link>
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
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Результаты</p>
            <CardTitle className="text-lg">Публикация и доступ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Статус: {conference?.results_published ? "опубликованы" : "черновик"}</p>
            <p>Опубликованные результаты видят участники, наставники и эксперты.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={runCalculation}>
                Пересчитать
              </Button>
              <Button onClick={publishResults}>Опубликовать</Button>
              <Button variant="outline" onClick={() => downloadResults("csv")}>
                Экспорт CSV
              </Button>
              <Button variant="outline" onClick={() => downloadResults("xlsx")}>
                Экспорт XLSX
              </Button>
              <Button variant="outline" onClick={openPrintProtocol}>
                Протокол
              </Button>
            </div>
            {resultMessage ? <p>{resultMessage}</p> : null}
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

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Проекты и результаты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {results.length ? (
              results.slice(0, 5).map(item => (
                <p key={item.id}>
                  {item.project.title}: {item.total_score} баллов, место {item.rank}
                </p>
              ))
            ) : (
              <p>Результаты будут доступны после расчёта.</p>
            )}
            <Button variant="outline" asChild>
              <Link href={id ? `/conferences/${id}/scores` : "/scores"}>Перейти к оценкам</Link>
            </Button>
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
            {conferenceExperts.length ? (
              conferenceExperts.map(item => (
                <div key={item.id} className="rounded-md border border-border/60 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        {item.expert?.last_name} {item.expert?.first_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Секции:{" "}
                        {item.sections?.length
                          ? item.sections.map(section => section.name).join(", ")
                          : "все секции"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingExpertId(item.id);
                          setExpertForm({
                            expertId: item.expert?.id ? String(item.expert.id) : "",
                            sectionIds: item.sections?.map(section => String(section.id)) ?? [],
                          });
                          setIsExpertModalOpen(true);
                        }}
                      >
                        Настроить
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => removeConferenceExpert(item.id)}>
                        Удалить
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p>Эксперты пока не приглашены.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Секции конференции</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {visibleSections.length ? (
            visibleSections.map(section => (
              <Card key={section.name} className="border-border/70 bg-card/80">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-lg">{section.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{section.age}</p>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
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
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Результаты</h2>
        </div>
        {resultMessage ? <p className="text-sm text-muted-foreground">{resultMessage}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          {results.length ? (
            results.map(result => (
              <Card key={result.id} className="border-border/70 bg-card/80">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-lg">{result.project.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{result.section.name}</p>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>Итог: {result.total_score}</p>
                  <p>Очный: {result.offline_score} | Заочный: {result.online_score}</p>
                  <p>Место: {result.rank}</p>
                  <p>
                    {result.is_winner ? "Победитель" : result.is_prize ? "Призёр" : "Участник"}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-border/70 bg-card/80">
              <CardContent className="p-6 text-sm text-muted-foreground">
                Результаты ещё не рассчитаны.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
