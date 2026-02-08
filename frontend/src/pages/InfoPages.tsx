import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function StaticInfo({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Проект учебный. Информация будет опубликована позже.</p>
        </CardContent>
      </Card>
    </section>
  );
}

export function PolicyPage() {
  return <StaticInfo title="Политика" />;
}

export function ContactsPage() {
  return <StaticInfo title="Контакты" />;
}

export function DocumentsPage() {
  return <StaticInfo title="Документы" />;
}
