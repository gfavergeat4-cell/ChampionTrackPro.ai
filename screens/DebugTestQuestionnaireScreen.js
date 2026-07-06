import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";

/**
 * Debug-only screen at /debug/test-questionnaire.
 * Used to verify notification deep-link; not submittable.
 */
export default function DebugTestQuestionnaireScreen() {
  const navigation = useNavigation();
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");

  const handleBackToProfile = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = "/";
    } else {
      navigation.goBack();
    }
  };

  const containerStyle = {
    flex: 1,
    backgroundColor: "#0E1528",
    padding: 24,
    paddingTop: 48,
  };

  const titleStyle = {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  };

  const noteStyle = {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 24,
  };

  const labelStyle = {
    color: "#D1D5DB",
    fontSize: 14,
    marginBottom: 8,
  };

  const inputStyle = {
    backgroundColor: "#1F2937",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    padding: 14,
    color: "#fff",
    fontSize: 16,
    marginBottom: 20,
  };

  const buttonStyle = {
    backgroundColor: "#4A67FF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  };

  const buttonDisabledStyle = {
    backgroundColor: "#374151",
    opacity: 0.6,
  };

  const backButtonStyle = {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#00D4FF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 32,
  };

  return (
    <View style={containerStyle}>
      <Text style={titleStyle}>Test Questionnaire</Text>
      <Text style={noteStyle}>Debug only — do not submit.</Text>

      <Text style={labelStyle}>Question 1 (dummy)</Text>
      <TextInput
        style={inputStyle}
        value={q1}
        onChangeText={setQ1}
        placeholder="Answer 1"
        placeholderTextColor="#6B7280"
      />

      <Text style={labelStyle}>Question 2 (dummy)</Text>
      <TextInput
        style={inputStyle}
        value={q2}
        onChangeText={setQ2}
        placeholder="Answer 2"
        placeholderTextColor="#6B7280"
      />

      <Text style={labelStyle}>Question 3 (dummy)</Text>
      <TextInput
        style={inputStyle}
        value={q3}
        onChangeText={setQ3}
        placeholder="Answer 3"
        placeholderTextColor="#6B7280"
      />

      <Pressable
        style={[buttonStyle, buttonDisabledStyle]}
        disabled
      >
        <Text style={{ color: "#9CA3AF", fontSize: 16, fontWeight: "600" }}>Submit</Text>
      </Pressable>

      <Pressable style={backButtonStyle} onPress={handleBackToProfile}>
        <Text style={{ color: "#00D4FF", fontSize: 16, fontWeight: "600" }}>Back to Profile</Text>
      </Pressable>
    </View>
  );
}
