import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { EducationalOrganization, Role, User } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";

type UsersPageProps = {
  initialEditingId?: number | null;
  isEditPage?: boolean;
};

function UsersPageBase({ initialEditingId, isEditPage = false }: UsersPageProps) {
  const [, setLocation] = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [initialEditHandled, setInitialEditHandled] = useState(false);
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
      fetchList<EducationalOrganization>("/api/users/educational-organizations/", controller.signal),
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
    const isCreate = !editingId;
    if (!form.lastName.trim() || !form.firstName.trim() || !form.roleId) {
      setMessage("Заполните фамилию, имя и роль.");
      return;
    }
    if (isCreate && !form.email.trim()) {
      setMessage("Для создания пользователя нужен email.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен организатора.");
      return;
    }
    const endpoint = editingId ? `/api/users/users/${editingId}/` : "/api/users/users/";
    const payload: Record<string, unknown> = {
      last_name: form.lastName,
      first_name: form.firstName,
      role_id: Number(form.roleId),
      educational_organization_id: form.orgId === "none" ? null : Number(form.orgId),
    };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.password.trim()) payload.password = form.password.trim();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let details = "Не удалось сохранить пользователя.";
      try {
        const data = (await response.json()) as Record<string, string[] | string>;
        const errors = Object.values(data)
          .flatMap(value => (Array.isArray(value) ? value : [value]))
          .filter(Boolean)
          .join(" ");
        if (errors) details = errors;
      } catch {
        // ignore parsing errors
      }
      if (response.status === 403) {
        details = "Недостаточно прав для изменения пользователей.";
      }
      setMessage(details);
      return;
    }
    const created = (await response.json()) as User;
    setUsers(current =>
      editingId ? current.map(user => (user.id === editingId ? created : user)) : [created, ...current],
    );
    setForm({ lastName: "", firstName: "", email: "", password: "", roleId: "", orgId: "none" });
    setEditingId(null);
    setMessage(editingId ? "Пользователь обновлен." : "Пользователь создан.");
    setIsModalOpen(false);
    if (isEditPage) {
      setLocation("/users");
    }
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
    setIsModalOpen(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ lastName: "", firstName: "", email: "", password: "", roleId: "", orgId: "none" });
    setIsModalOpen(false);
    setMessage(null);
    if (isEditPage) {
      setLocation("/users");
    }
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

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return sortedUsers;
    const query = searchQuery.trim().toLowerCase();
    return sortedUsers.filter(user => {
      const parts = [
        user.last_name,
        user.first_name,
        user.email,
        user.role?.name,
        user.educational_organization?.short_name,
        user.educational_organization?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return parts.includes(query);
    });
  }, [searchQuery, sortedUsers]);

  const groupedUsers = useMemo(() => {
    return filteredUsers.reduce<Record<string, User[]>>((acc, user) => {
      const key = user.role?.name || "Без роли";
      if (!acc[key]) acc[key] = [];
      acc[key].push(user);
      return acc;
    }, {});
  }, [filteredUsers]);

  useEffect(() => {
    if (!initialEditingId || initialEditHandled) return;
    if (!users.length) return;
    const target = users.find(user => user.id === initialEditingId);
    if (target) {
      startEdit(target);
      setInitialEditHandled(true);
    } else {
      setMessage("Пользователь для редактирования не найден.");
      setInitialEditHandled(true);
    }
  }, [initialEditingId, initialEditHandled, users]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ lastName: "", firstName: "", email: "", password: "", roleId: "", orgId: "none" });
    setIsModalOpen(true);
    setMessage(null);
  };

  const openEditModal = (user: User) => {
    startEdit(user);
    if (!isEditPage) {
      setLocation(`/users/${user.id}`);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">пользователи</p>
        <h1 className="text-3xl font-semibold">Управление пользователями</h1>
        </div>
        <Button onClick={openCreateModal}>Создать пользователя</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Поиск пользователя</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="space-y-2">
              <Label>Поиск</Label>
              <Input
                placeholder="Имя, email, роль или организация"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
              />
            </div>
            <p>Найдено: {filteredUsers.length}</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Список пользователей</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {filteredUsers.length ? (
              Object.entries(groupedUsers).map(([group, groupUsers]) => (
                <div key={group} className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{group}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {groupUsers.map(user => (
                      <div key={user.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                        <p className="font-semibold text-foreground">
                          {user.last_name} {user.first_name}
                        </p>
                        <p>{user.email || "Email не указан"}</p>
                        <p>{user.educational_organization?.short_name || "Организация не указана"}</p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button size="sm" variant="secondary" onClick={() => openEditModal(user)}>
                            Редактировать
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => deleteUser(user.id)}>
                            Удалить
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p>Пользователи не найдены.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-lg border border-border/60 bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? "Редактирование пользователя" : "Создать пользователя"}
              </h2>
              <Button variant="ghost" size="sm" onClick={cancelEdit}>
                Закрыть
              </Button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm text-muted-foreground">
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
                <Select value={form.roleId || undefined} onValueChange={value => setForm({ ...form, roleId: value })}>
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
            </div>
            {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
            <div className="mt-4 flex items-center gap-2">
              <Button onClick={submitUser}>{editingId ? "Сохранить" : "Создать"}</Button>
              <Button variant="outline" onClick={cancelEdit}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function UsersPage() {
  return <UsersPageBase />;
}

export function UsersEditPage() {
  const [, params] = useRoute("/users/:id");
  const id = params?.id ? Number(params.id) : null;
  return <UsersPageBase initialEditingId={id} isEditPage />;
}
