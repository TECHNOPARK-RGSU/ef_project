import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import type { EvaluationCriterion, Project, ProjectScore, User } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function ScoresPage() {
  const authUser = getAuthUserInfo();
  const roleCode = (authUser?.roleCode ?? "").toLowerCase();
  const isOrganizerRole = roleCode === "organizer";
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [scores, setScores] = useState<ProjectScore[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    projectId: "",
    criterionId: "",
    evaluatorId: "none",
    score: "",
  });
  const expertUsers = useMemo(
    () => users.filter(user => (user.role?.code ?? "").toLowerCase() === "expert"),
    [users],
  );

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetchList<EvaluationCriterion>("/api/conf/criteria/", controller.signal),
      fetchList<Project>("/api/conf/projects/", controller.signal),
      fetchList<User>("/api/users/users/", controller.signal),
      fetchList<ProjectScore>("/api/conf/scores/", controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return;
      if (results[0].status === "fulfilled") setCriteria(results[0].value);
      if (results[1].status === "fulfilled") setProjects(results[1].value);
      if (results[2].status === "fulfilled") setUsers(results[2].value);
      if (results[3].status === "fulfilled") setScores(results[3].value);
    });
    return () => controller.abort();
  }, []);

  const submitScore = async () => {
    setMessage(null);
    if (!form.projectId || !form.criterionId || !form.score) {
      setMessage("Заполните проект, критерий и баллы.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен эксперта или организатора.");
      return;
    }
    const endpoint = editingId ? `/api/conf/scores/${editingId}/` : "/api/conf/scores/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        project_id: Number(form.projectId),
        criterion_id: Number(form.criterionId),
        evaluator_id: isOrganizerRole
          ? (form.evaluatorId === "none" ? null : Number(form.evaluatorId))
          : (authUser?.id ?? null),
        score: Number(form.score),
      }),
    });
    if (!response.ok) {
      setMessage("Не удалось сохранить оценку.");
      return;
    }
    const created = (await response.json()) as ProjectScore;
    setScores(current =>
      editingId ? current.map(item => (item.id === editingId ? created : item)) : [created, ...current],
    );
    setForm({ projectId: "", criterionId: "", evaluatorId: "none", score: "" });
    setEditingId(null);
    setMessage(editingId ? "Оценка обновлена." : "Оценка сохранена.");
  };

  const startEdit = (score: ProjectScore) => {
    setEditingId(score.id);
    setForm({
      projectId: String(score.project.id),
      criterionId: String(score.criterion.id),
      evaluatorId: score.evaluator?.id ? String(score.evaluator.id) : "none",
      score: String(score.score),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ projectId: "", criterionId: "", evaluatorId: "none", score: "" });
  };

  const deleteScore = async (id: number) => {
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен эксперта или организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/scores/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage("Не удалось удалить оценку.");
      return;
    }
    setScores(current => current.filter(item => item.id !== id));
    if (editingId === id) cancelEdit();
    setMessage("Оценка удалена.");
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">оценки</p>
        <h1 className="text-3xl font-semibold">Оценки проектов</h1>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">
            {editingId ? "Редактирование оценки" : "Новая оценка"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <Label>Проект</Label>
            <Select
              value={form.projectId || undefined}
              onValueChange={value => setForm({ ...form, projectId: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите проект" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Критерий</Label>
            <Select
              value={form.criterionId || undefined}
              onValueChange={value => setForm({ ...form, criterionId: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите критерий" />
              </SelectTrigger>
              <SelectContent>
                {criteria.map(item => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isOrganizerRole ? (
            <div className="space-y-2">
              <Label>Оценщик</Label>
              <Select value={form.evaluatorId} onValueChange={value => setForm({ ...form, evaluatorId: value })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Опционально" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без оценщика</SelectItem>
                  {expertUsers.map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.last_name} {user.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Баллы</Label>
            <Input
              type="number"
              value={form.score}
              onChange={e => setForm({ ...form, score: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Button onClick={submitScore}>{editingId ? "Сохранить" : "Создать"}</Button>
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

      <div className="grid gap-4 md:grid-cols-2">
        {scores.length ? (
          scores.map(score => (
            <Card key={score.id} className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="text-lg">{score.project.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>Критерий: {score.criterion.name}</p>
                <p>Оценщик: {score.evaluator ? `${score.evaluator.last_name} ${score.evaluator.first_name}` : "—"}</p>
                <p>Баллы: {score.score}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(score)}>
                    Редактировать
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteScore(score.id)}>
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-border/70 bg-card/80">
            <CardContent className="p-6 text-sm text-muted-foreground">Оценок пока нет.</CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
