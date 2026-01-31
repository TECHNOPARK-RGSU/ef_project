import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { EducationalOrganization, Role, User } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function UsersPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [orgs, setOrgs] = useState<EducationalOrganization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    email: "",
    password: "",
    roleId: "",
    orgId: "none",
  });

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetchList<Role>("/api/users/roles/", controller.signal),
      fetchList<EducationalOrganization>("/api/users/educational_organizations/", controller.signal),
      fetchList<User>("/api/users/users/", controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return;
      if (results[0].status === "fulfilled") setRoles(results[0].value);
      if (results[1].status === "fulfilled") setOrgs(results[1].value);
      if (results[2].status === "fulfilled") setUsers(results[2].value);
    });
    return () => controller.abort();
  }, []);

  const submitUser = async () => {
    setMessage(null);
    if (!form.lastName.trim() || !form.firstName.trim() || !form.roleId) {
      setMessage("Заполните фамилию, имя и роль.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен организатора.");
      return;
    }
    const endpoint = editingId ? `/api/users/users/${editingId}/` : "/api/users/users/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        last_name: form.lastName,
        first_name: form.firstName,
        email: form.email || null,
        password: form.password || undefined,
        role_id: Number(form.roleId),
        educational_organization_id: form.orgId === "none" ? null : Number(form.orgId),
      }),
    });
    if (!response.ok) {
      setMessage("Не удалось сохранить пользователя.");
      return;
    }
    const created = (await response.json()) as User;
    setUsers(current =>
      editingId ? current.map(user => (user.id === editingId ? created : user)) : [created, ...current],
    );
    setForm({ lastName: "", firstName: "", email: "", password: "", roleId: "", orgId: "none" });
    setEditingId(null);
    setMessage(editingId ? "Пользователь обновлен." : "Пользователь создан.");
  };

  const startEdit = (user: User) => {
    setEditingId(user.id);
    setForm({
      lastName: user.last_name ?? "",
      firstName: user.first_name ?? "",
      email: user.email ?? "",
      password: "",
      roleId: user.role?.id ? String(user.role.id) : "",
      orgId: user.educational_organization?.id ? String(user.educational_organization.id) : "none",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ lastName: "", firstName: "", email: "", password: "", roleId: "", orgId: "none" });
  };

  const deleteUser = async (id: number) => {
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/users/users/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage("Не удалось удалить пользователя.");
      return;
    }
    setUsers(current => current.filter(user => user.id !== id));
    if (editingId === id) cancelEdit();
    setMessage("Пользователь удален.");
  };

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));
  }, [users]);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">пользователи</p>
        <h1 className="text-3xl font-semibold">Управление пользователями</h1>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">
            {editingId ? "Редактирование пользователя" : "Создать пользователя"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <Label>Фамилия</Label>
            <Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Имя</Label>
            <Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Пароль</Label>
            <Input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Роль</Label>
            <Select
              value={form.roleId || undefined}
              onValueChange={value => setForm({ ...form, roleId: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите роль" />
              </SelectTrigger>
              <SelectContent>
                {roles.length ? (
                  roles.map(role => (
                    <SelectItem key={role.id} value={String(role.id)}>
                      {role.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="0" disabled>
                    Нет ролей
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Организация</Label>
            <Select value={form.orgId} onValueChange={value => setForm({ ...form, orgId: value })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Опционально" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без организации</SelectItem>
                {orgs.map(org => (
                  <SelectItem key={org.id} value={String(org.id)}>
                    {org.short_name || org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Button onClick={submitUser}>{editingId ? "Сохранить" : "Создать"}</Button>
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

      <div className="grid gap-4 md:grid-cols-3">
        {sortedUsers.length ? (
          sortedUsers.map(user => (
            <Card key={user.id} className="border-border/70 bg-card/80">
              <CardHeader>
                <CardTitle className="text-lg">
                  {user.last_name} {user.first_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>{user.email || "Email не указан"}</p>
                <p>Роль: {user.role?.name || "Не назначена"}</p>
                <p>{user.educational_organization?.short_name || "Организация не указана"}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(user)}>
                    Редактировать
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteUser(user.id)}>
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-border/70 bg-card/80">
            <CardContent className="p-6 text-sm text-muted-foreground">Пользователей пока нет.</CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
