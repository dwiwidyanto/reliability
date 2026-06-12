import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import middie from '@fastify/middie';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { lucia } from './auth';
import apiRoutes from './routes';
import { runMigrations } from '../../db/migrate';
import { pruneOldAuditLogs } from './audit';

// Run migrations and prune old logs on startup
try {
	runMigrations();
	pruneOldAuditLogs();
} catch (e) {
	console.error('Failed to run startup database operations, proceeding anyway...', e);
}

const fastify = Fastify({
	logger: {
		level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
	}
});

// Register cookies parser
fastify.register(cookie);

// Declare Lucia session properties on the FastifyRequest object type
declare module 'fastify' {
	interface FastifyRequest {
		user: import('lucia').User | null;
		session: import('lucia').Session | null;
	}
}

// Hook to check Lucia Auth session on every request
fastify.addHook('preHandler', async (request, reply) => {
	const sessionId = request.cookies[lucia.sessionCookieName];
	if (!sessionId) {
		request.user = null;
		request.session = null;
		return;
	}

	try {
		const { session, user } = await lucia.validateSession(sessionId);
		if (session && session.fresh) {
			const sessionCookie = lucia.createSessionCookie(session.id);
			reply.header('Set-Cookie', sessionCookie.serialize());
		}
		if (!session) {
			const sessionCookie = lucia.createBlankSessionCookie();
			reply.header('Set-Cookie', sessionCookie.serialize());
		}
		request.user = user;
		request.session = session;
	} catch (e) {
		fastify.log.error(e, 'Error validating session');
		request.user = null;
		request.session = null;
	}
});

// Register API routes
fastify.register(apiRoutes, { prefix: '/api/v1' });

// Register SvelteKit handler in production
const start = async () => {
	const buildPath = path.resolve(process.cwd(), 'build', 'handler.js');
	
	if (fs.existsSync(buildPath)) {
		fastify.log.info('Production SvelteKit build found. Integrating frontend middleware...');
		try {
			await fastify.register(middie);
			const handlerUrl = pathToFileURL(buildPath).href;
			const { handler } = await import(handlerUrl);
			fastify.use(handler);
			fastify.log.info('SvelteKit middleware registered successfully.');
		} catch (err) {
			fastify.log.error(err, 'Failed to load SvelteKit production handler');
		}
	} else {
		fastify.log.info('No production SvelteKit build found. Running in API-only dev mode.');
	}

	const port = parseInt(process.env.PORT || '3000', 10);
	const host = process.env.HOST || '0.0.0.0';

	try {
		await fastify.listen({ port, host });
		console.log(`Server is running at http://${host}:${port}`);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();
