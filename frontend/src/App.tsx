import { SiteLayout } from "@/components/site/Layout";
import { ApplyPage } from "@/pages/ApplyPage";
import { AssignmentsPage } from "@/pages/AssignmentsPage";
import { ConferenceDetailPage } from "@/pages/ConferenceDetailPage";
import { ConferenceEditPage } from "@/pages/ConferenceEditPage";
import { ConferenceResultsPage } from "@/pages/ConferenceResultsPage";
import { ConferencesPage } from "@/pages/ConferencesPage";
import { HomePage } from "@/pages/HomePage";
import { ContactsPage, DocumentsPage, PolicyPage } from "@/pages/InfoPages";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ScoresPage } from "@/pages/ScoresPage";
import { UserDetailPage } from "@/pages/UserDetailPage";
import { UsersPage } from "@/pages/UsersPage";
import { Route, Switch, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { clearAuthToken, getAuthToken, getAuthUserInfo, setAuthUserInfo, type AuthUserInfo } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { isStudentRole, normalizeRoleCode } from "@/lib/roles";
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
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
        };
        const userInfo: AuthUserInfo = {
          id: data.id,
          roleCode: (data.role?.code ?? "").toLowerCase(),
          email: data.email ?? undefined,
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

  const roleCode = normalizeRoleCode(authUser?.roleCode ?? "");
  const isOrganizer = roleCode === "organizer";
  const isExpert = roleCode === "expert";
  const isTutor = roleCode === "tutor";
  const isStudent = isStudentRole(roleCode);

  const canAccessConferences = isOrganizer || isExpert || isTutor || isStudent;
  const defaultPath = useMemo(() => {
    if (canAccessConferences) return "/conferences";
    return "/";
  }, [canAccessConferences]);

  const canAccessAssignments = isOrganizer || isExpert;
  const canAccessApply = isOrganizer || isTutor || isStudent;
  const canAccessScores = isOrganizer || isExpert;
  const canAccessAdminCatalogs = isOrganizer;
  const canAccessGlobalUsers = false;
  const canAccessCatalogs = false;

  const isAllowedPath = (path: string) => {
    if (path === "/" || path === "/login" || path === "/register") return true;
    if (path === "/policy" || path === "/contacts" || path === "/documents") return true;
    if (path.match(/^\/conferences\/\d+\/edit$/)) return canAccessAdminCatalogs;
    if (path === "/conferences" || path.startsWith("/conferences/")) return canAccessConferences;
    if (path === "/users" || path.startsWith("/users/")) return canAccessGlobalUsers;
    if (path === "/sections" || path === "/roles" || path === "/catalogs") return canAccessCatalogs;
    return false;
  };

  useEffect(() => {
    if (!token && location !== "/login" && location !== "/register" && location !== "/") {
      if (["/policy", "/contacts", "/documents"].includes(location)) return;
      setLocation("/login");
      return;
    }
    if (token && authState === "ready" && (location === "/login" || location === "/register")) {
      setLocation(defaultPath);
      return;
    }
    if (token && authState === "ready" && !isAllowedPath(location)) {
      setLocation(defaultPath);
    }
  }, [authState, defaultPath, location, setLocation, token]);

  return (
    <SiteLayout roleCode={roleCode} userLogin={authUser?.email}>
      {!token ? (
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/policy" component={PolicyPage} />
          <Route path="/contacts" component={ContactsPage} />
          <Route path="/documents" component={DocumentsPage} />
          <Route>
            <NotFoundPage />
          </Route>
        </Switch>
      ) : authState === "loading" ? (
        <Card className="border-border/70 bg-card/80">
          <CardContent className="p-6 text-sm text-muted-foreground">Загружаем профиль…</CardContent>
        </Card>
      ) : (
        <Switch>
          <Route path="/" component={HomePage} />
          {canAccessConferences ? <Route path="/conferences" component={ConferencesPage} /> : null}
          {canAccessAdminCatalogs ? <Route path="/conferences/:id/edit" component={ConferenceEditPage} /> : null}
          {canAccessConferences ? <Route path="/conferences/:id" component={ConferenceDetailPage} /> : null}
          {canAccessConferences && canAccessApply ? <Route path="/conferences/:id/projects" component={ApplyPage} /> : null}
          {canAccessConferences && canAccessAssignments ? <Route path="/conferences/:id/assignments" component={AssignmentsPage} /> : null}
          {canAccessConferences && canAccessScores ? <Route path="/conferences/:id/scores" component={ScoresPage} /> : null}
          {canAccessConferences ? <Route path="/conferences/:id/results" component={ConferenceResultsPage} /> : null}
          {canAccessGlobalUsers ? <Route path="/users" component={UsersPage} /> : null}
          {canAccessGlobalUsers ? <Route path="/users/:id" component={UserDetailPage} /> : null}
          <Route path="/policy" component={PolicyPage} />
          <Route path="/contacts" component={ContactsPage} />
          <Route path="/documents" component={DocumentsPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          <Route>
            <NotFoundPage />
          </Route>
        </Switch>
      )}
    </SiteLayout>
  );
}
