CREATE TABLE `bot_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`configJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bot_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trade_post_mortems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`positionId` varchar(64) NOT NULL,
	`tradeId` int,
	`symbol` varchar(32) NOT NULL,
	`exitReason` varchar(64) NOT NULL,
	`whatWorked` text,
	`whatFailed` text,
	`lessonLearned` text,
	`exitPrice` decimal(18,8),
	`pnl` decimal(18,2),
	`detailJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trade_post_mortems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trade_reasonings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`positionId` varchar(64) NOT NULL,
	`tradeId` int,
	`symbol` varchar(32) NOT NULL,
	`direction` enum('long','short') NOT NULL,
	`confluenceScore` int NOT NULL,
	`session` varchar(32),
	`timeframe` varchar(10),
	`bias` varchar(16),
	`factorsJson` json,
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trade_reasonings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`riskSettingsJson` json,
	`preferencesJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `trades` ADD `confluenceScore` int;--> statement-breakpoint
ALTER TABLE `trades` ADD `reasoningJson` json;--> statement-breakpoint
ALTER TABLE `trades` ADD `postMortemJson` json;