import { Route, Switch, Redirect, useLocation } from "wouter";
import { useAuth } from "./lib/auth";
import { Logo } from "./components/Brand";
import Login from "./pages/Login";
import RoleSelect from "./pages/RoleSelect";
import StartupBasics from "./pages/onboarding/StartupBasics";
import StartupSurvey from "./pages/onboarding/StartupSurvey";
import Home from "./pages/Home";
import ContractKys from "./pages/ContractKys";
import StartupDashboard from "./pages/StartupDashboard";
import KpiVisualizations from "./pages/KpiVisualizations";
import VerifyEmail from "./pages/VerifyEmail";
import Account from "./pages/Account";
import CreateStartup from "./pages/CreateStartup";
import EditStartup from "./pages/EditStartup";
import ViewStartup from "./pages/ViewStartup";
import DataRoom from "./pages/DataRoom";
import PublicDataRoomShare from "./pages/PublicDataRoomShare";
import Mentorship from "./pages/Mentorship";
import Training from "./pages/Training";
import OfficeHours from "./pages/OfficeHours";
import OpenStartupSchool from "./pages/OpenStartupSchool";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminStartups from "./pages/admin/AdminStartups";
import AdminStartupDetail from "./pages/admin/AdminStartupDetail";
import AdminDeletionRequests from "./pages/admin/AdminDeletionRequests";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminContractsKys from "./pages/admin/AdminContractsKys";
import AdminKpi from "./pages/admin/AdminKpi";
import AdminMonthlyUpdates from "./pages/admin/AdminMonthlyUpdates";
import AdminDataRoom from "./pages/admin/AdminDataRoom";
import AdminMentorship from "./pages/admin/AdminMentorship";
import AdminTraining from "./pages/admin/AdminTraining";
import AdminTeam from "./pages/admin/AdminTeam";
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
export default function App() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

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

  // Admins get the admin area.
  if (user.role === "admin") {
    return (
      <Switch>
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/startups" component={AdminStartups} />
        <Route path="/admin/startups/:id" component={AdminStartupDetail} />
        <Route path="/admin/deletion-requests" component={AdminDeletionRequests} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/contracts-kys" component={AdminContractsKys} />
        <Route path="/admin/kpi" component={AdminKpi} />
        <Route path="/admin/monthly-updates" component={AdminMonthlyUpdates} />
        <Route path="/admin/data-room" component={AdminDataRoom} />
        <Route path="/admin/mentorship" component={AdminMentorship} />
        <Route path="/admin/training" component={AdminTraining} />
        <Route path="/admin/team" component={AdminTeam} />
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

  if (user.onboardingStatus === "needs_profile") {
    if (location !== "/onboarding/basics" && location !== "/onboarding/survey") {
      return <Redirect to="/onboarding/basics" />;
    }
    return (
      <Switch>
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
      <Route path="/kpi" component={KpiVisualizations} />
      <Route path="/data-room" component={DataRoom} />
      <Route path="/mentorship" component={Mentorship} />
      <Route path="/training" component={Training} />
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
