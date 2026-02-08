import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL } from "@/lib/api";
import { PHONE_COUNTRY_CODES } from "@/lib/phoneCountries";
import { getAssetUrl } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import projectarisLogo from "@/assets/projectaris-logo.svg";
import { Link } from "wouter";

const REGISTRATION_ROLES = [
  { value: "student", label: "Ученик" },
  { value: "tutor", label: "Наставник" },
  { value: "expert", label: "Эксперт" },
] as const;

const DEFAULT_PHONE_CODE = "7";

function getPhoneMaxLength(code: string): number {
  if (code === "7") return 10;
  if (code === "1") return 10;
  return 15;
}

/** Форматирует только национальную часть номера (без кода страны). */
function formatPhoneDisplay(digits: string, countryCode: string): string {
  const maxLen = getPhoneMaxLength(countryCode);
  let d = digits.replace(/\D/g, "").slice(0, maxLen);
  if (d.length === 0) return "";
  if (countryCode === "7") {
    if (d.startsWith("8")) d = d.slice(1);
    if (d.startsWith("7")) d = d.slice(1);
    const ten = d.slice(0, 10);
    if (ten.length <= 3) return `(${ten}`;
    if (ten.length <= 6) return `(${ten.slice(0, 3)}) ${ten.slice(3)}`;
    return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6, 8)}-${ten.slice(8, 10)}`;
  }
  const groups: string[] = [];
  for (let i = 0; i < d.length; i += 3) groups.push(d.slice(i, i + 3));
  return groups.join(" ");
}

/** Из отображаемой национальной части извлекает только цифры. */
function phoneToDigits(display: string, countryCode: string): string {
  const d = display.replace(/\D/g, "");
  if (countryCode === "7") {
    if (d.startsWith("8")) return d.slice(1, 11);
    if (d.startsWith("7")) return d.slice(1, 11);
    return d.slice(0, 10);
  }
  return d.slice(0, getPhoneMaxLength(countryCode));
}

function getPhonePlaceholder(countryCode: string): string {
  if (countryCode === "7") return "(999) 999-99-99";
  return "999 999 99 99";
}

/** Количество цифр в строке до позиции pos (не включая pos). */
function digitCountBefore(str: string, pos: number): number {
  let count = 0;
  for (let i = 0; i < pos && i < str.length; i++) {
    if (/\d/.test(str.charAt(i))) count++;
  }
  return count;
}

/** Позиция в отформатированной строке после digitCount цифр. */
function cursorAfterDigits(formatted: string, digitCount: number): number {
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted.charAt(i))) {
      count++;
      if (count === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

function validateEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(trimmed) && trimmed.length <= 254;
}

function validatePhoneDigits(digits: string, countryCode: string): boolean {
  if (digits.length === 0) return true;
  const max = getPhoneMaxLength(countryCode);
  if (countryCode === "7") return digits.length === 10 && /^[0-9]{10}$/.test(digits);
  return digits.length >= 4 && digits.length <= max && /^[0-9]+$/.test(digits);
}

function phoneDigitsToApi(digits: string, countryCode: string): string {
  if (digits.length === 0) return "";
  return "+" + countryCode + digits;
}

type FormErrors = Partial<Record<string, string>>;

export function RegisterPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const pendingPhoneCursorRef = useRef<number | null>(null);
  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    middleName: "",
    email: "",
    password: "",
    confirmPassword: "",
    roleCode: "student",
    phoneCountryCode: DEFAULT_PHONE_CODE,
    phone: "",
    city: "",
  });

  const setPhone = (value: string, cursorStart?: number) => {
    const code = form.phoneCountryCode || DEFAULT_PHONE_CODE;
    const digits = phoneToDigits(value, code);
    const formatted = formatPhoneDisplay(digits, code);
    if (typeof cursorStart === "number" && cursorStart >= 0) {
      const digitsBefore = digitCountBefore(value, cursorStart);
      pendingPhoneCursorRef.current = cursorAfterDigits(formatted, digitsBefore);
    } else {
      pendingPhoneCursorRef.current = null;
    }
    setForm(current => ({ ...current, phone: formatted }));
    if (errors.phone) setErrors(e => ({ ...e, phone: undefined }));
  };

  const setPhoneCountry = (code: string) => {
    const digits = phoneToDigits(form.phone, form.phoneCountryCode || DEFAULT_PHONE_CODE);
    const formatted = formatPhoneDisplay(digits, code);
    setForm(current => ({ ...current, phoneCountryCode: code, phone: formatted }));
    if (errors.phone) setErrors(e => ({ ...e, phone: undefined }));
  };

  useEffect(() => {
    const input = phoneInputRef.current;
    const pending = pendingPhoneCursorRef.current;
    if (input && typeof pending === "number") {
      pendingPhoneCursorRef.current = null;
      input.setSelectionRange(pending, pending);
    }
  }, [form.phone]);

  const runValidation = (): boolean => {
    const e: FormErrors = {};
    if (!form.lastName.trim()) e.lastName = "Укажите фамилию.";
    if (!form.firstName.trim()) e.firstName = "Укажите имя.";
    if (!form.email.trim()) e.email = "Укажите email.";
    else if (!validateEmail(form.email)) e.email = "Некорректный формат email.";
    if (!form.password) e.password = "Укажите пароль.";
    else if (form.password.length < 6) e.password = "Минимум 6 символов.";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Пароли не совпадают.";
    const code = form.phoneCountryCode || DEFAULT_PHONE_CODE;
    const phoneDigits = phoneToDigits(form.phone, code);
    if (phoneDigits.length > 0 && !validatePhoneDigits(phoneDigits, code)) {
      e.phone = code === "7" ? "Введите номер в формате (999) 999-99-99." : "Введите корректный номер.";
    }
    setErrors(e);
    setMessage(Object.keys(e).length > 0 ? "Исправьте ошибки в форме." : null);
    return Object.keys(e).length === 0;
  };

  const submitRegistration = async () => {
    setMessage(null);
    setErrors({});
    if (!runValidation()) return;

    const response = await fetch(`${API_BASE_URL}/api/users/users/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        last_name: form.lastName.trim(),
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim() || "",
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role_code: form.roleCode,
        phone: phoneDigitsToApi(
          phoneToDigits(form.phone, form.phoneCountryCode || DEFAULT_PHONE_CODE),
          form.phoneCountryCode || DEFAULT_PHONE_CODE,
        ),
        city: form.city.trim(),
      }),
    });
    if (!response.ok) {
      let details = "Не удалось зарегистрироваться.";
      try {
        const data = (await response.json()) as Record<string, string[] | string>;
        const list = Object.entries(data).flatMap(([k, v]) =>
          (Array.isArray(v) ? v : [v]).map(s => (s ? `${k}: ${s}` : "")).filter(Boolean),
        );
        if (list.length) details = list.join(" ");
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
      roleCode: "student",
      phoneCountryCode: DEFAULT_PHONE_CODE,
      phone: "",
      city: "",
    });
    setErrors({});
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
          <p className="text-sm text-muted-foreground">Поля со звёздочкой обязательны</p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Фамилия <span className="text-destructive">*</span></Label>
              <Input
                value={form.lastName}
                onChange={e => {
                  setForm(c => ({ ...c, lastName: e.target.value }));
                  if (errors.lastName) setErrors(err => ({ ...err, lastName: undefined }));
                }}
                placeholder="Иванов"
                className={errors.lastName ? "border-destructive" : ""}
              />
              {errors.lastName ? <p className="text-xs text-destructive">{errors.lastName}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Имя <span className="text-destructive">*</span></Label>
              <Input
                value={form.firstName}
                onChange={e => {
                  setForm(c => ({ ...c, firstName: e.target.value }));
                  if (errors.firstName) setErrors(err => ({ ...err, firstName: undefined }));
                }}
                placeholder="Иван"
                className={errors.firstName ? "border-destructive" : ""}
              />
              {errors.firstName ? <p className="text-xs text-destructive">{errors.firstName}</p> : null}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Отчество</Label>
              <Input
                value={form.middleName}
                onChange={e => setForm(c => ({ ...c, middleName: e.target.value }))}
                placeholder="Иванович"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={e => {
                  setForm(c => ({ ...c, email: e.target.value }));
                  if (errors.email) setErrors(err => ({ ...err, email: undefined }));
                }}
                placeholder="example@mail.ru"
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Роль <span className="text-destructive">*</span></Label>
              <Select
                value={form.roleCode}
                onValueChange={value => setForm(c => ({ ...c, roleCode: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите роль" />
                </SelectTrigger>
                <SelectContent>
                  {REGISTRATION_ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5" />
            <div className="space-y-1.5">
              <Label>Пароль <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => {
                    setForm(c => ({ ...c, password: e.target.value }));
                    if (errors.password) setErrors(err => ({ ...err, password: undefined }));
                  }}
                  placeholder="Минимум 6 символов"
                  className={`pr-9 ${errors.password ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password ? <p className="text-xs text-destructive">{errors.password}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label>Повтор пароля <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={e => {
                    setForm(c => ({ ...c, confirmPassword: e.target.value }));
                    if (errors.confirmPassword) setErrors(err => ({ ...err, confirmPassword: undefined }));
                  }}
                  placeholder="Повторите пароль"
                  className={`pr-9 ${errors.confirmPassword ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.confirmPassword ? <p className="text-xs text-destructive">{errors.confirmPassword}</p> : null}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Телефон</Label>
              <div className="flex gap-2">
                <Select
                  value={form.phoneCountryCode}
                  onValueChange={setPhoneCountry}
                >
                  <SelectTrigger className="w-[140px] shrink-0">
                    <SelectValue placeholder="Код" />
                  </SelectTrigger>
                  <SelectContent>
                    {PHONE_COUNTRY_CODES.map((c, i) => (
                      <SelectItem key={`${c.code}-${c.name}-${i}`} value={c.code}>
                        +{c.code} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  ref={phoneInputRef}
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={e => {
                    const el = e.target;
                    setPhone(el.value, el.selectionStart ?? undefined);
                  }}
                  onBlur={() => {
                    const code = form.phoneCountryCode || DEFAULT_PHONE_CODE;
                    const digits = phoneToDigits(form.phone, code);
                    if (digits.length > 0 && !validatePhoneDigits(digits, code)) {
                      setErrors(err => ({ ...err, phone: code === "7" ? "Формат: (999) 999-99-99" : "Введите корректный номер" }));
                    }
                  }}
                  placeholder={getPhonePlaceholder(form.phoneCountryCode || DEFAULT_PHONE_CODE)}
                  className={`flex-1 ${errors.phone ? "border-destructive" : ""}`}
                />
              </div>
              {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Город</Label>
              <Input
                value={form.city}
                onChange={e => setForm(c => ({ ...c, city: e.target.value }))}
                placeholder="Москва"
              />
            </div>
          </div>
          {message ? (
            <p className={`text-sm ${message.includes("создана") ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
              {message}
            </p>
          ) : null}
          <Button onClick={submitRegistration} className="w-full sm:w-auto">Создать аккаунт</Button>
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
