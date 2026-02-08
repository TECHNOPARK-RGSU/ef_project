import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { Conference, Section } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";

const SECTIONS_PER_PAGE = 10;

export function SectionsPage() {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [sections, setSections] = useState<Section[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", conferenceId: "", categoryId: "" });
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [sectionsPage, setSectionsPage] = useState(1);
  const formRef = useRef<HTMLDivElement | null>(null);
  const sectionsTotalPages = Math.max(1, Math.ceil(sections.length / SECTIONS_PER_PAGE));
  const paginatedSections = useMemo(() => {
    const start = (sectionsPage - 1) * SECTIONS_PER_PAGE;
    return sections.slice(start, start + SECTIONS_PER_PAGE);
  }, [sections, sectionsPage]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState("loading");
      try {
        const [sectionsList, conferencesList, categoriesList] = await Promise.all([
          fetchList<Section>("/api/conf/sections/", controller.signal),
          fetchList<Conference>("/api/conf/conferences/", controller.signal),
          fetchList<{ id: number; name: string }>("/api/conf/age-categories/", controller.signal),
        ]);
        setSections(sectionsList);
        setConferences(conferencesList);
        setCategories(categoriesList);
        setState("ready");
      } catch (error) {
        if (!controller.signal.aborted) setState("error");
      }
    };

    load();
    return () => controller.abort();
  }, []);

  const canSubmit = form.name.trim() && form.conferenceId && form.categoryId;

  const handleCreateClick = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitSection = async () => {
    setSubmitState("saving");
    setSubmitMessage(null);
    try {
      const token = getAuthToken();
      if (!token) throw new Error("missing token");
      const endpoint = editingId ? `/api/conf/sections/${editingId}/` : "/api/conf/sections/";
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({
          name: form.name,
          conference_id: Number(form.conferenceId),
          category_id: Number(form.categoryId),
        }),
      });
      if (!response.ok) throw new Error("save failed");
      const created = (await response.json()) as Section;
      setSections(current =>
        editingId ? current.map(item => (item.id === editingId ? created : item)) : [created, ...current],
      );
      setSubmitState("saved");
      setSubmitMessage(editingId ? "Секция обновлена." : "Секция создана.");
      setForm({ name: "", conferenceId: "", categoryId: "" });
      setEditingId(null);
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage("Не удалось создать. Проверь API.");
    }
  };

  const startEdit = (section: Section) => {
    setEditingId(section.id);
    setForm({
      name: section.name,
      conferenceId: section.conference?.id ? String(section.conference.id) : "",
      categoryId: section.category?.id ? String(section.category.id) : "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: "", conferenceId: "", categoryId: "" });
  };

  const deleteSection = async (id: number) => {
    setSubmitMessage(null);
    const token = getAuthToken();
    if (!token) {
      setSubmitMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/sections/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setSubmitMessage("Не удалось удалить секцию.");
      return;
    }
    setSections(current => current.filter(item => item.id !== id));
    if (editingId === id) cancelEdit();
    setSubmitMessage("Секция удалена.");
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">секции</p>
          <h1 className="text-3xl font-semibold">Каталог секций</h1>
          <p className="text-sm text-muted-foreground">Направления и возрастные категории для конференций.</p>
        </div>
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span
            className={`rounded-full px-3 py-1 ${
              state === "ready" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {state === "ready" ? "данные загружены" : "нет данных"}
          </span>
          <Button onClick={handleCreateClick}>Добавить</Button>
        </div>
      </div>

      <div ref={formRef}>
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? "Редактирование секции" : "Новая секция"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="section-name">Название</Label>
                <Input
                  id="section-name"
                  value={form.name}
                  onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
                  placeholder="Название секции"
                />
              </div>
              <div className="space-y-2">
                <Label>Конференция</Label>
                <Select
                  value={form.conferenceId || undefined}
                  onValueChange={value => setForm(current => ({ ...current, conferenceId: value }))}
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
              </div>
              <div className="space-y-2">
                <Label>Возрастная категория</Label>
                <Select
                  value={form.categoryId || undefined}
                  onValueChange={value => setForm(current => ({ ...current, categoryId: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Категория" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length ? (
                      categories.map(category => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="0" disabled>
                        Нет категорий
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {submitMessage ? <p className="text-xs text-muted-foreground">{submitMessage}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                className="w-full md:w-auto"
                disabled={!canSubmit || submitState === "saving"}
                onClick={submitSection}
              >
                {submitState === "saving"
                  ? "Сохраняем…"
                  : editingId
                    ? "Сохранить"
                    : "Создать секцию"}
              </Button>
              {editingId ? (
                <Button variant="outline" onClick={cancelEdit}>
                  Отмена
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {state === "loading" && !sections.length ? (
            <Card className="border-border/70 bg-card/80">
              <CardContent className="p-6 text-sm text-muted-foreground">Загружаем секции…</CardContent>
            </Card>
          ) : (
            sections.length ? (
              paginatedSections.map(section => (
                <Card key={section.id} className="border-border/70 bg-card/80">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-lg">{section.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {section.category?.name || "Категория не указана"}
                    </p>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>{section.conference?.title || "Конференция не указана"}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => startEdit(section)}>
                        Редактировать
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteSection(section.id)}>
                        Удалить
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-border/70 bg-card/80">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Секций пока нет. Создайте первую запись.
                </CardContent>
              </Card>
            )
          )}
        </div>
        {sections.length > SECTIONS_PER_PAGE ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              Показано {paginatedSections.length} из {sections.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={sectionsPage <= 1}
                onClick={() => setSectionsPage(p => Math.max(1, p - 1))}
              >
                Назад
              </Button>
              <span>
                {sectionsPage} / {sectionsTotalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={sectionsPage >= sectionsTotalPages}
                onClick={() => setSectionsPage(p => Math.min(sectionsTotalPages, p + 1))}
              >
                Вперёд
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
