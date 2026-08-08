-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: skill
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `access_token_denylist`
--

DROP TABLE IF EXISTS `access_token_denylist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `access_token_denylist` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `jti` varchar(128) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_access_token_denylist_jti` (`jti`),
  KEY `idx_access_token_denylist_expires_at` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `access_token_denylist`
--

LOCK TABLES `access_token_denylist` WRITE;
/*!40000 ALTER TABLE `access_token_denylist` DISABLE KEYS */;
INSERT INTO `access_token_denylist` VALUES (17,'15f2a95e-8fda-408d-99a3-e73e5b691e57','2026-08-06 03:57:22','2026-08-06 04:12:17'),(18,'9039470a-a699-47ee-a803-a302df5b0fc3','2026-08-06 10:26:08','2026-08-06 10:34:34');
/*!40000 ALTER TABLE `access_token_denylist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_notif_preferences`
--

DROP TABLE IF EXISTS `admin_notif_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_notif_preferences` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `pref_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pref_value` tinyint(1) NOT NULL DEFAULT '1',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pref_key` (`pref_key`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_notif_preferences`
--

LOCK TABLES `admin_notif_preferences` WRITE;
/*!40000 ALTER TABLE `admin_notif_preferences` DISABLE KEYS */;
INSERT INTO `admin_notif_preferences` VALUES (1,'new_user_signups',1,'2026-07-10 12:53:09'),(2,'reports_filed',1,'2026-07-10 12:53:09'),(3,'failed_payments',1,'2026-07-10 12:53:09'),(4,'mentor_verifications',1,'2026-07-10 12:53:09'),(5,'daily_summary',0,'2026-07-10 12:53:09'),(6,'new_bookings',1,'2026-07-10 12:53:09');
/*!40000 ALTER TABLE `admin_notif_preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `admin_settings`
--

DROP TABLE IF EXISTS `admin_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_settings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_settings`
--

LOCK TABLES `admin_settings` WRITE;
/*!40000 ALTER TABLE `admin_settings` DISABLE KEYS */;
INSERT INTO `admin_settings` VALUES (1,'platform_fee_percent','10','2026-07-10 12:53:06'),(2,'min_withdrawal_amount','10','2026-07-10 12:53:06'),(3,'max_session_participants','10','2026-07-10 12:53:06'),(4,'maintenance_mode','false','2026-07-10 12:53:06'),(5,'new_registrations_enabled','true','2026-07-10 12:53:06'),(6,'mentor_verification_required','true','2026-07-10 12:53:06'),(7,'report_schedule_frequency','none','2026-07-10 12:53:06');
/*!40000 ALTER TABLE `admin_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `app_notifications`
--

DROP TABLE IF EXISTS `app_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `app_notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `reference_id` bigint DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `broadcast_id` bigint DEFAULT NULL,
  `priority` varchar(20) NOT NULL DEFAULT 'MEDIUM',
  `read_at` datetime(6) DEFAULT NULL,
  `clicked_at` datetime(6) DEFAULT NULL,
  `dismissed_at` datetime(6) DEFAULT NULL,
  `expires_at` datetime(6) DEFAULT NULL,
  `action_url` varchar(1000) DEFAULT NULL,
  `action_button_text` varchar(100) DEFAULT NULL,
  `delivery_status` varchar(20) NOT NULL DEFAULT 'DELIVERED',
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_read` (`user_id`,`is_read`),
  KEY `idx_notifications_broadcast` (`broadcast_id`),
  KEY `idx_notifications_read_at` (`read_at`),
  KEY `idx_notifications_type` (`type`),
  CONSTRAINT `fk_notification_broadcast` FOREIGN KEY (`broadcast_id`) REFERENCES `notification_broadcasts` (`id`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=73 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_notifications`
--

LOCK TABLES `app_notifications` WRITE;
/*!40000 ALTER TABLE `app_notifications` DISABLE KEYS */;
INSERT INTO `app_notifications` VALUES (3,1,'PLATFORM_UPDATE','Live verify test','This broadcast was created by the live verification run.',1,0,'2026-08-01 07:58:28',1,'HIGH',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(4,53,'CHAT_MESSAGE','New conversation','Nakul Sharma started a conversation with you',2,0,'2026-08-03 08:36:28',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(5,53,'BOOKING_CREATED','New booking request','Nakul Sharma requested your session: AWS DevOps Certification Prep',36,0,'2026-08-03 10:03:04',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(7,53,'PAYMENT_UPDATE','Payment initiated','Payment intent created for booking #36',36,0,'2026-08-03 10:03:05',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(8,50,'BOOKING_CREATED','New booking request','Nakul Sharma requested your session: ML Model Deployment on GCP',37,0,'2026-08-03 10:04:18',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(10,50,'PAYMENT_UPDATE','Payment initiated','Payment intent created for booking #37',37,0,'2026-08-03 10:04:18',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(11,47,'BOOKING_CREATED','New booking request','Test Learner requested your session: E2E Full Flow Session',39,0,'2026-08-03 12:15:40',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(12,47,'BOOKING_CREATED','New booking request','Test Learner requested your session: React Fundamentals Bootcamp',40,0,'2026-08-03 12:18:51',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(13,2,'SESSION_REQUEST_RECEIVED','New session request','Tushar Dhiman requested a session with you: \"HII\"',1,0,'2026-08-04 00:53:25',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(14,2,'CHAT_MESSAGE','New conversation','Tushar Dhiman started a conversation with you',3,0,'2026-08-04 00:53:50',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(15,2,'CHAT_MESSAGE','New message','Tushar Dhiman sent a message',3,0,'2026-08-04 00:53:55',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(16,62,'CHAT_MESSAGE','New message','Pritil sent a message',3,0,'2026-08-04 00:54:39',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(17,62,'CHAT_MESSAGE','New message','Pritil sent a message',3,0,'2026-08-04 00:54:59',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(18,62,'SESSION_REQUEST_ACCEPTED','Session request accepted','Pritil accepted your session request. They will set up a session for you soon.',1,0,'2026-08-04 00:55:32',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(19,62,'SESSION_CREATED','Your session is ready','Pritil has set up your session: \"Java\" starting at 2026-08-06T07:30Z.',34,0,'2026-08-04 00:56:19',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(20,62,'PAYMENT_UPDATE','Payment initiated','Payment intent created for booking #41',41,0,'2026-08-04 00:58:00',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(21,2,'PAYMENT_UPDATE','Payment initiated','Payment intent created for booking #41',41,0,'2026-08-04 00:58:00',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(22,62,'PAYMENT_UPDATE','Payment initiated','Payment intent created for booking #41',41,0,'2026-08-04 00:58:02',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(23,2,'PAYMENT_UPDATE','Payment initiated','Payment intent created for booking #41',41,0,'2026-08-04 00:58:02',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(24,62,'PAYMENT_UPDATE','Payment initiated','Payment intent created for booking #41',41,0,'2026-08-04 02:43:39',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(25,2,'PAYMENT_UPDATE','Payment initiated','Payment intent created for booking #41',41,0,'2026-08-04 02:43:39',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(26,2,'SESSION_REQUEST_RECEIVED','New session request','Test Learner requested a session with you: \"Looking forward to learning backend development with you! I have a few months of experience and want to go deeper into Java and Spring Boot.\"',2,0,'2026-08-04 03:37:39',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(27,47,'SESSION_REQUEST_RECEIVED','New session request','Test Learner requested a session with you: \"Looking forward to learning backend development with you! I have a few months of experience and want to go deeper into Java and Spring Boot.\"',3,0,'2026-08-04 03:38:20',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(28,48,'SESSION_REQUEST_ACCEPTED','Session request accepted','Test Mentor accepted your session request. They will set up a session for you soon.',3,0,'2026-08-04 03:38:20',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(29,48,'SESSION_CREATED','Your session is ready','Test Mentor has set up your session: \"Spring Boot for Backend Devs\" starting at 2026-08-06T09:08:20.059353Z.',35,0,'2026-08-04 03:38:20',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(30,47,'SESSION_REQUEST_RECEIVED','New session request','Test Learner requested a session with you: \"Could we schedule a session about system design interviews?\"',4,0,'2026-08-04 03:38:21',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(31,48,'SESSION_REQUEST_DECLINED','Session request declined','Test Mentor declined your session request. Reason: Booked solid for the next two weeks - try again later',4,0,'2026-08-04 03:38:21',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(32,47,'SESSION_REQUEST_RECEIVED','New session request','Test Learner requested a session with you: \"Hi! I would love to learn more about building scalable microservices with you.\"',5,0,'2026-08-04 03:38:21',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(33,47,'SAFETY_REPORT','A report was filed','A report involving your account was submitted and is under review.',1,0,'2026-08-04 04:44:44',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(34,48,'SAFETY_UPDATE','Report resolved','Your report #1 was resolved.',1,0,'2026-08-04 04:45:11',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(35,47,'SAFETY_REPORT','A report was filed','A report involving your account was submitted and is under review.',2,0,'2026-08-04 04:45:37',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(36,47,'SAFETY_REPORT','A report was filed','A report involving your account was submitted and is under review.',3,0,'2026-08-04 04:46:28',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(37,47,'SAFETY_REPORT','A report was filed','A report involving your account was submitted and is under review.',5,0,'2026-08-04 04:50:25',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(38,63,'BOOKING_CREATED','New booking request','Tushar Dhiman requested your session: Java',43,1,'2026-08-04 08:09:16',NULL,'MEDIUM','2026-08-05 15:49:42.913560',NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(39,62,'PAYMENT_UPDATE','Payment initiated','Payment intent created for booking #43',43,0,'2026-08-04 08:09:16',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(40,63,'PAYMENT_UPDATE','Payment initiated','Payment intent created for booking #43',43,0,'2026-08-04 08:09:16',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(41,63,'CHAT_MESSAGE','New message','Tushar Dhiman sent a new message on booking #43',43,1,'2026-08-04 08:09:42',NULL,'MEDIUM','2026-08-05 15:49:47.496449',NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(42,62,'CHAT_MESSAGE','New message','ankitathakur sent a new message on booking #43',43,0,'2026-08-04 12:15:46',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(43,62,'CHAT_MESSAGE','New message','ankitathakur sent a new message on booking #43',43,0,'2026-08-04 13:40:41',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(44,62,'CHAT_MESSAGE','New message','ankitathakur sent a new message on booking #43',43,0,'2026-08-04 13:40:47',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(45,62,'CHAT_MESSAGE','New message','ankitathakur sent a new message on booking #43',43,0,'2026-08-04 13:40:49',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(46,62,'CHAT_MESSAGE','New message','ankitathakur sent a new message on booking #43',43,0,'2026-08-04 13:41:03',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(47,62,'CHAT_MESSAGE','New message','ankitathakur sent a new message on booking #43',43,0,'2026-08-04 21:24:39',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(48,62,'CHAT_MESSAGE','New message','ankitathakur sent a new message on booking #43',43,0,'2026-08-04 21:24:46',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(49,62,'CHAT_MESSAGE','New message','ankitathakur sent a new message on booking #43',43,0,'2026-08-04 21:24:47',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(50,2,'MESSAGE_REQUEST_RECEIVED','New message request','ankitathakur wants to connect',1,0,'2026-08-04 22:00:01',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(51,62,'MESSAGE_REQUEST_RECEIVED','New message request','ankitathakur wants to connect',2,0,'2026-08-04 22:00:16',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(52,49,'CERTIFICATION_EARNED','New certification earned','You unlocked: First Class Delivered',3,0,'2026-08-05 03:19:53',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(53,92,'ROLE_SWITCHED','Role updated','Your role changed from LEARNER to MENTOR',92,0,'2026-08-07 01:05:33',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(54,92,'MENTOR_VERIFICATION','Application submitted','Your mentor verification application is now pending review.',1,0,'2026-08-07 01:05:34',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(55,93,'ROLE_SWITCHED','Role updated','Your role changed from LEARNER to MENTOR',93,0,'2026-08-07 01:05:49',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(56,93,'MENTOR_VERIFICATION','Application submitted','Your mentor verification application is now pending review.',2,0,'2026-08-07 01:05:49',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(57,93,'MENTOR_VERIFICATION','Mentor verification approved','Congratulations! Your mentor profile has been verified. You can now create mentoring sessions and receive bookings.',2,0,'2026-08-07 01:05:50',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(58,94,'ROLE_SWITCHED','Role updated','Your role changed from LEARNER to MENTOR',94,0,'2026-08-07 01:06:07',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(59,94,'MENTOR_VERIFICATION','Application submitted','Your mentor verification application is now pending review.',3,0,'2026-08-07 01:06:08',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(60,94,'MENTOR_VERIFICATION','Mentor verification approved','Congratulations! Your mentor profile has been verified. You can now create mentoring sessions and receive bookings.',3,0,'2026-08-07 01:06:08',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(61,95,'ROLE_SWITCHED','Role updated','Your role changed from LEARNER to MENTOR',95,0,'2026-08-07 01:07:37',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(62,95,'MENTOR_VERIFICATION','Application submitted','Your mentor verification application is now pending review.',4,0,'2026-08-07 01:07:37',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(63,95,'MENTOR_VERIFICATION','Mentor verification approved','Congratulations! Your mentor profile has been verified. You can now create mentoring sessions and receive bookings.',4,0,'2026-08-07 01:07:37',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(64,96,'ROLE_SWITCHED','Role updated','Your role changed from LEARNER to MENTOR',96,0,'2026-08-07 01:07:49',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(65,96,'MENTOR_VERIFICATION','Application submitted','Your mentor verification application is now pending review.',5,0,'2026-08-07 01:07:49',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(66,96,'MENTOR_VERIFICATION','Mentor verification approved','Congratulations! Your mentor profile has been verified. You can now create mentoring sessions and receive bookings.',5,0,'2026-08-07 01:07:49',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(67,97,'ROLE_SWITCHED','Role updated','Your role changed from LEARNER to MENTOR',97,0,'2026-08-07 01:08:45',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(68,97,'MENTOR_VERIFICATION','Application submitted','Your mentor verification application is now pending review.',6,0,'2026-08-07 01:08:45',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(69,97,'MENTOR_VERIFICATION','Mentor verification approved','Congratulations! Your mentor profile has been verified. You can now create mentoring sessions and receive bookings.',6,0,'2026-08-07 01:08:45',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(70,98,'ROLE_SWITCHED','Role updated','Your role changed from LEARNER to MENTOR',98,0,'2026-08-07 01:08:46',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(71,98,'MENTOR_VERIFICATION','Application submitted','Your mentor verification application is now pending review.',7,0,'2026-08-07 01:08:46',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED'),(72,98,'MENTOR_VERIFICATION','Mentor verification approved','Congratulations! Your mentor profile has been verified. You can now create mentoring sessions and receive bookings.',7,0,'2026-08-07 01:08:47',NULL,'MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,'DELIVERED');
/*!40000 ALTER TABLE `app_notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `action` varchar(60) NOT NULL,
  `severity` varchar(20) NOT NULL DEFAULT 'INFO',
  `module` varchar(40) DEFAULT NULL,
  `outcome` varchar(20) NOT NULL DEFAULT 'SUCCESS',
  `user_id` bigint DEFAULT NULL,
  `resource` varchar(255) DEFAULT NULL,
  `resource_id` bigint DEFAULT NULL,
  `admin_id` bigint DEFAULT NULL,
  `admin_email` varchar(255) DEFAULT NULL,
  `entity_type` varchar(100) DEFAULT NULL,
  `entity_id` bigint DEFAULT NULL,
  `details` text,
  `before_value` text,
  `after_value` text,
  `user_agent` varchar(255) DEFAULT NULL,
  `device` varchar(60) DEFAULT NULL,
  `browser` varchar(60) DEFAULT NULL,
  `os` varchar(60) DEFAULT NULL,
  `request_id` varchar(64) DEFAULT NULL,
  `correlation_id` varchar(64) DEFAULT NULL,
  `endpoint` varchar(255) DEFAULT NULL,
  `archived_at` timestamp NULL DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user_id` (`user_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_created_at` (`created_at`),
  KEY `idx_audit_severity` (`severity`),
  KEY `idx_audit_module` (`module`),
  KEY `idx_audit_outcome` (`outcome`),
  KEY `idx_audit_archived_at` (`archived_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=282 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,'RESET_ALL_DATA','CRITICAL',NULL,'SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','Database',NULL,'Deleted 2 rows from 36 tables and removed 0 uploaded files.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-29 11:11:39'),(2,'MIGRATE_CERTIFICATES','INFO',NULL,'SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com',NULL,NULL,'Migrated 0 certs for 0 users',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-07-30 08:00:35'),(3,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 07:13:32'),(4,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 07:15:55'),(5,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 07:16:42'),(6,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 07:18:21'),(7,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 07:18:47'),(8,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 07:48:43'),(9,'LOGIN','INFO',NULL,'SUCCESS',26,'Auth',26,NULL,NULL,NULL,NULL,'e2etestuser2@test.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 07:57:33'),(11,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 08:03:20'),(13,'LOGIN','INFO',NULL,'SUCCESS',26,'Auth',26,NULL,NULL,NULL,NULL,'e2etestuser2@test.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 08:03:21'),(14,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 08:04:32'),(15,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 08:09:00'),(16,'LOGOUT','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 08:09:11'),(17,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 08:15:34'),(18,'LOGIN','INFO',NULL,'SUCCESS',26,'Auth',26,NULL,NULL,NULL,NULL,'e2etestuser2@test.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 08:22:26'),(21,'LOGIN','INFO',NULL,'SUCCESS',26,'Auth',26,NULL,NULL,NULL,NULL,'e2etestuser2@test.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 08:59:31'),(24,'LOGIN','INFO',NULL,'SUCCESS',26,'Auth',26,NULL,NULL,NULL,NULL,'e2etestuser2@test.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-07-31 09:11:26'),(27,'LOGIN','INFO',NULL,'SUCCESS',2,'Auth',2,NULL,NULL,NULL,NULL,'pritil9783@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 02:21:21'),(28,'LOGOUT','INFO',NULL,'SUCCESS',2,'Auth',2,NULL,NULL,NULL,NULL,'pritil9783@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 02:23:12'),(29,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 03:33:14'),(30,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 03:33:38'),(31,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 03:35:16'),(32,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 03:42:03'),(33,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 03:43:29'),(34,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 04:03:08'),(35,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 04:08:59'),(36,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 04:37:20'),(37,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 05:04:01'),(38,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 05:04:24'),(39,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 05:04:53'),(40,'MODERATE_CONTENT','INFO',NULL,'SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','FlaggedContent',1,'Moved item #1 from PENDING_REVIEW to APPROVED — live verification',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 05:04:54'),(41,'DELETE_FLAGGED_CONTENT','CRITICAL',NULL,'SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','FlaggedContent',1,'Permanently deleted flagged content #1 — cleanup',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 05:04:54'),(42,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 05:09:07'),(43,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 05:11:09'),(44,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 06:35:26'),(45,'LOGIN','INFO',NULL,'SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-01 07:57:59'),(46,'LOGIN','SUCCESS','AUTH','SUCCESS',47,NULL,NULL,NULL,NULL,'User',47,'LOGIN for mentor@test.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'d0ba5617-347','a3ed3230-99f','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 05:54:33'),(47,'LOGIN','SUCCESS','AUTH','SUCCESS',47,NULL,NULL,NULL,NULL,'User',47,'LOGIN for mentor@test.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'73cc6310-95e','9505ca6b-8a2','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 05:54:54'),(48,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'458d30f4-575','8b6ff72d-83d','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 06:17:56'),(49,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for learner@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'93c78431-63f','44c235b9-bd7','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 06:17:57'),(50,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for learner@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'fc814c4f-138','4ff9415c-0f5','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 06:18:35'),(51,'LOGIN','SUCCESS','AUTH','SUCCESS',47,NULL,NULL,NULL,NULL,'User',47,'LOGIN for mentor@test.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'5ef4f3a5-74a','a8103482-272','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 06:27:50'),(52,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'c1b0f715-8e6','45841180-694','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 06:27:51'),(53,'LOGIN','SUCCESS','AUTH','SUCCESS',47,NULL,NULL,NULL,NULL,'User',47,'LOGIN for mentor@test.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'315c37f6-f94','23803415-59e','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 06:28:22'),(54,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'f22db2f4-315','b775a419-8c9','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 06:28:24'),(55,'LOGIN','SUCCESS','AUTH','SUCCESS',47,NULL,NULL,NULL,NULL,'User',47,'LOGIN for mentor@test.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'4e91c1e6-7fc','3581045a-4b9','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 06:46:24'),(56,'LOGIN','SUCCESS','AUTH','SUCCESS',47,NULL,NULL,NULL,NULL,'User',47,'LOGIN for mentor@test.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'6083c1ea-0dd','f7667b31-ddf','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 06:46:24'),(57,'LOGIN','SUCCESS','AUTH','SUCCESS',47,NULL,NULL,NULL,NULL,'User',47,'LOGIN for mentor@test.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'ebd4abc7-04e','0f991820-cc0','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 06:46:25'),(58,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'303c5501-a81','f4d809d1-3c1','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 06:54:13'),(59,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'1f081bc0-e52','29666aeb-799','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 06:54:14'),(60,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for learner@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','8ce51a86-efc','2e2d4242-892','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 07:00:40'),(61,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for learner@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','aba7f7ba-fff','f8018853-737','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 07:05:14'),(62,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'93653079-814','69047842-5ce','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 07:11:43'),(63,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for probe@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'0b8f566d-102','5c583e7e-c2d','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 07:56:27'),(65,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for probe2@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'7817377c-b98','608526d4-0cd','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 08:06:46'),(66,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for nobody@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'df765fc7-259','6d5abd6d-589','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 08:11:32'),(71,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for e2etest@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'df2db31a-312','0190dcaa-1bf','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 09:41:45'),(79,'LOGIN','SUCCESS','AUTH','SUCCESS',58,NULL,NULL,NULL,NULL,'User',58,'LOGIN for nakul978397@gmail.com (LEARNER)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','e758d915-604','e5712cac-366','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 11:24:35'),(80,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'1a0b953b-763','020f4cc8-869','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 11:46:45'),(81,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'5544a7b1-004','5154e991-034','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 11:49:30'),(82,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'ea96bc42-901','5c4e6d05-87d','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 12:07:03'),(83,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'5e4aa435-3e7','579d04eb-4af','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 12:07:39'),(84,'LOGIN','SUCCESS','AUTH','SUCCESS',47,NULL,NULL,NULL,NULL,'User',47,'LOGIN for mentor@test.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'4efea4ca-1d5','25745c22-7d1','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 12:14:39'),(85,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'de25f7f9-994','e9ff88fa-519','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 12:14:39'),(86,'LOGIN','SUCCESS','AUTH','SUCCESS',47,NULL,NULL,NULL,NULL,'User',47,'LOGIN for mentor@test.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'3b126a0b-036','5bcce565-f76','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 12:15:39'),(87,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'d88204cd-74f','9b15561c-102','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 12:15:40'),(88,'LOGIN','SUCCESS','AUTH','SUCCESS',47,NULL,NULL,NULL,NULL,'User',47,'LOGIN for mentor@test.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'3459f1d0-b83','a9b811a1-8dd','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 12:18:50'),(89,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'da29cbf1-f82','35e6c8eb-dda','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 12:18:51'),(90,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','943bf0b3-ea9','74c30dc5-da7','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-03 12:22:38'),(91,'LOGOUT','INFO','AUTH','SUCCESS',58,'Auth',58,NULL,NULL,NULL,NULL,'nakul978397@gmail.com',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','a00ce90b-3a2','b8434754-d27','POST /api/v1/auth/logout',NULL,'0:0:0:0:0:0:0:1','2026-08-04 00:37:12'),(92,'USER_CREATED','SUCCESS','USER','SUCCESS',62,NULL,NULL,NULL,NULL,'User',62,'Account created for tushardhiman@gmail.com as LEARNER',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','129d9e52-543','c9e39105-d82','POST /api/v1/auth/signup',NULL,'0:0:0:0:0:0:0:1','2026-08-04 00:38:35'),(93,'LOGOUT','INFO','AUTH','SUCCESS',62,'Auth',62,NULL,NULL,NULL,NULL,'tushardhiman@gmail.com',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','06767a41-2b6','ee5b5675-ba9','POST /api/v1/auth/logout',NULL,'0:0:0:0:0:0:0:1','2026-08-04 00:38:43'),(94,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','ac022e0b-c9c','07744bc2-6c5','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 00:39:02'),(95,'LOGOUT','INFO','AUTH','SUCCESS',1,'Auth',1,NULL,NULL,NULL,NULL,'nakulsharma@gmail.com',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','3fc712a1-4e4','9bc09483-047','POST /api/v1/auth/logout',NULL,'0:0:0:0:0:0:0:1','2026-08-04 00:41:21'),(96,'LOGIN','SUCCESS','AUTH','SUCCESS',62,NULL,NULL,NULL,NULL,'User',62,'LOGIN for tushardhiman@gmail.com (LEARNER)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','ae774ac5-7fa','cf04dd94-625','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 00:41:41'),(97,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','b03fe7f4-4b6','ca23e4b8-1ea','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 00:54:25'),(98,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for agent-test+1@example.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'91bbea84-f24','07d75348-a88','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 03:35:52'),(99,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'a3606ce5-a19','b34a121e-e1a','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 03:36:28'),(100,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'a15ed2f8-af0','d9ee0032-259','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 03:37:02'),(101,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'2764bc58-def','255fcee3-c05','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 03:37:38'),(102,'LOGIN','SUCCESS','AUTH','SUCCESS',47,NULL,NULL,NULL,NULL,'User',47,'LOGIN for mentor@test.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'ca9c92fb-fed','cdb2c461-748','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 03:37:39'),(103,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'7bb76546-7dc','a2675608-4a4','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 03:37:57'),(104,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'7c31a2e3-c8b','3d21920e-c5c','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 03:38:19'),(105,'LOGIN','SUCCESS','AUTH','SUCCESS',47,NULL,NULL,NULL,NULL,'User',47,'LOGIN for mentor@test.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'39e7d401-3f3','efa178eb-574','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 03:38:20'),(106,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','fa5918ed-462','5fd5bd2e-e03','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 03:40:40'),(107,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'46142a10-d10','058e9759-4a5','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 03:41:19'),(108,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'6a824f14-c00','26e86c1c-938','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 03:45:37'),(109,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','6d2bcdb4-cbf','ba8c812b-f2c','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 03:47:32'),(110,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for admin@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'b3d53619-ece','a6dff190-353','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:43:33'),(111,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'d3e8dee8-201','89da022b-7bd','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:43:56'),(112,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'64a6075a-96d','fb7bea51-47a','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:44:15'),(113,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'2626d465-93d','9b9ac1e1-c66','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:44:43'),(114,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'b650ed7c-ab5','e2d8d207-bc2','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:45:09'),(115,'ASSIGN_REPORT','INFO','REPORT','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','Report',1,'Assigned report #1 to Nakul Sharma (nakulsharma@gmail.com)',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:45:11'),(116,'SET_REPORT_PRIORITY','INFO','REPORT','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','Report',1,'Set priority to HIGH',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:45:11'),(117,'RESOLVE_REPORT','INFO','REPORT','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','Report',1,'Report #1 RESOLVED — Confirmed no-show, refund issued.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:45:11'),(118,'UPDATE_REPORT_STATUS','INFO','REPORT','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','Report',1,'Set status to IN_REVIEW',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:45:12'),(119,'SET_REPORT_PRIORITY','INFO','REPORT','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','Report',1,'Set priority to CRITICAL',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:45:12'),(120,'SET_REPORT_PRIORITY','INFO','REPORT','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','Report',1,'Set priority to MEDIUM',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:45:12'),(121,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'46887167-07f','39f5103f-b94','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:45:37'),(122,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'9b6f5b15-ec0','1d84a713-f0e','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:46:27'),(123,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'1c1737d4-29a','50751c28-d44','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:49:12'),(124,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'0c357d05-213','a25345c3-9c6','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:50:24'),(125,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'31e6093f-b6a','833d9e60-aa7','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 04:52:07'),(126,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for admin@skillswap.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','cbca594f-340','5f6a2689-330','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 05:07:54'),(127,'BULK_DISABLE_USERS','WARNING','USER','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','User',NULL,'Disabled 1 users',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-04 06:21:32'),(128,'BULK_DISABLE_USERS','WARNING','USER','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','User',NULL,'Disabled 1 users',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0:0:0:0:0:0:0:1','2026-08-04 06:21:41'),(129,'LOGOUT','INFO','AUTH','SUCCESS',62,'Auth',62,NULL,NULL,NULL,NULL,'tushardhiman@gmail.com',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','0899ceb2-44d','e798f364-6cd','POST /api/v1/auth/logout',NULL,'0:0:0:0:0:0:0:1','2026-08-04 08:04:46'),(130,'USER_CREATED','SUCCESS','USER','SUCCESS',63,NULL,NULL,NULL,NULL,'User',63,'Account created for ankitthakur@gmail.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','7228d226-007','671fa33d-157','POST /api/v1/auth/signup',NULL,'0:0:0:0:0:0:0:1','2026-08-04 08:05:19'),(131,'LOGIN','SUCCESS','AUTH','SUCCESS',62,NULL,NULL,NULL,NULL,'User',62,'LOGIN for tushardhiman@gmail.com (LEARNER)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','d8319c5f-edd','489c21ba-3da','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 08:08:22'),(132,'LOGIN','SUCCESS','AUTH','SUCCESS',63,NULL,NULL,NULL,NULL,'User',63,'LOGIN for ankitthakur@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','b7fcc4bb-19c','96aa2902-731','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 12:11:27'),(133,'LOGIN','SUCCESS','AUTH','SUCCESS',63,NULL,NULL,NULL,NULL,'User',63,'LOGIN for ankitthakur@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','79d5ea80-210','3fed9823-8b7','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 14:11:41'),(134,'LOGIN','SUCCESS','AUTH','SUCCESS',63,NULL,NULL,NULL,NULL,'User',63,'LOGIN for ankitthakur@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','96e5fd9f-4de','dfba3b6d-10f','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-04 21:23:57'),(135,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for agent-test+1@example.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'8fba74ce-897','85464e54-bff','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 03:13:49'),(136,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'5585b928-58e','1d90f039-2fe','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 03:14:22'),(137,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'0b4d2b17-dc7','7144cdf6-993','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 03:18:06'),(138,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 127.0.0.1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'0171733f-37f','96db7037-1b8','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 03:18:32'),(139,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'a471a1a6-ad2','eebe8f65-d39','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 03:18:46'),(140,'LOGIN','SUCCESS','AUTH','SUCCESS',53,NULL,NULL,NULL,NULL,'User',53,'LOGIN for emma.wilson@example.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'95a525f8-244','7807c63c-513','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 03:18:46'),(141,'LOGIN','SUCCESS','AUTH','SUCCESS',52,NULL,NULL,NULL,NULL,'User',52,'LOGIN for amit.kumar@example.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'9686ef43-3d9','3b7d6d5e-ea8','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 03:18:47'),(142,'LOGIN','SUCCESS','AUTH','SUCCESS',51,NULL,NULL,NULL,NULL,'User',51,'LOGIN for sarah.chen@example.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'20af03dc-aad','f6459bab-b00','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 03:18:48'),(143,'LOGIN','SUCCESS','AUTH','SUCCESS',50,NULL,NULL,NULL,NULL,'User',50,'LOGIN for raj.patel@example.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'78268f4f-e8e','f459badc-89e','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 03:18:49'),(144,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'93987907-50b','b1d554e2-d7f','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 03:19:02'),(145,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'7f89b694-eaf','fc305277-9b1','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 03:34:42'),(146,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for priya.sharma@example.com from IP 127.0.0.1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'405cdaad-e3c','d0159e6d-74e','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 04:13:21'),(147,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'6b0d2de2-918','dd2aab27-1d4','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 04:14:02'),(148,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for priya.sharma@example.com from IP 127.0.0.1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'aa67139c-954','f0c29b6e-6bb','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 04:14:03'),(149,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for priya.sharma@example.com from IP 127.0.0.1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'f9450f94-03a','e7cb1b12-9ee','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 04:14:03'),(150,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for priya.sharma@example.com from IP 127.0.0.1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'f95c434c-64f','71f17aac-b99','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 04:14:04'),(151,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for priya.sharma@example.com from IP 127.0.0.1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'a0de7f24-8e3','08e05668-8dc','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 04:14:04'),(152,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for priya.sharma@example.com from IP 127.0.0.1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'a3378768-cb0','9a11c954-a52','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 04:14:12'),(153,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for priya.sharma@example.com from IP 127.0.0.1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'4dc23564-bcb','6e0bbb4d-3e2','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 04:14:26'),(154,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for priya.sharma@example.com from IP 127.0.0.1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'40473037-300','c8c8eb19-ae9','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 04:14:35'),(155,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for e2etestuser2@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','d198e1f0-1ef','fbf66456-123','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 04:44:33'),(156,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for e2etestuser2@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','a8a96df4-3f9','c6d7078e-a2a','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 04:44:33'),(157,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for e2etestuser2@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','6a8cdacd-372','aadd86f0-5ce','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 04:44:33'),(158,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for e2etestuser2@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','bb4009cf-5a6','994a0d32-237','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 05:24:01'),(159,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for e2etestuser2@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','56557165-e56','6149c85b-0ab','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 08:28:31'),(160,'LOGIN','SUCCESS','AUTH','SUCCESS',63,NULL,NULL,NULL,NULL,'User',63,'LOGIN for ankitthakur@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','0075919c-f98','5f2b9378-78d','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 08:58:29'),(161,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'04384f8e-9df','e811a3c5-235','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:07:48'),(162,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'18584cad-ddf','b8e9e8f6-09e','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:08:24'),(163,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'node',NULL,NULL,NULL,'2e08ef2e-e31','7979d272-a85','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:17:54'),(164,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'node',NULL,NULL,NULL,'27fe2b76-40a','2faded14-77e','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:22:26'),(165,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'node',NULL,NULL,NULL,'05cccd1f-5d6','0b83e81b-5b5','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:23:00'),(166,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'node',NULL,NULL,NULL,'ccf2023c-85f','e76fc1cc-de1','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:23:54'),(167,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'node',NULL,NULL,NULL,'7a805ff8-8a3','5e209b6a-2e9','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:24:28'),(168,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'node',NULL,NULL,NULL,'b48dd7a4-230','98cba37e-f6a','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:26:26'),(169,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'node',NULL,NULL,NULL,'fd73c1b2-fe5','fb16c803-09e','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:28:40'),(170,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'node',NULL,NULL,NULL,'a9025ea1-a9e','0e174050-090','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:31:06'),(171,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'node',NULL,NULL,NULL,'eec1c342-def','9ce4b545-af7','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:31:56'),(172,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'node',NULL,NULL,NULL,'619767e5-892','de98cfae-f69','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:35:36'),(173,'LOGIN','SUCCESS','AUTH','SUCCESS',49,NULL,NULL,NULL,NULL,'User',49,'LOGIN for priya.sharma@example.com (MENTOR)',NULL,NULL,'node',NULL,NULL,NULL,'d4c79ce8-81b','5c5dd328-ff5','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 09:36:13'),(174,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for agent-test+1@example.com from IP 127.0.0.1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'a373b074-7b1','4f2761ee-b20','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 10:03:59'),(175,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 127.0.0.1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'fb4054dc-2bb','44daeec6-dad','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 10:10:53'),(176,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 127.0.0.1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'00128951-f7f','9ccfc49e-1a9','POST /api/v1/auth/login',NULL,'127.0.0.1','2026-08-05 10:16:20'),(177,'USER_CREATED','SUCCESS','USER','SUCCESS',64,NULL,NULL,NULL,NULL,'User',64,'Account created for darktest+3@example.com as MENTOR',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'78db47c4-8e7','1a22e982-3c2','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 10:18:07'),(178,'USER_CREATED','SUCCESS','USER','SUCCESS',65,NULL,NULL,NULL,NULL,'User',65,'Account created for darktest+4@example.com as MENTOR',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'d12f5300-3e5','fde483e2-c5f','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 10:19:55'),(179,'USER_CREATED','SUCCESS','USER','SUCCESS',66,NULL,NULL,NULL,NULL,'User',66,'Account created for typecheck1785950369449@test.com as LEARNER',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','ec97b0d6-fee','391a3d7c-61c','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 11:49:30'),(180,'USER_CREATED','SUCCESS','USER','SUCCESS',67,NULL,NULL,NULL,NULL,'User',67,'Account created for typecheck1785950414717@test.com as LEARNER',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','ba5eec9d-d69','7384546e-755','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 11:50:15'),(181,'USER_CREATED','SUCCESS','USER','SUCCESS',68,NULL,NULL,NULL,NULL,'User',68,'Account created for typecheck1785950447556@test.com as LEARNER',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','d1b09225-e0b','3ab3a456-339','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 11:50:48'),(182,'USER_CREATED','SUCCESS','USER','SUCCESS',69,NULL,NULL,NULL,NULL,'User',69,'Account created for hero1785952582189@test.com as LEARNER',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','0d26742e-77d','55ad9c57-860','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 12:26:22'),(183,'USER_CREATED','SUCCESS','USER','SUCCESS',70,NULL,NULL,NULL,NULL,'User',70,'Account created for hero1785952662550@test.com as LEARNER',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','2ce28735-815','c15147a1-7ce','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 12:27:43'),(184,'USER_CREATED','SUCCESS','USER','SUCCESS',71,NULL,NULL,NULL,NULL,'User',71,'Account created for hero1785952723054@test.com as LEARNER',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','2c5da751-65a','826175ba-701','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 12:28:43'),(185,'USER_CREATED','SUCCESS','USER','SUCCESS',72,NULL,NULL,NULL,NULL,'User',72,'Account created for mhero1785952838734@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','7d8e19c0-79e','2021618e-97c','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 12:30:39'),(186,'USER_CREATED','SUCCESS','USER','SUCCESS',73,NULL,NULL,NULL,NULL,'User',73,'Account created for mh21785952869970@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','25bc7ea9-704','ed2afffb-255','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 12:31:10'),(187,'USER_CREATED','SUCCESS','USER','SUCCESS',74,NULL,NULL,NULL,NULL,'User',74,'Account created for fh1785953328523@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','221d9570-032','acc6b8e9-3b3','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 12:38:49'),(188,'USER_CREATED','SUCCESS','USER','SUCCESS',75,NULL,NULL,NULL,NULL,'User',75,'Account created for dh1785953894715@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','624e5a53-a98','cb9c658c-501','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 12:48:15'),(189,'USER_CREATED','SUCCESS','USER','SUCCESS',76,NULL,NULL,NULL,NULL,'User',76,'Account created for mb1785953959020@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','7a688d59-576','644c5578-cca','POST /api/v1/auth/signup',NULL,'127.0.0.1','2026-08-05 12:49:19'),(190,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for test@skillswap.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','2aa27e8b-981','7b3e4663-79a','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 12:53:24'),(191,'USER_CREATED','SUCCESS','USER','SUCCESS',77,NULL,NULL,NULL,NULL,'User',77,'Account created for heromargin1785954257024@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','7a0b038b-694','bdd9b622-50c','POST /api/v1/auth/signup',NULL,'0:0:0:0:0:0:0:1','2026-08-05 12:54:20'),(192,'USER_CREATED','SUCCESS','USER','SUCCESS',78,NULL,NULL,NULL,NULL,'User',78,'Account created for ruler1785954351689@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','b7ab823b-ab8','9a9395ae-639','POST /api/v1/auth/signup',NULL,'0:0:0:0:0:0:0:1','2026-08-05 12:55:56'),(193,'USER_CREATED','SUCCESS','USER','SUCCESS',79,NULL,NULL,NULL,NULL,'User',79,'Account created for deep1785954413367@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','77b85d54-fd7','a01258f9-f7b','POST /api/v1/auth/signup',NULL,'0:0:0:0:0:0:0:1','2026-08-05 12:57:01'),(194,'USER_CREATED','SUCCESS','USER','SUCCESS',80,NULL,NULL,NULL,NULL,'User',80,'Account created for heromargin1785954559504@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','c3222566-a0d','4e01cc89-d98','POST /api/v1/auth/signup',NULL,'0:0:0:0:0:0:0:1','2026-08-05 12:59:23'),(195,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for heromargin1785954559504@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','e8d022ed-0e1','509f8fbf-e7f','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 12:59:25'),(196,'USER_CREATED','SUCCESS','USER','SUCCESS',81,NULL,NULL,NULL,NULL,'User',81,'Account created for shot1785954911789@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','af589ed0-932','0a172a1b-3ea','POST /api/v1/auth/signup',NULL,'0:0:0:0:0:0:0:1','2026-08-05 13:05:18'),(197,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for shot1785954911789@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','7663b568-193','7784fd31-b79','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 13:05:21'),(198,'USER_CREATED','SUCCESS','USER','SUCCESS',82,NULL,NULL,NULL,NULL,'User',82,'Account created for sshero1785955089184@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','fc4f2c42-be5','6c917adf-430','POST /api/v1/auth/signup',NULL,'0:0:0:0:0:0:0:1','2026-08-05 13:08:13'),(199,'USER_CREATED','SUCCESS','USER','SUCCESS',83,NULL,NULL,NULL,NULL,'User',83,'Account created for dash1785955175982@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','6ded4904-744','ad420037-a0b','POST /api/v1/auth/signup',NULL,'0:0:0:0:0:0:0:1','2026-08-05 13:09:40'),(200,'USER_CREATED','SUCCESS','USER','SUCCESS',84,NULL,NULL,NULL,NULL,'User',84,'Account created for dash21785955228255@test.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','4efbcb84-8ae','cb0fc0e4-d2c','POST /api/v1/auth/signup',NULL,'0:0:0:0:0:0:0:1','2026-08-05 13:10:35'),(201,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for dash21785955228255@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','4360e57b-c6a','4135b6dc-d69','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-05 13:10:36'),(202,'LOGOUT','INFO','AUTH','SUCCESS',63,'Auth',63,NULL,NULL,NULL,NULL,'ankitthakur@gmail.com',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','f36a8b93-a34','d9bb5296-60e','POST /api/v1/auth/logout',NULL,'0:0:0:0:0:0:0:1','2026-08-06 03:57:22'),(203,'USER_CREATED','SUCCESS','USER','SUCCESS',85,NULL,NULL,NULL,NULL,'User',85,'Account created for rahulsharma@gmail.com as MENTOR',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','7fc1d08b-c4e','15ef7340-02d','POST /api/v1/auth/signup',NULL,'0:0:0:0:0:0:0:1','2026-08-06 03:58:20'),(204,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'48d1fa06-7b1','dd033ab0-f70','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 05:46:06'),(205,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'0b774d87-6c0','faec3f1c-cb8','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 05:46:53'),(206,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'083cc27f-13d','2d914790-d8c','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 05:46:53'),(207,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'8c36e9b6-d0e','a04606c1-687','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 05:47:12'),(208,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'eca8af81-9db','8dedc760-044','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 05:47:35'),(209,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'9f9e2fb3-efa','52eb5c75-adb','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 05:57:01'),(210,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','d6d1a6da-04a','37eb9553-7b2','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 05:57:44'),(211,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','7e9355d4-220','0bebe211-62c','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 05:58:32'),(212,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'1f06449e-945','c6ccd2b8-ccf','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:02:44'),(213,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','53de5250-860','af4e9ead-426','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:02:54'),(214,'LOGIN','SUCCESS','AUTH','SUCCESS',48,NULL,NULL,NULL,NULL,'User',48,'LOGIN for learner@test.com (LEARNER)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','fba6c5a6-a3b','12c0dee2-cff','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:03:05'),(215,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for mentor@test.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','0a0397ad-3f1','282ed4ba-580','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:12:47'),(216,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','9c1fc5b7-6e1','8e22b970-c54','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:12:58'),(217,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','5249696d-9a3','c14233cd-136','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:13:29'),(218,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','9124d15e-c79','73195aac-8bb','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:13:29'),(219,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','cc348e8f-db2','da1fef4a-6b8','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:13:29'),(220,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','bd77ff05-85d','f90b0ffc-8ad','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:13:29'),(221,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','db70de08-a4e','245178d7-f7b','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:13:29'),(222,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','be90c3ae-25e','dfa27f09-81d','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:14:08'),(223,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','312501c1-089','68f7c73c-2ec','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:14:18'),(224,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','1bb5831c-532','9baf6a09-c9f','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:14:42'),(225,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','da273449-7e0','b4d1b797-50d','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:14:49'),(226,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','c48789fa-388','05c82960-12a','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:14:57'),(227,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','41cc5f35-304','96761ea0-f34','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:15:22'),(228,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','39f04eb2-a87','2af0dcde-e59','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:15:38'),(229,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','233ac659-8c7','cb01660b-852','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:16:02'),(230,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','ab7bf5af-e7f','e4568a85-d30','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:16:33'),(231,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','f3e60c5d-91c','1f9f06e4-0c9','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:16:56'),(232,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','206da883-116','3d8bc042-dfb','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:19:10'),(233,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','22a8676e-a0b','92d7d1e7-5ec','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:19:24'),(234,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','47a912a9-f05','26d402ca-565','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:19:40'),(235,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','d4ee011f-1a3','98529499-d4d','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:19:56'),(236,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','f7fd0f9a-7fa','919c4dc1-ab4','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:29:10'),(237,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','b8b72e6e-cbb','2336849c-27b','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:29:41'),(238,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for pritil9783@gmail.com from IP 0:0:0:0:0:0:0:1',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','86a93d9c-61c','111f5098-6d0','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:30:05'),(239,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','d4dd7aa1-15c','0fe5b781-eeb','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:30:25'),(240,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','ffe4ad37-901','d31d9bd2-9a1','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:38:48'),(241,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','00b07844-2c2','8f04d950-3b3','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:39:24'),(242,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','5a3ddadd-3af','cd624e62-830','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:39:43'),(243,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','555dbf8e-f7b','c1219ec3-328','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:47:39'),(244,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','dc9cffc0-eb0','8b79cbc4-8f7','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:48:07'),(245,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','2829fe6e-321','2239771a-3d8','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:48:37'),(246,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'0567e150-ccf','f2c3c10d-355','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:54:18'),(247,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'64ce9ae4-8a9','d0bf6027-3d7','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:54:26'),(248,'LOGIN','SUCCESS','AUTH','SUCCESS',2,NULL,NULL,NULL,NULL,'User',2,'LOGIN for pritil9783@gmail.com (MENTOR)',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/149.0.7827.55 Safari/537.36','Desktop','Chrome','Windows NT 10.0','5ac783ca-baa','96b3fda4-da9','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 06:54:44'),(249,'LOGOUT','INFO','AUTH','SUCCESS',85,'Auth',85,NULL,NULL,NULL,NULL,'rahulsharma@gmail.com',NULL,NULL,'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36','Desktop','Chrome','Windows NT 10.0','0c4e4a67-52b','95a60854-f2d','POST /api/v1/auth/logout',NULL,'0:0:0:0:0:0:0:1','2026-08-06 10:26:08'),(251,'FAILED_LOGIN','CRITICAL','SECURITY','FAILURE',NULL,NULL,NULL,NULL,NULL,'User',NULL,'Failed login attempt for 12657 from IP 0:0:0:0:0:0:0:1',NULL,NULL,'curl/8.19.0',NULL,NULL,NULL,'9624f521-dc3','1356c018-6ae','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-06 12:10:20'),(260,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'f967a144-fdb','3d2d15dc-a64','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:05:16'),(262,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'83dcd7be-0f1','181eb555-134','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:05:33'),(264,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'81b0bbd0-888','ad027c17-255','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:05:49'),(266,'MENTOR_VERIFICATION','INFO','SYSTEM','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','MentorVerificationRequest',2,'Approved mentor verification for \"Verify Mentor\" (vfy44358@example.com) — Verified by admin',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'d594b3cd-809','5d85dfe9-3fb','PATCH /api/v1/verification/mentor/requests/2',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:05:50'),(267,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'d611baff-08b','6e0bf52e-93a','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:06:07'),(269,'MENTOR_VERIFICATION','INFO','SYSTEM','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','MentorVerificationRequest',3,'Approved mentor verification for \"Verify Mentor\" (vfy81531@example.com) — Verified by admin',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'244b2186-1c0','7051e157-790','PATCH /api/v1/verification/mentor/requests/3',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:06:08'),(270,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'ddbfd958-f3f','253e2117-d69','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:07:37'),(272,'MENTOR_VERIFICATION','INFO','SYSTEM','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','MentorVerificationRequest',4,'Approved mentor verification for \"Verify Mentor\" (vfy33151@example.com) — Verified by admin',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'5f41aa10-6b9','5d82ef4f-d8e','PATCH /api/v1/verification/mentor/requests/4',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:07:37'),(273,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'89e47f14-99e','81533123-052','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:07:48'),(275,'MENTOR_VERIFICATION','INFO','SYSTEM','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','MentorVerificationRequest',5,'Approved mentor verification for \"Verify Mentor\" (vfy59221@example.com) — Verified by admin',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'8827c04b-c30','d146b493-9a9','PATCH /api/v1/verification/mentor/requests/5',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:07:49'),(276,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'6e5df537-766','b3bab202-983','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:08:45'),(278,'MENTOR_VERIFICATION','INFO','SYSTEM','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','MentorVerificationRequest',6,'Approved mentor verification for \"Verify Mentor\" (vfy83551@example.com) — Verified by admin',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'cdacb6b7-427','5b1400f8-52e','PATCH /api/v1/verification/mentor/requests/6',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:08:45'),(279,'LOGIN','SUCCESS','AUTH','SUCCESS',1,NULL,NULL,NULL,NULL,'User',1,'LOGIN for nakulsharma@gmail.com (ADMIN)',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'fa97948d-a8e','ea00768c-587','POST /api/v1/auth/login',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:08:46'),(281,'MENTOR_VERIFICATION','INFO','SYSTEM','SUCCESS',NULL,NULL,NULL,1,'nakulsharma@gmail.com','MentorVerificationRequest',7,'Approved mentor verification for \"Verify Mentor\" (vfy83054@example.com) — Verified by admin',NULL,NULL,'Python-urllib/3.14',NULL,NULL,NULL,'55dfa984-553','ed8d83b3-0c7','PATCH /api/v1/verification/mentor/requests/7',NULL,'0:0:0:0:0:0:0:1','2026-08-07 01:08:47');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `booking_idempotency_keys`
--

DROP TABLE IF EXISTS `booking_idempotency_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `booking_idempotency_keys` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `endpoint` varchar(120) NOT NULL,
  `idempotency_key` varchar(120) NOT NULL,
  `request_hash` varchar(255) NOT NULL,
  `booking_id` bigint DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_booking_idempotency` (`user_id`,`endpoint`,`idempotency_key`),
  KEY `fk_booking_idempotency_booking` (`booking_id`),
  KEY `idx_booking_idempotency_created` (`created_at`),
  CONSTRAINT `fk_booking_idempotency_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`),
  CONSTRAINT `fk_booking_idempotency_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `booking_idempotency_keys`
--

LOCK TABLES `booking_idempotency_keys` WRITE;
/*!40000 ALTER TABLE `booking_idempotency_keys` DISABLE KEYS */;
INSERT INTO `booking_idempotency_keys` VALUES (5,62,'bookings.create','-api-v1-bookings-1785850755181-9','36',43,'2026-08-04 08:09:16');
/*!40000 ALTER TABLE `booking_idempotency_keys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bookings`
--

DROP TABLE IF EXISTS `bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bookings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` bigint NOT NULL,
  `learner_id` bigint NOT NULL,
  `booking_status` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_by_admin` tinyint(1) DEFAULT '0',
  `approved_at` timestamp NULL DEFAULT NULL,
  `joined_at` timestamp NULL DEFAULT NULL,
  `payment_status` varchar(50) DEFAULT 'PENDING',
  `cancel_reason` varchar(500) DEFAULT NULL,
  `payment_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_bookings_learner_status` (`learner_id`,`booking_status`),
  KEY `idx_bookings_status_approval` (`booking_status`,`approved_by_admin`),
  KEY `idx_bookings_session_approval` (`session_id`,`approved_by_admin`),
  KEY `idx_bookings_learner_approval` (`learner_id`,`approved_by_admin`),
  KEY `idx_bookings_session_status` (`session_id`,`booking_status`),
  KEY `fk_bookings_payment` (`payment_id`),
  CONSTRAINT `fk_bookings_learner` FOREIGN KEY (`learner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_bookings_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_bookings_session` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=44 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bookings`
--

LOCK TABLES `bookings` WRITE;
/*!40000 ALTER TABLE `bookings` DISABLE KEYS */;
INSERT INTO `bookings` VALUES (29,25,54,'COMPLETED','2026-06-04 08:26:32',0,NULL,NULL,'RELEASED',NULL,NULL),(30,25,55,'COMPLETED','2026-06-19 08:26:32',0,NULL,NULL,'RELEASED',NULL,NULL),(31,27,54,'COMPLETED','2026-07-04 08:26:32',0,NULL,NULL,'RELEASED',NULL,NULL),(32,27,55,'COMPLETED','2026-07-14 08:26:32',0,NULL,NULL,'RELEASED',NULL,NULL),(33,28,54,'COMPLETED','2026-07-19 08:26:32',0,NULL,NULL,'RELEASED',NULL,NULL),(34,29,55,'COMPLETED','2026-07-24 08:26:32',0,NULL,NULL,'RELEASED',NULL,NULL),(35,30,54,'COMPLETED','2026-07-29 08:26:32',0,NULL,NULL,'RELEASED',NULL,NULL),(41,34,62,'IN_PROGRESS','2026-08-04 00:56:19',1,'2026-08-04 00:56:19',NULL,'PENDING',NULL,7),(42,35,48,'IN_PROGRESS','2026-08-04 03:38:20',1,'2026-08-04 03:38:20',NULL,'PENDING',NULL,NULL),(43,36,62,'PENDING','2026-08-04 08:09:16',0,NULL,NULL,'PENDING',NULL,8);
/*!40000 ALTER TABLE `bookings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chat_messages`
--

DROP TABLE IF EXISTS `chat_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chat_messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `booking_id` bigint NOT NULL,
  `sender_id` bigint NOT NULL,
  `content` varchar(2000) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read_by_recipient` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_chat_messages_sender` (`sender_id`),
  KEY `idx_chat_messages_booking_created` (`booking_id`,`created_at`),
  CONSTRAINT `fk_chat_messages_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`),
  CONSTRAINT `fk_chat_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chat_messages`
--

LOCK TABLES `chat_messages` WRITE;
/*!40000 ALTER TABLE `chat_messages` DISABLE KEYS */;
INSERT INTO `chat_messages` VALUES (1,43,62,'hello','2026-08-04 08:09:42',1),(2,43,63,'hi','2026-08-04 12:15:46',0),(3,43,63,'hii','2026-08-04 13:40:41',0),(4,43,63,'See you in the session.','2026-08-04 13:40:47',0),(5,43,63,'Can you explain this topic?','2026-08-04 13:40:49',0),(6,43,63,'See you in the session.','2026-08-04 13:41:03',0),(7,43,63,'Thanks! 🙏','2026-08-04 21:24:39',0),(8,43,63,'Let\'s schedule.','2026-08-04 21:24:46',0),(9,43,63,'Let\'s schedule.','2026-08-04 21:24:47',0);
/*!40000 ALTER TABLE `chat_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `direct_conversations`
--

DROP TABLE IF EXISTS `direct_conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `direct_conversations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `participant_one_id` bigint NOT NULL,
  `participant_two_id` bigint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `pinned` tinyint(1) NOT NULL DEFAULT '0',
  `archived` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_direct_conversations_participant_one` (`participant_one_id`),
  KEY `fk_direct_conversations_participant_two` (`participant_two_id`),
  CONSTRAINT `fk_direct_conversations_participant_one` FOREIGN KEY (`participant_one_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_direct_conversations_participant_two` FOREIGN KEY (`participant_two_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `direct_conversations`
--

LOCK TABLES `direct_conversations` WRITE;
/*!40000 ALTER TABLE `direct_conversations` DISABLE KEYS */;
INSERT INTO `direct_conversations` VALUES (2,58,53,'2026-08-03 08:36:28','2026-08-03 08:36:28',0,0),(3,62,2,'2026-08-04 00:53:50','2026-08-04 00:54:59',0,0);
/*!40000 ALTER TABLE `direct_conversations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `direct_messages`
--

DROP TABLE IF EXISTS `direct_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `direct_messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `conversation_id` bigint NOT NULL,
  `sender_id` bigint NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read_by_recipient` tinyint(1) NOT NULL DEFAULT '0',
  `reactions` text,
  PRIMARY KEY (`id`),
  KEY `fk_direct_messages_sender` (`sender_id`),
  KEY `idx_direct_messages_conversation` (`conversation_id`,`created_at`),
  CONSTRAINT `fk_direct_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `direct_conversations` (`id`),
  CONSTRAINT `fk_direct_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `direct_messages`
--

LOCK TABLES `direct_messages` WRITE;
/*!40000 ALTER TABLE `direct_messages` DISABLE KEYS */;
INSERT INTO `direct_messages` VALUES (1,3,62,'hiiiii','2026-08-04 00:53:55',1,NULL),(2,3,2,'i love u','2026-08-04 00:54:39',1,NULL),(3,3,2,'📎 DBMS.pdf\n/api/v1/files/1/content','2026-08-04 00:54:59',1,NULL);
/*!40000 ALTER TABLE `direct_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `flagged_content`
--

DROP TABLE IF EXISTS `flagged_content`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `flagged_content` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `content_type` varchar(50) NOT NULL,
  `content_id` bigint DEFAULT NULL,
  `content_preview` text,
  `owner_id` bigint DEFAULT NULL,
  `reporter_id` bigint DEFAULT NULL,
  `detection_source` varchar(50) NOT NULL DEFAULT 'MANUAL_REPORT',
  `reason` varchar(500) NOT NULL,
  `priority` varchar(20) NOT NULL DEFAULT 'MEDIUM',
  `status` varchar(30) NOT NULL DEFAULT 'PENDING_REVIEW',
  `ai_confidence` double DEFAULT NULL,
  `assigned_moderator_id` bigint DEFAULT NULL,
  `internal_notes` text,
  `escalation_level` int DEFAULT NULL,
  `escalation_reason` varchar(500) DEFAULT NULL,
  `escalated_at` datetime(6) DEFAULT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_flagged_content_owner` (`owner_id`),
  KEY `fk_flagged_content_reporter` (`reporter_id`),
  KEY `fk_flagged_content_moderator` (`assigned_moderator_id`),
  KEY `idx_flagged_content_status` (`status`),
  KEY `idx_flagged_content_type` (`content_type`),
  KEY `idx_flagged_content_priority` (`priority`),
  KEY `idx_flagged_content_created` (`created_at`),
  KEY `idx_flagged_content_detection` (`detection_source`),
  CONSTRAINT `fk_flagged_content_moderator` FOREIGN KEY (`assigned_moderator_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_flagged_content_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_flagged_content_reporter` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `flagged_content`
--

LOCK TABLES `flagged_content` WRITE;
/*!40000 ALTER TABLE `flagged_content` DISABLE KEYS */;
/*!40000 ALTER TABLE `flagged_content` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `flagged_content_events`
--

DROP TABLE IF EXISTS `flagged_content_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `flagged_content_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `flagged_content_id` bigint NOT NULL,
  `action` varchar(50) NOT NULL,
  `actor_id` bigint DEFAULT NULL,
  `from_status` varchar(30) DEFAULT NULL,
  `to_status` varchar(30) DEFAULT NULL,
  `note` varchar(1000) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_fce_actor` (`actor_id`),
  KEY `idx_fce_item` (`flagged_content_id`),
  KEY `idx_fce_created` (`created_at`),
  CONSTRAINT `fk_fce_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_fce_item` FOREIGN KEY (`flagged_content_id`) REFERENCES `flagged_content` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `flagged_content_events`
--

LOCK TABLES `flagged_content_events` WRITE;
/*!40000 ALTER TABLE `flagged_content_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `flagged_content_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `flyway_schema_history`
--

DROP TABLE IF EXISTS `flyway_schema_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `flyway_schema_history` (
  `installed_rank` int NOT NULL,
  `version` varchar(50) DEFAULT NULL,
  `description` varchar(200) NOT NULL,
  `type` varchar(20) NOT NULL,
  `script` varchar(1000) NOT NULL,
  `checksum` int DEFAULT NULL,
  `installed_by` varchar(100) NOT NULL,
  `installed_on` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `execution_time` int NOT NULL,
  `success` tinyint(1) NOT NULL,
  PRIMARY KEY (`installed_rank`),
  KEY `flyway_schema_history_s_idx` (`success`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `flyway_schema_history`
--

LOCK TABLES `flyway_schema_history` WRITE;
/*!40000 ALTER TABLE `flyway_schema_history` DISABLE KEYS */;
INSERT INTO `flyway_schema_history` VALUES (1,'1','init','SQL','V1__init.sql',-1249648016,'root','2026-06-26 15:27:56',567,1),(2,'2','chat and meeting links','SQL','V2__chat_and_meeting_links.sql',893387363,'root','2026-06-26 15:27:57',456,1),(3,'3','user profile fields','SQL','V3__user_profile_fields.sql',1956778281,'root','2026-06-26 15:27:57',131,1),(4,'4','portfolio packages roadmap verification','SQL','V4__portfolio_packages_roadmap_verification.sql',569364187,'root','2026-06-26 15:27:58',793,1),(5,'5','availability policy safety notifications watchlist search','SQL','V5__availability_policy_safety_notifications_watchlist_search.sql',1186821507,'root','2026-06-26 15:27:59',1199,1),(6,'6','mentor reviews','SQL','V6__mentor_reviews.sql',1558653810,'root','2026-06-26 15:27:59',270,1),(7,'7','user profile image','SQL','V7__user_profile_image.sql',1270587972,'root','2026-06-26 15:28:00',134,1),(8,'8','Add Google Meet Integration','SQL','V8__Add_Google_Meet_Integration.sql',-1336099222,'root','2026-06-26 15:28:00',552,1),(9,'8.1','trust safety booking upgrades','SQL','V8.1__trust_safety_booking_upgrades.sql',-968779600,'root','2026-06-26 15:28:01',1225,1),(10,'9','insert test users','SQL','V9__insert_test_users.sql',720568677,'root','2026-06-26 15:28:02',16,1),(11,'10','notification preferences and certifications','SQL','V10__notification_preferences_and_certifications.sql',-322136944,'root','2026-06-26 15:28:02',323,1),(12,'11','user last active tracking','SQL','V11__user_last_active_tracking.sql',-555923943,'root','2026-06-26 15:28:02',251,1),(13,'12','booking cancel reason','SQL','V12__booking_cancel_reason.sql',-1037191960,'root','2026-06-26 15:28:02',194,1),(14,'13','auth sessions and payment idempotency','SQL','V13__auth_sessions_and_payment_idempotency.sql',-538132043,'root','2026-06-26 15:28:03',469,1),(15,'14','booking idempotency keys','SQL','V14__booking_idempotency_keys.sql',1641039921,'root','2026-06-26 15:28:03',139,1),(16,'15','audit logs','SQL','V15__audit_logs.sql',522649838,'root','2026-06-26 15:28:03',277,1),(17,'16','wallet ledger','SQL','V16__wallet_ledger.sql',1083143145,'root','2026-06-26 15:28:04',230,1),(18,'17','access token denylist','SQL','V17__access_token_denylist.sql',567472281,'root','2026-06-26 15:28:04',117,1),(19,'18','fulltext search index','SQL','V18__fulltext_search_index.sql',-1768698554,'root','2026-06-26 15:28:05',1307,1),(20,'19','chat read receipts','SQL','V19__chat_read_receipts.sql',1722343143,'root','2026-06-26 15:28:05',122,1),(21,'20','referral system','SQL','V20__referral_system.sql',-670579796,'root','2026-06-26 15:28:08',2725,1),(22,'21','user projects','SQL','V21__user_projects.sql',-17898210,'root','2026-06-26 18:08:14',297,1),(23,'22','add review status','SQL','V22__add_review_status.sql',-1145325880,'root','2026-06-30 10:51:34',1081,1),(24,'23','mentor certifications','SQL','V23__mentor_certifications.sql',-1641593685,'root','2026-06-30 15:03:43',371,1),(25,'24','message requests and privacy','SQL','V24__message_requests_and_privacy.sql',-1336542807,'root','2026-07-01 02:22:04',2747,1),(26,'25','mentor review replies','SQL','V25__mentor_review_replies.sql',-165163680,'root','2026-07-03 16:57:10',445,1),(27,'26','mentor profile fields','SQL','V26__mentor_profile_fields.sql',1312899298,'root','2026-07-08 12:40:07',2673,1),(28,'27','payment adapter pattern','SQL','V27__payment_adapter_pattern.sql',531170752,'root','2026-07-08 12:40:08',1003,1),(29,'28','direct message read receipts','SQL','V28__direct_message_read_receipts.sql',-191200713,'root','2026-07-09 09:18:16',389,1),(30,'29','admin settings and notif preferences','SQL','V29__admin_settings_and_notif_preferences.sql',1950649158,'root','2026-07-10 07:23:09',4180,1),(31,'30','audit logs admin columns','SQL','V30__audit_logs_admin_columns.sql',1095888544,'root','2026-07-10 07:52:42',0,1),(32,'31','users admin sub role','SQL','V31__users_admin_sub_role.sql',-2103158943,'root','2026-07-10 07:56:31',1912,1),(33,'32','login attempts','SQL','V32__login_attempts.sql',-869552715,'root','2026-07-25 08:37:49',451,1),(34,'33','password reset token','SQL','V33__password_reset_token.sql',-679662495,'root','2026-07-25 08:49:52',1964,1),(35,'34','session requests','SQL','V34__session_requests.sql',-1849339313,'root','2026-07-26 09:50:54',448,1),(36,'35','session requests reply','SQL','V35__session_requests_reply.sql',-1721614016,'root','2026-07-26 09:50:54',136,1),(37,'36','session requests extra fields','SQL','V36__session_requests_extra_fields.sql',-861062560,'root','2026-07-28 16:40:45',305,1),(38,'37','align mentor certifications schema','SQL','V37__align_mentor_certifications_schema.sql',2096289337,'root','2026-07-30 13:20:41',576,1),(39,'38','add username to users','SQL','V38__add_username_to_users.sql',-202338565,'root','2026-07-30 13:27:24',3004,1),(40,'39','seed sample data','SQL','V39__seed_sample_data.sql',970895765,'root','2026-07-30 17:35:53',72,1),(41,'40','mentor verification enrichment','SQL','V40__mentor_verification_enrichment.sql',360192637,'root','2026-07-31 12:30:54',1713,1),(42,'41','skill requests','SQL','V41__skill_requests.sql',-1053834480,'root','2026-07-31 12:30:54',224,1),(43,'42','reports complaints extension','SQL','V42__reports_complaints_extension.sql',-1014980658,'root','2026-07-31 12:30:54',220,1),(44,'43','seed skills catalog','SQL','V43__seed_skills_catalog.sql',-2058689221,'root','2026-07-31 13:32:47',1827,1),(45,'44','reports moderation workflow','SQL','V44__reports_moderation_workflow.sql',136316422,'root','2026-08-01 10:03:14',599,1),(46,'45','content moderation center','SQL','V45__content_moderation_center.sql',-1522884616,'root','2026-08-01 10:29:18',1490,1),(47,'46','notification broadcast center','SQL','V46__notification_broadcast_center.sql',1483619852,'root','2026-08-01 13:22:22',2197,1),(48,'47','audit log activity timeline','SQL','V47__audit_log_activity_timeline.sql',-922528600,'root','2026-08-02 07:51:52',1661,1),(49,'48','login attempt type','SQL','V48__login_attempt_type.sql',1091420863,'root','2026-08-03 07:14:15',388,1),(50,'49','stored files','SQL','V49__stored_files.sql',-1678891111,'root','2026-08-03 07:14:16',656,1),(51,'50','purge seeded demo data','SQL','V50__purge_seeded_demo_data.sql',277799172,'root','2026-08-03 08:26:08',2135,1),(52,'51','favorite mentors index','SQL','V51__favorite_mentors_index.sql',1999087091,'root','2026-08-03 15:09:06',210,1),(53,'52','mentor verification application','SQL','V52__mentor_verification_application.sql',1340610777,'root','2026-08-04 17:40:42',495,1),(54,'53','mentor verification document optional','SQL','V53__mentor_verification_document_optional.sql',-2000497735,'root','2026-08-04 17:40:43',214,1),(55,'54','chat reactions pin archive','SQL','V54__chat_reactions_pin_archive.sql',-753667556,'root','2026-08-04 19:41:02',221,1),(56,'55','profile completion flow','SQL','V55__profile_completion_flow.sql',298691318,'root','2026-08-06 11:15:11',2665,1),(57,'56','username lowercase unique','SQL','V56__username_lowercase_unique.sql',-1769522814,'root','2026-08-06 11:15:14',3022,1),(58,'57','mentor verification status','SQL','V57__mentor_verification_status.sql',1808179567,'root','2026-08-07 06:33:51',1769,1);
/*!40000 ALTER TABLE `flyway_schema_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learner_reviews`
--

DROP TABLE IF EXISTS `learner_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learner_reviews` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `booking_id` bigint NOT NULL,
  `mentor_id` bigint NOT NULL,
  `learner_id` bigint NOT NULL,
  `rating` int NOT NULL,
  `comment` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) NOT NULL DEFAULT 'APPROVED',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_learner_reviews_booking` (`booking_id`),
  KEY `idx_learner_reviews_learner_created` (`learner_id`,`created_at` DESC),
  KEY `idx_learner_reviews_mentor` (`mentor_id`),
  KEY `idx_learner_reviews_status_created` (`status`,`created_at` DESC),
  CONSTRAINT `fk_learner_reviews_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`),
  CONSTRAINT `fk_learner_reviews_learner` FOREIGN KEY (`learner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_learner_reviews_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_learner_reviews_rating` CHECK (((`rating` >= 1) and (`rating` <= 5)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learner_reviews`
--

LOCK TABLES `learner_reviews` WRITE;
/*!40000 ALTER TABLE `learner_reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `learner_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_roadmaps`
--

DROP TABLE IF EXISTS `learning_roadmaps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_roadmaps` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `booking_id` bigint NOT NULL,
  `title` varchar(255) NOT NULL,
  `milestones` text NOT NULL,
  `progress_percent` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `booking_id` (`booking_id`),
  KEY `idx_roadmaps_booking` (`booking_id`),
  CONSTRAINT `fk_learning_roadmaps_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_roadmaps`
--

LOCK TABLES `learning_roadmaps` WRITE;
/*!40000 ALTER TABLE `learning_roadmaps` DISABLE KEYS */;
INSERT INTO `learning_roadmaps` VALUES (5,43,'Roadmap: Java','[{\"title\":\"Kickoff and current level check\",\"status\":\"PENDING\"},{\"title\":\"Core concepts for Java\",\"status\":\"PENDING\"},{\"title\":\"Hands-on assignment\",\"status\":\"PENDING\"},{\"title\":\"Review and next-step plan\",\"status\":\"PENDING\"}]',10,'2026-08-04 08:09:16','2026-08-04 08:14:15');
/*!40000 ALTER TABLE `learning_roadmaps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `login_attempts`
--

DROP TABLE IF EXISTS `login_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_attempts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attempt_count` int NOT NULL DEFAULT '1',
  `last_attempt_at` datetime(6) NOT NULL,
  `blocked_until` datetime(6) DEFAULT NULL,
  `expires_at` datetime(6) DEFAULT NULL,
  `attempt_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'LOGIN',
  PRIMARY KEY (`id`),
  KEY `idx_login_attempts_ip` (`ip_address`),
  KEY `idx_login_attempts_email` (`email`),
  KEY `idx_login_attempts_expires` (`expires_at`),
  KEY `idx_login_attempts_ip_type` (`ip_address`,`attempt_type`)
) ENGINE=InnoDB AUTO_INCREMENT=109 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_attempts`
--

LOCK TABLES `login_attempts` WRITE;
/*!40000 ALTER TABLE `login_attempts` DISABLE KEYS */;
INSERT INTO `login_attempts` VALUES (108,'0:0:0:0:0:0:0:1','12657',1,'2026-08-06 17:40:19.752764',NULL,'2026-08-07 17:40:19.752764','LOGIN');
/*!40000 ALTER TABLE `login_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mentor_certifications`
--

DROP TABLE IF EXISTS `mentor_certifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mentor_certifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `mentor_id` bigint NOT NULL,
  `certification_name` varchar(500) NOT NULL,
  `issuing_organization` varchar(500) NOT NULL,
  `credential_id` varchar(500) DEFAULT NULL,
  `credential_url` varchar(1000) DEFAULT NULL,
  `issue_date` date NOT NULL,
  `expiration_date` date DEFAULT NULL,
  `does_not_expire` tinyint(1) NOT NULL DEFAULT '0',
  `skills_covered` text,
  `description` text,
  `certificate_image` varchar(1000) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mentor_certifications_mentor_id` (`mentor_id`),
  CONSTRAINT `fk_mentor_certifications_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mentor_certifications`
--

LOCK TABLES `mentor_certifications` WRITE;
/*!40000 ALTER TABLE `mentor_certifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `mentor_certifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mentor_reviews`
--

DROP TABLE IF EXISTS `mentor_reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mentor_reviews` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `booking_id` bigint NOT NULL,
  `mentor_id` bigint NOT NULL,
  `learner_id` bigint NOT NULL,
  `rating` int NOT NULL,
  `comment` text,
  `reply_text` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) NOT NULL DEFAULT 'APPROVED',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mentor_reviews_booking` (`booking_id`),
  KEY `idx_mentor_reviews_mentor_created` (`mentor_id`,`created_at` DESC),
  KEY `idx_mentor_reviews_learner` (`learner_id`),
  KEY `idx_mentor_reviews_status_created` (`status`,`created_at` DESC),
  CONSTRAINT `fk_mentor_reviews_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`),
  CONSTRAINT `fk_mentor_reviews_learner` FOREIGN KEY (`learner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_mentor_reviews_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_mentor_reviews_rating` CHECK (((`rating` >= 1) and (`rating` <= 5)))
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mentor_reviews`
--

LOCK TABLES `mentor_reviews` WRITE;
/*!40000 ALTER TABLE `mentor_reviews` DISABLE KEYS */;
INSERT INTO `mentor_reviews` VALUES (22,29,49,54,5,'Priya is an incredible mentor. She took the time to understand my career goals and tailored each session around real problems I would face in production. Her system design sessions were mind-opening.',NULL,'2026-06-04 08:26:32','APPROVED'),(23,31,50,54,5,'Raj made ML concepts that felt overwhelming suddenly click. His production deployment walkthrough was exactly what I needed to understand MLOps.',NULL,'2026-07-04 08:26:32','APPROVED'),(24,32,50,55,5,'The fraud detection case study was fascinating. Raj explains complex algorithms in a way that makes them feel approachable.',NULL,'2026-07-14 08:26:32','APPROVED'),(25,33,51,54,4,'Sarahs system design sessions are world-class. She uses real Netflix examples which makes abstract concepts concrete.',NULL,'2026-07-19 08:26:32','APPROVED'),(26,34,52,55,5,'Amits project-based approach is exactly what I needed. We built and deployed a full-stack app together over 6 sessions.',NULL,'2026-07-24 08:26:32','APPROVED'),(27,35,53,54,5,'Emma helped me transition from a junior dev role into a DevOps engineer position. Her Terraform workshops were incredibly valuable.',NULL,'2026-07-29 08:26:32','APPROVED');
/*!40000 ALTER TABLE `mentor_reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mentor_verification_requests`
--

DROP TABLE IF EXISTS `mentor_verification_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mentor_verification_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `mentor_id` bigint NOT NULL,
  `document_url` varchar(1000) DEFAULT NULL,
  `document_type` varchar(100) DEFAULT NULL,
  `status` varchar(50) NOT NULL,
  `admin_note` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` bigint DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `skills` text,
  `years_of_experience` int DEFAULT NULL,
  `bio` text,
  `resume_url` varchar(1000) DEFAULT NULL,
  `certificate_urls` text,
  `linkedin_url` varchar(500) DEFAULT NULL,
  `github_url` varchar(500) DEFAULT NULL,
  `portfolio_url` varchar(500) DEFAULT NULL,
  `hourly_rate` decimal(12,2) DEFAULT NULL,
  `availability` varchar(255) DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `requested_info` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_verification_mentor_created` (`mentor_id`,`created_at` DESC),
  KEY `idx_verification_status_created` (`status`,`created_at`),
  CONSTRAINT `fk_verification_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mentor_verification_requests`
--

LOCK TABLES `mentor_verification_requests` WRITE;
/*!40000 ALTER TABLE `mentor_verification_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `mentor_verification_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mentor_wallets`
--

DROP TABLE IF EXISTS `mentor_wallets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mentor_wallets` (
  `mentor_id` bigint NOT NULL,
  `total_earnings` decimal(12,2) NOT NULL DEFAULT '0.00',
  `available_balance` decimal(12,2) NOT NULL DEFAULT '0.00',
  `pending_balance` decimal(12,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`mentor_id`),
  CONSTRAINT `fk_mentor_wallets_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mentor_wallets`
--

LOCK TABLES `mentor_wallets` WRITE;
/*!40000 ALTER TABLE `mentor_wallets` DISABLE KEYS */;
INSERT INTO `mentor_wallets` VALUES (1,0.00,0.00,0.00,'2026-07-29 16:43:19');
/*!40000 ALTER TABLE `mentor_wallets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `message_requests`
--

DROP TABLE IF EXISTS `message_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `message_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `sender_id` bigint NOT NULL,
  `receiver_id` bigint NOT NULL,
  `first_message` text,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_message_requests_receiver_status` (`receiver_id`,`status`),
  KEY `idx_message_requests_sender_receiver` (`sender_id`,`receiver_id`),
  CONSTRAINT `fk_message_requests_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_message_requests_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `message_requests`
--

LOCK TABLES `message_requests` WRITE;
/*!40000 ALTER TABLE `message_requests` DISABLE KEYS */;
INSERT INTO `message_requests` VALUES (1,63,2,'Hi! I would like to connect and discuss our learning goals.','PENDING','2026-08-04 22:00:01','2026-08-04 22:00:01'),(2,63,62,'Hi! I would like to connect and discuss our learning goals.','PENDING','2026-08-04 22:00:16','2026-08-04 22:00:16');
/*!40000 ALTER TABLE `message_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_broadcasts`
--

DROP TABLE IF EXISTS `notification_broadcasts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_broadcasts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `subtitle` varchar(500) DEFAULT NULL,
  `message` text NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'ANNOUNCEMENT',
  `priority` varchar(20) NOT NULL DEFAULT 'MEDIUM',
  `status` varchar(30) NOT NULL DEFAULT 'DRAFT',
  `target_scope` varchar(40) NOT NULL DEFAULT 'ALL',
  `target_detail` text,
  `schedule_time` datetime(6) DEFAULT NULL,
  `sent_at` datetime(6) DEFAULT NULL,
  `expires_at` datetime(6) DEFAULT NULL,
  `repeat_type` varchar(20) NOT NULL DEFAULT 'NONE',
  `action_button_text` varchar(100) DEFAULT NULL,
  `action_url` varchar(1000) DEFAULT NULL,
  `total_targets` int NOT NULL DEFAULT '0',
  `delivered_count` int NOT NULL DEFAULT '0',
  `read_count` int NOT NULL DEFAULT '0',
  `clicked_count` int NOT NULL DEFAULT '0',
  `failed_count` int NOT NULL DEFAULT '0',
  `created_by` bigint DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `cancelled_at` datetime(6) DEFAULT NULL,
  `archived_at` datetime(6) DEFAULT NULL,
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_broadcast_created_by` (`created_by`),
  KEY `idx_broadcast_status` (`status`),
  KEY `idx_broadcast_type` (`type`),
  KEY `idx_broadcast_priority` (`priority`),
  KEY `idx_broadcast_schedule` (`schedule_time`),
  KEY `idx_broadcast_created` (`created_at`),
  CONSTRAINT `fk_broadcast_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_broadcasts`
--

LOCK TABLES `notification_broadcasts` WRITE;
/*!40000 ALTER TABLE `notification_broadcasts` DISABLE KEYS */;
INSERT INTO `notification_broadcasts` VALUES (1,'Live verify test',NULL,'This broadcast was created by the live verification run.','PLATFORM_UPDATE','HIGH','SENT','SPECIFIC_USERS','{\"userIds\":[1]}',NULL,'2026-08-01 13:28:28.178416',NULL,'NONE',NULL,NULL,1,1,0,0,0,1,'2026-08-01 13:28:28.098826','2026-08-01 13:28:28.178416',NULL,NULL,NULL);
/*!40000 ALTER TABLE `notification_broadcasts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notification_preferences`
--

DROP TABLE IF EXISTS `notification_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notification_preferences` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `email_enabled` tinyint(1) NOT NULL DEFAULT '1',
  `booking_updates` tinyint(1) NOT NULL DEFAULT '1',
  `session_announcements` tinyint(1) NOT NULL DEFAULT '1',
  `review_alerts` tinyint(1) NOT NULL DEFAULT '1',
  `certification_alerts` tinyint(1) NOT NULL DEFAULT '1',
  `role_change_alerts` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_notification_preferences_user` (`user_id`),
  KEY `idx_notification_preferences_user` (`user_id`),
  CONSTRAINT `fk_notification_preferences_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notification_preferences`
--

LOCK TABLES `notification_preferences` WRITE;
/*!40000 ALTER TABLE `notification_preferences` DISABLE KEYS */;
INSERT INTO `notification_preferences` VALUES (1,1,1,1,1,1,1,1,'2026-07-29 16:43:19','2026-07-29 16:43:19'),(4,2,1,1,1,1,1,1,'2026-07-30 07:07:26','2026-07-30 07:07:26'),(6,53,1,1,1,1,1,1,'2026-08-03 08:36:28','2026-08-03 08:36:28'),(8,50,1,1,1,1,1,1,'2026-08-03 10:04:18','2026-08-03 10:04:18'),(9,47,1,1,1,1,1,1,'2026-08-03 12:15:40','2026-08-03 12:15:40'),(10,62,1,1,1,1,1,1,'2026-08-04 00:54:39','2026-08-04 00:54:39'),(11,48,1,1,1,1,1,1,'2026-08-04 03:38:20','2026-08-04 03:38:20'),(12,63,1,1,1,1,1,1,'2026-08-04 08:09:16','2026-08-04 08:09:16'),(13,49,1,1,1,1,1,1,'2026-08-05 03:19:54','2026-08-05 03:19:54');
/*!40000 ALTER TABLE `notification_preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_idempotency_keys`
--

DROP TABLE IF EXISTS `payment_idempotency_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_idempotency_keys` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `endpoint` varchar(120) NOT NULL,
  `idempotency_key` varchar(120) NOT NULL,
  `request_hash` varchar(255) NOT NULL,
  `payment_id` bigint DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment_idempotency` (`user_id`,`endpoint`,`idempotency_key`),
  KEY `fk_payment_idempotency_payment` (`payment_id`),
  CONSTRAINT `fk_payment_idempotency_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_idempotency_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_idempotency_keys`
--

LOCK TABLES `payment_idempotency_keys` WRITE;
/*!40000 ALTER TABLE `payment_idempotency_keys` DISABLE KEYS */;
INSERT INTO `payment_idempotency_keys` VALUES (1,58,'payments.intent','booking_36','36|85|razorpay',NULL,'2026-08-03 10:03:05'),(2,58,'payments.intent','booking_37','37|90|razorpay',NULL,'2026-08-03 10:04:18'),(3,62,'payments.intent','request_pay_1_1785824879704','41|100|razorpay',5,'2026-08-04 00:58:00'),(4,62,'payments.intent','request_pay_1_1785824882107','41|100|razorpay',6,'2026-08-04 00:58:02'),(5,62,'payments.intent','-api-v1-payments-intent-1785831219009-2','41|100|razorpay',7,'2026-08-04 02:43:39'),(6,62,'payments.intent','booking_43','43|200|razorpay',8,'2026-08-04 08:09:16');
/*!40000 ALTER TABLE `payment_idempotency_keys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` varchar(255) NOT NULL,
  `payment_id` varchar(255) DEFAULT NULL,
  `signature` varchar(255) DEFAULT NULL,
  `learner_id` bigint NOT NULL,
  `mentor_id` bigint NOT NULL,
  `session_id` bigint NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(20) NOT NULL DEFAULT 'INR',
  `status` varchar(50) NOT NULL,
  `gateway` varchar(50) NOT NULL DEFAULT 'razorpay',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_id` (`order_id`),
  KEY `fk_payments_learner` (`learner_id`),
  KEY `fk_payments_mentor` (`mentor_id`),
  KEY `fk_payments_session` (`session_id`),
  CONSTRAINT `fk_payments_learner` FOREIGN KEY (`learner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payments_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payments_session` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
INSERT INTO `payments` VALUES (5,'ORDER_93CC836EB9F442C4',NULL,NULL,62,2,34,100.00,'INR','INITIATED','razorpay','2026-08-04 00:58:00'),(6,'ORDER_1AD6A908C2104107',NULL,NULL,62,2,34,100.00,'INR','INITIATED','razorpay','2026-08-04 00:58:02'),(7,'ORDER_5F11B8A17166480F',NULL,NULL,62,2,34,100.00,'INR','INITIATED','razorpay','2026-08-04 02:43:39'),(8,'ORDER_75F08EC90A334CC3',NULL,NULL,62,63,36,200.00,'INR','INITIATED','razorpay','2026-08-04 08:09:16');
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `referral_rewards`
--

DROP TABLE IF EXISTS `referral_rewards`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `referral_rewards` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `referrer_id` bigint NOT NULL,
  `referee_id` bigint NOT NULL,
  `booking_id` bigint NOT NULL,
  `rewarded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_referee_reward` (`referee_id`),
  KEY `fk_rr_referrer` (`referrer_id`),
  KEY `fk_rr_booking` (`booking_id`),
  CONSTRAINT `fk_rr_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`),
  CONSTRAINT `fk_rr_referee` FOREIGN KEY (`referee_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_rr_referrer` FOREIGN KEY (`referrer_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `referral_rewards`
--

LOCK TABLES `referral_rewards` WRITE;
/*!40000 ALTER TABLE `referral_rewards` DISABLE KEYS */;
/*!40000 ALTER TABLE `referral_rewards` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_token_sessions`
--

DROP TABLE IF EXISTS `refresh_token_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_token_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `token_id` varchar(128) NOT NULL,
  `revoked` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_refresh_token_sessions_token_id` (`token_id`),
  KEY `idx_refresh_token_sessions_user_revoked_expiry` (`user_id`,`revoked`,`expires_at`),
  CONSTRAINT `fk_refresh_token_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=285 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_token_sessions`
--

LOCK TABLES `refresh_token_sessions` WRITE;
/*!40000 ALTER TABLE `refresh_token_sessions` DISABLE KEYS */;
INSERT INTO `refresh_token_sessions` VALUES (5,1,'c57b29cb-6d32-4361-989d-a5ebf11cc7e1',0,'2026-07-30 08:00:34','2026-08-06 08:00:34'),(10,1,'19e29c3d-d811-47fc-8b10-68ac14cf091b',0,'2026-07-30 08:25:36','2026-08-06 08:25:36'),(11,1,'1c7c693c-a1b1-46e9-9019-b4263a8b2316',0,'2026-07-30 08:30:28','2026-08-06 08:30:28'),(12,1,'0ee962bb-5f8f-4cad-9d1a-4505ae4ab963',0,'2026-07-30 08:36:36','2026-08-06 08:36:36'),(13,3,'d2842385-031a-4a69-ac3b-0c739322fd13',0,'2026-07-30 08:36:37','2026-08-06 08:36:37'),(14,3,'9ee33f95-3a48-4809-9992-692c02552828',0,'2026-07-30 08:36:38','2026-08-06 08:36:37'),(15,3,'bb4f6760-6e31-49d7-b6d5-7ad68cbcf080',0,'2026-07-30 08:39:13','2026-08-06 08:39:12'),(16,3,'f275af3d-d52b-42bb-ad92-d78556f91379',0,'2026-07-30 08:40:03','2026-08-06 08:40:03'),(23,1,'27a19cc8-68b4-4cb1-ba8e-642cf424502c',0,'2026-07-30 10:06:52','2026-08-06 10:06:52'),(24,3,'c959022b-3325-4b3f-a99c-504855ff9da4',0,'2026-07-30 10:06:53','2026-08-06 10:06:53'),(25,4,'b8567d47-b84d-4993-a3eb-cb09febf8587',0,'2026-07-30 10:06:54','2026-08-06 10:06:54'),(26,3,'edc92c1c-e22c-4988-b6c4-9b195e2b3f30',0,'2026-07-30 10:09:10','2026-08-06 10:09:10'),(27,1,'34aa9c5d-ea49-4e23-aeed-061ce96e1f51',0,'2026-07-30 10:11:56','2026-08-06 10:11:55'),(28,1,'71e70d87-4509-4325-a61c-4a3a6283357d',0,'2026-07-30 10:23:14','2026-08-06 10:23:14'),(35,26,'eb333bd1-8961-4082-9efc-c685ebf347bb',0,'2026-07-30 12:12:11','2026-08-06 12:12:11'),(36,26,'053cd5da-43ff-4daa-90e9-9abd53f069d0',0,'2026-07-30 12:12:24','2026-08-06 12:12:24'),(37,26,'33a59e45-481b-46a9-812a-7ee2d616b0bb',0,'2026-07-30 12:12:24','2026-08-06 12:12:24'),(38,26,'68b9a6dc-9a25-4466-b35f-599d6b198cd8',0,'2026-07-30 12:17:17','2026-08-06 12:17:16'),(39,26,'914a57bd-41ed-48f5-9b32-afcc11ef2b5a',0,'2026-07-30 12:22:58','2026-08-06 12:22:58'),(42,26,'aeadb72a-09ea-487a-a1f6-ba0de2d907af',0,'2026-07-30 12:24:28','2026-08-06 12:24:27'),(44,26,'b73a72ac-b9b6-4f1e-b17c-76c4406639fb',0,'2026-07-30 12:26:19','2026-08-06 12:26:18'),(47,26,'daec613b-4bea-4b75-b80c-4fbf00fe8263',0,'2026-07-30 12:32:38','2026-08-06 12:32:38'),(50,26,'fb657419-8fb5-4724-99fa-ba40716903f0',0,'2026-07-30 12:38:37','2026-08-06 12:38:36'),(53,26,'2110a475-d6cb-4f7a-b8fb-b4d42b9d2945',0,'2026-07-30 12:40:18','2026-08-06 12:40:18'),(56,26,'9a62ee7a-e10c-451f-8515-1dc70c1b7563',0,'2026-07-30 12:41:16','2026-08-06 12:41:16'),(59,26,'eea12338-ccc0-45c6-8350-a48c0fce99b0',0,'2026-07-30 12:43:31','2026-08-06 12:43:31'),(62,26,'f3e5e5d0-b605-44d1-84db-004a8debbc5c',0,'2026-07-30 12:44:20','2026-08-06 12:44:20'),(65,26,'7ee2bb50-a4dc-41ec-a7eb-6d3a426a04c1',0,'2026-07-30 12:46:46','2026-08-06 12:46:45'),(68,26,'193e0d72-5a9d-4f6e-a4cc-6f0a83645fc8',0,'2026-07-30 12:48:45','2026-08-06 12:48:44'),(71,26,'f82738fc-6ffb-4784-8b95-09576e58f4d6',0,'2026-07-30 13:02:50','2026-08-06 13:02:50'),(72,1,'43ad2022-11b6-4dc4-8529-91a2fe0d2362',0,'2026-07-31 07:13:32','2026-08-07 07:13:32'),(73,1,'1ad8be03-ca86-4c8a-aca2-dc08f3671680',0,'2026-07-31 07:15:55','2026-08-07 07:15:55'),(75,1,'5882c9dd-a328-4941-8ad6-118c7e9086d0',0,'2026-07-31 07:18:21','2026-08-07 07:18:20'),(76,1,'4234346e-e42c-4463-a267-83de35f746f6',0,'2026-07-31 07:18:47','2026-08-07 07:18:47'),(77,1,'8dcdcd02-0d44-4518-a9e5-1d758711c483',0,'2026-07-31 07:48:43','2026-08-07 07:48:42'),(78,26,'d1275279-d842-4b01-b89e-aceae73d44ee',0,'2026-07-31 07:57:33','2026-08-07 07:57:33'),(80,1,'38933032-f3a9-4272-93b9-e91ecb579abc',0,'2026-07-31 08:03:20','2026-08-07 08:03:19'),(82,26,'98d3666c-9edf-40f4-95d3-d8740ba4f950',0,'2026-07-31 08:03:21','2026-08-07 08:03:21'),(83,1,'8ce92ecf-2672-45a6-bbcc-ab3ad6e875ef',0,'2026-07-31 08:04:32','2026-08-07 08:04:32'),(84,1,'9f34392d-a7df-4f0c-951a-11ff4815161d',0,'2026-07-31 08:09:00','2026-08-07 08:09:00'),(85,1,'4daa8fae-ba3c-49f2-b003-abca10cd9e21',0,'2026-07-31 08:15:34','2026-08-07 08:15:33'),(86,26,'a5abdf86-9012-4e8b-a131-3d9035e3eec2',0,'2026-07-31 08:22:26','2026-08-07 08:22:26'),(89,26,'f7bc4c89-dbb3-4120-a597-99d2c8d737d9',0,'2026-07-31 08:59:31','2026-08-07 08:59:30'),(92,26,'ba935dd0-5c52-4849-a8bb-255d2a82e031',0,'2026-07-31 09:11:26','2026-08-07 09:11:26'),(96,1,'db4f187b-cfc7-49e6-a083-66b1bd382da0',0,'2026-08-01 03:33:14','2026-08-08 03:33:14'),(97,1,'967aa742-8d15-4a2b-a3dd-0ae35a342a7f',0,'2026-08-01 03:33:38','2026-08-08 03:33:38'),(98,1,'9cce8b26-f1da-4cf4-abde-89e03a8c68aa',0,'2026-08-01 03:35:16','2026-08-08 03:35:15'),(99,1,'9e045f02-b44b-4d72-a1f2-0f8ebb4941b4',0,'2026-08-01 03:42:03','2026-08-08 03:42:03'),(100,1,'b78583b3-873f-4a1c-800e-833f540f6cb7',0,'2026-08-01 03:43:29','2026-08-08 03:43:28'),(101,1,'94139c56-9403-4a9a-9088-9cf12bfc5978',0,'2026-08-01 04:03:08','2026-08-08 04:03:08'),(102,1,'7efb22e9-de76-4903-abd9-5ea393778e40',0,'2026-08-01 04:08:59','2026-08-08 04:08:59'),(103,1,'b3d5dc16-f1b8-421a-8bab-da4e83667e8c',0,'2026-08-01 04:37:20','2026-08-08 04:37:20'),(104,1,'002a046a-a107-4e1a-83d5-8cc2d26105d4',0,'2026-08-01 05:04:00','2026-08-08 05:04:00'),(105,1,'8b758f2b-f4f9-48b1-9c05-ab934a95914c',0,'2026-08-01 05:04:24','2026-08-08 05:04:24'),(106,1,'1719b0aa-3292-414f-8a9a-8d1a02208403',0,'2026-08-01 05:04:53','2026-08-08 05:04:52'),(107,1,'e02238c1-d65e-4cc1-85ea-6d15559e287e',0,'2026-08-01 05:09:07','2026-08-08 05:09:07'),(108,1,'621e500a-e238-4479-81eb-8c945f700f05',0,'2026-08-01 05:11:09','2026-08-08 05:11:09'),(109,1,'699cb107-419f-4aa0-96a1-f97dba49560c',0,'2026-08-01 06:35:26','2026-08-08 06:35:26'),(110,1,'0110072c-6258-42b1-830f-7570b7af6f47',0,'2026-08-01 07:57:59','2026-08-08 07:57:58'),(111,47,'5cd3fa9a-9c35-444a-b702-f3c90921d9bf',0,'2026-08-03 05:54:33','2026-08-10 05:54:33'),(112,47,'5ad346a6-7295-431f-bfc1-e79eca13af4b',0,'2026-08-03 05:54:54','2026-08-10 05:54:53'),(113,48,'2057fe13-d6c0-4b4f-b79d-2c29e8a840b1',0,'2026-08-03 06:17:55','2026-08-10 06:17:55'),(114,47,'0eb50df8-20f7-4a6e-ae37-cf18c31f0f44',0,'2026-08-03 06:27:50','2026-08-10 06:27:49'),(115,47,'cb4f25f0-8d8f-4a25-8e77-b72e41c09d45',0,'2026-08-03 06:28:22','2026-08-10 06:28:22'),(116,47,'18f08ace-8966-4209-a779-1ca14971e5d1',0,'2026-08-03 06:46:24','2026-08-10 06:46:23'),(117,47,'befd368d-06e9-4e3d-a1d3-a59018dba4b1',0,'2026-08-03 06:46:24','2026-08-10 06:46:24'),(118,47,'7ed9d51c-c3bc-42f4-9ec1-1f6957aeb84e',0,'2026-08-03 06:46:25','2026-08-10 06:46:25'),(131,48,'75e0279f-3956-4a42-a237-e4b974751c52',0,'2026-08-03 11:46:45','2026-08-10 11:46:44'),(132,48,'49cd56c7-9183-493e-be99-2e3d9273c6da',0,'2026-08-03 11:49:30','2026-08-10 11:49:30'),(133,48,'3505ce86-436b-404d-8aae-1662292e4d08',0,'2026-08-03 12:07:03','2026-08-10 12:07:02'),(134,48,'4b9bfced-e904-4a95-8f14-41631d49c1a0',0,'2026-08-03 12:07:39','2026-08-10 12:07:38'),(135,47,'d8fa9c02-0acc-44d2-badd-a222b0351cee',0,'2026-08-03 12:14:39','2026-08-10 12:14:38'),(136,47,'14872030-9d9d-4bea-97a4-7bf1cf01be1d',0,'2026-08-03 12:15:39','2026-08-10 12:15:38'),(137,48,'a7036348-48bb-4f4d-aec9-b54ba0b57f74',0,'2026-08-03 12:15:40','2026-08-10 12:15:39'),(138,47,'ebb54040-24a0-4a37-a298-60f0198076df',0,'2026-08-03 12:18:50','2026-08-10 12:18:49'),(139,48,'e832fdf0-95b2-4b68-9080-1c03978ed559',0,'2026-08-03 12:18:51','2026-08-10 12:18:50'),(140,48,'276042b5-e04e-42b1-904c-853e99fae755',0,'2026-08-03 12:22:38','2026-08-10 12:22:38'),(145,2,'6e028e04-e796-442e-9b65-5aa2eb56b163',0,'2026-08-04 00:54:25','2026-08-11 00:54:25'),(147,48,'6b152b92-3656-4a23-8dfa-3701dedf3d3d',0,'2026-08-04 03:36:28','2026-08-11 03:36:27'),(148,48,'8188145f-de37-4696-beac-e3cd5d92c571',0,'2026-08-04 03:37:02','2026-08-11 03:37:01'),(149,48,'9c03cc69-9328-44e3-94ae-3f9d58f2592f',0,'2026-08-04 03:37:38','2026-08-11 03:37:37'),(150,47,'982e2032-aec9-4d2d-9288-c89cf50a83ff',0,'2026-08-04 03:37:39','2026-08-11 03:37:38'),(151,48,'414c463e-fcb2-4742-8b0b-a0ecf317e755',0,'2026-08-04 03:37:57','2026-08-11 03:37:56'),(152,48,'d3eb6a6a-1eec-4ac4-aa3e-b781866b0e15',0,'2026-08-04 03:38:19','2026-08-11 03:38:18'),(153,47,'e53bb7f8-278e-4251-9fcf-4e1dfa79db51',0,'2026-08-04 03:38:20','2026-08-11 03:38:19'),(154,48,'2c092c94-4f5d-49f4-8800-8bca86ee9503',0,'2026-08-04 03:40:40','2026-08-11 03:40:39'),(155,48,'d58bcd86-8fff-4c67-b521-6e83d56f88f5',0,'2026-08-04 03:41:19','2026-08-11 03:41:18'),(156,48,'b6305fa6-9ead-48fa-aa91-a0f6e38355c6',0,'2026-08-04 03:45:37','2026-08-11 03:45:36'),(157,1,'0fbea127-17e2-4bbe-9cd0-57cc1e7b19e5',0,'2026-08-04 03:47:32','2026-08-11 03:47:32'),(158,1,'81a46fe5-7e45-4897-b101-73b9ad3f89f4',0,'2026-08-04 04:43:56','2026-08-11 04:43:55'),(159,1,'1a75333c-c918-42ca-bb22-f8fade257d0c',0,'2026-08-04 04:44:15','2026-08-11 04:44:15'),(160,48,'0f7e6097-e6d4-4b45-a1e4-029dc08fbcc5',0,'2026-08-04 04:44:43','2026-08-11 04:44:43'),(161,1,'35c7066f-7a65-4318-9fa8-0ffa2bce6b33',0,'2026-08-04 04:45:09','2026-08-11 04:45:09'),(162,48,'7125579d-dead-4f74-88b5-3f0181dffa93',0,'2026-08-04 04:45:37','2026-08-11 04:45:36'),(163,48,'7c484687-c6b6-4a26-b14d-5ecb021af7cb',0,'2026-08-04 04:46:27','2026-08-11 04:46:27'),(164,48,'2fdc70e9-3c64-42d9-b2ca-615dc5c687fd',0,'2026-08-04 04:49:12','2026-08-11 04:49:11'),(165,48,'b2df71e3-ea9e-4b4b-b59b-e2865f255bc0',0,'2026-08-04 04:50:24','2026-08-11 04:50:24'),(166,1,'86039000-01d3-4eac-898e-8c3c088dd0f9',0,'2026-08-04 04:52:07','2026-08-11 04:52:07'),(169,62,'c6f2f727-dbd1-4b00-8ab9-67bcd7ac6e83',0,'2026-08-04 08:08:22','2026-08-11 08:08:21'),(174,49,'262bb300-9646-4f11-a9d0-1be5224098da',0,'2026-08-05 03:18:46','2026-08-12 03:18:45'),(175,53,'634cb0c0-a798-4b42-bc43-6042112541be',0,'2026-08-05 03:18:46','2026-08-12 03:18:46'),(176,52,'73eb81a7-17cb-402f-af46-8dee8e228ff3',0,'2026-08-05 03:18:47','2026-08-12 03:18:47'),(177,51,'c1ad7874-96bb-44b6-aaf2-60577c9b0264',0,'2026-08-05 03:18:48','2026-08-12 03:18:47'),(178,50,'6552482e-a9c2-4f02-997f-2e0da3b16536',0,'2026-08-05 03:18:49','2026-08-12 03:18:48'),(179,49,'67c66683-fb52-4565-97b8-ef8d97233926',0,'2026-08-05 03:19:02','2026-08-12 03:19:02'),(180,49,'28646434-9243-499a-893e-4a9aacc52036',0,'2026-08-05 03:34:42','2026-08-12 03:34:42'),(181,49,'8ac376b8-bf70-428d-8377-be37fc9f1a7e',0,'2026-08-05 04:14:02','2026-08-12 04:14:01'),(183,49,'9fcbcdbd-3158-4aad-b947-2af0edcefe79',0,'2026-08-05 09:07:48','2026-08-12 09:07:47'),(184,49,'72061c35-08c0-40fc-94fe-6d01a48c1cf3',0,'2026-08-05 09:08:24','2026-08-12 09:08:23'),(185,49,'ffd0556e-30f8-4886-8365-bd2d27379e6b',0,'2026-08-05 09:17:54','2026-08-12 09:17:53'),(186,49,'08bd186b-4669-478e-be61-a4c632f03446',0,'2026-08-05 09:22:26','2026-08-12 09:22:25'),(187,49,'fc20ae91-118e-4adf-97e7-29c7dc4aafa9',0,'2026-08-05 09:23:00','2026-08-12 09:23:00'),(188,49,'9e223f89-bfbc-4d41-9614-7301c5a7096b',0,'2026-08-05 09:23:54','2026-08-12 09:23:53'),(189,49,'918dbe08-69fd-4d88-8bf3-4a7198b6a3be',0,'2026-08-05 09:24:28','2026-08-12 09:24:28'),(190,49,'373eea7d-f6d3-4255-81b1-c6ed117f1a4b',0,'2026-08-05 09:26:26','2026-08-12 09:26:25'),(191,49,'7a161517-a744-4dc7-bcbd-302439192d44',0,'2026-08-05 09:28:40','2026-08-12 09:28:40'),(192,49,'bb890793-acbb-45a9-a116-12a895be00fc',0,'2026-08-05 09:31:06','2026-08-12 09:31:06'),(193,49,'c7f85a9b-8959-4b7d-b787-02bb52c9be6a',0,'2026-08-05 09:31:56','2026-08-12 09:31:55'),(194,49,'4dd16ff0-8316-49c8-8d7d-029c3b9c7d53',0,'2026-08-05 09:35:36','2026-08-12 09:35:36'),(195,49,'53b1f6ea-8833-45f0-89a6-52bfda562135',0,'2026-08-05 09:36:13','2026-08-12 09:36:12'),(196,64,'ca08ac8f-47ba-41ba-892d-b0a79f7d5468',0,'2026-08-05 10:18:07','2026-08-12 10:18:07'),(197,65,'cd85fb7f-65a3-4b40-a8b7-8bb21cec6b65',0,'2026-08-05 10:19:55','2026-08-12 10:19:54'),(198,63,'98a71f37-ff97-4dcb-99e3-d07550fb24b4',1,'2026-08-05 11:07:24','2026-08-12 11:07:23'),(199,66,'f1286d1b-6819-42c3-a4df-b05ac0305504',0,'2026-08-05 11:49:30','2026-08-12 11:49:29'),(200,67,'4f9ff51a-b20d-45c6-95fb-a7f4d8b0ac0a',0,'2026-08-05 11:50:15','2026-08-12 11:50:14'),(201,68,'f2e3c723-a4d6-4833-a493-b5c59ee52e48',0,'2026-08-05 11:50:48','2026-08-12 11:50:47'),(202,69,'ddaf5d91-6fc9-4c1d-88ae-40f2ca7eb848',0,'2026-08-05 12:26:22','2026-08-12 12:26:22'),(203,70,'e072e2bd-69e1-41b6-930b-aa67c1121244',0,'2026-08-05 12:27:43','2026-08-12 12:27:42'),(204,71,'2024178d-c15a-48ee-b761-4f99e50b56f1',0,'2026-08-05 12:28:43','2026-08-12 12:28:43'),(205,72,'85b822e0-ee85-4afc-904f-abd5580cc34f',0,'2026-08-05 12:30:39','2026-08-12 12:30:38'),(206,73,'51ae23ef-da18-4b85-87c1-e092397a9246',0,'2026-08-05 12:31:10','2026-08-12 12:31:10'),(207,74,'a7d922bc-e635-4a9c-a7da-4b7555a92b46',0,'2026-08-05 12:38:49','2026-08-12 12:38:48'),(208,75,'5121f38e-2c7a-45ca-9bb7-49364213266b',0,'2026-08-05 12:48:15','2026-08-12 12:48:15'),(209,76,'3ac35d99-7146-4e5d-8511-75feecd9716a',0,'2026-08-05 12:49:19','2026-08-12 12:49:19'),(211,77,'97706b57-e9ff-4c84-ab50-1bcb00a77f52',0,'2026-08-05 12:54:23','2026-08-12 12:54:22'),(213,78,'8f7af85a-3b0e-4fcb-ab23-935c24f44baf',0,'2026-08-05 12:56:00','2026-08-12 12:55:59'),(214,79,'be3ee683-fb53-44fc-b5c5-d1dd167fa7dc',0,'2026-08-05 12:57:01','2026-08-12 12:57:00'),(216,80,'7dcd6ded-8687-42b2-b72f-e394a76864bc',0,'2026-08-05 12:59:25','2026-08-12 12:59:25'),(218,81,'4d1365a7-2ad8-483a-98f4-0af56f2c62ff',0,'2026-08-05 13:05:22','2026-08-12 13:05:21'),(221,82,'52289be5-8739-4a01-b916-32365d976d09',0,'2026-08-05 13:08:16','2026-08-12 13:08:16'),(223,83,'e540d59d-226a-4cff-a576-b722cdfd4a32',0,'2026-08-05 13:09:42','2026-08-12 13:09:42'),(225,84,'260bbf78-fd13-4808-ac0e-e7b72af92622',0,'2026-08-05 13:10:36','2026-08-12 13:10:36'),(226,63,'c71f86e9-52be-47be-901e-29cb96e5bc00',1,'2026-08-05 22:40:38','2026-08-12 22:40:38'),(227,63,'32086a38-2d60-4b26-887f-51f91809223a',1,'2026-08-06 03:57:18','2026-08-13 03:57:17'),(228,85,'da7383f6-bcf1-4fab-8042-9cd1ebb81316',1,'2026-08-06 03:58:20','2026-08-13 03:58:20'),(229,85,'a7c568bc-0be7-45ec-9c18-5a024daf727b',1,'2026-08-06 05:46:27','2026-08-13 05:46:27'),(230,48,'c7d12933-0a97-4282-b4ac-fa7031761daa',0,'2026-08-06 05:47:12','2026-08-13 05:47:12'),(231,48,'dd221ff0-733b-4578-bcac-42e69b5fdba2',0,'2026-08-06 05:47:35','2026-08-13 05:47:34'),(232,48,'87da41cb-9091-495d-bee3-2f9fc8cdb74e',0,'2026-08-06 05:57:01','2026-08-13 05:57:00'),(233,48,'29bde9b1-1c37-4bf2-a06e-166dea02ffce',0,'2026-08-06 05:57:44','2026-08-13 05:57:43'),(234,48,'fe852622-1911-447b-814d-e80517670a3e',0,'2026-08-06 05:58:32','2026-08-13 05:58:32'),(235,48,'faafd7a5-2c00-43d2-8200-4c2d14784f2d',0,'2026-08-06 06:02:44','2026-08-13 06:02:43'),(236,48,'a579b623-94ef-41fc-8869-468c498d0c87',0,'2026-08-06 06:02:54','2026-08-13 06:02:53'),(237,48,'14b7e34d-113f-4c5e-aff1-afbbc52c1376',0,'2026-08-06 06:03:05','2026-08-13 06:03:04'),(238,2,'f1ba11e0-85c3-4446-a3c1-add029d06725',0,'2026-08-06 06:14:42','2026-08-13 06:14:42'),(239,2,'725df3e5-bc20-4484-bced-e16d15c09424',0,'2026-08-06 06:14:49','2026-08-13 06:14:49'),(240,2,'4346c87e-0cff-4a49-bf9c-1b92456d1e6f',0,'2026-08-06 06:14:57','2026-08-13 06:14:57'),(241,2,'3c1b976d-9c0e-40ea-a086-5035ba78f2ff',0,'2026-08-06 06:15:22','2026-08-13 06:15:21'),(242,2,'6fbb7007-6d16-4c0b-bdbe-5bb1c9d580f5',0,'2026-08-06 06:15:38','2026-08-13 06:15:37'),(243,2,'3a462bd1-3181-4503-92ac-ce967be673c5',0,'2026-08-06 06:16:02','2026-08-13 06:16:02'),(244,2,'c20f36c9-6f8e-4784-bea1-7bb1fcda6268',0,'2026-08-06 06:16:33','2026-08-13 06:16:32'),(245,2,'47dec475-bcc8-459d-b3ca-93bab963f93a',0,'2026-08-06 06:16:56','2026-08-13 06:16:56'),(246,2,'20d94d1f-2f11-4188-8c16-3d9465011fb3',0,'2026-08-06 06:19:40','2026-08-13 06:19:40'),(247,2,'5814b8fc-eb6c-4240-a0c9-92c7bc03ee40',0,'2026-08-06 06:19:56','2026-08-13 06:19:56'),(248,2,'442c1004-4a4c-4a2a-ae91-26dd7a73aade',0,'2026-08-06 06:30:25','2026-08-13 06:30:25'),(249,2,'ad4c92eb-2708-4d49-b855-caadd2297f0f',0,'2026-08-06 06:38:48','2026-08-13 06:38:48'),(250,2,'d658fda8-e691-4479-8b09-a10dc3031271',0,'2026-08-06 06:39:24','2026-08-13 06:39:23'),(251,2,'ff088d07-f72c-48ff-9977-cc8dd03cf9a8',0,'2026-08-06 06:39:43','2026-08-13 06:39:43'),(252,2,'83ef82d7-3947-4f6f-a7b5-e5c3ad814a5c',0,'2026-08-06 06:47:39','2026-08-13 06:47:39'),(253,2,'4227564d-2710-46c8-a47d-27a0fee7ab0c',0,'2026-08-06 06:48:07','2026-08-13 06:48:06'),(254,2,'61592b80-4d42-428b-990f-26801bc03022',0,'2026-08-06 06:48:37','2026-08-13 06:48:37'),(255,2,'d48daf7f-6edc-4031-9e19-dc719b09f796',0,'2026-08-06 06:54:18','2026-08-13 06:54:17'),(256,2,'21975cd5-1887-4401-920a-db2c5d7734aa',0,'2026-08-06 06:54:26','2026-08-13 06:54:25'),(257,85,'97ee2ff5-8fcb-448f-9712-a741338f0cd7',1,'2026-08-06 06:54:27','2026-08-13 06:54:27'),(258,2,'e95336b7-c6a0-48a8-8459-2d8b3c66d26f',0,'2026-08-06 06:54:44','2026-08-13 06:54:43'),(259,85,'d9796651-eb91-4469-bf3d-3c2e3a7d10c4',1,'2026-08-06 10:19:35','2026-08-13 10:19:34'),(269,1,'d4359c77-b189-4575-914e-8a9b83425312',0,'2026-08-07 01:05:16','2026-08-14 01:05:16'),(271,1,'1a52692c-4f3f-48ac-840e-0b332ed52381',0,'2026-08-07 01:05:33','2026-08-14 01:05:32'),(273,1,'d7c20f09-cc80-4a00-9546-f10e33754ceb',0,'2026-08-07 01:05:49','2026-08-14 01:05:48'),(275,1,'8b543c4f-744b-47eb-a5d3-c6af282f0e52',0,'2026-08-07 01:06:07','2026-08-14 01:06:07'),(277,1,'8624ebf1-184c-4324-a594-7823862cd378',0,'2026-08-07 01:07:37','2026-08-14 01:07:36'),(279,1,'8d3001d7-f231-4a84-891c-5a8c43ab7c20',0,'2026-08-07 01:07:48','2026-08-14 01:07:48'),(281,1,'59a781b0-ad87-4326-9b7f-7a7f0522c4b0',0,'2026-08-07 01:08:45','2026-08-14 01:08:44'),(283,1,'ba8a0c1b-8d3f-4bde-ac03-d522b69181b7',0,'2026-08-07 01:08:46','2026-08-14 01:08:46');
/*!40000 ALTER TABLE `refresh_token_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `saved_mentors`
--

DROP TABLE IF EXISTS `saved_mentors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `saved_mentors` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `learner_id` bigint NOT NULL,
  `mentor_id` bigint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_saved_mentor` (`learner_id`,`mentor_id`),
  KEY `idx_saved_mentors_mentor` (`mentor_id`),
  KEY `idx_saved_mentors_learner_created` (`learner_id`,`created_at`),
  CONSTRAINT `fk_saved_mentors_learner` FOREIGN KEY (`learner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_saved_mentors_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `saved_mentors`
--

LOCK TABLES `saved_mentors` WRITE;
/*!40000 ALTER TABLE `saved_mentors` DISABLE KEYS */;
INSERT INTO `saved_mentors` VALUES (9,58,50,'2026-08-03 11:25:44'),(10,58,49,'2026-08-03 11:25:47'),(11,58,53,'2026-08-03 11:25:50'),(12,62,53,'2026-08-04 08:10:45');
/*!40000 ALTER TABLE `saved_mentors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_packages`
--

DROP TABLE IF EXISTS `session_packages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_packages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `mentor_id` bigint NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `session_count` int NOT NULL,
  `discount_percent` decimal(5,2) NOT NULL,
  `total_price` decimal(12,2) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_session_packages_mentor` (`mentor_id`),
  CONSTRAINT `fk_session_packages_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_packages`
--

LOCK TABLES `session_packages` WRITE;
/*!40000 ALTER TABLE `session_packages` DISABLE KEYS */;
/*!40000 ALTER TABLE `session_packages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_requests`
--

DROP TABLE IF EXISTS `session_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `learner_id` bigint NOT NULL,
  `mentor_id` bigint NOT NULL,
  `message` text,
  `decline_reason` text,
  `session_id` bigint DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `reply_message` text,
  `subject` varchar(255) DEFAULT NULL,
  `preferred_date` varchar(50) DEFAULT NULL,
  `preferred_time` varchar(20) DEFAULT NULL,
  `preferred_duration` int DEFAULT NULL,
  `budget` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_session_requests_mentor_status` (`mentor_id`,`status`),
  KEY `idx_session_requests_learner` (`learner_id`),
  CONSTRAINT `fk_session_requests_learner` FOREIGN KEY (`learner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_session_requests_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_requests`
--

LOCK TABLES `session_requests` WRITE;
/*!40000 ALTER TABLE `session_requests` DISABLE KEYS */;
INSERT INTO `session_requests` VALUES (1,62,2,'HII',NULL,34,'ACCEPTED','2026-08-04 00:53:25','2026-08-04 00:56:19','2026-08-04 00:55:32',NULL,'Java','2026-08-04','13:00',NULL,NULL),(2,48,2,'Looking forward to learning backend development with you! I have a few months of experience and want to go deeper into Java and Spring Boot.',NULL,NULL,'PENDING','2026-08-04 03:37:39','2026-08-04 03:37:39',NULL,NULL,'Backend Deep Dive','Aug 12, 2026','6:00 PM',60,'2000 credits'),(3,48,47,'Looking forward to learning backend development with you! I have a few months of experience and want to go deeper into Java and Spring Boot.',NULL,35,'ACCEPTED','2026-08-04 03:38:20','2026-08-04 03:38:20','2026-08-04 03:38:20',NULL,'Backend Deep Dive','Aug 12, 2026','6:00 PM',60,'2000 credits'),(4,48,47,'Could we schedule a session about system design interviews?','Booked solid for the next two weeks - try again later',NULL,'DECLINED','2026-08-04 03:38:21','2026-08-04 03:38:21','2026-08-04 03:38:21',NULL,'System Design',NULL,NULL,NULL,NULL),(5,48,47,'Hi! I would love to learn more about building scalable microservices with you.',NULL,NULL,'PENDING','2026-08-04 03:38:21','2026-08-04 03:38:21',NULL,NULL,'Microservices 101',NULL,NULL,90,NULL);
/*!40000 ALTER TABLE `session_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_waitlist`
--

DROP TABLE IF EXISTS `session_waitlist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_waitlist` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` bigint NOT NULL,
  `learner_id` bigint NOT NULL,
  `status` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_waitlist_learner_created` (`learner_id`,`created_at` DESC),
  KEY `idx_waitlist_session_status_created` (`session_id`,`status`,`created_at`),
  CONSTRAINT `fk_waitlist_learner` FOREIGN KEY (`learner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_waitlist_session` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_waitlist`
--

LOCK TABLES `session_waitlist` WRITE;
/*!40000 ALTER TABLE `session_waitlist` DISABLE KEYS */;
/*!40000 ALTER TABLE `session_waitlist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `mentor_id` bigint NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `session_type` varchar(50) NOT NULL,
  `start_time` timestamp NOT NULL,
  `end_time` timestamp NOT NULL,
  `price_amount` decimal(12,2) NOT NULL,
  `status` varchar(50) NOT NULL,
  `meeting_link` varchar(500) DEFAULT NULL,
  `cancellation_window_hours` int NOT NULL DEFAULT '24',
  `reschedule_window_hours` int NOT NULL DEFAULT '12',
  `meeting_provider` varchar(50) DEFAULT 'GOOGLE_CALENDAR',
  `meeting_id` varchar(255) DEFAULT NULL,
  `calendar_event_id` varchar(255) DEFAULT NULL,
  `session_status` varchar(50) DEFAULT 'SCHEDULED',
  `created_by` bigint DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `max_participants` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_sessions_mentor_time` (`mentor_id`,`start_time`),
  KEY `idx_sessions_status` (`session_status`),
  KEY `idx_sessions_mentor_status` (`mentor_id`,`session_status`),
  CONSTRAINT `fk_sessions_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES (25,49,'React Performance Optimization','Deep dive into React rendering behavior, memo strategies, and bundle optimization techniques.','ONE_ON_ONE','2026-08-05 08:26:32','2026-08-05 09:26:32',80.00,'ACCEPTED',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',NULL,'2026-07-04 08:26:32','2026-08-03 08:26:32',1),(26,49,'System Design: Social Media Platform','Design Twitter-scale social media platform. Covers sharding, caching, feed generation, and real-time features.','ONE_ON_ONE','2026-08-08 08:26:32','2026-08-08 09:26:32',80.00,'ACCEPTED',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',NULL,'2026-07-09 08:26:32','2026-08-03 08:26:32',1),(27,50,'ML Model Deployment on GCP','End-to-end ML deployment pipeline: model serving, A/B testing, monitoring, and auto-scaling with Vertex AI.','ONE_ON_ONE','2026-08-06 08:26:32','2026-08-06 09:26:32',90.00,'ACCEPTED',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',NULL,'2026-07-14 08:26:32','2026-08-03 08:26:32',1),(28,51,'Kubernetes for Developers','From Pods to Operators: practical Kubernetes for developers who want to understand container orchestration deeply.','ONE_ON_ONE','2026-08-10 08:26:32','2026-08-10 09:26:32',100.00,'ACCEPTED',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',NULL,'2026-07-19 08:26:32','2026-08-03 08:26:32',1),(29,52,'Full-Stack SaaS Architecture','Build a subscription-based SaaS from scratch: Next.js, PostgreSQL, Stripe integration, and Docker deployment.','ONE_ON_ONE','2026-08-07 08:26:32','2026-08-07 09:26:32',65.00,'ACCEPTED',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',NULL,'2026-07-24 08:26:32','2026-08-03 08:26:32',1),(30,53,'AWS DevOps Certification Prep','Comprehensive preparation for AWS DevOps Engineer Professional exam. Covers all domains with practice questions.','ONE_ON_ONE','2026-08-09 08:26:32','2026-08-09 09:26:32',85.00,'ACCEPTED',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',NULL,'2026-07-29 08:26:32','2026-08-03 08:26:32',1),(34,2,'Java','','ONLINE','2026-08-06 02:00:00','2026-08-06 04:56:00',100.00,'PENDING',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',NULL,'2026-08-04 00:56:19','2026-08-04 00:56:19',1),(35,47,'Spring Boot for Backend Devs','Custom 1-on-1 session','ONLINE','2026-08-06 03:38:20','2026-08-06 04:38:20',999.00,'PENDING',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',NULL,'2026-08-04 03:38:20','2026-08-04 03:38:20',1),(36,63,'Java','Java','1:1 Mentoring','2026-08-05 08:06:00','2026-08-05 09:06:00',200.00,'PENDING',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',NULL,'2026-08-04 08:06:22','2026-08-04 08:06:22',4),(37,63,'Session with ankitathakur','','ONLINE','2026-08-05 22:00:00','2026-08-06 06:00:00',0.00,'PENDING',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',63,'2026-08-05 08:58:58','2026-08-05 08:58:58',1),(38,63,'Session with ankitathakur','','ONLINE','2026-08-12 22:00:00','2026-08-13 06:00:00',0.00,'PENDING',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',63,'2026-08-05 08:58:58','2026-08-05 08:58:58',1),(39,49,'Senior Frontend Engineer & Architecture Coach','','ONLINE','2026-08-09 22:00:00','2026-08-10 06:00:00',80.00,'PENDING',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',49,'2026-08-05 09:08:24','2026-08-05 09:08:24',1),(40,49,'Senior Frontend Engineer & Architecture Coach','','ONLINE','2026-08-16 22:00:00','2026-08-17 06:00:00',80.00,'PENDING',NULL,24,12,'GOOGLE_CALENDAR',NULL,NULL,'SCHEDULED',49,'2026-08-05 09:08:24','2026-08-05 09:08:24',1);
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `skill_requests`
--

DROP TABLE IF EXISTS `skill_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skill_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'PENDING',
  `requested_by` bigint NOT NULL,
  `admin_note` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_skill_requests_status` (`status`),
  KEY `idx_skill_requests_requested_by` (`requested_by`),
  CONSTRAINT `fk_skill_requests_user` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `skill_requests`
--

LOCK TABLES `skill_requests` WRITE;
/*!40000 ALTER TABLE `skill_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `skill_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `skill_verification_submissions`
--

DROP TABLE IF EXISTS `skill_verification_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skill_verification_submissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `task_id` bigint NOT NULL,
  `learner_id` bigint NOT NULL,
  `submission_text` text NOT NULL,
  `status` varchar(50) NOT NULL,
  `review_note` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_verification_submissions_task` (`task_id`),
  KEY `idx_verification_submissions_learner` (`learner_id`),
  CONSTRAINT `fk_verification_submissions_learner` FOREIGN KEY (`learner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_verification_submissions_task` FOREIGN KEY (`task_id`) REFERENCES `skill_verification_tasks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `skill_verification_submissions`
--

LOCK TABLES `skill_verification_submissions` WRITE;
/*!40000 ALTER TABLE `skill_verification_submissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `skill_verification_submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `skill_verification_tasks`
--

DROP TABLE IF EXISTS `skill_verification_tasks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skill_verification_tasks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `mentor_id` bigint NOT NULL,
  `skill_name` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `instructions` text NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_verification_tasks_mentor` (`mentor_id`),
  CONSTRAINT `fk_verification_tasks_mentor` FOREIGN KEY (`mentor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `skill_verification_tasks`
--

LOCK TABLES `skill_verification_tasks` WRITE;
/*!40000 ALTER TABLE `skill_verification_tasks` DISABLE KEYS */;
/*!40000 ALTER TABLE `skill_verification_tasks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `skill_watchlist`
--

DROP TABLE IF EXISTS `skill_watchlist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skill_watchlist` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `learner_id` bigint NOT NULL,
  `skill_name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_skill_watchlist` (`learner_id`,`skill_name`),
  KEY `idx_skill_watchlist_skill` (`skill_name`),
  CONSTRAINT `fk_skill_watchlist_learner` FOREIGN KEY (`learner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `skill_watchlist`
--

LOCK TABLES `skill_watchlist` WRITE;
/*!40000 ALTER TABLE `skill_watchlist` DISABLE KEYS */;
/*!40000 ALTER TABLE `skill_watchlist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `skills`
--

DROP TABLE IF EXISTS `skills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skills` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `skills`
--

LOCK TABLES `skills` WRITE;
/*!40000 ALTER TABLE `skills` DISABLE KEYS */;
INSERT INTO `skills` VALUES (1,'React','Frontend'),(2,'TypeScript','Frontend'),(3,'Next.js','Frontend'),(4,'Node.js','Backend'),(5,'Java','Backend'),(6,'Python','Backend'),(7,'Spring Boot','Backend'),(8,'PostgreSQL','Database'),(9,'SQL','Database'),(10,'System Design','Architecture'),(11,'Microservices','Architecture'),(12,'Docker','DevOps'),(13,'Kubernetes','DevOps'),(14,'AWS','DevOps'),(15,'CI/CD','DevOps'),(16,'Terraform','DevOps'),(17,'DevOps','DevOps'),(18,'Machine Learning','AI/ML'),(19,'TensorFlow','AI/ML'),(20,'Data Science','Data Science'),(21,'Full Stack','Full Stack'),(22,'Platform Management','Management'),(23,'Community Moderation','Management'),(24,'Strategic Planning','Management');
/*!40000 ALTER TABLE `skills` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stored_files`
--

DROP TABLE IF EXISTS `stored_files`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stored_files` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `stored_name` varchar(255) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `content_type` varchar(255) NOT NULL,
  `size_bytes` bigint NOT NULL,
  `owner_id` bigint NOT NULL,
  `context_type` varchar(20) DEFAULT NULL,
  `context_id` bigint DEFAULT NULL,
  `created_at` timestamp NOT NULL,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stored_files_stored_name` (`stored_name`),
  KEY `idx_stored_files_expires_at` (`expires_at`),
  KEY `idx_stored_files_owner_id` (`owner_id`),
  CONSTRAINT `fk_stored_files_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stored_files`
--

LOCK TABLES `stored_files` WRITE;
/*!40000 ALTER TABLE `stored_files` DISABLE KEYS */;
INSERT INTO `stored_files` VALUES (1,'579b3cd4-6923-440e-ab43-482cb470a39b.pdf','dbms.pdf','application/pdf',4174326,2,'DIRECT_CHAT',3,'2026-08-04 00:54:59','2026-09-03 00:54:59');
/*!40000 ALTER TABLE `stored_files` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_availability_slots`
--

DROP TABLE IF EXISTS `user_availability_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_availability_slots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `day_of_week` int NOT NULL,
  `start_time` varchar(10) NOT NULL,
  `end_time` varchar(10) NOT NULL,
  `timezone` varchar(100) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_availability_user_day` (`user_id`,`day_of_week`),
  CONSTRAINT `fk_availability_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_availability_slots`
--

LOCK TABLES `user_availability_slots` WRITE;
/*!40000 ALTER TABLE `user_availability_slots` DISABLE KEYS */;
INSERT INTO `user_availability_slots` VALUES (1,63,4,'09:00','17:00','Asia/Calcutta',1,'2026-08-05 08:58:58');
/*!40000 ALTER TABLE `user_availability_slots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_blocks`
--

DROP TABLE IF EXISTS `user_blocks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_blocks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `blocker_id` bigint NOT NULL,
  `blocked_id` bigint NOT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_blocks` (`blocker_id`,`blocked_id`),
  KEY `fk_user_blocks_blocked` (`blocked_id`),
  CONSTRAINT `fk_user_blocks_blocked` FOREIGN KEY (`blocked_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_user_blocks_blocker` FOREIGN KEY (`blocker_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_blocks`
--

LOCK TABLES `user_blocks` WRITE;
/*!40000 ALTER TABLE `user_blocks` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_blocks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_certifications`
--

DROP TABLE IF EXISTS `user_certifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_certifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `code` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` varchar(500) NOT NULL,
  `source_booking_id` bigint DEFAULT NULL,
  `issued_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_certification_code` (`user_id`,`code`),
  KEY `fk_user_certifications_booking` (`source_booking_id`),
  KEY `idx_user_certifications_user_issued` (`user_id`,`issued_at` DESC),
  CONSTRAINT `fk_user_certifications_booking` FOREIGN KEY (`source_booking_id`) REFERENCES `bookings` (`id`),
  CONSTRAINT `fk_user_certifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_certifications`
--

LOCK TABLES `user_certifications` WRITE;
/*!40000 ALTER TABLE `user_certifications` DISABLE KEYS */;
INSERT INTO `user_certifications` VALUES (3,49,'MENTOR_FIRST_CLASS','First Class Delivered','Completed your first mentoring session.',NULL,'2026-08-05 03:19:53');
/*!40000 ALTER TABLE `user_certifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_projects`
--

DROP TABLE IF EXISTS `user_projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_projects` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `title` varchar(500) NOT NULL,
  `description` text NOT NULL,
  `technologies` varchar(1000) NOT NULL,
  `github_url` varchar(500) DEFAULT NULL,
  `live_demo_url` varchar(500) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `currently_working` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_projects_user_id` (`user_id`),
  CONSTRAINT `fk_user_projects_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_projects`
--

LOCK TABLES `user_projects` WRITE;
/*!40000 ALTER TABLE `user_projects` DISABLE KEYS */;
INSERT INTO `user_projects` VALUES (1,2,'SkillSwapper','Its a skill swapper project','Springboot , React',NULL,NULL,'2026-07-01',NULL,1,'2026-07-30 06:36:51','2026-07-30 06:36:51');
/*!40000 ALTER TABLE `user_projects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_reports`
--

DROP TABLE IF EXISTS `user_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_reports` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `reporter_id` bigint NOT NULL,
  `reported_id` bigint DEFAULT NULL,
  `target_type` varchar(50) NOT NULL,
  `target_id` bigint DEFAULT NULL,
  `reason` varchar(255) NOT NULL,
  `details` text,
  `status` varchar(50) NOT NULL DEFAULT 'OPEN',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `escalated` tinyint(1) NOT NULL DEFAULT '0',
  `escalation_level` int DEFAULT NULL,
  `escalation_reason` varchar(500) DEFAULT NULL,
  `escalated_at` timestamp NULL DEFAULT NULL,
  `target_label` varchar(255) DEFAULT NULL,
  `moderator_note` varchar(1000) DEFAULT NULL,
  `priority` varchar(20) NOT NULL DEFAULT 'MEDIUM',
  `assigned_admin_id` bigint DEFAULT NULL,
  `internal_notes` text,
  `deleted_at` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_user_reports_reporter` (`reporter_id`),
  KEY `fk_user_reports_reported` (`reported_id`),
  KEY `idx_reports_status` (`status`),
  KEY `idx_reports_status_target_type` (`status`,`target_type`),
  KEY `fk_user_reports_assigned_admin` (`assigned_admin_id`),
  KEY `idx_reports_status_priority` (`status`,`priority`),
  KEY `idx_reports_created_at` (`created_at`),
  CONSTRAINT `fk_user_reports_assigned_admin` FOREIGN KEY (`assigned_admin_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_user_reports_reported` FOREIGN KEY (`reported_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_user_reports_reporter` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_reports`
--

LOCK TABLES `user_reports` WRITE;
/*!40000 ALTER TABLE `user_reports` DISABLE KEYS */;
INSERT INTO `user_reports` VALUES (1,48,47,'MENTOR',47,'Inappropriate conduct during session','Used unprofessional language and refused to follow the agreed curriculum.','IN_REVIEW','2026-08-04 04:44:44','2026-08-04 04:45:12',0,NULL,NULL,NULL,'Test Mentor','Confirmed no-show, refund issued.','MEDIUM',1,NULL,NULL),(2,48,47,'MENTOR',47,'Misleading skill profile','Mentor claims expertise not backed by experience.','OPEN','2026-08-04 04:45:37','2026-08-04 04:45:37',0,NULL,NULL,NULL,'Test Mentor',NULL,'MEDIUM',NULL,NULL,NULL),(3,48,47,'MENTOR',47,'Duplicate profile impersonation','This mentor profile appears to be duplicated.','OPEN','2026-08-04 04:46:28','2026-08-04 04:46:28',0,NULL,NULL,NULL,'Test Mentor',NULL,'MEDIUM',NULL,NULL,NULL),(4,48,NULL,'SKILL',5,'Outdated course material','The skill page links to outdated material.','OPEN','2026-08-04 04:49:12','2026-08-04 04:49:12',0,NULL,NULL,NULL,'Java',NULL,'MEDIUM',NULL,NULL,NULL),(5,48,47,'MENTOR',47,'Another test','x','OPEN','2026-08-04 04:50:25','2026-08-04 04:50:25',0,NULL,NULL,NULL,'Test Mentor',NULL,'MEDIUM',NULL,NULL,NULL);
/*!40000 ALTER TABLE `user_reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` varchar(50) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `wallet_address` varchar(255) DEFAULT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `about_me` text,
  `skills` varchar(500) DEFAULT NULL,
  `github_url` varchar(500) DEFAULT NULL,
  `linkedin_url` varchar(500) DEFAULT NULL,
  `projects` text,
  `certificates` text,
  `past_teaching_sessions` text,
  `verified_skills` text,
  `profile_image_url` varchar(1000) DEFAULT NULL,
  `mentor_verified` tinyint(1) NOT NULL DEFAULT '0',
  `last_active_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `referral_code` varchar(12) NOT NULL DEFAULT '',
  `referred_by_user_id` bigint DEFAULT NULL,
  `message_privacy` varchar(50) NOT NULL DEFAULT 'ANYONE',
  `admin_sub_role` varchar(50) DEFAULT NULL,
  `company` varchar(150) DEFAULT NULL,
  `headline` varchar(200) DEFAULT NULL,
  `years_of_experience` int DEFAULT NULL,
  `languages` varchar(300) DEFAULT NULL,
  `hourly_rate` decimal(12,2) DEFAULT NULL,
  `response_time_minutes` int DEFAULT NULL,
  `password_reset_token` varchar(255) DEFAULT NULL,
  `password_reset_token_expiry` datetime(6) DEFAULT NULL,
  `username` varchar(255) NOT NULL,
  `resume_url` varchar(1000) DEFAULT NULL,
  `profile_completed` tinyint(1) NOT NULL DEFAULT '0',
  `country` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `phone_number` varchar(40) DEFAULT NULL,
  `timezone` varchar(64) DEFAULT NULL,
  `education` text,
  `portfolio_url` varchar(1000) DEFAULT NULL,
  `availability` text,
  `learning_goals` text,
  `current_skill_level` varchar(32) DEFAULT NULL,
  `username_lower` varchar(255) NOT NULL,
  `verification_status` varchar(32) NOT NULL DEFAULT 'PENDING',
  `verified_at` datetime(6) DEFAULT NULL,
  `verified_by` bigint DEFAULT NULL,
  `verification_submitted_at` datetime(6) DEFAULT NULL,
  `verification_reviewed_at` datetime(6) DEFAULT NULL,
  `rejection_reason` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uq_users_referral_code` (`referral_code`),
  UNIQUE KEY `uk_users_username` (`username`),
  UNIQUE KEY `uk_users_username_lower` (`username_lower`),
  KEY `idx_users_role_last_active` (`role`,`last_active_at` DESC),
  KEY `fk_referred_by` (`referred_by_user_id`),
  FULLTEXT KEY `idx_mentor_fulltext` (`full_name`,`about_me`,`skills`,`company`,`headline`),
  CONSTRAINT `fk_referred_by` FOREIGN KEY (`referred_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'nakulsharma@gmail.com','$2b$10$Ipa2EqIojXVPXTRl.fmLFu4bhsJNBP25DaYa7uYVzaQOqNxgAaRJW','ADMIN','Nakul Sharma','0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',1,'2026-07-29 16:42:07','Platform administrator and founder of SkillSwap. Passionate about skill-based learning and peer-to-peer education.','Platform Management, Community Moderation, Strategic Planning','https://github.com/nakulsharma97','https://linkedin.com/in/nakulsharma97',NULL,NULL,NULL,NULL,NULL,0,'2026-08-07 01:08:47','NAKUL001',NULL,'ANYONE','SUPER_ADMIN',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'nakulsharma',NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'nakulsharma','PENDING',NULL,NULL,NULL,NULL,NULL),(2,'pritil9783@gmail.com','$2a$10$8a8LQJcPIgqZHD/JUGGKMuAY27FGC3feWO/7rG5YuZ76BAuzqxEx6','MENTOR','Pritil',NULL,1,'2026-07-30 05:56:41','i am pritil','[{\"name\":\"Java\",\"level\":\"Intermediate\"},{\"name\":\"Python\",\"level\":\"Intermediate\"}]','https://github.com/nakulsharma97','https://www.linkedin.com/in/nakulsharma97',NULL,NULL,'i have experince of 4 years',NULL,'https://plus.unsplash.com/premium_photo-1689568126014-06fea9d5d341?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8cHJvZmlsZXxlbnwwfHwwfHx8MA%3D%3D',0,'2026-08-06 06:54:50','997847CB',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'pritil9783',NULL,1,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'pritil9783','PENDING',NULL,NULL,NULL,NULL,NULL),(3,'e2etest@test.com','$2a$10$.AXwPHSSaf81riw8BVGgvulzG72lFimsqZS5tzqI5erBkoR7Icb/O','MENTOR','E2E Test Mentor',NULL,1,'2026-07-30 08:36:37',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-07-30 10:09:10','36362F18',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'e2etestmentor',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'e2etestmentor','PENDING',NULL,NULL,NULL,NULL,NULL),(4,'newtest@test.com','$2a$10$erqfuBJaAvYbjmpLzsWe6OjSYfVU.dvx.xbLgaVqCs4e0xrjOxuGu','LEARNER','New Test User',NULL,1,'2026-07-30 10:06:54',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-07-30 10:06:54','08454396',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'newtestuser',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'newtestuser','PENDING',NULL,NULL,NULL,NULL,NULL),(26,'e2etestuser2@test.com','$2a$10$4Qt013F1ziG1h7mCTUXP4ObVGmvIwOSHp6hwgCbzTsBXGQVpuDy4a','LEARNER','E2E Test User',NULL,1,'2026-07-30 12:12:11',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-07-31 09:11:36','AB80B1CB',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'e2etester2',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'e2etester2','PENDING',NULL,NULL,NULL,NULL,NULL),(47,'mentor@test.com','$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS','MENTOR','Test Mentor',NULL,0,'2026-08-03 08:26:32',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-04 03:38:21','MENTOR01',NULL,'ANYONE',NULL,'SkillSwap','Senior Software Mentor',8,'English, Spanish',60.00,120,NULL,NULL,'mentor',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mentor','PENDING',NULL,NULL,NULL,NULL,NULL),(48,'learner@test.com','$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS','LEARNER','Test Learner',NULL,1,'2026-08-03 08:26:32','Learning React','React',NULL,NULL,NULL,NULL,NULL,NULL,'https://example.com/photo.jpg',0,'2026-08-06 06:03:11','LEARNER01',NULL,'ANYONE',NULL,NULL,NULL,NULL,'English',NULL,NULL,NULL,NULL,'learner',NULL,0,'India','Delhi','New Delhi','+91 9876543210','Asia/Kolkata',NULL,NULL,NULL,'Master React','Intermediate','learner','PENDING',NULL,NULL,NULL,NULL,NULL),(49,'priya.sharma@example.com','$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS','MENTOR','Priya Sharma',NULL,1,'2026-04-05 08:26:32','Senior frontend engineer with 8+ years building scalable web applications. Passionate about mentoring developers who want to level up their React and TypeScript skills.','[{\"name\":\"React\"},{\"name\":\"TypeScript\"},{\"name\":\"Node.js\"},{\"name\":\"System Design\"}]','https://github.com/priyadev','https://linkedin.com/in/priyadev','Led migration of monolith to micro-frontends at a fintech startup — reduced deployment time by 70%','AWS Certified Developer – Associate, Meta Frontend Developer Certificate','Mentored 30+ junior developers through structured 8-week React bootcamps. Conducted 50+ mock system design interviews.',NULL,NULL,1,'2026-08-05 09:36:25','PRIYA001',NULL,'ANYONE',NULL,'Stripe','Senior Frontend Engineer & Architecture Coach',8,NULL,80.00,NULL,NULL,NULL,'priyadev',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'priyadev','APPROVED',NULL,NULL,NULL,NULL,NULL),(50,'raj.patel@example.com','$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS','MENTOR','Raj Patel',NULL,1,'2026-05-05 08:26:32','ML engineer with experience deploying production models at scale. I help learners bridge the gap between Jupyter notebooks and production ML pipelines.','[{\"name\":\"Python\"},{\"name\":\"Machine Learning\"},{\"name\":\"TensorFlow\"},{\"name\":\"Data Science\"}]','https://github.com/rajml','https://linkedin.com/in/rajml','Built real-time fraud detection system processing 10K+ transactions/sec with 99.7% accuracy','Google Cloud Professional ML Engineer, TensorFlow Developer Certificate','Taught \"ML in Production\" course to 200+ students at General Assembly. Regular speaker at PyData conferences.',NULL,NULL,1,'2026-08-05 03:18:49','RAJ002',NULL,'ANYONE',NULL,'Google','ML Engineer & Production AI Mentor',6,NULL,90.00,NULL,NULL,NULL,'rajml',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'rajml','APPROVED',NULL,NULL,NULL,NULL,NULL),(51,'sarah.chen@example.com','$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS','MENTOR','Sarah Chen',NULL,1,'2026-06-04 08:26:32','Backend infrastructure engineer who loves breaking down complex distributed systems into teachable pieces.','[{\"name\":\"Java\"},{\"name\":\"Spring Boot\"},{\"name\":\"Microservices\"},{\"name\":\"Kubernetes\"}]','https://github.com/sarahcodes','https://linkedin.com/in/sarahcodes','Architected multi-region Kubernetes platform serving 5M+ daily active users across 12 regions','CKAD, CKA, AWS Solutions Architect – Professional','Led 40+ engineering workshops on distributed systems. Mentored 15 engineers through the CKAD certification process.',NULL,NULL,1,'2026-08-05 03:18:48','SARAH003',NULL,'ANYONE',NULL,'Netflix','Staff Backend Engineer & Distributed Systems Mentor',10,NULL,100.00,NULL,NULL,NULL,'sarahcodes',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'sarahcodes','APPROVED',NULL,NULL,NULL,NULL,NULL),(52,'amit.kumar@example.com','$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS','MENTOR','Amit Kumar',NULL,1,'2026-06-19 08:26:32','Full-stack developer who enjoys mentoring early-career developers build market-ready skills.','[{\"name\":\"Full Stack\"},{\"name\":\"Next.js\"},{\"name\":\"PostgreSQL\"},{\"name\":\"Docker\"}]','https://github.com/amitfullstack','https://linkedin.com/in/amitfullstack','Built and scaled a SaaS platform from 0 to 10K paid users as solo technical founder','HashiCorp Terraform Associate, MongoDB Developer','Ran a 12-week \"Build Your Startup\" bootcamp where 8 teams shipped and launched MVPs.',NULL,NULL,1,'2026-08-05 03:18:47','AMIT004',NULL,'ANYONE',NULL,'Freelance','Full-Stack Developer & Startup Mentor',7,NULL,65.00,NULL,NULL,NULL,'amitfullstack',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'amitfullstack','APPROVED',NULL,NULL,NULL,NULL,NULL),(53,'emma.wilson@example.com','$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS','MENTOR','Emma Wilson',NULL,1,'2026-07-04 08:26:32','DevOps engineer passionate about infrastructure as code and building resilient cloud architectures.','[{\"name\":\"DevOps\"},{\"name\":\"AWS\"},{\"name\":\"CI/CD\"},{\"name\":\"Terraform\"}]','https://github.com/emmadevops','https://linkedin.com/in/emmadevops','Designed and implemented GitOps workflow reducing deployment failures by 95% across 200+ microservices','AWS DevOps Engineer – Professional, HashiCorp Vault Associate','Delivered \"AWS for Developers\" workshop series at 8 tech conferences. Mentored 25+ career switchers into DevOps roles.',NULL,NULL,1,'2026-08-05 03:18:46','EMMA005',NULL,'ANYONE',NULL,'Amazon Web Services','DevOps Architect & Cloud Infrastructure Mentor',9,NULL,85.00,NULL,NULL,NULL,'emmadevops',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'emmadevops','APPROVED',NULL,NULL,NULL,NULL,NULL),(54,'alex.johnson@example.com','$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS','LEARNER','Alex Johnson',NULL,1,'2026-07-20 08:26:32','Junior developer looking to level up from building basic CRUD apps to designing production-ready systems.','[{\"name\":\"React\"},{\"name\":\"Node.js\"}]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-02 08:26:32','ALEX006',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'alexlearner',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'alexlearner','PENDING',NULL,NULL,NULL,NULL,NULL),(55,'maria.garcia@example.com','$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS','LEARNER','Maria Garcia',NULL,1,'2026-07-27 08:26:32','Career switcher transitioning from finance to data science. Building ML portfolio with real-world datasets.','[{\"name\":\"Python\"},{\"name\":\"SQL\"}]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-02 20:26:32','MARIA007',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mariadata',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mariadata','PENDING',NULL,NULL,NULL,NULL,NULL),(58,'nakul978397@gmail.com','$2a$10$Lf3FciONGMmocmaN6M7B6.Qqnqwn80L5Z/t/fjsmsJNeVOz99GeUK','LEARNER','Nakul Sharma',NULL,1,'2026-08-03 08:34:49',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-04 00:37:12','4C6BEEFC',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'nakul97',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'nakul97','PENDING',NULL,NULL,NULL,NULL,NULL),(62,'tushardhiman@gmail.com','$2a$10$aegjatftI.jOjN1QHc.Ecep/CO8voPorWCI8xS/zb27wCnDKLkXKW','LEARNER','Tushar Dhiman',NULL,1,'2026-08-04 00:38:35',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-04 08:36:31','81701616',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'tushar666',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'tushar666','PENDING',NULL,NULL,NULL,NULL,NULL),(63,'ankitthakur@gmail.com','$2a$10$XGT4d9R4Lq/vD3c3wPhNUuUC618/Gil304zF27eRiTrahgtafzi5.','MENTOR','ankitathakur',NULL,1,'2026-08-04 08:05:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-06 03:57:22','63ABD2BA',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'ankit44',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'ankit44','PENDING',NULL,NULL,NULL,NULL,NULL),(64,'darktest+3@example.com','$2a$10$llnGPSUrSxtJxAVL1eyc8uSDby.NPVoTtdqCNSZznUw1PpoGyCk3y','MENTOR','Dark Test Mentor',NULL,1,'2026-08-05 10:18:07',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 10:18:07','6CEC1AF6',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'darktest3',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'darktest3','PENDING',NULL,NULL,NULL,NULL,NULL),(65,'darktest+4@example.com','$2a$10$6mlbE/7MSeNPBdrmmoGJEu6f25s.CySaxXjKqrOfIkIGz8E59h8.u','MENTOR','Dark Test 4',NULL,1,'2026-08-05 10:19:55',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 10:20:28','19DDC5D9',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'darktest4',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'darktest4','PENDING',NULL,NULL,NULL,NULL,NULL),(66,'typecheck1785950369449@test.com','$2a$10$8qkRqH8.fapAqTcgdUQBO.t0p1eXqblNJRkATuB1zClcZVb7MAU6.','LEARNER','Type Check User',NULL,1,'2026-08-05 11:49:29',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 11:49:30','D0B06E61',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'typec50369449',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'typec50369449','PENDING',NULL,NULL,NULL,NULL,NULL),(67,'typecheck1785950414717@test.com','$2a$10$.mayU00ljMZeOKfbfDjT0OMebTJ04qvjBJSFSxGgqhfV5coLknPFe','LEARNER','Type Check User',NULL,1,'2026-08-05 11:50:15',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 11:50:23','0C35BBCD',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'typec50414717',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'typec50414717','PENDING',NULL,NULL,NULL,NULL,NULL),(68,'typecheck1785950447556@test.com','$2a$10$3sqWXMo0VLcBxGtCoUe12ehEYRTIUPxlC4q2zyPID06dSC5elzuH2','LEARNER','Type Check User',NULL,1,'2026-08-05 11:50:48',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 11:51:11','6A903FFE',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'typec50447556',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'typec50447556','PENDING',NULL,NULL,NULL,NULL,NULL),(69,'hero1785952582189@test.com','$2a$10$MQBoi.v9C5uEL.EkT7E7vON6x.yPU2f9aR0F8FmNuGwrd6p7ZmFXW','LEARNER','Hero Test User',NULL,1,'2026-08-05 12:26:22',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 12:26:33','F319A10F',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'herot52582189',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'herot52582189','PENDING',NULL,NULL,NULL,NULL,NULL),(70,'hero1785952662550@test.com','$2a$10$mCTFv/8FFX76i/S9KPejrOikFY6DPza7J8x7FPY4mJFa7MmxtimDm','LEARNER','Hero Test User',NULL,1,'2026-08-05 12:27:43',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 12:27:52','85886094',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'herot52662550',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'herot52662550','PENDING',NULL,NULL,NULL,NULL,NULL),(71,'hero1785952723054@test.com','$2a$10$Hx7c1QtDLezPxIDihRe10uPGzOzf1YwRawV8ak68eYYV.nC6mM0hG','LEARNER','Hero Test User',NULL,1,'2026-08-05 12:28:43',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 12:28:51','239C456C',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'herot52723054',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'herot52723054','PENDING',NULL,NULL,NULL,NULL,NULL),(72,'mhero1785952838734@test.com','$2a$10$ZwNsfvqm9jhmhn6JYwyA7OdxSNwQFqcIhN.HDax/gpoLpXXAWowUK','MENTOR','Mentor Hero User',NULL,1,'2026-08-05 12:30:39',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 12:30:43','BDE4D462',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mhero52838734',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mhero52838734','PENDING',NULL,NULL,NULL,NULL,NULL),(73,'mh21785952869970@test.com','$2a$10$o0YBwZY5Oibb.hgFDC.dUexo6bbwSYHQzV9u99WseFzjnY/4Mm5gW','MENTOR','Mentor Two',NULL,1,'2026-08-05 12:31:10',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 12:31:20','6B24EF6A',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mh252869970',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mh252869970','PENDING',NULL,NULL,NULL,NULL,NULL),(74,'fh1785953328523@test.com','$2a$10$Ytz6SUkKJIXUgLVZpdh.TOxOjNsL6XK1Lv9yLq9I8le5AraUF99Xm','MENTOR','Final Hero',NULL,1,'2026-08-05 12:38:49',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 12:39:01','B7D3BCE3',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'fh53328523',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'fh53328523','PENDING',NULL,NULL,NULL,NULL,NULL),(75,'dh1785953894715@test.com','$2a$10$OR3a1RtJ5H7d4rkPWUc57e4v1wFuS00N.OQqvFdPsYkmyw.tNngmq','MENTOR','Dark Hero',NULL,1,'2026-08-05 12:48:15',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 12:48:30','74585126',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'dh53894716',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'dh53894716','PENDING',NULL,NULL,NULL,NULL,NULL),(76,'mb1785953959020@test.com','$2a$10$Es2TQb3mdiKkcY4m1RrUvuNqHG.UgsX6GbZsozChiKC7o.8R640i6','MENTOR','MB Test',NULL,1,'2026-08-05 12:49:19',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 12:49:28','F6F1654B',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mb53959021',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'mb53959021','PENDING',NULL,NULL,NULL,NULL,NULL),(77,'heromargin1785954257024@test.com','$2a$10$8bL3ZLYLZiRMXUU6LsU5LueQOLIt6aXspqcw0P8EHJHIeG1/f4K62','MENTOR','Margin Check',NULL,1,'2026-08-05 12:54:20',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 12:54:32','A6FE8C27',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'margin1785954259621',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'margin1785954259621','PENDING',NULL,NULL,NULL,NULL,NULL),(78,'ruler1785954351689@test.com','$2a$10$nK9JzgrtPRoyz8dC/EUd/O133qjUNf875umDYrfZi3zLDW0v.7hJ.','MENTOR','Rule Check',NULL,1,'2026-08-05 12:55:55',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 12:56:07','FA544F56',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'ruler1785954354523',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'ruler1785954354523','PENDING',NULL,NULL,NULL,NULL,NULL),(79,'deep1785954413367@test.com','$2a$10$UxT9Nal2JV0I2.6zDpSilO82c3x/aBjF09MdmN.tCd8ncahKNYJUC','MENTOR','Deep Check',NULL,1,'2026-08-05 12:57:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 12:57:06','A2B6E069',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'deep1785954418318',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'deep1785954418318','PENDING',NULL,NULL,NULL,NULL,NULL),(80,'heromargin1785954559504@test.com','$2a$10$EZG1RXK52vMjmkvslZ0wUOOT8w6y09n5571O/7aTXEV12sGn8LzWe','MENTOR','Margin Check',NULL,1,'2026-08-05 12:59:23',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 12:59:32','752E0865',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'margin1785954562315',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'margin1785954562315','PENDING',NULL,NULL,NULL,NULL,NULL),(81,'shot1785954911789@test.com','$2a$10$8bM9ILmVWzdLQq8N7LlvDu9NbG.wTphaIcoo7MABiZJEWhcZ7pj5i','MENTOR','Shot Check',NULL,1,'2026-08-05 13:05:17',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 13:05:27','5256AD61',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'shot1785954915907',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'shot1785954915907','PENDING',NULL,NULL,NULL,NULL,NULL),(82,'sshero1785955089184@test.com','$2a$10$nAKE1PUaTBSzBO0UNY./reqMiGlXuE5vxg57DrY7HE0QHFwKe3B7e','MENTOR','SS Hero',NULL,1,'2026-08-05 13:08:13',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 13:08:41','431152E0',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'sshero1785955091852',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'sshero1785955091852','PENDING',NULL,NULL,NULL,NULL,NULL),(83,'dash1785955175982@test.com','$2a$10$bu6EJG5bXVmVC0cz5spBOuC/drG0hXdSquoCPauMEa09uVNKSFaC6','MENTOR','Dash Hero',NULL,1,'2026-08-05 13:09:40',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 13:09:47','3FCD478A',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'dash1785955179645',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'dash1785955179645','PENDING',NULL,NULL,NULL,NULL,NULL),(84,'dash21785955228255@test.com','$2a$10$Or5wVVIuqSotVG5B1sY2R.kgbfdOg5OOvbvrXksiifEGkRNd.0NBu','MENTOR','Dash Two',NULL,1,'2026-08-05 13:10:34',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-08-05 13:10:41','D7FACD8A',NULL,'ANYONE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'dash21785955232068',NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'dash21785955232068','PENDING',NULL,NULL,NULL,NULL,NULL),(85,'rahulsharma@gmail.com','$2a$10$gI8ruswgIvq6fnqtrqGw.Oshelzan3zBBgqTn1YDpHvRr1jI9ocGi','MENTOR','Rahul Sharma',NULL,1,'2026-08-06 03:58:20','i am rahul','[{\"name\":\"java\",\"level\":\"Intermediate\"}]',NULL,'https://www.linkedin.com/in/nakulsharma97',NULL,NULL,NULL,NULL,'https://plus.unsplash.com/premium_photo-1689568126014-06fea9d5d341?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8cHJvZmlsZXxlbnwwfHwwfHx8MA%3D%3D',0,'2026-08-06 10:26:08','A84C02FD',NULL,'ANYONE',NULL,NULL,'Software Engineer',1,'English',33.00,NULL,NULL,NULL,'rahul97',NULL,1,'India','Rajasthan','Alwar','+919783970097','Asia/Kolkata','IIT Delhi','https://leetcode.com/','6-9 pm',NULL,NULL,'rahul97','PENDING',NULL,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wallet_ledger_entries`
--

DROP TABLE IF EXISTS `wallet_ledger_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wallet_ledger_entries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `type` varchar(30) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `balance_after` decimal(12,2) NOT NULL,
  `currency` varchar(20) NOT NULL DEFAULT 'CREDITS',
  `description` varchar(255) NOT NULL,
  `reference_type` varchar(60) DEFAULT NULL,
  `reference_id` bigint DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wallet_ledger_user_created` (`user_id`,`created_at`),
  KEY `idx_wallet_ledger_reference` (`reference_type`,`reference_id`),
  CONSTRAINT `fk_wallet_ledger_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wallet_ledger_entries`
--

LOCK TABLES `wallet_ledger_entries` WRITE;
/*!40000 ALTER TABLE `wallet_ledger_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `wallet_ledger_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'skill'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-07 12:37:44
