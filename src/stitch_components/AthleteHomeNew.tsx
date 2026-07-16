import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions, Platform, Image, ScrollView } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { makePress } from "../utils/press";
import { doc, getDoc, collection, getDocs, limit, query, updateDoc, increment } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { tokens } from "../theme/tokens";
import { useDevice } from "../hooks/useDevice";
import { getResponsiveSpacing, getResponsiveFontSize, getMainContainerStyle } from "../utils/responsive";
import { getUpcomingTrainings } from "../lib/scheduleQueries";
import { getUpcomingTrainingsSupabase } from "../lib/scheduleQueriesSupabase";
import { QuestionnaireState } from "../utils/questionnaire";
import { DateTime } from "luxon";
import { auth, db } from "../lib/firebase";
import { USE_SUPABASE } from "../lib/supabase";
import { getSession as supaGetSession, getMyProfile as supaGetMyProfile, getMyMembership as supaGetMyMembership } from "../lib/ctpApi";
import { registerWebPushTokenForCurrentUser } from "../services/webNotifications";
import { getApp } from "firebase/app";
import { resolveAthleteTeamId } from "../lib/teamContext";
import MobileViewport from "../components/MobileViewport";
import UnifiedAthleteNavigation from "./UnifiedAthleteNavigation";
import BrandHeader from "../components/BrandHeader";
import StatusPill from "../components/StatusPill";

interface AthleteHomeProps {
  sessions?: Array<{ id: string; title: string; time: string; hasResponse?: boolean }>;
  onRespond?: (sessionId: string, eventData?: any) => void;
  onOpenSession?: (sessionId: string) => void;
  onNavigateToTab?: (tab: 'Home' | 'Schedule' | 'Profile') => void;
  refreshToken?: number;
}

