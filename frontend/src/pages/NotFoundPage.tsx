import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export function NotFoundPage() {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle className="text-2xl">Страница не найдена</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>Такого пути нет. Вернитесь на главную страницу.</p>
        <Button asChild>
          <Link href="/">На главную</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
