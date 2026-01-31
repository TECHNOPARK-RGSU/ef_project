import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { Conference, ExpertAssignment } from "@/lib/types";
import { useEffect, useState } from "react";

export function AssignmentsPage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [assignments, setAssignments] = useState<ExpertAssignment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    conferenceId: "",
    stage: "online",
    perExpert: "3",
  });

  const refreshAssignments = async () => {
    try {
      const items = await fetchList<ExpertAssignment>("/api/conf/assignments/");
      setAssignments(items);
    } catch {
      setAssignments([]);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetchList<Conference>("/api/conf/conferences/", controller.signal),
      fetchList<ExpertAssignment>("/api/conf/assignments/", controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return;
      if (results[0].status === "fulfilled") setConferences(results[0].value);
      if (results[1].status === "fulfilled") setAssignments(results[1].value);
    });
    return () => controller.abort();
  }, []);

  const assignProjects = async () => {
    setMessage(null);
    if (!form.conferenceId) {
      setMessage("Выберите конференцию.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(
      `${API_BASE_URL}/api/conf/conferences/${form.conferenceId}/assign_projects/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({
          stage: form.stage,
          per_expert: Number(form.perExpert),
        }),
      },
    );
    if (!response.ok) {
      setMessage("Не удалось распределить работы.");
      return;
    }
    const data = await response.json();
    setMessage(`Распределено: ${data.assigned}. Осталось: ${data.remaining}.`);
    await refreshAssignments();
  };

  const downloadZip = async (assignmentId: number) => {
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/assignments/${assignmentId}/download_zip/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage("Не удалось скачать архив.");
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `assignment_${assignmentId}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">назначения</p>
        <h1 className="text-3xl font-semibold">Распределение работ</h1>
        <p className="text-sm text-muted-foreground">
          Организатор распределяет проекты между экспертами, эксперты видят свои задания.
        </p>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Распределить автоматически</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <Label>Конференция</Label>
            <Select value={form.conferenceId || undefined} onValueChange={value => setForm({ ...form, conferenceId: value })}>
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
            <Label>Работ на эксперта</Label>
            <Input
              type="number"
              min="1"
              value={form.perExpert}
              onChange={event => setForm({ ...form, perExpert: event.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={assignProjects}>Распределить</Button>
          </div>
          {message ? <p className="col-span-full">{message}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {assignments.length ? (
          assignments.map(assignment => (
            <Card key={assignment.id} className="border-border/70 bg-card/80">
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg">
                  {assignment.expert.last_name} {assignment.expert.first_name}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{assignment.conference.title}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {assignment.stage === "online" ? "заочный этап" : "очный этап"}
                </p>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-3">
                <p>Назначено: {assignment.items?.length ?? 0}</p>
                <Button size="sm" variant="secondary" onClick={() => downloadZip(assignment.id)}>
                  Скачать ZIP
                </Button>
                <div className="space-y-2">
                  {assignment.items?.length ? (
                    assignment.items.map(item => (
                      <div key={item.id} className="rounded-md border border-border/60 bg-background/70 p-2">
                        <p className="font-semibold text-foreground">{item.project.title}</p>
                        <p>Секция: {item.project.section?.name || "не указана"}</p>
                        {assignment.stage === "offline" ? (
                          <p>
                            Аудитория: {item.place?.name || "не указана"}{" "}
                            {item.place?.address ? `(${item.place.address})` : ""}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p>Работ пока нет.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-border/70 bg-card/80">
            <CardContent className="p-6 text-sm text-muted-foreground">Назначений пока нет.</CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
