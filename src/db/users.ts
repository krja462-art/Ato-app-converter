import { db } from './index.ts';
import { users } from './schema.ts';

interface FallbackUserRecord {
  id: number;
  uid: string;
  email: string;
  displayName: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
  createdAt: Date;
}

const memoryUsers = new Map<string, FallbackUserRecord>();

export function isCloudSqlConfigured(): boolean {
  return Boolean(process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME);
}

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  if (!isCloudSqlConfigured()) {
    const existing = memoryUsers.get(uid);
    if (existing) {
      existing.email = email;
      if (displayName) existing.displayName = displayName;
      return existing;
    }
    const created: FallbackUserRecord = {
      id: memoryUsers.size + 1,
      uid,
      email,
      displayName: displayName || email.split('@')[0] || 'Developer',
      githubOwner: process.env.GITHUB_OWNER || 'medianforge-org',
      githubRepo: process.env.GITHUB_REPO || 'android-webview-builder',
      createdAt: new Date(),
    };
    memoryUsers.set(uid, created);
    return created;
  }

  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || email.split('@')[0] || 'Developer',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(displayName ? { displayName } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}
