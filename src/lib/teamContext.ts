import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Firestore,
} from 'firebase/firestore';

/**
 * Resolve the teamId for the authenticated athlete.
 * 1. Read users/{uid}.teamId (primary source)
 * 2. Fallback: look for a membership document teams/{teamId}/members/{uid}
 */
export async function resolveAthleteTeamId(
  db: Firestore,
  uid: string | null | undefined
): Promise<string | null> {
  if (!uid) {
    return null;
  }

  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const teamId = userSnap.data()?.teamId;
      if (typeof teamId === 'string' && teamId.trim().length > 0) {
        return teamId.trim();
      }
    }
  } catch (error) {
    console.error('[TEAM][RESOLVE][USER]', error);
  }

  try {
    const membershipQuery = query(
      collectionGroup(db, 'members'),
      where('__name__', '==', uid)
    );
    const membershipSnap = await getDocs(membershipQuery);
    if (!membershipSnap.empty) {
      const memberRef = membershipSnap.docs[0].ref;
      const teamId = memberRef.parent.parent?.id ?? null;
      if (teamId) {
        return teamId;
      }
    }
  } catch (error) {
    console.error('[TEAM][RESOLVE][MEMBERSHIP]', error);
  }

  return null;
}


