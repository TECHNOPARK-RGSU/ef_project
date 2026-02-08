import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserModal } from "@/components/users/UserModal";
import { fetchList, fetchOne } from "@/lib/api";
import { getRoleLabel } from "@/lib/roles";
import type { EducationalOrganization, Role, User } from "@/lib/types";
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";

export function UserDetailPage() {
  const [, params] = useRoute("/users/:id");
  const id = params?.id ? Number(params.id) : null;
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [orgs, setOrgs] = useState<EducationalOrganization[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!id) {
      setState("error");
      return;
    }
    const controller = new AbortController();
    setState("loading");
    Promise.allSettled([
      fetchOne<User>(`/api/users/users/${id}/`, controller.signal),
      fetchList<Role>("/api/users/roles/", controller.signal),
      fetchList<EducationalOrganization>("/api/users/educational-organizations/", controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return;
      const [userResult, rolesResult, orgsResult] = results;
      if (userResult.status === "fulfilled") setUser(userResult.value);
      if (rolesResult.status === "fulfilled") setRoles(rolesResult.value);
      if (orgsResult.status === "fulfilled") setOrgs(orgsResult.value);
      setState(userResult.status === "fulfilled" && userResult.value ? "ready" : "error");
    });
    return () => controller.abort();
  }, [id]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">пользователь</p>
          <h1 className="text-3xl font-semibold">Карточка пользователя</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/users">К списку</Link>
          </Button>
          <Button onClick={() => setIsModalOpen(true)} disabled={!user}>
            Редактировать
          </Button>
        </div>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Данные пользователя</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {state === "loading" ? (
            <p>Загружаем профиль…</p>
          ) : user ? (
            <>
              <p className="text-base font-semibold text-foreground">
                {[user.last_name, user.first_name, user.middle_name].filter(Boolean).join(" ")}
              </p>
              <p>Email: {user.email || "не указан"}</p>
              <p>Роль: {getRoleLabel(user.role)}</p>
              <p>Организация: {user.educational_organization?.short_name || "не указана"}</p>
              <p>Телефон: {user.phone || "не указан"}</p>
              <p>Город: {user.city || "не указан"}</p>
            </>
          ) : (
            <p>Пользователь не найден.</p>
          )}
        </CardContent>
      </Card>

      <UserModal
        open={isModalOpen}
        roles={roles}
        orgs={orgs}
        initialUser={user}
        onClose={() => setIsModalOpen(false)}
        onSaved={updated => {
          setUser(updated);
          setIsModalOpen(false);
        }}
      />
    </section>
  );
}
