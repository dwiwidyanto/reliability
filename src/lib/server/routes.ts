import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/connection';
import { users, analyses, sessions, analysisBaselines, auditLogs } from '../../db/schema';
import { eq, and, desc, asc, lt } from 'drizzle-orm';
import { hashPassword, verifyPassword } from './crypto';
import { lucia } from './auth';
import { randomUUID } from 'node:crypto';
import { logAuditEvent } from './audit';

// Zod schemas for input validation
const registerSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
	email: z.string().email('Invalid email address'),
	password: z.string()
});

const analysisSaveSchema = z.object({
	type: z.enum(['fmea', 'fishbone']),
	title: z.string().min(1, 'Title is required'),
	data: z.string().min(1, 'Data is required')
});

const signSchema = z.object({
	signatureName: z.string().min(1, 'Signature printed name is required')
});

const apiRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
	// 1. Health check
	fastify.get('/health', async (request, reply) => {
		return { success: true, data: { status: 'healthy', timestamp: new Date() } };
	});

	// 2. Auth: Register
	fastify.post('/auth/register', async (request, reply) => {
		try {
			const { email, password } = registerSchema.parse(request.body);
			
			const existingUser = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
			if (existingUser) {
				reply.code(400);
				return { success: false, error: 'Email already registered' };
			}

			const userId = randomUUID();
			const hashedPassword = hashPassword(password);

			db.insert(users).values({
				id: userId,
				email: email.toLowerCase(),
				hashedPassword
			}).run();

			const session = await lucia.createSession(userId, {});
			const sessionCookie = lucia.createSessionCookie(session.id);
			
			reply.header('Set-Cookie', sessionCookie.serialize());
			return { success: true, data: { user: { id: userId, email } } };
		} catch (err: any) {
			reply.code(err instanceof z.ZodError ? 400 : 500);
			return { success: false, error: err instanceof z.ZodError ? err.errors[0].message : err.message };
		}
	});

	// 3. Auth: Login
	fastify.post('/auth/login', async (request, reply) => {
		try {
			const { email, password } = loginSchema.parse(request.body);

			const user = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
			if (!user) {
				reply.code(400);
				return { success: false, error: 'Invalid email or password' };
			}

			const validPassword = verifyPassword(password, user.hashedPassword);
			if (!validPassword) {
				reply.code(400);
				return { success: false, error: 'Invalid email or password' };
			}

			const session = await lucia.createSession(user.id, {});
			const sessionCookie = lucia.createSessionCookie(session.id);

			reply.header('Set-Cookie', sessionCookie.serialize());
			return { success: true, data: { user: { id: user.id, email: user.email } } };
		} catch (err: any) {
			reply.code(err instanceof z.ZodError ? 400 : 500);
			return { success: false, error: err instanceof z.ZodError ? err.errors[0].message : err.message };
		}
	});

	// 4. Auth: Logout
	fastify.post('/auth/logout', async (request, reply) => {
		if (!request.session) {
			return { success: true };
		}

		await lucia.invalidateSession(request.session.id);
		const sessionCookie = lucia.createBlankSessionCookie();
		reply.header('Set-Cookie', sessionCookie.serialize());
		return { success: true };
	});

	// 5. Auth: Me
	fastify.get('/auth/me', async (request, reply) => {
		if (!request.user) {
			return { success: true, data: { user: null } };
		}
		return { success: true, data: { user: { id: request.user.id, email: request.user.email } } };
	});

	// --- Protected CRUD Helper ---
	const checkAuth = (request: any, reply: any) => {
		if (!request.user) {
			reply.code(401);
			throw new Error('Unauthorized');
		}
		return request.user.id;
	};

	// 6. Analyses: List (GET)
	fastify.get('/analyses', async (request, reply) => {
		try {
			const userId = checkAuth(request, reply);
			const list = db.select({
				id: analyses.id,
				type: analyses.type,
				title: analyses.title,
				status: analyses.status,
				lastReviewedAt: analyses.lastReviewedAt,
				nextReviewDueAt: analyses.nextReviewDueAt,
				createdAt: analyses.createdAt,
				updatedAt: analyses.updatedAt
			})
			.from(analyses)
			.where(eq(analyses.userId, userId))
			.orderBy(desc(analyses.updatedAt))
			.all();

			return { success: true, data: list };
		} catch (err: any) {
			if (err.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
			reply.code(500);
			return { success: false, error: err.message };
		}
	});

	// 7. Analyses: Save / Create (POST)
	fastify.post('/analyses', async (request, reply) => {
		try {
			const userId = checkAuth(request, reply);
			const { type, title, data } = analysisSaveSchema.parse(request.body);

			const analysisId = randomUUID();
			db.insert(analyses).values({
				id: analysisId,
				userId,
				type,
				title,
				data,
				status: 'draft',
				createdAt: new Date(),
				updatedAt: new Date()
			}).run();

			// Log creation
			await logAuditEvent(
				userId,
				request.user!.email,
				'create',
				analysisId,
				title,
				type
			);

			return { success: true, data: { id: analysisId, title, type } };
		} catch (err: any) {
			if (err.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
			reply.code(err instanceof z.ZodError ? 400 : 500);
			return { success: false, error: err instanceof z.ZodError ? err.errors[0].message : err.message };
		}
	});

	// 8. Analyses: Get details (GET)
	fastify.get('/analyses/:id', async (request, reply) => {
		try {
			const userId = checkAuth(request, reply);
			const { id } = request.params as { id: string };

			const record = db.select()
				.from(analyses)
				.where(and(eq(analyses.id, id), eq(analyses.userId, userId)))
				.get();

			if (!record) {
				reply.code(404);
				return { success: false, error: 'Analysis not found' };
			}

			return { success: true, data: record };
		} catch (err: any) {
			if (err.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
			reply.code(500);
			return { success: false, error: err.message };
		}
	});

	// 9. Analyses: Update (PUT)
	fastify.put('/analyses/:id', async (request, reply) => {
		try {
			const userId = checkAuth(request, reply);
			const { id } = request.params as { id: string };
			const { title, data } = z.object({
				title: z.string().min(1, 'Title is required'),
				data: z.string().min(1, 'Data is required')
			}).parse(request.body);

			const record = db.select()
				.from(analyses)
				.where(and(eq(analyses.id, id), eq(analyses.userId, userId)))
				.get();

			if (!record) {
				reply.code(404);
				return { success: false, error: 'Analysis not found' };
			}

			// If updated, status automatically reverts to draft
			const nextStatus = 'draft';

			db.update(analyses)
				.set({
					title,
					data,
					status: nextStatus,
					updatedAt: new Date()
				})
				.where(eq(analyses.id, id))
				.run();

			// Log changes
			await logAuditEvent(
				userId,
				request.user!.email,
				'update',
				id,
				title,
				record.type,
				{
					before: { title: record.title, data: record.data, status: record.status },
					after: { title, data, status: nextStatus }
				}
			);

			return { success: true, data: { id, title } };
		} catch (err: any) {
			if (err.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
			reply.code(err instanceof z.ZodError ? 400 : 500);
			return { success: false, error: err instanceof z.ZodError ? err.errors[0].message : err.message };
		}
	});

	// 10. Analyses: Delete (DELETE)
	fastify.delete('/analyses/:id', async (request, reply) => {
		try {
			const userId = checkAuth(request, reply);
			const { id } = request.params as { id: string };

			const record = db.select()
				.from(analyses)
				.where(and(eq(analyses.id, id), eq(analyses.userId, userId)))
				.get();

			if (!record) {
				reply.code(404);
				return { success: false, error: 'Analysis not found' };
			}

			// Log delete
			await logAuditEvent(
				userId,
				request.user!.email,
				'delete',
				id,
				record.title,
				record.type
			);

			db.delete(analyses)
				.where(eq(analyses.id, id))
				.run();

			return { success: true };
		} catch (err: any) {
			if (err.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
			reply.code(500);
			return { success: false, error: err.message };
		}
	});

	// 11. Analyses: Sign / Approve (POST)
	fastify.post('/analyses/:id/sign', async (request, reply) => {
		try {
			const userId = checkAuth(request, reply);
			const { id } = request.params as { id: string };
			const { signatureName } = signSchema.parse(request.body);

			const record = db.select()
				.from(analyses)
				.where(and(eq(analyses.id, id), eq(analyses.userId, userId)))
				.get();

			if (!record) {
				reply.code(404);
				return { success: false, error: 'Analysis not found' };
			}

			const now = new Date();
			const nextReview = new Date();
			nextReview.setMonth(nextReview.getMonth() + record.reviewIntervalMonths);

			// Update status, reviewed timestamp, and signature links
			db.update(analyses)
				.set({
					status: 'approved',
					lastReviewedAt: now,
					nextReviewDueAt: nextReview,
					signedBy: userId,
					signatureName,
					updatedAt: now
				})
				.where(eq(analyses.id, id))
				.run();

			// Calculate next baseline version number
			const existingBaselines = db.select()
				.from(analysisBaselines)
				.where(eq(analysisBaselines.analysisId, id))
				.all();
			const nextVersion = existingBaselines.length + 1;

			// Add to snapshots
			const baselineId = randomUUID();
			db.insert(analysisBaselines).values({
				id: baselineId,
				analysisId: id,
				version: nextVersion,
				title: record.title,
				data: record.data,
				signedBy: userId,
				signatureName,
				createdAt: now
			}).run();

			// Log sign event
			await logAuditEvent(
				userId,
				request.user!.email,
				'sign',
				id,
				record.title,
				record.type,
				{ version: nextVersion, signatureName }
			);

			return { success: true, data: { version: nextVersion, nextReviewDueAt: nextReview } };
		} catch (err: any) {
			if (err.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
			reply.code(err instanceof z.ZodError ? 400 : 500);
			return { success: false, error: err instanceof z.ZodError ? err.errors[0].message : err.message };
		}
	});

	// 12. Analyses: Review / Safety Check (POST)
	fastify.post('/analyses/:id/review', async (request, reply) => {
		try {
			const userId = checkAuth(request, reply);
			const { id } = request.params as { id: string };

			const record = db.select()
				.from(analyses)
				.where(and(eq(analyses.id, id), eq(analyses.userId, userId)))
				.get();

			if (!record) {
				reply.code(404);
				return { success: false, error: 'Analysis not found' };
			}

			const now = new Date();
			const nextReview = new Date();
			nextReview.setMonth(nextReview.getMonth() + record.reviewIntervalMonths);

			db.update(analyses)
				.set({
					lastReviewedAt: now,
					nextReviewDueAt: nextReview,
					updatedAt: now
				})
				.where(eq(analyses.id, id))
				.run();

			// Log audit review event
			await logAuditEvent(
				userId,
				request.user!.email,
				'review',
				id,
				record.title,
				record.type,
				{ nextReviewDueAt: nextReview }
			);

			return { success: true, data: { nextReviewDueAt: nextReview } };
		} catch (err: any) {
			if (err.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
			reply.code(500);
			return { success: false, error: err.message };
		}
	});

	// 13. Analyses: Get Baselines list (GET)
	fastify.get('/analyses/:id/baselines', async (request, reply) => {
		try {
			const userId = checkAuth(request, reply);
			const { id } = request.params as { id: string };

			const list = db.select({
				id: analysisBaselines.id,
				version: analysisBaselines.version,
				title: analysisBaselines.title,
				signatureName: analysisBaselines.signatureName,
				createdAt: analysisBaselines.createdAt
			})
			.from(analysisBaselines)
			.where(eq(analysisBaselines.analysisId, id))
			.orderBy(desc(analysisBaselines.version))
			.all();

			return { success: true, data: list };
		} catch (err: any) {
			if (err.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
			reply.code(500);
			return { success: false, error: err.message };
		}
	});

	// 14. Analyses: Get specific Baseline data (GET)
	fastify.get('/analyses/:id/baselines/:baselineId', async (request, reply) => {
		try {
			const userId = checkAuth(request, reply);
			const { id, baselineId } = request.params as { id: string; baselineId: string };

			const record = db.select()
				.from(analysisBaselines)
				.where(and(eq(analysisBaselines.id, baselineId), eq(analysisBaselines.analysisId, id)))
				.get();

			if (!record) {
				reply.code(404);
				return { success: false, error: 'Baseline snapshot not found' };
			}

			return { success: true, data: record };
		} catch (err: any) {
			if (err.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
			reply.code(500);
			return { success: false, error: err.message };
		}
	});

	// 15. Audit Logs: List (GET)
	fastify.get('/audit', async (request, reply) => {
		try {
			const userId = checkAuth(request, reply);
			const logs = db.select()
				.from(auditLogs)
				.where(eq(auditLogs.userId, userId))
				.orderBy(desc(auditLogs.createdAt))
				.limit(100)
				.all();

			return { success: true, data: logs };
		} catch (err: any) {
			if (err.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
			reply.code(500);
			return { success: false, error: err.message };
		}
	});

	// 16. Analytics Summary (GET)
	fastify.get('/analytics/summary', async (request, reply) => {
		try {
			const userId = checkAuth(request, reply);
			const query = request.query as { startDate?: string; endDate?: string };
			
			// Load all user's analyses
			let userAnalyses = db.select()
				.from(analyses)
				.where(eq(analyses.userId, userId))
				.all();

			// Filter by dates if provided
			if (query.startDate) {
				const start = new Date(query.startDate);
				userAnalyses = userAnalyses.filter(a => a.createdAt >= start);
			}
			if (query.endDate) {
				const end = new Date(query.endDate);
				userAnalyses = userAnalyses.filter(a => a.createdAt <= end);
			}

			// Compile totals
			const fmeaAnalyses = userAnalyses.filter(a => a.type === 'fmea');
			const fishboneAnalyses = userAnalyses.filter(a => a.type === 'fishbone');

			// 1. Monthly Document Trends (last 12 months)
			const monthlyCounts: Record<string, { fmea: number; fishbone: number }> = {};
			const monthList: string[] = [];
			
			for (let i = 11; i >= 0; i--) {
				const d = new Date();
				d.setMonth(d.getMonth() - i);
				const key = d.toISOString().substring(0, 7); // 'YYYY-MM'
				monthlyCounts[key] = { fmea: 0, fishbone: 0 };
				monthList.push(key);
			}

			userAnalyses.forEach(a => {
				const key = a.createdAt.toISOString().substring(0, 7);
				if (monthlyCounts[key]) {
					monthlyCounts[key][a.type]++;
				}
			});

			const docTrends = monthList.map(m => ({
				month: m,
				fmea: monthlyCounts[m].fmea,
				fishbone: monthlyCounts[m].fishbone
			}));

			// 2. Average RPN Trend over months
			const monthlyRpnSum: Record<string, { sum: number; count: number }> = {};
			monthList.forEach(m => {
				monthlyRpnSum[m] = { sum: 0, count: 0 };
			});

			fmeaAnalyses.forEach(f => {
				const monthKey = f.createdAt.toISOString().substring(0, 7);
				if (monthlyRpnSum[monthKey]) {
					try {
						const rows = JSON.parse(f.data);
						if (Array.isArray(rows)) {
							rows.forEach((r: any) => {
								const rpn = Number(r.rpn) || 0;
								monthlyRpnSum[monthKey].sum += rpn;
								monthlyRpnSum[monthKey].count++;
							});
						}
					} catch (e) {
						// Ignored bad JSON
					}
				}
			});

			const rpnTrends = monthList.map(m => {
				const item = monthlyRpnSum[m];
				return {
					month: m,
					avgRpn: item.count > 0 ? Math.round(item.sum / item.count) : 0
				};
			});

			// 3. Top 10 Failure Modes by Criticality (Severity x Occurrence)
			const allFailureModes: { item: string; mode: string; s: number; o: number; rpn: number; title: string }[] = [];
			fmeaAnalyses.forEach(f => {
				try {
					const rows = JSON.parse(f.data);
					if (Array.isArray(rows)) {
						rows.forEach((r: any) => {
							allFailureModes.push({
								item: r.item || 'Unknown',
								mode: r.failureMode || 'Unknown',
								s: Number(r.severity) || 0,
								o: Number(r.occurrence) || 0,
								rpn: Number(r.rpn) || 0,
								title: f.title
							});
						});
					}
				} catch (e) {}
			});

			const topFailureModes = allFailureModes
				.sort((a, b) => (b.s * b.o) - (a.s * a.o))
				.slice(0, 10);

			// 4. Category distribution in Fishbone (6M+1 counts)
			const fishboneCategoriesSum = {
				man: 0,
				machine: 0,
				method: 0,
				material: 0,
				measurement: 0,
				motherNature: 0,
				management: 0
			};

			fishboneAnalyses.forEach(fb => {
				try {
					const parsed = JSON.parse(fb.data);
					const cats = parsed.categories;
					if (cats) {
						Object.keys(fishboneCategoriesSum).forEach(k => {
							const key = k as keyof typeof fishboneCategoriesSum;
							if (Array.isArray(cats[key])) {
								fishboneCategoriesSum[key] += cats[key].length;
							}
						});
					}
				} catch (e) {}
			});

			// 5. Compliance Metrics
			const totalDocsCount = userAnalyses.length;
			const approvedDocs = userAnalyses.filter(a => a.status === 'approved');
			const approvedCount = approvedDocs.length;
			const draftCount = totalDocsCount - approvedCount;

			const now = new Date();
			const overdueCount = userAnalyses.filter(a => 
				a.status !== 'approved' || 
				(a.nextReviewDueAt && a.nextReviewDueAt < now)
			).length;

			const complianceRate = totalDocsCount > 0 
				? Math.round(((totalDocsCount - overdueCount) / totalDocsCount) * 100) 
				: 100;

			return {
				success: true,
				data: {
					summary: {
						totalAnalyses: totalDocsCount,
						approvedCount,
						draftCount,
						overdueCount,
						complianceRate
					},
					docTrends,
					rpnTrends,
					topFailureModes,
					fishboneCategories: [
						{ category: 'Personnel (Man)', count: fishboneCategoriesSum.man },
						{ category: 'Equipment (Machine)', count: fishboneCategoriesSum.machine },
						{ category: 'Procedures (Method)', count: fishboneCategoriesSum.method },
						{ category: 'Parts (Material)', count: fishboneCategoriesSum.material },
						{ category: 'Telemetry (Measurement)', count: fishboneCategoriesSum.measurement },
						{ category: 'Environment (Nature)', count: fishboneCategoriesSum.motherNature },
						{ category: 'Organization (Mgmt)', count: fishboneCategoriesSum.management }
					]
				}
			};
		} catch (err: any) {
			if (err.message === 'Unauthorized') return { success: false, error: 'Unauthorized' };
			reply.code(500);
			return { success: false, error: err.message };
		}
	});
};

export default apiRoutes;
