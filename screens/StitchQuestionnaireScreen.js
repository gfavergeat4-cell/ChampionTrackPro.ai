import React, { useState, useEffect, useLayoutEffect } from "react";
import { useNavigation, useRoute, CommonActions } from "@react-navigation/native";
import { View, Platform, Alert } from "react-native";
import MobileViewport from "../src/components/MobileViewport";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { db, auth } from "../src/lib/firebase";
import { DateTime } from "luxon";
import { computeQuestionnaireStatus, getQuestionnaireWindowFromEnd } from "../src/utils/questionnaire";
import { USE_SUPABASE, supabase } from "../src/lib/supabase";
import {
  getMyMembership as supaGetMyMembership,
  getTeamQuestionnaire as supaGetTeamQuestionnaire,
  getMyResponseForSession as supaGetMyResponseForSession,
  submitResponse as supaSubmitResponse,
} from "../src/lib/ctpApi";

const courtlightBg = "radial-gradient(1200px 800px at 50% -10%, #0D2545 0%, #070B14 60%)";

export default function StitchQuestionnaireScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { sessionId: sessionIdParam, trainingId, eventTitle, eventDate } = route.params || {};
  // eslint-disable-next-line no-use-before-define

  const sessionId = trainingId || sessionIdParam;

  const handleGoBack = () => {
    navigation.goBack();
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleReturnHome = React.useCallback(() => {
    if (navigation?.goBack) {
      navigation.goBack();
    } else if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }, [navigation]);

  // Auto-redirect after 2 seconds when confirmation is shown
  useEffect(() => {
    if (showConfirmation && Platform.OS === 'web') {
      const timer = setTimeout(() => {
        handleReturnHome();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showConfirmation, handleReturnHome]);

  // Access check state
  const [isAccessible, setIsAccessible] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isTestSession, setIsTestSession] = useState(false);
  const [accessDeniedReason, setAccessDeniedReason] = useState(null);
  const [trainingInfoForMessage, setTrainingInfoForMessage] = useState(null);
  const [displayTitle, setDisplayTitle] = useState(null);
  const [displayDate, setDisplayDate] = useState(null);

  useEffect(() => {
    const checkAccess = async () => {
      // ── Chemin Supabase (V2) ──────────────────────────────
      if (USE_SUPABASE) {
        try {
          if (!sessionId) { setAccessDeniedReason("Paramètres manquants"); return; }
          const m = await supaGetMyMembership();
          const teamId = m?.team_id;
          setTeamIdState(teamId);
          if (!teamId) { setAccessDeniedReason("Aucune équipe associée"); return; }

          const { data: sess } = await supabase.from("sessions")
            .select("*").eq("id", sessionId).maybeSingle();
          if (!sess) { setAccessDeniedReason("Entraînement non trouvé"); return; }

          const endMillis = sess.end_utc ? new Date(sess.end_utc).getTime() : null;
          const startMs = sess.start_utc ? new Date(sess.start_utc).getTime() : null;
          setDisplayTitle(sess.title || eventTitle || "Training");
          if (startMs && endMillis) {
            const fmt = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
            setDisplayDate(`${fmt(startMs)} – ${fmt(endMillis)}`);
            setTrainingDuration(Math.max(1, Math.round((endMillis - startMs) / 60000)));
          }
          setSessionType(sess.session_type || "conditioning");
          setTrainingInfoForMessage({ endMillis, displayTz: "America/New_York", title: sess.title || "Training" });
          if (!endMillis) { setAccessDeniedReason("L'entraînement n'a pas d'heure de fin définie"); return; }

          const mine = await supaGetMyResponseForSession(sessionId);
          const status = computeQuestionnaireStatus(endMillis, !!mine, DateTime.utc());
          console.log("[QUESTIONNAIRE][SUPA] Access check", { sessionId, endMillis, hasCompleted: !!mine, status });

          const tpl = await supaGetTeamQuestionnaire(teamId);
          if (tpl?.questions?.length) {
            setActiveQuestions(tpl.questions);
            setUsedQuestionnaireId(tpl.id);
          }

          if (status === "completed") { setAccessDeniedReason("already_completed"); setIsAccessible(false); }
          else if (status === "not_open_yet") { setAccessDeniedReason("not_open_yet"); setIsAccessible(false); }
          else if (status === "closed") { setAccessDeniedReason("closed"); setIsAccessible(false); }
          else if (status === "open") { setIsAccessible(true); setAccessDeniedReason(null); }
          else { setAccessDeniedReason("unknown"); setIsAccessible(false); }
        } catch (error) {
          console.error("❌ [SUPA] Erreur vérification:", error);
          setAccessDeniedReason("error");
          setIsAccessible(false);
        } finally {
          setIsCheckingAccess(false);
        }
        return;
      }

      try {
        if (!auth.currentUser || !sessionId) {
          setIsCheckingAccess(false);
          setAccessDeniedReason("Paramètres manquants");
          return;
        }

        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (!userDoc.exists()) {
          setIsCheckingAccess(false);
          setAccessDeniedReason("Profil utilisateur non trouvé");
          return;
        }

        const userData = userDoc.data();
        const teamId = userData.teamId;
        setTeamIdState(teamId);
        if (!teamId) {
          setIsCheckingAccess(false);
          setAccessDeniedReason("Aucune équipe associée");
          return;
        }

        const trainingRef = doc(db, "teams", teamId, "trainings", sessionId);
        const trainingSnap = await getDoc(trainingRef);

        if (!trainingSnap.exists()) {
          setIsCheckingAccess(false);
          setAccessDeniedReason("Entraînement non trouvé");
          return;
        }

        const trainingData = trainingSnap.data();
        const endUtc = trainingData?.endUtc;
        const endMillis = endUtc?.toMillis?.() ?? null;
        const displayTz = trainingData?.displayTz || "Europe/Paris";

        const rawTitle = trainingData?.title || trainingData?.summary || eventTitle || "Training";
        const formatTime = (ts) => ts ? new Date(ts?.seconds ? ts.seconds * 1000 : ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null;
        const startFormatted = formatTime(trainingData?.startUtc);
        const endFormatted = formatTime(trainingData?.endUtc);
        const rawDate = (startFormatted && endFormatted) ? `${startFormatted} – ${endFormatted}` : (eventDate || "");
        setDisplayTitle(rawTitle);
        setDisplayDate(rawDate);

        const isTest = trainingData?.isTestSession === true;
        setIsTestSession(isTest);

        // V3: extract sessionType (default "conditioning")
        const sType = trainingData?.sessionType || "conditioning";
        setSessionType(sType);

        // V3: calculate duration in minutes
        const startMs = trainingData?.startUtc?.toMillis?.() ?? null;
        if (startMs && endMillis) {
          const durationMin = Math.max(1, Math.round((endMillis - startMs) / (1000 * 60)));
          setTrainingDuration(durationMin);
        }

        setTrainingInfoForMessage({
          endMillis,
          displayTz,
          title: trainingData?.title || eventTitle || "Entraînement",
        });

        if (!endMillis) {
          setIsCheckingAccess(false);
          setAccessDeniedReason("L'entraînement n'a pas d'heure de fin définie");
          return;
        }

        const responseRef = doc(db, "teams", teamId, "trainings", sessionId, "responses", auth.currentUser.uid);
        let responseSnap;
        try {
          responseSnap = await getDoc(responseRef);
        } catch (e) {
          console.warn("Load response failed:", e);
        }

        const hasCompleted = responseSnap?.exists() && responseSnap.data()?.status === 'completed';

        const now = DateTime.utc();
        const status = computeQuestionnaireStatus(endMillis, hasCompleted, now);

        console.log("[QUESTIONNAIRE] Access check", {
          sessionId,
          endMillis,
          now: now.toMillis(),
          hasCompleted,
          status,
          displayTz,
        });

        if (isTest && status !== 'completed') {
          setIsAccessible(true);
          setAccessDeniedReason(null);
        } else if (status === 'completed') {
          setAccessDeniedReason("already_completed");
          setIsAccessible(false);
        } else if (status === 'not_open_yet') {
          setAccessDeniedReason("not_open_yet");
          setIsAccessible(false);
        } else if (status === 'closed') {
          setAccessDeniedReason("closed");
          setIsAccessible(false);
        } else if (status === 'open') {
          setIsAccessible(true);
          setAccessDeniedReason(null);
        } else {
          setAccessDeniedReason("unknown");
          setIsAccessible(false);
        }
      } catch (error) {
        console.error("❌ Erreur lors de la vérification:", error);
        setAccessDeniedReason("error");
        setIsAccessible(false);
      } finally {
        setIsCheckingAccess(false);
      }
    };

    checkAccess();
  }, [sessionId]);

  // Redirect silently if access denied
  useLayoutEffect(() => {
    if (!isCheckingAccess && !isAccessible) {
      console.log("[QUESTIONNAIRE] Access denied, redirecting silently", { reason: accessDeniedReason });
      if (navigation?.goBack) {
        navigation.goBack();
      }
    }
  }, [isCheckingAccess, isAccessible, accessDeniedReason, navigation]);

  // ─── V3 State ────────────────────────────────────────────────────────────────
  const [sessionType, setSessionType] = useState("conditioning");
  const [trainingDuration, setTrainingDuration] = useState(60);

  // Dynamic questionnaire state
  const [activeQuestions, setActiveQuestions] = useState(null); // null = not loaded yet
  const [usedQuestionnaireId, setUsedQuestionnaireId] = useState(null);
  const [teamIdState, setTeamIdState] = useState(null);

  // Part 1 — Daily Baseline (1-100, default 50)
  const [metrics, setMetrics] = useState({
    tankLevel: 50,
    cardioLoad: 50,
    legBounce: 50,
    motorControl: 50,
    tacticalSharpness: 50,
    teamChemistry: 50,
  });

  // Part 2 — Friction Matrix
  // null = Q7 not yet answered, false = NO, true = YES
  const [hasFriction, setHasFriction] = useState(null);
  const [frictionType, setFrictionType] = useState([]);   // multi-select
  const [frictionImpact, setFrictionImpact] = useState(30);
  const [worryLevel, setWorryLevel] = useState(30);

  // ─── V3 Question Definitions (fallback when no questionnaire in Firestore) ──
  const Q5_CATEGORY = sessionType === "scrimmage" ? "Game IQ" : "Tactical Execution";

  const QUESTIONS_V3 = [
    {
      key: "tankLevel",
      category: "Physical Engine",
      question: "How loaded is your tank walking into today's session?",
      leftAnchor: "Running on empty",
      rightAnchor: "Fully charged, ready to go",
    },
    {
      key: "cardioLoad",
      category: "Physical Engine",
      question: "How gassed were your lungs and transitions yesterday?",
      leftAnchor: "Barely felt it",
      rightAnchor: "Completely gassed, lungs on fire",
    },
    {
      key: "legBounce",
      category: "Physical Engine",
      question: "How bouncy do your legs feel right now?",
      leftAnchor: "Legs are bricks",
      rightAnchor: "Springy and explosive",
    },
    {
      key: "motorControl",
      category: "Technical Execution",
      question: "How dialed-in does your handle and shot feel today?",
      leftAnchor: "Completely off, nothing feels right",
      rightAnchor: "Silky smooth, locked in",
    },
    {
      key: "tacticalSharpness",
      category: Q5_CATEGORY,
      question: "How sharp are you at reading the floor and executing the playbook?",
      leftAnchor: "Mentally foggy, one step behind",
      rightAnchor: "Seeing everything, fully locked in",
    },
    {
      key: "teamChemistry",
      category: "Psychosocial",
      question: "How connected do you feel to the team's energy and how well are you handling frustration?",
      leftAnchor: "Disconnected, frustration is getting to me",
      rightAnchor: "Locked in together, nothing breaks our focus",
    },
  ];

  // ─── Effective questions (dynamic or V3 fallback) ─────────────────────────
  const Q5_CATEGORY_RESOLVED = sessionType === "scrimmage" ? "Game IQ" : "Tactical Execution";
  const effectiveQuestions = (activeQuestions && activeQuestions.length > 0)
    ? activeQuestions.map(q => ({
        key: q.id || q.metricKey,
        metricKey: q.metricKey,
        category: q.category,
        question: q.questionText || q.question,
        leftAnchor: q.leftAnchor,
        rightAnchor: q.rightAnchor,
        weight: q.weight,
        inverted: !!q.inverted,
      }))
    : QUESTIONS_V3;

  // ─── V3 Readiness Calculation ─────────────────────────────────────────────
  const calculateReadiness = (m) => {
    const qs = effectiveQuestions;
    let score = 0;
    for (const q of qs) {
      const key = q.metricKey || q.key;
      let val = m[key] ?? 50;
      const isInverted = q.inverted !== undefined ? q.inverted : key === 'cardioLoad';
      if (isInverted) val = 101 - val;
      const weight = q.weight != null ? q.weight : (
        key === 'tankLevel' ? 0.20 : key === 'cardioLoad' ? 0.20 : key === 'legBounce' ? 0.20 :
        key === 'motorControl' ? 0.15 : key === 'tacticalSharpness' ? 0.15 : 0.10
      );
      score += val * weight;
    }
    return Math.max(1, Math.min(100, Math.round(score)));
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      // ── Chemin Supabase (V2) ──────────────────────────────
      if (USE_SUPABASE) {
        const isFrictionSupa = hasFriction === true;
        await supaSubmitResponse({
          teamId: teamIdState,
          sessionId,
          questionnaireId: usedQuestionnaireId,
          metrics: { ...metrics },
          hasFriction: isFrictionSupa,
          frictionType: isFrictionSupa ? (Array.isArray(frictionType) ? frictionType.join(",") : frictionType) : null,
          worryLevel: isFrictionSupa ? worryLevel : null,
          isTest: isTestSession || false,
        });
        console.log("✅ [SUPA] Réponse sauvegardée dans Postgres — webhook déclenché");
        if (Platform.OS === "web") setShowConfirmation(true);
        else { Alert.alert("Merci !", "Réponse enregistrée."); handleReturnHome(); }
        setIsSubmitting(false);
        return;
      }

      if (!auth.currentUser) {
        throw new Error("User not logged in");
      }

      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (!userDoc.exists()) throw new Error("User profile not found");

      const teamId = userDoc.data().teamId;
      if (!teamId) throw new Error("No team associated");

      const isFriction = hasFriction === true;
      const worryFlag = isFriction && worryLevel > 70;

      const responsePayload = {
        metrics: { ...metrics }, // dynamic keys from questionnaire
        readinessScore: calculateReadiness(metrics),
        workloadAU:     null, // sessionRPE removed in V3
        sessionType,
        questionnaireId: usedQuestionnaireId || null,
        hasFriction:    isFriction,
        frictionType:   isFriction ? frictionType  : null,
        frictionImpact: isFriction ? frictionImpact : null,
        worryLevel:     isFriction ? worryLevel     : null,
        worryFlag,
        isTest: isTestSession || false,
        // V2 backward-compat aliases (for PerformanceDashboard V1/V2 fallback)
        neuroLoad:       metrics.legBounce      ?? 50,
        stressLevel:     101 - (metrics.teamChemistry ?? 50),
        sleepQuality:    metrics.tankLevel      ?? 50,
        tacticalLucidity: metrics.tacticalSharpness ?? 50,
      };

      const { saveQuestionnaireResponse } = await import("../src/lib/responses");
      await saveQuestionnaireResponse(
        teamId,
        sessionId,
        auth.currentUser.uid,
        responsePayload
      );

      console.log("✅ Réponse sauvegardée dans Firestore");

      if (Platform.OS === 'web') {
        setShowConfirmation(true);
      } else {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'AthleteMain' }],
          })
        );
      }
    } catch (error) {
      console.error("❌ Erreur lors de la sauvegarde:", error);
      const errorMessage = error?.code === "permission-denied"
        ? "Erreur de permissions. Vérifie que tu es bien membre de l'équipe et que le questionnaire est toujours disponible."
        : `Erreur lors de la sauvegarde du questionnaire: ${error?.message || error}`;
      if (Platform.OS === 'web') {
        setSubmitError(errorMessage);
      } else {
        Alert.alert("Erreur", errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Load questionnaire from Firestore ────────────────────────────────────
  useEffect(() => {
    if (!teamIdState) return;
    let cancelled = false;
    (async () => {
      try {
        const teamSnap = await getDoc(doc(db, "teams", teamIdState));
        const teamData = teamSnap.exists() ? teamSnap.data() : {};
        const teamSport = teamData.sport || "Basketball";
        // Support both multi-select (questionnaireIds[]) and legacy single (questionnaireId)
        const questionnaireIds = teamData.questionnaireIds?.length > 0
          ? teamData.questionnaireIds
          : teamData.questionnaireId ? [teamData.questionnaireId] : [];

        let qDoc = null;

        if (questionnaireIds.length > 0) {
          // Fetch all assigned questionnaires then pick best match for this sessionType
          const fetchedQs = [];
          for (const qid of questionnaireIds) {
            const qSnap = await getDoc(doc(db, "questionnaires", qid));
            if (qSnap.exists()) fetchedQs.push({ id: qid, ...qSnap.data() });
          }
          // Priority: exact sessionType match > "any" > first
          const exactMatch = fetchedQs.find(q => q.sessionType === sessionType);
          const anyMatch = fetchedQs.find(q => q.sessionType === "any");
          const picked = exactMatch || anyMatch || fetchedQs[0] || null;
          if (picked?.questions?.length > 0) {
            qDoc = picked;
            if (!cancelled) setUsedQuestionnaireId(picked.id);
          }
        }

        if (!qDoc) {
          const q = query(
            collection(db, "questionnaires"),
            where("sport", "==", teamSport),
            where("isDefault", "==", true),
            where("sessionType", "==", "any"),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            qDoc = snap.docs[0].data();
            if (!cancelled) setUsedQuestionnaireId(snap.docs[0].id);
          }
        }

        if (!cancelled && qDoc?.questions?.length > 0) {
          const qs = qDoc.questions;
          setActiveQuestions(qs);
          // Initialize metrics for all question keys
          const initMetrics = {};
          qs.forEach(q => { initMetrics[q.metricKey] = 50; });
          setMetrics(initMetrics);
        }
      } catch (e) {
        console.warn("[QUESTIONNAIRE] Failed to load questionnaire, using V3 defaults:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [teamIdState, sessionType]);

  const handleMetricChange = (key, value) => {
    setMetrics(prev => ({ ...prev, [key]: value }));
  };

  const toggleFrictionType = (type) => {
    setFrictionType(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Slider fill: left (dim cyan) → current position → right (transparent)
  const sliderFill = (value) => {
    const pct = ((value - 1) / 99) * 100;
    return `linear-gradient(90deg, rgba(0,212,255,0.55) ${pct}%, rgba(255,255,255,0.10) ${pct}%)`;
  };

  // Submit is ready once Q7 (hasFriction) is answered
  const isSubmitReady = hasFriction !== null;

  // ── Courtlight: one-slider-per-screen state (Supabase path only) ──
  const [currentQ, setCurrentQ] = useState(0);
  const totalSteps = effectiveQuestions.length + 1; // +1 for friction
  const advanceQ = () => {
    if (currentQ < effectiveQuestions.length) {
      setCurrentQ(prev => prev + 1);
    }
  };

  // Inject CSS (always called, guards internally)
  React.useEffect(() => {
    if (Platform.OS !== "web") return;
      const style = document.createElement('style');
      style.textContent = `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* V3 Slider — white thumb, no number tooltip */
        .slider-v3 {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          outline: none;
          border-radius: 9999px;
          cursor: pointer;
        }
        .slider-v3::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          background: radial-gradient(circle at 35% 30%, #9FE9FF, #00D4FF 55%, #0077CC);
          cursor: grab;
          border-radius: 50%;
          box-shadow: 0 0 22px rgba(0,212,255,0.65), 0 4px 10px rgba(0,0,0,0.5);
          transition: transform 120ms cubic-bezier(0.34,1.3,0.44,1);
        }
        .slider-v3:active::-webkit-slider-thumb {
          transform: scale(1.18);
          cursor: grabbing;
          box-shadow: 0 0 28px rgba(0,212,255,0.9), 0 4px 10px rgba(0,0,0,0.5);
        }
        .slider-v3::-moz-range-thumb {
          width: 22px;
          height: 22px;
          background: #FFFFFF;
          cursor: pointer;
          border-radius: 50%;
          border: none;
          box-shadow: 0 0 8px rgba(0,212,255,0.6);
        }
        .slider-v3::-moz-range-track {
          height: 6px;
          border-radius: 9999px;
          background: transparent;
        }

        .card-animate {
          animation: fadeIn 150ms ease-out both;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes ctpFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes frictionReveal {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);
      return () => document.head.removeChild(style);
  }, []);

  if (Platform.OS === "web") {
    // Loading screen
    if (isCheckingAccess) {
      return (
        <MobileViewport>
          <div style={{
            width: "100%",
            height: "100vh",
            background: "linear-gradient(to bottom, #0B0F1A, #020409)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "20px",
          }}>
            <div style={{
              width: "40px",
              height: "40px",
              border: "3px solid rgba(0,224,255,0.3)",
              borderTop: "3px solid #00D4FF",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }} />
            <div style={{ color: "#00D4FF", fontSize: "16px", fontWeight: "600" }}>
              Vérification en cours...
            </div>
          </div>
        </MobileViewport>
      );
    }

    if (!isAccessible && !isCheckingAccess) {
      // Show a brief message instead of blank screen while goBack() completes
      return (
        <MobileViewport>
          <div style={{
            width: "100%",
            height: "100vh",
            background: courtlightBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "16px",
          }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "15px", textAlign: "center", padding: "0 32px" }}>
              {accessDeniedReason === "already_completed"
                ? "You have already completed this questionnaire."
                : accessDeniedReason === "closed" || accessDeniedReason === "not_open_yet"
                ? "This questionnaire is not available right now."
                : "Access denied."}
            </div>
            <button
              onClick={handleGoBack}
              style={{
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.20)",
                borderRadius: "10px",
                padding: "10px 20px",
                color: "#00D4FF",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Go Back
            </button>
          </div>
        </MobileViewport>
      );
    }

    // ═══════════ COURTLIGHT CHECK-IN (Supabase path, doc 06 §7.2) ═══════════
    if (USE_SUPABASE) {
      const currentQuestion = currentQ < effectiveQuestions.length ? effectiveQuestions[currentQ] : null;
      const currentValue = currentQuestion ? (metrics[currentQuestion.metricKey || currentQuestion.key] ?? 50) : 50;
      const isFrictionStep = currentQ >= effectiveQuestions.length;
      const secsLeft = Math.max(10, 60 - currentQ * 10);

      return (
        <MobileViewport>
          <div style={{
            width: "100%", height: "100vh", background: courtlightBg,
            fontFamily: "'Inter', -apple-system, sans-serif", letterSpacing: "-0.01em",
            color: "#fff", display: "flex", flexDirection: "column",
            maxWidth: "430px", margin: "0 auto", position: "relative", overflow: "hidden",
          }}>
            {/* Dots progress */}
            <div style={{ display: "flex", gap: "6px", justifyContent: "center", padding: "28px 0 4px" }}>
              {effectiveQuestions.map((_, i) => (
                <span key={i} style={{
                  width: i === currentQ ? 18 : 6, height: 6, borderRadius: 999,
                  background: i < currentQ ? "#00D4FF" : i === currentQ ? "#00D4FF" : "rgba(255,255,255,0.18)",
                  boxShadow: i <= currentQ ? "0 0 8px rgba(0,212,255,0.6)" : "none",
                  transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
                }} />
              ))}
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>
              about <span style={{ color: "#00D4FF", fontWeight: 700 }}>{secsLeft}</span> seconds
            </div>

            {/* Confirmation overlay — "Locked in." */}
            {showConfirmation && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(7,11,20,0.96)", backdropFilter: "blur(14px)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, flexDirection: "column",
              }}>
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>Locked in.</div>
                  <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>See you tomorrow.</div>
                  <div style={{
                    marginTop: 22, background: "rgba(17,26,45,0.92)", border: "1px solid rgba(0,212,255,0.10)",
                    borderRadius: 16, padding: 16, textAlign: "left",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9CA3AF" }}>
                      YOUR 7-DAY TREND
                    </div>
                    <svg viewBox="0 0 340 60" style={{ width: "100%", marginTop: 8 }}>
                      <polyline points="0,38 48,34 96,40 144,28 192,30 240,22 288,26 336,18"
                        fill="none" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round"
                        style={{ filter: "drop-shadow(0 0 6px rgba(0,212,255,0.6))" }} />
                    </svg>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
                      Trending above your baseline 4 of the last 7 days.
                    </div>
                  </div>
                  <button onClick={() => handleReturnHome()} style={{
                    marginTop: 18, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(0,212,255,0.10)",
                    borderRadius: 10, padding: "12px 24px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}>Back home</button>
                </div>
              </div>
            )}

            {/* Question card OR friction step */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 18px" }}>
              {!isFrictionStep && currentQuestion ? (
                <div key={currentQ} style={{
                  background: "rgba(19,28,51,0.66)", backdropFilter: "blur(14px)",
                  border: "1px solid rgba(0,212,255,0.28)", borderRadius: 16, padding: "20px 18px",
                  boxShadow: "0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(160,220,255,0.14)",
                  animation: "fadeIn 0.3s cubic-bezier(0.22,1,0.36,1)",
                }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.12em", fontWeight: 500, color: "rgba(0,212,255,0.6)", textTransform: "uppercase" }}>
                    {currentQuestion.category}
                  </div>
                  <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.4, margin: "10px 0 22px", color: "#fff" }}>
                    {currentQuestion.question}
                  </p>
                  <input
                    type="range" min="1" max="100" value={currentValue}
                    onChange={(e) => handleMetricChange(currentQuestion.metricKey || currentQuestion.key, parseInt(e.target.value))}
                    className="slider-v3"
                    style={{ background: sliderFill(currentValue) }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                    <span style={{ fontSize: 12, color: "#9CA3AF", maxWidth: "46%" }}>{currentQuestion.leftAnchor}</span>
                    <span style={{ fontSize: 12, color: "#9CA3AF", maxWidth: "46%", textAlign: "right" }}>{currentQuestion.rightAnchor}</span>
                  </div>
                  <button onClick={advanceQ} style={{
                    width: "100%", marginTop: 18, padding: "14px 0", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg, #00D4FF, #0066FF)", color: "#04121F",
                    fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em",
                    boxShadow: "0 6px 20px rgba(0,120,255,0.35)",
                  }}>Next</button>
                </div>
              ) : isFrictionStep && !showConfirmation ? (
                <div style={{
                  background: "rgba(19,28,51,0.66)", backdropFilter: "blur(14px)",
                  border: "1px solid rgba(0,212,255,0.28)", borderRadius: 16, padding: "20px 18px",
                  boxShadow: "0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(160,220,255,0.14)",
                  animation: "fadeIn 0.3s cubic-bezier(0.22,1,0.36,1)",
                }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.12em", fontWeight: 500, color: "rgba(0,212,255,0.6)", textTransform: "uppercase" }}>
                    FRICTION MATRIX
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.45, margin: "10px 0 16px", color: "#fff" }}>
                    Is there any specific friction limiting your performance right now?
                  </p>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={() => setHasFriction(false)} style={{
                      flex: 1, padding: "14px 0", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer",
                      border: hasFriction === false ? "1.5px solid #00C853" : "1.5px solid rgba(0,200,83,0.22)",
                      background: hasFriction === false ? "rgba(0,200,83,0.10)" : "rgba(0,200,83,0.03)",
                      color: hasFriction === false ? "#00C853" : "rgba(0,200,83,0.50)",
                    }}>NO</button>
                    <button onClick={() => setHasFriction(true)} style={{
                      flex: 1, padding: "14px 0", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer",
                      border: hasFriction === true ? "1.5px solid #EF4444" : "1.5px solid rgba(239,68,68,0.22)",
                      background: hasFriction === true ? "rgba(239,68,68,0.10)" : "rgba(239,68,68,0.03)",
                      color: hasFriction === true ? "#EF4444" : "rgba(239,68,68,0.50)",
                    }}>YES</button>
                  </div>

                  {hasFriction === true && (
                    <div style={{ marginTop: 18, animation: "frictionReveal 0.2s ease-out both" }}>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "#fff", margin: "0 0 10px" }}>What kind?</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                        {["Physical Soreness", "Academic / Life Stress", "Court Confusion", "Mental / Emotional"].map(type => {
                          const sel = frictionType.includes(type);
                          return <button key={type} onClick={() => toggleFrictionType(type)} style={{
                            padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                            border: sel ? "1.5px solid #00D4FF" : "1.5px solid rgba(0,212,255,0.20)",
                            background: sel ? "rgba(0,212,255,0.12)" : "transparent",
                            color: sel ? "#fff" : "rgba(255,255,255,0.45)",
                          }}>{type}</button>;
                        })}
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "#fff", margin: "0 0 10px" }}>How much is it affecting your game?</p>
                      <input type="range" min="1" max="100" value={frictionImpact}
                        onChange={(e) => setFrictionImpact(parseInt(e.target.value))}
                        className="slider-v3" style={{ background: sliderFill(frictionImpact) }} />
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, marginBottom: 14 }}>
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>Barely noticeable</span>
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>Severely limiting</span>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: "#fff", margin: "0 0 10px" }}>How much is it messing with your head?</p>
                      <input type="range" min="1" max="100" value={worryLevel}
                        onChange={(e) => setWorryLevel(parseInt(e.target.value))}
                        className="slider-v3" style={{ background: sliderFill(worryLevel) }} />
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>Not worried</span>
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>Highly concerned</span>
                      </div>
                    </div>
                  )}

                  {isSubmitReady && (
                    <button onClick={handleSubmit} disabled={isSubmitting} style={{
                      width: "100%", marginTop: 18, padding: "14px 0", borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg, #00D4FF, #0066FF)", color: "#04121F",
                      fontSize: 14, fontWeight: 700, cursor: isSubmitting ? "not-allowed" : "pointer",
                      opacity: isSubmitting ? 0.5 : 1, boxShadow: "0 6px 20px rgba(0,120,255,0.35)",
                    }}>{isSubmitting ? "Sending..." : "Submit"}</button>
                  )}
                  {submitError && <div style={{ color: "#FF7A93", fontSize: 12, textAlign: "center", marginTop: 10 }}>{submitError}</div>}
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.20)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
                    Your responses are used solely by your coaching staff. FERPA rights apply.
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </MobileViewport>
      );
    }
    // ═══════════ END COURTLIGHT CHECK-IN ═══════════

    return (
      <MobileViewport>
        <div style={{
          width: "100%",
          height: "100vh",
          background: "#0A0F1E",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          color: "rgba(255,255,255,0.9)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          maxWidth: "384px",
          margin: "0 auto",
          overflow: "hidden",
        }}>
          {/* Radial glow */}
          <div style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "300px",
            height: "300px",
            background: "radial-gradient(circle, rgba(0,212,255,0.07), transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }} />

          {/* Header — back button */}
          <div style={{
            position: "relative",
            zIndex: 20,
            padding: "24px 24px 0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
          }}>
            <button
              onClick={handleGoBack}
              style={{
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.20)",
                borderRadius: "12px",
                padding: "10px 16px",
                color: "#00D4FF",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </button>
          </div>

          {/* Test session banner */}
          {isTestSession && (
            <div style={{
              margin: "8px 24px 0",
              padding: "10px 16px",
              borderRadius: "10px",
              background: "rgba(255,184,0,0.08)",
              border: "1px solid #FFB800",
              color: "#FFB800",
              fontSize: "13px",
              fontWeight: 600,
              textAlign: "center",
              zIndex: 20,
              position: "relative",
            }}>
              🧪 Test Session — This response won't affect your stats
            </div>
          )}

          {/* Scrollable content */}
          <div
            className="hide-scrollbar"
            style={{
              flex: 1,
              padding: "0 20px",
              paddingTop: "20px",
              paddingBottom: "140px",
              zIndex: 10,
              overflowY: "auto",
              overflowX: "hidden",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {/* Session title */}
            <header style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingBottom: "20px",
              textAlign: "center",
            }}>
              <h1 style={{
                fontSize: "26px",
                fontWeight: "600",
                color: "rgba(255,255,255,0.9)",
                margin: 0,
                fontFamily: "'DM Sans', system-ui",
              }}>
                {displayTitle || eventTitle || "Training"}
              </h1>
              {(displayDate || eventDate) ? (
                <p style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.45)",
                  margin: "6px 0 0 0",
                  fontFamily: "'Space Mono', monospace",
                  letterSpacing: "1px",
                }}>
                  {displayDate || eventDate}
                </p>
              ) : null}
            </header>

            {/* ── PART 1: Daily Baseline (6 questions) ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "14px" }}>
              {effectiveQuestions.map((q, index) => {
                const value = metrics[q.metricKey || q.key] ?? 50;
                return (
                  <div
                    key={q.metricKey || q.key}
                    className="card-animate"
                    style={{
                      background: "#0D1526",
                      borderRadius: "12px",
                      padding: "16px 16px 14px",
                      border: "1px solid rgba(0,212,255,0.10)",
                      animationDelay: `${40 * (index + 1)}ms`,
                    }}
                  >
                    {/* Category + progress */}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                    }}>
                      <span style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: "10px",
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        color: "rgba(0,212,255,0.6)",
                      }}>
                        {q.category}
                      </span>
                      <span style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: "10px",
                        letterSpacing: "1.5px",
                        textTransform: "uppercase",
                        color: "rgba(0,212,255,0.45)",
                      }}>
                        Q{index + 1} OF 6
                      </span>
                    </div>

                    {/* Question text */}
                    <p style={{
                      margin: "0 0 16px",
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "#FFFFFF",
                      fontFamily: "'DM Sans', system-ui",
                      lineHeight: 1.45,
                    }}>
                      {q.question}
                    </p>

                    {/* Slider — no tooltip, no numbers */}
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={value}
                      onChange={(e) => handleMetricChange(q.metricKey || q.key, parseInt(e.target.value))}
                      className="slider-v3"
                      style={{ background: sliderFill(value) }}
                    />

                    {/* Anchor labels */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                      <span style={{
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.45)",
                        fontFamily: "'Space Mono', monospace",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        maxWidth: "46%",
                        lineHeight: 1.35,
                      }}>
                        {q.leftAnchor}
                      </span>
                      <span style={{
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.45)",
                        fontFamily: "'Space Mono', monospace",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        maxWidth: "46%",
                        textAlign: "right",
                        lineHeight: 1.35,
                      }}>
                        {q.rightAnchor}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── PART 2: Friction Matrix ── */}
            <div
              className="card-animate"
              style={{
                background: "#0D1526",
                borderRadius: "12px",
                padding: "18px 16px",
                border: "1px solid rgba(0,212,255,0.10)",
                marginBottom: "14px",
                animationDelay: "280ms",
              }}
            >
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "10px",
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "rgba(0,212,255,0.6)",
                display: "block",
                marginBottom: "12px",
              }}>
                Friction Matrix
              </span>

              {/* Q7 */}
              <p style={{
                margin: "0 0 16px",
                fontSize: "15px",
                fontWeight: 500,
                color: "#FFFFFF",
                fontFamily: "'DM Sans', system-ui",
                lineHeight: 1.45,
              }}>
                Is there any specific friction limiting your performance right now?
              </p>

              {/* YES / NO buttons */}
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => setHasFriction(false)}
                  style={{
                    flex: 1,
                    padding: "14px 0",
                    borderRadius: "10px",
                    fontSize: "15px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: hasFriction === false
                      ? "1.5px solid #00FF9D"
                      : "1.5px solid rgba(0,255,157,0.22)",
                    background: hasFriction === false
                      ? "rgba(0,255,157,0.10)"
                      : "rgba(0,255,157,0.03)",
                    color: hasFriction === false ? "#00FF9D" : "rgba(0,255,157,0.50)",
                    fontFamily: "'DM Sans', system-ui",
                    letterSpacing: "1px",
                    transition: "all 0.15s",
                  }}
                >
                  NO
                </button>
                <button
                  onClick={() => setHasFriction(true)}
                  style={{
                    flex: 1,
                    padding: "14px 0",
                    borderRadius: "10px",
                    fontSize: "15px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: hasFriction === true
                      ? "1.5px solid #FF4B4B"
                      : "1.5px solid rgba(255,75,75,0.22)",
                    background: hasFriction === true
                      ? "rgba(255,75,75,0.10)"
                      : "rgba(255,75,75,0.03)",
                    color: hasFriction === true ? "#FF4B4B" : "rgba(255,75,75,0.50)",
                    fontFamily: "'DM Sans', system-ui",
                    letterSpacing: "1px",
                    transition: "all 0.15s",
                  }}
                >
                  YES
                </button>
              </div>

              {/* Q8, Q9, Q10 — only when YES */}
              {hasFriction === true && (
                <div style={{
                  marginTop: "22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "22px",
                  animation: "frictionReveal 0.2s ease-out both",
                }}>

                  {/* Q8 — frictionType (multi-select pills) */}
                  <div>
                    <p style={{
                      margin: "0 0 12px",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#FFFFFF",
                      fontFamily: "'DM Sans', system-ui",
                      lineHeight: 1.4,
                    }}>
                      What kind of friction is it?
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {[
                        "Physical Soreness",
                        "Academic / Life Stress",
                        "Court Confusion",
                        "Mental / Emotional",
                      ].map((type) => {
                        const selected = frictionType.includes(type);
                        return (
                          <button
                            key={type}
                            onClick={() => toggleFrictionType(type)}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "20px",
                              fontSize: "12px",
                              fontWeight: 500,
                              cursor: "pointer",
                              border: selected
                                ? "1.5px solid #00D4FF"
                                : "1.5px solid rgba(0,212,255,0.20)",
                              background: selected
                                ? "rgba(0,212,255,0.12)"
                                : "transparent",
                              color: selected ? "#FFFFFF" : "rgba(255,255,255,0.45)",
                              fontFamily: "'DM Sans', system-ui",
                              transition: "all 0.15s",
                            }}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Q9 — frictionImpact */}
                  <div>
                    <p style={{
                      margin: "0 0 14px",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#FFFFFF",
                      fontFamily: "'DM Sans', system-ui",
                      lineHeight: 1.4,
                    }}>
                      How much is this friction actually affecting your game?
                    </p>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={frictionImpact}
                      onChange={(e) => setFrictionImpact(parseInt(e.target.value))}
                      className="slider-v3"
                      style={{ background: sliderFill(frictionImpact) }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                      <span style={{
                        fontSize: "10px", color: "rgba(255,255,255,0.45)",
                        fontFamily: "'Space Mono', monospace", textTransform: "uppercase",
                        letterSpacing: "0.5px", maxWidth: "46%", lineHeight: 1.35,
                      }}>
                        Barely noticeable, playing through it
                      </span>
                      <span style={{
                        fontSize: "10px", color: "rgba(255,255,255,0.45)",
                        fontFamily: "'Space Mono', monospace", textTransform: "uppercase",
                        letterSpacing: "0.5px", maxWidth: "46%", textAlign: "right", lineHeight: 1.35,
                      }}>
                        Severely limiting, can't perform my role
                      </span>
                    </div>
                  </div>

                  {/* Q10 — worryLevel */}
                  <div>
                    <p style={{
                      margin: "0 0 14px",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "#FFFFFF",
                      fontFamily: "'DM Sans', system-ui",
                      lineHeight: 1.4,
                    }}>
                      How much is this friction messing with your head?
                    </p>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={worryLevel}
                      onChange={(e) => setWorryLevel(parseInt(e.target.value))}
                      className="slider-v3"
                      style={{ background: sliderFill(worryLevel) }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                      <span style={{
                        fontSize: "10px", color: "rgba(255,255,255,0.45)",
                        fontFamily: "'Space Mono', monospace", textTransform: "uppercase",
                        letterSpacing: "0.5px", maxWidth: "46%", lineHeight: 1.35,
                      }}>
                        I can handle it, not worried
                      </span>
                      <span style={{
                        fontSize: "10px", color: "rgba(255,255,255,0.45)",
                        fontFamily: "'Space Mono', monospace", textTransform: "uppercase",
                        letterSpacing: "0.5px", maxWidth: "46%", textAlign: "right", lineHeight: 1.35,
                      }}>
                        Highly concerned, it's taking over my focus
                      </span>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Submit */}
            <div style={{ marginBottom: "20px" }}>
              {submitError && (
                <div style={{
                  color: "#FF7A93",
                  fontSize: "12px",
                  fontWeight: 500,
                  textAlign: "center",
                  marginBottom: "12px",
                }}>
                  {submitError}
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !isSubmitReady}
                style={{
                  width: "100%",
                  padding: "16px 0",
                  borderRadius: "12px",
                  fontSize: "16px",
                  fontWeight: "700",
                  cursor: (isSubmitting || !isSubmitReady) ? "not-allowed" : "pointer",
                  background: "linear-gradient(135deg, #00BFFF, #0066FF)",
                  color: "white",
                  border: "none",
                  boxShadow: "0 0 20px 5px rgba(0,191,255,0.20)",
                  letterSpacing: "1px",
                  opacity: (isSubmitting || !isSubmitReady) ? 0.4 : 1,
                  transition: "opacity 0.2s, filter 0.15s, transform 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (isSubmitting || !isSubmitReady) return;
                  e.target.style.filter = "brightness(1.2)";
                  e.target.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.filter = "brightness(1)";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                {isSubmitting ? "Sending..." : "Submit"}
              </button>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.20)', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
                Your responses are used solely by your coaching staff for training decisions. FERPA rights apply.
              </div>
            </div>
          </div>

          {/* Confirmation overlay */}
          {showConfirmation && Platform.OS === 'web' && (
            <div style={{
              position: "absolute",
              inset: 0,
              background: "rgba(3,7,15,0.92)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 999,
            }}>
              <div style={{
                width: "90%",
                maxWidth: "340px",
                padding: "36px 32px",
                borderRadius: "24px",
                border: "1px solid rgba(0,255,194,0.35)",
                background: "rgba(12,20,40,0.95)",
                boxShadow: "0 25px 60px rgba(0,0,0,0.65), 0 0 40px rgba(0,255,194,0.2)",
                textAlign: "center",
                animation: "ctpFadeIn 0.4s ease forwards",
              }}>
                <div style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  margin: "0 auto 24px",
                  background: "linear-gradient(135deg, #00FFC2, #00C16A)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 40px rgba(0,255,194,0.55)",
                }}>
                  <svg width="32" height="24" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 9L8.5 14.5L21 2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#FFFFFF", marginBottom: "8px" }}>
                  {isTestSession
                    ? "✅ Test complete! Notifications are working correctly."
                    : "Your response has been successfully submitted."}
                </div>
                <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
                  Redirecting to your dashboard...
                </div>
              </div>
            </div>
          )}
        </div>
      </MobileViewport>
    );
  }
}
