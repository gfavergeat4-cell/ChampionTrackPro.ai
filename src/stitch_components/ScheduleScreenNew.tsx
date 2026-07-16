import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions, Platform, ScrollView } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, limit, query } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { tokens } from "../theme/tokens";
import { useDevice } from "../hooks/useDevice";
import { getResponsiveSpacing, getResponsiveFontSize, getMainContainerStyle } from "../utils/responsive";
import { getEventsForDayLegacy as getEventsForDay, getEventsForWeek, getEventsForMonth } from "../lib/scheduleQueries";
import { getEventsForDaySupabase, getEventsForWeekSupabase, getEventsForMonthSupabase } from "../lib/scheduleQueriesSupabase";
import { DateTime } from "luxon";
import { toJSDate } from "../utils/time";
import { auth, db } from "../lib/firebase";
import { USE_SUPABASE } from "../lib/supabase";
import { getMyMembership as supaGetMyMembership } from "../lib/ctpApi";
import { getApp } from "firebase/app";
import { resolveAthleteTeamId } from "../lib/teamContext";
import MobileViewport from "../components/MobileViewport";
import UnifiedAthleteNavigation from "./UnifiedAthleteNavigation";
import { QuestionnaireState } from "../utils/questionnaire";
import { useNavigation } from "@react-navigation/native";
import StatusPill from "../components/StatusPill";

type TrainingStatus =
  | "upcoming"
  | "ongoing"
  | "questionnaire-open"
  | "cooldown"
  | "expired"
  | "completed";

const QUESTIONNAIRE_DELAY_MS = 0;
const QUESTIONNAIRE_WINDOW_MS = 24 * 60 * 60 * 1000;

function toMillis(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && !isNaN(value)) return value;
  if (typeof value === "string") {
    const num = Number(value);
    return isNaN(num) ? null : num;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") {
    const num = value.toMillis();
    return typeof num === "number" ? num : null;
  }
  return null;
}

function getTrainingStatus(event: any, now: Date = new Date()): TrainingStatus {
  if (!event) return "upcoming";
  if (event?.questionnaireState === "completed" || event?.responseStatus === "completed") {
    return "completed";
  }

  const startMs =
    toMillis(event?.startMillis) ??
    (event?.startDateTime ? event.startDateTime.toMillis() : null) ??
    toMillis(event?.startDate) ??
    toMillis(event?.startUTC) ??
    toMillis(event?.startUtc);

  const endMs =
    toMillis(event?.endMillis) ??
    (event?.endDateTime ? event.endDateTime.toMillis() : null) ??
    toMillis(event?.endDate) ??
    toMillis(event?.endUTC) ??
    toMillis(event?.endUtc) ??
    startMs;

  if (!startMs || !endMs) {
    return "upcoming";
  }

  const nowMs = now.getTime();
  const questionnaireOpenFrom = endMs + QUESTIONNAIRE_DELAY_MS;
  const questionnaireOpenUntil = endMs + QUESTIONNAIRE_WINDOW_MS;

  if (nowMs < startMs) {
    return "upcoming";
  }

  if (nowMs >= startMs && nowMs <= endMs) {
    return "ongoing";
  }

  if (nowMs >= endMs && nowMs < questionnaireOpenFrom) {
    return "cooldown";
  }

  if (nowMs >= questionnaireOpenFrom && nowMs <= questionnaireOpenUntil) {
    return "questionnaire-open";
  }

  if (nowMs > questionnaireOpenUntil) {
    return "expired";
  }

  return "expired";
}

function getUiTrainingStatus(event: any): TrainingStatus {
  return event?.trainingStatus ?? getTrainingStatus(event);
}

interface ScheduleScreenProps {
  onRespond?: (sessionId: string, eventData?: any) => void;
}

