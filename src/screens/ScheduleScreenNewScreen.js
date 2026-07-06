import React from "react";
import { useNavigation } from "@react-navigation/native";
import { Alert } from "react-native";
import ScheduleScreenNew from "../stitch_components/ScheduleScreenNew";

export default function ScheduleScreenNewScreen() {
  const navigation = useNavigation();

  const handleRespond = (sessionId, eventData) => {
    console.log("[SCHEDULE_SCREEN] Respond clicked for session:", sessionId);
    console.log("[SCHEDULE_SCREEN] Event data being passed:", eventData);
    
    // Extraire teamId et trainingId depuis eventData
    // eventData peut être l'objet EventWithResponse complet
    const teamId = eventData?.teamId || eventData?.eventData?.teamId;
    const trainingId = sessionId;
    
    if (!teamId || !trainingId) {
      console.error("[SCHEDULE_SCREEN] Missing teamId or trainingId", { teamId, trainingId, eventData });
      Alert.alert("Erreur", "Impossible de déterminer l'équipe ou l'entraînement.");
      return;
    }
    
    // Préparer eventData complet pour le questionnaire
    // Si eventData.eventData existe, c'est l'objet EventWithResponse complet
    const fullEventData = eventData?.eventData || eventData;
    
    console.log("[SCHEDULE_SCREEN] Navigating to Questionnaire with:", {
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
    
    navigation.navigate("Questionnaire", { 
      teamId,
      trainingId,
      eventData: fullEventData, // Passer l'event complet pour avoir toutes les infos
      eventTitle: fullEventData?.title || eventData?.title || "Training Session",
      eventDate: fullEventData?.time || eventData?.time || new Date().toLocaleTimeString(),
      eventStartDate: fullEventData?.startDate || eventData?.startDate,
      eventEndDate: fullEventData?.endDate || eventData?.endDate,
      // Support ancien format (deprecated)
      sessionId,
      eventId: trainingId,
    });
  };

  return (
    <ScheduleScreenNew
      onRespond={handleRespond}
    />
  );
}

