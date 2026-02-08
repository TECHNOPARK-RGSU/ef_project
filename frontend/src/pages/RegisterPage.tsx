import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL } from "@/lib/api";
import { getAssetUrl } from "@/lib/utils";
import { useState } from "react";
import projectarisLogo from "@/assets/projectaris-logo.svg";
import { Link } from "wouter";

export function RegisterPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    middleName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    city: "",
  });

  const submitRegistration = async () => {
    setMessage(null);
    if (!form.lastName.trim() || !form.firstName.trim() || !form.email.trim()) {
      setMessage("Заполните фамилию, имя и email.");
      return;
    }
    if (!form.password.trim()) {
      setMessage("Укажите пароль.");
      return;
    }
    if (form.password.length < 6) {
      setMessage("Пароль слишком короткий. Минимум 6 символов.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage("Пароли не совпадают.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
      setMessage("Укажите корректный email.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/users/users/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        last_name: form.lastName.trim(),
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim() || "",
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        city: form.city.trim(),
      }),
    });
    if (!response.ok) {
      let details = "Не удалось зарегистрироваться.";
      try {
        const data = (await response.json()) as Record<string, string[] | string>;
        const errors = Object.values(data)
          .flatMap(value => (Array.isArray(value) ? value : [value]))
          .filter(Boolean)
          .join(" ");
        if (errors) details = errors;
      } catch {
        // ignore
      }
      setMessage(details);
      return;
    }
    setMessage("Учетная запись создана. Перейдите к входу.");
    setForm({
      lastName: "",
      firstName: "",
      middleName: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
      city: "",
    });
  };

  return (
    <section className="mx-auto max-w-md space-y-4">
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <div className="mb-2 flex items-center gap-3">
            <img
              src={getAssetUrl(projectarisLogo)}
              alt="Projectaris"
              className="size-10 rounded-full border border-border/60 bg-background/80 p-1"
            />
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">projectaris</p>
          </div>
          <CardTitle className="text-2xl">Регистрация</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Фамилия</Label>
              <Input
                value={form.lastName}
                onChange={event => setForm(current => ({ ...current, lastName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Имя</Label>
              <Input
                value={form.firstName}
                onChange={event => setForm(current => ({ ...current, firstName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Отчество</Label>
              <Input
                value={form.middleName}
                onChange={event => setForm(current => ({ ...current, middleName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Пароль</Label>
              <Input
                type="password"
                value={form.password}
                onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Повтор пароля</Label>
              <Input
                type="password"
                value={form.confirmPassword}
                onChange={event => setForm(current => ({ ...current, confirmPassword: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Телефон</Label>
              <Input
                value={form.phone}
                onChange={event => setForm(current => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Город</Label>
              <Input
                value={form.city}
                onChange={event => setForm(current => ({ ...current, city: event.target.value }))}
              />
            </div>
          </div>
          <Button onClick={submitRegistration}>Создать аккаунт</Button>
          {message ? <p>{message}</p> : null}
          <p className="text-xs text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Войти
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
