import { SiteLayout } from "@/components/site/Layout";
import { ApplyPage } from "@/pages/ApplyPage";
import { AssignmentsPage } from "@/pages/AssignmentsPage";
import { CatalogsPage } from "@/pages/CatalogsPage";
import { CommentsPage } from "@/pages/CommentsPage";
import { ConferenceDetailPage } from "@/pages/ConferenceDetailPage";
import { ConferencesPage } from "@/pages/ConferencesPage";
import { CriteriaPage } from "@/pages/CriteriaPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RolesPage } from "@/pages/RolesPage";
import { SectionsPage } from "@/pages/SectionsPage";
import { ScoresPage } from "@/pages/ScoresPage";
import { UsersEditPage, UsersPage } from "@/pages/UsersPage";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { clearAuthToken, getAuthToken, getAuthUserInfo, setAuthUserInfo, type AuthUserInfo } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import "./index.css";

export function App() {
  const [location, setLocation] = useLocation();
  const token = getAuthToken();
  const [authUser, setAuthUser] = useState<AuthUserInfo | null>(() => getAuthUserInfo());
  const [authState, setAuthState] = useState<"idle" | "loading" | "ready">(
    () => (token ? "loading" : "idle"),
  );

  useEffect(() => {
    if (!token) {
      setAuthUser(null);
      setAuthState("idle");
      return;
    }
    let active = true;
    const loadUser = async () => {
      try {
        setAuthState("loading");
        const response = await fetch(`${API_BASE_URL}/api/users/me/`, {
          headers: { Authorization: `Token ${token}` },
        });
        if (!active) return;
        if (!response.ok) {
          clearAuthToken();
          setAuthUser(null);
          setAuthState("idle");
          setLocation("/login");
          return;
        }
        const data = (await response.json()) as {
          id: number;
          role?: { code?: string | null } | null;
          first_name?: string | null;
          last_name?: string | null;
        };
        const userInfo: AuthUserInfo = {
          id: data.id,
          roleCode: (data.role?.code ?? "").toLowerCase(),
          firstName: data.first_name ?? undefined,
          lastName: data.last_name ?? undefined,
        };
        setAuthUserInfo(userInfo);
        setAuthUser(userInfo);
        setAuthState("ready");
      } catch {
        clearAuthToken();
        setAuthUser(null);
        setAuthState("idle");
        setLocation("/login");
      }
    };
    loadUser();
    return () => {
      active = false;
    };
  }, [setLocation, token]);

  const roleCode = (authUser?.roleCode ?? "").toLowerCase();
  const isOrganizer = roleCode === "organizer";
  const isExpert = roleCode === "expert";
  const isTutor = roleCode === "tutor";
  const isStudent = roleCode === "student" || roleCode === "student2" || roleCode === "student3";

  const defaultPath = useMemo(() => {
    if (isOrganizer) return "/conferences";
    if (isExpert) return "/assignments";
    if (isTutor || isStudent) return "/apply";
    return "/";
  }, [isExpert, isOrganizer, isStudent, isTutor]);

  const canAccessConferences = isOrganizer;
  const canAccessAssignments = isOrganizer || isExpert;
  const canAccessApply = isOrganizer || isTutor || isStudent;
  const canAccessScores = isOrganizer || isExpert;
  const canAccessCriteria = isOrganizer;
  const canAccessComments = isOrganizer || isExpert || isTutor;
  const canAccessAdminCatalogs = isOrganizer;

  const isAllowedPath = (path: string) => {
    if (path === "/" || path === "/login") return true;
    if (path === "/apply") return canAccessApply;
    if (path === "/assignments") return canAccessAssignments;
    if (path === "/scores") return canAccessScores;
    if (path === "/criteria") return canAccessCriteria;
    if (path === "/comments") return canAccessComments;
    if (path === "/conferences" || path.startsWith("/conferences/")) return canAccessConferences;
    if (path === "/sections" || path === "/roles" || path === "/users" || path.startsWith("/users/") || path === "/catalogs") {
      return canAccessAdminCatalogs;
    }
    return false;
  };

  useEffect(() => {
    if (!token && location !== "/login" && location !== "/") {
      setLocation("/login");
      return;
    }
    if (token && authState === "ready" && location === "/login") {
      setLocation(defaultPath);
      return;
    }
    if (token && authState === "ready" && !isAllowedPath(location)) {
      setLocation(defaultPath);
    }
  }, [authState, defaultPath, location, setLocation, token]);

  return (
    <SiteLayout roleCode={roleCode}>
      {!token && location === "/" ? (
        <HomePage />
      ) : !token ? (
        <LoginPage />
      ) : authState === "loading" ? (
        <Card className="border-border/70 bg-card/80">
          <CardContent className="p-6 text-sm text-muted-foreground">Загружаем профиль…</CardContent>
        </Card>
      ) : (
        <Switch>
          <Route path="/" component={HomePage} />
          {canAccessConferences ? <Route path="/conferences" component={ConferencesPage} /> : null}
          {canAccessConferences ? <Route path="/conferences/:id" component={ConferenceDetailPage} /> : null}
          {canAccessApply ? <Route path="/apply" component={ApplyPage} /> : null}
          {canAccessAssignments ? <Route path="/assignments" component={AssignmentsPage} /> : null}
          {canAccessCriteria ? <Route path="/criteria" component={CriteriaPage} /> : null}
          {canAccessScores ? <Route path="/scores" component={ScoresPage} /> : null}
          {canAccessAdminCatalogs ? <Route path="/sections" component={SectionsPage} /> : null}
          {canAccessAdminCatalogs ? <Route path="/roles" component={RolesPage} /> : null}
          {canAccessAdminCatalogs ? <Route path="/users" component={UsersPage} /> : null}
          {canAccessAdminCatalogs ? <Route path="/users/:id" component={UsersEditPage} /> : null}
          {canAccessAdminCatalogs ? <Route path="/catalogs" component={CatalogsPage} /> : null}
          {canAccessComments ? <Route path="/comments" component={CommentsPage} /> : null}
          <Route path="/login" component={LoginPage} />
          <Route>
            <NotFoundPage />
          </Route>
        </Switch>
      )}
    </SiteLayout>
  );
}
