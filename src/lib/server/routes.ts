import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/connection';
import { users, analyses, sessions } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { hashPassword, verifyPassword } from './crypto';
import { lucia } from './auth';
import { randomUUID } from 'node:crypto';

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

const apiRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
	// 1. Health check
	fastify.get('/health', async (request, reply) => {
		return { success: true, data: { status: 'healthy', timestamp: new Date() } };
	});

	// 2. Auth: Register
	fastify.post('/auth/register', async (request, reply) => {
		try {
			const { email, password } = registerSchema.parse(request.body);
			
			// Check if email already exists
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

			// Create a session
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

	// 5. Auth: Me (Get user details)
	fastify.get('/auth/me', async (request, reply) => {
		if (!request.user) {
			return { success: true, data: { user: null } };
		}
		return { success: true, data: { user: { id: request.user.id, email: request.user.email } } };
	});

	// --- Protected CRUD Routes Helper ---
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
				createdAt: new Date(),
				updatedAt: new Date()
			}).run();

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

			db.update(analyses)
				.set({
					title,
					data,
					updatedAt: new Date()
				})
				.where(eq(analyses.id, id))
				.run();

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
};

export default apiRoutes;
