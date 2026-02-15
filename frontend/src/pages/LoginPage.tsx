import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL } from "@/lib/api";
import { setAuthToken, setAuthUserInfo } from "@/lib/auth";
import { getAssetUrl } from "@/lib/utils";
import { useState } from "react";
import projectarisLogo from "@/assets/projectaris-logo.svg";
import { Link } from "wouter";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const loadMe = async (token: string) => {
    const meUrl = `${API_BASE_URL}/api/users/me/?_=${Date.now()}`;
    const response = await fetch(meUrl, {
      cache: "no-store",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) return;
    const data = (await response.json()) as {
      id: number;
      role?: { code?: string | null } | null;
      first_name?: string | null;
      last_name?: string | null;
    };
    setAuthUserInfo({
      id: data.id,
      roleCode: (data.role?.code ?? "").toLowerCase(),
      firstName: data.first_name ?? undefined,
      lastName: data.last_name ?? undefined,
    });
  };

  const login = async () => {
    setMessage(null);
    if (!email || !password) {
      setMessage("Введите e-mail и пароль.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password }),
    });
    if (!response.ok) {
      setMessage("Не удалось войти. Проверьте данные.");
      return;
    }
    const data = (await response.json()) as { token?: string };
    if (!data.token) {
      setMessage("Токен не получен.");
      return;
    }
    setAuthToken(data.token);
    await loadMe(data.token);
    window.location.href = "/";
  };

  return (
    <section className="mx-auto max-w-md">
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <div className="mb-2 flex items-center gap-3">
            <img src={getAssetUrl(projectarisLogo)} alt="Projectaris" className="size-10 rounded-full border border-border/60 bg-background/80 p-1" />
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">projectaris</p>
          </div>
          <CardTitle className="text-2xl">Вход</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={email} onChange={event => setEmail(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Пароль</Label>
            <Input type="password" value={password} onChange={event => setPassword(event.target.value)} />
          </div>
          <Button onClick={login}>Войти</Button>
          {message ? <p>{message}</p> : null}
          <p className="text-xs text-muted-foreground">
            Нет аккаунта?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
