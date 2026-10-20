CREATE TABLE `todos` (
	`pk` integer PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`title` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`estimate` integer,
	`due_date` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "id_is_uuid" CHECK(typeof("id") = 'text' AND "id" GLOB '????????-????-4???-[89ab]???-????????????' AND NOT "id" GLOB '*[^0-9a-f-]*'),
	CONSTRAINT "title_is_text" CHECK(typeof("title") = 'text'),
	CONSTRAINT "title_is_trimmed" CHECK("title" = trim("title", char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))),
	CONSTRAINT "title_not_blank" CHECK(length("title") > 0),
	CONSTRAINT "title_max_length" CHECK(length("title") <= 200),
	CONSTRAINT "done_is_boolean" CHECK("done" IN (0, 1)),
	CONSTRAINT "priority_is_in_enum" CHECK("priority" IN ('low', 'medium', 'high')),
	CONSTRAINT "estimate_is_integer" CHECK("estimate" IS NULL OR (typeof("estimate") = 'integer' AND "estimate" BETWEEN -9007199254740991 AND 9007199254740991)),
	CONSTRAINT "estimate_at_least" CHECK("estimate" IS NULL OR ("estimate" >= 1)),
	CONSTRAINT "due_date_is_date" CHECK("due_date" IS NULL OR (date("due_date") IS "due_date")),
	CONSTRAINT "created_at_is_timestamp" CHECK(strftime('%Y-%m-%dT%H:%M:%fZ', "created_at") IS "created_at"),
	CONSTRAINT "updated_at_is_timestamp" CHECK(strftime('%Y-%m-%dT%H:%M:%fZ', "updated_at") IS "updated_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `todos_id_unique` ON `todos` (`id`);