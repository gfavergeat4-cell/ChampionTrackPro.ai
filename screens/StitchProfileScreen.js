import React, { useState, useEffect } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Platform, StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from "react-native";
import MobileViewport from "../src/components/MobileViewport";
import { useIsDesktop } from "../src/hooks/useIsDesktop";
import { signOut } from "firebase/auth";
import { auth, db } from "../services/firebaseConfig";
import { CommonActions } from "@react-navigation/native";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import UnifiedAthleteNavigation from "../src/stitch_components/UnifiedAthleteNavigation";
import { testNotificationFlow } from "../src/services/notificationTest";
import { registerWebPushTokenForCurrentUser } from "../src/services/webNotifications";
import { initializeFCM } from "../src/services/fcmService";

export default function StitchProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const isDesktop = useIsDesktop();
  const roleParam = (route.params && route.params.role) || null;
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    jerseyNumber: "",
    position: "",
  });
  const [profileImage, setProfileImage] = useState(null);
  const [notifTestStatus, setNotifTestStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'denied'
  const [notifPermission, setNotifPermission] = useState('default'); // 'default' | 'granted' | 'denied'
  const [logoTapCount, setLogoTapCount] = useState(0); // FIX 3: 5x tap to reveal test button
  const [showTestButton, setShowTestButton] = useState(false); // FIX 3

  const notify = (title, message) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const text = message ? `${title}\n\n${message}` : title;
      window.alert(text);
    } else {
      Alert.alert(title, message);
    }
  };

  const accentBlue = "#2BC9FF";
  const mutedSurface = "rgba(10, 15, 26, 0.85)";
  const formSurface = "rgba(12, 18, 30, 0.85)";
  const outlineColor = "rgba(43, 201, 255, 0.3)";
  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const checkPermission = () => {
      if (typeof Notification === 'undefined') {
        setNotifPermission('denied');
        return;
      }
      setNotifPermission(Notification.permission);
    };

    // Lecture initiale
    checkPermission();

    // Relecture quand l'utilisateur revient sur l'onglet/app
    document.addEventListener('visibilitychange', checkPermission);
    window.addEventListener('focus', checkPermission);

    return () => {
      document.removeEventListener('visibilitychange', checkPermission);
      window.removeEventListener('focus', checkPermission);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const styleEl = document.createElement('style');
      styleEl.innerHTML = `.stitch-profile-scroll::-webkit-scrollbar { display: none; }`;
      document.head.appendChild(styleEl);
      return () => {
        document.head.removeChild(styleEl);
      };
    }
    return undefined;
  }, []);

  const handleTabNavigation = (tab) => {
    console.log("Navigation vers:", tab);
    if (tab === "Home") {
      navigation.navigate("Home");
    } else if (tab === "Schedule") {
      navigation.navigate("Schedule");
    }
    // Profile est dÃ©jÃ  actif, pas besoin de naviguer
  };

  const loadUserData = async () => {
    try {
      console.log("ðŸ” Loading user data...");
      if (!auth.currentUser) {
        console.log("âŒ No authenticated user");
        setLoading(false);
        return;
      }

      console.log("ðŸ‘¤ Current user:", auth.currentUser.uid);
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      console.log("ðŸ“„ User document exists:", userDoc.exists());
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        console.log("ðŸ“Š User data:", data);
        setUserData(data);
        setFormData({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          jerseyNumber: data.jerseyNumber || "",
          position: data.position || "",
        });
        setProfileImage(data.profileImage || null);
      }
      setLoading(false);
    } catch (error) {
      console.error("âŒ Error loading user data:", error);
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    console.log(`ðŸ“ ${field} changed:`, value);
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveChanges = async () => {
    try {
      console.log("ðŸ’¾ Saving changes...", formData);
      if (!auth.currentUser) {
        console.log("âŒ No authenticated user");
        return;
      }

      console.log("ðŸ” User ID:", auth.currentUser.uid);
      console.log("ðŸ” Document path: users/" + auth.currentUser.uid);
      
      // Check if profileImage is too large
      if (profileImage && profileImage.length > 1000000) { // ~1MB limit
        console.log("âš ï¸ Image too large, compressing...");
        alert("Image is being compressed to fit the size limit...");
      }
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        jerseyNumber: formData.jerseyNumber,
        position: formData.position,
        profileImage: profileImage,
        updatedAt: new Date(),
      };
      console.log("ðŸ” Update data:", updateData);

      await updateDoc(doc(db, "users", auth.currentUser.uid), updateData);

      console.log("âœ… Profile updated successfully");
      setUserData(prev => ({ ...prev, ...formData }));
      setEditing(false);
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("âŒ Error updating profile:", error);
      console.error("âŒ Error code:", error.code);
      console.error("âŒ Error message:", error.message);
      alert(`Error updating profile: ${error.message}`);
    }
  };

  const compressImage = (file, maxWidth = 300, maxHeight = 300, quality = 0.8) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageUpload = () => {
    console.log("ðŸ“¸ Add Photo button clicked");
    
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log("ðŸ“¸ File selected:", file.name, "Size:", file.size, "bytes");
        
        try {
          // Compress the image
          const compressedBase64 = await compressImage(file);
          console.log("ðŸ“¸ Image compressed successfully");
          
          setProfileImage(compressedBase64);
          console.log("ðŸ“¸ Image uploaded successfully");
          alert("Photo uploaded successfully!");
        } catch (error) {
          console.error("âŒ Error compressing image:", error);
          alert("Error processing image. Please try a different image.");
        }
      }
    };
    
    // Trigger file selection
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "AuthStack" }],
        })
      );
    } catch (error) {
      console.error("Error during logout:", error);
      alert("Logout failed.");
    }
  };

  if (Platform.OS === "web") {
    const isAdminOrCoachDesktop =
      isDesktop && (roleParam === "admin" || roleParam === "coach");

    const profileShell = (
      <div style={{
        width: "100%",
        maxWidth: isAdminOrCoachDesktop ? "100%" : "360px",
        margin: "0 auto",
        height: isAdminOrCoachDesktop ? "auto" : "812px",
        backgroundColor: "#0A0F1A",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        fontFamily: Platform.select({ web: "'Inter', sans-serif", default: "System" }),
        color: "white",
        pointerEvents: "auto"
      }}>
          {/* Background Gradient - Futuristic Dark â†’ Deep Navy â†’ Black */}
          <div style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            background: "linear-gradient(180deg, #040812 0%, #080F1F 55%, #04070E 100%), radial-gradient(circle at 20% -10%, rgba(43, 201, 255, 0.18) 0%, rgba(0, 0, 0, 0) 55%), radial-gradient(circle at 80% 110%, rgba(37, 141, 255, 0.18) 0%, rgba(0, 0, 0, 0) 60%)",
            zIndex: 0,
            pointerEvents: "none"
          }} />

          {/* Main Content */}
          <div style={{
            position: "relative",
            zIndex: 1,
            flex: 1,
            padding: "24px 20px",
            paddingTop: "32px",
            paddingBottom: "160px",
            overflowY: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
            <div className="stitch-profile-scroll" style={{ paddingBottom: "20px", width: "100%", maxWidth: "320px" }}>
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
                  Loading profile...
                </div>
              </div>
            ) : (
              <div>
                {/* Profile Picture Section */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "18px",
                  marginBottom: "28px"
                }}>
                  <div
                    onClick={() => {
                      // FIX 3: 5× tap on avatar reveals test notification button
                      const next = logoTapCount + 1;
                      setLogoTapCount(next);
                      if (next >= 5) { setShowTestButton(true); setLogoTapCount(0); }
                    }}
                    style={{
                    width: "120px",
                    height: "120px",
                    borderRadius: "50%",
                    border: "2px solid rgba(43, 201, 255, 0.65)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(145deg, rgba(43, 201, 255, 0.3), rgba(9, 30, 53, 0.95))",
                    boxShadow: "0 18px 40px rgba(0, 0, 0, 0.45), inset 0 0 18px rgba(43, 201, 255, 0.18)",
                    cursor: "default",
                  }}>
                    {profileImage ? (
                      <img 
                        src={profileImage} 
                        alt="Profile" 
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: "50%",
                          objectFit: "cover"
                        }}
                      />
                    ) : (
                      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="white"/>
                        <path d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z" fill="white"/>
                      </svg>
                    )}
                  </div>
                  <button
                    onClick={handleImageUpload}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "20px",
                    background: "rgba(37, 162, 255, 0.12)",
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                    border: "1px solid rgba(43, 201, 255, 0.35)",
                    color: accentBlue,
                      fontSize: "14px",
                      fontWeight: "600",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      pointerEvents: "auto",
                    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.35)",
                      letterSpacing: "0.3px"
                    }}
                    onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(37, 162, 255, 0.2)";
                    e.currentTarget.style.boxShadow = "0 12px 28px rgba(0, 0, 0, 0.45)";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(37, 162, 255, 0.12)";
                    e.currentTarget.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.35)";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    {profileImage ? "Change Photo" : "Add Photo"}
                  </button>
                </div>

                {/* User Information Form */}
            <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  background: formSurface,
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                  borderRadius: "20px",
                  padding: "24px",
                  boxShadow: "0 25px 45px rgba(0, 0, 0, 0.45)",
                  marginBottom: "28px"
                }}>
                  <div style={{
                    fontSize: "13px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#7E90AB",
                    marginBottom: "-4px"
                  }}>
                    Profile details
                  </div>
                  {/* First Name */}
                  <div>
                    <label style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "600",
                      marginBottom: "8px",
                      color: "#9AA3B2"
                    }}>
                      First Name
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      disabled={!editing}
                      style={{
                        width: "100%",
                        padding: "14px 18px",
                        borderRadius: "12px",
                        background: editing ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.04)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        border: editing ? `1px solid ${outlineColor}` : "1px solid rgba(255, 255, 255, 0.08)",
                        color: "#F7FBFF",
                        fontSize: "15px",
                        cursor: editing ? "text" : "default",
                        transition: "all 0.3s ease",
                        pointerEvents: "auto",
                        boxShadow: editing ? "0 12px 30px rgba(0, 0, 0, 0.35), inset 0 0 15px rgba(43, 201, 255, 0.08)" : "0 8px 18px rgba(0, 0, 0, 0.25)"
                      }}
                      placeholder="Enter your first name"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "600",
                      marginBottom: "8px",
                      color: "#9AA3B2"
                    }}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      disabled={!editing}
                      style={{
                        width: "100%",
                        padding: "14px 18px",
                        borderRadius: "12px",
                        background: editing ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.04)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        border: editing ? `1px solid ${outlineColor}` : "1px solid rgba(255, 255, 255, 0.08)",
                        color: "#F7FBFF",
                        fontSize: "15px",
                        cursor: editing ? "text" : "default",
                        transition: "all 0.3s ease",
                        pointerEvents: "auto",
                        boxShadow: editing ? "0 12px 30px rgba(0, 0, 0, 0.35), inset 0 0 15px rgba(43, 201, 255, 0.08)" : "0 8px 18px rgba(0, 0, 0, 0.25)"
                      }}
                      placeholder="Enter your last name"
                    />
                  </div>

                  {/* Jersey Number */}
                  <div>
                    <label style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "600",
                      marginBottom: "8px",
              color: "#9AA3B2"
            }}>
                      Jersey Number
                    </label>
                    <input
                      type="text"
                      value={formData.jerseyNumber}
                      onChange={(e) => handleInputChange('jerseyNumber', e.target.value)}
                      disabled={!editing}
                      style={{
                        width: "100%",
                        padding: "14px 18px",
                        borderRadius: "12px",
                        background: editing ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.04)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        border: editing ? `1px solid ${outlineColor}` : "1px solid rgba(255, 255, 255, 0.08)",
                        color: "#F7FBFF",
                        fontSize: "15px",
                        cursor: editing ? "text" : "default",
                        transition: "all 0.3s ease",
                        pointerEvents: "auto",
                        boxShadow: editing ? "0 12px 30px rgba(0, 0, 0, 0.35), inset 0 0 15px rgba(43, 201, 255, 0.08)" : "0 8px 18px rgba(0, 0, 0, 0.25)"
                      }}
                      placeholder="Enter jersey number"
                    />
                  </div>

                  {/* Position */}
                  <div>
                    <label style={{
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "600",
                      marginBottom: "8px",
                      color: "#9AA3B2"
                    }}>
                      Playing Position
                    </label>
                    <select
                      value={formData.position}
                      onChange={(e) => handleInputChange('position', e.target.value)}
                      disabled={!editing}
                      style={{
                        width: "100%",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        background: editing ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.02)",
                        border: editing ? `1px solid ${outlineColor}` : "1px solid rgba(255, 255, 255, 0.08)",
                        color: "#F7FBFF",
                        fontSize: "16px",
                        cursor: editing ? "pointer" : "not-allowed",
                        transition: "all 0.3s ease",
                        pointerEvents: "auto"
                      }}
                    >
                      <option value="">Select position</option>
                      <option value="Goalkeeper">Goalkeeper</option>
                      <option value="Defender">Defender</option>
                      <option value="Midfielder">Midfielder</option>
                      <option value="Forward">Forward</option>
                    </select>
                  </div>

                  {/* Phone (previously used for SMS opt-in) — fields kept in Firestore but no longer editable here */}
            </div>

                {/* FIX 3: Simplified Notifications Section */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  background: formSurface,
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                  borderRadius: "20px",
                  padding: "24px",
                  boxShadow: "0 25px 45px rgba(0, 0, 0, 0.45)",
                  marginBottom: "20px",
                }}>
                  <div style={{
                    fontSize: "13px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#7E90AB",
                    marginBottom: "4px",
                  }}>
                    Notifications
                  </div>

                  {/* Status row */}
                  {notifPermission === 'granted' ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#00FF9D", flexShrink: 0, display: "inline-block" }} />
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>Active</div>
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>You'll be alerted after each session</div>
                      </div>
                    </div>
                  ) : notifPermission === 'denied' ? (
                    <button
                      onClick={() => {
                        setNotifTestStatus('denied');
                      }}
                      style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFB800", flexShrink: 0, display: "inline-block" }} />
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#FFB800" }}>Blocked — Check Settings</div>
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Tap for platform-specific instructions</div>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        if (typeof Notification === 'undefined') return;
                        const result = await Notification.requestPermission();
                        setNotifPermission(result);
                        if (result === 'granted') {
                          try { await registerWebPushTokenForCurrentUser(); } catch (e) { console.warn('[NOTIF]', e); }
                        }
                      }}
                      style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF3B30", flexShrink: 0, display: "inline-block" }} />
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#FF3B30" }}>Inactive — Tap to enable</div>
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>You won't receive session alerts</div>
                      </div>
                    </button>
                  )}

                  {/* Platform instructions for blocked state */}
                  {notifTestStatus === 'denied' && (
                    <div style={{ fontSize: "12px", color: "#FFB347", lineHeight: 1.6, whiteSpace: "pre-line", marginTop: "4px" }}>
                      {typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent)
                        ? "Settings → Apps → Chrome → Notifications → champion-track-pro.vercel.app → Allow"
                        : typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
                          ? (typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone)
                              ? "Settings → Notifications → ChampionTrackPro → Allow"
                              : "Install the app first: Tap Share ↑ then 'Add to Home Screen'")
                          : "Check your browser or OS notification settings."}
                    </div>
                  )}

                  {/* Test button: coach/admin only, or via 5× logo tap */}
                  {(userData?.role === 'coach' || userData?.role === 'admin' || showTestButton) && (
                    <button
                      disabled={notifTestStatus === 'loading'}
                      onClick={async () => {
                        if (!auth.currentUser || !userData?.teamId) return;
                        setNotifTestStatus('loading');
                        try {
                          try { await initializeFCM(); } catch (e) { console.warn('[NOTIF] initializeFCM:', e); }
                          let result = await testNotificationFlow(auth.currentUser.uid, userData.teamId);
                          if (result.error === 'no_token') {
                            await registerWebPushTokenForCurrentUser();
                            result = await testNotificationFlow(auth.currentUser.uid, userData.teamId);
                          }
                          setNotifTestStatus(result.success ? 'success' : 'idle');
                          if (result.success) setTimeout(() => setNotifTestStatus('idle'), 4000);
                        } catch { setNotifTestStatus('idle'); }
                      }}
                      style={{
                        marginTop: "8px",
                        width: "100%",
                        padding: "10px 16px",
                        borderRadius: "10px",
                        background: "transparent",
                        border: "1px solid rgba(0,212,255,0.4)",
                        color: "#00D4FF",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: notifTestStatus === 'loading' ? 'default' : 'pointer',
                      }}
                    >
                      {notifTestStatus === 'loading' ? '⏳ Sending...' : '🔔 Send Test Notification'}
                    </button>
                  )}
                  {notifTestStatus === 'success' && (
                    <div style={{ fontSize: "13px", color: "#00FFC2" }}>✅ Test sent! Check your device.</div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{
                  marginTop: "30px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px"
                }}>
                  {!editing ? (
                    <>
                      <button
                        onClick={() => {
                          console.log("âœï¸ Edit button clicked");
                          console.log("ðŸ“Š Current userData:", userData);
                          console.log("ðŸ“ Current formData:", formData);
                          setEditing(true);
                        }}
                        style={{
                          width: "100%",
                          padding: "14px 20px",
                          borderRadius: "20px",
                        background: "linear-gradient(135deg, #29C9FF 0%, #4B73FF 100%)",
                        border: "1px solid rgba(41, 201, 255, 0.4)",
                        color: "#051021",
                          fontSize: "15px",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          pointerEvents: "auto",
                        boxShadow: "0 15px 30px rgba(0, 0, 0, 0.35)",
                          letterSpacing: "0.5px"
                        }}
                        onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.01)";
                        e.currentTarget.style.boxShadow = "0 18px 34px rgba(0, 0, 0, 0.4)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.boxShadow = "0 15px 30px rgba(0, 0, 0, 0.35)";
                        }}
                      >
                        Edit Profile
                      </button>

                      <button
                        onClick={handleLogout}
                        style={{
                          width: "100%",
                          padding: "14px 20px",
                          borderRadius: "20px",
                          background: "rgba(239, 68, 68, 0.08)",
                          backdropFilter: "blur(10px)",
                          WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid rgba(239, 68, 68, 0.35)",
                          color: "#F98A8A",
                          fontSize: "15px",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35)",
                          letterSpacing: "0.3px"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
                          e.currentTarget.style.boxShadow = "0 16px 32px rgba(0, 0, 0, 0.45)";
                          e.currentTarget.style.transform = "scale(1.02)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                          e.currentTarget.style.boxShadow = "0 12px 28px rgba(0, 0, 0, 0.35)";
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                      >
                        Se déconnecter
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{
                        display: "flex",
                        gap: "12px"
                      }}>
                        <button
                          onClick={handleSaveChanges}
                          style={{
                            flex: 1,
                            padding: "14px 20px",
                            borderRadius: "20px",
                          background: "linear-gradient(135deg, #29C9FF 0%, #4B73FF 100%)",
                          border: "1px solid rgba(41, 201, 255, 0.4)",
                          color: "#051021",
                            fontSize: "15px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                            pointerEvents: "auto",
                          boxShadow: "0 15px 30px rgba(0, 0, 0, 0.35)",
                            letterSpacing: "0.3px"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.02)";
                          e.currentTarget.style.boxShadow = "0 18px 34px rgba(0, 0, 0, 0.4)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.boxShadow = "0 15px 30px rgba(0, 0, 0, 0.35)";
                          }}
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => {
                            setEditing(false);
                            setFormData({
                              firstName: userData?.firstName || "",
                              lastName: userData?.lastName || "",
                              jerseyNumber: userData?.jerseyNumber || "",
                              position: userData?.position || "",
                              phoneE164: userData?.phoneE164 || "",
                              smsOptIn: !!userData?.smsOptIn,
                            });
                          }}
                          style={{
                            flex: 1,
                            padding: "14px 20px",
                            borderRadius: "20px",
                          background: "rgba(255, 255, 255, 0.05)",
                            backdropFilter: "blur(10px)",
                            WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          color: "#F4F7FB",
                            fontSize: "15px",
                            fontWeight: "600",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                            pointerEvents: "auto",
                            letterSpacing: "0.3px"
                          }}
                          onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                            e.currentTarget.style.transform = "scale(1.02)";
                          }}
                          onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          Cancel
                        </button>
                      </div>

                      <button
                        onClick={handleLogout}
                        style={{
                          width: "100%",
                          padding: "14px 20px",
                          borderRadius: "20px",
                          background: "rgba(239, 68, 68, 0.08)",
                          backdropFilter: "blur(10px)",
                          WebkitBackdropFilter: "blur(10px)",
                          border: "1px solid rgba(239, 68, 68, 0.35)",
                          color: "#F98A8A",
                          fontSize: "15px",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          boxShadow: "0 12px 28px rgba(0, 0, 0, 0.35)",
                          letterSpacing: "0.3px"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
                          e.currentTarget.style.boxShadow = "0 16px 32px rgba(0, 0, 0, 0.45)";
                          e.currentTarget.style.transform = "scale(1.02)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                          e.currentTarget.style.boxShadow = "0 12px 28px rgba(0, 0, 0, 0.35)";
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                      >
                        Se dÃ©connecter
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation unifiÃ©e pour les athlÃ¨tes */}
          <UnifiedAthleteNavigation 
            activeTab="Profile" 
            onNavigate={handleTabNavigation} 
          />
        </div>
      </div>
    );

    if (isAdminOrCoachDesktop) {
      return (
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "#0A0F1A",
            padding: "0 48px 40px",
          }}
        >
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>{profileShell}</div>
        </div>
      );
    }

    return <MobileViewport>{profileShell}</MobileViewport>;
  }

  return (
    <View style={nativeStyles.container}>
      {loading ? (
        <ActivityIndicator color="#00D4FF" style={{ marginTop: 32 }} />
      ) : (
        <ScrollView contentContainerStyle={nativeStyles.content} showsVerticalScrollIndicator={false}>
          <Text style={nativeStyles.header}>Profil</Text>
          <View style={nativeStyles.statsRow}>
            {profileStats.map((stat, index) => (
              <View
                key={stat.label}
                style={[
                  nativeStyles.statCard,
                  index === profileStats.length - 1 && { marginRight: 0 }
                ]}
              >
                <Text style={nativeStyles.statValue}>{stat.value}</Text>
                <Text style={nativeStyles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
          <View style={nativeStyles.card}>
            <Text style={nativeStyles.label}>Nom complet</Text>
            <Text style={nativeStyles.value}>
              {`${formData.firstName || ""} ${formData.lastName || ""}`.trim() || "Non renseignÃ©"}
            </Text>

            <Text style={nativeStyles.label}>NumÃ©ro de maillot</Text>
            <Text style={nativeStyles.value}>{formData.jerseyNumber || "Non renseignÃ©"}</Text>

            <Text style={nativeStyles.label}>Poste</Text>
            <Text style={nativeStyles.value}>{formData.position || "Non renseignÃ©"}</Text>
          </View>

          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              nativeStyles.logoutButton,
              pressed && nativeStyles.logoutButtonPressed,
            ]}
          >
            <Text style={nativeStyles.logoutText}>Se déconnecter</Text>
          </Pressable>
        </ScrollView>
      )}

      <UnifiedAthleteNavigation activeTab="Profile" onNavigate={handleTabNavigation} />
    </View>
  );
}

const nativeStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#040812",
  },
  content: {
    padding: 24,
    paddingBottom: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F4F7FF",
    marginBottom: 20,
    textAlign: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: "rgba(8, 14, 25, 0.92)",
    borderColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    width: '100%',
  },
  statCard: {
    padding: 16,
    backgroundColor: "rgba(11, 18, 31, 0.95)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    width: '100%',
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#E8FBFF",
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#7E90AB",
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 12,
    textAlign: 'center',
    width: '100%',
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F4F7FF",
    marginTop: 4,
    textAlign: 'center',
    width: '100%',
  },
  logoutButton: {
    width: "100%",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  logoutButtonPressed: {
    opacity: 0.8,
  },
  logoutText: {
    color: "#F98A8A",
    fontSize: 16,
    fontWeight: "600",
  },
});
