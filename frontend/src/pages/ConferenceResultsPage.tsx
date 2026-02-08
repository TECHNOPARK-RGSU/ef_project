import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_BASE_URL, fetchList, fetchOne } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { Conference, ProjectResult } from "@/lib/types";
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";

export function ConferenceResultsPage() {
  const [, params] = useRoute("/conferences/:id/results");
  const id = params?.id ? Number(params.id) : null;
  const [conference, setConference] = useState<Conference | null>(null);
  const [results, setResults] = useState<ProjectResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setState("loading");
    Promise.all([
      fetchOne<Conference>(`/api/conf/conferences/${id}/`, controller.signal),
      fetchList<ProjectResult>(`/api/conf/results/?conference=${id}`, controller.signal),
    ])
      .then(([conf, res]) => {
        if (controller.signal.aborted) return;
        setConference(conf ?? null);
        setResults(Array.isArray(res) ? res : []);
        setState(conf ? "ready" : "error");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [id]);

  const runCalculation = async () => {
    if (!id) return;
    if (!window.confirm("Пересчитать результаты по всем оценкам? Текущие результаты будут заменены.")) return;
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен для расчёта результатов.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/conferences/${id}/calculate_results/`, {
      method: "POST",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage("Не удалось рассчитать результаты.");
      return;
    }
    const updated = await fetchList<ProjectResult>(`/api/conf/results/?conference=${id}`);
    setResults(updated);
    setMessage("Результаты пересчитаны.");
  };

  const publishResults = async () => {
    if (!id) return;
    if (!window.confirm("Опубликовать результаты? После публикации их увидят участники, наставники и эксперты. Отменить публикацию будет нельзя.")) return;
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен для публикации результатов.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/conferences/${id}/publish_results/`, {
      method: "POST",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage("Не удалось опубликовать результаты.");
      return;
    }
    if (conference) setConference({ ...conference, results_published: true });
    setMessage("Результаты опубликованы.");
  };

  const downloadResults = async (format: "csv" | "xlsx") => {
    if (!id) return;
    if (!window.confirm(`Скачать экспорт результатов в формате ${format.toUpperCase()}?`)) return;
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен для экспорта.");
      return;
    }
    const endpoint = format === "csv" ? "export_results" : "export_results_excel";
    const response = await fetch(`${API_BASE_URL}/api/conf/conferences/${id}/${endpoint}/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage("Не удалось скачать файл.");
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conference_${id}_results.${format}`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const openPrintProtocol = async () => {
    if (!id) return;
    if (!window.confirm("Открыть протокол результатов в новом окне для печати?")) return;
    setMessage(null);
    const token = getAuthToken();
    if (!token) {
      setMessage("Нужен токен для печати протокола.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/conferences/${id}/print_protocol/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setMessage("Не удалось открыть протокол.");
      return;
    }
    const html = await response.text();
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setMessage("Браузер заблокировал окно печати.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  if (!id) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-6 text-sm text-muted-foreground">Некорректный идентификатор конференции.</CardContent>
      </Card>
    );
  }

  if (state === "loading" || (state === "ready" && !conference)) {
    return (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-6 text-sm text-muted-foreground">
          {state === "loading" ? "Загрузка…" : "Конференция не найдена."}
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">результаты конференции</p>
          <h1 className="text-2xl font-semibold">{conference?.title ?? "Конференция"}</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/conferences/${id}`}>← К карточке конференции</Link>
        </Button>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Публикация и доступ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Статус: <strong className="text-foreground">{conference?.results_published ? "опубликованы" : "черновик"}</strong></p>
          <p>Опубликованные результаты видят участники, наставники и эксперты.</p>
          {message ? <p className="text-primary">{message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={runCalculation}>
              Пересчитать
            </Button>
            <Button onClick={publishResults} disabled={conference?.results_published}>
              Опубликовать
            </Button>
            <Button variant="outline" onClick={() => downloadResults("csv")}>
              Экспорт CSV
            </Button>
            <Button variant="outline" onClick={() => downloadResults("xlsx")}>
              Экспорт XLSX
            </Button>
            <Button variant="outline" onClick={openPrintProtocol}>
              Протокол
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 ? (
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Итоговая таблица ({results.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto text-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 pr-2">Секция</th>
                    <th className="py-1.5 pr-2">Проект</th>
                    <th className="py-1.5 pr-2">Итог</th>
                    <th className="py-1.5 pr-2">Место</th>
                    <th className="py-1.5">Результат</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 50).map(r => (
                    <tr key={r.id} className="border-b border-border/40">
                      <td className="py-1.5 pr-2">{r.section?.name ?? "—"}</td>
                      <td className="py-1.5 pr-2">{r.project?.title ?? "—"}</td>
                      <td className="py-1.5 pr-2">{r.total_score}</td>
                      <td className="py-1.5 pr-2">{r.rank}</td>
                      <td className="py-1.5">{r.is_winner ? "Победитель" : r.is_prize ? "Призёр" : "Участник"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {results.length > 50 ? <p className="mt-2 text-xs text-muted-foreground">Показаны первые 50. Полный список — в экспорте или протоколе.</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
