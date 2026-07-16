import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Platform, View, StyleSheet as RNStyleSheet } from "react-native";
import { onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth, db } from "../services/firebaseConfig";
import { doc, getDoc, getDocFromServer, setDoc, updateDoc, increment, serverTimestamp, onSnapshot } from "firebase/firestore";
import SplashScreen from "../src/components/SplashScreen";
import { USE_SUPABASE } from "../src/lib/supabase";
import { getSession as supaGetSession, onAuthChange as supaOnAuthChange, getMyMembership as supaGetMyMembership } from "../src/lib/ctpApi";
import CoachHomeSupabase from "../src/screens/CoachHomeSupabase";
import AthleteHomeSupabase from "../src/screens/AthleteHomeSupabase";
import ScheduleScreenSupabase from "../src/screens/ScheduleScreenSupabase";
import ProfileScreenSupabase from "../src/screens/ProfileScreenSupabase";
import OnboardingNotifScreen from "../src/screens/OnboardingNotifScreen";
import CourtScene from "../src/components/CourtScene";

// Import Stitch screens
import LandingScreen from "../screens/StitchLandingScreen";
import CreateAccountScreen from "../screens/StitchCreateAccountScreen";
import LoginScreen from "../screens/StitchLoginScreen";
// IMPORTANT: Utiliser les nouveaux composants avec la logique des 4 états du questionnaire
import AthleteHome from "../src/screens/AthleteHome";
import ScheduleScreenNewScreen from "../src/screens/ScheduleScreenNewScreen";
// Anciens écrans (conservés pour référence mais non utilisés pour ATHLETE)
import HomeScreen from "../screens/StitchHomeScreenClean";
import ScheduleScreen from "../screens/StitchScheduleScreen";
import ProfileScreen from "../screens/StitchProfileScreen";
import QuestionnaireScreen from "../screens/StitchQuestionnaireScreen";
import TeamDetails from "../screens/StitchTeamDetails";
import DevEventsProbe from "../screens/DevEventsProbe";
import DebugTestQuestionnaireScreen from "../screens/DebugTestQuestionnaireScreen";
import PerformanceDashboard from "../src/screens/PerformanceDashboard";
import AdminHomeScreen from "../src/screens/AdminHomeScreen";
import CoachHomeScreen from "../src/screens/CoachHomeScreen";
import CoachTeamScreen from "../src/screens/CoachTeamScreen";
import CoachProfileScreen from "../src/screens/CoachProfileScreen";
import CoachScheduleScreen from "../src/screens/CoachScheduleScreen";
import AthleteDetailScreen from "../src/screens/AthleteDetailScreen";
import AdminTeamScreen from "../src/screens/AdminTeamScreen";
import AdminTeamDetailScreen from "../src/screens/AdminTeamDetailScreen";
import CreateTeamModal from "../src/screens/CreateTeamModal";
import { httpsCallable } from "firebase/functions";
import { functions } from "../services/firebaseConfig";

const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

