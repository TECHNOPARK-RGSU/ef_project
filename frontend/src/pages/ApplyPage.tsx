import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import { formatDateRange } from "@/lib/format";
import { isStudentRole as isStudentRoleCode, normalizeRoleCode } from "@/lib/roles";
import { useUserRole } from "@/lib/useUserRole";
import type {
  Comment,
  Conference,
  ConferenceStageAvailability,
  ParticipationStage,
  PresentationType,
  Project,
  ProjectResult,
  ProjectStatus,
  Section,
  User,
} from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";

export function ApplyPage() {
  const [, paramsFromRoute] = useRoute("/conferences/:id/projects");
  const [location] = useLocation();
  const conferenceIdFromRoute = paramsFromRoute?.id ? Number(paramsFromRoute.id) : null;
  const defaultConferenceId = conferenceIdFromRoute != null ? String(conferenceIdFromRoute) : "";
  const authUser = getAuthUserInfo();
  const roleFromAuth = normalizeRoleCode(authUser?.roleCode ?? "");
  const { roleCode, isStudent, isTutor, isOrganizer } = useUserRole(roleFromAuth);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [stageItems, setStageItems] = useState<ConferenceStageAvailability[]>([]);
  const [stages, setStages] = useState<ParticipationStage[]>([]);
  const [presentationTypes, setPresentationTypes] = useState<PresentationType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [results, setResults] = useState<ProjectResult[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [projectsQuery, setProjectsQuery] = useState("");
  const [projectsSort, setProjectsSort] = useState<"updated_desc" | "title_asc">("updated_desc");
  const [projectsPage, setProjectsPage] = useState(1);
  const [resultsPage, setResultsPage] = useState(1);
  const [conferenceFilter, setConferenceFilter] = useState("all");
  useEffect(() => {
    if (conferenceIdFromRoute != null) setConferenceFilter(String(conferenceIdFromRoute));
  }, [conferenceIdFromRoute]);
  const [adminSectionFilter, setAdminSectionFilter] = useState("all");
  const [adminStatusFilter, setAdminStatusFilter] = useState("all");
  const [adminStageFilter, setAdminStageFilter] = useState("all");
  const [archiveFilter, setArchiveFilter] = useState<"active" | "archived">("active");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyMessage, setReplyMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [autoCreateHandled, setAutoCreateHandled] = useState(false);
  const [form, setForm] = useState({
    conferenceId: defaultConferenceId,
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
    if (conferenceIdFromRoute == null) return;
    setForm(current => {
      if (current.conferenceId === String(conferenceIdFromRoute)) return current;
      return { ...current, conferenceId: String(conferenceIdFromRoute), sectionId: "" };
    });
  }, [conferenceIdFromRoute]);

  const conferenceQuery = conferenceIdFromRoute != null ? `?conference=${conferenceIdFromRoute}` : "";

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState("loading");
      const requests = [
        fetchList<ProjectStatus>(`/api/conf/project-statuses${conferenceQuery}`, controller.signal).then(setStatuses),
        fetchList<Section>("/api/conf/sections/", controller.signal).then(setSections),
        fetchList<Conference>("/api/conf/conferences/", controller.signal).then(setConferences),
        fetchList<ParticipationStage>(`/api/conf/participation-stages${conferenceQuery}`, controller.signal).then(setStages),
        fetchList<PresentationType>(`/api/conf/presentation-types${conferenceQuery}`, controller.signal).then(
          setPresentationTypes,
        ),
        conferenceIdFromRoute != null
          ? fetchList<ConferenceStageAvailability>(`/api/conf/conference-stages/?conference=${conferenceIdFromRoute}`, controller.signal).then(setStageItems)
          : Promise.resolve([] as ConferenceStageAvailability[]).then(setStageItems),
        fetchList<User>("/api/users/users/", controller.signal).then(setUsers),
        fetchList<Project>("/api/conf/projects/?include_archived=1", controller.signal).then(setProjects),
        fetchList<ProjectResult>("/api/conf/results/", controller.signal).then(setResults),
        fetchList<Comment>("/api/conf/comments/", controller.signal).then(setComments),
      ];
      const results = await Promise.allSettled(requests);
      if (!controller.signal.aborted) {
        setState(results.some(result => result.status === "fulfilled") ? "ready" : "error");
      }
    };

    load();
    return () => controller.abort();
  }, [conferenceIdFromRoute]);

  const visibleStatuses = useMemo(() => statuses.slice(0, 4).map(status => status.name), [statuses]);
  const stageAvailabilityByConference = useMemo(() => {
    const map: Record<string, string[]> = {};
    stageItems.forEach(item => {
      const confId = item.conference?.id ? String(item.conference.id) : null;
      const stageId = item.stage?.id ? String(item.stage.id) : null;
      if (!confId || !stageId || !item.is_enabled) return;
      if (!map[confId]) map[confId] = [];
      map[confId].push(stageId);
    });
    return map;
  }, [stageItems]);
  const studentUsers = useMemo(
    () =>
      users.filter(user => {
        const code = normalizeRoleCode(user.role?.code ?? "");
        return isStudentRoleCode(code);
      }),
    [users],
  );
  const tutorUsers = useMemo(
    () => users.filter(user => (user.role?.code ?? "").toLowerCase() === "tutor"),
    [users],
  );
  const availableSections = useMemo(() => {
    if (!form.conferenceId) return [];
    return sections.filter(section => String(section.conference?.id) === form.conferenceId);
  }, [form.conferenceId, sections]);
  const filterSections = useMemo(() => {
    if (conferenceFilter === "all") return sections;
    return sections.filter(section => String(section.conference?.id) === conferenceFilter);
  }, [conferenceFilter, sections]);
  const availableStagesForForm = useMemo(() => {
    if (!form.conferenceId) return stages;
    const allowed = stageAvailabilityByConference[form.conferenceId];
    if (!allowed || !allowed.length) return stages;
    return stages.filter(stage => allowed.includes(String(stage.id)));
  }, [form.conferenceId, stageAvailabilityByConference, stages]);
  const filterStages = useMemo(() => {
    if (conferenceFilter === "all") return stages;
    const allowed = stageAvailabilityByConference[conferenceFilter];
    if (!allowed || !allowed.length) return stages;
    return stages.filter(stage => allowed.includes(String(stage.id)));
  }, [conferenceFilter, stageAvailabilityByConference, stages]);
  const currentStudentName = useMemo(() => {
    const currentStudent = studentUsers.find(user => user.id === authUser?.id);
    if (!currentStudent) return "Текущий пользователь";
    return `${currentStudent.last_name ?? ""} ${currentStudent.first_name ?? ""}`.trim();
  }, [authUser?.id, studentUsers]);
  const conferenceTitleFromRoute = useMemo(() => {
    if (conferenceIdFromRoute == null) return "";
    return conferences.find(conf => conf.id === conferenceIdFromRoute)?.title ?? `Конференция #${conferenceIdFromRoute}`;
  }, [conferenceIdFromRoute, conferences]);
  const shouldAutoOpenCreate = useMemo(() => {
    if (typeof window === "undefined") return false;
    const value = (new URLSearchParams(window.location.search).get("create") ?? "").toLowerCase();
    return value === "1" || value === "true" || value === "yes";
  }, [location]);
  useEffect(() => {
    setAutoCreateHandled(false);
  }, [location]);
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
      if (archiveFilter === "active" && project.is_archived) return false;
      if (archiveFilter === "archived" && !project.is_archived) return false;
      if (conferenceFilter !== "all" && String(project.section?.conference?.id) !== conferenceFilter) return false;
      if (!needle) return true;
      return project.title.toLowerCase().includes(needle);
    });
    const roleFiltered = isOrganizer
      ? filtered.filter(project => {
          if (adminSectionFilter !== "all" && String(project.section?.id) !== adminSectionFilter) return false;
          if (adminStatusFilter !== "all" && String(project.status?.id) !== adminStatusFilter) return false;
          if (adminStageFilter !== "all" && String(project.stage?.id) !== adminStageFilter) return false;
          return true;
        })
      : filtered;

    return [...roleFiltered].sort((a, b) => {
      if (projectsSort === "title_asc") {
        return a.title.localeCompare(b.title);
      }
      const aTime = Date.parse(a.updated_at ?? a.created_at ?? "") || 0;
      const bTime = Date.parse(b.updated_at ?? b.created_at ?? "") || 0;
      return bTime - aTime;
    });
  }, [
    archiveFilter,
    conferenceFilter,
    adminSectionFilter,
    adminStageFilter,
    adminStatusFilter,
    isOrganizer,
    projects,
    projectsQuery,
    projectsSort,
  ]);
  const projectsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(visibleProjects.length / projectsPerPage));
  const paginatedProjects = useMemo(() => {
    const start = (projectsPage - 1) * projectsPerPage;
    return visibleProjects.slice(start, start + projectsPerPage);
  }, [projectsPage, visibleProjects]);
  useEffect(() => {
    setProjectsPage(1);
  }, [projectsQuery, projectsSort, adminSectionFilter, adminStatusFilter, adminStageFilter, conferenceFilter, archiveFilter]);

  useEffect(() => {
    setAdminSectionFilter("all");
  }, [conferenceFilter]);
  useEffect(() => {
    if (projectsPage > totalPages) setProjectsPage(totalPages);
  }, [projectsPage, totalPages]);
  const deadlines = useMemo(() => {
    const dedup = new Map<string, { title: string; start: string; end: string }>();
    visibleProjects.forEach(project => {
      const conference = project.section?.conference;
      if (!conference?.id || !conference.start_date || !conference.end_date) return;
      const key = String(conference.id);
      if (!dedup.has(key)) {
        dedup.set(key, {
          title: conference.title || "Конференция",
          start: conference.start_date,
          end: conference.end_date,
        });
      }
    });
    return Array.from(dedup.values()).slice(0, 5);
  }, [visibleProjects]);
  const resultsByProject = useMemo(() => {
    return results.reduce<Record<number, ProjectResult[]>>((acc, item) => {
      const projectId = item.project?.id;
      if (!projectId) return acc;
      if (!acc[projectId]) acc[projectId] = [];
      acc[projectId].push(item);
      return acc;
    }, {});
  }, [results]);
  const RESULTS_LIST_PER_PAGE = 6;
  const resultsListTotalPages = Math.max(1, Math.ceil(results.length / RESULTS_LIST_PER_PAGE));
  const paginatedResultsList = useMemo(() => {
    const start = (resultsPage - 1) * RESULTS_LIST_PER_PAGE;
    return results.slice(start, start + RESULTS_LIST_PER_PAGE);
  }, [results, resultsPage]);

  const canSubmit =
    form.conferenceId &&
    form.title.trim() &&
    form.leaderId &&
    form.sectionId &&
    form.statusId &&
    form.stageId &&
    form.presentationTypeId;

  useEffect(() => {
    if (!isStudent || !authUser?.id) return;
    if (form.leaderId) return;
    setForm(current => ({ ...current, leaderId: String(authUser.id) }));
  }, [authUser?.id, form.leaderId, isStudent]);

  useEffect(() => {
    if (isOrganizer || form.statusId || !statuses.length) return;
    const defaultStatus =
      statuses.find(item => item.code.toLowerCase() === "new") ??
      statuses.find(item => item.code.toLowerCase() === "in_review") ??
      statuses[0];
    setForm(current => ({ ...current, statusId: String(defaultStatus.id) }));
  }, [form.statusId, isOrganizer, statuses]);

  useEffect(() => {
    if (isOrganizer || form.stageId || !stages.length) return;
    const defaultStage =
      stages.find(item => item.code.toLowerCase() === "qualifying") ?? stages[0];
    setForm(current => ({ ...current, stageId: String(defaultStage.id) }));
  }, [form.stageId, isOrganizer, stages]);

  const submitProject = async () => {
    setSubmitMessage(null);
    const selectedMembers = [form.member1Id, form.member2Id].filter(value => value && value !== "none");
    if (new Set(selectedMembers).size !== selectedMembers.length) {
      setSubmitState("error");
      setSubmitMessage("Участники 2 и 3 должны быть разными.");
      return;
    }
    if (selectedMembers.includes(form.leaderId)) {
      setSubmitState("error");
      setSubmitMessage("Руководитель не должен дублироваться в участниках.");
      return;
    }
    setSubmitState("saving");
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
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        let message = "Не удалось сохранить проект.";
        if (data) {
          if (typeof data.detail === "string") {
            message = data.detail;
          } else {
            const fields = Object.entries(data)
              .map(([field, value]) => {
                if (Array.isArray(value)) return `${field}: ${value.join(", ")}`;
                if (typeof value === "string") return `${field}: ${value}`;
                return null;
              })
              .filter((part): part is string => Boolean(part));
            if (fields.length) message = fields.join(" ");
          }
        }
        throw new Error(message);
      }
      const created = (await response.json()) as Project;
      setProjects(current =>
        editingId ? current.map(item => (item.id === editingId ? created : item)) : [created, ...current],
      );
      setSubmitState("saved");
      setSubmitMessage(editingId ? "Проект обновлен." : "Проект сохранен.");
      setForm({
        conferenceId: defaultConferenceId,
        title: "",
        description: "",
        additionalInfo: "",
        leaderId: isStudent && authUser?.id ? String(authUser.id) : "",
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
      setIsProjectModalOpen(false);
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage(error instanceof Error ? error.message : "Не удалось сохранить проект.");
    }
  };

  const startEdit = (project: Project) => {
    setEditingId(project.id);
    setForm({
      conferenceId: project.section?.conference?.id ? String(project.section.conference.id) : "",
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
    setIsProjectModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSubmitState("idle");
    setSubmitMessage(null);
    setForm({
      conferenceId: defaultConferenceId,
      title: "",
      description: "",
      additionalInfo: "",
      leaderId: isStudent && authUser?.id ? String(authUser.id) : "",
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
    setIsProjectModalOpen(false);
  };

  const openCreateProject = () => {
    if (isOrganizer) return;
    setEditingId(null);
    setSubmitState("idle");
    setForm({
      conferenceId: defaultConferenceId,
      title: "",
      description: "",
      additionalInfo: "",
      leaderId: isStudent && authUser?.id ? String(authUser.id) : "",
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
    setSubmitMessage(null);
    setIsProjectModalOpen(true);
  };

  useEffect(() => {
    if (isOrganizer || autoCreateHandled || !shouldAutoOpenCreate) return;
    openCreateProject();
    setAutoCreateHandled(true);
  }, [autoCreateHandled, isOrganizer, openCreateProject, shouldAutoOpenCreate]);

  const archiveProject = async (id: number) => {
    if (!window.confirm("Отправить проект в архив? Его нельзя будет редактировать, пока он в архиве.")) return;
    setSubmitMessage(null);
    try {
      const token = getAuthToken();
      if (!token) throw new Error("missing token");
      const response = await fetch(`${API_BASE_URL}/api/conf/projects/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({ is_archived: true }),
      });
      if (!response.ok) throw new Error("archive failed");
      const updated = (await response.json()) as Project;
      setProjects(current => current.map(item => (item.id === id ? updated : item)));
      if (editingId === id) cancelEdit();
      setSubmitMessage("Проект отправлен в архив.");
    } catch (error) {
      setSubmitMessage("Не удалось архивировать проект.");
    }
  };

  const restoreProject = async (id: number) => {
    if (!window.confirm("Восстановить проект из архива?")) return;
    setSubmitMessage(null);
    try {
      const token = getAuthToken();
      if (!token) throw new Error("missing token");
      const response = await fetch(`${API_BASE_URL}/api/conf/projects/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({ is_archived: false }),
      });
      if (!response.ok) throw new Error("restore failed");
      const updated = (await response.json()) as Project;
      setProjects(current => current.map(item => (item.id === id ? updated : item)));
      setSubmitMessage("Проект восстановлен из архива.");
    } catch (error) {
      setSubmitMessage("Не удалось восстановить проект.");
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
    <section className="space-y-6">
      <div className="col-span-full flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {isOrganizer ? "проекты" : "заявки"}
          </p>
          <h1 className="text-2xl font-semibold">
            {isOrganizer ? "Управление проектами" : "Мои проекты"}
          </h1>
        </div>
        {!isOrganizer ? <Button className="w-full sm:w-auto" onClick={openCreateProject}>Создать проект</Button> : null}
      </div>

      {isProjectModalOpen ? (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 sm:p-4">
      <div className="flex min-h-full items-start justify-center py-3 sm:items-center sm:py-6">
      <Card className="w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] border-border/70 bg-card shadow-xl">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-2xl">
              {editingId ? "Редактирование заявки" : "Новая заявка"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isOrganizer
                ? "Заявка сохраняется сразу в системе как проект. Отдельной отправки не требуется."
                : "Заполните только основные поля: название, секцию, формат и файл проекта."}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={cancelEdit}>
            Закрыть
          </Button>
        </CardHeader>
        <CardContent className="space-y-5 overflow-y-auto pr-1">
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
              <Label>Конференция</Label>
              {conferenceIdFromRoute != null ? (
                <Input value={conferenceTitleFromRoute} disabled />
              ) : (
                <Select
                  value={form.conferenceId || undefined}
                  onValueChange={value =>
                    setForm(current => ({
                      ...current,
                      conferenceId: value,
                      sectionId: "",
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите конференцию" />
                  </SelectTrigger>
                  <SelectContent>
                    {conferences.length ? (
                      conferences.map(conf => (
                        <SelectItem key={conf.id} value={String(conf.id)}>
                          {conf.title}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="0" disabled>
                        Нет конференций
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Руководитель</Label>
              {isStudent ? (
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
                  <SelectValue placeholder={form.conferenceId ? "Выберите направление" : "Сначала выберите конференцию"} />
                </SelectTrigger>
                <SelectContent>
                  {availableSections.length ? (
                    availableSections.map(section => (
                      <SelectItem key={section.id} value={String(section.id)}>
                        {section.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="0" disabled>
                      {form.conferenceId ? "Нет секций" : "Выберите конференцию"}
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
          {isOrganizer ? (
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
                  {availableStagesForForm.length ? (
                    availableStagesForForm.map(stage => (
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
              <Button variant="outline" className="w-full md:w-auto" onClick={cancelEdit}>
                Отмена
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
      </div>
      </div>
      ) : null}

      <div className="space-y-4">
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">Проекты</CardTitle>
              {conferenceIdFromRoute != null ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/conferences/${conferenceIdFromRoute}`}>← К конференции</Link>
                </Button>
              ) : null}
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                state === "ready" ? "bg-primary/10 text-primary" : "bg-muted"
              }`}
            >
              {state === "ready" ? "данные загружены" : "загрузка"}
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

            <div className="grid gap-2 md:grid-cols-3">
              {conferenceIdFromRoute == null ? (
                <Select value={conferenceFilter} onValueChange={setConferenceFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Конференция" />
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
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  Конференция: {conferences.find(c => c.id === conferenceIdFromRoute)?.title ?? String(conferenceIdFromRoute)}
                </div>
              )}
              <Select value={archiveFilter} onValueChange={value => setArchiveFilter(value as "active" | "archived")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Активные</SelectItem>
                  <SelectItem value="archived">Архив</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isOrganizer ? (
              <>
                <div className="grid gap-2 md:grid-cols-3">
                  <Select value={adminSectionFilter} onValueChange={setAdminSectionFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Секция" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все секции</SelectItem>
                      {filterSections.map(section => (
                        <SelectItem key={section.id} value={String(section.id)}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={adminStatusFilter} onValueChange={setAdminStatusFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Статус" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все статусы</SelectItem>
                      {statuses.map(status => (
                        <SelectItem key={status.id} value={String(status.id)}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={adminStageFilter} onValueChange={setAdminStageFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Этап" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все этапы</SelectItem>
                      {filterStages.map(stage => (
                        <SelectItem key={stage.id} value={String(stage.id)}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {paginatedProjects.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {paginatedProjects.map(project => {
                      const leaderName = project.leader
                        ? `${project.leader.last_name || ""} ${project.leader.first_name || ""}`.trim()
                        : "—";
                      return (
                        <div key={project.id} className="rounded-lg border border-border/60 bg-background/70 p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-foreground">{project.title}</p>
                              <p className="text-xs text-muted-foreground">{project.section?.name || "Секция не указана"}</p>
                            </div>
                            <span className="rounded-full bg-muted px-3 py-1 text-xs uppercase tracking-[0.2em]">
                              {project.is_archived ? "Архив" : project.status?.name || "Без статуса"}
                            </span>
                          </div>
                          <div className="grid gap-2 text-sm text-muted-foreground">
                            <p>Формат: {project.presentation_type?.name || "—"}</p>
                            <p>Этап: {project.stage?.name || "—"}</p>
                            <p>Руководитель: {leaderName}</p>
                          </div>
                          {!project.is_archived && statuses.length ? (
                            <div className="space-y-1">
                              <Label className="text-xs">Статус</Label>
                              <Select
                                value={project.status?.id ? String(project.status.id) : ""}
                                onValueChange={val => {
                                  const s = statuses.find(st => st.id === Number(val));
                                  if (s) updateProjectStatus(project.id, s.code);
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Выберите статус" />
                                </SelectTrigger>
                                <SelectContent>
                                  {statuses.map(st => (
                                    <SelectItem key={st.id} value={String(st.id)}>
                                      {st.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}
                          {resultsByProject[project.id]?.[0] ? (
                            <p className="text-xs text-muted-foreground">
                              Итог: {resultsByProject[project.id][0].total_score} баллов, место {resultsByProject[project.id][0].rank}
                            </p>
                          ) : null}
                          {commentsByProject[project.id]?.length ? (
                            <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-1">
                              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Комментарии</p>
                              {commentsByProject[project.id].map(c => (
                                <p key={c.id} className="text-xs">
                                  {c.author ? `${c.author.last_name ?? ""} ${c.author.first_name ?? ""}: ` : ""}{c.text}
                                </p>
                              ))}
                            </div>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            {!project.is_archived ? (
                              <>
                                <Button size="sm" variant="secondary" onClick={() => startEdit(project)}>
                                  Редактировать
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => archiveProject(project.id)}>
                                  В архив
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => restoreProject(project.id)}>
                                Восстановить
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Доклады не найдены по текущим фильтрам.</p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-sm text-muted-foreground">
                  <span>
                    Показано {paginatedProjects.length} из {visibleProjects.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={projectsPage <= 1}
                      onClick={() => setProjectsPage(page => Math.max(1, page - 1))}
                    >
                      Назад
                    </Button>
                    <span>
                      {projectsPage} / {totalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={projectsPage >= totalPages}
                      onClick={() => setProjectsPage(page => Math.min(totalPages, page + 1))}
                    >
                      Вперёд
                    </Button>
                  </div>
                </div>
              </>
            ) : paginatedProjects.length ? (
              paginatedProjects.map(project => (
                <div
                  key={project.id}
                  className="rounded-lg border border-border/60 bg-background/70 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{project.title}</p>
                      <p className="text-xs text-muted-foreground">{project.section?.name || "Секция не указана"}</p>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs uppercase tracking-[0.2em]">
                      {project.is_archived ? "Архив" : project.status?.name || "Без статуса"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Этап: {project.stage?.name || "—"}</p>
                  {project.section?.conference?.start_date && project.section?.conference?.end_date ? (
                    <p>
                      Дедлайн этапа:{" "}
                      {formatDateRange(project.section.conference.start_date, project.section.conference.end_date)}
                    </p>
                  ) : null}
                  {resultsByProject[project.id]?.[0] ? (
                    <p className="text-xs text-muted-foreground">
                      Итог: {resultsByProject[project.id][0].total_score} баллов, место {resultsByProject[project.id][0].rank}
                    </p>
                  ) : null}
                  {commentsByProject[project.id]?.length ? (
                    <div className="rounded-md border border-border/60 bg-card/60 p-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Комментарии</p>
                      {commentsByProject[project.id].map(item => (
                        <p key={item.id} className="text-sm">
                          {item.author ? `${item.author.last_name ?? ""} ${item.author.first_name ?? ""}: ` : ""}{item.text}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {(isStudent || isTutor) && project.status?.code === "rework" ? (
                    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/70 p-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-700">
                        Ответить на комментарий
                      </p>
                      <Textarea
                        value={replyDrafts[project.id] ?? ""}
                        onChange={event =>
                          setReplyDrafts(current => ({ ...current, [project.id]: event.target.value }))
                        }
                        placeholder="Что исправили"
                        className="min-h-[72px]"
                      />
                      <Button size="sm" variant="outline" onClick={() => sendReply(project.id)}>
                        Отправить
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {!project.is_archived ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => startEdit(project)}>
                          Редактировать
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => archiveProject(project.id)}>
                          В архив
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => restoreProject(project.id)}>
                        Восстановить
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p>{archiveFilter === "archived" ? "Архив пуст." : "Проектов пока нет."}</p>
            )}
            {!isOrganizer ? (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-sm text-muted-foreground">
                <span>
                  Показано {paginatedProjects.length} из {visibleProjects.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={projectsPage <= 1}
                    onClick={() => setProjectsPage(page => Math.max(1, page - 1))}
                  >
                    Назад
                  </Button>
                  <span>
                    {projectsPage} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={projectsPage >= totalPages}
                    onClick={() => setProjectsPage(page => Math.min(totalPages, page + 1))}
                  >
                    Вперёд
                  </Button>
                </div>
              </div>
            ) : null}
            {replyMessage ? <p>{replyMessage}</p> : null}
          </CardContent>
        </Card>
        {isOrganizer && visibleStatuses.length ? (
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="text-lg">Статусы проектов</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>В справочнике: {visibleStatuses.join(", ")}. Статус меняется выпадающим списком в карточке проекта.</p>
            </CardContent>
          </Card>
        ) : null}
        {!isOrganizer ? (
          <>
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="text-lg">{isTutor ? "Кабинет наставника" : "Кабинет ученика"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>1. Заполните заявку и прикрепите файл.</p>
                <p>2. Следите за статусом и комментариями.</p>
                <p>3. При статусе «На доработке» отправьте ответ.</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="text-lg">Ближайшие дедлайны</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {deadlines.length ? (
                  deadlines.map(item => (
                    <p key={`${item.title}-${item.start}`}>
                      {item.title}: {formatDateRange(item.start, item.end)}
                    </p>
                  ))
                ) : (
                  <p>Пока нет данных по датам.</p>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="text-lg">Результаты</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {paginatedResultsList.length ? (
                  paginatedResultsList.map(item => (
                    <p key={item.id}>
                      {item.project.title}: {item.total_score} баллов, место {item.rank}
                    </p>
                  ))
                ) : (
                  <p>Результатов пока нет.</p>
                )}
                {results.length > RESULTS_LIST_PER_PAGE ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
                    <span>Показано {paginatedResultsList.length} из {results.length}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7" disabled={resultsPage <= 1} onClick={() => setResultsPage(p => Math.max(1, p - 1))}>←</Button>
                      <span>{resultsPage} / {resultsListTotalPages}</span>
                      <Button size="sm" variant="outline" className="h-7" disabled={resultsPage >= resultsListTotalPages} onClick={() => setResultsPage(p => Math.min(resultsListTotalPages, p + 1))}>→</Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </section>
  );
}
