import { SiteLayout } from "@/components/site/Layout";
import { ApplyPage } from "@/pages/ApplyPage";
import { AssignmentsPage } from "@/pages/AssignmentsPage";
import { CatalogsPage } from "@/pages/CatalogsPage";
import { CommentsPage } from "@/pages/CommentsPage";
import { ConferenceDetailPage } from "@/pages/ConferenceDetailPage";
import { ConferencesPage } from "@/pages/ConferencesPage";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RolesPage } from "@/pages/RolesPage";
import { SectionsPage } from "@/pages/SectionsPage";
import { UsersPage } from "@/pages/UsersPage";
import { Route, Switch, useLocation } from "wouter";
import { useEffect } from "react";
import { getAuthToken } from "@/lib/auth";
import "./index.css";

export function App() {
  const [location, setLocation] = useLocation();
  const token = getAuthToken();
  const showLoginOnly = !token && location !== "/login";

  useEffect(() => {
    if (!token && location !== "/login") {
      setLocation("/login");
      return;
    }
    if (token && location === "/login") {
      setLocation("/conferences");
    }
  }, [token, location, setLocation]);

  return (
    <SiteLayout>
      {showLoginOnly ? (
        <LoginPage />
      ) : (
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/conferences" component={ConferencesPage} />
          <Route path="/conferences/:id" component={ConferenceDetailPage} />
          <Route path="/sections" component={SectionsPage} />
          <Route path="/apply" component={ApplyPage} />
          <Route path="/assignments" component={AssignmentsPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/roles" component={RolesPage} />
          <Route path="/users" component={UsersPage} />
          <Route path="/catalogs" component={CatalogsPage} />
          <Route path="/comments" component={CommentsPage} />
          <Route>
            <NotFoundPage />
          </Route>
        </Switch>
      )}
    </SiteLayout>
  );
}
