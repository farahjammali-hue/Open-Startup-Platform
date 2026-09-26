import { useEffect, useState } from "react";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { useAuth } from "./lib/auth";
import { useEffectiveRole } from "./lib/viewMode";
import { api } from "./lib/utils";
import { Logo } from "./components/Brand";
import Login from "./pages/Login";
import RoleSelect from "./pages/RoleSelect";
import PendingApproval from "./pages/PendingApproval";
import StartupBasics from "./pages/onboarding/StartupBasics";
import StartupSurvey from "./pages/onboarding/StartupSurvey";
import Home from "./pages/Home";
import ContractKys from "./pages/ContractKys";
import StartupDashboard from "./pages/StartupDashboard";
import VerifyEmail from "./pages/VerifyEmail";
import Account from "./pages/Account";
import CreateStartup from "./pages/CreateStartup";
import EditStartup from "./pages/EditStartup";
import ViewStartup from "./pages/ViewStartup";
import DataRoom from "./pages/DataRoom";
import PublicDataRoomShare from "./pages/PublicDataRoomShare";
import Mentorship from "./pages/Mentorship";
import Training from "./pages/Training";
import Crm from "./pages/Crm";
import OfficeHours from "./pages/OfficeHours";
import OpenStartupSchool from "./pages/OpenStartupSchool";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminStartups from "./pages/admin/AdminStartups";
import AdminStartupDetail from "./pages/admin/AdminStartupDetail";
import AdminStartupDashboard from "./pages/admin/AdminStartupDashboard";
import AdminStartupDataRoom from "./pages/admin/AdminStartupDataRoom";
import AdminDeletionRequests from "./pages/admin/AdminDeletionRequests";
import AdminApprovals from "./pages/admin/AdminApprovals";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminContractsKys from "./pages/admin/AdminContractsKys";
import AdminContractsKysStartup from "./pages/admin/AdminContractsKysStartup";
import AdminDataRoom from "./pages/admin/AdminDataRoom";
import AdminMentorship from "./pages/admin/AdminMentorship";
import AdminMentorshipStartup from "./pages/admin/AdminMentorshipStartup";
import AdminTraining from "./pages/admin/AdminTraining";
import AdminTrainingStartup from "./pages/admin/AdminTrainingStartup";
import AdminCrm from "./pages/admin/AdminCrm";
import AdminCrmStartup from "./pages/admin/AdminCrmStartup";
import AdminSchool from "./pages/admin/AdminSchool";

function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-pulse">
        <Logo />
      </div>
    </div>
  );
}

/**
 * Flow controller: login -> role -> basics -> survey -> app.
 * Once onboarding is complete the full app routes are available.
 */
const OAUTH_NEXT_KEY = "ost-oauth-next";

