CREATE TABLE `broker_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brokerType` enum('oanda','metaapi') NOT NULL,
	`displayName` varchar(128) NOT NULL,
	`apiKey` text NOT NULL,
	`accountId` varchar(128) NOT NULL,
	`isLive` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `broker_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `trades` ADD `screenshotUrl` text;