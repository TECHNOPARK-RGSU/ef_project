import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, fetchList, fetchPage } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import { isStudentRole } from "@/lib/roles";
import type {
  Comment,
  Conference,
  ParticipationStage,
  PresentationType,
  Project,
  ProjectStatus,
  Section,
  User,
} from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 10;

export function MyProjectsPage() {
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

  const studentUsers = useMemo(
    () => users.filter(u => isStudentRole(u.role?.code)),
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
    ]).catch(() => {});
    return () => controller.abort();
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const applyFilters = () => {
    setPage(1);
    loadProjects(1);
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

  const downloadFile = (projectId: number) => {
    window.open(`${API_BASE_URL}/api/conf/projects/${projectId}/download_file/`, "_blank");
  };

  const availableSections = useMemo(() => {
    if (!form.sectionId) return sectionsForConference;
    const section = sections.find(s => String(s.id) === form.sectionId);
    if (!section?.conference?.id) return sectionsForConference;
    return sections.filter(s => s.conference?.id === section.conference?.id);
  }, [sections, sectionsForConference, form.sectionId]);

  if (!authUser || !isStudentRole(authUser.roleCode)) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Доступ только для учеников.
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">ученик</p>
        <h1 className="text-3xl font-semibold">Мои проекты</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Проекты, в которых вы участвуете (руководитель или участник). Просмотр, редактирование и комментарии.
        </p>
      </div>

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
            <p className="py-4 text-sm text-muted-foreground">
              У вас пока нет проектов. Подайте заявку на конференцию в разделе «Конференции».
            </p>
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
                      {project.status && (
                        <p className="text-xs text-muted-foreground">Статус: {project.status.name}</p>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2 py-0">
                      <Button size="sm" variant="secondary" onClick={() => openProject(project)}>
                        Открыть
                      </Button>
                      {project.files ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadFile(project.id)}
                        >
                          Скачать
                        </Button>
                      ) : null}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-hidden border-border/70 bg-card/80 flex flex-col">
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
      )}
    </section>
  );
}
