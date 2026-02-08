import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken, getAuthUserInfo } from "@/lib/auth";
import type { Comment, Project, User } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";

export function CommentsPage() {
  const [, paramsFromRoute] = useRoute("/conferences/:id/comments");
  const conferenceIdFromRoute = paramsFromRoute?.id ? Number(paramsFromRoute.id) : null;
  const authUser = getAuthUserInfo();
  const roleCode = (authUser?.roleCode ?? "").toLowerCase();
  const isOrganizerRole = roleCode === "organizer";
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [form, setForm] = useState({
    projectId: "",
    authorId: "none",
    text: "",
  });
  const filteredComments = useMemo(() => {
    if (conferenceIdFromRoute == null) return comments;
    return comments.filter(
      c => c.project?.section?.conference?.id === conferenceIdFromRoute,
    );
  }, [comments, conferenceIdFromRoute]);
  const projectsForSelect = useMemo(() => {
    if (conferenceIdFromRoute == null) return projects;
    return projects.filter(
      p => p.section?.conference?.id === conferenceIdFromRoute,
    );
  }, [projects, conferenceIdFromRoute]);
  const COMMENTS_PER_PAGE = 10;
  const [commentsPage, setCommentsPage] = useState(1);
  const commentsTotalPages = Math.max(1, Math.ceil(filteredComments.length / COMMENTS_PER_PAGE));
  const paginatedComments = useMemo(() => {
    const start = (commentsPage - 1) * COMMENTS_PER_PAGE;
    return filteredComments.slice(start, start + COMMENTS_PER_PAGE);
  }, [commentsPage, filteredComments]);
  useEffect(() => {
    if (commentsPage > commentsTotalPages) setCommentsPage(1);
  }, [commentsPage, commentsTotalPages]);
  const allowedAuthors = useMemo(
    () =>
      users.filter(user => {
        const code = (user.role?.code ?? "").toLowerCase();
        return code === "organizer" || code === "expert" || code === "tutor";
      }),
    [users],
  );

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetchList<Project>("/api/conf/projects/", controller.signal),
      fetchList<User>("/api/users/users/", controller.signal),
      fetchList<Comment>("/api/conf/comments/", controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return;
      if (results[0].status === "fulfilled") setProjects(results[0].value);
      if (results[1].status === "fulfilled") setUsers(results[1].value);
      if (results[2].status === "fulfilled") setComments(results[2].value);
    });
    return () => controller.abort();
  }, []);

  const submitComment = async () => {
    setMessage(null);
    if (!form.projectId || !form.text.trim()) {
      setMessage("Выберите проект и заполните текст.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен эксперта или организатора.");
      return;
    }
    const endpoint = editingId ? `/api/conf/comments/${editingId}/` : "/api/conf/comments/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        project_id: Number(form.projectId),
        author_id: isOrganizerRole
          ? (form.authorId === "none" ? null : Number(form.authorId))
          : (authUser?.id ?? null),
        text: form.text,
      }),
    });
    if (!response.ok) {
      setMessage("Не удалось сохранить комментарий.");
      return;
    }
    const created = (await response.json()) as Comment;
    setComments(current =>
      editingId ? current.map(item => (item.id === editingId ? created : item)) : [created, ...current],
    );
    setForm({ projectId: "", authorId: "none", text: "" });
    setEditingId(null);
    setMessage(editingId ? "Комментарий обновлен." : "Комментарий создан.");
    setIsCommentModalOpen(false);
  };

  const startEdit = (item: Comment) => {
    setEditingId(item.id);
    setForm({
      projectId: String(item.project.id),
      authorId: item.author?.id ? String(item.author.id) : "none",
      text: item.text,
    });
    setIsCommentModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ projectId: "", authorId: "none", text: "" });
    setIsCommentModalOpen(false);
  };

  const openCreateComment = () => {
    setEditingId(null);
    setForm({ projectId: "", authorId: "none", text: "" });
    setMessage(null);
    setIsCommentModalOpen(true);
  };

  const deleteComment = async (id: number) => {
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/comments/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage("Не удалось удалить комментарий.");
      return;
    }
    setComments(current => current.filter(item => item.id !== id));
    if (editingId === id) cancelEdit();
    setMessage("Комментарий удален.");
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">комментарии</p>
          <h1 className="text-3xl font-semibold">Комментарии экспертов</h1>
        </div>
        <div className="flex items-center gap-2">
          {conferenceIdFromRoute != null ? (
            <Button variant="outline" asChild>
              <Link href={`/conferences/${conferenceIdFromRoute}`}>← К конференции</Link>
            </Button>
          ) : null}
          <Button onClick={openCreateComment}>Создать комментарий</Button>
        </div>
      </div>

      {isCommentModalOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-3xl border-border/70 bg-card shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">
              {editingId ? "Редактирование комментария" : "Новый комментарий"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              Закрыть
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <Label>Проект</Label>
            <Select value={form.projectId || undefined} onValueChange={value => setForm({ ...form, projectId: value })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите проект" />
              </SelectTrigger>
              <SelectContent>
                {projectsForSelect.map(project => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isOrganizerRole ? (
            <div className="space-y-2">
              <Label>Автор</Label>
              <Select value={form.authorId} onValueChange={value => setForm({ ...form, authorId: value })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Опционально" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без автора</SelectItem>
                  {allowedAuthors.map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.last_name} {user.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2 md:col-span-3">
            <Label>Комментарий</Label>
            <Textarea
              value={form.text}
              onChange={event => setForm({ ...form, text: event.target.value })}
              className="min-h-[120px]"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={submitComment}>{editingId ? "Сохранить" : "Создать"}</Button>
            {editingId ? (
              <Button variant="outline" onClick={cancelEdit}>
                Отмена
              </Button>
            ) : null}
          </div>
          {message ? <p className="col-span-full">{message}</p> : null}
        </CardContent>
      </Card>
      </div>
      ) : null}

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {paginatedComments.length ? (
            paginatedComments.map(item => (
              <Card key={item.id} className="border-border/70 bg-card/80">
                <CardHeader>
                  <CardTitle className="text-lg">{item.project.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>{item.text}</p>
                  <p>Автор: {item.author ? `${item.author.last_name} ${item.author.first_name}` : "—"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => startEdit(item)}>
                      Редактировать
                    </Button>
                    {isOrganizerRole ? (
                      <Button size="sm" variant="outline" onClick={() => deleteComment(item.id)}>
                        Удалить
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-border/70 bg-card/80 md:col-span-2">
              <CardContent className="p-6 text-sm text-muted-foreground">
                {conferenceIdFromRoute != null && comments.length > 0
                  ? "По этой конференции комментариев нет."
                  : "Комментариев пока нет."}
              </CardContent>
            </Card>
          )}
        </div>
        {filteredComments.length > COMMENTS_PER_PAGE ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              Показано {paginatedComments.length} из {filteredComments.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={commentsPage <= 1}
                onClick={() => setCommentsPage(p => Math.max(1, p - 1))}
              >
                Назад
              </Button>
              <span>
                {commentsPage} / {commentsTotalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={commentsPage >= commentsTotalPages}
                onClick={() => setCommentsPage(p => Math.min(commentsTotalPages, p + 1))}
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
