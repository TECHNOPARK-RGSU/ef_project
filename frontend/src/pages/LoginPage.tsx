import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL } from "@/lib/api";
import { getAuthToken, setAuthToken, setAuthUserInfo } from "@/lib/auth";
import { useState } from "react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tokenValue, setTokenValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const existingToken = getAuthToken();

  const loadMe = async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/api/users/me/`, {
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

  const saveToken = async () => {
    if (!tokenValue.trim()) {
      setMessage("Введите токен.");
      return;
    }
    const token = tokenValue.trim();
    setAuthToken(token);
    await loadMe(token);
    window.location.href = "/";
  };

  return (
    <section className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
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
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Вставить токен вручную</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <Input
              placeholder="Токен доступа"
              value={tokenValue}
              onChange={event => setTokenValue(event.target.value)}
            />
            <Button variant="outline" onClick={saveToken}>
              Сохранить токен
            </Button>
            {existingToken ? (
              <p className="text-xs">Токен уже сохранён. Можно сразу перейти в интерфейс.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Подсказка для демо</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Организатор: organizer@example.com</p>
            <p>Пароль: password123</p>
            <p>Вход обязателен для доступа к разделам.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
