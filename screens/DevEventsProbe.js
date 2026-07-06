import React, { useState, useEffect } from 'react';
import { auth, db } from '../services/firebaseConfig';
import { collection, getDocs, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
// Removed date-fns import to avoid dependency issues
import MobileViewport from '../src/components/MobileViewport';

// Fonctions de date personnalisées pour remplacer date-fns
const startOfWeek = (date, options = { weekStartsOn: 0 }) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - (options.weekStartsOn || 0);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfWeek = (date, options = { weekStartsOn: 0 }) => {
  const d = startOfWeek(date, options);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
};

export default function DevEventsProbe() {
  const [teamId, setTeamId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [probeResults, setProbeResults] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        if (!auth.currentUser) {
          console.log("No authenticated user");
          return;
        }

        const userDoc = await getDocs(collection(db, "users"));
        const userData = userDoc.docs[0]?.data();
        const teamId = userData?.teamId;
        const userId = auth.currentUser.uid;

        if (!teamId) {
          console.log("No team ID found for user");
          return;
        }

        setTeamId(teamId);
        setUserId(userId);
        console.log("📅 User data loaded:", { teamId, userId });

      } catch (error) {
        console.error("❌ Error loading user data:", error);
      }
    };

    loadUserData();
  }, []);

  const runProbe = async () => {
    if (!teamId || !userId) {
      alert("TeamId or UserId not available");
      return;
    }

    setLoading(true);
    const results = {};

    try {
      // PROBE A: Events count and sample
      console.log('[PROBE] Starting Firestore probe...');
      const eventsCollection = collection(db, 'teams', teamId, 'events');
      const snap = await getDocs(eventsCollection);
      
      console.log('[PROBE] events count =', snap.size);
      results.eventsCount = snap.size;
      
      const sampleEvents = snap.docs.slice(0, 3).map(doc => {
        const data = doc.data();
        console.log('[PROBE] sample', doc.id, data);
        return {
          id: doc.id,
          summary: data.summary,
          startUTC: data.startUTC,
          endUTC: data.endUTC,
          timeZone: data.timeZone,
          uid: data.uid,
          teamId: data.teamId
        };
      });
      results.sampleEvents = sampleEvents;

      // PROBE B: Next session query
      console.log('[NEXT] Testing next session query...');
      const nowUTC = Date.now();
      console.log('[NEXT] nowUTC =', nowUTC);
      
      const nextQuery = query(
        eventsCollection,
        where('startUTC', '>=', nowUTC),
        orderBy('startUTC', 'asc'),
        limit(1)
      );
      
      const nextSnap = await getDocs(nextQuery);
      if (nextSnap.empty) {
        console.log('[NEXT] No upcoming events found');
        results.nextSession = null;
      } else {
        const nextEvent = nextSnap.docs[0].data();
        console.log('[NEXT] next event:', nextEvent);
        results.nextSession = {
          summary: nextEvent.summary,
          startUTC: nextEvent.startUTC,
          timeZone: nextEvent.timeZone
        };
      }

      // PROBE C: Week query
      console.log('[WEEK] Testing week query...');
      const teamTz = 'Europe/Paris'; // Default timezone
      const localStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const localEnd = endOfWeek(localStart, { weekStartsOn: 1 });
      
      // Convert to UTC milliseconds
      const weekStartUTC = localStart.getTime();
      const weekEndUTC = localEnd.getTime();
      
      console.log('[WEEK] tz=', teamTz, 'startUTC=', weekStartUTC, 'endUTC=', weekEndUTC);
      
      const weekQuery = query(
        eventsCollection,
        where('startUTC', '>=', weekStartUTC),
        where('startUTC', '<', weekEndUTC),
        orderBy('startUTC', 'asc')
      );
      
      const weekSnap = await getDocs(weekQuery);
      const weekEvents = weekSnap.docs.map(doc => {
        const data = doc.data();
        return {
          summary: data.summary,
          startUTC: data.startUTC,
          timeZone: data.timeZone
        };
      });
      
      console.log('[WEEK] events =', weekEvents);
      results.weekEvents = weekEvents;

      setProbeResults(results);

    } catch (error) {
      console.error('[PROBE] Error:', error);
      results.error = error.message;
      setProbeResults(results);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileViewport>
      <div style={{
        padding: "20px",
        backgroundColor: "#0E1528",
        minHeight: "100vh",
        color: "#FFFFFF"
      }}>
        <h1 style={{ 
          fontSize: "24px", 
          fontWeight: "bold", 
          marginBottom: "20px",
          color: "#4A67FF"
        }}>
          🔍 Dev Events Probe
        </h1>

        <div style={{ marginBottom: "20px" }}>
          <p><strong>TeamId:</strong> {teamId || "Loading..."}</p>
          <p><strong>UserId:</strong> {userId || "Loading..."}</p>
        </div>

        <button
          onClick={runProbe}
          disabled={loading || !teamId}
          style={{
            padding: "12px 24px",
            backgroundColor: teamId ? "#4A67FF" : "#666",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: teamId ? "pointer" : "not-allowed",
            marginBottom: "20px"
          }}
        >
          {loading ? "Running Probe..." : "Run Firestore Probe"}
        </button>

        {Object.keys(probeResults).length > 0 && (
          <div style={{
            backgroundColor: "#1F2937",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #374151"
          }}>
            <h2 style={{ fontSize: "18px", marginBottom: "15px", color: "#4A67FF" }}>
              📊 Probe Results
            </h2>

            <div style={{ marginBottom: "15px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Events Count</h3>
              <p style={{ color: "#9AA3B2" }}>
                {probeResults.eventsCount} events found
              </p>
            </div>

            {probeResults.sampleEvents && (
              <div style={{ marginBottom: "15px" }}>
                <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Sample Events</h3>
                {probeResults.sampleEvents.map((event, index) => (
                  <div key={index} style={{
                    backgroundColor: "#374151",
                    padding: "10px",
                    borderRadius: "6px",
                    marginBottom: "8px",
                    fontSize: "12px"
                  }}>
                    <p><strong>ID:</strong> {event.id}</p>
                    <p><strong>Summary:</strong> {event.summary}</p>
                    <p><strong>startUTC:</strong> {event.startUTC} ({event.startUTC ? event.startUTC.toString().length : 0} digits)</p>
                    <p><strong>endUTC:</strong> {event.endUTC}</p>
                    <p><strong>timeZone:</strong> {event.timeZone}</p>
                    <p><strong>uid:</strong> {event.uid}</p>
                    <p><strong>teamId:</strong> {event.teamId}</p>
                  </div>
                ))}
              </div>
            )}

            {probeResults.nextSession && (
              <div style={{ marginBottom: "15px" }}>
                <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Next Session</h3>
                <div style={{
                  backgroundColor: "#374151",
                  padding: "10px",
                  borderRadius: "6px",
                  fontSize: "12px"
                }}>
                  <p><strong>Summary:</strong> {probeResults.nextSession.summary}</p>
                  <p><strong>startUTC:</strong> {probeResults.nextSession.startUTC}</p>
                  <p><strong>timeZone:</strong> {probeResults.nextSession.timeZone}</p>
                </div>
              </div>
            )}

            {probeResults.weekEvents && (
              <div style={{ marginBottom: "15px" }}>
                <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>Week Events</h3>
                {probeResults.weekEvents.length > 0 ? (
                  probeResults.weekEvents.map((event, index) => (
                    <div key={index} style={{
                      backgroundColor: "#374151",
                      padding: "8px",
                      borderRadius: "6px",
                      marginBottom: "6px",
                      fontSize: "12px"
                    }}>
                      <p><strong>{event.summary}</strong> @ {event.startUTC} ({event.timeZone})</p>
                    </div>
                  ))
                ) : (
                  <p style={{ color: "#9AA3B2" }}>No events found for this week</p>
                )}
              </div>
            )}

            {probeResults.error && (
              <div style={{
                backgroundColor: "#7F1D1D",
                padding: "10px",
                borderRadius: "6px",
                color: "#FCA5A5"
              }}>
                <p><strong>Error:</strong> {probeResults.error}</p>
              </div>
            )}
          </div>
        )}

        <div style={{
          marginTop: "20px",
          padding: "15px",
          backgroundColor: "#1F2937",
          borderRadius: "8px",
          border: "1px solid #374151"
        }}>
          <h3 style={{ fontSize: "14px", marginBottom: "10px", color: "#4A67FF" }}>
            🔍 Diagnostic Checklist
          </h3>
          <ul style={{ fontSize: "12px", color: "#9AA3B2", margin: 0, paddingLeft: "20px" }}>
            <li>Events count should be &gt; 0</li>
            <li>startUTC should be 13 digits (milliseconds)</li>
            <li>timeZone should be "Europe/Paris" or similar</li>
            <li>Next session should show upcoming event</li>
            <li>Week events should match current week</li>
          </ul>
        </div>
      </div>
    </MobileViewport>
  );
}
