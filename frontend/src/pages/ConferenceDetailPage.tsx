import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE_URL, fetchList, fetchOne } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import { formatDateRange, formatFormat } from "@/lib/format";
import type {
  Conference,
  EvaluationCriterion,
  Project,
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
  const [, params] = useRoute("/conferences/:id");
  const id = params?.id ? Number(params.id) : null;
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [conference, setConference] = useState<Conference | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [results, setResults] = useState<ProjectResult[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [criteriaMessage, setCriteriaMessage] = useState<string | null>(null);
  const [scoreMessage, setScoreMessage] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [criteriaForm, setCriteriaForm] = useState({
    name: "",
    description: "",
    maxScore: "10",
    stage: "online",
  });
  const [scoreForm, setScoreForm] = useState({
    projectId: "",
    criterionId: "",
    evaluatorId: "",
    score: "",
  });

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
        fetchList<Project>(`/api/conf/projects/`, controller.signal),
        fetchList<User>(`/api/users/users/`, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      if (tasks[0].status === "fulfilled") setCriteria(tasks[0].value);
      if (tasks[1].status === "fulfilled") setResults(tasks[1].value);
      if (tasks[2].status === "fulfilled") setProjects(tasks[2].value);
      if (tasks[3].status === "fulfilled") setUsers(tasks[3].value);
    };
    loadMeta();
    return () => controller.abort();
  }, [id]);

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

  const conferenceProjects = useMemo(() => {
    if (!projects.length) return [];
    return projects.filter(project => project.section?.conference?.id === id);
  }, [projects, id]);
  const expertUsers = useMemo(
    () => users.filter(user => (user.role?.code ?? "").toLowerCase() === "expert"),
    [users],
  );

  const submitCriterion = async () => {
    setCriteriaMessage(null);
    if (!id || !criteriaForm.name.trim()) return;
    const token = getAuthToken();
    if (!token) {
      setCriteriaMessage("Нужен токен для добавления критерия.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/criteria/`, {
      method: "POST",
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
    setCriteria(current => [created, ...current]);
    setCriteriaForm({ name: "", description: "", maxScore: "10", stage: "online" });
    setCriteriaMessage("Критерий добавлен.");
  };

  const submitScore = async () => {
    setScoreMessage(null);
    if (!scoreForm.projectId || !scoreForm.criterionId || !scoreForm.score) return;
    const token = getAuthToken();
    if (!token) {
      setScoreMessage("Нужен токен для сохранения оценки.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/scores/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        project_id: Number(scoreForm.projectId),
        criterion_id: Number(scoreForm.criterionId),
        evaluator_id: scoreForm.evaluatorId ? Number(scoreForm.evaluatorId) : null,
        score: Number(scoreForm.score),
      }),
    });
    if (!response.ok) {
      setScoreMessage("Не удалось сохранить оценку.");
      return;
    }
    setScoreForm({ projectId: "", criterionId: "", evaluatorId: "", score: "" });
    setScoreMessage("Оценка сохранена.");
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
        <Button variant="outline" asChild>
          <Link href="/conferences">Назад к списку</Link>
        </Button>
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
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Статус</p>
            <CardTitle className="text-lg">Подготовка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{state === "loading" ? "Загружаем данные…" : "Планируем приём заявок"}</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Секции готовы</span>
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">70%</span>
              </div>
              <div className="h-2 rounded-full bg-primary/20">
                <div className="h-full w-[70%] rounded-full bg-primary" />
              </div>
            </div>
            {isOrganizerRole ? (
              <Button className="w-full" variant="outline" asChild>
                <Link href="/conferences">Изменить в списке конференций</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Критерии оценки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {isOrganizerRole ? (
              <>
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
                      onChange={event =>
                        setCriteriaForm(current => ({ ...current, maxScore: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Описание</Label>
                    <Textarea
                      value={criteriaForm.description}
                      onChange={event =>
                        setCriteriaForm(current => ({ ...current, description: event.target.value }))
                      }
                      placeholder="Краткое описание"
                    />
                  </div>
                </div>
                {criteriaMessage ? <p>{criteriaMessage}</p> : null}
                <Button onClick={submitCriterion}>Добавить критерий</Button>
              </>
            ) : null}
            <div className="space-y-2">
              {criteria.length ? (
                criteria.map(criterion => (
                  <div key={criterion.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                    <p className="font-semibold text-foreground">{criterion.name}</p>
                    <p>Этап: {criterion.stage === "online" ? "заочный" : "очный"}</p>
                    <p>Максимум: {criterion.max_score}</p>
                  </div>
                ))
              ) : (
                <p>Критерии пока не заданы.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Оценка проекта</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <Label>Проект</Label>
              <Select
                value={scoreForm.projectId}
                onValueChange={value => setScoreForm(current => ({ ...current, projectId: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите проект" />
                </SelectTrigger>
                <SelectContent>
                  {conferenceProjects.length ? (
                    conferenceProjects.map(project => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.title}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="0" disabled>
                      Нет проектов
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Критерий</Label>
              <Select
                value={scoreForm.criterionId}
                onValueChange={value => setScoreForm(current => ({ ...current, criterionId: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите критерий" />
                </SelectTrigger>
                <SelectContent>
                  {criteria.length ? (
                    criteria.map(criterion => (
                      <SelectItem key={criterion.id} value={String(criterion.id)}>
                        {criterion.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="0" disabled>
                      Нет критериев
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Оценщик</Label>
              <Select
                value={scoreForm.evaluatorId}
                onValueChange={value => setScoreForm(current => ({ ...current, evaluatorId: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите пользователя" />
                </SelectTrigger>
                <SelectContent>
                  {expertUsers.length ? (
                    expertUsers.map(user => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.last_name} {user.first_name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="0" disabled>
                      Нет пользователей
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Баллы</Label>
              <Input
                type="number"
                value={scoreForm.score}
                onChange={event => setScoreForm(current => ({ ...current, score: event.target.value }))}
              />
            </div>
            {scoreMessage ? <p>{scoreMessage}</p> : null}
            <Button onClick={submitScore}>Сохранить оценку</Button>
          </CardContent>
        </Card>
      </div>

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
          {isOrganizerRole ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={runCalculation}>
                Рассчитать
              </Button>
              <Button variant="outline" onClick={() => downloadResults("csv")}>
                Экспорт CSV
              </Button>
              <Button variant="outline" onClick={() => downloadResults("xlsx")}>
                Экспорт Excel
              </Button>
              <Button variant="outline" onClick={openPrintProtocol}>
                Печать протокола
              </Button>
              <Button onClick={publishResults}>Опубликовать</Button>
            </div>
          ) : null}
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
