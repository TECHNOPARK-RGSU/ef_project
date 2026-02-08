import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserModal } from "@/components/users/UserModal";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { getRoleLabel } from "@/lib/roles";
import type { EducationalOrganization, Role, User } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

export function UsersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [orgs, setOrgs] = useState<EducationalOrganization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    Promise.allSettled([
      fetchList<Role>("/api/users/roles/", controller.signal),
      fetchList<EducationalOrganization>("/api/users/educational-organizations/", controller.signal),
      fetchList<User>("/api/users/users/", controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return;
      if (results[0].status === "fulfilled") setRoles(results[0].value);
      if (results[1].status === "fulfilled") setOrgs(results[1].value);
      if (results[2].status === "fulfilled") setUsers(results[2].value);
      setLoadState(results.every(result => result.status === "fulfilled") ? "ready" : "error");
    });
    return () => controller.abort();
  }, []);

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
        getRoleLabel(user.role),
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
      const key = getRoleLabel(user.role);
      if (!acc[key]) acc[key] = [];
      acc[key].push(user);
      return acc;
    }, {});
  }, [filteredUsers]);

  const openCreateModal = () => {
    setEditingUser(null);
    setIsModalOpen(true);
    setMessage(null);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
    setMessage(null);
  };

  const handleSaved = (user: User, isCreate: boolean) => {
    setUsers(current => (isCreate ? [user, ...current] : current.map(item => (item.id === user.id ? user : item))));
    setMessage(isCreate ? "Пользователь создан." : "Пользователь обновлен.");
    setEditingUser(null);
    setIsModalOpen(false);
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

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Поиск пользователя</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="space-y-2">
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
            {loadState === "loading" ? (
              <p>Загружаем пользователей…</p>
            ) : loadState === "error" ? (
              <p>Не удалось загрузить пользователей.</p>
            ) : filteredUsers.length ? (
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
                        <p>Роль: {getRoleLabel(user.role)}</p>
                        <p>{user.educational_organization?.short_name || "Организация не указана"}</p>
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button size="sm" variant="secondary" asChild>
                            <Link href={`/users/${user.id}`}>Открыть</Link>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEditModal(user)}>
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
              <p>Ничего не найдено.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <UserModal
        open={isModalOpen}
        roles={roles}
        orgs={orgs}
        initialUser={editingUser}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
        }}
        onSaved={handleSaved}
      />
    </section>
  );
}
