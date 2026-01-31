import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { FALLBACK_CONFERENCES } from "@/lib/demo";
import { formatDateRange, formatFormat } from "@/lib/format";
import type { Conference } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

export function ConferencesPage() {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [query, setQuery] = useState("");
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setState("loading");
      try {
        const items = await fetchList<Conference>("/api/conf/conferences/", controller.signal);
        setConferences(items);
        setState("ready");
      } catch (error) {
        if (!controller.signal.aborted) setState("error");
      }
    };

    load();
    return () => controller.abort();
  }, []);

  const visibleConferences = useMemo(() => {
    const list = conferences.length ? conferences : FALLBACK_CONFERENCES;
    if (!query.trim()) return list;
    const needle = query.toLowerCase();
    return list.filter(item => item.title.toLowerCase().includes(needle));
  }, [conferences, query]);

  const canSubmit =
    form.title.trim() && form.startDate && form.endDate && form.format;

  const submitConference = async () => {
    setSubmitState("saving");
    setSubmitMessage(null);
    try {
      const token = getAuthToken();
      if (!token) throw new Error("missing token");
    const endpoint = editingId ? `/api/conf/conferences/${editingId}/` : "/api/conf/conferences/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: editingId ? "PATCH" : "POST",
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
    const created = (await response.json()) as Conference;
    setConferences(current =>
      editingId ? current.map(conf => (conf.id === editingId ? created : conf)) : [created, ...current],
    );
    setSubmitState("saved");
    setSubmitMessage(editingId ? "Конференция обновлена." : "Конференция создана.");
      setForm({
        title: "",
        startDate: "",
        endDate: "",
        location: "",
        format: "online",
        description: "",
        winnersCount: "1",
        prizesCount: "2",
      });
      setEditingId(null);
  } catch (error) {
    setSubmitState("error");
    setSubmitMessage("Не удалось создать. Проверь API.");
  }
};

  const startEdit = (conf: Conference) => {
    setEditingId(conf.id);
    setForm({
      title: conf.title,
      startDate: conf.start_date,
      endDate: conf.end_date,
      location: conf.location ?? "",
      format: conf.format ?? (conf.is_online ? "online" : "offline"),
      description: conf.description ?? "",
      winnersCount: conf.winners_count ? String(conf.winners_count) : "1",
      prizesCount: conf.prizes_count ? String(conf.prizes_count) : "2",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({
      title: "",
      startDate: "",
      endDate: "",
      location: "",
      format: "online",
      description: "",
      winnersCount: "1",
      prizesCount: "2",
    });
  };

  const deleteConference = async (id: number) => {
    setSubmitMessage(null);
    try {
      const token = getAuthToken();
      if (!token) throw new Error("missing token");
      const response = await fetch(`${API_BASE_URL}/api/conf/conferences/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Token ${token}` },
      });
      if (!response.ok) throw new Error("delete failed");
      setConferences(current => current.filter(conf => conf.id !== id));
      setSubmitMessage("Конференция удалена.");
    } catch (error) {
      setSubmitMessage("Не удалось удалить конференцию.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">все конференции</p>
          <h1 className="text-3xl font-semibold">Каталог событий</h1>
          <p className="text-sm text-muted-foreground">
            Список конференций с быстрым доступом к карточкам и секциям.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span
            className={`rounded-full px-3 py-1 ${state === "ready" ? "bg-primary/10 text-primary" : "bg-muted"}`}
          >
            {state === "ready" ? "из API" : "демо"}
          </span>
          <Button>Создать</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">
            {editingId ? "Редактирование конференции" : "Новая конференция"}
          </CardTitle>
        </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="conf-title">Название</Label>
                <Input
                  id="conf-title"
                  value={form.title}
                  onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
                  placeholder="Название конференции"
                />
              </div>
              <div className="space-y-2">
                <Label>Формат</Label>
                <Select
                  value={form.format}
                  onValueChange={value => setForm(current => ({ ...current, format: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Формат" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Онлайн</SelectItem>
                    <SelectItem value="hybrid">Гибрид</SelectItem>
                    <SelectItem value="offline">Очный</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="conf-start">Дата начала</Label>
                <Input
                  id="conf-start"
                  type="date"
                  value={form.startDate}
                  onChange={event => setForm(current => ({ ...current, startDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conf-end">Дата окончания</Label>
                <Input
                  id="conf-end"
                  type="date"
                  value={form.endDate}
                  onChange={event => setForm(current => ({ ...current, endDate: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conf-location">Локация</Label>
              <Input
                id="conf-location"
                value={form.location}
                onChange={event => setForm(current => ({ ...current, location: event.target.value }))}
                placeholder="Место проведения"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conf-desc">Описание</Label>
              <Textarea
                id="conf-desc"
                value={form.description}
                onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
                placeholder="Краткое описание конференции"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Победители в секции</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.winnersCount}
                  onChange={event =>
                    setForm(current => ({ ...current, winnersCount: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Призёры в секции</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.prizesCount}
                  onChange={event =>
                    setForm(current => ({ ...current, prizesCount: event.target.value }))
                  }
                />
              </div>
            </div>
            {submitMessage ? <p className="text-xs text-muted-foreground">{submitMessage}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                className="w-full md:w-auto"
                disabled={!canSubmit || submitState === "saving"}
                onClick={submitConference}
              >
                {submitState === "saving"
                  ? "Сохраняем…"
                  : editingId
                    ? "Сохранить"
                    : "Создать конференцию"}
              </Button>
              {editingId ? (
                <Button variant="outline" onClick={cancelEdit}>
                  Отмена
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Поиск по названию"
            className="md:max-w-sm"
          />
          <p className="text-sm text-muted-foreground">
            {visibleConferences.length} {visibleConferences.length === 1 ? "конференция" : "конференции"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {state === "loading" && !conferences.length ? (
          <Card className="border-border/70 bg-card/80">
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              Загружаем список конференций…
            </CardContent>
          </Card>
        ) : (
          visibleConferences.map(conf => (
            <Card key={conf.id} className="border-border/70 bg-card/80">
              <CardHeader className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {formatDateRange(conf.start_date, conf.end_date)}
                </p>
                <CardTitle className="text-lg">{conf.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{conf.location || "Место уточняется"}</p>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{formatFormat(conf)}</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/conferences/${conf.id}`}>Карточка</Link>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => startEdit(conf)}>
                    Редактировать
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteConference(conf.id)}>
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
