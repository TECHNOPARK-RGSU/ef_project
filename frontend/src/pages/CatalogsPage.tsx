import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL, fetchList } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type {
  AgeCategory,
  EducationalOrganization,
  ParticipationStage,
  Place,
  PresentationType,
  ProjectStatus,
} from "@/lib/types";
import { useEffect, useState } from "react";

export function CatalogsPage() {
  const [categories, setCategories] = useState<AgeCategory[]>([]);
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [stages, setStages] = useState<ParticipationStage[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [presentationTypes, setPresentationTypes] = useState<PresentationType[]>([]);
  const [organizations, setOrganizations] = useState<EducationalOrganization[]>([]);

  const [categoryForm, setCategoryForm] = useState({ name: "", minAge: "", maxAge: "" });
  const [categoryEditingId, setCategoryEditingId] = useState<number | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);

  const [statusForm, setStatusForm] = useState({ name: "", code: "" });
  const [statusEditingId, setStatusEditingId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [stageForm, setStageForm] = useState({ name: "", code: "" });
  const [stageEditingId, setStageEditingId] = useState<number | null>(null);
  const [stageMessage, setStageMessage] = useState<string | null>(null);

  const [placeForm, setPlaceForm] = useState({ name: "", address: "" });
  const [placeEditingId, setPlaceEditingId] = useState<number | null>(null);
  const [placeMessage, setPlaceMessage] = useState<string | null>(null);

  const [presentationForm, setPresentationForm] = useState({ name: "", code: "", placeId: "" });
  const [presentationEditingId, setPresentationEditingId] = useState<number | null>(null);
  const [presentationMessage, setPresentationMessage] = useState<string | null>(null);

  const [orgForm, setOrgForm] = useState({
    name: "",
    shortName: "",
    city: "",
    address: "",
    website: "",
  });
  const [orgEditingId, setOrgEditingId] = useState<number | null>(null);
  const [orgMessage, setOrgMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      fetchList<AgeCategory>("/api/conf/age-categories/", controller.signal),
      fetchList<ProjectStatus>("/api/conf/project-statuses/", controller.signal),
      fetchList<ParticipationStage>("/api/conf/participation-stages/", controller.signal),
      fetchList<Place>("/api/conf/places/", controller.signal),
      fetchList<PresentationType>("/api/conf/presentation-types/", controller.signal),
      fetchList<EducationalOrganization>("/api/users/educational_organizations/", controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return;
      if (results[0].status === "fulfilled") setCategories(results[0].value);
      if (results[1].status === "fulfilled") setStatuses(results[1].value);
      if (results[2].status === "fulfilled") setStages(results[2].value);
      if (results[3].status === "fulfilled") setPlaces(results[3].value);
      if (results[4].status === "fulfilled") setPresentationTypes(results[4].value);
      if (results[5].status === "fulfilled") setOrganizations(results[5].value);
    });
    return () => controller.abort();
  }, []);

  const saveCategory = async () => {
    setCategoryMessage(null);
    if (!categoryForm.name.trim()) {
      setCategoryMessage("Введите название категории.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setCategoryMessage("Нужен токен организатора.");
      return;
    }
    const minAge = categoryForm.minAge ? Number(categoryForm.minAge) : null;
    const maxAge = categoryForm.maxAge ? Number(categoryForm.maxAge) : null;
    const endpoint = categoryEditingId
      ? `/api/conf/age-categories/${categoryEditingId}/`
      : "/api/conf/age-categories/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: categoryEditingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        name: categoryForm.name,
        min_age: minAge,
        max_age: maxAge,
      }),
    });
    if (!response.ok) {
      setCategoryMessage("Не удалось сохранить категорию.");
      return;
    }
    const created = (await response.json()) as AgeCategory;
    setCategories(current =>
      categoryEditingId
        ? current.map(item => (item.id === categoryEditingId ? created : item))
        : [created, ...current],
    );
    setCategoryForm({ name: "", minAge: "", maxAge: "" });
    setCategoryEditingId(null);
    setCategoryMessage(categoryEditingId ? "Категория обновлена." : "Категория создана.");
  };

  const editCategory = (item: AgeCategory) => {
    setCategoryEditingId(item.id);
    setCategoryForm({
      name: item.name,
      minAge: item.min_age === null ? "" : String(item.min_age),
      maxAge: item.max_age === null ? "" : String(item.max_age),
    });
  };

  const deleteCategory = async (id: number) => {
    setCategoryMessage(null);
    const token = getAuthToken();
    if (!token) {
      setCategoryMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/age-categories/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setCategoryMessage("Не удалось удалить категорию.");
      return;
    }
    setCategories(current => current.filter(item => item.id !== id));
    if (categoryEditingId === id) {
      setCategoryEditingId(null);
      setCategoryForm({ name: "", minAge: "", maxAge: "" });
    }
    setCategoryMessage("Категория удалена.");
  };

  const saveStatus = async () => {
    setStatusMessage(null);
    if (!statusForm.name.trim() || !statusForm.code.trim()) {
      setStatusMessage("Заполните название и код.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setStatusMessage("Нужен токен организатора.");
      return;
    }
    const endpoint = statusEditingId
      ? `/api/conf/project-statuses/${statusEditingId}/`
      : "/api/conf/project-statuses/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: statusEditingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({ name: statusForm.name, code: statusForm.code }),
    });
    if (!response.ok) {
      setStatusMessage("Не удалось сохранить статус.");
      return;
    }
    const created = (await response.json()) as ProjectStatus;
    setStatuses(current =>
      statusEditingId
        ? current.map(item => (item.id === statusEditingId ? created : item))
        : [created, ...current],
    );
    setStatusForm({ name: "", code: "" });
    setStatusEditingId(null);
    setStatusMessage(statusEditingId ? "Статус обновлен." : "Статус создан.");
  };

  const editStatus = (item: ProjectStatus) => {
    setStatusEditingId(item.id);
    setStatusForm({ name: item.name, code: item.code });
  };

  const deleteStatus = async (id: number) => {
    setStatusMessage(null);
    const token = getAuthToken();
    if (!token) {
      setStatusMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/project-statuses/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setStatusMessage("Не удалось удалить статус.");
      return;
    }
    setStatuses(current => current.filter(item => item.id !== id));
    if (statusEditingId === id) {
      setStatusEditingId(null);
      setStatusForm({ name: "", code: "" });
    }
    setStatusMessage("Статус удален.");
  };

  const saveStage = async () => {
    setStageMessage(null);
    if (!stageForm.name.trim() || !stageForm.code.trim()) {
      setStageMessage("Заполните название и код.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setStageMessage("Нужен токен организатора.");
      return;
    }
    const endpoint = stageEditingId
      ? `/api/conf/participation-stages/${stageEditingId}/`
      : "/api/conf/participation-stages/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: stageEditingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({ name: stageForm.name, code: stageForm.code }),
    });
    if (!response.ok) {
      setStageMessage("Не удалось сохранить этап.");
      return;
    }
    const created = (await response.json()) as ParticipationStage;
    setStages(current =>
      stageEditingId
        ? current.map(item => (item.id === stageEditingId ? created : item))
        : [created, ...current],
    );
    setStageForm({ name: "", code: "" });
    setStageEditingId(null);
    setStageMessage(stageEditingId ? "Этап обновлен." : "Этап создан.");
  };

  const editStage = (item: ParticipationStage) => {
    setStageEditingId(item.id);
    setStageForm({ name: item.name, code: item.code });
  };

  const deleteStage = async (id: number) => {
    setStageMessage(null);
    const token = getAuthToken();
    if (!token) {
      setStageMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/participation-stages/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setStageMessage("Не удалось удалить этап.");
      return;
    }
    setStages(current => current.filter(item => item.id !== id));
    if (stageEditingId === id) {
      setStageEditingId(null);
      setStageForm({ name: "", code: "" });
    }
    setStageMessage("Этап удален.");
  };

  const savePlace = async () => {
    setPlaceMessage(null);
    if (!placeForm.name.trim()) {
      setPlaceMessage("Введите название места.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setPlaceMessage("Нужен токен организатора.");
      return;
    }
    const endpoint = placeEditingId ? `/api/conf/places/${placeEditingId}/` : "/api/conf/places/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: placeEditingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({ name: placeForm.name, address: placeForm.address || null }),
    });
    if (!response.ok) {
      setPlaceMessage("Не удалось сохранить место.");
      return;
    }
    const created = (await response.json()) as Place;
    setPlaces(current =>
      placeEditingId
        ? current.map(item => (item.id === placeEditingId ? created : item))
        : [created, ...current],
    );
    setPlaceForm({ name: "", address: "" });
    setPlaceEditingId(null);
    setPlaceMessage(placeEditingId ? "Место обновлено." : "Место создано.");
  };

  const editPlace = (item: Place) => {
    setPlaceEditingId(item.id);
    setPlaceForm({ name: item.name, address: item.address ?? "" });
  };

  const deletePlace = async (id: number) => {
    setPlaceMessage(null);
    const token = getAuthToken();
    if (!token) {
      setPlaceMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/places/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setPlaceMessage("Не удалось удалить место.");
      return;
    }
    setPlaces(current => current.filter(item => item.id !== id));
    if (placeEditingId === id) {
      setPlaceEditingId(null);
      setPlaceForm({ name: "", address: "" });
    }
    setPlaceMessage("Место удалено.");
  };

  const savePresentationType = async () => {
    setPresentationMessage(null);
    if (!presentationForm.name.trim() || !presentationForm.code.trim()) {
      setPresentationMessage("Заполните название и код.");
      return;
    }
    if (!presentationForm.placeId) {
      setPresentationMessage("Выберите место.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setPresentationMessage("Нужен токен организатора.");
      return;
    }
    const endpoint = presentationEditingId
      ? `/api/conf/presentation-types/${presentationEditingId}/`
      : "/api/conf/presentation-types/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: presentationEditingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        name: presentationForm.name,
        code: presentationForm.code,
        place_id: Number(presentationForm.placeId),
      }),
    });
    if (!response.ok) {
      setPresentationMessage("Не удалось сохранить тип.");
      return;
    }
    const created = (await response.json()) as PresentationType;
    setPresentationTypes(current =>
      presentationEditingId
        ? current.map(item => (item.id === presentationEditingId ? created : item))
        : [created, ...current],
    );
    setPresentationForm({ name: "", code: "", placeId: "" });
    setPresentationEditingId(null);
    setPresentationMessage(presentationEditingId ? "Тип обновлен." : "Тип создан.");
  };

  const editPresentationType = (item: PresentationType) => {
    setPresentationEditingId(item.id);
    setPresentationForm({
      name: item.name,
      code: item.code,
      placeId: item.place?.id ? String(item.place.id) : "",
    });
  };

  const deletePresentationType = async (id: number) => {
    setPresentationMessage(null);
    const token = getAuthToken();
    if (!token) {
      setPresentationMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/conf/presentation-types/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setPresentationMessage("Не удалось удалить тип.");
      return;
    }
    setPresentationTypes(current => current.filter(item => item.id !== id));
    if (presentationEditingId === id) {
      setPresentationEditingId(null);
      setPresentationForm({ name: "", code: "", placeId: "" });
    }
    setPresentationMessage("Тип удален.");
  };

  const saveOrganization = async () => {
    setOrgMessage(null);
    if (!orgForm.name.trim()) {
      setOrgMessage("Введите название организации.");
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setOrgMessage("Нужен токен организатора.");
      return;
    }
    const endpoint = orgEditingId
      ? `/api/users/educational_organizations/${orgEditingId}/`
      : "/api/users/educational_organizations/";
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: orgEditingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
      body: JSON.stringify({
        name: orgForm.name,
        short_name: orgForm.shortName || null,
        city: orgForm.city || null,
        address: orgForm.address || null,
        website: orgForm.website || null,
      }),
    });
    if (!response.ok) {
      setOrgMessage("Не удалось сохранить организацию.");
      return;
    }
    const created = (await response.json()) as EducationalOrganization;
    setOrganizations(current =>
      orgEditingId
        ? current.map(item => (item.id === orgEditingId ? created : item))
        : [created, ...current],
    );
    setOrgForm({ name: "", shortName: "", city: "", address: "", website: "" });
    setOrgEditingId(null);
    setOrgMessage(orgEditingId ? "Организация обновлена." : "Организация создана.");
  };

  const editOrganization = (item: EducationalOrganization) => {
    setOrgEditingId(item.id);
    setOrgForm({
      name: item.name,
      shortName: item.short_name ?? "",
      city: item.city ?? "",
      address: item.address ?? "",
      website: item.website ?? "",
    });
  };

  const deleteOrganization = async (id: number) => {
    setOrgMessage(null);
    const token = getAuthToken();
    if (!token) {
      setOrgMessage("Нужен токен организатора.");
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/users/educational_organizations/${id}/`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    if (!response.ok) {
      setOrgMessage("Не удалось удалить организацию.");
      return;
    }
    setOrganizations(current => current.filter(item => item.id !== id));
    if (orgEditingId === id) {
      setOrgEditingId(null);
      setOrgForm({ name: "", shortName: "", city: "", address: "", website: "" });
    }
    setOrgMessage("Организация удалена.");
  };

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">справочники</p>
        <h1 className="text-3xl font-semibold">Справочники и настройки</h1>
        <p className="text-sm text-muted-foreground">
          Возрастные категории, статусы, этапы, места и организации.
        </p>
      </div>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Возрастные категории</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr] text-sm text-muted-foreground">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Мин. возраст</Label>
                <Input
                  type="number"
                  value={categoryForm.minAge}
                  onChange={e => setCategoryForm({ ...categoryForm, minAge: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Макс. возраст</Label>
                <Input
                  type="number"
                  value={categoryForm.maxAge}
                  onChange={e => setCategoryForm({ ...categoryForm, maxAge: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveCategory}>{categoryEditingId ? "Сохранить" : "Создать"}</Button>
              {categoryEditingId ? (
                <Button variant="outline" onClick={() => {
                  setCategoryEditingId(null);
                  setCategoryForm({ name: "", minAge: "", maxAge: "" });
                }}>
                  Отмена
                </Button>
              ) : null}
            </div>
            {categoryMessage ? <p>{categoryMessage}</p> : null}
          </div>
          <div className="space-y-2">
            {categories.length ? (
              categories.map(item => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p>
                    {item.min_age}–{item.max_age} лет
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => editCategory(item)}>
                      Редактировать
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteCategory(item.id)}>
                      Удалить
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p>Категорий пока нет.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Статусы проектов</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr] text-sm text-muted-foreground">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={statusForm.name} onChange={e => setStatusForm({ ...statusForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Код</Label>
              <Input value={statusForm.code} onChange={e => setStatusForm({ ...statusForm, code: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveStatus}>{statusEditingId ? "Сохранить" : "Создать"}</Button>
              {statusEditingId ? (
                <Button variant="outline" onClick={() => {
                  setStatusEditingId(null);
                  setStatusForm({ name: "", code: "" });
                }}>
                  Отмена
                </Button>
              ) : null}
            </div>
            {statusMessage ? <p>{statusMessage}</p> : null}
          </div>
          <div className="space-y-2">
            {statuses.length ? (
              statuses.map(item => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p>{item.code}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => editStatus(item)}>
                      Редактировать
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteStatus(item.id)}>
                      Удалить
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p>Статусов пока нет.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Этапы участия</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr] text-sm text-muted-foreground">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={stageForm.name} onChange={e => setStageForm({ ...stageForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Код</Label>
              <Input value={stageForm.code} onChange={e => setStageForm({ ...stageForm, code: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveStage}>{stageEditingId ? "Сохранить" : "Создать"}</Button>
              {stageEditingId ? (
                <Button variant="outline" onClick={() => {
                  setStageEditingId(null);
                  setStageForm({ name: "", code: "" });
                }}>
                  Отмена
                </Button>
              ) : null}
            </div>
            {stageMessage ? <p>{stageMessage}</p> : null}
          </div>
          <div className="space-y-2">
            {stages.length ? (
              stages.map(item => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p>{item.code}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => editStage(item)}>
                      Редактировать
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteStage(item.id)}>
                      Удалить
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p>Этапов пока нет.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Места проведения</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr] text-sm text-muted-foreground">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={placeForm.name} onChange={e => setPlaceForm({ ...placeForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Адрес</Label>
              <Input value={placeForm.address} onChange={e => setPlaceForm({ ...placeForm, address: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={savePlace}>{placeEditingId ? "Сохранить" : "Создать"}</Button>
              {placeEditingId ? (
                <Button variant="outline" onClick={() => {
                  setPlaceEditingId(null);
                  setPlaceForm({ name: "", address: "" });
                }}>
                  Отмена
                </Button>
              ) : null}
            </div>
            {placeMessage ? <p>{placeMessage}</p> : null}
          </div>
          <div className="space-y-2">
            {places.length ? (
              places.map(item => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p>{item.address || "Адрес не указан"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => editPlace(item)}>
                      Редактировать
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deletePlace(item.id)}>
                      Удалить
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p>Мест пока нет.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Типы представления</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr] text-sm text-muted-foreground">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={presentationForm.name}
                onChange={e => setPresentationForm({ ...presentationForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Код</Label>
              <Input
                value={presentationForm.code}
                onChange={e => setPresentationForm({ ...presentationForm, code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Место</Label>
              <Select
                value={presentationForm.placeId || undefined}
                onValueChange={value => setPresentationForm({ ...presentationForm, placeId: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выберите место" />
                </SelectTrigger>
                <SelectContent>
                  {places.map(place => (
                    <SelectItem key={place.id} value={String(place.id)}>
                      {place.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={savePresentationType}>{presentationEditingId ? "Сохранить" : "Создать"}</Button>
              {presentationEditingId ? (
                <Button variant="outline" onClick={() => {
                  setPresentationEditingId(null);
                  setPresentationForm({ name: "", code: "", placeId: "" });
                }}>
                  Отмена
                </Button>
              ) : null}
            </div>
            {presentationMessage ? <p>{presentationMessage}</p> : null}
          </div>
          <div className="space-y-2">
            {presentationTypes.length ? (
              presentationTypes.map(item => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p>{item.code}</p>
                  <p>Место: {item.place?.name || "не указано"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => editPresentationType(item)}>
                      Редактировать
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deletePresentationType(item.id)}>
                      Удалить
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p>Типов пока нет.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle className="text-lg">Организации</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr] text-sm text-muted-foreground">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Краткое</Label>
                <Input
                  value={orgForm.shortName}
                  onChange={e => setOrgForm({ ...orgForm, shortName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Город</Label>
                <Input value={orgForm.city} onChange={e => setOrgForm({ ...orgForm, city: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Адрес</Label>
              <Input value={orgForm.address} onChange={e => setOrgForm({ ...orgForm, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Сайт</Label>
              <Input value={orgForm.website} onChange={e => setOrgForm({ ...orgForm, website: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveOrganization}>{orgEditingId ? "Сохранить" : "Создать"}</Button>
              {orgEditingId ? (
                <Button variant="outline" onClick={() => {
                  setOrgEditingId(null);
                  setOrgForm({ name: "", shortName: "", city: "", address: "", website: "" });
                }}>
                  Отмена
                </Button>
              ) : null}
            </div>
            {orgMessage ? <p>{orgMessage}</p> : null}
          </div>
          <div className="space-y-2">
            {organizations.length ? (
              organizations.map(item => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="font-semibold text-foreground">{item.short_name || item.name}</p>
                  <p>{item.city || "Город не указан"}</p>
                  <p>{item.address || "Адрес не указан"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => editOrganization(item)}>
                      Редактировать
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deleteOrganization(item.id)}>
                      Удалить
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p>Организаций пока нет.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
