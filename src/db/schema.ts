import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	hashedPassword: text('hashed_password').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

export const analyses = sqliteTable('analyses', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	type: text('type').$type<'fmea' | 'fishbone'>().notNull(),
	title: text('title').notNull(),
	data: text('data').notNull(), // JSON string representing the analysis contents
	status: text('status').$type<'draft' | 'approved'>().notNull().default('draft'),
	reviewIntervalMonths: integer('review_interval_months').notNull().default(12),
	lastReviewedAt: integer('last_reviewed_at', { mode: 'timestamp' }),
	nextReviewDueAt: integer('next_review_due_at', { mode: 'timestamp' }),
	signedBy: text('signed_by').references(() => users.id, { onDelete: 'set null' }),
	signatureName: text('signature_name'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

export const analysisBaselines = sqliteTable('analysis_baselines', {
	id: text('id').primaryKey(),
	analysisId: text('analysis_id')
		.notNull()
		.references(() => analyses.id, { onDelete: 'cascade' }),
	version: integer('version').notNull(),
	title: text('title').notNull(),
	data: text('data').notNull(), // JSON string snapshot of FMEA rows / Fishbone categories
	signedBy: text('signed_by').references(() => users.id, { onDelete: 'set null' }),
	signatureName: text('signature_name'),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});

export const auditLogs = sqliteTable('audit_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
	userEmail: text('user_email').notNull(),
	action: text('action').$type<'create' | 'update' | 'delete' | 'sign' | 'review'>().notNull(),
	analysisId: text('analysis_id'),
	analysisTitle: text('analysis_title'),
	analysisType: text('analysis_type').$type<'fmea' | 'fishbone'>(),
	changes: text('changes'), // JSON string detailing updates
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
});