export default function AthleteHome({
  sessions = [],
  onRespond,
  onOpenSession,
  onNavigateToTab,
  refreshToken,
}: AthleteHomeProps) {
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState<{ firstName?: string; profileImage?: string } | null>(null);
  const [showNotifReminder, setShowNotifReminder] = useState(false);
  const device = useDevice();

  useEffect(() => {
    if (typeof refreshToken !== "undefined") {
      setRefreshKey((prev) => prev + 1);
    }
  }, [refreshToken]);
  
  // Tabs configuration (active tab fixed to 'Home' on this screen)
  const tabs: Array<'Home' | 'Schedule' | 'Profile'> = ['Home', 'Schedule', 'Profile'];
  const activeTab = tabs[0];

  // Fonction de rechargement forcé
  const forceRefresh = () => {
    console.log("🔄 Rechargement forcé des données...");
    setRefreshKey(prev => prev + 1);
    setCalendarEvents([]);
    setLoading(true);
  };

  // Charger les entraînements du calendrier Google (ou Supabase)
  useEffect(() => {
    const loadCalendarEvents = async () => {
      try {
        setLoading(true);
        setError(null);

        // ── SUPABASE PATH ───────────────────────────────────────
        if (USE_SUPABASE) {
          const { data: { session } } = await (await import('../lib/supabase')).supabase!.auth.getSession();
          const user = session?.user;
          if (!user) { setLoading(false); return; }

          // Profile
          const prof = await supaGetMyProfile();
          if (prof?.profile) {
            setUserData({
              firstName: prof.profile.display_name?.split(' ')[0] || user.email?.split('@')[0],
              profileImage: null,
            });
          }
          // Notification reminder (same web logic)
          if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof Notification !== 'undefined') {
            const dismissed = localStorage.getItem('notifReminderDismissed') === 'true';
            if (Notification.permission !== 'granted' && !dismissed) {
              setShowNotifReminder(true);
            }
          }

          const membership = await supaGetMyMembership();
          const teamId = membership?.team_id;
          if (!teamId) { console.log('[SUPA] No team for user'); setLoading(false); return; }

          const upcomingTrainings = await getUpcomingTrainingsSupabase(teamId, user.id, 50, 30);
          const fallbackTz = 'UTC';

          // Format events — same mapping as Firebase path below
          const formattedEvents = upcomingTrainings.map((event: any) => {
            const displayTz = event.displayTz || event.tzid || event.timeZone || fallbackTz;
            const startLocal = event.startDate
              ? DateTime.fromJSDate(event.startDate, { zone: 'utc' }).setZone(displayTz)
              : null;
            const endLocal = event.endDate
              ? DateTime.fromJSDate(event.endDate, { zone: 'utc' }).setZone(displayTz)
              : startLocal;
            const hasTime = Boolean(startLocal && endLocal);
            const title = event.title || event.summary || 'Training';
            const timeLabel = hasTime
              ? `${startLocal!.toFormat('HH:mm')} - ${endLocal!.toFormat('HH:mm')}`
              : '──:──';
            const displayDate = startLocal
              ? startLocal.setLocale('fr').toFormat("cccc d LLLL")
              : 'Date à confirmer';

            return {
              id: event.id,
              title,
              time: timeLabel,
              timeForNextSession: timeLabel,
              displayDate,
              hasResponse: event.hasResponse ?? false,
              questionnaireState: event.questionnaireState,
              source: event.source,
              tzid: displayTz,
              displayTz,
              hasTime,
              teamId,
              ...event,
            };
          });

          setCalendarEvents(formattedEvents);
          setLoading(false);
          return;
        }
        // ── END SUPABASE PATH ───────────────────────────────────

        const currentUser =
          auth.currentUser ??
          (await new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
              unsubscribe();
              resolve(user ?? null);
            });
          }));

        if (!currentUser) {
          console.log("No authenticated user");
          setLoading(false);
          return;
        }

        console.log('[FB][PROJECT][ATHLETE]', getApp()?.options?.projectId);

        // Fetch user data for header
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userDataFromDoc = userDoc.data() as any;
          setUserData({
            firstName: userDataFromDoc.displayName?.split(' ')[0] || userDataFromDoc.firstName,
            profileImage: userDataFromDoc.profileImage || userDataFromDoc.photoURL,
          });

          // FIX 2: show notification reminder banner after 3+ logins without permission
          if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof Notification !== 'undefined') {
            const loginCount: number = userDataFromDoc.loginCount || 0;
            const isStandalone =
              window.matchMedia('(display-mode: standalone)').matches ||
              (window.navigator as any).standalone === true;
            const dismissed = localStorage.getItem('notifReminderDismissed') === 'true';
            if (loginCount >= 3 && Notification.permission !== 'granted' && !isStandalone && !dismissed) {
              setShowNotifReminder(true);
            }
          }
        }

        const teamId = await resolveAthleteTeamId(db, currentUser.uid);
        console.log('[READY]', { hasUser: !!currentUser, teamId });

        if (!teamId) {
          console.log("No team ID found for user");
          setLoading(false);
          return;
        }
        console.log('[ATHLETE][TEAM]', { teamId, uid: currentUser.uid });
        console.log('[ATHLETE][PATH]', `teams/${teamId}/trainings`);

        try {
          const dbgSnapshot = await getDocs(
            query(collection(db, `teams/${teamId}/trainings`), limit(3))
          );
          console.log('[ATHLETE][DBG_LIST] count=', dbgSnapshot.size);
          dbgSnapshot.forEach((docSnap) => {
            console.log('[ATHLETE][DBG_ITEM]', docSnap.id, docSnap.data());
          });
        } catch (dbgError) {
          console.error('[ATHLETE][FS_ERROR][DBG]', dbgError);
        }

        const teamDoc = await getDoc(doc(db, "teams", teamId));
        const teamData = teamDoc.exists() ? teamDoc.data() : null;
        const fallbackTz = (teamData?.timeZone as string) || 'Europe/Paris';

        let upcomingTrainings;
        try {
          // Utiliser une limite plus élevée pour inclure toutes les sessions complétées récemment
          upcomingTrainings = await getUpcomingTrainings(
            teamId,
            currentUser.uid,
            50, // Augmenter la limite pour inclure toutes les sessions complétées récemment
            30
          );
        } catch (fetchError) {
          console.error('[ATHLETE][FS_ERROR]', fetchError);
          throw fetchError;
        }
        console.log('[ATHLETE] training snapshot size (client):', upcomingTrainings.length);
        console.log('[UI][MAPPED_FIRST]', upcomingTrainings.slice(0, 3));

        let loggedKickboxingDebug = false;
        const formattedEvents = upcomingTrainings.map((event, index) => {
          console.log('[UI][EVENT]', event.id, {
            title: event.title,
            startDate: event.startDate?.toISOString?.() ?? null,
            startMillis: event.startUTC ?? null,
            tz: event.displayTz,
          });

          const displayTz =
            event.displayTz || event.tzid || event.timeZone || fallbackTz;

          const startLocal = event.startDate
            ? DateTime.fromJSDate(event.startDate, { zone: 'utc' }).setZone(displayTz)
            : null;
          const endLocal = event.endDate
            ? DateTime.fromJSDate(event.endDate, { zone: 'utc' }).setZone(displayTz)
            : startLocal;

          const hasTime = Boolean(startLocal && endLocal);
          const title = event.title || event.summary || 'Training';
          // Format commun : "18:30 - 19:45" pour Next Session et Upcoming
          const timeLabelForNextSession = hasTime
            ? `${startLocal!.toFormat('HH:mm')} - ${endLocal!.toFormat('HH:mm')}`
            : '──:──';
          const timeLabelForUpcoming = hasTime
            ? `${startLocal!.toFormat('HH:mm')} - ${endLocal!.toFormat('HH:mm')}`
            : '──:──';
          const displayDate = startLocal
            ? startLocal.setLocale('fr').toFormat("cccc d LLLL")
            : 'Date à confirmer';

          if (index < 3 && startLocal) {
            console.log(
              `[UI][CHECK][AthleteWeb] id=${event.id} millis=${event.startUTC} tz=${displayTz} local=${startLocal.toFormat('HH:mm')}`
            );
          }

          if (!loggedKickboxingDebug && /kickboxing/i.test(title) && startLocal) {
            console.log(
              `[UI][CHECK][web] Kickboxing id=${event.id} millis=${event.startUTC} tz=${displayTz} local=${startLocal.toFormat('HH:mm')}`
            );
            loggedKickboxingDebug = true;
          }

          if (!startLocal) {
            console.log(
              `[UI][WARN] id=${event.id} startDate malformed`,
              { title, displayTz, startDate: event.startDate }
            );
          }

          return {
            id: event.id,
            title,
            time: timeLabelForUpcoming, // Default for list
            timeForNextSession: timeLabelForNextSession, // Special format for NEXT SESSION
            displayDate,
            hasResponse: event.hasResponse ?? false,
            questionnaireState: (event as any).questionnaireState,
            source: event.source,
            tzid: displayTz,
            displayTz,
            hasTime,
            ...event, // Include all other event properties
          };
        });

        setCalendarEvents(formattedEvents);
      } catch (error) {
        console.error("❌ Error loading events:", error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setCalendarEvents([]);
      } finally {
        setLoading(false);
      }
    };

    loadCalendarEvents();
  }, [refreshKey]);

  // Auto-refresh for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      return () => {};
    }
  }, []);

  const getEventStartMillis = React.useCallback((event: any) => {
    return (
      event?.startMillis ??
      (event?.startDate instanceof Date ? event.startDate.getTime() : null) ??
      event?.startUTC ??
      (typeof event?.startUtc?.toMillis === 'function' ? event.startUtc.toMillis() : event?.startUtc) ??
      0
    );
  }, []);

  const getEventEndMillis = React.useCallback((event: any) => {
    return (
      event?.endMillis ??
      (event?.endDate instanceof Date ? event.endDate.getTime() : null) ??
      event?.endUTC ??
      (typeof event?.endUtc?.toMillis === 'function' ? event.endUtc.toMillis() : event?.endUtc) ??
      0
    );
  }, []);

  const getResponseSubmittedAtMillis = React.useCallback((event: any) => {
    const submittedAt =
      event?.response?.completedAt ||
      event?.response?.submittedAt ||
      event?.response?.createdAt ||
      event?.response?.updatedAt;

    if (!submittedAt) return null;
    if (typeof submittedAt === 'number') return submittedAt;
    if (typeof submittedAt?.toMillis === 'function') return submittedAt.toMillis();
    if (typeof submittedAt?.seconds === 'number') return submittedAt.seconds * 1000;
    return null;
  }, []);

  const getTimeRangeLabel = React.useCallback(
    (session: any) => {
      if (session?.timeForNextSession) return session.timeForNextSession;
      if (session?.time) return session.time;

      const startMillis = getEventStartMillis(session);
      const endMillis = getEventEndMillis(session);
      const tz = session?.displayTz || session?.tzid || session?.timeZone || 'Europe/Paris';

      if (startMillis && endMillis) {
        const startLocal = DateTime.fromMillis(startMillis, { zone: 'utc' }).setZone(tz);
        const endLocal = DateTime.fromMillis(endMillis, { zone: 'utc' }).setZone(tz);
        if (startLocal.isValid && endLocal.isValid) {
          return `${startLocal.toFormat('HH:mm')} - ${endLocal.toFormat('HH:mm')}`;
        }
      }

      return '──:──';
    },
    [getEventEndMillis, getEventStartMillis]
  );

  const { pendingResponses, futureSessions } = useMemo(() => {
    const nowMillis = DateTime.utc().toMillis();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    const respondSessions: any[] = [];
    const recentlyCompletedSessions: any[] = [];
    const upcomingFutureSessions: any[] = [];

    console.log('[HOME][FILTER] Processing calendar events', {
      totalCount: calendarEvents.length,
      events: calendarEvents.map((e: any) => ({
        id: e.id,
        title: e.title,
        questionnaireState: e?.questionnaireState,
        hasResponse: e?.hasResponse,
        response: e?.response ? {
          status: e.response.status,
          completedAt: e.response.completedAt,
          submittedAt: e.response.submittedAt,
        } : null,
      })),
    });

    calendarEvents.forEach((event: any) => {
      const state: QuestionnaireState | undefined = event?.questionnaireState;
      const startMillis = getEventStartMillis(event);

      console.log('[HOME][FILTER][EVENT]', {
        id: event.id,
        title: event.title,
        state,
        hasResponse: event?.hasResponse,
        response: event?.response,
        submittedAtMillis: getResponseSubmittedAtMillis(event),
      });

      if (state === 'respond') {
        respondSessions.push(event);
      } else if (state === 'completed' || event?.hasResponse) {
        // Inclure les questionnaires complétés récemment (moins de 5 minutes)
        const submittedAtMillis = getResponseSubmittedAtMillis(event);
        if (submittedAtMillis) {
          const ageMs = nowMillis - submittedAtMillis;
          console.log('[HOME][FILTER][COMPLETED]', {
            id: event.id,
            title: event.title,
            submittedAtMillis,
            ageMs,
            ageMinutes: ageMs / (60 * 1000),
            shouldInclude: ageMs <= FIVE_MINUTES_MS && ageMs >= 0,
          });
          if (ageMs <= FIVE_MINUTES_MS && ageMs >= 0) {
            // S'assurer que l'événement a bien l'état 'completed' pour l'affichage
            recentlyCompletedSessions.push({
              ...event,
              questionnaireState: 'completed' as QuestionnaireState,
            });
          }
        } else {
          // Si pas de timestamp mais état completed, inclure quand même (fallback)
          // Mais seulement si l'événement s'est terminé récemment
          const endMillis = getEventEndMillis(event);
          if (endMillis) {
            const ageMs = nowMillis - endMillis;
            console.log('[HOME][FILTER][COMPLETED][FALLBACK]', {
              id: event.id,
              title: event.title,
              endMillis,
              ageMs,
              ageMinutes: ageMs / (60 * 1000),
              shouldInclude: ageMs <= FIVE_MINUTES_MS && ageMs >= 0,
            });
            if (ageMs <= FIVE_MINUTES_MS && ageMs >= 0) {
              recentlyCompletedSessions.push({
                ...event,
                questionnaireState: 'completed' as QuestionnaireState,
              });
            }
          }
        }
      }

      const isFuture = Boolean(startMillis && startMillis > nowMillis);
      const isInQuestionnaireWindow = state === 'respond' || (state === 'completed' && recentlyCompletedSessions.some((s: any) => s.id === event.id));

      if (isFuture && !isInQuestionnaireWindow) {
        upcomingFutureSessions.push(event);
      }
    });

    // Trier par heure de début (du plus tôt au plus tard dans la journée)
    const sortByStart = (a: any, b: any) =>
      (getEventStartMillis(a) ?? Number.MAX_SAFE_INTEGER) -
      (getEventStartMillis(b) ?? Number.MAX_SAFE_INTEGER);

    respondSessions.sort(sortByStart);
    recentlyCompletedSessions.sort(sortByStart);

    upcomingFutureSessions.sort(
      (a, b) =>
        (getEventStartMillis(a) ?? Number.MAX_SAFE_INTEGER) -
        (getEventStartMillis(b) ?? Number.MAX_SAFE_INTEGER)
    );

    console.log('[HOME][COMPLETED] Recently completed sessions', {
      count: recentlyCompletedSessions.length,
      sessions: recentlyCompletedSessions.map(s => ({
        id: s.id,
        title: s.title,
        state: s.questionnaireState,
        completedAt: getResponseSubmittedAtMillis(s),
      })),
    });

    return {
      pendingResponses: [...respondSessions, ...recentlyCompletedSessions],
      futureSessions: upcomingFutureSessions,
    };
  }, [calendarEvents, getEventEndMillis, getEventStartMillis, getResponseSubmittedAtMillis]);

  // Rafraîchissement automatique pour que les sessions complétées disparaissent après 5 minutes
  useEffect(() => {
    if (calendarEvents.length === 0) return;

    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const nowMillis = DateTime.utc().toMillis();

    // Trouver la prochaine session complétée qui va disparaître
    const completedSessions = calendarEvents.filter((event: any) => {
      const state: QuestionnaireState | undefined = event?.questionnaireState;
      if (state !== 'completed') return false;
      const submittedAtMillis = getResponseSubmittedAtMillis(event);
      if (!submittedAtMillis) return false;
      const ageMs = nowMillis - submittedAtMillis;
      return ageMs <= FIVE_MINUTES_MS && ageMs >= 0;
    });

    if (completedSessions.length === 0) return;

    // Trouver la session complétée la plus ancienne (celle qui va disparaître en premier)
    const oldestCompleted = completedSessions.reduce((oldest: any, current: any) => {
      const oldestAt = getResponseSubmittedAtMillis(oldest) ?? 0;
      const currentAt = getResponseSubmittedAtMillis(current) ?? 0;
      return currentAt < oldestAt ? current : oldest;
    }, completedSessions[0]);

    const oldestSubmittedAt = getResponseSubmittedAtMillis(oldestCompleted);
    if (!oldestSubmittedAt) return;

    // Calculer quand cette session doit disparaître (5 minutes après sa soumission)
    const disappearAt = oldestSubmittedAt + FIVE_MINUTES_MS;
    const timeUntilDisappear = disappearAt - nowMillis;

    if (timeUntilDisappear > 0) {
      console.log("[HOME][AUTO_REFRESH] Prochain rafraîchissement dans", Math.round(timeUntilDisappear / 1000), "secondes");
      const timeoutId = setTimeout(() => {
        console.log("[HOME][AUTO_REFRESH] Rafraîchissement pour masquer les sessions complétées après 5 minutes");
        forceRefresh();
      }, timeUntilDisappear + 1000); // +1 seconde pour s'assurer que c'est bien passé

      return () => clearTimeout(timeoutId);
    }
  }, [calendarEvents, getResponseSubmittedAtMillis]);

  const nextSession = futureSessions.length > 0 ? futureSessions[0] : null;
  const upcomingSessions = futureSessions.length > 1 ? futureSessions.slice(1) : [];

  // FIX 2: dismiss handler for notification reminder banner
  const notifReminderDismissCount = useRef(0);
  const handleDismissNotifReminder = () => {
    notifReminderDismissCount.current += 1;
    if (notifReminderDismissCount.current >= 2) {
      localStorage.setItem('notifReminderDismissed', 'true');
    }
    setShowNotifReminder(false);
  };

  const handleEnableNotifFromBanner = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try { await registerWebPushTokenForCurrentUser(); } catch (e) { /* silent */ }
    }
    setShowNotifReminder(false);
  };

  const containerStyle = getMainContainerStyle(device);
  const headerPadding = getResponsiveSpacing('xl', device);
  const sectionPadding = getResponsiveSpacing('lg', device);

  const sanitizedContainerStyle = useMemo(() => {
    const style = { ...(containerStyle as Record<string, any>) };
    if (typeof style.marginHorizontal === 'string') {
      style.marginHorizontal = 0;
    }
    return style;
  }, [containerStyle]);

  // Render questionnaire action based on state
  const renderQuestionnaireAction = (session: any) => {
    const state: QuestionnaireState | undefined = session?.questionnaireState;
    
    if (!state) {
      console.error("[HOME][STATE][ACTION] questionnaireState missing for", session.id, session.title);
      return null;
    }

    const nowMillis = DateTime.utc().toMillis();
    const endMillis = session?.endMillis ?? (session?.endDate ? new Date(session.endDate).getTime() : null);

    console.log("[HOME][STATE][ACTION]", {
      id: session.id,
      title: session.title,
      state,
      endMillis,
      now: nowMillis,
    });

    switch (state) {
      case 'completed':
        return (
          <StatusPill variant="completed" testID={`status-pill-completed-${session.id}`} />
        );

      case 'comingSoon':
        return (
          <StatusPill variant="comingSoon" testID={`status-pill-coming-soon-${session.id}`} />
        );

      case 'expired':
        return (
          <StatusPill variant="expired" testID={`status-pill-expired-${session.id}`} />
        );

      case 'respond':
        return (
          <StatusPill
            variant="respond"
            onPress={() => {
              console.log("[HOME][RESPOND][CLICK] Respond clicked for session:", session.id, session.title);
              if (onRespond) {
                onRespond(session.id, session);
              }
            }}
            showNotificationDot
            testID={`respond-button-${session.id}`}
          />
        );

      default:
        console.warn("[HOME][STATE][ACTION] Unknown questionnaire state:", state);
        return null;
    }
  };

  // Render questionnaire action for web
  const renderQuestionnaireActionWeb = (session: any) => {
    const state: QuestionnaireState | undefined = session?.questionnaireState;
    
    if (!state) {
      return null;
    }

    const nowMillis = DateTime.utc().toMillis();
    const endMillis = session?.endMillis ?? (session?.endDate ? new Date(session.endDate).getTime() : null);

    switch (state) {
      case 'completed':
        return (
          <StatusPill variant="completed" testID={`status-pill-completed-web-${session.id}`} />
        );

      case 'comingSoon':
        return (
          <StatusPill variant="comingSoon" testID={`status-pill-coming-soon-web-${session.id}`} />
        );

      case 'expired':
        return (
          <StatusPill variant="expired" testID={`status-pill-expired-web-${session.id}`} />
        );

      case 'respond':
        return (
          <StatusPill
            variant="respond"
            onPress={() => {
              if (onRespond) {
                onRespond(session.id, session);
              }
            }}
            showNotificationDot
            testID={`respond-button-web-${session.id}`}
          />
        );

      default:
        return null;
    }
  };

  const renderPendingQuestionnairesWeb = () => {
    if (pendingResponses.length === 0) return null;

    return (
      <div style={{
        width: "100%",
        maxWidth: "100%",
        marginTop: "0px",
        marginBottom: "30px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box"
      }}>
        <div style={{
          fontSize: "14px",
          fontWeight: 700,
          color: "#FFFFFF",
          marginBottom: "6px",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          textAlign: "center",
          width: "100%"
        }}>
          SESSIONS TO RATE
        </div>
        <div style={{
          fontSize: "14px",
          color: "rgba(255,255,255,0.65)",
          marginBottom: "14px",
          fontWeight: 500,
          textAlign: "center",
          width: "100%"
        }}>
          Tap RESPOND to complete your questionnaire.
        </div>
        <div style={{
          height: "2px",
          width: "40%",
          margin: "0 auto 18px auto",
          background: "linear-gradient(90deg, transparent 0%, rgba(0, 224, 255, 0.25) 50%, transparent 100%)",
          boxShadow: "0 0 6px rgba(0, 224, 255, 0.25)"
        }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", width: "100%" }}>
          {pendingResponses.map((session, index) => (
            <div
              key={session.id || index}
              style={{
                background: "rgba(255,255,255,0.08)",
                borderRadius: "16px",
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid rgba(0,224,255,0.35)",
                boxShadow: "0 10px 32px rgba(0,0,0,0.35)"
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "16px", fontWeight: 600 }}>{session.title}</span>
                <span style={{ fontSize: "13px", color: "#9CA3AF" }}>
                  {getTimeRangeLabel(session)}
                </span>
              </div>
              {renderQuestionnaireActionWeb(session)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPendingQuestionnairesMobile = () => {
    if (pendingResponses.length === 0) return null;
    return (
      <View style={styles.pendingSection}>
        <Text style={styles.pendingLabel}>SESSIONS TO RATE</Text>
        <Text style={styles.pendingSubtitle}>Tap RESPOND to complete your questionnaire.</Text>
        {pendingResponses.map((session: any, index: number) => (
          <View key={session.id || index} style={styles.pendingCard}>
            <View style={styles.pendingInfo}>
              <Text style={styles.pendingTitle}>{session.title}</Text>
              <Text style={styles.pendingTime}>
                {getTimeRangeLabel(session)}
              </Text>
            </View>
            <View style={{ marginTop: 8 }}>
              {renderQuestionnaireAction(session)}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderSectionDivider = (styleOverride?: any) => (
    <View style={[styles.sectionDividerContainer, styleOverride]}>
      <LinearGradient
        colors={['transparent', 'rgba(0, 224, 255, 0.8)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sectionDivider}
      />
    </View>
  );

  const handleTabNavigation = (tab: 'Home' | 'Schedule' | 'Profile') => {
    if (onNavigateToTab) {
      onNavigateToTab(tab);
    }
  };

  // Web version with same style as Profile
  if (Platform.OS === 'web') {
    return (
      <MobileViewport>
        <div style={{
          width: "100%",
          maxWidth: "375px",
          height: "812px",
          backgroundColor: "#0A0F1A",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontFamily: Platform.select({ web: "'Inter', sans-serif", default: "System" }),
          color: "white",
          pointerEvents: "auto",
          margin: "0 auto",
          boxSizing: "border-box"
        }}>
          {/* Background Gradient - Futuristic Dark → Deep Navy → Black */}
          <div style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            // Nuit profonde ChampionTrackPro + halos data
            background: "linear-gradient(180deg, #0E1528 0%, #090F1F 35%, #050910 100%), radial-gradient(circle at 50% 0%, rgba(0, 224, 255, 0.08) 0%, rgba(0, 0, 0, 0) 55%), radial-gradient(circle at 0% 100%, rgba(74, 103, 255, 0.12) 0%, rgba(0, 0, 0, 0) 60%)",
            zIndex: 0,
            pointerEvents: "none"
          }} />

          {/* ==== BRAND HEADER – CHAMPIONTRACKPRO ==== */}
          <div style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}>
            <BrandHeader />
          </div>

          {/* Main Content */}
          <div style={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            width: "100%",
            padding: "0 22px 120px 22px",
            overflowY: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            boxSizing: "border-box"
          }}>
        <div style={{ 
          paddingTop: "40px",
              paddingBottom: "36px",
              width: "100%",
              maxWidth: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box"
            }}>
              {/* FIX 2: notification reminder banner */}
              {showNotifReminder && (
                <div style={{
                  width: "100%",
                  background: "rgba(0,212,255,0.08)",
                  border: "1px solid rgba(0,212,255,0.25)",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  boxSizing: "border-box",
                }}>
                  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", flex: 1 }}>
                    🔔 Enable notifications to never miss a session alert
                  </span>
                  <button
                    onClick={handleEnableNotifFromBanner}
                    style={{
                      background: "linear-gradient(135deg, #00BFFF, #0066FF)",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "6px 12px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Enable
                  </button>
                  <button
                    onClick={handleDismissNotifReminder}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "16px",
                      cursor: "pointer",
                      padding: "0 4px",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              {pendingResponses.length > 0 && renderPendingQuestionnairesWeb()}
              {pendingResponses.length > 0 && (
                <div style={{
                  width: "60%",
                  height: "1px",
                  margin: "12px auto 36px",
                  background: "linear-gradient(90deg, rgba(0,0,0,0), rgba(0,224,255,0.9), rgba(0,0,0,0))",
                  boxShadow: "0 0 20px rgba(0, 224, 255, 0.4)"
                }} />
              )}

              {loading ? (
                <div style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "200px"
                }}>
                  <div style={{
                    fontSize: "16px",
                    color: "#9AA3B2"
                  }}>
                    Loading sessions...
                  </div>
                </div>
              ) : (
                <div style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center"
                }}>
                  {/* NEXT SESSION Section */}
                  {nextSession && (
                    <div style={{
                      marginBottom: "30px",
                      width: "100%",
                      maxWidth: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      boxSizing: "border-box"
                    }}>
                      <div style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        marginBottom: "6px",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                        textAlign: "center",
                        width: "100%"
                      }}>
                        NEXT SESSION
                      </div>
                      <div style={{
                        fontSize: "14px",
                        color: "rgba(255,255,255,0.65)",
                        marginBottom: "14px",
                        fontWeight: 500,
                        textAlign: "center",
                        width: "100%"
                      }}>
                        Your upcoming training session.
                      </div>
                      {/* Separator Line - Neon Cyan */}
                      <div style={{
                        height: "2px",
                        width: "40%",
                        margin: "0 auto 18px auto",
                        background: "linear-gradient(90deg, transparent 0%, rgba(0, 224, 255, 0.25) 50%, transparent 100%)",
                        boxShadow: "0 0 6px rgba(0, 224, 255, 0.25)"
                      }} />
                      <div style={{
                        background: "rgba(255, 255, 255, 0.07)",
                        backdropFilter: "blur(24px)",
                        WebkitBackdropFilter: "blur(24px)",
                        border: "1px solid rgba(0, 224, 255, 0.35)",
                        borderRadius: "22px",
                        padding: "34px 26px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 16px 40px rgba(0, 0, 0, 0.45), 0 0 30px rgba(0, 224, 255, 0.08)",
                        width: "100%",
                        maxWidth: "100%",
                        gap: "22px",
                        margin: "0 auto",
                        minHeight: "140px",
                        boxSizing: "border-box"
                      }}>
                        <div style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          textAlign: "center",
                          width: "100%",
                          justifyContent: "center"
                        }}>
                          <div style={{
                            fontSize: "18px",
                            fontWeight: 700,
                            color: "#FFFFFF",
                            letterSpacing: "0.2px",
                            marginBottom: "8px",
                            textAlign: "center"
                          }}>
                            {nextSession.title}
                          </div>
                          <div style={{
                            fontSize: "14px",
                            color: "rgba(255,255,255,0.8)",
                            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                            fontWeight: 600,
                            letterSpacing: "0.4px",
                            textAlign: "center"
                          }}>
                            {(nextSession as any).timeForNextSession || nextSession.time}
                          </div>
                        </div>
                        <div style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          width: "100%"
                        }}>
                          <StatusPill variant="comingSoon" />
                        </div>
                      </div>
                    </div>
                  )}

          {/* UPCOMING SESSIONS Section - hidden on Home (Next session only) */}
          {false && upcomingSessions.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                        marginBottom: "6px",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase"
                      }}>
                        UPCOMING SESSIONS
                      </div>
                      <div style={{
                        fontSize: "14px",
                        color: "rgba(255,255,255,0.65)",
                        marginBottom: "14px",
                        fontWeight: 500
                      }}>
                        Your next training events.
                      </div>
                      {/* Separator Line - Neon Cyan */}
                      <div style={{
                        height: "2px",
                        width: "40%",
                        margin: "0 auto 18px auto",
                        background: "linear-gradient(90deg, transparent 0%, rgba(0, 224, 255, 0.25) 50%, transparent 100%)",
                        boxShadow: "0 0 6px rgba(0, 224, 255, 0.25)"
                      }} />
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "18px"
                      }}>
                        {upcomingSessions.map((session: any, index: number) => (
                          <div
                            key={session.id || index}
                            style={{
                              background: "rgba(255, 255, 255, 0.06)",
                              backdropFilter: "blur(22px)",
                              WebkitBackdropFilter: "blur(22px)",
                              border: "1px solid rgba(0, 224, 255, 0.35)",
                              borderRadius: "18px",
                              padding: "16px 18px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.45), inset 0 0 22px rgba(0, 224, 255, 0.04)",
                              transition: "all 0.3s cubic-bezier(0.4, 0.1, 0.2, 1)"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "translateY(-2px)";
                              e.currentTarget.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.4), 0 0 30px rgba(0, 234, 255, 0.1), inset 0 0 20px rgba(0, 234, 255, 0.08)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(0, 234, 255, 0.05)";
                            }}
                          >
                            <div>
                              <div style={{
                                fontSize: "16px",
                                fontWeight: 700,
                                color: "#FFFFFF",
                                letterSpacing: "0.2px",
                                marginBottom: "4px"
                              }}>
                                {session.title}
                              </div>
                              <div style={{
                                fontSize: "12px",
                                color: "rgba(255,255,255,0.7)",
                                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                                fontWeight: 600,
                                letterSpacing: "0.4px"
                              }}>
                                {session.time}
                              </div>
                            </div>
                            {renderQuestionnaireActionWeb(session)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!nextSession && upcomingSessions.length === 0 && (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "40px 20px",
                      textAlign: "center"
                    }}>
                      <div style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#FFFFFF",
                        marginBottom: "8px"
                      }}>
                        No training scheduled
                      </div>
                      <div style={{
                        fontSize: "14px",
                        color: "#9AA3B2"
                      }}>
                        No training is scheduled at the moment. Check the Schedule tab to see all events.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Navigation unifiée pour les athlètes */}
          <UnifiedAthleteNavigation 
            activeTab="Home" 
            onNavigate={handleTabNavigation} 
          />
        </div>
      </MobileViewport>
    );
  }

  // React Native version (unchanged)
  return (
    <LinearGradient
      colors={['#0A0F1A', '#0F1623', '#1A1F2E', '#0D1117', '#000000']}
      style={[styles.container, sanitizedContainerStyle]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Profile */}
        <View style={[styles.header, { paddingHorizontal: headerPadding }]}>
          <View style={[
            styles.headerContent,
            device.isMobile ? styles.headerContentMobile : styles.headerContentDesktop
          ]}>
            <View style={styles.welcomeSection}>
              <Text style={[
                styles.welcomeText,
                { fontSize: getResponsiveFontSize('xxxl', device) }
              ]}>
                WELCOME {userData?.firstName ? userData.firstName.toUpperCase() : 'ATHLETE'}
              </Text>
              <Text style={[
                styles.subtitleText,
                { fontSize: getResponsiveFontSize('md', device) }
              ]}>
                HERE IS YOUR NEXT SESSION.
              </Text>
            </View>
            <View style={styles.profileContainer}>
              {userData?.profileImage ? (
                <Image
                  source={{ uri: userData.profileImage }}
                  style={[
                    styles.profileImage,
                    { 
                      width: device.isMobile ? 36 : 40,
                      height: device.isMobile ? 36 : 40
                    }
                  ]}
                />
              ) : (
                <View style={[
                  styles.profileImage,
                  { 
                    width: device.isMobile ? 36 : 40,
                    height: device.isMobile ? 36 : 40
                  }
                ]}>
                  <Text style={[
                    styles.profileInitial,
                    { fontSize: getResponsiveFontSize('lg', device) }
                  ]}>
                    {userData?.firstName ? userData.firstName.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {renderPendingQuestionnairesMobile()}
        {pendingResponses.length > 0 && renderSectionDivider({ marginTop: tokens.spacing.md })}

        {/* NEXT SESSION Section */}
        <View style={[styles.nextSessionSection, { paddingHorizontal: sectionPadding }]}>
          <Text style={[
            styles.nextSessionTitle,
            { fontSize: getResponsiveFontSize('lg', device) }
          ]}>
            NEXT SESSION
          </Text>
          <Text style={[
            styles.nextSessionSubtitle,
            { fontSize: getResponsiveFontSize('sm', device) }
          ]}>
            Your upcoming training session.
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[
                styles.loadingText,
                { fontSize: getResponsiveFontSize('sm', device) }
              ]}>
                Loading calendar...
              </Text>
            </View>
          ) : nextSession ? (
            <View style={styles.nextSessionCard}>
              <View style={styles.sessionInfo}>
                <Text style={[
                  styles.sessionTitle,
                  { fontSize: getResponsiveFontSize('md', device) }
                ]}>
                  {nextSession.title}
                </Text>
                <Text style={[
                  styles.sessionTime,
                  { fontSize: getResponsiveFontSize('xs', device) }
                ]}>
                  {(nextSession as any).timeForNextSession || nextSession.time}
                </Text>
              </View>
            <View style={styles.sessionAction}>
              <StatusPill variant="comingSoon" />
            </View>
            </View>
          ) : (
            <View style={styles.noSessionsContainer}>
              <Text style={[
                styles.noSessionsText,
                { fontSize: getResponsiveFontSize('md', device) }
              ]}>
                No training scheduled
              </Text>
              <Text style={[
                styles.noSessionsSubtext,
                { fontSize: getResponsiveFontSize('sm', device) }
              ]}>
                No training is scheduled at the moment. Check the Schedule tab to see all events.
              </Text>
            </View>
          )}
        </View>

        {/* UPCOMING SESSIONS Section - hidden on Home (Next session only) */}
        {false && upcomingSessions.length > 0 && (
          <View style={[styles.sessionsSection, { paddingHorizontal: sectionPadding }]}>
            <View style={styles.sectionHeader}>
              <Text style={[
                styles.sectionTitle,
                { fontSize: getResponsiveFontSize('xl', device) }
              ]}>
                UPCOMING SESSIONS
              </Text>
              <Text style={[
                styles.sectionSubtitle,
                { fontSize: getResponsiveFontSize('sm', device) }
              ]}>
                Your next training events.
              </Text>
            </View>
          
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={[
                  styles.loadingText,
                  { fontSize: getResponsiveFontSize('md', device) }
                ]}>
                  Loading sessions...
                </Text>
              </View>
            ) : (
              <View style={[
                styles.sessionsList,
                device.isDesktop && styles.sessionsListDesktop
              ]}>
                {upcomingSessions.map((session, index) => (
                  <View 
                    key={session.id || index} 
                    style={[
                      styles.sessionCard,
                      device.isDesktop && styles.sessionCardDesktop
                    ]}
                  >
                    <View style={styles.sessionInfo}>
                      <Text style={[
                        styles.sessionTime,
                        { fontSize: getResponsiveFontSize('sm', device) }
                      ]}>
                        {session.time}
                      </Text>
                      <Text style={[
                        styles.sessionTitle,
                        { fontSize: getResponsiveFontSize('lg', device) }
                      ]}>
                        {session.title}
                      </Text>
                    </View>
                    <View style={styles.sessionAction}>
                      {renderQuestionnaireAction(session)}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      {onNavigateToTab && (
        <View style={styles.bottomNav}>
          <Pressable
            style={styles.navItem}
            onPress={() => onNavigateToTab('Home')}
          >
            <View style={[
              styles.navIconContainer,
              activeTab === 'Home' && styles.navIconContainerActive
            ]}>
              <Text style={[
                styles.navIcon,
                activeTab === 'Home' && styles.navIconActive
              ]}>🏠</Text>
            </View>
            <Text style={[
              styles.navLabel,
              activeTab === 'Home' && styles.navLabelActive
            ]}>Home</Text>
            {activeTab === 'Home' && <View style={styles.activeIndicator} />}
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() => onNavigateToTab('Schedule')}
          >
            <View style={[
              styles.navIconContainer,
              activeTab === 'Schedule' && styles.navIconContainerActive
            ]}>
              <Text style={[
                styles.navIcon,
                activeTab === 'Schedule' && styles.navIconActive
              ]}>📅</Text>
            </View>
            <Text style={[
              styles.navLabel,
              activeTab === 'Schedule' && styles.navLabelActive
            ]}>Schedule</Text>
            {activeTab === 'Schedule' && <View style={styles.activeIndicator} />}
          </Pressable>
          <Pressable
            style={styles.navItem}
            onPress={() => onNavigateToTab('Profile')}
          >
            <View style={[
              styles.navIconContainer,
              activeTab === 'Profile' && styles.navIconContainerActive
            ]}>
              <Text style={[
                styles.navIcon,
                activeTab === 'Profile' && styles.navIconActive
              ]}>👤</Text>
            </View>
            <Text style={[
              styles.navLabel,
              activeTab === 'Profile' && styles.navLabelActive
            ]}>Profile</Text>
            {activeTab === 'Profile' && <View style={styles.activeIndicator} />}
          </Pressable>
        </View>
      )}
    </LinearGradient>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bg,
    paddingTop: Platform.OS === 'web' ? 60 : 0,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  
  header: {
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.xxl,
    paddingBottom: tokens.spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
  
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  
  headerContentMobile: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.lg,
    width: '100%',
  },
  
  headerContentDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  
  welcomeSection: {
    flex: 1,
    alignItems: 'center',
  },
  
  welcomeText: {
    fontSize: tokens.fontSizes.xxxl,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    letterSpacing: 0.5,
    marginBottom: tokens.spacing.sm,
    textShadowColor: 'rgba(0, 234, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    textAlign: 'center',
  },
  
  subtitleText: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    lineHeight: 22,
    textAlign: 'center',
  },
  
  profileContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary,
    borderWidth: 2,
    borderColor: 'rgba(0, 224, 255, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...tokens.shadows.glow,
  },
  
  profileInitial: {
    fontSize: tokens.fontSizes.xl,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
  },
  
  nextSessionSection: {
    marginBottom: tokens.spacing.xxl,
    marginTop: tokens.spacing.xxl,
    paddingTop: tokens.spacing.lg,
    alignItems: 'center',
  },
  
  nextSessionTitle: {
    fontSize: tokens.fontSizes.lg,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  
  nextSessionSubtitle: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.lg,
    textAlign: 'center',
  },
  
  nextSessionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 22,
    paddingVertical: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 224, 255, 0.35)',
    shadowColor: '#00C6FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 12,
    width: '100%',
    minHeight: 180,
  },
  
  sessionsSection: {
    marginTop: tokens.spacing.xxl,
    paddingTop: tokens.spacing.lg,
  },
  
  sectionHeader: {
    marginBottom: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  
  sectionTitle: {
    fontSize: tokens.fontSizes.lg,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  
  sectionSubtitle: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    textAlign: 'center',
  },
  
  sessionsList: {
    gap: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  
  sessionsListDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  
  sessionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    padding: tokens.spacing.md,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 234, 255, 0.3)',
    marginBottom: tokens.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 10,
    width: '100%',
  },
  
  sessionCardDesktop: {
    width: '48%',
    marginBottom: tokens.spacing.lg,
  },
  
  sessionInfo: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
    gap: tokens.spacing.xs,
  },
  
  sessionTime: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  
  sessionTitle: {
    fontSize: tokens.fontSizes.lg,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    textAlign: 'center',
  },
  
  sessionAction: {
    alignItems: 'center',
    width: '100%',
    marginTop: tokens.spacing.lg,
  },
  
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 200, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 255, 200, 0.4)',
    shadowColor: '#00FFC8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  
  completedIcon: {
    fontSize: tokens.fontSizes.sm,
    color: '#00FFC8',
    marginRight: 6,
  },
  
  completedText: {
    fontSize: 14,
    color: '#00FFC8',
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.medium,
    letterSpacing: 0.03,
  },
  

  pendingSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginBottom: tokens.spacing.xxl,
    alignItems: 'center',
    gap: 12,
  },
  pendingLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: tokens.colors.text,
    fontSize: tokens.fontSizes.lg,
    fontWeight: tokens.fontWeights.bold,
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  pendingSubtitle: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.lg,
  },
  pendingCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,224,255,0.25)',
    marginBottom: 12,
  },
  pendingInfo: {
    marginBottom: 8,
  },
  pendingTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  pendingTime: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xxxl,
  },
  
  loadingText: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  noSessionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xxxl,
  },
  
  noSessionsText: {
    fontSize: tokens.fontSizes.lg,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.medium,
    marginBottom: tokens.spacing.sm,
  },
  
  noSessionsSubtext: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  // Bottom Navigation Bar
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 21, 40, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: Platform.OS === 'ios' ? 20 : 12,
    paddingHorizontal: tokens.spacing.lg,
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    zIndex: 1000,
    ...tokens.shadows.card,
  },
  
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xs,
    gap: 4,
  },
  
  navIconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  
  navIconContainerActive: {
    transform: [{ scale: 1.1 }],
  },
  
  navIcon: {
    fontSize: 24,
  },
  
  navIconActive: {
    // Shadow effect handled by container
  },
  
  navLabel: {
    fontSize: 12,
    fontWeight: tokens.fontWeights.medium,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  navLabelActive: {
    color: tokens.colors.accentCyan,
    fontWeight: tokens.fontWeights.semibold,
  },
  
  sectionDividerContainer: {
    width: '70%',
    alignSelf: 'center',
    marginTop: tokens.spacing.lg,
    marginBottom: tokens.spacing.xxl,
  },
  sectionDivider: {
    height: 2,
    width: '100%',
    borderRadius: 2,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },

  activeIndicator: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -16,
    width: 32,
    height: 3,
    backgroundColor: tokens.colors.accentCyan,
    borderRadius: 2,
    ...tokens.shadows.glow,
  },
  
  // Questionnaire state badges
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 224, 255, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 224, 255, 0.45)',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  
  comingSoonIcon: {
    fontSize: tokens.fontSizes.sm,
    marginRight: 8,
    color: '#8DEBFF',
  },
  
  comingSoonText: {
    fontSize: 14,
    color: '#E3FBFF',
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.medium,
    letterSpacing: 0.03,
  },
  
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
  },
  
  expiredIcon: {
    fontSize: tokens.fontSizes.sm,
    marginRight: 6,
  },
  
  expiredText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.medium,
    letterSpacing: 0.03,
  },
});
