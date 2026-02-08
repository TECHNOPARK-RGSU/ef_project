import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { getRoleLabel, normalizeRoleCode } from "@/lib/roles";
import type { EducationalOrganization, Role, User } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type UserModalProps = {
  open: boolean;
  roles: Role[];
  orgs: EducationalOrganization[];
  initialUser?: User | null;
  onClose: () => void;
  onSaved: (user: User, isCreate: boolean) => void;
};

const getRoleOptions = (roles: Role[]) => {
  const studentRole = roles.find(role => normalizeRoleCode(role.code) === "student");
  const nonStudents = roles.filter(role => normalizeRoleCode(role.code) !== "student");
  return studentRole ? [studentRole, ...nonStudents] : nonStudents;
};

export function UserModal({ open, roles, orgs, initialUser, onClose, onSaved }: UserModalProps) {
  const isEditing = Boolean(initialUser?.id);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    email: "",
    password: "",
    roleId: "",
    orgId: "none",
  });

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    setForm({
      lastName: initialUser?.last_name ?? "",
      firstName: initialUser?.first_name ?? "",
      email: initialUser?.email ?? "",
      password: "",
      roleId: initialUser?.role?.id ? String(initialUser.role.id) : "",
      orgId: initialUser?.educational_organization?.id ? String(initialUser.educational_organization.id) : "none",
    });
  }, [initialUser, open]);

  const roleOptions = useMemo(() => getRoleOptions(roles), [roles]);

  const submitUser = async () => {
    setMessage(null);
    const isCreate = !isEditing;
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
    const endpoint = isEditing ? `/api/users/users/${initialUser?.id}/` : "/api/users/users/";
    const payload: Record<string, unknown> = {
      last_name: form.lastName,
      first_name: form.firstName,
      role_id: Number(form.roleId),
      educational_organization_id: form.orgId === "none" ? null : Number(form.orgId),
    };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.password.trim()) payload.password = form.password.trim();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: isEditing ? "PATCH" : "POST",
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
    onSaved(created, isCreate);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-3xl border-border/60 bg-card shadow-xl">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">
              {isEditing ? "Редактирование пользователя" : "Создание пользователя"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isEditing ? "Обновите данные пользователя." : "Заполните основные данные и выберите роль."}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="grid gap-4 md:grid-cols-3">
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
                  {roleOptions.length ? (
                    roleOptions.map(role => (
                      <SelectItem key={role.id} value={String(role.id)}>
                        {getRoleLabel(role)}
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
          {message ? <p>{message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button onClick={submitUser}>{isEditing ? "Сохранить изменения" : "Создать пользователя"}</Button>
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
