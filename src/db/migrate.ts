import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './connection';
import path from 'path';
import fs from 'fs';

export function runMigrations() {
	try {
		console.log('Checking database migrations...');
		const migrationsFolder = path.resolve(process.cwd(), 'src/db/migrations');
		
		// If migrations directory doesn't exist, we'll log a warning.
		// Drizzle-kit generate creates this folder.
		if (!fs.existsSync(migrationsFolder)) {
			console.warn(`Migrations folder not found at ${migrationsFolder}. Database schema sync will be handled by Drizzle.`);
			return;
		}

		migrate(db, { migrationsFolder });
		console.log('Database migrations completed successfully.');
	} catch (error) {
		console.error('Error running migrations:', error);
		throw error;
	}
}
