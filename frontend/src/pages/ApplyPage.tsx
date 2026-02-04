import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import type {
  Comment,
  ParticipationStage,
  PresentationType,
  Project,
  ProjectStatus,
  Role,
  Section,
  User,
} from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";

export function ApplyPage() {
  const authUser = getAuthUserInfo();
  const roleCode = (authUser?.roleCode ?? "").toLowerCase();
  const isStudentRole =
    roleCode === "student" || roleCode === "student2" || roleCode === "student3";
  const isTutorRole = roleCode === "tutor";
  const isOrganizerRole = roleCode === "organizer";
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [roles, setRoles] = useState<Role[]>([]);
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [stages, setStages] = useState<ParticipationStage[]>([]);
  const [presentationTypes, setPresentationTypes] = useState<PresentationType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [projectsQuery, setProjectsQuery] = useState("");
  const [projectsSort, setProjectsSort] = useState<"updated_desc" | "title_asc">("updated_desc");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyMessage, setReplyMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    additionalInfo: "",
    leaderId: "",
    tutorId: "none",
    member1Id: "none",
    member2Id: "none",
    sectionId: "",
    statusId: "",
    stageId: "",
    presentationTypeId: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState("loading");
      const requests = [
        fetchList<Role>("/api/users/roles/", controller.signal).then(setRoles),
        fetchList<ProjectStatus>("/api/conf/project-statuses/", controller.signal).then(setStatuses),
        fetchList<Section>("/api/conf/sections/", controller.signal).then(setSections),
        fetchList<ParticipationStage>("/api/conf/participation-stages/", controller.signal).then(setStages),
        fetchList<PresentationType>("/api/conf/presentation-types/", controller.signal).then(
          setPresentationTypes,
        ),
        fetchList<User>("/api/users/users/", controller.signal).then(setUsers),
        fetchList<Project>("/api/conf/projects/", controller.signal).then(setProjects),
        fetchList<Comment>("/api/conf/comments/", controller.signal).then(setComments),
      ];
      const results = await Promise.allSettled(requests);
      if (!controller.signal.aborted) {
        setState(results.some(result => result.status === "fulfilled") ? "ready" : "error");
      }
    };

    load();
    return () => controller.abort();
  }, []);

  const visibleRoles = useMemo(() => roles.map(role => `${role.name} — ${role.code}`), [roles]);
  const visibleStatuses = useMemo(() => statuses.slice(0, 4).map(status => status.name), [statuses]);
  const studentUsers = useMemo(
    () =>
      users.filter(user => {
        const code = (user.role?.code ?? "").toLowerCase();
        return code === "student" || code === "student2" || code === "student3";
      }),
    [users],
  );
  const tutorUsers = useMemo(
    () => users.filter(user => (user.role?.code ?? "").toLowerCase() === "tutor"),
    [users],
  );
  const currentStudentName = useMemo(() => {
    const currentStudent = studentUsers.find(user => user.id === authUser?.id);
    if (!currentStudent) return "Текущий пользователь";
    return `${currentStudent.last_name ?? ""} ${currentStudent.first_name ?? ""}`.trim();
  }, [authUser?.id, studentUsers]);
  const commentsByProject = useMemo(() => {
    return comments.reduce<Record<number, Comment[]>>((acc, item) => {
      const projectId = item.project?.id;
      if (!projectId) return acc;
      if (!acc[projectId]) acc[projectId] = [];
      acc[projectId].push(item);
      return acc;
    }, {});
  }, [comments]);
  const visibleProjects = useMemo(() => {
    const needle = projectsQuery.trim().toLowerCase();
    const filtered = projects.filter(project => {
      if (!needle) return true;
      return project.title.toLowerCase().includes(needle);
    });
    return [...filtered].sort((a, b) => {
      if (projectsSort === "title_asc") {
        return a.title.localeCompare(b.title);
      }
      const aTime = Date.parse(a.updated_at ?? a.created_at ?? "") || 0;
      const bTime = Date.parse(b.updated_at ?? b.created_at ?? "") || 0;
      return bTime - aTime;
    });
  }, [projects, projectsQuery, projectsSort]);

  const canSubmit =
    form.title.trim() &&
    form.leaderId &&
    form.sectionId &&
    form.statusId &&
    form.stageId &&
    form.presentationTypeId;

  useEffect(() => {
    if (!isStudentRole || !authUser?.id) return;
    if (form.leaderId) return;
    setForm(current => ({ ...current, leaderId: String(authUser.id) }));
  }, [authUser?.id, form.leaderId, isStudentRole]);

  useEffect(() => {
    if (isOrganizerRole || form.statusId || !statuses.length) return;
    setForm(current => ({ ...current, statusId: String(statuses[0].id) }));
  }, [form.statusId, isOrganizerRole, statuses]);

  useEffect(() => {
    if (isOrganizerRole || form.stageId || !stages.length) return;
    setForm(current => ({ ...current, stageId: String(stages[0].id) }));
  }, [form.stageId, isOrganizerRole, stages]);

  const submitProject = async () => {
    setSubmitState("saving");
    setSubmitMessage(null);
    try {
      const token = getAuthToken();
      if (!token) throw new Error("missing token");
      const leaderId = Number(form.leaderId);
      const memberIds = Array.from(
        new Set(
          [form.member1Id, form.member2Id]
            .filter(value => value && value !== "none")
            .map(value => Number(value)),
        ),
      ).filter(id => id !== leaderId);
      const endpoint = editingId ? `/api/conf/projects/${editingId}/` : "/api/conf/projects/";
      const body = new FormData();
      body.append("title", form.title);
      body.append("description", form.description || "");
      body.append("additional_info", form.additionalInfo || "");
      body.append("leader_id", String(leaderId));
      if (form.tutorId !== "none") {
        body.append("tutor_id", form.tutorId);
      }
      memberIds.forEach(id => body.append("member_ids", String(id)));
      body.append("section_id", form.sectionId);
      body.append("status_id", form.statusId);
      body.append("stage_id", form.stageId);
      body.append("presentation_type_id", form.presentationTypeId);
      if (file) {
        body.append("files", file);
      }
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: editingId ? "PATCH" : "POST",
        headers: { Authorization: `Token ${token}` },
        body,
      });
      if (!response.ok) throw new Error("save failed");
      const created = (await response.json()) as Project;
      setProjects(current =>
        editingId ? current.map(item => (item.id === editingId ? created : item)) : [created, ...current],
      );
      setSubmitState("saved");
      setSubmitMessage(editingId ? "Проект обновлен." : "Проект сохранен.");
      setForm({
        title: "",
        description: "",
        additionalInfo: "",
        leaderId: "",
        tutorId: "none",
        member1Id: "none",
        member2Id: "none",
        sectionId: "",
        statusId: "",
        stageId: "",
        presentationTypeId: "",
      });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setEditingId(null);
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage("Не удалось сохранить. Проверь API.");
    }
  };

  const startEdit = (project: Project) => {
    setEditingId(project.id);
    setForm({
      title: project.title,
      description: project.description ?? "",
      additionalInfo: project.additional_info ?? "",
      leaderId: project.leader?.id ? String(project.leader.id) : "",
      tutorId: project.tutor?.id ? String(project.tutor.id) : "none",
      member1Id: project.members?.[0]?.id ? String(project.members[0].id) : "none",
      member2Id: project.members?.[1]?.id ? String(project.members[1].id) : "none",
      sectionId: project.section?.id ? String(project.section.id) : "",
      statusId: project.status?.id ? String(project.status.id) : "",
      stageId: project.stage?.id ? String(project.stage.id) : "",
      presentationTypeId: project.presentation_type?.id ? String(project.presentation_type.id) : "",
    });
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({
      title: "",
      description: "",
      additionalInfo: "",
      leaderId: "",
      tutorId: "none",
      member1Id: "none",
      member2Id: "none",
      sectionId: "",
      statusId: "",
      stageId: "",
      presentationTypeId: "",
    });
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const deleteProject = async (id: number) => {
    setSubmitMessage(null);
    try {
      const token = getAuthToken();
      if (!token) throw new Error("missing token");
      const response = await fetch(`${API_BASE_URL}/api/conf/projects/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Token ${token}` },
      });
      if (!response.ok) throw new Error("delete failed");
      setProjects(current => current.filter(item => item.id !== id));
      if (editingId === id) cancelEdit();
      setSubmitMessage("Проект удалён.");
    } catch (error) {
      setSubmitMessage("Не удалось удалить проект.");
    }
  };

  const updateProjectStatus = async (projectId: number, statusCode: string) => {
    setSubmitMessage(null);
    const status = statuses.find(item => item.code.toLowerCase() === statusCode);
    if (!status) {
      setSubmitMessage("Нужный статус не найден в справочнике.");
      return;
    }
    try {
      const token = getAuthToken();
      if (!token) throw new Error("missing token");
      const response = await fetch(`${API_BASE_URL}/api/conf/projects/${projectId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({ status_id: status.id }),
      });
      if (!response.ok) throw new Error("update failed");
      const updated = (await response.json()) as Project;
      setProjects(current => current.map(item => (item.id === projectId ? updated : item)));
      setSubmitMessage("Статус проекта обновлен.");
    } catch {
      setSubmitMessage("Не удалось обновить статус.");
    }
  };

  const sendReply = async (projectId: number) => {
    setReplyMessage(null);
    const text = (replyDrafts[projectId] ?? "").trim();
    if (!text) {
      setReplyMessage("Введите текст комментария.");
      return;
    }
    try {
      const token = getAuthToken();
      if (!token) throw new Error("missing token");
      const response = await fetch(`${API_BASE_URL}/api/conf/comments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({ project_id: projectId, text }),
      });
      if (!response.ok) throw new Error("comment failed");
      const created = (await response.json()) as Comment;
      setComments(current => [created, ...current]);
      setReplyDrafts(current => ({ ...current, [projectId]: "" }));
      setReplyMessage("Комментарий отправлен.");
    } catch {
      setReplyMessage("Не удалось отправить комментарий.");
    }
  };

  return (
    <section className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle className="text-2xl">
            {editingId ? "Редактирование заявки" : "Новая заявка"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isOrganizerRole
              ? "Заявка сохраняется сразу в системе как проект. Отдельной отправки не требуется."
              : "Заполните только основные поля: название, секцию, формат и файл проекта."}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project">Название проекта</Label>
              <Input
                id="project"
                placeholder="Например, Энергоэффективный кампус"
                value={form.title}
                onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Руководитель</Label>
              {isStudentRole ? (
                <Input value={currentStudentName} disabled />
              ) : (
                <Select
                  value={form.leaderId || undefined}
                  onValueChange={value => setForm(current => ({ ...current, leaderId: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите пользователя" />
                  </SelectTrigger>
                  <SelectContent>
                    {studentUsers.length ? (
                      studentUsers.map(user => (
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
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Научный руководитель</Label>
            <Select
              value={form.tutorId}
              onValueChange={value => setForm(current => ({ ...current, tutorId: value }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Опционально" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без руководителя</SelectItem>
                {tutorUsers.map(user => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.last_name} {user.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Участник 2</Label>
              <Select
                value={form.member1Id}
                onValueChange={value => setForm(current => ({ ...current, member1Id: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Опционально" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без участника</SelectItem>
                  {studentUsers.map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.last_name} {user.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Участник 3</Label>
              <Select
                value={form.member2Id}
                onValueChange={value => setForm(current => ({ ...current, member2Id: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Опционально" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без участника</SelectItem>
                  {studentUsers.map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.last_name} {user.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Секция</Label>
              <Select
                value={form.sectionId || undefined}
                onValueChange={value => setForm(current => ({ ...current, sectionId: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите направление" />
                </SelectTrigger>
                <SelectContent>
                  {sections.length ? (
                    sections.map(section => (
                      <SelectItem key={section.id} value={String(section.id)}>
                        {section.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="0" disabled>
                      Нет секций
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Формат выступления</Label>
              <Select
                value={form.presentationTypeId || undefined}
                onValueChange={value =>
                  setForm(current => ({ ...current, presentationTypeId: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Тип представления" />
                </SelectTrigger>
                <SelectContent>
                  {presentationTypes.length ? (
                    presentationTypes.map(item => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="0" disabled>
                      Нет типов
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isOrganizerRole ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Статус</Label>
                <Select
                  value={form.statusId || undefined}
                  onValueChange={value => setForm(current => ({ ...current, statusId: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Статус проекта" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.length ? (
                      statuses.map(status => (
                        <SelectItem key={status.id} value={String(status.id)}>
                          {status.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="0" disabled>
                        Нет статусов
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Этап</Label>
                <Select
                  value={form.stageId || undefined}
                  onValueChange={value => setForm(current => ({ ...current, stageId: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Этап участия" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.length ? (
                      stages.map(stage => (
                        <SelectItem key={stage.id} value={String(stage.id)}>
                          {stage.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="0" disabled>
                        Нет этапов
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="desc">Краткое описание</Label>
            <Textarea
              id="desc"
              placeholder="Опишите цель проекта и ожидаемый результат"
              className="min-h-[120px]"
              value={form.description}
              onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="info">Дополнительная информация</Label>
            <Textarea
              id="info"
              placeholder="Ссылки, дополнительные материалы"
              value={form.additionalInfo}
              onChange={event => setForm(current => ({ ...current, additionalInfo: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">Файл проекта</Label>
            <Input
              id="file"
              type="file"
              ref={fileInputRef}
              onChange={event => setFile(event.target.files?.[0] ?? null)}
            />
            {editingId ? (
              <p className="text-xs text-muted-foreground">
                Если нужно заменить файл, выберите новый перед сохранением.
              </p>
            ) : null}
          </div>
          {submitMessage ? (
            <p className="text-sm text-muted-foreground">{submitMessage}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button className="w-full md:w-auto" disabled={!canSubmit || submitState === "saving"} onClick={submitProject}>
              {submitState === "saving"
                ? "Сохраняем…"
                : editingId
                  ? "Сохранить"
                  : "Сохранить проект"}
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={cancelEdit}>
                Отмена
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Проекты</CardTitle>
            <span
              className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                state === "ready" ? "bg-primary/10 text-primary" : "bg-muted"
              }`}
            >
              {state === "ready" ? "из API" : "демо"}
            </span>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="grid gap-2 md:grid-cols-[1fr_220px]">
              <Input
                value={projectsQuery}
                onChange={event => setProjectsQuery(event.target.value)}
                placeholder="Поиск по названию проекта"
              />
              <Select value={projectsSort} onValueChange={value => setProjectsSort(value as "updated_desc" | "title_asc")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Сортировка" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated_desc">Сначала новые</SelectItem>
                  <SelectItem value="title_asc">По названию А-Я</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {visibleProjects.length ? (
              visibleProjects.map(project => (
                <div
                  key={project.id}
                  className="rounded-lg border border-border/60 bg-background/70 p-3 space-y-1"
                >
                  <p className="font-semibold text-foreground">{project.title}</p>
                  <p>Секция: {project.section?.name || "не указана"}</p>
                  <p>
                    Статус:{" "}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        project.status?.code === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : project.status?.code === "rework"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {project.status?.name || "не указан"}
                    </span>
                  </p>
                  <p>Этап: {project.stage?.name || "не указан"}</p>
                  {commentsByProject[project.id]?.length ? (
                    <div className="rounded-md border border-border/60 bg-card/60 p-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Комментарии</p>
                      {commentsByProject[project.id].slice(0, 2).map(item => (
                        <p key={item.id} className="text-sm">
                          {item.text}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {(isStudentRole || isTutorRole) && project.status?.code === "rework" ? (
                    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/70 p-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-700">
                        Ответить на комментарий
                      </p>
                      <Textarea
                        value={replyDrafts[project.id] ?? ""}
                        onChange={event =>
                          setReplyDrafts(current => ({ ...current, [project.id]: event.target.value }))
                        }
                        placeholder="Опишите, что исправили, и задайте вопрос при необходимости"
                        className="min-h-[72px]"
                      />
                      <Button size="sm" variant="outline" onClick={() => sendReply(project.id)}>
                        Отправить комментарий
                      </Button>
                    </div>
                  ) : null}
                  {project.files ? (
                    <a
                      href={project.files}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline underline-offset-4"
                    >
                      Скачать файл
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" variant="secondary" onClick={() => startEdit(project)}>
                      Редактировать
                    </Button>
                    {isOrganizerRole ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => updateProjectStatus(project.id, "new")}>
                          На рецензии
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateProjectStatus(project.id, "rework")}>
                          На доработку
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateProjectStatus(project.id, "approved")}>
                          Согласован
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteProject(project.id)}>
                          Удалить
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p>Проектов пока нет.</p>
            )}
            {replyMessage ? <p>{replyMessage}</p> : null}
          </CardContent>
        </Card>
        {isOrganizerRole ? (
          <>
            <Card className="border-border/70 bg-card/80">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Статусы проекта</CardTitle>
                <span
                  className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                    state === "ready" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {state === "ready" ? "данные загружены" : "нет данных"}
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
                    state === "ready" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {state === "ready" ? "данные загружены" : "нет данных"}
                </span>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {visibleRoles.length ? visibleRoles.map(role => <p key={role}>{role}</p>) : <p>Ролей пока нет.</p>}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="text-lg">{isTutorRole ? "Режим наставника" : "Режим участника"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Заполните основные поля заявки.</p>
              <p>2. Добавьте файл работы.</p>
              <p>3. Нажмите «Сохранить проект».</p>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
