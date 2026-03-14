import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import type {
  Conference,
  ParticipationStage,
  PresentationType,
  Project,
  ProjectStatus,
  Section,
  StudentTeam,
} from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";

type ProjectSubmissionModalProps = {
  conference: Conference | null;
  open: boolean;
  onClose: () => void;
  onSubmitted: (project: Project) => void;
};

type LoadState = "idle" | "loading" | "ready" | "error";

const getUserName = (lastName?: string | null, firstName?: string | null) =>
  `${lastName ?? ""} ${firstName ?? ""}`.trim() || "Без имени";

export function ProjectSubmissionModal({
  conference,
  open,
  onClose,
  onSubmitted,
}: ProjectSubmissionModalProps) {
  const authUser = getAuthUserInfo();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [stages, setStages] = useState<ParticipationStage[]>([]);
  const [presentationTypes, setPresentationTypes] = useState<PresentationType[]>([]);
  const [teams, setTeams] = useState<StudentTeam[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    additionalInfo: "",
    teamId: "none",
    sectionId: "",
    presentationTypeId: "",
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open || !conference?.id) return;
    const controller = new AbortController();
    const load = async () => {
      setLoadState("loading");
      setMessage(null);
      setForm({
        title: "",
        description: "",
        additionalInfo: "",
        teamId: "none",
        sectionId: "",
        presentationTypeId: "",
      });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      try {
        const [loadedSections, loadedStatuses, loadedStages, loadedPresentationTypes, loadedTeams] =
          await Promise.all([
            fetchList<Section>(`/api/conf/sections/?conference=${conference.id}`, controller.signal),
            fetchList<ProjectStatus>(`/api/conf/project-statuses/?conference=${conference.id}`, controller.signal),
            fetchList<ParticipationStage>(`/api/conf/participation-stages/?conference=${conference.id}`, controller.signal),
            fetchList<PresentationType>(`/api/conf/presentation-types/?conference=${conference.id}`, controller.signal),
            fetchList<StudentTeam>("/api/users/student-teams/", controller.signal),
          ]);
        if (controller.signal.aborted) return;
        setSections(loadedSections);
        setStatuses(loadedStatuses);
        setStages(loadedStages);
        setPresentationTypes(loadedPresentationTypes);
        setTeams(loadedTeams);
        setForm(current => ({
          ...current,
          teamId: loadedTeams.length ? String(loadedTeams[0].id) : "none",
        }));
        setLoadState("ready");
      } catch {
        if (!controller.signal.aborted) setLoadState("error");
      }
    };

    load();
    return () => controller.abort();
  }, [conference?.id, open]);

  const selectedTeam = useMemo(
    () => teams.find(team => String(team.id) === form.teamId) ?? null,
    [form.teamId, teams],
  );

  const defaultStatus = useMemo(
    () => statuses.find(item => item.code.toLowerCase() === "new") ?? statuses[0] ?? null,
    [statuses],
  );
  const defaultStage = useMemo(
    () => stages.find(item => item.code.toLowerCase() === "qualifying") ?? stages[0] ?? null,
    [stages],
  );

  if (!open || !conference) return null;

  const submitProject = async () => {
    if (!authUser?.id) {
      setMessage("Нужна авторизация.");
      return;
    }
    if (!form.title.trim() || !form.sectionId || !form.presentationTypeId) {
      setMessage("Заполните название, секцию и формат выступления.");
      return;
    }
    if (!defaultStatus || !defaultStage) {
      setMessage("Для конференции не настроены базовые статус или этап участия.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setMessage("Нужна авторизация.");
      return;
    }

    setSubmitState("saving");
    setMessage(null);
    try {
      const body = new FormData();
      body.append("title", form.title.trim());
      body.append("description", form.description.trim());
      body.append("additional_info", form.additionalInfo.trim());
      body.append("leader_id", String(authUser.id));
      body.append("section_id", form.sectionId);
      body.append("status_id", String(defaultStatus.id));
      body.append("stage_id", String(defaultStage.id));
      body.append("presentation_type_id", form.presentationTypeId);
      if (form.teamId !== "none") body.append("team_id", form.teamId);
      if (file) body.append("files", file);

      const response = await fetch(`${API_BASE_URL}/api/conf/projects/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
        body,
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          detail?: string;
          [key: string]: unknown;
        };
        if (typeof data.detail === "string") {
          setMessage(data.detail);
        } else {
          const firstError = Object.values(data)[0];
          setMessage(Array.isArray(firstError) ? String(firstError[0]) : "Не удалось отправить заявку.");
        }
        setSubmitState("error");
        return;
      }
      const created = (await response.json()) as Project;
      onSubmitted(created);
    } catch {
      setMessage("Не удалось отправить заявку.");
      setSubmitState("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 sm:p-4">
      <div className="flex min-h-full items-start justify-center py-3 sm:items-center sm:py-6">
        <Card className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden border-border/70 bg-card shadow-xl sm:max-h-[calc(100dvh-3rem)]">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Подача заявки</p>
              <CardTitle className="text-lg">{conference.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Выберите команду, к которой вас привязал наставник по email. Научный руководитель и состав заявки
                подставятся автоматически.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Закрыть
            </Button>
          </CardHeader>
          <CardContent className="flex-1 space-y-4 overflow-y-auto pr-1 text-sm">
            {loadState === "loading" ? (
              <p className="py-6 text-muted-foreground">Загружаем форму заявки…</p>
            ) : loadState === "error" ? (
              <p className="py-6 text-destructive">Не удалось загрузить форму заявки.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="project-title">Название проекта</Label>
                  <Input
                    id="project-title"
                    value={form.title}
                    onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
                    placeholder="Например, Интерактивный учебный стенд"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Команда, от которой подается заявка</Label>
                  <Select
                    value={form.teamId}
                    onValueChange={value => setForm(current => ({ ...current, teamId: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Выберите команду" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Индивидуальная заявка</SelectItem>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={String(team.id)}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  {selectedTeam ? (
                    <div className="space-y-2">
                      <p>
                        <span className="text-muted-foreground">Научный руководитель:</span>{" "}
                        {getUserName(selectedTeam.tutor?.last_name, selectedTeam.tutor?.first_name)}
                        {selectedTeam.tutor?.email ? ` (${selectedTeam.tutor.email})` : ""}
                      </p>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Состав команды</p>
                        <ul className="space-y-1">
                          {(selectedTeam.members ?? []).map(member => (
                            <li key={member.id}>
                              {getUserName(member.last_name, member.first_name)}
                              {member.email ? ` (${member.email})` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : teams.length ? (
                    <p className="text-muted-foreground">
                      Можно подать заявку индивидуально или выбрать одну из доступных команд наставника.
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      Наставник еще не привязал вас к команде по email. Сейчас доступна только индивидуальная заявка.
                    </p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Секция</Label>
                    <Select
                      value={form.sectionId || undefined}
                      onValueChange={value => setForm(current => ({ ...current, sectionId: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите секцию" />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map(section => (
                          <SelectItem key={section.id} value={String(section.id)}>
                            {section.name}
                          </SelectItem>
                        ))}
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
                        <SelectValue placeholder="Выберите формат" />
                      </SelectTrigger>
                      <SelectContent>
                        {presentationTypes.map(item => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-description">Описание</Label>
                  <Textarea
                    id="project-description"
                    value={form.description}
                    onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
                    className="min-h-[110px]"
                    placeholder="Кратко опишите идею и результат проекта"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-additional-info">Дополнительная информация</Label>
                  <Textarea
                    id="project-additional-info"
                    value={form.additionalInfo}
                    onChange={event => setForm(current => ({ ...current, additionalInfo: event.target.value }))}
                    className="min-h-[90px]"
                    placeholder="Ссылка на репозиторий, оборудование, особенности защиты"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-file">Файл проекта</Label>
                  <Input
                    id="project-file"
                    ref={fileRef}
                    type="file"
                    onChange={event => setFile(event.target.files?.[0] ?? null)}
                  />
                </div>
              </>
            )}

            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
              <Button
                onClick={submitProject}
                disabled={loadState !== "ready" || submitState === "saving"}
              >
                {submitState === "saving" ? "Отправка..." : "Подать заявку"}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Закрыть
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
