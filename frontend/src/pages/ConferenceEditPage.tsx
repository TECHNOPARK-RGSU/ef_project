import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, fetchList, fetchOne } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import type {
  AgeCategory,
  Conference,
  ConferenceExpert,
  EvaluationCriterion,
  ParticipationStage,
  Place,
  PresentationType,
  ProjectStatus,
  Section,
  User,
} from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useUserRole } from "@/lib/useUserRole";

const CRITERIA_PER_PAGE = 6;
const SECTIONS_PER_PAGE = 6;
const EXPERTS_PER_PAGE = 8;

export function ConferenceEditPage() {
  const [, params] = useRoute("/conferences/:id/edit");
  const id = params?.id ? Number(params.id) : null;
  const authUser = getAuthUserInfo();
  const { isOrganizer } = useUserRole(authUser?.roleCode);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [conference, setConference] = useState<Conference | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [conferenceExperts, setConferenceExperts] = useState<ConferenceExpert[]>([]);
  const [expertUsers, setExpertUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<AgeCategory[]>([]);
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [stages, setStages] = useState<ParticipationStage[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [presentationTypes, setPresentationTypes] = useState<PresentationType[]>([]);

  const [form, setForm] = useState({
    title: "",
    startDate: "",
    endDate: "",
    location: "",
    format: "online",
    description: "",
    winnersCount: "1",
    prizesCount: "2",
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [criteriaForm, setCriteriaForm] = useState({
    name: "",
    description: "",
    maxScore: "10",
    stage: "online",
  });
  const [editingCriterionId, setEditingCriterionId] = useState<number | null>(null);
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [criteriaMessage, setCriteriaMessage] = useState<string | null>(null);
  const [criteriaPage, setCriteriaPage] = useState(1);

  const [sectionForm, setSectionForm] = useState({ name: "", categoryId: "" });
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [sectionMessage, setSectionMessage] = useState<string | null>(null);
  const [sectionsPage, setSectionsPage] = useState(1);

  const [expertForm, setExpertForm] = useState<{ expertId: string; sectionIds: string[] }>({
    expertId: "",
    sectionIds: [],
  });
  const [editingExpertId, setEditingExpertId] = useState<number | null>(null);
  const [isExpertModalOpen, setIsExpertModalOpen] = useState(false);
  const [expertsPage, setExpertsPage] = useState(1);

  const [catalogModalType, setCatalogModalType] = useState<"age" | "status" | "stage" | "place" | "presentation" | null>(null);
  const [catalogForm, setCatalogForm] = useState({ name: "", code: "", minAge: "", maxAge: "", address: "", placeId: "" });
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);

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
        const c = confResult.value;
        setForm({
          title: c.title,
          startDate: c.start_date,
          endDate: c.end_date,
          location: c.location ?? "",
          format: c.format ?? (c.is_online ? "online" : "offline"),
          description: c.description ?? "",
          winnersCount: c.winners_count ? String(c.winners_count) : "1",
          prizesCount: c.prizes_count ? String(c.prizes_count) : "2",
        });
      }
      if (sectionsResult.status === "fulfilled") setSections(sectionsResult.value);
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
        fetchList<ConferenceExpert>(`/api/conf/conference-experts/?conference=${id}`, controller.signal),
        fetchList<User>(`/api/users/users/`, controller.signal),
        fetchList<AgeCategory>(`/api/conf/age-categories/?conference=${id}`, controller.signal),
        fetchList<ProjectStatus>(`/api/conf/project-statuses/?conference=${id}`, controller.signal),
        fetchList<ParticipationStage>(`/api/conf/participation-stages/?conference=${id}`, controller.signal),
        fetchList<Place>(`/api/conf/places/?conference=${id}`, controller.signal),
        fetchList<PresentationType>(`/api/conf/presentation-types/?conference=${id}`, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      if (tasks[0].status === "fulfilled") setCriteria(tasks[0].value);
      if (tasks[1].status === "fulfilled") setConferenceExperts(tasks[1].value);
      if (tasks[2].status === "fulfilled") setExpertUsers(tasks[2].value);
      if (tasks[3].status === "fulfilled") setCategories(tasks[3].value);
      if (tasks[4].status === "fulfilled") setStatuses(tasks[4].value);
      if (tasks[5].status === "fulfilled") setStages(tasks[5].value);
      if (tasks[6].status === "fulfilled") setPlaces(tasks[6].value);
      if (tasks[7].status === "fulfilled") setPresentationTypes(tasks[7].value);
    };
    loadMeta();
    return () => controller.abort();
  }, [id]);

  const conferenceSections = useMemo(
    () => (sections.length && id ? sections.filter(s => s.conference?.id === id) : []),
    [sections, id],
  );
  const sectionsForDisplay = useMemo(
    () =>
      conferenceSections.map(s => ({
        id: s.id,
        name: s.name,
        age: s.category?.name ?? "—",
      })),
    [conferenceSections],
  );

  const paginatedCriteria = useMemo(() => {
    const start = (criteriaPage - 1) * CRITERIA_PER_PAGE;
    return criteria.slice(start, start + CRITERIA_PER_PAGE);
  }, [criteria, criteriaPage]);
  const criteriaTotalPages = Math.max(1, Math.ceil(criteria.length / CRITERIA_PER_PAGE));

  const paginatedSections = useMemo(() => {
    const start = (sectionsPage - 1) * SECTIONS_PER_PAGE;
    return sectionsForDisplay.slice(start, start + SECTIONS_PER_PAGE);
  }, [sectionsForDisplay, sectionsPage]);
  const sectionsTotalPages = Math.max(1, Math.ceil(sectionsForDisplay.length / SECTIONS_PER_PAGE));

  const paginatedExperts = useMemo(() => {
    const start = (expertsPage - 1) * EXPERTS_PER_PAGE;
    return conferenceExperts.slice(start, start + EXPERTS_PER_PAGE);
  }, [conferenceExperts, expertsPage]);
  const expertsTotalPages = Math.max(1, Math.ceil(conferenceExperts.length / EXPERTS_PER_PAGE));

  const availableExperts = useMemo(
    () => expertUsers.filter(u => (u.role?.code ?? "").toLowerCase() === "expert"),
    [expertUsers],
  );
  const selectableExperts = useMemo(() => {
    const used = new Set(conferenceExperts.map(e => e.expert?.id).filter(Boolean) as number[]);
    return availableExperts.filter(u => !used.has(u.id) || String(u.id) === expertForm.expertId);
  }, [availableExperts, conferenceExperts, expertForm.expertId]);

  const saveMainForm = async () => {
    if (!id) return;
    setSaveState("saving");
    setSaveMessage(null);
    try {
      const token = getAuthToken();
      if (!token) throw new Error("missing token");
      const response = await fetch(`${API_BASE_URL}/api/conf/conferences/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({
          title: form.title,
          start_date: form.startDate,
          end_date: form.endDate,
          location: form.location,
          format: form.format,
          is_online: form.format !== "offline",
          description: form.description || "",
          winners_count: Number(form.winnersCount),
          prizes_count: Number(form.prizesCount),
        }),
      });
      if (!response.ok) throw new Error("save failed");
      const updated = (await response.json()) as Conference;
      setConference(updated);
      setSaveState("saved");
      setSaveMessage("Параметры сохранены.");
    } catch {
      setSaveState("error");
      setSaveMessage("Не удалось сохранить.");
    }
  };

  const submitCriterion = async () => {
    setCriteriaMessage(null);
    if (!id || !criteriaForm.name.trim()) return;
    const token = getAuthToken();
    if (!token) {
      setCriteriaMessage("Нужен токен.");
      return;
    }
    const endpoint = editingCriterionId ? `/api/conf/criteria/${editingCriterionId}/` : "/api/conf/criteria/";
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
      setCriteriaMessage("Не удалось сохранить критерий.");
      return;
    }
    const created = (await response.json()) as EvaluationCriterion;
    setCriteria(prev =>
      editingCriterionId ? prev.map(c => (c.id === editingCriterionId ? created : c)) : [created, ...prev],
    );
    setCriteriaForm({ name: "", description: "", maxScore: "10", stage: "online" });
    setEditingCriterionId(null);
    setIsCriteriaModalOpen(false);
  };

  const submitSection = async () => {
    setSectionMessage(null);
    if (!id || !sectionForm.name.trim()) return;
    const token = getAuthToken();
    if (!token) {
      setSectionMessage("Нужен токен.");
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

  const saveExpert = async () => {
    if (!id || !expertForm.expertId) return;
    const token = getAuthToken();
    if (!token) return;
    const endpoint = editingExpertId ? `/api/conf/conference-experts/${editingExpertId}/` : "/api/conf/conference-experts/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: editingExpertId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        conference_id: id,
        expert_id: Number(expertForm.expertId),
        section_ids: expertForm.sectionIds.map(Number),
      }),
    });
    if (!response.ok) return;
    const updated = (await response.json()) as ConferenceExpert;
    setConferenceExperts(prev =>
      editingExpertId ? prev.map(e => (e.id === editingExpertId ? updated : e)) : [updated, ...prev],
    );
    setEditingExpertId(null);
    setExpertForm({ expertId: "", sectionIds: [] });
    setIsExpertModalOpen(false);
  };

  const removeExpert = async (itemId: number) => {
    const token = getAuthToken();
    if (!token) return;
    const response = await fetch(`${API_BASE_URL}/api/conf/conference-experts/${itemId}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) return;
    setConferenceExperts(prev => prev.filter(e => e.id !== itemId));
  };

  const submitCatalogItem = async () => {
    setCatalogMessage(null);
    if (!id) return;
    const token = getAuthToken();
    if (!token) {
      setCatalogMessage("Нужен токен.");
      return;
    }
    const type = catalogModalType;
    if (!type) return;
    let url = "";
    let body: Record<string, unknown> = { conference_id: id };
    if (type === "age") {
      if (!catalogForm.name.trim()) {
        setCatalogMessage("Введите название.");
        return;
      }
      url = "/api/conf/age-categories/";
      body.name = catalogForm.name.trim();
      if (catalogForm.minAge) body.min_age = Number(catalogForm.minAge);
      if (catalogForm.maxAge) body.max_age = Number(catalogForm.maxAge);
    } else if (type === "status") {
      if (!catalogForm.name.trim() || !catalogForm.code.trim()) {
        setCatalogMessage("Название и код обязательны.");
        return;
      }
      url = "/api/conf/project-statuses/";
      body.name = catalogForm.name.trim();
      body.code = catalogForm.code.trim();
    } else if (type === "stage") {
      if (!catalogForm.name.trim() || !catalogForm.code.trim()) {
        setCatalogMessage("Название и код обязательны.");
        return;
      }
      url = "/api/conf/participation-stages/";
      body.name = catalogForm.name.trim();
      body.code = catalogForm.code.trim();
    } else if (type === "place") {
      if (!catalogForm.name.trim()) {
        setCatalogMessage("Введите название.");
        return;
      }
      url = "/api/conf/places/";
      body.name = catalogForm.name.trim();
      body.address = catalogForm.address.trim() || "";
    } else if (type === "presentation") {
      if (!catalogForm.name.trim() || !catalogForm.code.trim() || !catalogForm.placeId) {
        setCatalogMessage("Название, код и место обязательны.");
        return;
      }
      url = "/api/conf/presentation-types/";
      body.name = catalogForm.name.trim();
      body.code = catalogForm.code.trim();
      body.place_id = Number(catalogForm.placeId);
    }
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setCatalogMessage("Не удалось сохранить.");
      return;
    }
    const created = await response.json();
    if (type === "age") setCategories(prev => [...prev, created]);
    if (type === "status") setStatuses(prev => [...prev, created]);
    if (type === "stage") setStages(prev => [...prev, created]);
    if (type === "place") setPlaces(prev => [...prev, created]);
    if (type === "presentation") setPresentationTypes(prev => [...prev, created]);
    setCatalogForm({ name: "", code: "", minAge: "", maxAge: "", address: "", placeId: "" });
    setCatalogModalType(null);
  };

  if (!id) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-6 text-sm text-muted-foreground">Некорректный идентификатор.</CardContent>
      </Card>
    );
  }

  if (state === "ready" && !conference) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-6 text-sm text-muted-foreground">Конференция не найдена.</CardContent>
      </Card>
    );
  }

  if (state === "ready" && !isOrganizer) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-6 text-sm text-muted-foreground">Доступ только для организатора.</CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Редактирование конференции</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={id ? `/conferences/${id}` : "/conferences"}>К карточке</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/conferences">К списку</Link>
          </Button>
        </div>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Основные параметры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Название конференции"
              />
            </div>
            <div className="space-y-2">
              <Label>Формат</Label>
              <Select value={form.format} onValueChange={v => setForm(f => ({ ...f, format: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Онлайн</SelectItem>
                  <SelectItem value="hybrid">Гибрид</SelectItem>
                  <SelectItem value="offline">Очный</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Дата начала</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Дата окончания</Label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Место проведения</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Место или ссылка" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Описание</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Краткое описание" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Число победителей</Label>
              <Input type="number" min={1} value={form.winnersCount} onChange={e => setForm(f => ({ ...f, winnersCount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Число призёров</Label>
              <Input type="number" min={0} value={form.prizesCount} onChange={e => setForm(f => ({ ...f, prizesCount: e.target.value }))} />
            </div>
          </div>
          {saveMessage && <p className={saveState === "error" ? "text-destructive" : "text-muted-foreground"}>{saveMessage}</p>}
          <Button onClick={saveMainForm} disabled={saveState === "saving" || !form.title.trim() || !form.startDate || !form.endDate}>
            {saveState === "saving" ? "Сохранение…" : "Сохранить параметры"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">Критерии оценки</CardTitle>
          <Button size="sm" onClick={() => { setEditingCriterionId(null); setCriteriaForm({ name: "", description: "", maxScore: "10", stage: "online" }); setIsCriteriaModalOpen(true); }}>
            Добавить
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {paginatedCriteria.length ? (
            paginatedCriteria.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 p-2">
                <span>{c.name} · макс. {c.max_score} · {c.stage === "online" ? "заочный" : "очный"}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingCriterionId(c.id); setCriteriaForm({ name: c.name, description: c.description ?? "", maxScore: String(c.max_score), stage: c.stage }); setIsCriteriaModalOpen(true); }}>Изменить</Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Критерии не заданы.</p>
          )}
          {criteria.length > CRITERIA_PER_PAGE && (
            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Button size="sm" variant="outline" className="h-7" disabled={criteriaPage <= 1} onClick={() => setCriteriaPage(p => Math.max(1, p - 1))}>←</Button>
              <span>{criteriaPage} / {criteriaTotalPages}</span>
              <Button size="sm" variant="outline" className="h-7" disabled={criteriaPage >= criteriaTotalPages} onClick={() => setCriteriaPage(p => Math.min(criteriaTotalPages, p + 1))}>→</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">Секции</CardTitle>
          <Button size="sm" onClick={() => { setSectionForm({ name: "", categoryId: "" }); setSectionMessage(null); setIsSectionModalOpen(true); }}>
            Добавить секцию
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {paginatedSections.length ? (
            paginatedSections.map(s => (
              <div key={s.id} className="rounded-md border border-border/60 bg-background/70 px-3 py-2">
                {s.name} · {s.age}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Секции не добавлены.</p>
          )}
          {sectionsForDisplay.length > SECTIONS_PER_PAGE && (
            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Button size="sm" variant="outline" className="h-7" disabled={sectionsPage <= 1} onClick={() => setSectionsPage(p => Math.max(1, p - 1))}>←</Button>
              <span>{sectionsPage} / {sectionsTotalPages}</span>
              <Button size="sm" variant="outline" className="h-7" disabled={sectionsPage >= sectionsTotalPages} onClick={() => setSectionsPage(p => Math.min(sectionsTotalPages, p + 1))}>→</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Справочники конференции</CardTitle>
          <p className="text-sm text-muted-foreground">Возрастные категории, статусы заявок, этапы, места и типы представления только для этой конференции.</p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="font-medium text-muted-foreground mb-1">Возрастные категории</p>
              <div className="flex flex-wrap items-center gap-2">
                {categories.map(c => (
                  <span key={c.id} className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-xs">{c.name}</span>
                ))}
                <Button size="sm" variant="outline" className="h-7" onClick={() => { setCatalogModalType("age"); setCatalogForm({ name: "", code: "", minAge: "", maxAge: "", address: "", placeId: "" }); setCatalogMessage(null); }}>+</Button>
              </div>
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-1">Статусы заявок</p>
              <div className="flex flex-wrap items-center gap-2">
                {statuses.map(s => (
                  <span key={s.id} className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-xs">{s.name}</span>
                ))}
                <Button size="sm" variant="outline" className="h-7" onClick={() => { setCatalogModalType("status"); setCatalogForm({ name: "", code: "", minAge: "", maxAge: "", address: "", placeId: "" }); setCatalogMessage(null); }}>+</Button>
              </div>
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-1">Этапы участия</p>
              <div className="flex flex-wrap items-center gap-2">
                {stages.map(s => (
                  <span key={s.id} className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-xs">{s.name}</span>
                ))}
                <Button size="sm" variant="outline" className="h-7" onClick={() => { setCatalogModalType("stage"); setCatalogForm({ name: "", code: "", minAge: "", maxAge: "", address: "", placeId: "" }); setCatalogMessage(null); }}>+</Button>
              </div>
            </div>
            <div>
              <p className="font-medium text-muted-foreground mb-1">Места</p>
              <div className="flex flex-wrap items-center gap-2">
                {places.map(p => (
                  <span key={p.id} className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-xs">{p.name}</span>
                ))}
                <Button size="sm" variant="outline" className="h-7" onClick={() => { setCatalogModalType("place"); setCatalogForm({ name: "", code: "", minAge: "", maxAge: "", address: "", placeId: "" }); setCatalogMessage(null); }}>+</Button>
              </div>
            </div>
            <div className="md:col-span-2">
              <p className="font-medium text-muted-foreground mb-1">Типы представления</p>
              <div className="flex flex-wrap items-center gap-2">
                {presentationTypes.map(p => (
                  <span key={p.id} className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-xs">{p.name}</span>
                ))}
                <Button size="sm" variant="outline" className="h-7" onClick={() => { setCatalogModalType("presentation"); setCatalogForm({ name: "", code: "", minAge: "", maxAge: "", address: "", placeId: places[0]?.id ? String(places[0].id) : "" }); setCatalogMessage(null); }}>+</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">Эксперты</CardTitle>
          <Button size="sm" onClick={() => { setEditingExpertId(null); setExpertForm({ expertId: "", sectionIds: [] }); setIsExpertModalOpen(true); }}>
            Добавить эксперта
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {paginatedExperts.length ? (
            paginatedExperts.map(item => (
              <div key={item.id} className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 p-2">
                <span>{item.expert?.last_name} {item.expert?.first_name} · {item.sections?.length ? item.sections.map(s => s.name).join(", ") : "все секции"}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingExpertId(item.id); setExpertForm({ expertId: String(item.expert?.id ?? ""), sectionIds: item.sections?.map(s => String(s.id)) ?? [] }); setIsExpertModalOpen(true); }}>Настроить</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => removeExpert(item.id)}>Удалить</Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Эксперты не добавлены.</p>
          )}
          {conferenceExperts.length > EXPERTS_PER_PAGE && (
            <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
              <Button size="sm" variant="outline" className="h-7" disabled={expertsPage <= 1} onClick={() => setExpertsPage(p => Math.max(1, p - 1))}>←</Button>
              <span>{expertsPage} / {expertsTotalPages}</span>
              <Button size="sm" variant="outline" className="h-7" disabled={expertsPage >= expertsTotalPages} onClick={() => setExpertsPage(p => Math.min(expertsTotalPages, p + 1))}>→</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isCriteriaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md border-border/70 bg-card shadow-xl">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle className="text-lg">{editingCriterionId ? "Изменить критерий" : "Новый критерий"}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsCriteriaModalOpen(false)}>Закрыть</Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input value={criteriaForm.name} onChange={e => setCriteriaForm(c => ({ ...c, name: e.target.value }))} placeholder="Критерий" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Этап</Label>
                  <Select value={criteriaForm.stage} onValueChange={v => setCriteriaForm(c => ({ ...c, stage: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Заочный</SelectItem>
                      <SelectItem value="offline">Очный</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Макс. баллов</Label>
                  <Input type="number" value={criteriaForm.maxScore} onChange={e => setCriteriaForm(c => ({ ...c, maxScore: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea value={criteriaForm.description} onChange={e => setCriteriaForm(c => ({ ...c, description: e.target.value }))} placeholder="Описание" rows={2} />
              </div>
              {criteriaMessage && <p className="text-destructive">{criteriaMessage}</p>}
              <div className="flex gap-2">
                <Button onClick={submitCriterion}>{editingCriterionId ? "Сохранить" : "Добавить"}</Button>
                <Button variant="outline" onClick={() => setIsCriteriaModalOpen(false)}>Отмена</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isSectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md border-border/70 bg-card shadow-xl">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle className="text-lg">Добавить секцию</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsSectionModalOpen(false)}>Закрыть</Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input value={sectionForm.name} onChange={e => setSectionForm(s => ({ ...s, name: e.target.value }))} placeholder="Секция" />
              </div>
              <div className="space-y-2">
                <Label>Возрастная категория</Label>
                <Select value={sectionForm.categoryId || undefined} onValueChange={v => setSectionForm(s => ({ ...s, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {sectionMessage && <p className="text-destructive">{sectionMessage}</p>}
              <div className="flex gap-2">
                <Button onClick={submitSection}>Добавить</Button>
                <Button variant="outline" onClick={() => setIsSectionModalOpen(false)}>Отмена</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isExpertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md border-border/70 bg-card shadow-xl">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle className="text-lg">{editingExpertId ? "Настроить эксперта" : "Добавить эксперта"}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsExpertModalOpen(false)}>Закрыть</Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-2">
                <Label>Эксперт</Label>
                <Select value={expertForm.expertId || undefined} onValueChange={v => setExpertForm(e => ({ ...e, expertId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                  <SelectContent>
                    {selectableExperts.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.last_name} {u.first_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Секции</Label>
                <div className="flex flex-wrap gap-2">
                  {conferenceSections.map(sec => (
                    <label key={sec.id} className="flex items-center gap-2 rounded border px-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={expertForm.sectionIds.includes(String(sec.id))}
                        onChange={e => {
                          setExpertForm(prev => {
                            const next = new Set(prev.sectionIds);
                            if (e.target.checked) next.add(String(sec.id));
                            else next.delete(String(sec.id));
                            return { ...prev, sectionIds: Array.from(next) };
                          });
                        }}
                      />
                      {sec.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveExpert} disabled={!expertForm.expertId}>{editingExpertId ? "Сохранить" : "Добавить"}</Button>
                <Button variant="outline" onClick={() => setIsExpertModalOpen(false)}>Отмена</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {catalogModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md border-border/70 bg-card shadow-xl">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle className="text-lg">
                {catalogModalType === "age" && "Возрастная категория"}
                {catalogModalType === "status" && "Статус заявки"}
                {catalogModalType === "stage" && "Этап участия"}
                {catalogModalType === "place" && "Место"}
                {catalogModalType === "presentation" && "Тип представления"}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setCatalogModalType(null); setCatalogMessage(null); }}>Закрыть</Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(catalogModalType === "age" || catalogModalType === "status" || catalogModalType === "stage" || catalogModalType === "place" || catalogModalType === "presentation") && (
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input value={catalogForm.name} onChange={e => setCatalogForm(f => ({ ...f, name: e.target.value }))} placeholder="Название" />
                </div>
              )}
              {(catalogModalType === "status" || catalogModalType === "stage" || catalogModalType === "presentation") && (
                <div className="space-y-2">
                  <Label>Код</Label>
                  <Input value={catalogForm.code} onChange={e => setCatalogForm(f => ({ ...f, code: e.target.value }))} placeholder="code" />
                </div>
              )}
              {catalogModalType === "age" && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Мин. возраст</Label>
                    <Input type="number" value={catalogForm.minAge} onChange={e => setCatalogForm(f => ({ ...f, minAge: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Макс. возраст</Label>
                    <Input type="number" value={catalogForm.maxAge} onChange={e => setCatalogForm(f => ({ ...f, maxAge: e.target.value }))} placeholder="18" />
                  </div>
                </div>
              )}
              {catalogModalType === "place" && (
                <div className="space-y-2">
                  <Label>Адрес</Label>
                  <Input value={catalogForm.address} onChange={e => setCatalogForm(f => ({ ...f, address: e.target.value }))} placeholder="Адрес (необязательно)" />
                </div>
              )}
              {catalogModalType === "presentation" && (
                <div className="space-y-2">
                  <Label>Место</Label>
                  <Select value={catalogForm.placeId || undefined} onValueChange={v => setCatalogForm(f => ({ ...f, placeId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Выберите место" /></SelectTrigger>
                    <SelectContent>
                      {places.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {catalogMessage && <p className="text-destructive text-xs">{catalogMessage}</p>}
              <div className="flex gap-2">
                <Button onClick={submitCatalogItem}>Добавить</Button>
                <Button variant="outline" onClick={() => { setCatalogModalType(null); setCatalogMessage(null); }}>Отмена</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
