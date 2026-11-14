import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email: email || `${uid}@user.local`,
        displayName: displayName || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: email || `${uid}@user.local`,
          ...(displayName ? { displayName } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Failed to get or create user record:', error);
    throw new Error('Unable to sync user profile.', { cause: error });
  }
}
