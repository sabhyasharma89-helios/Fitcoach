import { FitDB, SCHEMA_VERSION, TABLES } from './db';

export interface BackupFile {
  app: 'FitOS';
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

export async function exportBackup(database: FitDB): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await database.table(t).toArray();
  return { app: 'FitOS', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), tables };
}

export function validateBackup(data: unknown): asserts data is BackupFile {
  const d = data as BackupFile;
  if (!d || d.app !== 'FitOS' || typeof d.schemaVersion !== 'number' || typeof d.tables !== 'object') {
    throw new Error('This is not a FitOS backup file.');
  }
  if (d.schemaVersion > SCHEMA_VERSION) {
    throw new Error('This backup was made by a newer FitOS. Update the app first.');
  }
}

/** Replace all data with the backup (atomic: on any error nothing changes). */
export async function importBackup(database: FitDB, data: unknown): Promise<void> {
  validateBackup(data);
  await database.transaction('rw', TABLES.map((t) => database.table(t)), async () => {
    for (const t of TABLES) {
      await database.table(t).clear();
      const rows = data.tables[t];
      if (Array.isArray(rows) && rows.length) await database.table(t).bulkPut(rows);
    }
  });
}

export const BACKUP_REMINDER_DAYS = 14;

export function backupDue(lastBackupAt: number | null, now = Date.now()): boolean {
  if (lastBackupAt == null) return true;
  return now - lastBackupAt >= BACKUP_REMINDER_DAYS * 86400_000;
}
