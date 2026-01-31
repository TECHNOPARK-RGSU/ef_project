import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { useEffect, useState } from "react";

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [form, setForm] = useState({ name: "", code: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchList<Role>("/api/users/roles/", controller.signal).then(setRoles).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const submitRole = async () => {
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен организатора.");
      return;
    }
    const endpoint = editingId ? `/api/users/roles/${editingId}/` : "/api/users/roles/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({ name: form.name, code: form.code }),
    });
    if (!response.ok) {
      setMessage("Не удалось сохранить роль.");
      return;
    }
    const created = (await response.json()) as Role;
    setRoles(current =>
      editingId ? current.map(role => (role.id === editingId ? created : role)) : [created, ...current],
    );
    setForm({ name: "", code: "" });
    setEditingId(null);
    setMessage(editingId ? "Роль обновлена." : "Роль создана.");
  };

  const startEdit = (role: Role) => {
    setEditingId(role.id);
    setForm({ name: role.name, code: role.code });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ name: "", code: "" });
  };

  const deleteRole = async (id: number) => {
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/users/roles/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage("Не удалось удалить роль.");
      return;
    }
    setRoles(current => current.filter(role => role.id !== id));
    if (editingId === id) cancelEdit();
    setMessage("Роль удалена.");
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">роли</p>
        <h1 className="text-3xl font-semibold">Управление ролями</h1>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">
            {editingId ? "Редактирование роли" : "Новая роль"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <Label>Название</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Код</Label>
            <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={submitRole}>{editingId ? "Сохранить" : "Создать"}</Button>
            {editingId ? (
              <Button variant="outline" onClick={cancelEdit}>
                Отмена
              </Button>
            ) : null}
          </div>
          {message ? <p className="col-span-full">{message}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {roles.map(role => (
          <Card key={role.id} className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="text-lg">{role.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>{role.code}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => startEdit(role)}>
                  Редактировать
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteRole(role.id)}>
                  Удалить
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