export default function ScheduleScreen({ onRespond }: ScheduleScreenProps) {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('Day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(() => {
    const today = new Date();
    // Luxon startOf('week') commence par lundi par défaut
    return DateTime.fromJSDate(today).startOf('week').toJSDate();
  });
  const [selectedDayInWeek, setSelectedDayInWeek] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const device = useDevice();
  const safeSelectedDateForHeader = toJSDate(selectedDate);
  const todayDateTime = DateTime.now();
  const isDayTabOnToday = DateTime.fromJSDate(toJSDate(selectedDate)).hasSame(todayDateTime, 'day');
  const isWeekTabOnToday = DateTime.fromJSDate(selectedDayInWeek).hasSame(todayDateTime, 'day');
  const headerDisplayDate = DateTime.fromJSDate(safeSelectedDateForHeader)
    .setLocale('en')
    .toFormat('cccc d LLLL');
  
  // Week navigation helpers
  const handleSelectDate = (date: Date | DateTime) => {
    const jsDate = toJSDate(date as any);
    const safeDate = toJSDate(jsDate);
    setSelectedDate(safeDate);
    setSelectedDayInWeek(safeDate);
    setCurrentWeek(DateTime.fromJSDate(safeDate).startOf('week').toJSDate());
  };

  const goToPreviousWeek = () => {
    const newWeek = DateTime.fromJSDate(currentWeek).minus({ weeks: 1 }).startOf('week').toJSDate();
    setCurrentWeek(newWeek);
    setSelectedDayInWeek(newWeek);
  };
  
  const goToNextWeek = () => {
    const newWeek = DateTime.fromJSDate(currentWeek).plus({ weeks: 1 }).startOf('week').toJSDate();
    setCurrentWeek(newWeek);
    setSelectedDayInWeek(newWeek);
  };
  
  const getWeekInfo = () => {
    const weekStart = DateTime.fromJSDate(currentWeek).startOf('week');
    const weekNumber = weekStart.weekNumber;
    const weekOfText = `Week of ${weekStart.toFormat('LLL d')}`;
    return { weekOfText, weekNumber };
  };

  const goToToday = () => {
    handleSelectDate(new Date());
  };

  // Load events for the selected date
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        setEvents([]);

        const safeSelectedDate = toJSDate(selectedDate);

        // ── SUPABASE PATH ───────────────────────────────────────
        if (USE_SUPABASE) {
          const { data: { session } } = await (await import('../lib/supabase')).supabase!.auth.getSession();
          const user = session?.user;
          if (!user) { setLoading(false); return; }

          const membership = await supaGetMyMembership();
          const teamId = membership?.team_id;
          if (!teamId) { setLoading(false); return; }

          let eventsData: any[] = [];
          if (activeTab === 'Day') {
            eventsData = await getEventsForDaySupabase(teamId, safeSelectedDate, user.id);
          } else if (activeTab === 'Week') {
            const weekStart = DateTime.fromJSDate(currentWeek).startOf('week').toJSDate();
            eventsData = await getEventsForWeekSupabase(teamId, weekStart, user.id);
          } else {
            const monthAnchor = new Date(safeSelectedDate.getFullYear(), safeSelectedDate.getMonth(), 1);
            eventsData = await getEventsForMonthSupabase(teamId, monthAnchor, user.id);
          }

          setEvents(eventsData);
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
          console.log("[Schedule] No authenticated user");
          setLoading(false);
          return;
        }

        const teamId = await resolveAthleteTeamId(db, currentUser.uid);
        if (!teamId) {
          console.log('[READY]', { hasUser: !!currentUser, teamId: null });
          setLoading(false);
          return;
        }
        console.log('[FB][PROJECT][ATHLETE]', getApp()?.options?.projectId);
        console.log('[READY]', { hasUser: !!currentUser, teamId });
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

        let eventsData = [];
        console.log(
          `[Schedule] Loading events for team=${teamId} tab=${activeTab} date=${safeSelectedDate.toString()} user=${currentUser.uid}`
        );
        if (activeTab === 'Day') {
          eventsData = await getEventsForDay(teamId, safeSelectedDate, currentUser.uid);

          // DEBUG: Log all events returned from Firestore for the selected day
          console.log('[DEBUG][DAY_VIEW] Raw events from Firestore:', {
            selectedDate: safeSelectedDate.toISOString(),
            count: eventsData.length,
            events: eventsData.map((e: any) => ({
              id: e.id,
              title: e.title,
              startUTC: e.startUTC ?? e.startUtc?.toMillis?.() ?? e.startUtc,
              endUTC: e.endUTC ?? e.endUtc?.toMillis?.() ?? e.endUtc,
              startDate: e.startDate?.toISOString?.() ?? e.startDate,
              endDate: e.endDate?.toISOString?.() ?? e.endDate,
              startMillis: e.startMillis,
              endMillis: e.endMillis,
            })),
          });
        } else if (activeTab === 'Week') {
          // Pour la vue Week, charger les événements de la semaine actuelle
          const weekStart = DateTime.fromJSDate(currentWeek).startOf('week').toJSDate();
          eventsData = await getEventsForWeek(teamId, weekStart, currentUser.uid);
        } else {
          const monthAnchor = new Date(safeSelectedDate.getFullYear(), safeSelectedDate.getMonth(), 1);
          eventsData = await getEventsForMonth(teamId, monthAnchor, currentUser.uid);
        }

        setEvents(eventsData);
        console.log('[ATHLETE] training snapshot size (client):', eventsData.length);
        console.log('[UI][MAPPED_FIRST]', eventsData.slice(0, 3));

      } catch (error) {
        console.error("Error loading events:", error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [activeTab, selectedDate, currentWeek]);
  
  // Synchroniser selectedDate avec selectedDayInWeek quand on change de jour dans la vue Week
  useEffect(() => {
    if (activeTab === 'Week') {
      setSelectedDate(selectedDayInWeek);
    }
  }, [selectedDayInWeek, activeTab]);
  
  // Initialiser currentWeek et selectedDayInWeek quand on passe à l'onglet Week
  useEffect(() => {
    if (activeTab === 'Week') {
      const today = new Date();
      // Luxon startOf('week') commence par lundi par défaut
      const weekStart = DateTime.fromJSDate(today).startOf('week').toJSDate();
      setCurrentWeek(weekStart);
      setSelectedDayInWeek(today);
    }
  }, [activeTab]);

  const normalizeEvent = (event: any) => {
    const displayTz =
      event?.displayTz ||
      event?.timeZone ||
      event?.tzid ||
      'Europe/Paris';
    const startDateValue = event?.startDate instanceof Date ? event.startDate : null;
    const endDateValue = event?.endDate instanceof Date ? event.endDate : null;

    if (!startDateValue) {
      console.log('[UI][WARN] normalizeEvent startDate malformed', {
        id: event?.id,
        title: event?.title,
        displayTz,
      });
      return null;
    }

    const startDateTime = DateTime.fromJSDate(startDateValue, {
      zone: 'utc',
    }).setZone(displayTz);
    const endDateTime = endDateValue
      ? DateTime.fromJSDate(endDateValue, {
      zone: 'utc',
        }).setZone(displayTz)
      : startDateTime;
    const startMillis =
      toMillis(event?.startMillis) ??
      startDateValue?.getTime() ??
      toMillis(event?.startUTC) ??
      toMillis(event?.startUtc);
    const endMillis =
      toMillis(event?.endMillis) ??
      endDateValue?.getTime() ??
      toMillis(event?.endUTC) ??
      toMillis(event?.endUtc) ??
      startMillis;
    const trainingStatus = getTrainingStatus(
      {
        ...event,
        startMillis,
        endMillis,
      },
      new Date()
    );

    return {
      ...event,
      title: event?.title || event?.summary || 'Training',
      startDateTime,
      endDateTime,
      displayTz,
      hasTime: Boolean(startDateTime && endDateTime),
      questionnaireState: event?.questionnaireState,
      startMillis,
      endMillis,
      trainingStatus,
    };
  };

  // Render questionnaire action based on state
  const renderQuestionnaireAction = (event: any) => {
    const status = getUiTrainingStatus(event);

    switch (status) {
      case 'completed':
        return (
          <StatusPill variant="completed" testID={`status-pill-completed-${event.id}`} />
        );

      case 'upcoming':
        return (
          <StatusPill variant="comingSoon" testID={`status-pill-upcoming-${event.id}`} />
        );

      case 'cooldown':
        return (
          <StatusPill variant="cooldown" testID={`status-pill-cooldown-${event.id}`} />
        );

      case 'ongoing':
        return (
          <StatusPill variant="inProgress" testID={`status-pill-in-progress-${event.id}`} />
        );

      case 'expired':
        return (
          <StatusPill variant="expired" testID={`status-pill-expired-${event.id}`} />
        );

      case 'questionnaire-open':
        return (
          <StatusPill
            variant="respond"
            onPress={() => {
              console.log("[SCHEDULE][RESPOND][CLICK] Respond clicked for event:", event.id, event.title);
              if (onRespond) {
                onRespond(event.id, event);
              }
            }}
            showNotificationDot
            testID={`respond-button-${event.id}`}
          />
        );

      default:
        return null;
    }
  };

  // Render questionnaire action for web
  const renderQuestionnaireActionWeb = (event: any) => {
    const status = getUiTrainingStatus(event);

    switch (status) {
      case 'completed':
        return (
          <StatusPill variant="completed" testID={`status-pill-completed-web-${event.id}`} />
        );

      case 'upcoming':
        return (
          <StatusPill variant="comingSoon" testID={`status-pill-upcoming-web-${event.id}`} />
        );

      case 'cooldown':
        return (
          <StatusPill variant="cooldown" testID={`status-pill-cooldown-web-${event.id}`} />
        );

      case 'ongoing':
        return (
          <StatusPill variant="inProgress" testID={`status-pill-in-progress-web-${event.id}`} />
        );

      case 'expired':
        return (
          <StatusPill variant="expired" testID={`status-pill-expired-web-${event.id}`} />
        );

      case 'questionnaire-open':
        return (
          <StatusPill
            variant="respond"
            onPress={() => {
              if (onRespond) {
                onRespond(event.id, event);
              }
            }}
            showNotificationDot
            testID={`respond-button-web-${event.id}`}
          />
        );

      default:
        return null;
    }
  };

  const handleTabNavigation = (tab: 'Home' | 'Schedule' | 'Profile') => {
    if (tab === 'Home') {
      navigation.navigate('Home');
    } else if (tab === 'Schedule') {
      navigation.navigate('Schedule');
    } else if (tab === 'Profile') {
      navigation.navigate('Profile');
    }
  };

  const renderDayView = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      );
    }

    const normalizedEvents = events
      .map(normalizeEvent)
      .filter(Boolean) as Array<any>;

    // DEBUG: Log all normalized events before filtering
    console.log('[DEBUG][DAY_VIEW] Normalized events before filtering:', {
      count: normalizedEvents.length,
      events: normalizedEvents.map((e: any) => ({
        id: e.id,
        title: e.title,
        startMillis: e.startMillis,
        endMillis: e.endMillis,
        startDateTime: e.startDateTime?.toISO?.() ?? e.startDateTime?.toString(),
        endDateTime: e.endDateTime?.toISO?.() ?? e.endDateTime?.toString(),
        localTime: e.startDateTime?.toFormat('HH:mm') ?? 'N/A',
      })),
    });
    
    const selectedDayDt = DateTime.fromJSDate(toJSDate(selectedDate));
    const dayStart = selectedDayDt.startOf('day').toMillis();
    const dayEnd = selectedDayDt.endOf('day').toMillis();
    
    // DEBUG: Log day boundaries
    console.log('[DEBUG][DAY_VIEW] Day boundaries:', {
      selectedDate: selectedDate.toISOString(),
      dayStart: new Date(dayStart).toISOString(),
      dayEnd: new Date(dayEnd).toISOString(),
      dayStartMillis: dayStart,
      dayEndMillis: dayEnd,
    });
    
    // Filter events that overlap with the selected day
    // Include events that:
    // 1. Start during the day (startMillis >= dayStart && startMillis <= dayEnd)
    // 2. End during the day (endMillis >= dayStart && endMillis <= dayEnd)
    // 3. Span the entire day (startMillis < dayStart && endMillis > dayEnd)
    const dayEvents = normalizedEvents
      .filter((event) => {
        const startMillis = event.startMillis ?? event.startDateTime?.toMillis?.();
        const endMillis = event.endMillis ?? event.endDateTime?.toMillis?.();
        
        if (!startMillis) {
          console.warn('[DEBUG][DAY_VIEW] Event without startMillis:', event.id, event.title);
          return false;
        }
        
        // Event overlaps the day if:
        // - It starts during the day, OR
        // - It ends during the day, OR
        // - It spans the entire day
        const startsInRange = startMillis >= dayStart && startMillis <= dayEnd;
        const endsInRange = endMillis !== null && endMillis !== undefined && endMillis >= dayStart && endMillis <= dayEnd;
        const spansRange = endMillis !== null && endMillis !== undefined && startMillis < dayStart && endMillis > dayEnd;
        
        const included = startsInRange || endsInRange || spansRange;
        
        // DEBUG: Log filtering decision for each event
        if (!included) {
          console.log('[DEBUG][DAY_VIEW] Event excluded:', {
            id: event.id,
            title: event.title,
            startMillis,
            endMillis,
            startDate: new Date(startMillis).toISOString(),
            endDate: endMillis ? new Date(endMillis).toISOString() : 'N/A',
            startsInRange,
            endsInRange,
            spansRange,
          });
        }
        
        return included;
      })
      .sort((a, b) => (a.startMillis ?? a.startDateTime?.toMillis?.() ?? 0) - (b.startMillis ?? b.startDateTime?.toMillis?.() ?? 0));

    // DEBUG: Log filtered events
    console.log('[DEBUG][DAY_VIEW] Events after filtering:', {
      count: dayEvents.length,
      selectedDate: selectedDate.toISOString(),
      dayStart: new Date(dayStart).toISOString(),
      dayEnd: new Date(dayEnd).toISOString(),
      now: new Date().toISOString(),
      events: dayEvents.map((e: any) => ({
        id: e.id,
        title: e.title,
        startMillis: e.startMillis,
        endMillis: e.endMillis,
        startDate: new Date(e.startMillis).toISOString(),
        endDate: e.endMillis ? new Date(e.endMillis).toISOString() : 'N/A',
        localTime: e.startDateTime?.toFormat('HH:mm') ?? 'N/A',
        status: e.trainingStatus ?? e.questionnaireState,
        isPast: e.endMillis ? e.endMillis < Date.now() : false,
      })),
    });

    const isTodaySelected = DateTime.fromJSDate(selectedDate).hasSame(DateTime.now(), 'day');

    return (
      <View style={styles.dayContent}>
        {!isTodaySelected && (
          <Pressable onPress={goToToday} style={styles.todayButton}>
            <Text style={styles.todayButtonText}>Today</Text>
          </Pressable>
        )}
        {dayEvents.length === 0 ? (
          <View style={styles.emptyContainerDay}>
            <View style={styles.sleepIconRow}>
              <Text style={[styles.sleepIconZ, styles.sleepIconZSmall]}>z</Text>
              <Text style={[styles.sleepIconZ, styles.sleepIconZMedium]}>z</Text>
              <Text style={[styles.sleepIconZ, styles.sleepIconZLarge]}>z</Text>
            </View>
          <Text style={styles.emptyTitleDay}>No training planned</Text>
            <Text style={styles.emptySubtextDay}>Time to rest and recover</Text>
          </View>
        ) : (
      <View style={styles.eventsList}>
        {dayEvents.map((event, index) => (
          <View key={event.id || index} style={styles.eventCard}>
            <View style={styles.eventInfo}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventTime}>
                {event.startDateTime.toFormat('HH:mm')} - {event.endDateTime.toFormat('HH:mm')}
              </Text>
            </View>
            <View style={styles.eventAction}>
                  {renderQuestionnaireAction(event)}
            </View>
          </View>
        ))}
          </View>
        )}
      </View>
    );
  };

  const renderWeekView = () => {
    const normalizedEvents = events
      .map(normalizeEvent)
      .filter(Boolean) as Array<any>;

    const { weekNumber } = getWeekInfo();
    const selectedDayKey = DateTime.fromJSDate(selectedDayInWeek).toISODate();
    const dayEvents = normalizedEvents
      .filter((event) => {
        return event.startDateTime.toISODate() === selectedDayKey;
      })
      .sort((a, b) => (a.startMillis ?? a.startDateTime?.toMillis?.() ?? 0) - (b.startMillis ?? b.startDateTime?.toMillis?.() ?? 0));
    
    return (
      <View style={styles.weekContainer}>
        {/* Week Navigation */}
        <View style={styles.weekNavigation}>
          <Pressable onPress={goToPreviousWeek} style={styles.weekNavButton}>
            <Text style={styles.weekNavButtonText}>← Previous</Text>
          </Pressable>
          
          <View style={styles.weekInfo}>
            <Text style={styles.weekNumberText}>Week {weekNumber}</Text>
          </View>
          
          <Pressable onPress={goToNextWeek} style={styles.weekNavButton}>
            <Text style={styles.weekNavButtonText}>Next →</Text>
          </Pressable>
        </View>
        
        {/* Day Selector */}
        <View style={styles.daySelector}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLetter, index) => {
            // Commencer la semaine par lundi (startOf('week') commence par lundi par défaut)
            const weekStart = DateTime.fromJSDate(currentWeek).startOf('week');
            const dayDate = weekStart.plus({ days: index });
            const isSelected = DateTime.fromJSDate(selectedDayInWeek).hasSame(dayDate, 'day');
          
          return (
              <Pressable
                key={index}
                onPress={() => setSelectedDayInWeek(dayDate.toJSDate())}
                style={[
                  styles.daySelectorButton,
                  isSelected && styles.daySelectorButtonActive
                ]}
              >
                <Text style={[
                  styles.daySelectorText,
                  isSelected && styles.daySelectorTextActive
                ]}>
                  {dayLetter}
                </Text>
              </Pressable>
            );
          })}
              </View>
        
        {/* Content for selected day */}
                {dayEvents.length === 0 ? (
          <View style={[styles.emptyContainerDay, styles.weekEmptyContainer]}>
            <View style={styles.sleepIconRow}>
              <Text style={[styles.sleepIconZ, styles.sleepIconZSmall]}>z</Text>
              <Text style={[styles.sleepIconZ, styles.sleepIconZMedium]}>z</Text>
              <Text style={[styles.sleepIconZ, styles.sleepIconZLarge]}>z</Text>
            </View>
            <Text style={styles.emptyTitleDay}>No training planned</Text>
            <Text style={styles.emptySubtextDay}>Time to rest and recover</Text>
          </View>
                ) : (
          <View style={[styles.eventsList, styles.weekEventsList]}>
            {dayEvents.map((event, index) => (
              <View key={event.id || index} style={styles.eventCard}>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventTime}>
                        {event.startDateTime.toFormat('HH:mm')} - {event.endDateTime.toFormat('HH:mm')}
                      </Text>
                        </View>
                <View style={styles.eventAction}>
                  {renderQuestionnaireAction(event)}
                    </View>
              </View>
            ))}
          </View>
        )}
            </View>
    );
  };

  const renderMonthView = () => {
    // Simple month view with dots for days with events
    const normalizedEvents = events
      .map(normalizeEvent)
      .filter(Boolean) as Array<any>;

    const monthDate = DateTime.fromJSDate(toJSDate(selectedDate));
    const daysInMonth = monthDate.daysInMonth;
    const selectedDay = DateTime.fromJSDate(toJSDate(selectedDate));
    const todayDt = DateTime.now();
    const isMonthOnToday = selectedDay.hasSame(todayDt, 'day');
    const selectedDayEvents = normalizedEvents
      .filter((event) => event.startDateTime.hasSame(selectedDay, 'day'))
      .sort((a, b) => (a.startDateTime?.toMillis?.() ?? 0) - (b.startDateTime?.toMillis?.() ?? 0));

    const daysWithEvents = new Set<number>();
    normalizedEvents.forEach((event) => {
      if (event.startDateTime.hasSame(monthDate, 'month')) {
        daysWithEvents.add(event.startDateTime.day);
      }
    });

    return (
      <View style={styles.monthContainer}>
        <Text style={styles.monthTitle}>
          {monthDate.setLocale('en').toFormat('LLLL yyyy')}
        </Text>
        <View style={styles.monthGrid}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dayDateTime = monthDate.set({ day });
            const isToday =
              dayDateTime.day === todayDt.day &&
              dayDateTime.month === todayDt.month &&
              dayDateTime.year === todayDt.year;
            const isSelected = dayDateTime.hasSame(selectedDay, 'day');
            return (
              <Pressable
                key={day}
                style={[
                  styles.monthDay,
                  isSelected && styles.monthDaySelected
                ]}
                onPress={() => handleSelectDate(dayDateTime.toJSDate())}
              >
                <Text
                  style={[
                styles.monthDayText,
                    isToday && styles.monthDayTextToday,
                    isSelected && styles.monthDayTextSelected
                  ]}
                >
                {day}
              </Text>
              {daysWithEvents.has(day) && <View style={styles.monthEventDot} />}
              </Pressable>
            );
          })}
        </View>
        {!isMonthOnToday && (
          <Pressable style={styles.monthTodayButton} onPress={goToToday}>
            <Text style={styles.monthTodayButtonText}>Today</Text>
          </Pressable>
        )}
        {selectedDayEvents.length === 0 ? (
          <View style={[styles.emptyContainerDay, styles.monthEmptyContainer]}>
            <View style={styles.sleepIconRow}>
              <Text style={[styles.sleepIconZ, styles.sleepIconZSmall]}>z</Text>
              <Text style={[styles.sleepIconZ, styles.sleepIconZMedium]}>z</Text>
              <Text style={[styles.sleepIconZ, styles.sleepIconZLarge]}>z</Text>
            </View>
            <Text style={styles.emptyTitleDay}>No training planned</Text>
            <Text style={styles.emptySubtextDay}>Time to rest and recover</Text>
          </View>
        ) : (
          <View style={[styles.eventsList, styles.monthEventsList]}>
            {selectedDayEvents.map((event, index) => (
              <View key={event.id || index} style={styles.eventCard}>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventTime}>
                    {event.startDateTime.toFormat('HH:mm')} - {event.endDateTime.toFormat('HH:mm')}
                  </Text>
                </View>
                <View style={styles.eventAction}>
                  {renderQuestionnaireAction(event)}
                </View>
            </View>
          ))}
        </View>
        )}
      </View>
    );
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
          fontFamily: Platform.select({ web: "'Inter', sans-serif", default: "System" }),
          color: "white",
          pointerEvents: "auto",
          margin: "0 auto"
        }}>
          {/* Background Gradient - Futuristic Dark → Deep Navy → Black */}
          <div style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            background: "linear-gradient(180deg, #0A0F1A 0%, #0F1623 25%, #1A1F2E 50%, #0D1117 75%, #000000 100%), radial-gradient(circle at 50% 0%, rgba(0, 234, 255, 0.08) 0%, rgba(0, 0, 0, 0) 60%), radial-gradient(circle at 0% 100%, rgba(0, 188, 212, 0.06) 0%, rgba(0, 0, 0, 0) 60%)",
            zIndex: 0,
            pointerEvents: "none"
          }} />

          {/* Title */}
          <div style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            paddingTop: "32px",
            paddingBottom: "16px"
          }}>
            <h1 style={{
              fontSize: "22px",
              fontWeight: "600",
              color: "#FFFFFF",
              fontFamily: "'Inter', sans-serif",
              margin: "0",
              padding: "0",
              marginBottom: "8px"
            }}>
              Schedule
            </h1>
            {/* Date */}
            <div style={{
              fontSize: "15px",
              fontWeight: "500",
              color: "#FFFFFF",
              fontFamily: "'Inter', sans-serif"
            }}>
              {headerDisplayDate}
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            padding: "0 20px 12px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            marginBottom: "8px"
          }}>
            {['Day', 'Week', 'Month'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  background: activeTab === tab ? "rgba(0, 234, 255, 0.15)" : "transparent",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid #00EAFF" : "2px solid transparent",
                  borderRadius: activeTab === tab ? "8px 8px 0 0" : "0",
                  color: activeTab === tab ? "#00EAFF" : "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: activeTab === tab ? "600" : "500",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: activeTab === tab ? "inset 0 0 15px rgba(0, 234, 255, 0.1)" : "none",
                  textShadow: activeTab === tab ? "0 0 10px rgba(0, 234, 255, 0.3)" : "none",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div style={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            padding: "0 20px",
            paddingTop: "0",
            paddingBottom: "80px",
            overflowY: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start"
          }}>
            <div style={{ 
              paddingBottom: "20px",
              paddingTop: "0",
              width: "100%",
              maxWidth: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start"
            }}>
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
                    Loading events...
                  </div>
                </div>
              ) : (
                <div style={{
                  width: "100%",
                  maxWidth: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {activeTab === 'Day' && !isDayTabOnToday && (
                    <div style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "center",
                      marginBottom: "12px"
                    }}>
                      <button
                        onClick={goToToday}
                        style={{
                          padding: "8px 18px",
                          borderRadius: "999px",
                          border: "none",
                          background: "linear-gradient(135deg, rgba(0, 224, 255, 0.4) 0%, rgba(0, 141, 255, 0.6) 100%)",
                          color: "#0A0F1A",
                          fontSize: "13px",
                          fontWeight: 600,
                          letterSpacing: "0.05em",
                          cursor: "pointer",
                          boxShadow: "0 8px 20px rgba(0, 224, 255, 0.25)"
                        }}
                      >
                        Today
                      </button>
                    </div>
                  )}
                  {activeTab === 'Day' && (() => {
                    // Filter events for the selected day
                    const normalizedEvents = events
                      .map(normalizeEvent)
                      .filter(Boolean) as Array<any>;
                    const selectedDayDt = DateTime.fromJSDate(toJSDate(selectedDate));
                    const dayStart = selectedDayDt.startOf('day').toMillis();
                    const dayEnd = selectedDayDt.endOf('day').toMillis();
                    
                    // Filter events that overlap with the selected day
                    // Include events that:
                    // 1. Start during the day (startMillis >= dayStart && startMillis <= dayEnd)
                    // 2. End during the day (endMillis >= dayStart && endMillis <= dayEnd)
                    // 3. Span the entire day (startMillis < dayStart && endMillis > dayEnd)
                    const dayEvents = normalizedEvents
                      .filter((event) => {
                        const startMillis = event.startMillis ?? event.startDateTime?.toMillis?.();
                        const endMillis = event.endMillis ?? event.endDateTime?.toMillis?.();
                        
                        if (!startMillis) return false;
                        
                        // Event overlaps the day if:
                        // - It starts during the day, OR
                        // - It ends during the day, OR
                        // - It spans the entire day
                        const startsInRange = startMillis >= dayStart && startMillis <= dayEnd;
                        const endsInRange = endMillis !== null && endMillis !== undefined && endMillis >= dayStart && endMillis <= dayEnd;
                        const spansRange = endMillis !== null && endMillis !== undefined && startMillis < dayStart && endMillis > dayEnd;
                        
                        return startsInRange || endsInRange || spansRange;
                      })
                      .sort((a, b) => (a.startMillis ?? a.startDateTime?.toMillis?.() ?? 0) - (b.startMillis ?? b.startDateTime?.toMillis?.() ?? 0));

                    return (
                      <div>
                        {dayEvents.length === 0 ? (
                          <div style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "60px 20px",
                            textAlign: "center",
                            width: "100%",
                            flex: 1,
                            minHeight: "50vh"
                          }}>
                            {/* Sleep Icon (small zzz) */}
                            <div style={{
                              display: "flex",
                              alignItems: "flex-end",
                              gap: "2px",
                              marginBottom: "24px",
                              textTransform: "lowercase",
                              color: "#8DEBFF",
                              textShadow: "0 0 6px rgba(0, 224, 255, 0.7), 0 0 16px rgba(0, 224, 255, 0.5)",
                              filter: "drop-shadow(0 0 6px rgba(0, 224, 255, 0.4))"
                            }}>
                              <span style={{ fontSize: "18px", opacity: 0.6, transform: "translateY(3px)" }}>z</span>
                              <span style={{ fontSize: "22px", opacity: 0.8, transform: "translateY(1px)" }}>z</span>
                              <span style={{ fontSize: "26px", opacity: 0.95 }}>z</span>
                            </div>
                            
                            {/* Main Message */}
                            <div style={{
                              fontSize: "18px",
                              fontWeight: "700",
                              color: "#FFFFFF",
                              fontFamily: "'Inter', sans-serif",
                              marginBottom: "8px"
                            }}>
                              No training planned
                            </div>
                            
                            {/* Sub Message */}
                            <div style={{
                              fontSize: "14px",
                              fontWeight: "400",
                              color: "#9AA3B2",
                              fontFamily: "'Inter', sans-serif",
                              opacity: 0.8
                            }}>
                              Time to rest and recover
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            width: "100%",
                            maxWidth: "100%",
                            alignItems: "center"
                          }}>
                            {dayEvents.map((event: any, index: number) => {
                              return (
                              <div
                                key={event.id || index}
                                style={{
                                  background: "rgba(255, 255, 255, 0.1)",
                                  backdropFilter: "blur(20px)",
                                  WebkitBackdropFilter: "blur(20px)",
                                  border: "0.5px solid rgba(0, 234, 255, 0.3)",
                                  borderRadius: "18px",
                                  padding: "16px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(0, 234, 255, 0.05)",
                                  transition: "all 0.3s ease",
                                  width: "100%",
                                  maxWidth: "100%"
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
                                    fontWeight: "600",
                                    color: "#FFFFFF",
                                    marginBottom: "4px"
                                  }}>
                                    {event.title}
                                  </div>
                                  <div style={{
                                    fontSize: "12px",
                                    color: "#9AA3B2"
                                  }}>
                                    {event.startDateTime.toFormat('HH:mm')} - {event.endDateTime.toFormat('HH:mm')}
                                  </div>
                                </div>
                                {renderQuestionnaireActionWeb(event)}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    );
                  })()}
                  {activeTab === 'Week' && (
                    <div style={{
                      width: "100%",
                      maxWidth: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "12px"
                    }}>
                      {/* Week Navigation */}
                      {(() => {
                        const { weekNumber } = getWeekInfo();
                        return (
                          <div style={{
                            display: "flex",
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            width: "100%",
                            padding: "0 20px",
                            marginTop: "0",
                            marginBottom: "4px"
                          }}>
                            <button
                              onClick={goToPreviousWeek}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#9CA3AF",
                                fontSize: "14px",
                                fontWeight: "500",
                                cursor: "pointer",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                transition: "all 0.3s ease"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = "#00EAFF";
                                e.currentTarget.style.background = "rgba(0, 234, 255, 0.1)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = "#9CA3AF";
                                e.currentTarget.style.background = "transparent";
                              }}
                            >
                              ← Previous
                            </button>
                            
                            <div style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center"
                            }}>
                              <div style={{
                                fontSize: "16px",
                                fontWeight: "600",
                                color: "#00EAFF"
                              }}>
                                Week {weekNumber}
                              </div>
                            </div>
                            
                            <button
                              onClick={goToNextWeek}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#9CA3AF",
                                fontSize: "14px",
                                fontWeight: "500",
                                cursor: "pointer",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                transition: "all 0.3s ease"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = "#00EAFF";
                                e.currentTarget.style.background = "rgba(0, 234, 255, 0.1)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = "#9CA3AF";
                                e.currentTarget.style.background = "transparent";
                              }}
                            >
                              Next →
                            </button>
                          </div>
                        );
                      })()}
                      
                      {/* Day Selector */}
                      <div style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        padding: "0 20px",
                        marginBottom: "8px"
                      }}>
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLetter, index) => {
                          // Commencer la semaine par lundi (startOf('week') commence par lundi par défaut)
                          const weekStart = DateTime.fromJSDate(currentWeek).startOf('week');
                          const dayDate = weekStart.plus({ days: index });
                          const isSelected = DateTime.fromJSDate(selectedDayInWeek).hasSame(dayDate, 'day');
                          
                          return (
                            <button
                              key={index}
                              onClick={() => setSelectedDayInWeek(dayDate.toJSDate())}
                              style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "50%",
                                border: isSelected ? "2px solid #00EAFF" : "1px solid rgba(255, 255, 255, 0.2)",
                                background: isSelected ? "rgba(0, 234, 255, 0.15)" : "transparent",
                                color: isSelected ? "#00EAFF" : "#9CA3AF",
                                fontSize: "14px",
                                fontWeight: isSelected ? "600" : "500",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.3s ease",
                                boxShadow: isSelected ? "0 0 12px rgba(0, 234, 255, 0.3)" : "none"
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.borderColor = "#00EAFF";
                                  e.currentTarget.style.color = "#00EAFF";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                                  e.currentTarget.style.color = "#9CA3AF";
                                }
                              }}
                            >
                              {dayLetter}
                            </button>
                          );
                        })}
                      </div>
                      {!isWeekTabOnToday && (
                        <div style={{
                          display: "flex",
                          justifyContent: "center",
                          width: "100%",
                          marginTop: "6px"
                        }}>
                          <button
                            onClick={goToToday}
                            style={{
                              padding: "8px 18px",
                              borderRadius: "999px",
                              border: "none",
                              background: "linear-gradient(135deg, rgba(0, 224, 255, 0.4) 0%, rgba(0, 141, 255, 0.6) 100%)",
                              color: "#0A0F1A",
                              fontSize: "13px",
                              fontWeight: 600,
                              letterSpacing: "0.05em",
                              cursor: "pointer",
                              boxShadow: "0 8px 20px rgba(0, 224, 255, 0.25)"
                            }}
                          >
                            Today
                          </button>
                        </div>
                      )}
                      
                      {/* Content for selected day */}
                      {(() => {
                        const normalizedEvents = events.map(normalizeEvent).filter(Boolean) as Array<any>;
                        const selectedDayKey = DateTime.fromJSDate(selectedDayInWeek).toISODate();
                        const dayEvents = normalizedEvents
                          .filter((event) => {
                            return event.startDateTime.toISODate() === selectedDayKey;
                          })
                          .sort((a, b) => (a.startMillis ?? a.startDateTime?.toMillis?.() ?? 0) - (b.startMillis ?? b.startDateTime?.toMillis?.() ?? 0));
                        
                        if (dayEvents.length === 0) {
                          return (
                            <div style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              padding: "20px 20px 40px 20px",
                              textAlign: "center",
                              width: "100%",
                              flex: 1,
                              minHeight: "20vh"
                            }}>
                              {/* Sleep Icon (small zzz) */}
                              <div style={{
                                display: "flex",
                                alignItems: "flex-end",
                                gap: "2px",
                                marginBottom: "24px",
                                textTransform: "lowercase",
                                color: "#8DEBFF",
                                textShadow: "0 0 6px rgba(0, 224, 255, 0.7), 0 0 16px rgba(0, 224, 255, 0.5)",
                                filter: "drop-shadow(0 0 6px rgba(0, 224, 255, 0.4))"
                              }}>
                                <span style={{ fontSize: "18px", opacity: 0.6, transform: "translateY(3px)" }}>z</span>
                                <span style={{ fontSize: "22px", opacity: 0.8, transform: "translateY(1px)" }}>z</span>
                                <span style={{ fontSize: "26px", opacity: 0.95 }}>z</span>
                              </div>
                              
                              {/* Main Message */}
                              <div style={{
                                fontSize: "18px",
                                fontWeight: "700",
                                color: "#FFFFFF",
                                fontFamily: "'Inter', sans-serif",
                                marginBottom: "8px"
                              }}>
                                No training planned
                              </div>
                              
                              {/* Sub Message */}
                              <div style={{
                                fontSize: "14px",
                                fontWeight: "400",
                                color: "#9AA3B2",
                                fontFamily: "'Inter', sans-serif",
                                opacity: 0.8
                              }}>
                                Time to rest and recover
                              </div>
                            </div>
                          );
                        }
                        
                        return (
                          <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            width: "100%",
                            maxWidth: "100%",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            padding: "10px 0 20px 0",
                            flex: 1,
                            minHeight: 0
                          }}>
                            {dayEvents.map((event: any, eventIndex: number) => (
                              <div
                                key={event.id || eventIndex}
                                style={{
                                  background: "rgba(255, 255, 255, 0.1)",
                                  backdropFilter: "blur(20px)",
                                  WebkitBackdropFilter: "blur(20px)",
                                  border: "0.5px solid rgba(0, 234, 255, 0.3)",
                                  borderRadius: "18px",
                                  padding: "16px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(0, 234, 255, 0.05)",
                                  transition: "all 0.3s ease",
                                  width: "100%",
                                  maxWidth: "100%"
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
                                    fontWeight: "600",
                                    color: "#FFFFFF",
                                    marginBottom: "4px"
                                  }}>
                                    {event.title}
                                  </div>
                                  <div style={{
                                    fontSize: "12px",
                                    color: "#9AA3B2"
                                  }}>
                                    {event.startDateTime.toFormat('HH:mm')} - {event.endDateTime.toFormat('HH:mm')}
                                  </div>
                                </div>
                                {renderQuestionnaireActionWeb(event)}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {activeTab === 'Month' && (
                    <div style={{
                      width: "100%",
                      maxWidth: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center"
                    }}>
                      {(() => {
                        const normalizedEvents = events.map(normalizeEvent).filter(Boolean) as Array<any>;
                        const monthDate = DateTime.fromJSDate(toJSDate(selectedDate));
                        const daysInMonth = monthDate.daysInMonth;
                        const selectedDay = DateTime.fromJSDate(toJSDate(selectedDate));
                        const todayDt = DateTime.now();
                        const isMonthOnToday = selectedDay.hasSame(todayDt, 'day');
                        const selectedDayEvents = normalizedEvents.filter((event) =>
                          event.startDateTime.hasSame(selectedDay, 'day')
                        );

                        const daysWithEvents = new Set<number>();
                        normalizedEvents.forEach((event) => {
                          if (event.startDateTime.hasSame(monthDate, 'month')) {
                            daysWithEvents.add(event.startDateTime.day);
                          }
                        });

                        return (
                          <div style={{
                            width: "100%",
                            maxWidth: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center"
                          }}>
                            <div style={{
                              fontSize: "18px",
                              fontWeight: "700",
                              color: "#FFFFFF",
                              textAlign: "center",
                              marginBottom: "20px"
                            }}>
                              {monthDate.setLocale('en').toFormat('LLLL yyyy')}
                            </div>
                            <div style={{
                              display: "flex",
                              flexDirection: "row",
                              flexWrap: "wrap",
                              justifyContent: "center",
                              gap: "8px",
                              width: "100%",
                              maxWidth: "100%"
                            }}>
                              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                                const dayDateTime = monthDate.set({ day });
                                const isToday =
                                  dayDateTime.day === todayDt.day &&
                                  dayDateTime.month === todayDt.month &&
                                  dayDateTime.year === todayDt.year;
                                const isSelected = dayDateTime.hasSame(selectedDay, 'day');
                                return (
                                  <div
                                    key={day}
                                    onClick={() => handleSelectDate(dayDateTime.toJSDate())}
                                    style={{
                                      width: "calc((100% - 48px) / 7)",
                                      aspectRatio: 1,
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      position: "relative",
                                      background: isSelected
                                        ? "rgba(0, 224, 255, 0.2)"
                                        : isToday
                                          ? "rgba(0, 234, 255, 0.15)"
                                          : "rgba(255, 255, 255, 0.05)",
                                      backdropFilter: "blur(10px)",
                                      WebkitBackdropFilter: "blur(10px)",
                                      borderRadius: "12px",
                                      border: isSelected
                                        ? "0.5px solid rgba(0, 224, 255, 0.8)"
                                        : isToday
                                          ? "0.5px solid rgba(0, 234, 255, 0.5)"
                                          : "0.5px solid rgba(0, 234, 255, 0.1)",
                                      boxShadow: isSelected
                                        ? "0 0 18px rgba(0, 224, 255, 0.4), inset 0 0 12px rgba(0, 224, 255, 0.2)"
                                        : isToday
                                          ? "0 0 15px rgba(0, 234, 255, 0.3), inset 0 0 10px rgba(0, 234, 255, 0.1)"
                                          : "0 0 8px rgba(0, 0, 0, 0.2)",
                                      cursor: "pointer",
                                      transition: "all 0.2s ease"
                                    }}
                                  >
                                    <div style={{
                                      fontSize: "14px",
                                      color: isSelected ? "#0A0F1A" : isToday ? "#00EAFF" : "#FFFFFF",
                                      fontWeight: isSelected ? "700" : isToday ? "600" : "400",
                                      textShadow: isToday ? "0 0 10px rgba(0, 234, 255, 0.5)" : "none"
                                    }}>
                                      {day}
                                    </div>
                                    {daysWithEvents.has(day) && (
                                      <div style={{
                                        position: "absolute",
                                        bottom: "4px",
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        backgroundColor: "#00EAFF",
                                        boxShadow: "0 0 12px rgba(0, 234, 255, 1), 0 0 20px rgba(0, 234, 255, 0.6)"
                                      }} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {!isMonthOnToday && (
                              <div style={{ marginTop: "16px" }}>
                                <button
                                  onClick={goToToday}
                                  style={{
                                    padding: "8px 18px",
                                    borderRadius: "999px",
                                    border: "none",
                                    background: "linear-gradient(135deg, rgba(0, 224, 255, 0.4) 0%, rgba(0, 141, 255, 0.6) 100%)",
                                    color: "#0A0F1A",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    letterSpacing: "0.05em",
                                    cursor: "pointer",
                                    boxShadow: "0 8px 20px rgba(0, 224, 255, 0.25)"
                                  }}
                                >
                                  Today
                                </button>
                              </div>
                            )}
                            {selectedDayEvents.length === 0 ? (
                              <div style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "40px 20px",
                                textAlign: "center",
                                width: "100%"
                              }}>
                                <div style={{
                                  display: "flex",
                                  alignItems: "flex-end",
                                  gap: "2px",
                                  marginBottom: "20px",
                                  textTransform: "lowercase",
                                  color: "#8DEBFF",
                                  textShadow: "0 0 6px rgba(0, 224, 255, 0.7), 0 0 16px rgba(0, 224, 255, 0.5)"
                                }}>
                                  <span style={{ fontSize: "18px", opacity: 0.6, transform: "translateY(3px)" }}>z</span>
                                  <span style={{ fontSize: "22px", opacity: 0.8, transform: "translateY(1px)" }}>z</span>
                                  <span style={{ fontSize: "26px", opacity: 0.95 }}>z</span>
                                </div>
                                <div style={{
                                  fontSize: "18px",
                                  fontWeight: "700",
                                  color: "#FFFFFF",
                                  marginBottom: "8px"
                                }}>
                                  No training planned
                                </div>
                                <div style={{
                                  fontSize: "14px",
                                  fontWeight: "400",
                                  color: "#9AA3B2",
                                  opacity: 0.8
                                }}>
                                  Time to rest and recover
                                </div>
                              </div>
                            ) : (
                              <div style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                                width: "100%",
                                maxWidth: "100%",
                                marginTop: "16px"
                              }}>
                                {selectedDayEvents.map((event: any, eventIndex: number) => (
                                  <div
                                    key={event.id || eventIndex}
                                    style={{
                                      background: "rgba(255, 255, 255, 0.1)",
                                      backdropFilter: "blur(20px)",
                                      WebkitBackdropFilter: "blur(20px)",
                                      border: "0.5px solid rgba(0, 234, 255, 0.3)",
                                      borderRadius: "18px",
                                      padding: "16px",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 20px rgba(0, 234, 255, 0.05)"
                                    }}
                                  >
                                    <div>
                                      <div style={{
                                        fontSize: "16px",
                                        fontWeight: "600",
                                        color: "#FFFFFF",
                                        marginBottom: "4px"
                                      }}>
                                        {event.title}
                                      </div>
                                      <div style={{
                                        fontSize: "12px",
                                        color: "#9AA3B2"
                                      }}>
                                        {event.startDateTime.toFormat('HH:mm')} - {event.endDateTime.toFormat('HH:mm')}
                                      </div>
                                    </div>
                                    {renderQuestionnaireActionWeb(event)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Navigation unifiée pour les athlètes */}
          <UnifiedAthleteNavigation 
            activeTab="Schedule" 
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
      style={styles.container}
    >
      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>Schedule</Text>
        <Text style={styles.titleDate}>{headerDisplayDate}</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {['Day', 'Week', 'Month'].map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab && styles.activeTabText
            ]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'Day' && renderDayView()}
        {activeTab === 'Week' && renderWeekView()}
        {activeTab === 'Month' && renderMonthView()}
      </View>
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
  
  
  titleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 32,
    paddingBottom: 16,
  },
  
  titleText: {
    fontSize: 22,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    marginBottom: 8,
  },
  
  titleDate: {
    fontSize: 15,
    fontWeight: tokens.fontWeights.medium,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
  },
  
  headerTitle: {
    fontSize: tokens.fontSizes.xxxl,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.sm,
  },
  
  headerDate: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.xl,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 12,
  },
  
  tab: {
    flex: 1,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  
  activeTab: {
    borderBottomColor: tokens.colors.accentCyan,
  },
  
  tabText: {
    fontSize: tokens.fontSizes.md,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.medium,
  },
  
  activeTabText: {
    color: tokens.colors.accentCyan,
    fontWeight: tokens.fontWeights.semibold,
  },
  
  content: {
    flex: 1,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  
  // Day View Styles
  dayContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  eventsList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    gap: tokens.spacing.lg,
    width: '100%',
    paddingVertical: 60,
    minHeight: '50%',
  },
  
  eventCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 18,
    padding: tokens.spacing.lg,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 234, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 10,
    marginBottom: tokens.spacing.md,
    width: '100%',
  },
  
  eventInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: tokens.spacing.sm,
  },
  
  eventTitle: {
    fontSize: tokens.fontSizes.lg,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  
  eventTime: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    textAlign: 'center',
  },
  
  eventAction: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
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
  
  
  // Week View Styles
  weekContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: tokens.spacing.sm,
  },
  
  weekNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: tokens.spacing.xl,
    marginTop: 0,
    marginBottom: 4,
  },
  
  weekNavButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  
  weekNavButtonText: {
    fontSize: 14,
    fontWeight: tokens.fontWeights.medium,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  weekInfo: {
    alignItems: 'center',
  },
  
  weekNumberText: {
    fontSize: 16,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.accentCyan,
    fontFamily: tokens.typography.ui,
  },
  
  daySelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingHorizontal: tokens.spacing.xl,
    marginBottom: 8,
  },
  
  daySelectorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  daySelectorButtonActive: {
    borderWidth: 2,
    borderColor: tokens.colors.accentCyan,
    backgroundColor: 'rgba(0, 234, 255, 0.15)',
    shadowColor: tokens.colors.accentCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  
  daySelectorText: {
    fontSize: 14,
    fontWeight: tokens.fontWeights.medium,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  daySelectorTextActive: {
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.accentCyan,
  },

  weekEmptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
    minHeight: '28%',
    width: '100%',
  },
  
  weekEventsList: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.lg,
    minHeight: 0,
    width: '100%',
  },
  
  // Month View Styles
  monthContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  
  monthTitle: {
    fontSize: tokens.fontSizes.xl,
    fontWeight: tokens.fontWeights.semibold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    textAlign: 'center',
    marginBottom: tokens.spacing.xl,
  },
  
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  
  monthDay: {
    width: (width - tokens.spacing.xl * 2) / 7 - tokens.spacing.sm,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
    position: 'relative',
  },
  
  monthDayText: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
  },
  
  monthDayTextToday: {
    color: tokens.colors.accentCyan,
    fontWeight: tokens.fontWeights.semibold,
  },
  
  monthEventDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.accentCyan,
  },
  
  monthEmptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
    minHeight: '28%',
    width: '100%',
  },
  
  monthEventsList: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.lg,
    minHeight: 0,
    width: '100%',
  },
  
  // Common Styles
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
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    minHeight: '50%',
  },
  
  emptyContainerDay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    paddingVertical: 60,
    minHeight: '50%',
  },
  
  emptyDate: {
    fontSize: 15,
    fontWeight: tokens.fontWeights.medium,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    marginBottom: 32,
  },
  
  sleepIcon: {
    fontSize: 56,
    color: tokens.colors.accentCyan,
    fontFamily: tokens.typography.ui,
    fontWeight: tokens.fontWeights.light,
    letterSpacing: 6,
    marginBottom: 32,
    lineHeight: 1,
  },
  
  sleepIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 20,
    width: '100%',
  },

  sleepIconZ: {
    color: tokens.colors.accentCyan,
    fontFamily: tokens.typography.ui,
    textTransform: 'lowercase',
    textShadowColor: 'rgba(0, 224, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },

  sleepIconZSmall: {
    fontSize: 18,
    opacity: 0.65,
    transform: [{ translateY: 3 }],
  },

  sleepIconZMedium: {
    fontSize: 22,
    opacity: 0.8,
    transform: [{ translateY: 1 }],
  },

  sleepIconZLarge: {
    fontSize: 26,
    opacity: 0.95,
  },
  
  emptyTitle: {
    fontSize: 18,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    marginBottom: 10,
  },
  
  emptyTitleDay: {
    fontSize: 18,
    fontWeight: tokens.fontWeights.bold,
    color: tokens.colors.text,
    fontFamily: tokens.typography.ui,
    marginBottom: 8,
    textAlign: 'center',
  },
  
  emptySubtextDay: {
    fontSize: 14,
    fontWeight: tokens.fontWeights.normal,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    opacity: 0.8,
    textAlign: 'center',
  },
  
  emptySubtext: {
    fontSize: 13,
    fontWeight: tokens.fontWeights.normal,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.ui,
    opacity: 0.8,
  },
  
  noEventsText: {
    fontSize: tokens.fontSizes.sm,
    color: tokens.colors.textMuted,
    fontFamily: tokens.typography.ui,
    fontStyle: 'italic',
  },

  // Questionnaire Action Styles
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
