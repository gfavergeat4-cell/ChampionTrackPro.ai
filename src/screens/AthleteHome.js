import React, { useCallback, useState } from "react";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Alert } from "react-native";
import AthleteHomeNew from "../stitch_components/AthleteHomeNew";

export default function AthleteHome() {
  const navigation = useNavigation();
  const [refreshToken, setRefreshToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRefreshToken((prev) => prev + 1);
    }, [])
  );

  const handleRespond = (sessionId, eventData) => {
    console.log("[ATHLETE_HOME] Respond clicked for session:", sessionId);
    console.log("[ATHLETE_HOME] Event data being passed:", eventData);
    
    // Extraire teamId et trainingId depuis eventData
    // eventData peut être l'objet EventWithResponse complet ou un objet formaté
    const teamId = eventData?.teamId || eventData?.eventData?.teamId;
    const trainingId = sessionId;
    
    if (!teamId || !trainingId) {
      console.error("[ATHLETE_HOME] Missing teamId or trainingId", { teamId, trainingId, eventData });
      Alert.alert("Erreur", "Impossible de déterminer l'équipe ou l'entraînement.");
      return;
    }
    
    // Préparer eventData complet pour le questionnaire
    // Si eventData.eventData existe, c'est l'objet EventWithResponse complet
    const fullEventData = eventData?.eventData || eventData;
    
    console.log("[ATHLETE_HOME] Navigating to Questionnaire with:", {
      teamId,
      trainingId,
      title: fullEventData?.title,
      startDate: fullEventData?.startDate,
      endDate: fullEventData?.endDate,
      startUtc: fullEventData?.startUtc,
      endUtc: fullEventData?.endUtc,
      displayTz: fullEventData?.displayTz,
      questionnaireStatus: fullEventData?.questionnaireStatus,
      questionnaireState: fullEventData?.questionnaireState,
    });
    
    // Only pass serializable primitives — React Navigation v7 serializes params
    // to the URL on web; non-serializable objects (Firestore Timestamps, Dates)
    // corrupt the entire params object and make trainingId arrive as undefined.
    navigation.navigate("Questionnaire", {
      trainingId,
      sessionId,
      eventTitle: fullEventData?.title || eventData?.title || "Training Session",
      eventDate: fullEventData?.time || eventData?.time || "",
    });
  };

  const handleOpenSession = (sessionId) => {
    console.log("[ATHLETE_HOME] Session clicked:", sessionId);
    // Could navigate to session details if that screen exists
  };

  const handleNavigateToTab = (tab) => {
    console.log("[ATHLETE_HOME] Navigating to tab:", tab);
    if (tab === 'Home') {
      navigation.navigate('Home');
    } else if (tab === 'Schedule') {
      navigation.navigate('Schedule');
    } else if (tab === 'Profile') {
      navigation.navigate('Profile');
    }
  };

  return (
    <AthleteHomeNew
      onRespond={handleRespond}
      onOpenSession={handleOpenSession}
      onNavigateToTab={handleNavigateToTab}
      refreshToken={refreshToken}
    />
  );
}
