import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/common/EmptyState";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import { formatDateRange, formatFormat } from "@/lib/format";
import { useUserRole } from "@/lib/useUserRole";
import type { Conference } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

export function ConferencesPage() {
  const authUser = getAuthUserInfo();
  const { isOrganizer, isStudent } = useUserRole(authUser?.roleCode);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [query, setQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");
  const [dateStartFilter, setDateStartFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");
  const [page, setPage] = useState(1);
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
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    const needle = query.trim().toLowerCase();
    return conferences.filter(item => {
      if (needle && !item.title.toLowerCase().includes(needle)) return false;
      if (formatFilter !== "all" && item.format !== formatFilter) return false;
      if (dateStartFilter && item.start_date < dateStartFilter) return false;
      if (dateEndFilter && item.end_date > dateEndFilter) return false;
      return true;
    });
  }, [conferences, dateEndFilter, dateStartFilter, formatFilter, query]);
  const perPage = 6;
  const totalPages = Math.max(1, Math.ceil(visibleConferences.length / perPage));
  const paginatedConferences = useMemo(() => {
    const start = (page - 1) * perPage;
    return visibleConferences.slice(start, start + perPage);
  }, [page, visibleConferences]);
  useEffect(() => {
    setPage(1);
  }, [query, formatFilter, dateStartFilter, dateEndFilter]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const canSubmit =
    form.title.trim() && form.startDate && form.endDate && form.format;

  const handleCreateClick = () => {
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
    setSubmitMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
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
    setSubmitMessage(null);
    setIsModalOpen(false);
  };

  const submitConference = async () => {
    setSubmitState("saving");
    setSubmitMessage(null);
    try {
      const token = getAuthToken();
      if (!token) throw new Error("missing token");
      const response = await fetch(`${API_BASE_URL}/api/conf/conferences/`, {
        method: "POST",
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
      setConferences(current => [created, ...current]);
      setSubmitState("saved");
      setSubmitMessage("Конференция создана.");
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
      setIsModalOpen(false);
    } catch (error) {
      setSubmitState("error");
      setSubmitMessage("Не удалось сохранить конференцию. Повторите попытку или проверьте подключение.");
    }
  };

  const deleteConference = async (id: number) => {
    if (!window.confirm("Удалить конференцию? Участники потеряют доступ к её материалам.")) return;
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
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {isStudent ? "заявка на участие" : "все конференции"}
          </p>
          <h1 className="text-3xl font-semibold">
            {isStudent ? "Выберите конференцию" : "Каталог событий"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isStudent
              ? "Найдите конференцию, чтобы подать заявку со своим проектом."
              : "Список конференций с быстрым доступом к карточкам и секциям."}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span
            className={`rounded-full px-3 py-1 ${
              state === "ready" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {state === "ready" ? "данные загружены" : "загрузка"}
          </span>
          {isOrganizer ? <Button onClick={handleCreateClick}>Создать</Button> : null}
        </div>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Поиск и фильтры</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Поиск</Label>
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Название конференции"
            />
          </div>
          <div className="space-y-2">
            <Label>Формат</Label>
            <Select value={formatFilter} onValueChange={setFormatFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Все форматы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все форматы</SelectItem>
                <SelectItem value="online">Онлайн</SelectItem>
                <SelectItem value="hybrid">Гибрид</SelectItem>
                <SelectItem value="offline">Очный</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Дата начала (от)</Label>
            <Input
              type="date"
              value={dateStartFilter}
              onChange={event => setDateStartFilter(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Дата окончания (до)</Label>
            <Input
              type="date"
              value={dateEndFilter}
              onChange={event => setDateEndFilter(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <p className="text-xs text-muted-foreground">
              {visibleConferences.length}{" "}
              {visibleConferences.length === 1 ? "конференция" : "конференции"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {state === "loading" && !conferences.length ? (
          <Card className="border-border/70 bg-card/80">
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              Загружаем список конференций…
            </CardContent>
          </Card>
        ) : paginatedConferences.length ? (
          paginatedConferences.map(conf => (
            <Card key={conf.id} className="border-border/70 bg-card/80">
              <CardHeader className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {formatDateRange(conf.start_date, conf.end_date)}
                </p>
                <CardTitle className="text-lg">{conf.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{conf.location || "Место уточняется"}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{formatFormat(conf)}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/conferences/${conf.id}`}>Карточка</Link>
                  </Button>
                  {isStudent ? (
                    <Button size="sm" asChild>
                      <Link href={`/conferences/${conf.id}/projects?create=1`}>Подать заявку</Link>
                    </Button>
                  ) : null}
                  {isOrganizer ? (
                    <Button size="sm" variant="outline" onClick={() => deleteConference(conf.id)}>
                      Удалить
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-border/70 bg-card/80">
            <CardContent className="p-6">
              <EmptyState
                title="Пока нет конференций"
                description={
                  isOrganizer
                    ? "Создайте первую конференцию, чтобы участники могли подать заявку."
                    : "Список конференций появится, когда организатор их добавит."
                }
                actionLabel={isOrganizer ? "Создать конференцию" : undefined}
                onAction={isOrganizer ? handleCreateClick : undefined}
              />
            </CardContent>
          </Card>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          Показано {paginatedConferences.length} из {visibleConferences.length}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            Назад
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Вперёд
          </Button>
        </div>
      </div>

      {isOrganizer && isModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-3 sm:p-4">
          <div className="flex min-h-full items-start justify-center py-3 sm:items-center sm:py-6">
          <Card className="w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-hidden border-border/70 bg-card shadow-xl flex flex-col">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">
                  Новая конференция
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Заполните основные параметры конференции.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Закрыть
              </Button>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4 text-sm text-muted-foreground">
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
                  <Select value={form.format} onValueChange={value => setForm(current => ({ ...current, format: value }))}>
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
                    onChange={event => setForm(current => ({ ...current, winnersCount: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Призёры в секции</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.prizesCount}
                    onChange={event => setForm(current => ({ ...current, prizesCount: event.target.value }))}
                  />
                </div>
              </div>
              {submitMessage ? <p className="text-xs text-muted-foreground">{submitMessage}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button className="w-full md:w-auto" disabled={!canSubmit || submitState === "saving"} onClick={submitConference}>
                  {submitState === "saving" ? "Сохраняем…" : "Создать конференцию"}
                </Button>
                <Button className="w-full md:w-auto" variant="outline" onClick={closeModal}>
                  Отмена
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      ) : null}
    </section>
  );
}
