CREATE TABLE `bot_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`configJson` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `broker_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`brokerType` text NOT NULL,
	`displayName` text NOT NULL,
	`apiKey` text NOT NULL,
	`accountId` text NOT NULL,
	`isLive` integer DEFAULT false NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `paper_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`balance` text NOT NULL,
	`peakBalance` text NOT NULL,
	`isRunning` integer DEFAULT false NOT NULL,
	`isPaused` integer DEFAULT false NOT NULL,
	`startedAt` integer,
	`scanCount` integer DEFAULT 0 NOT NULL,
	`signalCount` integer DEFAULT 0 NOT NULL,
	`rejectedCount` integer DEFAULT 0 NOT NULL,
	`dailyPnlBase` text NOT NULL,
	`dailyPnlDate` text DEFAULT '' NOT NULL,
	`executionMode` text DEFAULT 'paper' NOT NULL,
	`killSwitchActive` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `paper_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`positionId` text NOT NULL,
	`symbol` text NOT NULL,
	`direction` text NOT NULL,
	`size` text NOT NULL,
	`entryPrice` text NOT NULL,
	`currentPrice` text NOT NULL,
	`stopLoss` text,
	`takeProfit` text,
	`openTime` text NOT NULL,
	`signalReason` text,
	`signalScore` text DEFAULT '0' NOT NULL,
	`orderId` text NOT NULL,
	`brokerTradeId` text,
	`positionStatus` text DEFAULT 'open' NOT NULL,
	`triggerPrice` text,
	`orderType` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `paper_trade_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`positionId` text NOT NULL,
	`symbol` text NOT NULL,
	`direction` text NOT NULL,
	`size` text NOT NULL,
	`entryPrice` text NOT NULL,
	`exitPrice` text NOT NULL,
	`pnl` text NOT NULL,
	`pnlPips` text NOT NULL,
	`openTime` text NOT NULL,
	`closedAt` text NOT NULL,
	`closeReason` text NOT NULL,
	`signalReason` text,
	`signalScore` text DEFAULT '0' NOT NULL,
	`orderId` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_post_mortems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`positionId` text NOT NULL,
	`tradeId` integer,
	`symbol` text NOT NULL,
	`exitReason` text NOT NULL,
	`whatWorked` text,
	`whatFailed` text,
	`lessonLearned` text,
	`exitPrice` text,
	`pnl` text,
	`detailJson` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trade_reasonings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`positionId` text NOT NULL,
	`tradeId` integer,
	`symbol` text NOT NULL,
	`direction` text NOT NULL,
	`confluenceScore` integer NOT NULL,
	`session` text,
	`timeframe` text,
	`bias` text,
	`factorsJson` text,
	`summary` text,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`symbol` text NOT NULL,
	`direction` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`entryPrice` text NOT NULL,
	`exitPrice` text,
	`stopLoss` text,
	`takeProfit` text,
	`positionSize` text,
	`riskReward` text,
	`riskPercent` text,
	`pnlPips` text,
	`pnlAmount` text,
	`timeframe` text,
	`followedStrategy` integer,
	`setupType` text,
	`notes` text,
	`deviations` text,
	`improvements` text,
	`entryTime` integer NOT NULL,
	`exitTime` integer,
	`screenshotUrl` text,
	`confluenceScore` integer,
	`reasoningJson` text,
	`postMortemJson` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`riskSettingsJson` text,
	`preferencesJson` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`lastSignedIn` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);