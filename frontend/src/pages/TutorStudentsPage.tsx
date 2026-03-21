import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, fetchList, fetchPage } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import type {
  Comment,
  Conference,
  ParticipationStage,
  PresentationType,
  Project,
  ProjectStatus,
  Section,
  StudentTeam,
  User,
} from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 10;

export function TutorStudentsPage() {
  const authUser = getAuthUserInfo();
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [projects, setProjects] = useState<Project[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [conferenceFilter, setConferenceFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sections, setSections] = useState<Section[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [stages, setStages] = useState<ParticipationStage[]>([]);
  const [presentationTypes, setPresentationTypes] = useState<PresentationType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [teams, setTeams] = useState<StudentTeam[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");
  const [form, setForm] = useState({
    title: "",
    description: "",
    additionalInfo: "",
    leaderId: "",
    member1Id: "none",
    member2Id: "none",
    sectionId: "",
    statusId: "",
    stageId: "",
    presentationTypeId: "",
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentMessage, setCommentMessage] = useState<string | null>(null);
  const [teamForm, setTeamForm] = useState({
    name: "",
    memberEmails: "",
  });
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [teamMessage, setTeamMessage] = useState<string | null>(null);
  const [savingTeam, setSavingTeam] = useState(false);

  const studentUsers = useMemo(
    () => users.filter(u => ((u.role?.code ?? "").toLowerCase() === "student")),
    [users],
  );

  const sectionsForConference = useMemo(() => {
    if (conferenceFilter === "all") return sections;
    return sections.filter(s => String(s.conference?.id) === conferenceFilter);
  }, [sections, conferenceFilter]);

  const loadProjects = async (pageNum: number) => {
    setState("loading");
    try {
      const params: Record<string, string | number> = {
        page: pageNum,
        page_size: PAGE_SIZE,
        ordering: "-created_at",
      };
      if (search.trim()) params.search = search.trim();
      if (sectionFilter !== "all") params.section = sectionFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      if (conferenceFilter !== "all") params.section__conference = conferenceFilter;
      const { results, count } = await fetchPage<Project>("/api/conf/projects/", params);
      setProjects(results);
      setTotalCount(count);
      setState("ready");
    } catch {
      setProjects([]);
      setTotalCount(0);
      setState("error");
    }
  };

  useEffect(() => {
    loadProjects(page);
  }, [page]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchList<Section>("/api/conf/sections/", controller.signal).then(setSections),
      fetchList<Conference>("/api/conf/conferences/", controller.signal).then(setConferences),
      fetchList<ProjectStatus>("/api/conf/project-statuses/", controller.signal).then(setStatuses),
      fetchList<ParticipationStage>("/api/conf/participation-stages/", controller.signal).then(setStages),
      fetchList<PresentationType>("/api/conf/presentation-types/", controller.signal).then(setPresentationTypes),
      fetchList<User>("/api/users/users/", controller.signal).then(setUsers),
      fetchList<Comment>("/api/conf/comments/", controller.signal).then(setComments),
      fetchList<StudentTeam>("/api/users/student-teams/", controller.signal).then(setTeams),
    ]).catch(() => {});
    return () => controller.abort();
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const applyFilters = () => {
    setPage(1);
    loadProjects(1);
  };

  const resetTeamForm = () => {
    setTeamForm({
      name: "",
      memberEmails: "",
    });
    setEditingTeamId(null);
    setTeamMessage(null);
  };

  const editTeam = (team: StudentTeam) => {
    setEditingTeamId(team.id);
    setTeamForm({
      name: team.name,
      memberEmails: (team.members ?? [])
        .map(member => member.email ?? "")
        .filter(Boolean)
        .join("\n"),
    });
    setTeamMessage(null);
  };

  const saveTeam = async () => {
    const token = getAuthToken();
    if (!token) {
      setTeamMessage("Нужна авторизация.");
      return;
    }
    const emails = Array.from(
      new Set(
        teamForm.memberEmails
          .split(/[\n,;]+/)
          .map(value => value.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    if (!teamForm.name.trim()) {
      setTeamMessage("Укажите название команды.");
      return;
    }
    if (emails.length === 0) {
      setTeamMessage("Добавьте хотя бы один email ученика.");
      return;
    }
    setSavingTeam(true);
    setTeamMessage(null);
    try {
      const url = editingTeamId
        ? `${API_BASE_URL}/api/users/student-teams/${editingTeamId}/`
        : `${API_BASE_URL}/api/users/student-teams/`;
      const response = await fetch(url, {
        method: editingTeamId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify({
          name: teamForm.name.trim(),
          member_emails: emails,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as StudentTeam & {
        detail?: string;
        member_emails?: string[];
        name?: string[];
      };
      if (!response.ok) {
        const fallback =
          payload.detail
          ?? (Array.isArray(payload.name) ? payload.name[0] : undefined)
          ?? "Не удалось сохранить команду.";
        setTeamMessage(fallback);
        return;
      }

      setTeams(current => {
        if (editingTeamId) {
          return current.map(item => (item.id === payload.id ? payload : item));
        }
        return [payload, ...current];
      });
      resetTeamForm();
      setTeamMessage(editingTeamId ? "Команда обновлена." : "Команда создана.");
    } catch {
      setTeamMessage("Не удалось сохранить команду.");
    } finally {
      setSavingTeam(false);
    }
  };

  const archiveTeam = async (teamId: number) => {
    const token = getAuthToken();
    if (!token) {
      setTeamMessage("Нужна авторизация.");
      return;
    }
    if (!window.confirm("Удалить команду? Состав можно будет восстановить только вручную.")) return;
    setTeamMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/student-teams/${teamId}/`, {
        method: "DELETE",
        headers: { Authorization: `Token ${token}` },
      });
      if (!response.ok) {
        setTeamMessage("Не удалось удалить команду.");
        return;
      }
      setTeams(current => current.filter(team => team.id !== teamId));
      if (editingTeamId === teamId) resetTeamForm();
      setTeamMessage("Команда удалена.");
    } catch {
      setTeamMessage("Не удалось удалить команду.");
    }
  };

  const openProject = (project: Project) => {
    setSelectedProject(project);
    setModalMode("view");
    setForm({
      title: project.title,
      description: project.description ?? "",
      additionalInfo: project.additional_info ?? "",
      leaderId: project.leader?.id ? String(project.leader.id) : "",
      member1Id: project.members?.[0]?.id ? String(project.members[0].id) : "none",
      member2Id: project.members?.[1]?.id ? String(project.members[1].id) : "none",
      sectionId: project.section?.id ? String(project.section.id) : "",
      statusId: project.status?.id ? String(project.status.id) : "",
      stageId: project.stage?.id ? String(project.stage.id) : "",
      presentationTypeId: project.presentation_type?.id ? String(project.presentation_type.id) : "",
    });
    setSaveMessage(null);
    setCommentText("");
    setCommentMessage(null);
  };

  const closeModal = () => {
    setSelectedProject(null);
    setModalMode("view");
  };

  const saveProject = async () => {
    if (!selectedProject) return;
    setSaveMessage(null);
    const token = getAuthToken();
    if (!token) {
      setSaveMessage("Нужна авторизация.");
      return;
    }
    const leaderId = Number(form.leaderId);
    const memberIds = [form.member1Id, form.member2Id]
      .filter(v => v && v !== "none")
      .map(Number)
      .filter(id => id !== leaderId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/conf/projects/${selectedProject.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          additional_info: form.additionalInfo,
          leader_id: leaderId,
          member_ids: memberIds,
          section_id: form.sectionId ? Number(form.sectionId) : null,
          status_id: form.statusId ? Number(form.statusId) : null,
          stage_id: form.stageId ? Number(form.stageId) : null,
          presentation_type_id: form.presentationTypeId ? Number(form.presentationTypeId) : null,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setSaveMessage(typeof data.detail === "string" ? data.detail : "Не удалось сохранить.");
        return;
      }
      const updated = (await response.json()) as Project;
      setProjects(prev => prev.map(p => (p.id === updated.id ? updated : p)));
      setSelectedProject(updated);
      setModalMode("view");
      setSaveMessage("Проект сохранён.");
    } catch {
      setSaveMessage("Не удалось сохранить.");
    }
  };

  const projectComments = useMemo(() => {
    if (!selectedProject) return [];
    return comments.filter(c => c.project?.id === selectedProject.id);
  }, [comments, selectedProject]);

  const submitComment = async () => {
    if (!selectedProject || !commentText.trim()) return;
    setCommentMessage(null);
    const token = getAuthToken();
    if (!token) {
      setCommentMessage("Нужна авторизация.");
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/conf/comments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({ project_id: selectedProject.id, text: commentText.trim() }),
      });
      if (!response.ok) {
        setCommentMessage("Не удалось отправить комментарий.");
        return;
      }
      const created = (await response.json()) as Comment;
      setComments(prev => [created, ...prev]);
      setCommentText("");
      setCommentMessage("Комментарий добавлен.");
    } catch {
      setCommentMessage("Не удалось отправить комментарий.");
    }
  };

  const availableSections = useMemo(() => {
    if (!form.sectionId) return sectionsForConference;
    const section = sections.find(s => String(s.id) === form.sectionId);
    if (!section?.conference?.id) return sectionsForConference;
    return sections.filter(s => s.conference?.id === section.conference?.id);
  }, [sections, sectionsForConference, form.sectionId]);

  if (!authUser || (authUser.roleCode ?? "").toLowerCase() !== "tutor") {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Доступ только для наставников.
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">наставник</p>
        <h1 className="text-3xl font-semibold">Мои ученики</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Проекты учеников, которых вы курируете. Просмотр, редактирование и комментарии.
        </p>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Команды учеников</CardTitle>
          <p className="text-sm text-muted-foreground">
            Наставник собирает команды по email. В команде может быть до 3 учеников.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="space-y-3 rounded-lg border border-border/60 p-4">
              <div className="space-y-2">
                <Label>Название команды</Label>
                <Input
                  value={teamForm.name}
                  onChange={event => setTeamForm(current => ({ ...current, name: event.target.value }))}
                  placeholder="Например, RoboLab 9А"
                />
              </div>
              <div className="space-y-2">
                <Label>Email учеников</Label>
                <Textarea
                  value={teamForm.memberEmails}
                  onChange={event =>
                    setTeamForm(current => ({ ...current, memberEmails: event.target.value }))
                  }
                  className="min-h-[140px]"
                  placeholder={"student01@example.com\nstudent02@example.com"}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveTeam} disabled={savingTeam}>
                  {savingTeam ? "Сохранение..." : editingTeamId ? "Сохранить команду" : "Создать команду"}
                </Button>
                {editingTeamId ? (
                  <Button variant="outline" onClick={resetTeamForm}>
                    Отмена
                  </Button>
                ) : null}
              </div>
              {teamMessage ? <p className="text-sm text-muted-foreground">{teamMessage}</p> : null}
            </div>

            <div className="space-y-3">
              {teams.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                  Команд пока нет. Создайте первую команду, и ученики смогут выбирать ее при подаче заявки.
                </p>
              ) : (
                teams.map(team => (
                  <div key={team.id} className="rounded-lg border border-border/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{team.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Учеников: {team.members?.length ?? 0}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {(team.members ?? [])
                            .map(member => {
                              const userName = `${member.last_name ?? ""} ${member.first_name ?? ""}`.trim();
                              return `${userName || member.email} (${member.email ?? "без email"})`;
                            })
                            .join(", ") || "Состав не заполнен"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => editTeam(team)}>
                          Изменить
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => archiveTeam(team.id)}>
                          Удалить
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Поиск и фильтры</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label>Поиск по названию</Label>
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Название проекта"
              onKeyDown={e => e.key === "Enter" && applyFilters()}
            />
          </div>
          <div className="space-y-2">
            <Label>Конференция</Label>
            <Select value={conferenceFilter} onValueChange={setConferenceFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все конференции</SelectItem>
                {conferences.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Секция</Label>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все секции</SelectItem>
                {sectionsForConference.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Статус</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {statuses.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={applyFilters}>Применить</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Проекты</CardTitle>
          <p className="text-sm text-muted-foreground">
            Всего: {totalCount}. Страница {page} из {totalPages}.
          </p>
        </CardHeader>
        <CardContent>
          {state === "loading" && (
            <p className="py-4 text-sm text-muted-foreground">Загрузка…</p>
          )}
          {state === "error" && (
            <p className="py-4 text-sm text-destructive">Не удалось загрузить список.</p>
          )}
          {state === "ready" && projects.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Проектов не найдено.</p>
          )}
          {state === "ready" && projects.length > 0 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map(project => (
                  <Card key={project.id} className="border-border/60">
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">{project.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {project.section?.name ?? "—"} · {project.section?.conference?.title ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Руководитель: {project.leader ? `${project.leader.last_name} ${project.leader.first_name}` : "—"}
                      </p>
                      {project.team ? (
                        <p className="text-xs text-muted-foreground">Команда: {project.team.name}</p>
                      ) : null}
                      {project.status && (
                        <p className="text-xs text-muted-foreground">Статус: {project.status.name}</p>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2 py-0">
                      <Button size="sm" variant="secondary" onClick={() => openProject(project)}>
                        Открыть
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4 text-sm text-muted-foreground">
                  <span>
                    Показано {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} из {totalCount}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      ← Назад
                    </Button>
                    <span>{page} / {totalPages}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >
                      Вперёд →
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProject && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 sm:p-4">
          <div className="flex min-h-full items-start justify-center py-3 sm:items-center sm:py-6">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-hidden border-border/70 bg-card flex flex-col shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/60 py-3">
              <CardTitle className="text-lg">{selectedProject.title}</CardTitle>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Закрыть
              </Button>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 py-4 space-y-4">
              {modalMode === "view" ? (
                <>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Секция:</span> {selectedProject.section?.name ?? "—"}</p>
                    <p><span className="text-muted-foreground">Конференция:</span> {selectedProject.section?.conference?.title ?? "—"}</p>
                    <p><span className="text-muted-foreground">Статус:</span> {selectedProject.status?.name ?? "—"}</p>
                    {selectedProject.team ? (
                      <p><span className="text-muted-foreground">Команда:</span> {selectedProject.team.name}</p>
                    ) : null}
                    <p><span className="text-muted-foreground">Руководитель:</span>{" "}
                      {selectedProject.leader ? `${selectedProject.leader.last_name} ${selectedProject.leader.first_name}` : "—"}
                    </p>
                    {selectedProject.members && selectedProject.members.length > 0 && (
                      <p><span className="text-muted-foreground">Участники:</span>{" "}
                        {selectedProject.members.map(m => `${m.last_name} ${m.first_name}`).join(", ")}
                      </p>
                    )}
                    {selectedProject.description && (
                      <div>
                        <p className="text-muted-foreground">Описание:</p>
                        <p className="whitespace-pre-wrap">{selectedProject.description}</p>
                      </div>
                    )}
                    {selectedProject.additional_info && (
                      <div>
                        <p className="text-muted-foreground">Доп. информация:</p>
                        <p className="whitespace-pre-wrap">{selectedProject.additional_info}</p>
                      </div>
                    )}
                  </div>
                  <Button variant="secondary" onClick={() => setModalMode("edit")}>
                    Редактировать проект
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Название</Label>
                    <Input
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Описание</Label>
                    <Textarea
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Доп. информация</Label>
                    <Textarea
                      value={form.additionalInfo}
                      onChange={e => setForm(f => ({ ...f, additionalInfo: e.target.value }))}
                      className="min-h-[60px]"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Руководитель</Label>
                      <Select
                        value={form.leaderId || undefined}
                        onValueChange={v => setForm(f => ({ ...f, leaderId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                        <SelectContent>
                          {studentUsers.map(u => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.last_name} {u.first_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Секция</Label>
                      <Select
                        value={form.sectionId || undefined}
                        onValueChange={v => setForm(f => ({ ...f, sectionId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSections.map(s => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Статус</Label>
                      <Select
                        value={form.statusId || undefined}
                        onValueChange={v => setForm(f => ({ ...f, statusId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map(s => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Этап</Label>
                      <Select
                        value={form.stageId || undefined}
                        onValueChange={v => setForm(f => ({ ...f, stageId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map(s => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveProject}>Сохранить</Button>
                    <Button variant="outline" onClick={() => setModalMode("view")}>
                      Отмена
                    </Button>
                  </div>
                  {saveMessage && <p className="text-sm text-muted-foreground">{saveMessage}</p>}
                </div>
              )}

              <div className="border-t border-border/60 pt-4">
                <h3 className="text-sm font-medium mb-2">Комментарии</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {projectComments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Нет комментариев.</p>
                  ) : (
                    projectComments.map(c => (
                      <div key={c.id} className="rounded border border-border/60 bg-muted/20 p-2 text-sm">
                        <p>{c.text}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.author ? `${c.author.last_name} ${c.author.first_name}` : "—"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Новый комментарий..."
                    className="min-h-[60px] flex-1"
                  />
                  <Button size="sm" onClick={submitComment} disabled={!commentText.trim()}>
                    Отправить
                  </Button>
                </div>
                {commentMessage && <p className="text-xs text-muted-foreground mt-1">{commentMessage}</p>}
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      )}
    </section>
  );
}