// Auth Stack (Landing, Create Account, Login)
function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Landing" component={LandingScreen} />
      <AuthStack.Screen name="CreateAccount" component={CreateAccountScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

// Athlete Tabs (Home, Schedule, Profile) - Navigation simple sans barre du bas
// IMPORTANT: Utiliser les nouveaux composants qui implémentent la logique des 4 états du questionnaire
function AthleteTabs() {
  const AthleteTab = createBottomTabNavigator();
  return (
    <AthleteTab.Navigator 
      screenOptions={{ 
        headerShown: false,
        tabBarStyle: { display: 'none' }, // Masque complètement la barre de navigation
      }}
    >
      {/* A3 Parité: AthleteHome/ScheduleScreenNewScreen = écrans validés de l'ancien,
           rebranchés sur Supabase via USE_SUPABASE dans leur useEffect data-loading.
           AthleteHomeSupabase/ScheduleScreenSupabase = débranchés (fichiers conservés). */}
      <AthleteTab.Screen name="Home" component={AthleteHome} />
      <AthleteTab.Screen name="Schedule" component={ScheduleScreenNewScreen} />
      <AthleteTab.Screen
        name="Profile"
        component={USE_SUPABASE ? ProfileScreenSupabase : ProfileScreen}
        initialParams={{ role: "athlete" }}
      />
    </AthleteTab.Navigator>
  );
}

// Composant d'icône harmonisé
const TabIcon = ({ name, color, size = 24, focused }) => {
  const iconStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: focused ? 'rgba(0,212,255,0.15)' : 'transparent',
    border: focused ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: focused ? '0 4px 12px rgba(0,212,255,0.2)' : 'none',
  };

  const getIcon = () => {
    switch (name) {
      case 'Home':
        return (
          <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="9,22 9,12 15,12 15,22" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'Schedule':
        return (
          <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'Profile':
        return (
          <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'Dashboard':
        return (
          <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'Teams':
        return (
          <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'Analytics':
        return (
          <svg width={size} height={size} fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M18 20V10" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 20V4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 20v-6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div style={iconStyle}>
      {getIcon()}
    </div>
  );
};

// Admin Tabs (Dashboard, Teams, Analytics, Profile) — barre masquée sur AdminHome
function AdminTabs() {
  const AdminTab = createBottomTabNavigator();
  return (
    <AdminTab.Navigator 
      screenOptions={({ route }) => ({ 
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: route.name === 'AdminHome'
          ? { display: 'none' }
          : {
              backgroundColor: 'rgba(7,11,20,0.92)',
              borderTopColor: '#2B2E36',
              borderTopWidth: 1,
              height: 80,
              paddingBottom: 16,
              paddingTop: 16,
            },
        tabBarActiveTintColor: '#00D4FF',
        tabBarInactiveTintColor: '#9CA3AF',
      })}
    >
      <AdminTab.Screen 
        name="AdminHome" 
        component={AdminHomeScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="Dashboard" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <AdminTab.Screen
        name="Teams"
        component={AdminHomeScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="Teams" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <AdminTab.Screen
        name="Analytics"
        component={PerformanceDashboard}
        initialParams={{ role: "admin" }}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="Analytics" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <AdminTab.Screen
        name="Profile"
        component={USE_SUPABASE ? ProfileScreenSupabase : ProfileScreen}
        initialParams={{ role: "admin" }}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="Profile" color={color} size={size} focused={focused} />
          ),
        }}
      />
    </AdminTab.Navigator>
  );
}

// Coach Tabs — Home | Team | Analytics | Profile
function CoachTabs() {
  const CoachTab = createBottomTabNavigator();
  return (
    <CoachTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: 'rgba(7,11,20,0.92)',
          borderTopColor: '#2B2E36',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 16,
          paddingTop: 16,
        },
        tabBarActiveTintColor: '#00D4FF',
        tabBarInactiveTintColor: '#9CA3AF',
      }}
    >
      <CoachTab.Screen
        name="Home"
        component={USE_SUPABASE ? CoachHomeSupabase : CoachHomeScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="Home" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <CoachTab.Screen
        name="Team"
        component={CoachTeamScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="Teams" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <CoachTab.Screen
        name="Schedule"
        component={CoachScheduleScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="Schedule" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <CoachTab.Screen
        name="Analytics"
        component={PerformanceDashboard}
        initialParams={{ role: "coach" }}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="Analytics" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <CoachTab.Screen
        name="Profile"
        component={USE_SUPABASE ? ProfileScreenSupabase : CoachProfileScreen}
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="Profile" color={color} size={size} focused={focused} />
          ),
        }}
      />
    </CoachTab.Navigator>
  );
}

// Root Stack Navigator with role-based routing
function RootStackNavigator({ role, user, pendingDeepLink, navigationRef, onboardingComplete, onOnboardingComplete }) {
  console.log("role from firestore:", role);
  console.log("[ROOT] role at render =", role, "| type:", typeof role);
  console.log("[ROOT] user =", user?.email);

  // Après auth + rôle athlete, ouvrir le questionnaire si un deep link est en attente
  React.useEffect(() => {
    if (pendingDeepLink?.current && String(role || '').trim().toLowerCase() === 'athlete') {
      const params = pendingDeepLink.current;
      const t = setTimeout(() => {
        if (navigationRef?.current?.isReady()) {
          navigationRef.current.navigate('Questionnaire', params);
          pendingDeepLink.current = null;
        }
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [role, pendingDeepLink, navigationRef]);
  
  // Normalize role (toLowerCase, trim)
  const normalizedRole = String(role || '').trim().toLowerCase();
  console.log("[ROOT] normalized role =", normalizedRole);
  
  if (normalizedRole === 'admin') {
    console.log("Rendering AdminTabs");
    return (
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="AdminMain" component={AdminTabs} />
        <RootStack.Screen
          name="AdminPerformanceDashboard"
          component={PerformanceDashboard}
          initialParams={{ role: "admin" }}
        />
        <RootStack.Screen name="AdminTeamScreen" component={AdminTeamScreen} />
        <RootStack.Screen name="AdminTeamDetailScreen" component={AdminTeamDetailScreen} />
        <RootStack.Screen
          name="CreateTeamModal"
          component={CreateTeamModal}
          options={{ presentation: "modal", gestureEnabled: true }}
        />
        <RootStack.Screen name="TeamDetails" component={TeamDetails} />
        <RootStack.Screen name="DevEventsProbe" component={DevEventsProbe} />
        <RootStack.Screen name="DebugTestQuestionnaire" component={DebugTestQuestionnaireScreen} />
        <RootStack.Screen 
          name="Questionnaire" 
          component={QuestionnaireScreen}
          options={{
            presentation: "modal",
            gestureEnabled: true,
          }}
        />
      </RootStack.Navigator>
    );
  }
  
  if (normalizedRole === 'coach') {
    console.log("Rendering CoachTabs");
    return (
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="CoachMain" component={CoachTabs} />
        <RootStack.Screen name="AthleteDetail" component={AthleteDetailScreen} />
        <RootStack.Screen name="DebugTestQuestionnaire" component={DebugTestQuestionnaireScreen} />
        <RootStack.Screen 
          name="Questionnaire" 
          component={QuestionnaireScreen}
          options={{
            presentation: "modal",
            gestureEnabled: true,
          }}
        />
      </RootStack.Navigator>
    );
  }
  
  if (normalizedRole === 'athlete') {
    console.log("Rendering AthleteTabs");
    // FIX 1: show onboarding notif screen on first login
    if (!onboardingComplete) {
      return <OnboardingNotifScreen onComplete={onOnboardingComplete} />;
    }
    return (
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="AthleteMain" component={AthleteTabs} />
        <RootStack.Screen name="DebugTestQuestionnaire" component={DebugTestQuestionnaireScreen} />
        <RootStack.Screen
          name="Questionnaire"
          component={QuestionnaireScreen}
          options={{
            presentation: "modal",
            gestureEnabled: true,
          }}
        />
      </RootStack.Navigator>
    );
  }
  
  console.log("Rendering AuthStack (guest/none)");
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Auth" component={AuthStackNavigator} />
      <RootStack.Screen name="DebugTestQuestionnaire" component={DebugTestQuestionnaireScreen} />
      <RootStack.Screen 
        name="Questionnaire" 
        component={QuestionnaireScreen}
        options={{
          presentation: "modal",
          gestureEnabled: true,
        }}
      />
    </RootStack.Navigator>
  );
}

// Auth Gate Component with proper role detection
function AuthGate({ pendingDeepLink, pendingJoinCode, navigationRef }) {
  const [state, setState] = React.useState({
    loading: true,
    user: null,
    userRole: null,
    authReady: false,
    roleLoading: true, // stays true until first onSnapshot confirms the role from server
    onboardingComplete: true, // default true to avoid flash for existing users
  });
  const unsubDocRef = React.useRef(null);

  // Timeout pour éviter que l'écran de chargement reste bloqué
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (!state.authReady) {
        console.log("⚠️ Auth timeout - showing landing screen");
        setState({ loading: false, user: null, userRole: null, authReady: true });
      }
    }, 5000); // 5 secondes de timeout

    return () => clearTimeout(timeout);
  }, [state.authReady]);

  // Process pending join code after auth is confirmed
  React.useEffect(() => {
    if (USE_SUPABASE) return; // géré par joinTeam côté Supabase
    if (!state.user || state.roleLoading || !pendingJoinCode?.current) return;
    const code = pendingJoinCode.current;
    pendingJoinCode.current = null; // consume immediately to avoid re-runs
    const lookupFn = httpsCallable(functions, "lookupTeamByCode");
    const joinFn = httpsCallable(functions, "createMembership");
    lookupFn({ code })
      .then(async (result) => {
        const { teamId, role } = (result?.data || {});
        if (!teamId) { console.warn("[JOIN] No teamId returned for code:", code); return; }
        await joinFn({
          teamId,
          role,
          name: state.user?.displayName || "",
          email: state.user?.email || "",
        });
        console.log("[JOIN] Joined team", teamId, "as", role);
      })
      .catch((err) => {
        console.error("[JOIN] Error processing join code:", err?.message || err);
      });
  }, [state.user, state.roleLoading]);

  React.useEffect(() => {
    // ── Chemin Supabase (V2) ─────────────────────────────────
    if (USE_SUPABASE) {
      let done = false;
      const applyUser = async (sessUser) => {
        if (!sessUser) {
          if (!done) setState({ loading: false, user: null, userRole: null, authReady: true, roleLoading: false, onboardingComplete: true });
          return;
        }
        let roleFromDb = "athlete";
        try {
          const m = await supaGetMyMembership();
          if (m?.role) roleFromDb = String(m.role).trim().toLowerCase();
          else console.warn("[SUPA] utilisateur sans équipe — rôle athlete par défaut");
        } catch (e) {
          console.warn("[SUPA] getMyMembership failed:", e?.message);
        }
        console.log("[SUPA] auth OK:", sessUser.email, "| role:", roleFromDb);
        if (!done) setState({
          loading: false,
          user: { uid: sessUser.id, email: sessUser.email, displayName: sessUser.email },
          userRole: roleFromDb,
          authReady: true,
          roleLoading: false,
          onboardingComplete: true,
        });
      };
      supaGetSession().then(({ data }) => applyUser(data?.session?.user ?? null));
      const { data: sub } = supaOnAuthChange(() => {
        supaGetSession().then(({ data }) => applyUser(data?.session?.user ?? null));
      });
      return () => { done = true; sub?.subscription?.unsubscribe?.(); };
    }

    console.log("🚀 Initializing auth...");

    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error("❌ Error setting persistence:", error);
    });
    
    const unsub = onAuthStateChanged(auth, async (u) => {
      console.log("🔍 Auth state changed:", u?.email);

      // Clean up previous user-doc listener when auth changes
      if (unsubDocRef.current) {
        unsubDocRef.current();
        unsubDocRef.current = null;
      }

      if (u) {
        try {
          console.log("👤 User authenticated, fetching role from server...");
          const userDoc = await getDocFromServer(doc(db, "users", u.uid));
          let role = "athlete"; // Default role

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const rawRole = userData.role || "athlete";
            role = String(rawRole).trim().toLowerCase();
            console.log("📄 User document exists:", userData);
            console.log("📄 Raw role from Firestore:", rawRole);
            console.log("📄 Normalized role:", role);
            console.log("📄 Role comparison (admin):", role === "admin");
          } else {
            console.log("⚠️ No user document found, creating admin document for gabfavergeat@gmail.com");
            if (u.email === "gabfavergeat@gmail.com") {
              await setDoc(doc(db, "users", u.uid), {
                email: u.email,
                role: "admin",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              role = "admin";
              console.log("✅ Admin document created automatically");
            }
          }

          const onboardingComplete = userDoc.exists() ? (userDoc.data()?.onboardingComplete ?? false) : false;
          // roleLoading stays true — don't render tabs until onSnapshot confirms server role
          console.log("👤 User state (awaiting onSnapshot role confirmation):", { user: u?.email, role, onboardingComplete });
          setState({ loading: false, user: u, userRole: role, authReady: true, roleLoading: true, onboardingComplete });

          // FIX 2: increment loginCount on each app open
          try {
            await updateDoc(doc(db, "users", u.uid), {
              loginCount: increment(1),
            });
          } catch (e) {
            console.warn("[AUTH] loginCount increment failed:", e);
          }

          // Watch the user doc in real-time so the role is updated as soon as the
          // account-creation flow writes it (fixes the race between onAuthStateChanged
          // and setDoc in StitchCreateAccountScreen).
          unsubDocRef.current = onSnapshot(doc(db, "users", u.uid), (snapshot) => {
            if (snapshot.exists()) {
              const rawRole = snapshot.data()?.role;
              console.log("[AUTH] onSnapshot raw role from firestore:", rawRole, "| type:", typeof rawRole);
              const updatedRole = String(rawRole || "athlete").trim().toLowerCase();
              setState((prev) => {
                // Always clear roleLoading on first snapshot — this unblocks tab rendering
                if (prev.userRole !== updatedRole || prev.roleLoading) {
                  console.log("[AUTH] Role confirmed via onSnapshot:", updatedRole);
                  return { ...prev, userRole: updatedRole, roleLoading: false };
                }
                return { ...prev, roleLoading: false };
              });
            }
          });
        } catch (error) {
          console.error("❌ Error fetching user role:", error);
          const role = u.email === "gabfavergeat@gmail.com" ? "admin" : "athlete";
          console.log("🔄 Fallback role detection:", role);
          setState({ loading: false, user: u, userRole: role, authReady: true, roleLoading: false, onboardingComplete: true });
        }
      } else {
        console.log("👤 No user logged in");
        setState({ loading: false, user: null, userRole: null, authReady: true, roleLoading: false });
      }
    });

    return () => {
      unsub();
      if (unsubDocRef.current) {
        unsubDocRef.current();
        unsubDocRef.current = null;
      }
    };
  }, []);

  // Show splash screen while loading
  if (!state.authReady) {
    return <SplashScreen />;
  }

  // Block tab render until onSnapshot confirms the role from Firestore server.
  // Prevents coach being rendered as athlete on first load (role race condition).
  if (state.user && state.roleLoading) {
    return <SplashScreen />;
  }

  return (
    <RootStackNavigator
      role={state.userRole}
      user={state.user}
      pendingDeepLink={pendingDeepLink}
      navigationRef={navigationRef}
      onboardingComplete={state.onboardingComplete}
      onOnboardingComplete={() => setState(prev => ({ ...prev, onboardingComplete: true }))}
    />
  );
}

export default function StitchNavigator() {
  const navigationRef = React.useRef(null);
  const pendingDeepLink = React.useRef(null);
  const pendingJoinCode = React.useRef(null);

  // Deep link : au démarrage stocker params en ref, puis navigation après auth dans RootStackNavigator
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const startUrl = new URL(window.location.href);
    const startSessionId = startUrl.searchParams.get("sessionId");
    const startOpenQ = startUrl.searchParams.get("openQuestionnaire");
    const startScreen = startUrl.searchParams.get("screen");
    const startTrainingId = startUrl.searchParams.get("trainingId");
    const startTeamId = startUrl.searchParams.get("teamId");

    // Join code: /?code=XK7B2P-C or /?code=XK7B2P-A
    const startCode = startUrl.searchParams.get("code");
    if (startCode) {
      pendingJoinCode.current = startCode;
      window.history.replaceState({}, "", "/");
    }

    // FIX 4: new URL format /?screen=questionnaire&trainingId=X&teamId=Y
    if (startScreen === "questionnaire" && startTrainingId) {
      pendingDeepLink.current = { trainingId: startTrainingId, sessionId: startTrainingId, teamId: startTeamId };
      window.history.replaceState({}, "", "/");
    } else if (startSessionId && startOpenQ === "1") {
      pendingDeepLink.current = { sessionId: startSessionId };
      window.history.replaceState({}, "", "/");
    }

    const handleDeepLink = () => {
      const pathname = window.location.pathname || "";
      const url = new URL(window.location.href);
      const screen = url.searchParams.get("screen");
      const trainingId = url.searchParams.get("trainingId");
      const teamId = url.searchParams.get("teamId");
      const sessionId = url.searchParams.get("sessionId");
      const openQuestionnaire = url.searchParams.get("openQuestionnaire");

      // Debug route: /debug/test-questionnaire (notification deep-link)
      if (pathname === "/debug/test-questionnaire") {
        if (navigationRef.current?.isReady()) {
          navigationRef.current.navigate("DebugTestQuestionnaire");
          window.history.replaceState({}, "", pathname);
        }
        return;
      }

      // FIX 4: new deep link format
      if (screen === "questionnaire" && trainingId) {
        pendingDeepLink.current = { trainingId, sessionId: trainingId, teamId };
        window.history.replaceState({}, "", window.location.pathname || "/");
        if (navigationRef.current?.isReady()) {
          setTimeout(() => {
            if (navigationRef.current?.isReady() && pendingDeepLink.current) {
              navigationRef.current.navigate("Questionnaire", pendingDeepLink.current);
              pendingDeepLink.current = null;
            }
          }, 1000);
        }
        return;
      }

      if (sessionId && openQuestionnaire === "1") {
        pendingDeepLink.current = { sessionId };
        window.history.replaceState({}, "", window.location.pathname || "/");
        if (navigationRef.current?.isReady()) {
          setTimeout(() => {
            if (navigationRef.current?.isReady() && pendingDeepLink.current) {
              navigationRef.current.navigate("Questionnaire", pendingDeepLink.current);
              pendingDeepLink.current = null;
            }
          }, 1000);
        }
      }
    };

    // Vérifier au chargement
    handleDeepLink();

    // Écouter les changements d'URL (pour les SPA)
    const checkInterval = setInterval(handleDeepLink, 500);
    return () => clearInterval(checkInterval);
  }, []);

  return (
    <View style={courtStyles.root}>
      {Platform.OS === "web" && <CourtScene />}
      <View style={courtStyles.content}>
        <NavigationContainer ref={navigationRef}>
          <AuthGate pendingDeepLink={pendingDeepLink} pendingJoinCode={pendingJoinCode} navigationRef={navigationRef} />
        </NavigationContainer>
      </View>
    </View>
  );
}

const courtStyles = RNStyleSheet.create({
  root: { flex: 1, backgroundColor: "#070B14" },
  content: { flex: 1, position: "relative", zIndex: 1 },
});