import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { Conference, EvaluationCriterion } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function CriteriaPage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [selectedConferenceId, setSelectedConferenceId] = useState<string>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [form, setForm] = useState({
    conferenceId: "",
    name: "",
    description: "",
    stage: "online",
    maxScore: "10",
  });

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetchList<Conference>("/api/conf/conferences/", controller.signal),
      fetchList<EvaluationCriterion>("/api/conf/criteria/", controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return;
      if (results[0].status === "fulfilled") setConferences(results[0].value);
      if (results[1].status === "fulfilled") setCriteria(results[1].value);
    });
    return () => controller.abort();
  }, []);

  const filteredCriteria = useMemo(() => {
    if (selectedConferenceId === "all") return criteria;
    return criteria.filter(item => String(item.conference?.id) === selectedConferenceId);
  }, [criteria, selectedConferenceId]);

  const submitCriterion = async () => {
    setMessage(null);
    if (!form.conferenceId || !form.name.trim()) {
      setMessage("Заполните конференцию и название критерия.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен организатора.");
      return;
    }
    const endpoint = editingId ? `/api/conf/criteria/${editingId}/` : "/api/conf/criteria/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        conference_id: Number(form.conferenceId),
        name: form.name,
        description: form.description || null,
        stage: form.stage,
        max_score: Number(form.maxScore),
      }),
    });
    if (!response.ok) {
      setMessage("Не удалось сохранить критерий.");
      return;
    }
    const created = (await response.json()) as EvaluationCriterion;
    setCriteria(current =>
      editingId ? current.map(item => (item.id === editingId ? created : item)) : [created, ...current],
    );
    setForm({ conferenceId: "", name: "", description: "", stage: "online", maxScore: "10" });
    setEditingId(null);
    setMessage(editingId ? "Критерий обновлен." : "Критерий создан.");
    setIsCriteriaModalOpen(false);
  };

  const startEdit = (item: EvaluationCriterion) => {
    setEditingId(item.id);
    setForm({
      conferenceId: item.conference?.id ? String(item.conference.id) : "",
      name: item.name,
      description: item.description ?? "",
      stage: item.stage,
      maxScore: String(item.max_score),
    });
    setIsCriteriaModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ conferenceId: "", name: "", description: "", stage: "online", maxScore: "10" });
    setIsCriteriaModalOpen(false);
  };

  const openCreateCriterion = () => {
    setEditingId(null);
    setForm({ conferenceId: "", name: "", description: "", stage: "online", maxScore: "10" });
    setMessage(null);
    setIsCriteriaModalOpen(true);
  };

  const deleteCriterion = async (id: number) => {
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/criteria/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage("Не удалось удалить критерий.");
      return;
    }
    setCriteria(current => current.filter(item => item.id !== id));
    if (editingId === id) cancelEdit();
    setMessage("Критерий удален.");
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">критерии</p>
          <h1 className="text-3xl font-semibold">Критерии оценки</h1>
        </div>
        <Button onClick={openCreateCriterion}>Создать критерий</Button>
      </div>

      {isCriteriaModalOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-4xl border-border/70 bg-card/80">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">
              {editingId ? "Редактирование критерия" : "Новый критерий"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              Закрыть
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <Label>Конференция</Label>
            <Select
              value={form.conferenceId || undefined}
              onValueChange={value => setForm({ ...form, conferenceId: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите конференцию" />
              </SelectTrigger>
              <SelectContent>
                {conferences.map(conf => (
                  <SelectItem key={conf.id} value={String(conf.id)}>
                    {conf.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Название</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Этап</Label>
            <Select value={form.stage} onValueChange={value => setForm({ ...form, stage: value })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Этап" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Заочный</SelectItem>
                <SelectItem value="offline">Очный</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Максимум баллов</Label>
            <Input
              type="number"
              value={form.maxScore}
              onChange={e => setForm({ ...form, maxScore: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Описание</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Button onClick={submitCriterion}>{editingId ? "Сохранить" : "Создать"}</Button>
              {editingId ? (
                <Button variant="outline" onClick={cancelEdit}>
                  Отмена
                </Button>
              ) : null}
            </div>
          </div>
          {message ? <p className="col-span-full">{message}</p> : null}
        </CardContent>
      </Card>
      </div>
      ) : null}

      <Card className="border-border/70 bg-card/80">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg">Список критериев</CardTitle>
            <p className="text-sm text-muted-foreground">Фильтр по конференции</p>
          </div>
          <Select value={selectedConferenceId} onValueChange={setSelectedConferenceId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Все конференции" />
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
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 text-sm text-muted-foreground">
          {filteredCriteria.length ? (
            filteredCriteria.map(item => (
              <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                <p className="font-semibold text-foreground">{item.name}</p>
                <p>{item.conference?.title || "Конференция не указана"}</p>
                <p>Этап: {item.stage === "online" ? "заочный" : "очный"}</p>
                <p>Макс.: {item.max_score}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(item)}>
                    Редактировать
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteCriterion(item.id)}>
                    Удалить
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p>Критерии не найдены.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
