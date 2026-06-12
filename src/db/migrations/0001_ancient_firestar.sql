CREATE TABLE `analysis_baselines` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`data` text NOT NULL,
	`signed_by` text,
	`signature_name` text,
	`created_at` integer,
	FOREIGN KEY (`analysis_id`) REFERENCES `analyses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`signed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`user_email` text NOT NULL,
	`action` text NOT NULL,
	`analysis_id` text,
	`analysis_title` text,
	`analysis_type` text,
	`changes` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `analyses` ADD `status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `analyses` ADD `review_interval_months` integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE `analyses` ADD `last_reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `analyses` ADD `next_review_due_at` integer;--> statement-breakpoint
ALTER TABLE `analyses` ADD `signed_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `analyses` ADD `signature_name` text;