export default function App() {
  const { user, loading } = useAuth();
  const effectiveRole = useEffectiveRole();
  const [location] = useLocation();

  // When an admin flips to "Startup view" they need a startup to look at —
  // ensure the demo one exists before rendering any founder-facing route.
  const inAdminStartupPreview = user?.role === "admin" && effectiveRole === "startup";
  const [demoStartupReady, setDemoStartupReady] = useState(false);
  useEffect(() => {
    if (!inAdminStartupPreview) {
      setDemoStartupReady(false);
      return;
    }
    let cancelled = false;
    api("/api/admin/demo-startup", { method: "POST" }).finally(() => {
      if (!cancelled) setDemoStartupReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [inAdminStartupPreview]);

  // Claude connector approval: the server's /oauth/authorize page sends
  // signed-out admins to /login?next=..., then back once they're signed in.
  // Only that exact server path is accepted, so this can't redirect elsewhere.
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next?.startsWith("/oauth/authorize?")) sessionStorage.setItem(OAUTH_NEXT_KEY, next);
  }, []);
  useEffect(() => {
    if (!user?.emailVerified) return;
    const next = sessionStorage.getItem(OAUTH_NEXT_KEY);
    if (!next) return;
    sessionStorage.removeItem(OAUTH_NEXT_KEY);
    if (next.startsWith("/oauth/authorize?")) window.location.assign(next);
  }, [user]);

  // Public, unauthenticated — never gated behind login, loading state, or onboarding.
  if (location.startsWith("/share/data-room/")) {
    return <PublicDataRoomShare />;
  }

  if (loading) return <Loading />;

  if (!user) {
    if (location !== "/login") return <Redirect to="/login" />;
    return <Login />;
  }

  // Email must be verified before anything else.
  if (!user.emailVerified) {
    return <VerifyEmail />;
  }

  if (inAdminStartupPreview && !demoStartupReady) return <Loading />;

  // Admins get the admin area (unless they've flipped to "Startup view").
  if (effectiveRole === "admin") {
    return (
      <Switch>
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/startups" component={AdminStartups} />
        <Route path="/admin/startups/:id" component={AdminStartupDetail} />
        <Route path="/admin/startups/:id/dashboard" component={AdminStartupDashboard} />
        <Route path="/admin/startups/:id/data-room" component={AdminStartupDataRoom} />
        {/* Same review page, two entry points: nested under the startup (from
            its admin page) and flat (from the Contracts & KYS review queue).
            The page adapts its Back link to whichever URL it was opened at. */}
        <Route path="/admin/startups/:id/contract-kys" component={AdminContractsKysStartup} />
        <Route path="/admin/deletion-requests" component={AdminDeletionRequests} />
        <Route path="/admin/approvals" component={AdminApprovals} />
        <Route path="/admin/messages" component={AdminMessages} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/contracts-kys" component={AdminContractsKys} />
        <Route path="/admin/contracts-kys/:startupId" component={AdminContractsKysStartup} />
        <Route path="/admin/data-room" component={AdminDataRoom} />
        <Route path="/admin/mentorship" component={AdminMentorship} />
        <Route path="/admin/mentorship/:startupId" component={AdminMentorshipStartup} />
        <Route path="/admin/startups/:startupId/mentorship" component={AdminMentorshipStartup} />
        <Route path="/admin/training" component={AdminTraining} />
        <Route path="/admin/training/:startupId" component={AdminTrainingStartup} />
        <Route path="/admin/crm" component={AdminCrm} />
        <Route path="/admin/crm/:startupId" component={AdminCrmStartup} />
        <Route path="/admin/startups/:startupId/crm" component={AdminCrmStartup} />
        <Route path="/admin/school" component={AdminSchool} />
        <Route>
          <Redirect to="/admin" />
        </Route>
      </Switch>
    );
  }

  if (user.onboardingStatus === "needs_role") {
    if (location !== "/onboarding/role") return <Redirect to="/onboarding/role" />;
    return <RoleSelect />;
  }

  // Profile submitted, waiting on an admin decision. Blocks every other
  // route — there is nowhere else to redirect to while pending.
  if (user.onboardingStatus === "pending_approval") {
    return <PendingApproval />;
  }

  if (user.onboardingStatus === "needs_profile") {
    // /onboarding/role is included so the "Back" button on Basics can return
    // there. Revisiting it is harmless: choosing "Startup" again just re-POSTs
    // the same role and lands back on Basics.
    if (
      location !== "/onboarding/role" &&
      location !== "/onboarding/basics" &&
      location !== "/onboarding/survey"
    ) {
      return <Redirect to="/onboarding/basics" />;
    }
    return (
      <Switch>
        <Route path="/onboarding/role" component={RoleSelect} />
        <Route path="/onboarding/basics" component={StartupBasics} />
        <Route path="/onboarding/survey" component={StartupSurvey} />
      </Switch>
    );
  }

  // Fully onboarded.
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/contract-kys" component={ContractKys} />
      <Route path="/dashboard" component={StartupDashboard} />
      <Route path="/data-room" component={DataRoom} />
      <Route path="/mentorship" component={Mentorship} />
      <Route path="/training" component={Training} />
      <Route path="/crm" component={Crm} />
      <Route path="/office-hours" component={OfficeHours} />
      <Route path="/school" component={OpenStartupSchool} />
      <Route path="/account" component={Account} />
      <Route path="/startups/new" component={CreateStartup} />
      <Route path="/startups/:id/edit" component={EditStartup} />
      <Route path="/startups/:id" component={ViewStartup} />
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}
