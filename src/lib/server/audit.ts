import { db } from '../../db/connection';
import { auditLogs } from '../../db/schema';
import { lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

/**
 * Inserts an audit event into the immutable audit_logs database table.
 */
export async function logAuditEvent(
	userId: string | null,
	userEmail: string,
	action: 'create' | 'update' | 'delete' | 'sign' | 'review',
	analysisId: string | null,
	analysisTitle: string | null,
	analysisType: 'fmea' | 'fishbone' | null,
	changes: Record<string, any> | null = null
) {
	try {
		db.insert(auditLogs).values({
			id: randomUUID(),
			userId,
			userEmail,
			action,
			analysisId,
			analysisTitle,
			analysisType,
			changes: changes ? JSON.stringify(changes) : null,
			createdAt: new Date()
		}).run();
		console.log(`[AUDIT] Action: ${action} on analysis: ${analysisTitle} logged.`);
	} catch (e) {
		console.error('Failed to log audit event:', e);
	}
}

/**
 * Retention policy: drops audit logs older than 24 months.
 */
export function pruneOldAuditLogs() {
	try {
		const cutoff = new Date();
		cutoff.setMonth(cutoff.getMonth() - 24);
		console.log(`[AUDIT] Checking retention limit (24 months). Cutoff date: ${cutoff.toLocaleDateString()}`);
		const result = db.delete(auditLogs).where(lt(auditLogs.createdAt, cutoff)).run();
		if (result.changes > 0) {
			console.log(`[AUDIT] Pruned ${result.changes} expired audit trail entries.`);
		} else {
			console.log(`[AUDIT] No expired audit trail entries found.`);
		}
	} catch (e) {
		console.error('Failed to prune audit logs:', e);
	}
}
