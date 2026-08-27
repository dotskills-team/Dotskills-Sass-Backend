--
-- PostgreSQL database dump
--

\restrict w8DmI3aUr83AVRnn93mEjNRDQBhHEJZLxwe1U8yYRB32OspwO2DtQaOXkvPQOwR

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AccountStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AccountStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'LOCKED',
    'SUSPENDED'
);


ALTER TYPE public."AccountStatus" OWNER TO postgres;

--
-- Name: AuditActorType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AuditActorType" AS ENUM (
    'PLATFORM_MEMBER',
    'COMPANY_MEMBER',
    'SYSTEM'
);


ALTER TYPE public."AuditActorType" OWNER TO postgres;

--
-- Name: BillingAttemptStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."BillingAttemptStatus" AS ENUM (
    'STARTED',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED'
);


ALTER TYPE public."BillingAttemptStatus" OWNER TO postgres;

--
-- Name: BillingCycle; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."BillingCycle" AS ENUM (
    'MONTHLY',
    'YEARLY'
);


ALTER TYPE public."BillingCycle" OWNER TO postgres;

--
-- Name: BillingStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."BillingStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED',
    'SKIPPED'
);


ALTER TYPE public."BillingStatus" OWNER TO postgres;

--
-- Name: CompanyMembershipStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."CompanyMembershipStatus" AS ENUM (
    'INVITED',
    'ACTIVE',
    'SUSPENDED',
    'REVOKED'
);


ALTER TYPE public."CompanyMembershipStatus" OWNER TO postgres;

--
-- Name: CompanyScopeType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."CompanyScopeType" AS ENUM (
    'COMPANY',
    'BRANCH',
    'WAREHOUSE',
    'POS_COUNTER'
);


ALTER TYPE public."CompanyScopeType" OWNER TO postgres;

--
-- Name: CompanyStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."CompanyStatus" AS ENUM (
    'DRAFT',
    'ONBOARDING',
    'READY',
    'LIVE',
    'SUSPENDED',
    'CLOSED'
);


ALTER TYPE public."CompanyStatus" OWNER TO postgres;

--
-- Name: FeatureStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."FeatureStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'ARCHIVED'
);


ALTER TYPE public."FeatureStatus" OWNER TO postgres;

--
-- Name: IndustryStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."IndustryStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'ARCHIVED'
);


ALTER TYPE public."IndustryStatus" OWNER TO postgres;

--
-- Name: InvitationStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."InvitationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'EXPIRED',
    'REVOKED'
);


ALTER TYPE public."InvitationStatus" OWNER TO postgres;

--
-- Name: InvitationType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."InvitationType" AS ENUM (
    'COMPANY_OWNER',
    'COMPANY_STAFF',
    'PLATFORM_MEMBER'
);


ALTER TYPE public."InvitationType" OWNER TO postgres;

--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'DRAFT',
    'ISSUED',
    'PAID',
    'CANCELLED',
    'VOID'
);


ALTER TYPE public."InvoiceStatus" OWNER TO postgres;

--
-- Name: PaymentProvider; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentProvider" AS ENUM (
    'SSLCOMMERZ'
);


ALTER TYPE public."PaymentProvider" OWNER TO postgres;

--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'SUCCEEDED',
    'FAILED',
    'CANCELLED'
);


ALTER TYPE public."PaymentStatus" OWNER TO postgres;

--
-- Name: PermissionEffect; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PermissionEffect" AS ENUM (
    'ALLOW',
    'DENY'
);


ALTER TYPE public."PermissionEffect" OWNER TO postgres;

--
-- Name: PermissionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PermissionStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public."PermissionStatus" OWNER TO postgres;

--
-- Name: PlanStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PlanStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'ARCHIVED'
);


ALTER TYPE public."PlanStatus" OWNER TO postgres;

--
-- Name: PlatformMembershipStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PlatformMembershipStatus" AS ENUM (
    'INVITED',
    'ACTIVE',
    'SUSPENDED',
    'REVOKED'
);


ALTER TYPE public."PlatformMembershipStatus" OWNER TO postgres;

--
-- Name: RoleStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."RoleStatus" AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public."RoleStatus" OWNER TO postgres;

--
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
    'GRACE',
    'SUSPENDED',
    'CANCELLED',
    'EXPIRED'
);


ALTER TYPE public."SubscriptionStatus" OWNER TO postgres;

--
-- Name: TenantStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TenantStatus" AS ENUM (
    'DRAFT',
    'TRIAL',
    'ACTIVE',
    'SUSPENDED',
    'CANCELLED'
);


ALTER TYPE public."TenantStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    "tenantId" uuid,
    "companyId" uuid,
    "actorUserId" uuid,
    "actorType" public."AuditActorType" DEFAULT 'SYSTEM'::public."AuditActorType" NOT NULL,
    action character varying(120) NOT NULL,
    "entityType" character varying(100) NOT NULL,
    "entityId" uuid,
    "requestId" uuid,
    "ipAddress" inet,
    "userAgent" text,
    "beforeData" jsonb,
    "afterData" jsonb,
    metadata jsonb,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_sessions (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "refreshTokenHash" character(64) NOT NULL,
    "deviceId" character varying(160),
    "ipAddress" inet,
    "userAgent" text,
    "issuedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastSeenAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(6) with time zone NOT NULL,
    "revokedAt" timestamp(6) with time zone,
    "revokeReason" character varying(120),
    "replacedByHash" character(64)
);


ALTER TABLE public.auth_sessions OWNER TO postgres;

--
-- Name: billing_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.billing_attempts (
    id uuid NOT NULL,
    "billingId" uuid NOT NULL,
    "attemptNumber" integer NOT NULL,
    status public."BillingAttemptStatus" DEFAULT 'STARTED'::public."BillingAttemptStatus" NOT NULL,
    "attemptedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(6) with time zone,
    "failureCode" character varying(100),
    "failureMessage" text,
    "idempotencyKey" character varying(200) NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.billing_attempts OWNER TO postgres;

--
-- Name: billings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.billings (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "companyId" uuid,
    "subscriptionId" uuid NOT NULL,
    status public."BillingStatus" DEFAULT 'PENDING'::public."BillingStatus" NOT NULL,
    "billingCycle" public."BillingCycle" NOT NULL,
    "currencyCode" character(3) NOT NULL,
    amount numeric(20,4) NOT NULL,
    "periodStart" timestamp(6) with time zone NOT NULL,
    "periodEnd" timestamp(6) with time zone NOT NULL,
    "dueAt" timestamp(6) with time zone NOT NULL,
    "processedAt" timestamp(6) with time zone,
    "failedAt" timestamp(6) with time zone,
    "cancelledAt" timestamp(6) with time zone,
    "attemptCount" integer DEFAULT 0 NOT NULL,
    "nextAttemptAt" timestamp(6) with time zone,
    "idempotencyKey" character varying(200) NOT NULL,
    "priceSnapshot" jsonb NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.billings OWNER TO postgres;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "industryId" uuid NOT NULL,
    "createdByUserId" uuid,
    code character varying(40) NOT NULL,
    "legalName" character varying(200) NOT NULL,
    "tradeName" character varying(200),
    email character varying(200),
    phone character varying(32),
    "taxId" character varying(80),
    "registrationNo" character varying(80),
    "baseCurrencyCode" character(3) DEFAULT 'BDT'::bpchar NOT NULL,
    timezone character varying(80) DEFAULT 'Asia/Dhaka'::character varying NOT NULL,
    status public."CompanyStatus" DEFAULT 'DRAFT'::public."CompanyStatus" NOT NULL,
    "goLiveAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.companies OWNER TO postgres;

--
-- Name: company_member_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_member_roles (
    "companyMemberId" uuid NOT NULL,
    "companyRoleId" uuid NOT NULL,
    "assignedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assignedByUserId" uuid,
    "expiresAt" timestamp(6) with time zone
);


ALTER TABLE public.company_member_roles OWNER TO postgres;

--
-- Name: company_member_scopes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_member_scopes (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "companyId" uuid NOT NULL,
    "companyMemberId" uuid NOT NULL,
    "scopeType" public."CompanyScopeType" NOT NULL,
    "scopeKey" character varying(120) DEFAULT '*'::character varying NOT NULL,
    conditions jsonb,
    "validFrom" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "validUntil" timestamp(6) with time zone,
    "assignedByUserId" uuid,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.company_member_scopes OWNER TO postgres;

--
-- Name: company_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_members (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "companyId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "employeeCode" character varying(50),
    designation character varying(120),
    status public."CompanyMembershipStatus" DEFAULT 'INVITED'::public."CompanyMembershipStatus" NOT NULL,
    "invitedAt" timestamp(6) with time zone,
    "joinedAt" timestamp(6) with time zone,
    "activatedAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.company_members OWNER TO postgres;

--
-- Name: company_ownerships; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_ownerships (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "companyId" uuid NOT NULL,
    "companyMemberId" uuid NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "startedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endedAt" timestamp(6) with time zone,
    "assignedByUserId" uuid
);


ALTER TABLE public.company_ownerships OWNER TO postgres;

--
-- Name: company_role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_role_permissions (
    "companyRoleId" uuid NOT NULL,
    "permissionId" uuid NOT NULL,
    effect public."PermissionEffect" DEFAULT 'ALLOW'::public."PermissionEffect" NOT NULL,
    conditions jsonb,
    "assignedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assignedByUserId" uuid
);


ALTER TABLE public.company_role_permissions OWNER TO postgres;

--
-- Name: company_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_roles (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "companyId" uuid NOT NULL,
    code character varying(60) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL,
    status public."RoleStatus" DEFAULT 'ACTIVE'::public."RoleStatus" NOT NULL
);


ALTER TABLE public.company_roles OWNER TO postgres;

--
-- Name: features; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.features (
    id uuid NOT NULL,
    code character varying(80) NOT NULL,
    name character varying(120) NOT NULL,
    module character varying(80) NOT NULL,
    description text,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL,
    status public."FeatureStatus" DEFAULT 'ACTIVE'::public."FeatureStatus" NOT NULL,
    "configSchema" jsonb
);


ALTER TABLE public.features OWNER TO postgres;

--
-- Name: industries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.industries (
    id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL,
    status public."IndustryStatus" DEFAULT 'ACTIVE'::public."IndustryStatus" NOT NULL
);


ALTER TABLE public.industries OWNER TO postgres;

--
-- Name: invitations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invitations (
    id uuid NOT NULL,
    type public."InvitationType" NOT NULL,
    status public."InvitationStatus" DEFAULT 'PENDING'::public."InvitationStatus" NOT NULL,
    "tenantId" uuid,
    "companyId" uuid,
    "invitedUserId" uuid,
    email character varying(200) NOT NULL,
    "tokenHash" character(64) NOT NULL,
    "expiresAt" timestamp(6) with time zone NOT NULL,
    "acceptedAt" timestamp(6) with time zone,
    "revokedAt" timestamp(6) with time zone,
    "sentByUserId" uuid,
    metadata jsonb,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.invitations OWNER TO postgres;

--
-- Name: invoice_sequences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_sequences (
    "yearKey" character varying(4) NOT NULL,
    "lastNumber" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.invoice_sequences OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "companyId" uuid,
    "subscriptionId" uuid NOT NULL,
    "billingId" uuid NOT NULL,
    "invoiceNumber" character varying(40) NOT NULL,
    status public."InvoiceStatus" DEFAULT 'DRAFT'::public."InvoiceStatus" NOT NULL,
    "currencyCode" character(3) NOT NULL,
    subtotal numeric(20,4) NOT NULL,
    "discountAmount" numeric(20,4) DEFAULT 0 NOT NULL,
    "taxAmount" numeric(20,4) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(20,4) NOT NULL,
    "priceSnapshot" jsonb NOT NULL,
    "issuedAt" timestamp(6) with time zone,
    "dueAt" timestamp(6) with time zone NOT NULL,
    "paidAt" timestamp(6) with time zone,
    "cancelledAt" timestamp(6) with time zone,
    "voidedAt" timestamp(6) with time zone,
    metadata jsonb,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: login_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_events (
    id uuid NOT NULL,
    "userId" uuid,
    email character varying(200),
    success boolean NOT NULL,
    reason character varying(120),
    "ipAddress" inet,
    "userAgent" text,
    "occurredAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.login_events OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "companyId" uuid,
    "subscriptionId" uuid NOT NULL,
    "invoiceId" uuid NOT NULL,
    provider public."PaymentProvider" NOT NULL,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    "currencyCode" character(3) NOT NULL,
    amount numeric(20,4) NOT NULL,
    "providerTransactionId" character varying(64) NOT NULL,
    "gatewayReference" character varying(64),
    "idempotencyKey" character varying(200) NOT NULL,
    "failureReason" text,
    "rawInitiateResponse" jsonb,
    "rawVerifyResponse" jsonb,
    metadata jsonb,
    "initiatedAt" timestamp(6) with time zone,
    "succeededAt" timestamp(6) with time zone,
    "failedAt" timestamp(6) with time zone,
    "cancelledAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id uuid NOT NULL,
    code character varying(120) NOT NULL,
    "moduleCode" character varying(80) NOT NULL,
    resource character varying(80) NOT NULL,
    action character varying(80) NOT NULL,
    name character varying(160) NOT NULL,
    description text,
    "isSystem" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL,
    status public."PermissionStatus" DEFAULT 'ACTIVE'::public."PermissionStatus" NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: plan_features; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plan_features (
    "planId" uuid NOT NULL,
    "featureId" uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    limits jsonb,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.plan_features OWNER TO postgres;

--
-- Name: plan_prices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plan_prices (
    id uuid NOT NULL,
    "planId" uuid NOT NULL,
    "billingCycle" public."BillingCycle" NOT NULL,
    "currencyCode" character(3) DEFAULT 'BDT'::bpchar NOT NULL,
    amount numeric(20,4) NOT NULL,
    "effectiveFrom" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "effectiveTo" timestamp(6) with time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.plan_prices OWNER TO postgres;

--
-- Name: plans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plans (
    id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    "trialDays" integer DEFAULT 0 NOT NULL,
    "isPublic" boolean DEFAULT true NOT NULL,
    status public."PlanStatus" DEFAULT 'ACTIVE'::public."PlanStatus" NOT NULL,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL,
    "isDefaultTrial" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.plans OWNER TO postgres;

--
-- Name: platform_member_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_member_roles (
    "platformMemberId" uuid NOT NULL,
    "platformRoleId" uuid NOT NULL,
    "assignedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assignedByUserId" uuid
);


ALTER TABLE public.platform_member_roles OWNER TO postgres;

--
-- Name: platform_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_members (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    "employeeCode" character varying(50),
    status public."PlatformMembershipStatus" DEFAULT 'INVITED'::public."PlatformMembershipStatus" NOT NULL,
    "invitedAt" timestamp(6) with time zone,
    "activatedAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.platform_members OWNER TO postgres;

--
-- Name: platform_role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_role_permissions (
    "platformRoleId" uuid NOT NULL,
    "permissionId" uuid NOT NULL,
    effect public."PermissionEffect" DEFAULT 'ALLOW'::public."PermissionEffect" NOT NULL,
    conditions jsonb,
    "assignedAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assignedByUserId" uuid
);


ALTER TABLE public.platform_role_permissions OWNER TO postgres;

--
-- Name: platform_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_roles (
    id uuid NOT NULL,
    code character varying(60) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL,
    "isSystem" boolean DEFAULT false NOT NULL,
    status public."RoleStatus" DEFAULT 'ACTIVE'::public."RoleStatus" NOT NULL
);


ALTER TABLE public.platform_roles OWNER TO postgres;

--
-- Name: subscription_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_events (
    id uuid NOT NULL,
    "subscriptionId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "companyId" uuid,
    "fromStatus" public."SubscriptionStatus",
    "toStatus" public."SubscriptionStatus" NOT NULL,
    reason character varying(160) NOT NULL,
    source character varying(40) NOT NULL,
    "actorUserId" uuid,
    "idempotencyKey" character varying(200),
    metadata jsonb,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.subscription_events OWNER TO postgres;

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "companyId" uuid,
    "planId" uuid NOT NULL,
    status public."SubscriptionStatus" DEFAULT 'TRIALING'::public."SubscriptionStatus" NOT NULL,
    "billingCycle" public."BillingCycle" NOT NULL,
    "startsAt" timestamp(6) with time zone NOT NULL,
    "trialEndsAt" timestamp(6) with time zone,
    "currentPeriodStart" timestamp(6) with time zone NOT NULL,
    "currentPeriodEnd" timestamp(6) with time zone NOT NULL,
    "graceEndsAt" timestamp(6) with time zone,
    "cancelledAt" timestamp(6) with time zone,
    "autoRenew" boolean DEFAULT true NOT NULL,
    "priceSnapshot" jsonb NOT NULL,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL,
    "pastDueEndsAt" timestamp(6) with time zone,
    "suspendedAt" timestamp(6) with time zone,
    "suspensionExpiresAt" timestamp(6) with time zone,
    "isComplimentary" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenants (
    id uuid NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(160) NOT NULL,
    slug character varying(120) NOT NULL,
    status public."TenantStatus" DEFAULT 'DRAFT'::public."TenantStatus" NOT NULL,
    "trialEndsAt" timestamp(6) with time zone,
    "activatedAt" timestamp(6) with time zone,
    "suspendedAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.tenants OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(200),
    phone character varying(32),
    "passwordHash" text,
    "fullName" character varying(160) NOT NULL,
    "preferredLocale" character varying(20) DEFAULT 'bn-BD'::character varying NOT NULL,
    timezone character varying(80) DEFAULT 'Asia/Dhaka'::character varying NOT NULL,
    status public."AccountStatus" DEFAULT 'ACTIVE'::public."AccountStatus" NOT NULL,
    "emailVerifiedAt" timestamp(6) with time zone,
    "phoneVerifiedAt" timestamp(6) with time zone,
    "passwordChangedAt" timestamp(6) with time zone,
    "failedLoginCount" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp(6) with time zone,
    "lastLoginAt" timestamp(6) with time zone,
    "createdAt" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(6) with time zone NOT NULL,
    "deletedAt" timestamp(6) with time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
dfd16410-fa7b-4b39-a6d6-a01be8fd3e29	6171191b08b61a040340d1041916fe104c91177767350344aaca6341001d7f96	2026-08-08 17:09:10.011571+06	20260808110909_create_dotskills_test	\N	\N	2026-08-08 17:09:09.983778+06	1
5a5b3878-bfb6-4d09-b34a-aab138f18dbd	101677ea5c2cc06f8949c8ca21be452675ae56e26fc7fdeddff48e599dd2ff6a	2026-08-09 12:41:55.894493+06	20260809064155_phase_1_foundation	\N	\N	2026-08-09 12:41:55.432278+06	1
d2b216af-cf9f-49cc-9acc-fedc757df859	9ac08ddea8bb56d4e066d58c846294aace7b298f1e6817267d7a444342b82173	2026-08-09 16:41:08.595771+06	20260809104108_add_platform_company_rbac_permissions	\N	\N	2026-08-09 16:41:08.490304+06	1
5921629e-39ee-4ce2-9b96-585ab59e1f24	d5f48b73668a456d0d1dba39ed2502cc07cfea5d33e93305d39f5bfc08dc0173	2026-08-10 10:58:09.097507+06	20260810045809_002_access_control_completion	\N	\N	2026-08-10 10:58:09.025878+06	1
2cb485a0-7492-435e-ad33-1212be38141c	a995364c50a8b7a45bed24ff8910abc4a6becdc48f1e5afe3a49355edaac4013	2026-08-11 16:07:35.182576+06	20260811100735_add_industry_archived_status	\N	\N	2026-08-11 16:07:35.074266+06	1
aa68bac7-abc9-4f2d-8dda-fbb8913f4e4d	81f1e421dee47553213cebccbd2a1ded1cd3a36bad9f7d918e362b72429040a3	2026-08-13 14:57:58.563541+06	20260813085758_npx_prisma_generate	\N	\N	2026-08-13 14:57:58.455832+06	1
abb91f23-6b77-4933-81d6-d512b693fb24	5b23f32eb90546f4a3012f05d98b05d0be4b548dc4caa6019800734cfe65fee2	2026-08-17 13:43:20.705061+06	20260817074320_add_billing_models	\N	\N	2026-08-17 13:43:20.514582+06	1
18f78d1c-15db-4e7b-8a8f-2946d27e4dbd	feb84cad6dfa9efee4471634ff23dc4184ee5f9b7f850fb0cb6c315eedccf880	2026-08-18 18:06:45.725823+06	20260818180119_add_invoice_module	\N	\N	2026-08-18 18:06:45.577511+06	1
ac0e361b-6ced-4a59-9293-4b0383482287	cd82e52f202ffed698c41e804a777cb828483428b9d00a56d1636c13e483a8e2	2026-08-19 10:51:04.750709+06	20260819105004_add_payment_module	\N	\N	2026-08-19 10:51:04.613326+06	1
039ce69a-a890-49d4-acaf-1768ddbfe23d	6a13f6ffd7748a63c50072b6de1dc1f3718dee679100023927d2121329a2a33c	2026-08-22 11:02:38.570167+06	20260822050238_add_feature_config_schema	\N	\N	2026-08-22 11:02:38.564635+06	1
6654ab5b-2d8e-4341-a95d-1ae01f87a9d9	c0fe72aac61b85239e8064c3aaa8aa41f000facc3cea92e256b117acb140a251	2026-08-27 13:13:20.42427+06	20260827071320_add_plan_default_trial_and_subscription_complimentary	\N	\N	2026-08-27 13:13:20.365534+06	1
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, "tenantId", "companyId", "actorUserId", "actorType", action, "entityType", "entityId", "requestId", "ipAddress", "userAgent", "beforeData", "afterData", metadata, "createdAt") FROM stdin;
791a1ae2-0925-427c-8ae0-1616486368a1	809958ef-bcc7-4dfd-a02c-527177ac5ba7	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	TENANT_CREATED	TENANT	809958ef-bcc7-4dfd-a02c-527177ac5ba7	\N	\N	\N	\N	{"id": "809958ef-bcc7-4dfd-a02c-527177ac5ba7", "code": "ACME", "name": "Acme", "slug": "acme", "status": "DRAFT"}	\N	2026-08-23 05:04:16.759+06
b66e226c-7b7a-4140-984e-133552c395e2	\N	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	INDUSTRY_CREATED	Industry	5c961a18-af13-4638-b93d-b7faa4c502b7	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	{"id": "5c961a18-af13-4638-b93d-b7faa4c502b7", "code": "SUPERSHOP", "name": "Super shop", "status": "ACTIVE", "createdAt": "2026-08-22T11:29:45.997Z", "updatedAt": "2026-08-22T11:29:45.997Z", "description": null}	\N	2026-08-22 11:29:46.007+06
556fba4a-e4b0-44d6-b641-f2610b9344ee	\N	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	PLAN_CREATED	PLAN	ea3df633-994b-4022-934a-65ea50508089	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	null	{"id": "ea3df633-994b-4022-934a-65ea50508089", "code": "BASIC", "name": "basic", "status": "ACTIVE", "isPublic": true, "trialDays": 0, "description": null}	{"source": "PLAN_SERVICE"}	2026-08-22 11:30:11.111+06
beb96e4e-8020-4be7-a189-a8376556b42a	\N	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	PLAN_CREATED	PLAN	794b6c06-55a9-427c-ae40-874d7628158c	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	null	{"id": "794b6c06-55a9-427c-ae40-874d7628158c", "code": "MEDIUM", "name": "medium", "status": "ACTIVE", "isPublic": true, "trialDays": 0, "description": null}	{"source": "PLAN_SERVICE"}	2026-08-22 11:30:34.483+06
32b05ded-3f81-4e5f-a01b-5a3367f70cc3	\N	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	PLAN_CREATED	PLAN	225c1374-d952-4e8c-8d47-503e2515d26e	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	null	{"id": "225c1374-d952-4e8c-8d47-503e2515d26e", "code": "PRO", "name": "pro", "status": "ACTIVE", "isPublic": true, "trialDays": 0, "description": null}	{"source": "PLAN_SERVICE"}	2026-08-22 11:30:47.744+06
f99ec075-948c-4875-8a9a-eb84994ec5a6	\N	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	FEATURE_CREATED	FEATURE	b4994c7f-ad92-463f-81f0-28bb8b8d7014	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	null	{"id": "b4994c7f-ad92-463f-81f0-28bb8b8d7014", "code": "POS", "name": "POS Management", "module": "POS", "status": "ACTIVE", "description": null, "configSchema": []}	{"source": "FEATURE_SERVICE"}	2026-08-22 11:34:18.519+06
2256184c-7553-4e66-bf60-19e026eef97f	\N	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	PLAN_FEATURE_ASSIGNED	PLAN_FEATURE	225c1374-d952-4e8c-8d47-503e2515d26e	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	null	{"limits": {}, "planId": "225c1374-d952-4e8c-8d47-503e2515d26e", "enabled": true, "planCode": "PRO", "featureId": "b4994c7f-ad92-463f-81f0-28bb8b8d7014", "featureCode": "POS"}	{"source": "PLAN_FEATURE_SERVICE"}	2026-08-22 11:34:38.179+06
8601e73d-255f-4dcb-9e5e-ca654a959024	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	COMPANY_OWNER_CREATED	CompanyOwnership	365e925a-9178-47ab-b260-a8d659f9a581	\N	\N	\N	{}	{"userId": "68c8a00e-0f20-4dda-ad86-5c80143a2877", "companyId": "b7cbbf94-491b-4db3-a64c-2daa06556b6e", "isPrimary": true, "ownerRoleId": "2a23f140-ff6f-4ed0-ab68-0367f4ae8450", "userCreated": true, "companyMemberId": "70cf9efc-9b4f-4f84-ac9a-005f7a76844e"}	\N	2026-08-25 06:16:21.247+06
033737c9-8a35-4244-a75e-a82d307f75e5	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	774bb094-6628-422a-beaf-dc0ae9e50984	COMPANY_MEMBER	SUBSCRIPTION_CREATED	Subscription	e49f57a0-7342-4181-97e1-ddf2b5bc2320	\N	\N	\N	\N	{"planId": "225c1374-d952-4e8c-8d47-503e2515d26e", "status": "ACTIVE"}	\N	2026-08-25 06:26:25.78+06
f1491b7e-8842-4d5c-ba7e-a37f6cbfcb03	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	INVOICE_ISSUED	Invoice	cfcd1ee7-856c-440d-ba39-4b9d6f4ba807	\N	\N	\N	{"status": "DRAFT"}	{"status": "ISSUED", "issuedAt": "2026-08-25T06:31:35.034Z"}	\N	2026-08-25 06:31:35.043+06
f42cb193-f0c9-42f4-8783-8336c4af125a	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	68c8a00e-0f20-4dda-ad86-5c80143a2877	COMPANY_MEMBER	PAYMENT_CREATED	Payment	630a045e-f4a9-4fdc-98e8-45a5782a3379	\N	\N	\N	\N	{"status": "PENDING", "invoiceId": "cfcd1ee7-856c-440d-ba39-4b9d6f4ba807"}	\N	2026-08-25 06:40:00.771+06
e77e2736-d6e8-41f4-9c64-42a96161f30b	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	68c8a00e-0f20-4dda-ad86-5c80143a2877	COMPANY_MEMBER	PAYMENT_INITIATED	Payment	630a045e-f4a9-4fdc-98e8-45a5782a3379	\N	\N	\N	\N	{"status": "PROCESSING"}	\N	2026-08-25 06:40:01.197+06
f08d9340-5c8c-45cf-ae3b-fd111bac5fe8	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	INVOICE_CREATED	Invoice	8a9cef40-acc8-4b83-b6f9-94b27b4ab46e	\N	\N	\N	\N	{"status": "DRAFT", "billingId": "eb6d3cbd-7dd9-4ac4-b637-d299495de49d", "totalAmount": "6", "invoiceNumber": "INV-2026-000007"}	\N	2026-08-25 07:03:14.511+06
c4df7d9b-0c55-4b69-9dfd-af842846fc2f	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	COMPANY_OWNER_CREATED	CompanyOwnership	9cb9ce3d-107f-44c4-a7d7-249c014f302a	\N	\N	\N	{}	{"userId": "3c1bd3c5-8511-413b-8372-95c40f088b3d", "companyId": "86531dfa-8018-4f37-a5c3-84cfebe31214", "isPrimary": true, "ownerRoleId": "fa46b4e4-b100-49fd-b36d-005c8fa16dcf", "userCreated": true, "companyMemberId": "609a9ce0-94c2-49d5-be51-859ab314b55c"}	\N	2026-08-25 07:04:01.269+06
2d191269-7628-4756-887f-15e63d32b983	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	3c1bd3c5-8511-413b-8372-95c40f088b3d	COMPANY_MEMBER	PAYMENT_CREATED	Payment	6cc4c315-a566-494c-ad50-320dbfbc58d4	\N	\N	\N	\N	{"status": "PENDING", "invoiceId": "8a9cef40-acc8-4b83-b6f9-94b27b4ab46e"}	\N	2026-08-25 07:05:00.587+06
6133500e-bafb-4543-b81e-3fcb05b5b79f	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	3c1bd3c5-8511-413b-8372-95c40f088b3d	COMPANY_MEMBER	PAYMENT_INITIATED	Payment	6cc4c315-a566-494c-ad50-320dbfbc58d4	\N	\N	\N	\N	{"status": "PROCESSING"}	\N	2026-08-25 07:05:01.04+06
d52a0016-0bd7-4edc-bd9f-fd777fbf91ac	\N	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	ACCESS_CONTROL_SETUP_COMPLETED	Permission	\N	\N	\N	\N	\N	{"mappedRoles": ["SUPER_ADMIN", "PLATFORM_ADMIN"], "permissionCodes": ["platform.staff.read", "platform.staff.create", "platform.staff.update", "platform.staff.status", "platform.staff.role.assign", "platform.role.read", "platform.role.create", "platform.role.update", "platform.role.status", "platform.role.permission.assign", "platform.company.read", "platform.company.create", "platform.company.update", "platform.company.status", "platform.company.activate", "platform.company.suspend", "platform.company.owner.read", "platform.company.owner.create", "platform.company.owner.update", "platform.company.owner.change", "platform.company.owner.status", "platform.tenant.create", "platform.tenant.read", "platform.tenant.update", "platform.tenant.status", "platform.tenant.delete", "platform.industry.read", "platform.industry.create", "platform.industry.update", "platform.industry.status", "platform.industry.activate", "platform.industry.deactivate", "platform.industry.delete", "billing.create", "billing.read", "billing.process", "billing.retry", "billing.cancel", "billing.skip", "billing.mark_succeeded", "billing.mark_failed", "invoice.create", "invoice.read", "invoice.issue", "invoice.cancel", "invoice.void", "invoice.mark_paid", "payment.read", "payment.verify", "payment.cancel", "company.rbac.bootstrap", "platform.feature.create", "platform.feature.read", "platform.feature.update", "platform.feature.status", "platform.feature.activate", "platform.feature.deactivate", "platform.feature.archive", "plan.pricing.create", "plan.pricing.read", "plan.pricing.update", "plan.pricing.status", "platform.plan.read", "platform.plan.create", "platform.plan.update", "platform.plan.status", "platform.plan.archive", "platform.plan.feature.read", "platform.plan.feature.assign", "platform.plan.feature.update", "platform.plan.feature.remove", "subscription:create", "subscription:read", "subscription:update", "subscription:change-plan", "subscription:cancel", "subscription:renew", "subscription:suspend", "subscription:reactivate", "subscription:expire", "company.rbac.read", "company.role.create", "company.role.update", "company.role.permission.assign", "company.member.read", "company.member.create", "company.member.update", "company.member.role.assign", "company.member.scope.assign", "company.subscription.read", "company.subscription.auto-renew", "company.subscription.change-plan", "company.subscription.cancel", "company.subscription.reactivate", "company.invoice.read", "company.payment.create", "company.payment.read"]}	\N	2026-08-25 08:59:41.373+06
ecf7d186-cf9c-421c-9828-ff867f4c86b7	809958ef-bcc7-4dfd-a02c-527177ac5ba7	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	TENANT_STATUS_CHANGED	TENANT	809958ef-bcc7-4dfd-a02c-527177ac5ba7	\N	\N	\N	{"status": "DRAFT"}	{"status": "ACTIVE"}	\N	2026-08-25 09:06:06.211+06
e629a0f0-3667-4dce-8ea5-8de42150def7	\N	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	FEATURE_CREATED	FEATURE	555079bb-4042-4952-aeb9-2dc6b663b40b	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	null	{"id": "555079bb-4042-4952-aeb9-2dc6b663b40b", "code": "PRODUCT", "name": "Product", "module": "PRODUCT", "status": "ACTIVE", "description": null, "configSchema": []}	{"source": "FEATURE_SERVICE"}	2026-08-25 11:37:47.716+06
569193ca-183e-4205-a685-f4fc64a2f68f	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	3c1bd3c5-8511-413b-8372-95c40f088b3d	COMPANY_MEMBER	COMPANY_ROLE_PERMISSIONS_REPLACED	CompanyRole	ba3b7144-7075-4277-97ec-964326d015b2	\N	\N	\N	\N	[{"code": "company.member.create", "effect": "ALLOW"}, {"code": "company.member.read", "effect": "ALLOW"}, {"code": "company.member.role.assign", "effect": "ALLOW"}, {"code": "company.member.scope.assign", "effect": "ALLOW"}, {"code": "company.member.update", "effect": "ALLOW"}, {"code": "company.rbac.read", "effect": "ALLOW"}, {"code": "company.role.permission.assign", "effect": "ALLOW"}, {"code": "company.role.update", "effect": "ALLOW"}, {"code": "company.role.create", "effect": "ALLOW"}]	\N	2026-08-25 11:46:42.311+06
10f9a7bc-a51e-49f0-83b1-eab40b5a6e8d	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	COMPANY_RBAC_BOOTSTRAPPED	Company	b7cbbf94-491b-4db3-a64c-2daa06556b6e	\N	\N	\N	\N	{"defaultRoles": ["COMPANY_OWNER", "COMPANY_ADMIN", "MANAGER", "STAFF"], "ownerMemberId": null}	\N	2026-08-25 06:17:14.559+06
af1ce88e-c695-4971-b570-a64f3c000d24	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	INVOICE_CREATED	Invoice	cfcd1ee7-856c-440d-ba39-4b9d6f4ba807	\N	\N	\N	\N	{"status": "DRAFT", "billingId": "f81ba5f4-3f34-406a-b6b6-531735e0ef40", "totalAmount": "4", "invoiceNumber": "INV-2026-000006"}	\N	2026-08-25 06:31:13.767+06
aa18e16e-901b-41f1-a4b9-fe021312a55a	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	SUBSCRIPTION_PAST_DUE	Subscription	e49f57a0-7342-4181-97e1-ddf2b5bc2320	\N	\N	\N	{"status": "ACTIVE"}	{"reason": "PAYMENT_FAILED", "status": "PAST_DUE"}	\N	2026-08-25 06:39:28.153+06
52fbd1ea-8544-4189-8fd0-cbe9c0a12b90	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	774bb094-6628-422a-beaf-dc0ae9e50984	COMPANY_MEMBER	SUBSCRIPTION_CREATED	Subscription	509dc1a2-0c06-4a9b-b860-e0fed4a0b2c1	\N	\N	\N	\N	{"planId": "794b6c06-55a9-427c-ae40-874d7628158c", "status": "ACTIVE"}	\N	2026-08-25 07:02:06.112+06
766b97e3-2a3a-42be-b081-ba344fbf83d6	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	INVOICE_ISSUED	Invoice	8a9cef40-acc8-4b83-b6f9-94b27b4ab46e	\N	\N	\N	{"status": "DRAFT"}	{"status": "ISSUED", "issuedAt": "2026-08-25T07:03:21.420Z"}	\N	2026-08-25 07:03:21.436+06
1d411e9e-944b-4dde-ab08-eca374b0f079	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	COMPANY_RBAC_BOOTSTRAPPED	Company	86531dfa-8018-4f37-a5c3-84cfebe31214	\N	\N	\N	\N	{"defaultRoles": ["COMPANY_OWNER", "COMPANY_ADMIN", "MANAGER", "STAFF"], "ownerMemberId": null}	\N	2026-08-25 07:04:36.268+06
75f5af84-9fb0-4032-bfa2-40dec2a91141	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	3c1bd3c5-8511-413b-8372-95c40f088b3d	PLATFORM_MEMBER	INVOICE_PAID	Invoice	8a9cef40-acc8-4b83-b6f9-94b27b4ab46e	\N	\N	\N	{"status": "ISSUED"}	{"paidAt": "2026-08-25T07:06:06.993Z", "status": "PAID"}	\N	2026-08-25 07:06:06.996+06
ebf59fa5-9aa0-4705-87a7-8936e057c086	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	3c1bd3c5-8511-413b-8372-95c40f088b3d	PLATFORM_MEMBER	SUBSCRIPTION_ACTIVE	Subscription	509dc1a2-0c06-4a9b-b860-e0fed4a0b2c1	\N	\N	\N	{"status": "ACTIVE"}	{"reason": "PAYMENT_SUCCEEDED", "status": "ACTIVE"}	\N	2026-08-25 07:06:07.073+06
146c9a3a-aa20-4054-bbe8-fd1b5dcaa216	632bb8a8-f9f9-4093-a903-351e3614fc88	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	TENANT_CREATED	TENANT	632bb8a8-f9f9-4093-a903-351e3614fc88	\N	\N	\N	\N	{"id": "632bb8a8-f9f9-4093-a903-351e3614fc88", "code": "TANANT1", "name": "Tanant-1", "slug": "tanant-1", "status": "DRAFT"}	\N	2026-08-25 04:39:17.06+06
4886e902-73e4-4880-8f21-ccf057399598	65b4d86b-9ce6-4d78-901c-440b0c0fd721	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	TENANT_CREATED	TENANT	65b4d86b-9ce6-4d78-901c-440b0c0fd721	\N	\N	\N	\N	{"id": "65b4d86b-9ce6-4d78-901c-440b0c0fd721", "code": "TANANT2", "name": "Tanant-2", "slug": "tanant-2", "status": "DRAFT"}	\N	2026-08-25 04:39:40.023+06
056b9c51-2cba-494b-acf8-0e6d65c68a31	\N	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	PLAN_FEATURE_ASSIGNED	PLAN_FEATURE	794b6c06-55a9-427c-ae40-874d7628158c	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	null	{"limits": {}, "planId": "794b6c06-55a9-427c-ae40-874d7628158c", "enabled": true, "planCode": "MEDIUM", "featureId": "b4994c7f-ad92-463f-81f0-28bb8b8d7014", "featureCode": "POS"}	{"source": "PLAN_FEATURE_SERVICE"}	2026-08-25 04:42:27.595+06
362c904b-063d-4882-a5ff-80e89710b026	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	3c1bd3c5-8511-413b-8372-95c40f088b3d	SYSTEM	PAYMENT_SUCCEEDED	Payment	6cc4c315-a566-494c-ad50-320dbfbc58d4	\N	\N	\N	{"status": "PROCESSING"}	{"status": "SUCCEEDED"}	\N	2026-08-25 07:06:07.08+06
13f0ec7b-d260-4be9-a057-6735346a6817	65b4d86b-9ce6-4d78-901c-440b0c0fd721	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	TENANT_STATUS_CHANGED	TENANT	65b4d86b-9ce6-4d78-901c-440b0c0fd721	\N	\N	\N	{"status": "DRAFT"}	{"status": "ACTIVE"}	\N	2026-08-25 09:05:41.525+06
cc074576-ab21-494c-a3b9-4b7e92866d4f	632bb8a8-f9f9-4093-a903-351e3614fc88	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	TENANT_UPDATED	TENANT	632bb8a8-f9f9-4093-a903-351e3614fc88	\N	\N	\N	{"name": "Tanant-1", "slug": "tanant-1"}	{"name": "Tanant-1", "slug": "tanant-1"}	\N	2026-08-25 09:05:47.879+06
6fb9419a-0024-4a26-a242-fa71834560d9	632bb8a8-f9f9-4093-a903-351e3614fc88	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	TENANT_STATUS_CHANGED	TENANT	632bb8a8-f9f9-4093-a903-351e3614fc88	\N	\N	\N	{"status": "DRAFT"}	{"status": "ACTIVE"}	\N	2026-08-25 09:05:54.351+06
4835e453-b756-491b-850b-02041250a2c6	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	INVOICE_PAID	Invoice	cfcd1ee7-856c-440d-ba39-4b9d6f4ba807	\N	\N	\N	{"status": "ISSUED"}	{"paidAt": "2026-08-25T09:07:43.461Z", "status": "PAID"}	\N	2026-08-25 09:07:43.467+06
6dea5bfb-6fc0-49b6-93a1-a52bfaf92e78	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	SUBSCRIPTION_ACTIVE	Subscription	e49f57a0-7342-4181-97e1-ddf2b5bc2320	\N	\N	\N	{"status": "PAST_DUE"}	{"reason": "PAYMENT_SUCCEEDED", "status": "ACTIVE"}	\N	2026-08-25 09:07:43.544+06
8464344d-30a4-4624-930e-2a1116dee405	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	774bb094-6628-422a-beaf-dc0ae9e50984	SYSTEM	PAYMENT_SUCCEEDED	Payment	630a045e-f4a9-4fdc-98e8-45a5782a3379	\N	\N	\N	{"status": "PROCESSING"}	{"status": "SUCCEEDED"}	\N	2026-08-25 09:07:43.562+06
b465f5cf-1e94-4b17-9cdb-55f893ba0b0b	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	3c1bd3c5-8511-413b-8372-95c40f088b3d	COMPANY_MEMBER	COMPANY_MEMBER_CREATED	CompanyMember	bcc7b896-9288-4673-9a03-da7e7d3e0f77	\N	\N	\N	\N	{"email": "member@gmail.com", "roleCodes": ["MANAGER"]}	\N	2026-08-25 11:45:44.636+06
3694bcef-61d4-4c9f-b61c-70dd91a34677	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	3c1bd3c5-8511-413b-8372-95c40f088b3d	COMPANY_MEMBER	COMPANY_ROLE_PERMISSIONS_REPLACED	CompanyRole	e1899b90-e8a2-478e-9f46-683c6d02b142	\N	\N	\N	\N	[{"code": "company.invoice.read", "effect": "ALLOW"}]	\N	2026-08-25 11:47:58.853+06
c6482714-70ac-4c71-b189-015e973890eb	\N	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	PLAN_UPDATED	PLAN	794b6c06-55a9-427c-ae40-874d7628158c	\N	::1	curl/8.21.0	{"code": "MEDIUM", "name": "medium", "status": "ACTIVE", "isPublic": true, "trialDays": 0, "description": null, "isDefaultTrial": false}	{"code": "MEDIUM", "name": "medium", "status": "ACTIVE", "isPublic": true, "trialDays": 1, "description": null, "isDefaultTrial": true}	{"source": "PLAN_SERVICE"}	2026-08-27 07:27:20.122+06
ae44c572-6287-45c4-9c7a-ea979870f1fb	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	774bb094-6628-422a-beaf-dc0ae9e50984	SYSTEM	SUBSCRIPTION_CREATED	Subscription	338e8c3e-3cb1-48fa-bdc4-c70dea272fea	\N	\N	\N	\N	{"planId": "794b6c06-55a9-427c-ae40-874d7628158c", "status": "TRIALING"}	\N	2026-08-27 07:27:34.131+06
f446408e-ba36-4145-bf53-506820ec96b2	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	COMPANY_OWNER_CREATED	CompanyOwnership	06e758d2-2beb-4b4d-a370-26f68a053ec1	\N	\N	\N	{}	{"userId": "1d9c2ef0-a937-4a08-86fe-4c4404b336f0", "companyId": "3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7", "isPrimary": true, "ownerRoleId": "9968ffa4-8b0c-4380-926c-479f08743721", "userCreated": true, "companyMemberId": "4559b563-7554-40fe-a36e-b78209e1af1e"}	\N	2026-08-27 07:28:08.23+06
4fa2d555-95dc-4433-a756-b79a27b2a1aa	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	COMPANY_RBAC_BOOTSTRAPPED	Company	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	\N	\N	\N	\N	{"defaultRoles": ["COMPANY_OWNER", "COMPANY_ADMIN", "MANAGER", "STAFF"], "ownerMemberId": null}	\N	2026-08-27 07:28:41.713+06
21b9c5fe-411b-4ad1-a231-28b8cf5008bf	\N	\N	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	INDUSTRY_CREATED	Industry	65448ffe-49ef-4505-ac82-a3805dfe8ef6	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	\N	{"id": "65448ffe-49ef-4505-ac82-a3805dfe8ef6", "code": "RESTURENT", "name": "resturent", "status": "ACTIVE", "createdAt": "2026-08-25T05:42:25.359Z", "updatedAt": "2026-08-25T05:42:25.359Z", "description": null}	\N	2026-08-25 05:42:25.369+06
d74b06e7-0194-4cc1-9b50-6f848ffb1492	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	774bb094-6628-422a-beaf-dc0ae9e50984	PLATFORM_MEMBER	SUBSCRIPTION_SUSPENDED	Subscription	338e8c3e-3cb1-48fa-bdc4-c70dea272fea	\N	\N	\N	{"status": "TRIALING"}	{"reason": "live guard test", "status": "SUSPENDED"}	\N	2026-08-27 07:29:00.033+06
\.


--
-- Data for Name: auth_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auth_sessions (id, "userId", "refreshTokenHash", "deviceId", "ipAddress", "userAgent", "issuedAt", "lastSeenAt", "expiresAt", "revokedAt", "revokeReason", "replacedByHash") FROM stdin;
acb2fd85-8aaf-461c-b7ce-b44a4ff9bbf8	774bb094-6628-422a-beaf-dc0ae9e50984	17f6612ad2d7036920f88cf8b5efc084237eeb2cce8deed8ba608e70b14b7f83	\N	::1	node	2026-08-22 08:50:38.672+06	2026-08-22 08:59:08.161+06	2026-09-21 08:50:38.672+06	2026-08-22 08:59:08.161+06	ROTATED	c5c09f9758d38e91ff8fbe3f2978f29e20372183099963ab085937d874567183
8a114b9e-3289-49af-88ec-24b11884618c	774bb094-6628-422a-beaf-dc0ae9e50984	cdc287a3bc803147b1c074e49e816315cf1bd30657b496a68a5ae7b1495c9ad7	\N	::1	node	2026-08-25 06:09:51.88+06	2026-08-25 06:09:51.88+06	2026-09-24 06:09:51.88+06	2026-08-25 06:18:02.131+06	LOGOUT	\N
aacd437e-ca0c-42f7-a8d3-7e7a0c6a5940	774bb094-6628-422a-beaf-dc0ae9e50984	c5c09f9758d38e91ff8fbe3f2978f29e20372183099963ab085937d874567183	\N	::1	node	2026-08-22 08:59:08.161+06	2026-08-22 10:06:46.289+06	2026-09-21 08:59:08.161+06	2026-08-22 10:06:46.289+06	ROTATED	45d408c8ed404105d68df58ac3284eb4845ff0ffcef8ab9307121f2aa3669a19
5236e098-6297-4c8f-bfe6-a786566fcb18	774bb094-6628-422a-beaf-dc0ae9e50984	45d408c8ed404105d68df58ac3284eb4845ff0ffcef8ab9307121f2aa3669a19	\N	::1	node	2026-08-22 10:06:46.289+06	2026-08-22 11:27:17.513+06	2026-09-21 10:06:46.289+06	2026-08-22 11:27:17.513+06	ROTATED	efb60ba8f602da33c443fee9e89f45fb3460cf9ea378bf860daf05f1b6c04bb7
36ebb039-92cf-41f2-95ad-5c1b18ad02fb	68c8a00e-0f20-4dda-ad86-5c80143a2877	0e1c6cb6a2d1ccefd26dadacc4d687aba0d87fc112d12a41051c0015b8d21425	\N	::1	node	2026-08-25 06:33:05.17+06	2026-08-25 06:33:05.17+06	2026-09-24 06:33:05.17+06	2026-08-25 06:38:59.689+06	LOGOUT	\N
2b1eee46-9a07-4ca6-8da3-d499340bb41f	774bb094-6628-422a-beaf-dc0ae9e50984	efb60ba8f602da33c443fee9e89f45fb3460cf9ea378bf860daf05f1b6c04bb7	\N	::1	node	2026-08-22 11:27:17.513+06	2026-08-22 11:45:10.605+06	2026-09-21 11:27:17.513+06	2026-08-22 11:45:10.605+06	ROTATED	1c04e35bd214a76120e0d62811206f739a07ce6ef681e89e059b4ea7b427bb59
f81fe56a-eecb-4d7a-9a42-1c5abc513946	774bb094-6628-422a-beaf-dc0ae9e50984	1c04e35bd214a76120e0d62811206f739a07ce6ef681e89e059b4ea7b427bb59	\N	::1	node	2026-08-22 11:45:10.605+06	2026-08-22 11:45:10.605+06	2026-09-21 11:45:10.605+06	2026-08-22 11:56:08.768+06	LOGOUT	\N
43764ce3-2332-4b88-8edb-450ae7c31714	68c8a00e-0f20-4dda-ad86-5c80143a2877	09cec79c2506a0fa37e00beac802a10e101f95b22f240470869eed6a4e6d20e1	\N	::1	node	2026-08-25 06:58:50.848+06	2026-08-25 06:58:50.848+06	2026-09-24 06:58:50.848+06	2026-08-25 06:58:54.403+06	LOGOUT	\N
2ae326c2-ca65-4050-aad0-93628df22568	774bb094-6628-422a-beaf-dc0ae9e50984	4ce0dfb3a2ce5b7d2bd74c58a8aaf0d38b0741ea1fec3680132a306fda045f32	\N	::1	node	2026-08-25 07:00:19.04+06	2026-08-25 07:00:19.04+06	2026-09-24 07:00:19.04+06	\N	\N	\N
4117723c-2ae8-4627-9b02-f9a84f3d33a2	774bb094-6628-422a-beaf-dc0ae9e50984	46c26693a04f19704c94371d115db442f61e0143a62e62e5f0b73044fed14674	\N	::1	node	2026-08-22 12:04:13.264+06	2026-08-22 12:04:13.264+06	2026-09-21 12:04:13.264+06	2026-08-22 12:04:58.491+06	LOGOUT	\N
3486d907-c201-46df-abee-1c3239262437	774bb094-6628-422a-beaf-dc0ae9e50984	d7346c658b5dc09463f7dec4a19a9886137b0dcb3465654ff337144e3ad9a9b2	\N	::1	node	2026-08-25 07:04:27.627+06	2026-08-25 07:04:27.627+06	2026-09-24 07:04:27.627+06	2026-08-25 07:04:43.589+06	LOGOUT	\N
f51b7b72-0b1c-4d58-86b9-4a8d97c3d715	3c1bd3c5-8511-413b-8372-95c40f088b3d	fa3c0eca9e54556423129301a81e4cf46842c608780e0a6f006c901c3689628a	\N	::1	node	2026-08-25 07:07:47.37+06	2026-08-25 07:09:02.318+06	2026-09-24 07:07:47.37+06	2026-08-25 07:09:02.318+06	ROTATED	1c4b9df14d8144c87bc8c687df8b076071371b1d550c09c70a5cadf465923da6
e2d604fa-3165-46e5-b935-bb70e6260614	774bb094-6628-422a-beaf-dc0ae9e50984	f023382ffa9a4d9638f0e35c3286b11207fb99fc5ce76145900061967901634c	\N	::1	node	2026-08-22 12:08:50.382+06	2026-08-22 12:08:50.382+06	2026-09-21 12:08:50.382+06	2026-08-22 12:15:17.739+06	LOGOUT	\N
cd8d2598-91e8-4f49-a229-519ce0809f0b	3c1bd3c5-8511-413b-8372-95c40f088b3d	825b60f598f9f18bdfaee523ed864f9bcbb66f9c29e72655cc3cb740d03c99c9	\N	::1	node	2026-08-25 07:19:51.851+06	2026-08-25 07:19:51.851+06	2026-09-24 07:19:51.851+06	\N	\N	\N
828689c7-81ad-4173-b2fa-39fff114bed8	774bb094-6628-422a-beaf-dc0ae9e50984	72f2675878a42f7c2356d07b8f4394b8ed5ebd00a417188af549e019018a2291	\N	::1	node	2026-08-25 05:47:42.089+06	2026-08-25 05:51:20.93+06	2026-09-24 05:47:42.089+06	2026-08-25 05:51:20.93+06	ROTATED	5309e9e118ee39efb9e2bf6199a2c4715a87961709d430c504cc8dce07b941a3
690a2afb-0c1b-482c-b4b0-2f6fda89af40	774bb094-6628-422a-beaf-dc0ae9e50984	642a14910664ea4bcc64fb03c5ba202fdf6cbdb97e6ff4f03774677ff8532843	\N	::1	node	2026-08-22 12:17:42.821+06	2026-08-22 12:17:42.821+06	2026-09-21 12:17:42.821+06	2026-08-22 12:26:54.88+06	LOGOUT	\N
396644cd-6c68-4141-805d-385b12e25597	774bb094-6628-422a-beaf-dc0ae9e50984	5309e9e118ee39efb9e2bf6199a2c4715a87961709d430c504cc8dce07b941a3	\N	::1	node	2026-08-25 05:51:20.93+06	2026-08-25 05:51:20.93+06	2026-09-24 05:51:20.93+06	\N	\N	\N
3a12f382-491e-47d6-adb5-cb3c2cb68d5f	3c1bd3c5-8511-413b-8372-95c40f088b3d	d4c3b557856530c60a69bbff8bef9075b8f70e8464d0f423c9823165c58ba039	\N	::1	node	2026-08-25 08:40:22.25+06	2026-08-25 08:55:37.957+06	2026-09-24 08:40:22.25+06	2026-08-25 08:55:37.957+06	ROTATED	fa696a257621efcb90ce3d5f45ea9ee0523159b504a225da04c0821606621012
baec6ff4-6f0b-4ed0-a8e8-cdc413a483c9	3c1bd3c5-8511-413b-8372-95c40f088b3d	bea536da9fc2712d1fed2a4b6dc28a76ea1dd9abfb0f309aa2dab0b52179a9f1	\N	::1	node	2026-08-25 09:26:33.221+06	2026-08-25 09:26:33.221+06	2026-09-24 09:26:33.221+06	2026-08-25 09:28:56.087+06	LOGOUT	\N
cadf5850-0592-437c-814c-2648b8220dbf	774bb094-6628-422a-beaf-dc0ae9e50984	3782da42a5e4ad5e620f76650ebf537596081c1f06c727e5cd33a72344e90b1f	\N	::1	node	2026-08-22 12:29:55.249+06	2026-08-22 12:29:55.249+06	2026-09-21 12:29:55.249+06	2026-08-22 12:42:26.902+06	LOGOUT	\N
3a9b9834-92e5-4d6c-898e-5c0ee1c2f0f9	774bb094-6628-422a-beaf-dc0ae9e50984	b573df31808ccc4fea6c475c58780a5699310b19f45b99b29850119d19a810a8	\N	::1	node	2026-08-23 04:23:38.663+06	2026-08-23 05:01:24.519+06	2026-09-22 04:23:38.663+06	2026-08-23 05:01:24.519+06	ROTATED	647662358c4517b44702312e54ce8b9acb6531648cba93681b97e3ea4209075a
f86f10a6-3a2e-425d-a968-c9e9b02b4430	774bb094-6628-422a-beaf-dc0ae9e50984	647662358c4517b44702312e54ce8b9acb6531648cba93681b97e3ea4209075a	\N	::1	node	2026-08-23 05:01:24.519+06	2026-08-23 05:01:24.519+06	2026-09-22 05:01:24.519+06	2026-08-23 05:07:20.208+06	LOGOUT	\N
416d9b83-9f23-42b8-8cc8-bfc4c0bd2270	774bb094-6628-422a-beaf-dc0ae9e50984	c47ef3ecd4517281d03dd7203dd0e455562735ba6a2b56f14f0000152be37cb1	\N	::1	node	2026-08-23 05:09:54.829+06	2026-08-23 05:09:54.829+06	2026-09-22 05:09:54.829+06	2026-08-23 05:10:52.889+06	LOGOUT	\N
00e8e077-eec4-496b-b0f9-c9c47c3b64fc	774bb094-6628-422a-beaf-dc0ae9e50984	43355b0ffa2c5015a7670f9b5f98a2ca9b6ec59e93fc715dc7f8b9075c7ecac6	\N	::1	node	2026-08-24 10:59:07.491+06	2026-08-24 10:59:19.966+06	2026-09-23 10:59:07.491+06	2026-08-24 10:59:19.966+06	ROTATED	83c964bedde0e054244c7f78f28f0f1a409b0c30781ecd4ff3327d7ec4212dea
b58741ff-6b04-4c3d-9b84-4ed0ebd0f394	774bb094-6628-422a-beaf-dc0ae9e50984	83c964bedde0e054244c7f78f28f0f1a409b0c30781ecd4ff3327d7ec4212dea	\N	::1	node	2026-08-24 10:59:19.966+06	2026-08-24 10:59:19.966+06	2026-09-23 10:59:19.966+06	2026-08-24 11:00:03.24+06	LOGOUT	\N
cc5db1ae-fd4d-4334-97bc-198b552e3ddd	774bb094-6628-422a-beaf-dc0ae9e50984	4b1ce9d1258a0edf300750f513723d8fee895ef56a7b9873d1dfbb28ced3f4ce	\N	::1	node	2026-08-24 11:06:20.489+06	2026-08-24 11:06:27.382+06	2026-09-23 11:06:20.489+06	2026-08-24 11:06:27.382+06	ROTATED	019a6e24a5ad2814e6e2f53f17306d11349a30af0c34d20dfaaa5a177e01769e
ecc280f1-1bbc-4c29-ac7b-8af7c65220ff	774bb094-6628-422a-beaf-dc0ae9e50984	019a6e24a5ad2814e6e2f53f17306d11349a30af0c34d20dfaaa5a177e01769e	\N	::1	node	2026-08-24 11:06:27.382+06	2026-08-24 11:06:27.382+06	2026-09-23 11:06:27.382+06	2026-08-24 11:07:16.074+06	LOGOUT	\N
ee6aad41-8d07-4119-a922-3c06268505d9	774bb094-6628-422a-beaf-dc0ae9e50984	0e0da14d1e52cc4552ead1231dd377c32d4b486a1aea655d3617b09e5d698228	\N	::1	node	2026-08-24 11:19:06.619+06	2026-08-24 11:19:06.619+06	2026-09-23 11:19:06.619+06	2026-08-24 11:21:26.01+06	LOGOUT	\N
cb87c883-93d1-474c-a4c8-6ade49db7af1	774bb094-6628-422a-beaf-dc0ae9e50984	b294e43e1b93f9f58f712c9fb48923ecea30f227e66cb14a1fdaa5a02aeb9aab	\N	::1	node	2026-08-24 11:33:21.113+06	2026-08-24 11:33:32.008+06	2026-09-23 11:33:21.113+06	2026-08-24 11:33:32.008+06	ROTATED	456363c046a405f857b0594841efc9d38dbfa548a415cce7e27a52e165dc504a
b4de2a81-7b71-41bf-9722-1c57ae0b2b1b	774bb094-6628-422a-beaf-dc0ae9e50984	456363c046a405f857b0594841efc9d38dbfa548a415cce7e27a52e165dc504a	\N	::1	node	2026-08-24 11:33:32.008+06	2026-08-24 11:33:32.008+06	2026-09-23 11:33:32.008+06	2026-08-24 11:34:29.799+06	LOGOUT	\N
94c5a2ca-8714-4570-8557-6d3a84ad1ae1	774bb094-6628-422a-beaf-dc0ae9e50984	07a7b35291d1024325adb8d4bb9e2f2881eb331382ef8eecce45948801b9ca74	\N	::1	node	2026-08-24 11:37:14.341+06	2026-08-24 11:37:14.341+06	2026-09-23 11:37:14.341+06	2026-08-24 11:38:12.189+06	LOGOUT	\N
96287a74-61f6-4c3f-83b1-69a75fa460be	774bb094-6628-422a-beaf-dc0ae9e50984	e6167f5a0ebbd46c225c8a34eeec600ab00693eb9ad1ee427089a7deb2fc5159	\N	::1	node	2026-08-24 11:46:06.877+06	2026-08-24 11:46:06.877+06	2026-09-23 11:46:06.877+06	2026-08-24 11:49:23.473+06	LOGOUT	\N
e1ee8540-1ab9-49a4-bad8-71538bce1071	774bb094-6628-422a-beaf-dc0ae9e50984	952db74cd31419480806338cdba5e5415c2b0cab36fa0c2cdeee9774151b8611	\N	::1	node	2026-08-24 11:51:26.437+06	2026-08-24 11:51:40.138+06	2026-09-23 11:51:26.437+06	2026-08-24 11:51:40.138+06	ROTATED	98f7263ed437e4110a565b6d49e50e3d629dc717dc4f16a2865ce5efb08d6528
c7c7cdec-40f3-4b39-bff8-90a2b174fb63	774bb094-6628-422a-beaf-dc0ae9e50984	98f7263ed437e4110a565b6d49e50e3d629dc717dc4f16a2865ce5efb08d6528	\N	::1	node	2026-08-24 11:51:40.138+06	2026-08-24 11:51:40.138+06	2026-09-23 11:51:40.138+06	2026-08-24 11:51:56.101+06	LOGOUT	\N
dad8a973-c46d-408c-9ba8-00b07f9d2d4d	774bb094-6628-422a-beaf-dc0ae9e50984	2814d57df5e22d23bb4b27dc3684e853d578dba199aa55bba55ee48b6ba93d36	\N	::1	node	2026-08-24 12:02:39.18+06	2026-08-24 12:02:39.18+06	2026-09-23 12:02:39.18+06	2026-08-24 12:02:50.064+06	LOGOUT	\N
61d8b6b5-042d-45c6-b688-373b749b60f2	68c8a00e-0f20-4dda-ad86-5c80143a2877	8787610cddff20b95f071f8aa63ea55f9eca391c5a9b811571d05eda9440135a	\N	::1	node	2026-08-25 06:18:08.279+06	2026-08-25 06:18:08.279+06	2026-09-24 06:18:08.279+06	2026-08-25 06:25:57.461+06	LOGOUT	\N
25cead2e-9984-4829-8752-81d20808a9b0	774bb094-6628-422a-beaf-dc0ae9e50984	facae79470004ea37e2b66eefc6024e597ab0d11d5381bed61c9e9f40b218bd6	\N	::1	node	2026-08-24 12:02:53.225+06	2026-08-24 12:02:57.391+06	2026-09-23 12:02:53.225+06	2026-08-24 12:02:57.391+06	ROTATED	ba9117d87562e34841abeb3e8559181bb0b1c6a5c21c8fa3b02866ea45d29852
4a90009e-110f-487b-9142-d78d60ec17d5	774bb094-6628-422a-beaf-dc0ae9e50984	7be769a4f505fdf23119c2a0a4314f38493b1372922a1ac03e703abfcf51ffe1	\N	::1	node	2026-08-25 06:39:05.684+06	2026-08-25 06:39:05.684+06	2026-09-24 06:39:05.684+06	2026-08-25 06:39:47.243+06	LOGOUT	\N
3fe6b055-8c0a-4853-adb9-b8367a0bae53	774bb094-6628-422a-beaf-dc0ae9e50984	ba9117d87562e34841abeb3e8559181bb0b1c6a5c21c8fa3b02866ea45d29852	\N	::1	node	2026-08-24 12:02:57.391+06	2026-08-24 12:02:57.391+06	2026-09-23 12:02:57.391+06	2026-08-24 12:02:59.26+06	LOGOUT	\N
fe684bd0-cba9-42fc-9053-4c6c07a2bed0	774bb094-6628-422a-beaf-dc0ae9e50984	35f5b48bf93be10b80fdc89bd0de58af18c291bea09330b7e12ada6bfc0e51b6	\N	::1	node	2026-08-25 06:59:00.477+06	2026-08-25 06:59:00.477+06	2026-09-24 06:59:00.477+06	\N	\N	\N
9ce817eb-ac03-4749-ac26-b267a97d0f32	774bb094-6628-422a-beaf-dc0ae9e50984	93010ab859be7ef74fd7334713f230191a2bcdb12391cdbc9ecbf6cb99942f4c	\N	::1	node	2026-08-25 06:59:05.647+06	2026-08-25 06:59:05.647+06	2026-09-24 06:59:05.647+06	\N	\N	\N
cab1171a-e64f-4e0a-a914-3e3c22ab6156	774bb094-6628-422a-beaf-dc0ae9e50984	02089b1c20305537edafb58a99af397fca65f275c513d116d2ddf73c9ac71b56	\N	::1	node	2026-08-25 07:00:27.723+06	2026-08-25 07:00:27.723+06	2026-09-24 07:00:27.723+06	2026-08-25 07:00:33.028+06	LOGOUT	\N
464d9a10-be54-4744-9c24-b1eb721de989	774bb094-6628-422a-beaf-dc0ae9e50984	122a8e325e21add74ce6a495c5dd3b0cd0082bf02d2ae3887ffc9df04e3c4b59	\N	::1	node	2026-08-25 07:00:36.451+06	2026-08-25 07:00:36.451+06	2026-09-24 07:00:36.451+06	2026-08-25 07:04:13.918+06	LOGOUT	\N
83730b18-d47b-498b-870a-b78637582d11	3c1bd3c5-8511-413b-8372-95c40f088b3d	08f25755c22e3c5e09b19488a86e31a317671bdc512ace3f9e1a01dd4a1cf80e	\N	::1	node	2026-08-25 07:04:50.757+06	2026-08-25 07:06:15.062+06	2026-09-24 07:04:50.757+06	2026-08-25 07:06:15.062+06	ROTATED	90417d30f620f4a5bce57ad303dc7a678d42284dbc822cf0095899774bdf0e5d
5745eeac-bfce-408b-924c-64a84dea3436	3c1bd3c5-8511-413b-8372-95c40f088b3d	1c4b9df14d8144c87bc8c687df8b076071371b1d550c09c70a5cadf465923da6	\N	::1	node	2026-08-25 07:09:02.318+06	2026-08-25 07:15:52.426+06	2026-09-24 07:09:02.318+06	2026-08-25 07:15:52.426+06	ROTATED	8ce0cba8d06fcbb363864811084b5f1dea1bd2eb26c33189f29e3f1b3d6710f6
cf969918-ec3c-4fb6-b1fb-5e786b7bf075	774bb094-6628-422a-beaf-dc0ae9e50984	62e491f5e9091021c7aca9d8926588c9ea82a02b7ee6c3eda7edd4dca0c73554	\N	::1	node	2026-08-25 08:01:37.475+06	2026-08-25 08:01:37.475+06	2026-09-24 08:01:37.475+06	2026-08-25 08:02:46.563+06	LOGOUT	\N
739c55b3-932e-4385-b0ef-9ed6a6e763f9	774bb094-6628-422a-beaf-dc0ae9e50984	e1f88d29027385bce74da90251ebc63ea16a0821d4b47aa263550161bd93bebb	\N	::1	curl/8.21.0	2026-08-25 08:55:06.498+06	2026-08-25 08:55:06.498+06	2026-09-24 08:55:06.498+06	\N	\N	\N
13edae89-80a0-469e-b2f5-b22685053ab1	774bb094-6628-422a-beaf-dc0ae9e50984	08dad17d0a342bbde17510d29397849adfa0f7b74217f2568f52af0ec831dd98	\N	::1	curl/8.21.0	2026-08-25 09:07:42.379+06	2026-08-25 09:07:42.379+06	2026-09-24 09:07:42.379+06	\N	\N	\N
e405e46f-f5f1-45de-83fd-04d36efea8dc	774bb094-6628-422a-beaf-dc0ae9e50984	2df6bfa0989a42938bfdb165757331e91c0058d92209a68571ca11827d616831	\N	::1	node	2026-08-25 09:29:08.084+06	2026-08-25 10:35:59.487+06	2026-09-24 09:29:08.084+06	2026-08-25 10:35:59.487+06	ROTATED	116b0484783918c3f77f8d5b151499633c653489211deee6b140c807707eb511
a8741470-7b27-4557-8e53-fbbbd99c8aa8	774bb094-6628-422a-beaf-dc0ae9e50984	9b8c0bc02cbd5d34d882b51f515be16b6856d8e055d328e3940dbfd4a22dc886	\N	::1	node	2026-08-25 10:52:47.582+06	2026-08-25 10:53:30.502+06	2026-09-24 10:52:47.582+06	2026-08-25 10:53:30.502+06	ROTATED	bbf344f6a056b59dac34c689586ff795a473050229dd2938a545a085f2481beb
815018d2-41d8-4e39-8391-dce91360426d	774bb094-6628-422a-beaf-dc0ae9e50984	69b5573b49e22153d6a3fb617b8a9108d15247a6098945361ce95a9b0fab891e	\N	::1	node	2026-08-25 04:37:16.53+06	2026-08-25 04:46:28.145+06	2026-09-24 04:37:16.53+06	2026-08-25 04:46:28.145+06	ROTATED	eb89eec0ad033cacd0bf73f9dcc88612caf8b94ae9f10d5dc379cf1f4f274d5a
cfa0bb67-efde-4f1c-9297-f9cd54a08a1c	774bb094-6628-422a-beaf-dc0ae9e50984	eb89eec0ad033cacd0bf73f9dcc88612caf8b94ae9f10d5dc379cf1f4f274d5a	\N	::1	node	2026-08-25 04:46:28.145+06	2026-08-25 04:46:28.145+06	2026-09-24 04:46:28.145+06	2026-08-25 04:46:30.329+06	LOGOUT	\N
d5da4a6a-9eae-4bb3-b5ac-83a1c8c36f7f	774bb094-6628-422a-beaf-dc0ae9e50984	bbf344f6a056b59dac34c689586ff795a473050229dd2938a545a085f2481beb	\N	::1	node	2026-08-25 10:53:30.502+06	2026-08-25 10:53:30.502+06	2026-09-24 10:53:30.502+06	2026-08-25 10:53:49.204+06	LOGOUT	\N
ecf0c0d2-b9e1-4a16-8f59-c3d99e23ad06	774bb094-6628-422a-beaf-dc0ae9e50984	a40e31e449743a02810c49d35355c1cff1b3dea75f10404f5a759c1c39482418	\N	::1	node	2026-08-25 10:56:41+06	2026-08-25 10:56:52.445+06	2026-09-24 10:56:41+06	2026-08-25 10:56:52.445+06	ROTATED	6d7e36c33d1b503ad793d42b30656cacb935bf0507402627df2a882956498063
7275c681-639c-45d9-b700-e9512fb89b50	3c1bd3c5-8511-413b-8372-95c40f088b3d	50b5589af19236127cf465b2fc1deeedd10614972f07ed28d3f4a256dcaf6bed	\N	::1	node	2026-08-25 10:56:14.191+06	2026-08-25 10:56:57.012+06	2026-09-24 10:56:14.191+06	2026-08-25 10:56:57.012+06	ROTATED	31239d612874908acfde0fc7b91d937a5883f0f585eb99a1b9731cc36ed9e26e
49eca93e-9406-452c-9bbb-b87780073528	774bb094-6628-422a-beaf-dc0ae9e50984	38a6ed3292ef146c401717d7c89c1a10371b1712ad588d459071795bd15fd948	\N	::1	node	2026-08-25 11:13:14.431+06	2026-08-25 11:31:51.827+06	2026-09-24 11:13:14.431+06	2026-08-25 11:31:51.827+06	ROTATED	85409dc8841d2cd42a6b137da5eba37c11663fbf4e2befcafb83e33389634abc
d04ac7d8-b04b-49db-8dfb-768f522ae4dc	3c1bd3c5-8511-413b-8372-95c40f088b3d	31239d612874908acfde0fc7b91d937a5883f0f585eb99a1b9731cc36ed9e26e	\N	::1	node	2026-08-25 10:56:57.012+06	2026-08-25 11:32:15.619+06	2026-09-24 10:56:57.012+06	2026-08-25 11:32:15.619+06	ROTATED	9749a26ef42110e1f88f8fd2a682fb041de738737af3653fc56b9bdcfa0f4c6e
49e57cc1-c6e1-48e2-a0e4-fd6d4bfebf25	3c1bd3c5-8511-413b-8372-95c40f088b3d	9749a26ef42110e1f88f8fd2a682fb041de738737af3653fc56b9bdcfa0f4c6e	\N	::1	node	2026-08-25 11:32:15.619+06	2026-08-25 11:47:58.786+06	2026-09-24 11:32:15.619+06	2026-08-25 11:47:58.786+06	ROTATED	ec007d41d7d325712a68f1d6655f047735b466fc0522111654cc9207692e57c0
499b673a-175c-40b8-86b7-bd26bbf0c2ca	774bb094-6628-422a-beaf-dc0ae9e50984	68a009d503c5b9e0a69117abc81cdb04aac713f9dbbb6d3a835d58b6c2f86d8f	\N	::1	node	2026-08-25 05:27:26.609+06	2026-08-25 05:27:26.609+06	2026-09-24 05:27:26.609+06	2026-08-25 05:28:50.641+06	LOGOUT	\N
0ec1ae06-c241-44c7-b40c-994edda3fccf	3c1bd3c5-8511-413b-8372-95c40f088b3d	ec007d41d7d325712a68f1d6655f047735b466fc0522111654cc9207692e57c0	\N	::1	node	2026-08-25 11:47:58.786+06	2026-08-25 11:47:58.786+06	2026-09-24 11:47:58.786+06	\N	\N	\N
b6dea278-71a6-4a34-991e-00a4508d43c3	1d9c2ef0-a937-4a08-86fe-4c4404b336f0	7ede133a2ea2cb579313b4d5aa6aa3c0e337f2ffd95a31c8fe39b329fe773fc1	\N	::1	curl/8.21.0	2026-08-27 07:28:16.714+06	2026-08-27 07:28:16.714+06	2026-09-26 07:28:16.714+06	\N	\N	\N
e39434fa-401f-45f0-a070-869bee13f6d2	774bb094-6628-422a-beaf-dc0ae9e50984	3f3fbfbdc9071accb40f08515d53d71e663bcf0c6a7e9c59d0abb28065375bbc	\N	::1	node	2026-08-25 05:40:25.515+06	2026-08-25 05:40:30.642+06	2026-09-24 05:40:25.515+06	2026-08-25 05:40:30.642+06	ROTATED	2b3143dbca8bfc773c35f9495f693d7e7bce9af2f0db9f81f19b03a861f7a16a
08ec678e-9c97-46f2-ad50-06860f6c4a78	774bb094-6628-422a-beaf-dc0ae9e50984	2b3143dbca8bfc773c35f9495f693d7e7bce9af2f0db9f81f19b03a861f7a16a	\N	::1	node	2026-08-25 05:40:30.642+06	2026-08-25 05:47:42.089+06	2026-09-24 05:40:30.642+06	2026-08-25 05:47:42.089+06	ROTATED	72f2675878a42f7c2356d07b8f4394b8ed5ebd00a417188af549e019018a2291
4064f397-5941-4370-80c4-5caef7e98805	774bb094-6628-422a-beaf-dc0ae9e50984	c38d13efa6968258a7b99250362baf9aeb794e5de37248a99ac41305199930b3	\N	::1	node	2026-08-25 06:26:04.386+06	2026-08-25 06:26:04.386+06	2026-09-24 06:26:04.386+06	2026-08-25 06:32:52.765+06	LOGOUT	\N
991fbe11-4420-47e7-af66-a63c3162790d	68c8a00e-0f20-4dda-ad86-5c80143a2877	01a14240e6a50c4c194ecda12811daadc6569f53845c2ffbc15c819ae1a2b23f	\N	::1	node	2026-08-25 06:39:54.063+06	2026-08-25 06:58:50.848+06	2026-09-24 06:39:54.063+06	2026-08-25 06:58:50.848+06	ROTATED	09cec79c2506a0fa37e00beac802a10e101f95b22f240470869eed6a4e6d20e1
fd50a597-374b-4f67-8f0a-aab28948e15e	774bb094-6628-422a-beaf-dc0ae9e50984	6d420604e7c571a3314c46210325a4abdcf122eee10dc034a10e9369e0d0e220	\N	::1	node	2026-08-25 06:59:42.964+06	2026-08-25 06:59:42.964+06	2026-09-24 06:59:42.964+06	\N	\N	\N
28c3798a-915f-40b8-b748-51f3f4d49a2d	774bb094-6628-422a-beaf-dc0ae9e50984	939c4c266a42e1c17a7169ff80184fd30f0819474d2132e766aac76caece1f4c	\N	::1	node	2026-08-25 06:59:43.987+06	2026-08-25 07:00:19.04+06	2026-09-24 06:59:43.987+06	2026-08-25 07:00:19.04+06	ROTATED	4ce0dfb3a2ce5b7d2bd74c58a8aaf0d38b0741ea1fec3680132a306fda045f32
cadd464f-c186-4ec0-802a-fa36bb29742c	3c1bd3c5-8511-413b-8372-95c40f088b3d	0d3f9ede392f63f474554bd5757a6494c92ef3d05bb122508f4e113b843ffc9d	\N	::1	node	2026-08-25 07:04:17.095+06	2026-08-25 07:04:17.095+06	2026-09-24 07:04:17.095+06	2026-08-25 07:04:21.572+06	LOGOUT	\N
dafac0ba-96de-4bbf-8974-c60806c496e5	3c1bd3c5-8511-413b-8372-95c40f088b3d	90417d30f620f4a5bce57ad303dc7a678d42284dbc822cf0095899774bdf0e5d	\N	::1	node	2026-08-25 07:06:15.062+06	2026-08-25 07:07:47.37+06	2026-09-24 07:06:15.062+06	2026-08-25 07:07:47.37+06	ROTATED	fa3c0eca9e54556423129301a81e4cf46842c608780e0a6f006c901c3689628a
09db586e-d9a3-467d-9123-65f11a97a6e1	3c1bd3c5-8511-413b-8372-95c40f088b3d	8ce0cba8d06fcbb363864811084b5f1dea1bd2eb26c33189f29e3f1b3d6710f6	\N	::1	node	2026-08-25 07:15:52.426+06	2026-08-25 07:19:51.851+06	2026-09-24 07:15:52.426+06	2026-08-25 07:19:51.851+06	ROTATED	825b60f598f9f18bdfaee523ed864f9bcbb66f9c29e72655cc3cb740d03c99c9
a52c1d31-42c0-42df-a674-4495037d54ed	3c1bd3c5-8511-413b-8372-95c40f088b3d	a978cea0c991dd833688ab7201c5741e86502180426e50596d8e98e3020bf453	\N	::1	node	2026-08-25 08:02:48.663+06	2026-08-25 08:40:22.25+06	2026-09-24 08:02:48.663+06	2026-08-25 08:40:22.25+06	ROTATED	d4c3b557856530c60a69bbff8bef9075b8f70e8464d0f423c9823165c58ba039
dbd46a03-7db7-4ed5-8a8a-bf3a140ad142	3c1bd3c5-8511-413b-8372-95c40f088b3d	fa696a257621efcb90ce3d5f45ea9ee0523159b504a225da04c0821606621012	\N	::1	node	2026-08-25 08:55:37.957+06	2026-08-25 08:55:37.957+06	2026-09-24 08:55:37.957+06	2026-08-25 08:55:41.829+06	LOGOUT	\N
0983d286-6c89-4822-9868-da6ce5c4eaf3	774bb094-6628-422a-beaf-dc0ae9e50984	fd8f8904130a8ef8f6dcdefd0b881a987a842b2891079ac9536c84c24676e67f	\N	::1	node	2026-08-25 08:55:53.987+06	2026-08-25 09:25:42.326+06	2026-09-24 08:55:53.987+06	2026-08-25 09:25:42.326+06	ROTATED	ddbe3c943aeb50d17c0197527ace36ef9d2a5c84e9a693e9f53985763a8cc559
9eb4e8f2-d406-4229-b801-a187b2597377	774bb094-6628-422a-beaf-dc0ae9e50984	ddbe3c943aeb50d17c0197527ace36ef9d2a5c84e9a693e9f53985763a8cc559	\N	::1	node	2026-08-25 09:25:42.326+06	2026-08-25 09:25:42.326+06	2026-09-24 09:25:42.326+06	2026-08-25 09:26:30.71+06	LOGOUT	\N
5905f7c2-2fb6-4b71-8497-830425022aad	774bb094-6628-422a-beaf-dc0ae9e50984	116b0484783918c3f77f8d5b151499633c653489211deee6b140c807707eb511	\N	::1	node	2026-08-25 10:35:59.487+06	2026-08-25 10:52:47.582+06	2026-09-24 10:35:59.487+06	2026-08-25 10:52:47.582+06	ROTATED	9b8c0bc02cbd5d34d882b51f515be16b6856d8e055d328e3940dbfd4a22dc886
448176a5-6ae7-499c-8b79-a3c0e773577c	68c8a00e-0f20-4dda-ad86-5c80143a2877	a9bc63b7b08a35e4436c2447ea068b9625ee0fc6b15ed818be7447fb7ff6cc7e	\N	::1	node	2026-08-25 10:55:14.335+06	2026-08-25 10:57:01.177+06	2026-09-24 10:55:14.335+06	2026-08-25 10:57:01.177+06	ROTATED	9053903d60a1f466ee281f09461b801532ecf03e78f11ac3758e51ed3f827cf5
777c60a5-40cb-4e79-bc95-e685d1da6e7e	774bb094-6628-422a-beaf-dc0ae9e50984	6d7e36c33d1b503ad793d42b30656cacb935bf0507402627df2a882956498063	\N	::1	node	2026-08-25 10:56:52.445+06	2026-08-25 11:13:14.431+06	2026-09-24 10:56:52.445+06	2026-08-25 11:13:14.431+06	ROTATED	38a6ed3292ef146c401717d7c89c1a10371b1712ad588d459071795bd15fd948
367399bb-9a8e-4908-98b5-8343d835d24b	68c8a00e-0f20-4dda-ad86-5c80143a2877	9053903d60a1f466ee281f09461b801532ecf03e78f11ac3758e51ed3f827cf5	\N	::1	node	2026-08-25 10:57:01.177+06	2026-08-25 11:33:18.134+06	2026-09-24 10:57:01.177+06	2026-08-25 11:33:18.134+06	ROTATED	a01166558f1e104735e1c0245a7681c22a8ab3cee9bc6f2a8b1fac4739daf16e
53286bf3-e5c6-448c-9254-0c75a6b13912	68c8a00e-0f20-4dda-ad86-5c80143a2877	a01166558f1e104735e1c0245a7681c22a8ab3cee9bc6f2a8b1fac4739daf16e	\N	::1	node	2026-08-25 11:33:18.134+06	2026-08-25 11:33:18.134+06	2026-09-24 11:33:18.134+06	\N	\N	\N
e60698fd-c8c5-4910-84b7-9ea2a781ae9e	774bb094-6628-422a-beaf-dc0ae9e50984	6c670626ea75c889a24c00d037a5212e76d198c9a98b2501200856a93af737fb	\N	::1	curl/8.21.0	2026-08-27 07:25:30.219+06	2026-08-27 07:25:30.219+06	2026-09-26 07:25:30.219+06	\N	\N	\N
99b3f551-3459-4cab-80a6-fe298fbf7beb	774bb094-6628-422a-beaf-dc0ae9e50984	85409dc8841d2cd42a6b137da5eba37c11663fbf4e2befcafb83e33389634abc	\N	::1	node	2026-08-25 11:31:51.827+06	2026-08-27 07:32:52.028+06	2026-09-24 11:31:51.827+06	2026-08-27 07:32:52.028+06	ROTATED	91ade214a4e420c567debbc81abf8f9544e1e6a00791f7ec972b3177f81498eb
a9aa253c-c910-4254-8974-90a4984350b9	774bb094-6628-422a-beaf-dc0ae9e50984	91ade214a4e420c567debbc81abf8f9544e1e6a00791f7ec972b3177f81498eb	\N	::1	node	2026-08-27 07:32:52.028+06	2026-08-27 07:32:52.028+06	2026-09-26 07:32:52.028+06	\N	\N	\N
\.


--
-- Data for Name: billing_attempts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.billing_attempts (id, "billingId", "attemptNumber", status, "attemptedAt", "completedAt", "failureCode", "failureMessage", "idempotencyKey", metadata, "createdAt") FROM stdin;
6a7bad2b-d239-432e-b600-1bd8f76b555b	f81ba5f4-3f34-406a-b6b6-531735e0ef40	1	FAILED	2026-08-25 06:30:44.66+06	2026-08-25 06:39:28.132+06	\N	\N	f81ba5f4-3f34-406a-b6b6-531735e0ef40:attempt:1	{"actorUserId": "774bb094-6628-422a-beaf-dc0ae9e50984"}	2026-08-25 06:30:44.66+06
02b3a9a5-1925-455a-86b4-c99cfd864e25	eb6d3cbd-7dd9-4ac4-b637-d299495de49d	1	SUCCEEDED	2026-08-25 07:05:00.581+06	2026-08-25 07:06:07.007+06	\N	\N	eb6d3cbd-7dd9-4ac4-b637-d299495de49d:attempt:1	{"actorUserId": "3c1bd3c5-8511-413b-8372-95c40f088b3d"}	2026-08-25 07:05:00.581+06
70fcc218-9896-460f-90cb-441b1051ff76	f81ba5f4-3f34-406a-b6b6-531735e0ef40	2	SUCCEEDED	2026-08-25 06:40:00.756+06	2026-08-25 09:07:43.489+06	\N	\N	f81ba5f4-3f34-406a-b6b6-531735e0ef40:attempt:2	{"retry": true, "actorUserId": "68c8a00e-0f20-4dda-ad86-5c80143a2877"}	2026-08-25 06:40:00.756+06
\.


--
-- Data for Name: billings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.billings (id, "tenantId", "companyId", "subscriptionId", status, "billingCycle", "currencyCode", amount, "periodStart", "periodEnd", "dueAt", "processedAt", "failedAt", "cancelledAt", "attemptCount", "nextAttemptAt", "idempotencyKey", "priceSnapshot", metadata, "createdAt", "updatedAt") FROM stdin;
eb6d3cbd-7dd9-4ac4-b637-d299495de49d	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	509dc1a2-0c06-4a9b-b860-e0fed4a0b2c1	SUCCEEDED	YEARLY	BDT	6.0000	2026-08-01 00:00:00+06	2026-08-30 00:00:00+06	2026-08-25 00:00:00+06	2026-08-25 07:06:07.007+06	\N	\N	1	\N	billing:509dc1a2-0c06-4a9b-b860-e0fed4a0b2c1:2026-08-01T00:00:00.000Z:2026-08-30T00:00:00.000Z	{"amount": "6", "planId": "794b6c06-55a9-427c-ae40-874d7628158c", "planCode": "MEDIUM", "planName": "medium", "capturedAt": "2026-08-25T07:02:06.080Z", "billingCycle": "YEARLY", "currencyCode": "BDT"}	{"source": "SUBSCRIPTION", "actorUserId": "774bb094-6628-422a-beaf-dc0ae9e50984", "succeededAt": "2026-08-25T07:06:07.007Z", "succeededBy": "3c1bd3c5-8511-413b-8372-95c40f088b3d", "processingStartedAt": "2026-08-25T07:05:00.578Z", "processingStartedBy": "3c1bd3c5-8511-413b-8372-95c40f088b3d"}	2026-08-25 07:02:28.69+06	2026-08-25 07:06:07.076+06
f81ba5f4-3f34-406a-b6b6-531735e0ef40	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	e49f57a0-7342-4181-97e1-ddf2b5bc2320	SUCCEEDED	YEARLY	BDT	4.0000	2026-08-01 00:00:00+06	2026-08-30 00:00:00+06	2026-08-25 00:00:00+06	2026-08-25 09:07:43.489+06	2026-08-25 06:39:28.132+06	\N	2	\N	billing:e49f57a0-7342-4181-97e1-ddf2b5bc2320:2026-08-01T00:00:00.000Z:2026-08-30T00:00:00.000Z	{"amount": "4", "planId": "225c1374-d952-4e8c-8d47-503e2515d26e", "planCode": "PRO", "planName": "pro", "capturedAt": "2026-08-25T06:26:25.742Z", "billingCycle": "YEARLY", "currencyCode": "BDT"}	{"source": "SUBSCRIPTION", "retryAt": "2026-08-25T06:40:00.753Z", "retryBy": "68c8a00e-0f20-4dda-ad86-5c80143a2877", "failedAt": "2026-08-25T06:39:28.132Z", "failedBy": "774bb094-6628-422a-beaf-dc0ae9e50984", "actorUserId": "774bb094-6628-422a-beaf-dc0ae9e50984", "failureCode": null, "succeededAt": "2026-08-25T09:07:43.489Z", "succeededBy": "774bb094-6628-422a-beaf-dc0ae9e50984", "failureMessage": null, "processingStartedAt": "2026-08-25T06:30:44.646Z", "processingStartedBy": "774bb094-6628-422a-beaf-dc0ae9e50984"}	2026-08-25 06:28:53.578+06	2026-08-25 09:07:43.55+06
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.companies (id, "tenantId", "industryId", "createdByUserId", code, "legalName", "tradeName", email, phone, "taxId", "registrationNo", "baseCurrencyCode", timezone, status, "goLiveAt", "createdAt", "updatedAt") FROM stdin;
86531dfa-8018-4f37-a5c3-84cfebe31214	65b4d86b-9ce6-4d78-901c-440b0c0fd721	65448ffe-49ef-4505-ac82-a3805dfe8ef6	774bb094-6628-422a-beaf-dc0ae9e50984	AMJONOTA	Fresh Test resturant	\N	\N	\N	\N	\N	BDT	Asia/Dhaka	DRAFT	\N	2026-08-25 07:01:46.767+06	2026-08-25 07:01:46.767+06
b7cbbf94-491b-4db3-a64c-2daa06556b6e	632bb8a8-f9f9-4093-a903-351e3614fc88	5c961a18-af13-4638-b93d-b7faa4c502b7	774bb094-6628-422a-beaf-dc0ae9e50984	FRESHTEST	Fresh Test Super Shop	\N	\N	\N	\N	\N	BDT	Asia/Dhaka	LIVE	2026-08-25 08:02:39.785+06	2026-08-25 06:13:25.037+06	2026-08-25 08:02:39.786+06
3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	65b4d86b-9ce6-4d78-901c-440b0c0fd721	65448ffe-49ef-4505-ac82-a3805dfe8ef6	774bb094-6628-422a-beaf-dc0ae9e50984	AUTOTRIALTEST	Auto Trial Test Co	\N	\N	\N	\N	\N	BDT	Asia/Dhaka	DRAFT	\N	2026-08-27 07:27:34.066+06	2026-08-27 07:27:34.066+06
\.


--
-- Data for Name: company_member_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_member_roles ("companyMemberId", "companyRoleId", "assignedAt", "assignedByUserId", "expiresAt") FROM stdin;
70cf9efc-9b4f-4f84-ac9a-005f7a76844e	2a23f140-ff6f-4ed0-ab68-0367f4ae8450	2026-08-25 06:16:21.231+06	774bb094-6628-422a-beaf-dc0ae9e50984	\N
609a9ce0-94c2-49d5-be51-859ab314b55c	fa46b4e4-b100-49fd-b36d-005c8fa16dcf	2026-08-25 07:04:01.259+06	774bb094-6628-422a-beaf-dc0ae9e50984	\N
bcc7b896-9288-4673-9a03-da7e7d3e0f77	ba3b7144-7075-4277-97ec-964326d015b2	2026-08-25 11:45:44.604+06	3c1bd3c5-8511-413b-8372-95c40f088b3d	\N
4559b563-7554-40fe-a36e-b78209e1af1e	9968ffa4-8b0c-4380-926c-479f08743721	2026-08-27 07:28:08.209+06	774bb094-6628-422a-beaf-dc0ae9e50984	\N
\.


--
-- Data for Name: company_member_scopes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_member_scopes (id, "tenantId", "companyId", "companyMemberId", "scopeType", "scopeKey", conditions, "validFrom", "validUntil", "assignedByUserId", "createdAt") FROM stdin;
25f46145-0300-47a9-a8bc-da4eafb36291	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	bcc7b896-9288-4673-9a03-da7e7d3e0f77	COMPANY	*	\N	2026-08-25 11:45:44.604+06	\N	3c1bd3c5-8511-413b-8372-95c40f088b3d	2026-08-25 11:45:44.604+06
\.


--
-- Data for Name: company_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_members (id, "tenantId", "companyId", "userId", "employeeCode", designation, status, "invitedAt", "joinedAt", "activatedAt", "createdAt", "updatedAt") FROM stdin;
70cf9efc-9b4f-4f84-ac9a-005f7a76844e	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	68c8a00e-0f20-4dda-ad86-5c80143a2877	\N	Company Owner	ACTIVE	\N	2026-08-25 06:16:21.198+06	2026-08-25 06:16:21.198+06	2026-08-25 06:16:21.2+06	2026-08-25 06:16:21.2+06
609a9ce0-94c2-49d5-be51-859ab314b55c	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	3c1bd3c5-8511-413b-8372-95c40f088b3d	\N	Company Owner	ACTIVE	\N	2026-08-25 07:04:01.216+06	2026-08-25 07:04:01.216+06	2026-08-25 07:04:01.218+06	2026-08-25 07:04:01.218+06
bcc7b896-9288-4673-9a03-da7e7d3e0f77	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	0133dc94-71fe-40d5-9d8d-be28017fd7cf	\N	\N	ACTIVE	2026-08-25 11:45:44.539+06	2026-08-25 11:45:44.539+06	2026-08-25 11:45:44.539+06	2026-08-25 11:45:44.604+06	2026-08-25 11:45:44.604+06
4559b563-7554-40fe-a36e-b78209e1af1e	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	1d9c2ef0-a937-4a08-86fe-4c4404b336f0	\N	Company Owner	ACTIVE	\N	2026-08-27 07:28:08.169+06	2026-08-27 07:28:08.169+06	2026-08-27 07:28:08.171+06	2026-08-27 07:28:08.171+06
\.


--
-- Data for Name: company_ownerships; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_ownerships (id, "tenantId", "companyId", "companyMemberId", "isPrimary", "startedAt", "endedAt", "assignedByUserId") FROM stdin;
365e925a-9178-47ab-b260-a8d659f9a581	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	70cf9efc-9b4f-4f84-ac9a-005f7a76844e	t	2026-08-25 06:16:21.242+06	\N	774bb094-6628-422a-beaf-dc0ae9e50984
9cb9ce3d-107f-44c4-a7d7-249c014f302a	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	609a9ce0-94c2-49d5-be51-859ab314b55c	t	2026-08-25 07:04:01.265+06	\N	774bb094-6628-422a-beaf-dc0ae9e50984
06e758d2-2beb-4b4d-a370-26f68a053ec1	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	4559b563-7554-40fe-a36e-b78209e1af1e	t	2026-08-27 07:28:08.226+06	\N	774bb094-6628-422a-beaf-dc0ae9e50984
\.


--
-- Data for Name: company_role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_role_permissions ("companyRoleId", "permissionId", effect, conditions, "assignedAt", "assignedByUserId") FROM stdin;
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	86f2978f-3cb2-4f46-999a-e9f5b5c21109	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	cdec28cd-2e0f-411a-8589-26ee171caea4	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	87d8a365-44ef-4f87-8ff4-91d1d77cf95e	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	70cf65f8-677b-430d-80a9-ded8069466b3	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	e7a58f9c-e777-4a98-abe5-e7b2509f6178	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	af4b127e-77a4-4423-8cd2-57d7fdea1326	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	af15c184-ddca-4ddf-97f7-2d2d15f53934	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	b5ac9d67-0eac-4962-b8cd-74f7ca854854	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	0585feba-1f8d-4090-a5d8-f2d50b9164ff	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	d1ed2f9e-a9eb-4dc6-b09f-3eeb65d8e263	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	6571f856-2cd7-42a9-820e-831de745f19a	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	522363a9-a9cc-4d12-8d08-11e3a498851f	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	5bb40d60-b9ae-4374-ae43-ce2c997852b5	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	2b90689d-8ea3-459b-88d3-4488b53766f4	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	36fc5d61-6507-4a1b-927b-94a46e7d0a99	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	b66dbc31-15cd-400c-be52-5c61f5b5a06a	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	20cecd6d-5d03-4f11-9d29-859062b5ecf5	ALLOW	\N	2026-08-25 06:17:14.528+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	86f2978f-3cb2-4f46-999a-e9f5b5c21109	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	cdec28cd-2e0f-411a-8589-26ee171caea4	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	87d8a365-44ef-4f87-8ff4-91d1d77cf95e	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	70cf65f8-677b-430d-80a9-ded8069466b3	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	e7a58f9c-e777-4a98-abe5-e7b2509f6178	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	af4b127e-77a4-4423-8cd2-57d7fdea1326	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	af15c184-ddca-4ddf-97f7-2d2d15f53934	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	b5ac9d67-0eac-4962-b8cd-74f7ca854854	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	0585feba-1f8d-4090-a5d8-f2d50b9164ff	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	d1ed2f9e-a9eb-4dc6-b09f-3eeb65d8e263	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	6571f856-2cd7-42a9-820e-831de745f19a	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	522363a9-a9cc-4d12-8d08-11e3a498851f	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	5bb40d60-b9ae-4374-ae43-ce2c997852b5	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	2b90689d-8ea3-459b-88d3-4488b53766f4	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	36fc5d61-6507-4a1b-927b-94a46e7d0a99	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	b66dbc31-15cd-400c-be52-5c61f5b5a06a	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
6c6b6551-486e-4da3-9db3-3ff0aea94a25	20cecd6d-5d03-4f11-9d29-859062b5ecf5	ALLOW	\N	2026-08-25 06:17:14.543+06	774bb094-6628-422a-beaf-dc0ae9e50984
b492b46e-fde8-4f6a-abb4-582c7d722339	86f2978f-3cb2-4f46-999a-e9f5b5c21109	ALLOW	\N	2026-08-25 06:17:14.55+06	774bb094-6628-422a-beaf-dc0ae9e50984
b492b46e-fde8-4f6a-abb4-582c7d722339	e7a58f9c-e777-4a98-abe5-e7b2509f6178	ALLOW	\N	2026-08-25 06:17:14.55+06	774bb094-6628-422a-beaf-dc0ae9e50984
b492b46e-fde8-4f6a-abb4-582c7d722339	af4b127e-77a4-4423-8cd2-57d7fdea1326	ALLOW	\N	2026-08-25 06:17:14.55+06	774bb094-6628-422a-beaf-dc0ae9e50984
b492b46e-fde8-4f6a-abb4-582c7d722339	af15c184-ddca-4ddf-97f7-2d2d15f53934	ALLOW	\N	2026-08-25 06:17:14.55+06	774bb094-6628-422a-beaf-dc0ae9e50984
b492b46e-fde8-4f6a-abb4-582c7d722339	b5ac9d67-0eac-4962-b8cd-74f7ca854854	ALLOW	\N	2026-08-25 06:17:14.55+06	774bb094-6628-422a-beaf-dc0ae9e50984
b492b46e-fde8-4f6a-abb4-582c7d722339	0585feba-1f8d-4090-a5d8-f2d50b9164ff	ALLOW	\N	2026-08-25 06:17:14.55+06	774bb094-6628-422a-beaf-dc0ae9e50984
80b9b935-6176-472c-a928-5d278b4ec929	86f2978f-3cb2-4f46-999a-e9f5b5c21109	ALLOW	\N	2026-08-25 06:17:14.556+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	86f2978f-3cb2-4f46-999a-e9f5b5c21109	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	cdec28cd-2e0f-411a-8589-26ee171caea4	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	87d8a365-44ef-4f87-8ff4-91d1d77cf95e	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	70cf65f8-677b-430d-80a9-ded8069466b3	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	e7a58f9c-e777-4a98-abe5-e7b2509f6178	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	af4b127e-77a4-4423-8cd2-57d7fdea1326	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	af15c184-ddca-4ddf-97f7-2d2d15f53934	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	b5ac9d67-0eac-4962-b8cd-74f7ca854854	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	0585feba-1f8d-4090-a5d8-f2d50b9164ff	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	d1ed2f9e-a9eb-4dc6-b09f-3eeb65d8e263	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	6571f856-2cd7-42a9-820e-831de745f19a	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	522363a9-a9cc-4d12-8d08-11e3a498851f	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	5bb40d60-b9ae-4374-ae43-ce2c997852b5	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	2b90689d-8ea3-459b-88d3-4488b53766f4	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	36fc5d61-6507-4a1b-927b-94a46e7d0a99	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	b66dbc31-15cd-400c-be52-5c61f5b5a06a	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	20cecd6d-5d03-4f11-9d29-859062b5ecf5	ALLOW	\N	2026-08-25 07:04:36.231+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	86f2978f-3cb2-4f46-999a-e9f5b5c21109	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	cdec28cd-2e0f-411a-8589-26ee171caea4	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	87d8a365-44ef-4f87-8ff4-91d1d77cf95e	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	70cf65f8-677b-430d-80a9-ded8069466b3	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	e7a58f9c-e777-4a98-abe5-e7b2509f6178	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	af4b127e-77a4-4423-8cd2-57d7fdea1326	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	af15c184-ddca-4ddf-97f7-2d2d15f53934	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	b5ac9d67-0eac-4962-b8cd-74f7ca854854	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	0585feba-1f8d-4090-a5d8-f2d50b9164ff	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	d1ed2f9e-a9eb-4dc6-b09f-3eeb65d8e263	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	6571f856-2cd7-42a9-820e-831de745f19a	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	522363a9-a9cc-4d12-8d08-11e3a498851f	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	5bb40d60-b9ae-4374-ae43-ce2c997852b5	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	2b90689d-8ea3-459b-88d3-4488b53766f4	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	36fc5d61-6507-4a1b-927b-94a46e7d0a99	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	b66dbc31-15cd-400c-be52-5c61f5b5a06a	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	20cecd6d-5d03-4f11-9d29-859062b5ecf5	ALLOW	\N	2026-08-25 07:04:36.256+06	774bb094-6628-422a-beaf-dc0ae9e50984
ba3b7144-7075-4277-97ec-964326d015b2	86f2978f-3cb2-4f46-999a-e9f5b5c21109	ALLOW	\N	2026-08-25 11:46:42.295+06	3c1bd3c5-8511-413b-8372-95c40f088b3d
ba3b7144-7075-4277-97ec-964326d015b2	cdec28cd-2e0f-411a-8589-26ee171caea4	ALLOW	\N	2026-08-25 11:46:42.295+06	3c1bd3c5-8511-413b-8372-95c40f088b3d
ba3b7144-7075-4277-97ec-964326d015b2	87d8a365-44ef-4f87-8ff4-91d1d77cf95e	ALLOW	\N	2026-08-25 11:46:42.295+06	3c1bd3c5-8511-413b-8372-95c40f088b3d
ba3b7144-7075-4277-97ec-964326d015b2	70cf65f8-677b-430d-80a9-ded8069466b3	ALLOW	\N	2026-08-25 11:46:42.295+06	3c1bd3c5-8511-413b-8372-95c40f088b3d
ba3b7144-7075-4277-97ec-964326d015b2	e7a58f9c-e777-4a98-abe5-e7b2509f6178	ALLOW	\N	2026-08-25 11:46:42.295+06	3c1bd3c5-8511-413b-8372-95c40f088b3d
ba3b7144-7075-4277-97ec-964326d015b2	af4b127e-77a4-4423-8cd2-57d7fdea1326	ALLOW	\N	2026-08-25 11:46:42.295+06	3c1bd3c5-8511-413b-8372-95c40f088b3d
ba3b7144-7075-4277-97ec-964326d015b2	af15c184-ddca-4ddf-97f7-2d2d15f53934	ALLOW	\N	2026-08-25 11:46:42.295+06	3c1bd3c5-8511-413b-8372-95c40f088b3d
ba3b7144-7075-4277-97ec-964326d015b2	b5ac9d67-0eac-4962-b8cd-74f7ca854854	ALLOW	\N	2026-08-25 11:46:42.295+06	3c1bd3c5-8511-413b-8372-95c40f088b3d
ba3b7144-7075-4277-97ec-964326d015b2	0585feba-1f8d-4090-a5d8-f2d50b9164ff	ALLOW	\N	2026-08-25 11:46:42.295+06	3c1bd3c5-8511-413b-8372-95c40f088b3d
e1899b90-e8a2-478e-9f46-683c6d02b142	36fc5d61-6507-4a1b-927b-94a46e7d0a99	ALLOW	\N	2026-08-25 11:47:58.851+06	3c1bd3c5-8511-413b-8372-95c40f088b3d
9968ffa4-8b0c-4380-926c-479f08743721	86f2978f-3cb2-4f46-999a-e9f5b5c21109	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	cdec28cd-2e0f-411a-8589-26ee171caea4	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	87d8a365-44ef-4f87-8ff4-91d1d77cf95e	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	70cf65f8-677b-430d-80a9-ded8069466b3	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	e7a58f9c-e777-4a98-abe5-e7b2509f6178	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	af4b127e-77a4-4423-8cd2-57d7fdea1326	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	af15c184-ddca-4ddf-97f7-2d2d15f53934	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	b5ac9d67-0eac-4962-b8cd-74f7ca854854	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	0585feba-1f8d-4090-a5d8-f2d50b9164ff	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	d1ed2f9e-a9eb-4dc6-b09f-3eeb65d8e263	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	6571f856-2cd7-42a9-820e-831de745f19a	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	522363a9-a9cc-4d12-8d08-11e3a498851f	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	5bb40d60-b9ae-4374-ae43-ce2c997852b5	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	2b90689d-8ea3-459b-88d3-4488b53766f4	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	36fc5d61-6507-4a1b-927b-94a46e7d0a99	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	b66dbc31-15cd-400c-be52-5c61f5b5a06a	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
9968ffa4-8b0c-4380-926c-479f08743721	20cecd6d-5d03-4f11-9d29-859062b5ecf5	ALLOW	\N	2026-08-27 07:28:41.686+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	86f2978f-3cb2-4f46-999a-e9f5b5c21109	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	cdec28cd-2e0f-411a-8589-26ee171caea4	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	87d8a365-44ef-4f87-8ff4-91d1d77cf95e	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	70cf65f8-677b-430d-80a9-ded8069466b3	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	e7a58f9c-e777-4a98-abe5-e7b2509f6178	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	af4b127e-77a4-4423-8cd2-57d7fdea1326	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	af15c184-ddca-4ddf-97f7-2d2d15f53934	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	b5ac9d67-0eac-4962-b8cd-74f7ca854854	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	0585feba-1f8d-4090-a5d8-f2d50b9164ff	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	d1ed2f9e-a9eb-4dc6-b09f-3eeb65d8e263	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	6571f856-2cd7-42a9-820e-831de745f19a	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	522363a9-a9cc-4d12-8d08-11e3a498851f	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	5bb40d60-b9ae-4374-ae43-ce2c997852b5	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	2b90689d-8ea3-459b-88d3-4488b53766f4	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	36fc5d61-6507-4a1b-927b-94a46e7d0a99	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	b66dbc31-15cd-400c-be52-5c61f5b5a06a	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
96f3f0bb-fe61-4fed-bc39-094b752c128e	20cecd6d-5d03-4f11-9d29-859062b5ecf5	ALLOW	\N	2026-08-27 07:28:41.702+06	774bb094-6628-422a-beaf-dc0ae9e50984
4e1d08c5-d9ee-43be-b7d3-5ebecad4e8a5	86f2978f-3cb2-4f46-999a-e9f5b5c21109	ALLOW	\N	2026-08-27 07:28:41.708+06	774bb094-6628-422a-beaf-dc0ae9e50984
4e1d08c5-d9ee-43be-b7d3-5ebecad4e8a5	e7a58f9c-e777-4a98-abe5-e7b2509f6178	ALLOW	\N	2026-08-27 07:28:41.708+06	774bb094-6628-422a-beaf-dc0ae9e50984
4e1d08c5-d9ee-43be-b7d3-5ebecad4e8a5	af4b127e-77a4-4423-8cd2-57d7fdea1326	ALLOW	\N	2026-08-27 07:28:41.708+06	774bb094-6628-422a-beaf-dc0ae9e50984
4e1d08c5-d9ee-43be-b7d3-5ebecad4e8a5	af15c184-ddca-4ddf-97f7-2d2d15f53934	ALLOW	\N	2026-08-27 07:28:41.708+06	774bb094-6628-422a-beaf-dc0ae9e50984
4e1d08c5-d9ee-43be-b7d3-5ebecad4e8a5	b5ac9d67-0eac-4962-b8cd-74f7ca854854	ALLOW	\N	2026-08-27 07:28:41.708+06	774bb094-6628-422a-beaf-dc0ae9e50984
4e1d08c5-d9ee-43be-b7d3-5ebecad4e8a5	0585feba-1f8d-4090-a5d8-f2d50b9164ff	ALLOW	\N	2026-08-27 07:28:41.708+06	774bb094-6628-422a-beaf-dc0ae9e50984
2a416daa-7144-43f6-8619-e72f08709b7d	86f2978f-3cb2-4f46-999a-e9f5b5c21109	ALLOW	\N	2026-08-27 07:28:41.711+06	774bb094-6628-422a-beaf-dc0ae9e50984
\.


--
-- Data for Name: company_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.company_roles (id, "tenantId", "companyId", code, name, description, "isSystem", "createdAt", "updatedAt", status) FROM stdin;
2a23f140-ff6f-4ed0-ab68-0367f4ae8450	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	COMPANY_OWNER	Company Owner	Full administrative access to the company	t	2026-08-25 06:16:21.206+06	2026-08-25 06:17:14.506+06	ACTIVE
6c6b6551-486e-4da3-9db3-3ff0aea94a25	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	COMPANY_ADMIN	Company Admin	\N	t	2026-08-25 06:17:14.536+06	2026-08-25 06:17:14.536+06	ACTIVE
b492b46e-fde8-4f6a-abb4-582c7d722339	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	MANAGER	Manager	\N	t	2026-08-25 06:17:14.546+06	2026-08-25 06:17:14.546+06	ACTIVE
80b9b935-6176-472c-a928-5d278b4ec929	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	STAFF	Staff	\N	t	2026-08-25 06:17:14.552+06	2026-08-25 06:17:14.552+06	ACTIVE
fa46b4e4-b100-49fd-b36d-005c8fa16dcf	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	COMPANY_OWNER	Company Owner	Full administrative access to the company	t	2026-08-25 07:04:01.224+06	2026-08-25 07:04:36.209+06	ACTIVE
05cffcbe-ac8c-4c56-8ab9-d274eef7461e	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	COMPANY_ADMIN	Company Admin	\N	t	2026-08-25 07:04:36.245+06	2026-08-25 07:04:36.245+06	ACTIVE
ba3b7144-7075-4277-97ec-964326d015b2	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	MANAGER	Manager	\N	t	2026-08-25 07:04:36.258+06	2026-08-25 07:04:36.258+06	ACTIVE
e1899b90-e8a2-478e-9f46-683c6d02b142	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	STAFF	Staff	\N	t	2026-08-25 07:04:36.264+06	2026-08-25 07:04:36.264+06	ACTIVE
9968ffa4-8b0c-4380-926c-479f08743721	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	COMPANY_OWNER	Company Owner	Full administrative access to the company	t	2026-08-27 07:28:08.184+06	2026-08-27 07:28:41.672+06	ACTIVE
96f3f0bb-fe61-4fed-bc39-094b752c128e	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	COMPANY_ADMIN	Company Admin	\N	t	2026-08-27 07:28:41.696+06	2026-08-27 07:28:41.696+06	ACTIVE
4e1d08c5-d9ee-43be-b7d3-5ebecad4e8a5	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	MANAGER	Manager	\N	t	2026-08-27 07:28:41.706+06	2026-08-27 07:28:41.706+06	ACTIVE
2a416daa-7144-43f6-8619-e72f08709b7d	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	STAFF	Staff	\N	t	2026-08-27 07:28:41.709+06	2026-08-27 07:28:41.709+06	ACTIVE
\.


--
-- Data for Name: features; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.features (id, code, name, module, description, "createdAt", "updatedAt", status, "configSchema") FROM stdin;
b4994c7f-ad92-463f-81f0-28bb8b8d7014	POS	POS Management	POS	\N	2026-08-22 11:34:18.514+06	2026-08-22 11:34:18.514+06	ACTIVE	[]
555079bb-4042-4952-aeb9-2dc6b663b40b	PRODUCT	Product	PRODUCT	\N	2026-08-25 11:37:47.687+06	2026-08-25 11:37:47.687+06	ACTIVE	[]
\.


--
-- Data for Name: industries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.industries (id, code, name, description, "createdAt", "updatedAt", status) FROM stdin;
5c961a18-af13-4638-b93d-b7faa4c502b7	SUPERSHOP	Super shop	\N	2026-08-22 11:29:45.997+06	2026-08-22 11:29:45.997+06	ACTIVE
65448ffe-49ef-4505-ac82-a3805dfe8ef6	RESTURENT	resturent	\N	2026-08-25 05:42:25.359+06	2026-08-25 05:42:25.359+06	ACTIVE
\.


--
-- Data for Name: invitations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invitations (id, type, status, "tenantId", "companyId", "invitedUserId", email, "tokenHash", "expiresAt", "acceptedAt", "revokedAt", "sentByUserId", metadata, "createdAt") FROM stdin;
\.


--
-- Data for Name: invoice_sequences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_sequences ("yearKey", "lastNumber") FROM stdin;
2026	7
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, "tenantId", "companyId", "subscriptionId", "billingId", "invoiceNumber", status, "currencyCode", subtotal, "discountAmount", "taxAmount", "totalAmount", "priceSnapshot", "issuedAt", "dueAt", "paidAt", "cancelledAt", "voidedAt", metadata, "createdAt", "updatedAt") FROM stdin;
8a9cef40-acc8-4b83-b6f9-94b27b4ab46e	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	509dc1a2-0c06-4a9b-b860-e0fed4a0b2c1	eb6d3cbd-7dd9-4ac4-b637-d299495de49d	INV-2026-000007	PAID	BDT	6.0000	0.0000	0.0000	6.0000	{"amount": "6", "planId": "794b6c06-55a9-427c-ae40-874d7628158c", "planCode": "MEDIUM", "planName": "medium", "capturedAt": "2026-08-25T07:02:06.080Z", "billingCycle": "YEARLY", "currencyCode": "BDT"}	2026-08-25 07:03:21.42+06	2026-08-25 00:00:00+06	2026-08-25 07:06:06.993+06	\N	\N	{"createdBy": "774bb094-6628-422a-beaf-dc0ae9e50984"}	2026-08-25 07:03:14.497+06	2026-08-25 07:06:06.994+06
cfcd1ee7-856c-440d-ba39-4b9d6f4ba807	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	e49f57a0-7342-4181-97e1-ddf2b5bc2320	f81ba5f4-3f34-406a-b6b6-531735e0ef40	INV-2026-000006	PAID	BDT	4.0000	0.0000	0.0000	4.0000	{"amount": "4", "planId": "225c1374-d952-4e8c-8d47-503e2515d26e", "planCode": "PRO", "planName": "pro", "capturedAt": "2026-08-25T06:26:25.742Z", "billingCycle": "YEARLY", "currencyCode": "BDT"}	2026-08-25 06:31:35.034+06	2026-08-25 00:00:00+06	2026-08-25 09:07:43.461+06	\N	\N	{"createdBy": "774bb094-6628-422a-beaf-dc0ae9e50984"}	2026-08-25 06:31:13.763+06	2026-08-25 09:07:43.463+06
\.


--
-- Data for Name: login_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.login_events (id, "userId", email, success, reason, "ipAddress", "userAgent", "occurredAt") FROM stdin;
5c3c71bc-2dc1-4ed0-8e39-e016b97ad31e	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	f	INVALID_CREDENTIALS	::1	node	2026-08-22 08:50:32.221+06
0f2284f3-e17f-4b27-a721-9aa97a7d5889	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-22 08:50:38.847+06
2c9a6161-767c-4a0b-a2b4-3d998f672c57	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-22 12:04:13.471+06
49f813a9-021b-4f56-a389-f57fe491c8e4	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-22 12:08:50.584+06
ddeaa32d-cc8b-4184-870f-a8e3145d6ca5	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-22 12:17:42.985+06
ba0809ea-0a5e-4cbe-9f16-87385d696dac	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-22 12:29:55.417+06
9423e655-7af2-4620-aa23-8f5d45727f32	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-23 04:23:38.935+06
2fdc3797-7684-4382-8cff-34b031100f6f	\N	owner2@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-22 12:15:36.518+06
6da49f50-f1a9-4828-9cee-a408bf320e21	\N	owner2@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-22 12:27:14.195+06
017204d1-99d9-49ee-8811-2cb7e985520a	\N	owner2@gmail.com	f	INVALID_CREDENTIALS	::1	node	2026-08-22 12:28:07.183+06
410f8d4d-bf43-4058-a6bc-1b719bd386aa	\N	owner2@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-22 12:28:10.838+06
17239d1f-0963-4db2-affa-9df78d612ddb	\N	owner@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-22 11:56:26.667+06
c756cf9e-ce7a-426c-a35c-b78fa5fc6015	\N	owner@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-22 12:05:18.608+06
6ea0cbc1-ee80-4b73-a2ca-04cb49004597	\N	owner@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-22 12:42:43.95+06
16191e7f-e1d9-45b8-bb39-a88cb330d720	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-23 05:09:55.003+06
7d526b05-877c-476f-b0f0-114ef3ca5431	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 10:59:07.757+06
43796c89-bc2e-4092-8971-6fa31296c6a1	\N	owner1@gmail.com	f	INVALID_CREDENTIALS	::1	node	2026-08-24 11:01:02.129+06
dddae302-da7a-4ecb-820b-e45cb03da723	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 11:06:20.706+06
a2e50c19-8e1c-429d-b2b8-8a92ee6bdd7c	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 11:19:06.808+06
98a0277d-6083-493b-9fa0-4f678f2bff00	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 11:33:21.322+06
5fd0ea26-679f-4ebf-a4b7-9d6c8b9a7835	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 11:37:14.509+06
e225c744-04cd-4a96-8c41-9a0bc121ce8b	\N	admin@gmail.com	f	INVALID_CREDENTIALS	::1	node	2026-08-24 11:45:51.179+06
e0bb0829-3603-4428-8c95-fbb24158c125	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 11:46:07.053+06
7d3c9ae4-e4fb-406c-9f3e-189bc80d7c7e	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 11:51:26.6+06
9ef8064d-10db-4b0f-9383-e616dfe76223	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 12:02:39.362+06
be508d28-9a72-4852-8323-0b77b992425a	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 12:02:53.398+06
3a5b26d6-c3f6-4fb5-8834-6a1b736ca3dd	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 04:37:16.722+06
5f18bd05-bc32-4f31-a423-d9c8a9c92d06	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 05:27:26.834+06
55671caa-33fe-4da9-a430-83c9010d9b4d	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 05:40:25.739+06
1bf719dc-0095-4a9a-a2e7-bb647848680e	\N	company1@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 04:46:38.131+06
fa15e512-e08d-41db-bddf-e13e615ce6cb	\N	company1@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 05:28:59.061+06
98e74717-4c71-4cf4-903f-2928674cf158	\N	abcd@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-23 05:07:39.477+06
0dd024b2-bc3f-4d6b-9215-3435abd5beeb	\N	abcd@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-23 05:11:08.84+06
6bc82915-658a-4548-bad0-9821dd9c07d9	\N	abcd@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 11:07:31.85+06
f2e43937-fb0f-42d3-b7c1-c7aeb83ff823	\N	abcd@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 11:21:44.996+06
d6ff9f90-020e-42eb-af8a-15158f9e401d	\N	abcd@gmail.com	f	INVALID_CREDENTIALS	::1	node	2026-08-24 11:34:59.544+06
de11edd1-2e88-416f-ae40-69d536c44355	\N	abcd@gmail.com	f	INVALID_CREDENTIALS	::1	node	2026-08-24 11:35:04.369+06
3d38fbad-21bb-4578-82ab-b2addb9619e6	\N	abcd@gmail.com	f	INVALID_CREDENTIALS	::1	node	2026-08-24 11:35:13.458+06
98fa9a61-98a3-4401-8700-fa421ab9df85	\N	abcd@gmail.com	f	INVALID_CREDENTIALS	::1	node	2026-08-24 11:35:24.179+06
7cc5e3df-85e3-4e71-8503-f27aca1f21fa	\N	abcd@gmail.com	f	ACCOUNT_LOCKED	::1	node	2026-08-24 11:35:30.319+06
5b79ee0e-82d4-4288-b8cf-1160522eb050	\N	abcd@gmail.com	f	ACCOUNT_LOCKED	::1	node	2026-08-24 11:38:27.233+06
c817058a-517d-4beb-9059-fb270526159a	\N	abcd@gmail.com	f	ACCOUNT_LOCKED	::1	node	2026-08-24 11:38:32.971+06
f58240b6-4de3-4e44-92da-6540187ed0f5	\N	abcd@gmail.com	f	ACCOUNT_LOCKED	::1	node	2026-08-24 11:38:41.93+06
579a7b62-2207-4f62-9392-95c95ed337dc	\N	abcd@gmail.com	f	ACCOUNT_LOCKED	::1	node	2026-08-24 11:42:15.248+06
a07a59b2-7185-4ec6-b0b9-4b11dcd2123a	\N	abcd@gmail.com	f	ACCOUNT_LOCKED	::1	node	2026-08-24 11:42:18.978+06
e3b50791-b6f2-48f3-b977-57ee68527fe2	\N	abcd@gmail.com	f	ACCOUNT_LOCKED	::1	node	2026-08-24 11:42:22.103+06
b231713f-02cd-40e6-94cc-f95529a344ee	\N	abcd@gmail.com	f	ACCOUNT_LOCKED	::1	node	2026-08-24 11:42:26.007+06
f5f1b11b-8f8d-473c-9264-445212e69702	\N	abcd@gmail.com	f	ACCOUNT_LOCKED	::1	node	2026-08-24 11:45:13.074+06
67121bad-a7d2-4b84-8237-fcf1a428efa2	\N	abcd@gmail.com	f	ACCOUNT_LOCKED	::1	node	2026-08-24 11:45:20.956+06
dea97699-9828-449f-9af2-3869189d617d	\N	abcd@gmail.com	f	ACCOUNT_LOCKED	::1	node	2026-08-24 11:45:22.545+06
dcf55483-d2e6-41a7-9005-2b5e881d44cf	\N	admin@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 11:49:28.389+06
2dd497db-96f2-4dae-bfd9-d07f30687e0f	\N	admin@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 11:52:04.818+06
b572437b-5d2d-41c4-b2c3-00b73b712ea5	\N	admin@gmail.com	t	LOGIN_SUCCESS	::1	node	2026-08-24 12:03:05.788+06
5c330d8b-95fd-47da-a40e-868d2cba82d0	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 06:09:52.148+06
223b48d9-3f8d-45f8-b1ac-419f3e181ad9	68c8a00e-0f20-4dda-ad86-5c80143a2877	fresh.owner@dotskills.test	t	LOGIN_SUCCESS	::1	node	2026-08-25 06:18:08.733+06
abd3d8b7-ad08-454c-951a-ddef97f35eb3	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 06:26:04.658+06
77f0b44b-2747-432a-9f80-f38e8b4078b9	68c8a00e-0f20-4dda-ad86-5c80143a2877	fresh.owner@dotskills.test	t	LOGIN_SUCCESS	::1	node	2026-08-25 06:33:05.354+06
69158040-b780-4c34-b317-224c420c5e0d	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 06:39:05.898+06
f5280588-72a5-4972-9b99-41c1e59896df	68c8a00e-0f20-4dda-ad86-5c80143a2877	fresh.owner@dotskills.test	t	LOGIN_SUCCESS	::1	node	2026-08-25 06:39:54.236+06
4fea736b-05b7-43a6-beac-b878554ecafa	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 06:59:00.711+06
acb177f9-8a73-4250-9b20-69a076e76579	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 06:59:05.848+06
e9693126-eb62-41f0-8f75-efa09cedfd9d	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 06:59:43.151+06
b09d2f2c-98f0-4de1-a2b6-90a26688ad64	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 06:59:44.166+06
9f5a99c3-d608-4bb1-82da-8b54b726f8ae	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 07:00:27.905+06
0181b089-b698-4cf6-a91c-a52dbeb7b335	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 07:00:36.627+06
a7daed4d-e48f-4e16-982e-fc92f910d8b5	3c1bd3c5-8511-413b-8372-95c40f088b3d	fresh.owner2@dotskills.test	t	LOGIN_SUCCESS	::1	node	2026-08-25 07:04:17.551+06
b7995af5-79aa-4488-bdd1-f458b7f574dd	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 07:04:27.812+06
f39b82ac-24e7-470f-b885-824932e98abc	3c1bd3c5-8511-413b-8372-95c40f088b3d	fresh.owner2@dotskills.test	t	LOGIN_SUCCESS	::1	node	2026-08-25 07:04:50.935+06
50415af1-8433-42b5-9862-cda4bc6309bd	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 08:01:37.751+06
3fdfbe21-27cf-46f1-9a5a-2b7f4b038f6d	3c1bd3c5-8511-413b-8372-95c40f088b3d	fresh.owner2@dotskills.test	t	LOGIN_SUCCESS	::1	node	2026-08-25 08:02:48.833+06
30346626-f31c-488d-bdf9-a5ed30beb289	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	curl/8.21.0	2026-08-25 08:55:06.763+06
7a1435ad-922d-4180-a3b7-05c1a42e0cd6	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 08:55:54.194+06
0de757c5-7162-457e-8c26-ef3aa2ab110d	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	curl/8.21.0	2026-08-25 09:07:42.593+06
bf7e2d2c-69b5-4262-ba0c-f7945350cf04	3c1bd3c5-8511-413b-8372-95c40f088b3d	fresh.owner2@dotskills.test	t	LOGIN_SUCCESS	::1	node	2026-08-25 09:26:33.42+06
0b8f2f3c-a7cf-4876-a0a6-54384ef35c8d	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 09:29:08.567+06
824fcd3c-f5e8-479b-ad64-97a650484f19	\N	admin@gmail.com	f	INVALID_CREDENTIALS	::1	node	2026-08-25 10:54:17.837+06
02c71ff8-d71f-4906-b01f-b0c2f809892d	68c8a00e-0f20-4dda-ad86-5c80143a2877	fresh.owner@dotskills.test	t	LOGIN_SUCCESS	::1	node	2026-08-25 10:55:14.537+06
c4e1f20d-47eb-466f-951d-5e61bed8a2c7	3c1bd3c5-8511-413b-8372-95c40f088b3d	fresh.owner2@dotskills.test	t	LOGIN_SUCCESS	::1	node	2026-08-25 10:56:14.371+06
08abe17a-4dd0-4e1d-979b-4159d2f5b533	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	node	2026-08-25 10:56:41.195+06
56a017d2-e9f2-4234-b59e-6ce3933d34df	774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	t	LOGIN_SUCCESS	::1	curl/8.21.0	2026-08-27 07:25:30.485+06
a670f6e5-c314-40f4-99f3-4281b2a7e142	1d9c2ef0-a937-4a08-86fe-4c4404b336f0	autotrialowner@test.com	t	LOGIN_SUCCESS	::1	curl/8.21.0	2026-08-27 07:28:17.172+06
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, "tenantId", "companyId", "subscriptionId", "invoiceId", provider, status, "currencyCode", amount, "providerTransactionId", "gatewayReference", "idempotencyKey", "failureReason", "rawInitiateResponse", "rawVerifyResponse", metadata, "initiatedAt", "succeededAt", "failedAt", "cancelledAt", "createdAt", "updatedAt") FROM stdin;
6cc4c315-a566-494c-ad50-320dbfbc58d4	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	509dc1a2-0c06-4a9b-b860-e0fed4a0b2c1	8a9cef40-acc8-4b83-b6f9-94b27b4ab46e	SSLCOMMERZ	SUCCEEDED	BDT	6.0000	DSMT8BLDPJ8cd849722695	260825130605oHRrlQDjagkcbX4	payment:8a9cef40-acc8-4b83-b6f9-94b27b4ab46e:attempt:1	\N	{"gw": {"amex": "city_amex,amexcard", "visa": "city_visa,ebl_visa,visacard", "master": "city_master,ebl_master,mastercard", "othercards": "qcash,fastcash", "mobilebanking": "dbblmobilebanking,bkash,nagad,abbank,ibbl,tap,upay,okaywallet,cellfine,mcash", "internetbanking": "city,abbank,bankasia,ibbl,mtbl,tapnpay,eblsky,instapay,pmoney,woori,modhumoti,fsibl"}, "desc": [{"gw": "amexcard", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/amex.png", "name": "AMEX", "type": "amex", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=amexcard"}, {"gw": "visacard", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/visa.png", "name": "VISA", "type": "visa", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=visavard"}, {"gw": "mastercard", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/master.png", "name": "MASTER", "type": "master", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=mastercard"}, {"gw": "city_amex", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/amex.png", "name": "AMEX-City Bank", "type": "amex", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=city_amex"}, {"gw": "qcash", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/qcash.png", "name": "QCash", "type": "othercards", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=qcash"}, {"gw": "fastcash", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/fastcash.png", "name": "Fast Cash", "type": "othercards"}, {"gw": "bkash", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/bkash.png", "name": "bKash", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=bkash"}, {"gw": "nagad", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/nagad.png", "name": "Nagad", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=nagad"}, {"gw": "dbblmobilebanking", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/dbblmobilebank.png", "name": "DBBL Mobile Banking", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=dbblmobilebanking"}, {"gw": "abbank", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/abbank.png", "name": "AB Direct", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=abbank"}, {"gw": "abbank", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/abbank.png", "name": "AB Direct", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=abbank"}, {"gw": "ibbl", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/ibbl.png", "name": "IBBL", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=ibbl"}, {"gw": "city", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/citytouch.png", "name": "Citytouch", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=city"}, {"gw": "mtbl", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/mtbl.png", "name": "MTBL", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=mtbl"}, {"gw": "bankasia", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/bankasia.png", "name": "Bank Asia", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=bankasia"}, {"gw": "ebl_visa", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/visa.png", "name": "VISA-Eastern Bank Limited", "type": "visa", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=ebl_visa"}, {"gw": "ebl_master", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/master.png", "name": "MASTER-Eastern Bank Limited", "type": "master", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=ebl_master"}, {"gw": "city_visa", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/visa.png", "name": "VISA-City Bank", "type": "visa", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=city_visa"}, {"gw": "city_master", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/master.png", "name": "MASTER-City bank", "type": "master", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=city_master"}, {"gw": "mobilemoney", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/tap.png", "name": "TAP", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=mobilemoney"}, {"gw": "upay", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/upay.png", "name": "upay", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=upay"}, {"gw": "okaywallet", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/okwallet.png", "name": "okaywallet", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=okaywallet"}, {"gw": "cellfine", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/cellfin.png", "name": "cellfine", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=cellfine"}, {"gw": "ibbl_m", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/ibblmobile.png", "name": "mcash", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=ibbl_m"}, {"gw": "tapnpay", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/tapnpay.png", "name": "tapnpay", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=tapnpay"}, {"gw": "eblsky", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/eblsky.png", "name": "eblsky", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=eblsky"}, {"gw": "instapay", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/instapay.png", "name": "instapay", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=instapay"}, {"gw": "pmoney", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/pmoney.png", "name": "pmoney", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=pmoney"}, {"gw": "woori", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/woori.png", "name": "woori", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=woori"}, {"gw": "modhumoti", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/modhumoti.png", "name": "modhumoti", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=modhumoti"}, {"gw": "fsibl", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/FsiblCloudLogo.png", "name": "fsibl", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=fsibl"}], "status": "SUCCESS", "storeLogo": "https://sandbox.sslcommerz.com/stores/logos/demoLogo.png", "ip_address": "103.15.141.27", "sessionkey": "01D6C6B298DFA07DF4D03AECB3DA5DA9", "store_name": "Demo", "storeBanner": "https://sandbox.sslcommerz.com/stores/logos/demoLogo.png", "failedreason": "", "BQRPaymentURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=visacard&bqr=1", "GatewayPageURL": "https://sandbox.sslcommerz.com/EasyCheckOut/testcde01d6c6b298dfa07df4d03aecb3da5da9", "directPaymentURL": "", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=6.00&ssl_id=260825130501cdpDQ2HDa2gUnDw&Q=REDIRECT&SESSIONKEY=01D6C6B298DFA07DF4D03AECB3DA5DA9&tran_type=success&cardname=", "directPaymentURLBank": "", "directPaymentURLCard": "", "is_direct_pay_enable": "0", "redirectGatewayURLFailed": ""}	{"amount": "6.00", "status": "VALID", "val_id": "260825130605oHRrlQDjagkcbX4", "card_no": "455445XXXXXX4326", "tran_id": "DSMT8BLDPJ8cd849722695", "value_a": "", "value_b": "", "value_c": "", "value_d": "", "currency": "BDT", "base_fair": "0.00", "card_type": "VISA-Dutch Bangla", "tran_date": "2026-08-25 13:05:01", "APIConnect": "DONE", "card_brand": "VISA", "emi_amount": "0.00", "emi_issuer": "STANDARD CHARTERED BANK", "gw_version": "", "risk_level": "0", "risk_title": "Safe", "card_issuer": "STANDARD CHARTERED BANK", "card_ref_id": "dc1da4f52669828139e81ef5eb0f48a5a99ea054a131e00a562887d455417dd913", "offer_avail": 1, "bank_tran_id": "260825130605UomLHC3Vwxnc6vm", "store_amount": "5.85", "validated_on": "2026-08-25 13:06:06", "campaign_code": "", "card_category": "CREDIT", "currency_rate": "1.0000", "currency_type": "BDT", "card_sub_brand": "", "emi_instalment": "0", "account_details": "", "currency_amount": "6.00", "discount_amount": "0.00", "emi_description": "0 Months", "discount_remarks": "", "isTokeizeSuccess": 0, "card_issuer_country": "Bangladesh", "discount_percentage": "0", "card_issuer_country_code": "BD"}	{"initiatedByUserId": "3c1bd3c5-8511-413b-8372-95c40f088b3d"}	2026-08-25 07:05:01.02+06	2026-08-25 07:06:06.986+06	\N	\N	2026-08-25 07:05:00.584+06	2026-08-25 07:06:06.988+06
630a045e-f4a9-4fdc-98e8-45a5782a3379	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	e49f57a0-7342-4181-97e1-ddf2b5bc2320	cfcd1ee7-856c-440d-ba39-4b9d6f4ba807	SSLCOMMERZ	SUCCEEDED	BDT	4.0000	DSMT8AP8FQa2e7eeaa494a	260825124214YTmFrMe14n8s3zX	payment:cfcd1ee7-856c-440d-ba39-4b9d6f4ba807:attempt:2	\N	{"gw": {"amex": "city_amex,amexcard", "visa": "city_visa,ebl_visa,visacard", "master": "city_master,ebl_master,mastercard", "othercards": "qcash,fastcash", "mobilebanking": "dbblmobilebanking,bkash,nagad,abbank,ibbl,tap,upay,okaywallet,cellfine,mcash", "internetbanking": "city,abbank,bankasia,ibbl,mtbl,tapnpay,eblsky,instapay,pmoney,woori,modhumoti,fsibl"}, "desc": [{"gw": "amexcard", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/amex.png", "name": "AMEX", "type": "amex", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=amexcard"}, {"gw": "visacard", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/visa.png", "name": "VISA", "type": "visa", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=visavard"}, {"gw": "mastercard", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/master.png", "name": "MASTER", "type": "master", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=mastercard"}, {"gw": "city_amex", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/amex.png", "name": "AMEX-City Bank", "type": "amex", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=city_amex"}, {"gw": "qcash", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/qcash.png", "name": "QCash", "type": "othercards", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=qcash"}, {"gw": "fastcash", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/fastcash.png", "name": "Fast Cash", "type": "othercards"}, {"gw": "bkash", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/bkash.png", "name": "bKash", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=bkash"}, {"gw": "nagad", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/nagad.png", "name": "Nagad", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=nagad"}, {"gw": "dbblmobilebanking", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/dbblmobilebank.png", "name": "DBBL Mobile Banking", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=dbblmobilebanking"}, {"gw": "abbank", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/abbank.png", "name": "AB Direct", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=abbank"}, {"gw": "abbank", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/abbank.png", "name": "AB Direct", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=abbank"}, {"gw": "ibbl", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/ibbl.png", "name": "IBBL", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=ibbl"}, {"gw": "city", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/citytouch.png", "name": "Citytouch", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=city"}, {"gw": "mtbl", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/mtbl.png", "name": "MTBL", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=mtbl"}, {"gw": "bankasia", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/bankasia.png", "name": "Bank Asia", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=bankasia"}, {"gw": "ebl_visa", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/visa.png", "name": "VISA-Eastern Bank Limited", "type": "visa", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=ebl_visa"}, {"gw": "ebl_master", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/master.png", "name": "MASTER-Eastern Bank Limited", "type": "master", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=ebl_master"}, {"gw": "city_visa", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/visa.png", "name": "VISA-City Bank", "type": "visa", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=city_visa"}, {"gw": "city_master", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/master.png", "name": "MASTER-City bank", "type": "master", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=city_master"}, {"gw": "mobilemoney", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/tap.png", "name": "TAP", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=mobilemoney"}, {"gw": "upay", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/upay.png", "name": "upay", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=upay"}, {"gw": "okaywallet", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/okwallet.png", "name": "okaywallet", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=okaywallet"}, {"gw": "cellfine", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/cellfin.png", "name": "cellfine", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=cellfine"}, {"gw": "ibbl_m", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/ibblmobile.png", "name": "mcash", "type": "mobilebanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=ibbl_m"}, {"gw": "tapnpay", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/tapnpay.png", "name": "tapnpay", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=tapnpay"}, {"gw": "eblsky", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/eblsky.png", "name": "eblsky", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=eblsky"}, {"gw": "instapay", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/instapay.png", "name": "instapay", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=instapay"}, {"gw": "pmoney", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/pmoney.png", "name": "pmoney", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=pmoney"}, {"gw": "woori", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/woori.png", "name": "woori", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=woori"}, {"gw": "modhumoti", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/modhumoti.png", "name": "modhumoti", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=modhumoti"}, {"gw": "fsibl", "logo": "https://sandbox.sslcommerz.com/gwprocess/v4/image/gw/FsiblCloudLogo.png", "name": "fsibl", "type": "internetbanking", "r_flag": "1", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=fsibl"}], "status": "SUCCESS", "storeLogo": "https://sandbox.sslcommerz.com/stores/logos/demoLogo.png", "ip_address": "103.15.141.27", "sessionkey": "CDCEEFAFBB2E84D45659C8F8D07B5DF7", "store_name": "Demo", "storeBanner": "https://sandbox.sslcommerz.com/stores/logos/demoLogo.png", "failedreason": "", "BQRPaymentURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=visacard&bqr=1", "GatewayPageURL": "https://sandbox.sslcommerz.com/EasyCheckOut/testcdecdceefafbb2e84d45659c8f8d07b5df7", "directPaymentURL": "", "redirectGatewayURL": "https://sandbox.sslcommerz.com/gwprocess/v4/bankgw/indexhtmlOTP.php?mamount=4.00&ssl_id=260825124001UPmd0zSIGBbMuVp&Q=REDIRECT&SESSIONKEY=CDCEEFAFBB2E84D45659C8F8D07B5DF7&tran_type=success&cardname=", "directPaymentURLBank": "", "directPaymentURLCard": "", "is_direct_pay_enable": "0", "redirectGatewayURLFailed": ""}	{"amount": "4.00", "status": "VALIDATED", "val_id": "260825124214YTmFrMe14n8s3zX", "card_no": "450850******4050", "tran_id": "DSMT8AP8FQa2e7eeaa494a", "value_a": "", "value_b": "", "value_c": "", "value_d": "", "currency": "BDT", "base_fair": "0.00", "card_type": "VISA-Dutch Bangla", "tran_date": "2026-08-25 12:40:01", "APIConnect": "DONE", "card_brand": "VISA", "emi_amount": "0.00", "emi_issuer": "CAJA DE AHORROS Y PENSIONES DE BARCELONA(LA CAIXA)", "gw_version": "", "risk_level": "1", "risk_title": "Not Safe", "card_issuer": "CAJA DE AHORROS Y PENSIONES DE BARCELONA(LA CAIXA)", "card_ref_id": "dc1da4f52669828139e81ef5eb0f48a5a99ea054a131e00a562887d455417dd915", "offer_avail": 1, "bank_tran_id": "260825124214E4xAaCgDNHf65ls", "store_amount": "3.9", "validated_on": "2026-08-25 15:06:39", "campaign_code": "", "card_category": "DEBIT", "currency_rate": "1.0000", "currency_type": "BDT", "card_sub_brand": "", "emi_instalment": "0", "account_details": "", "currency_amount": "4.00", "discount_amount": "0.00", "emi_description": "0 Months", "discount_remarks": "", "isTokeizeSuccess": 0, "card_issuer_country": "Spain", "discount_percentage": "0", "card_issuer_country_code": "ES"}	{"initiatedByUserId": "68c8a00e-0f20-4dda-ad86-5c80143a2877"}	2026-08-25 06:40:01.182+06	2026-08-25 09:07:43.446+06	\N	\N	2026-08-25 06:40:00.76+06	2026-08-25 09:07:43.448+06
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, code, "moduleCode", resource, action, name, description, "isSystem", "createdAt", "updatedAt", status) FROM stdin;
98b24f78-db1c-458f-884c-39789505aa9d	platform.staff.read	platform_access	staff	read	Read platform staff	View platform staff members and their details.	t	2026-08-09 11:26:18.975+06	2026-08-25 08:59:41.088+06	ACTIVE
157fb420-ae5d-4c26-bed2-4db6de772026	platform.staff.create	platform_access	staff	create	Create platform staff	Create or invite a new platform staff member.	t	2026-08-09 11:26:18.711+06	2026-08-25 08:59:41.11+06	ACTIVE
c36ed3e8-0f98-4643-abdc-8c718964db7c	platform.staff.update	platform_access	staff	update	Update platform staff	Update platform staff information.	t	2026-08-09 11:26:18.983+06	2026-08-25 08:59:41.113+06	ACTIVE
a2a5135a-c9b1-4216-98a9-2ad1724902a6	platform.staff.status	platform_access	staff	status	Change platform staff status	\N	t	2026-08-10 06:21:17.374+06	2026-08-25 08:59:41.114+06	ACTIVE
86e934ad-00f2-403d-89ec-fb04cafda4dc	platform.staff.role.assign	platform_access	staff	role_assign	Assign platform staff roles	\N	t	2026-08-10 06:21:17.377+06	2026-08-25 08:59:41.116+06	ACTIVE
1155a9fd-94f4-45c1-b0c5-ff2f01037489	platform.role.read	platform_access	role	read	Read platform roles	View platform roles and permissions.	t	2026-08-09 11:26:19.004+06	2026-08-25 08:59:41.117+06	ACTIVE
11b7604d-5ccb-4b15-94cb-26f16f783db5	platform.role.create	platform_access	role	create	Create platform roles	Create a custom platform role.	t	2026-08-09 11:26:18.996+06	2026-08-25 08:59:41.119+06	ACTIVE
cd83dc7f-09df-47c2-9f12-77cc6d7cd776	platform.role.update	platform_access	role	update	Update platform roles	Update platform role information and permissions.	t	2026-08-09 11:26:19.011+06	2026-08-25 08:59:41.12+06	ACTIVE
78b64cf1-9944-4a96-887a-9e846aa209e6	platform.industry.status	industry_management	industry	status	Change industry status	\N	t	2026-08-17 12:30:45.255+06	2026-08-25 08:59:41.17+06	ACTIVE
0159031e-3e9b-49f0-bcea-8dbc18391a26	billing.mark_succeeded	billing_management	billing	mark_succeeded	Mark billing as succeeded	\N	t	2026-08-18 06:58:36.343+06	2026-08-25 08:59:41.185+06	ACTIVE
38711999-7de3-4d4f-adc4-230e879a269a	billing.mark_failed	billing_management	billing	mark_failed	Mark billing as failed	\N	t	2026-08-18 06:58:36.346+06	2026-08-25 08:59:41.201+06	ACTIVE
04aa886b-d8a3-4ec7-867e-0c8040bf0dc2	invoice.create	invoice_management	invoice	create	Create invoices	\N	t	2026-08-18 12:19:41.555+06	2026-08-25 08:59:41.203+06	ACTIVE
d59af5c5-49a2-4fb2-bf3d-16688dbfa8fd	invoice.read	invoice_management	invoice	read	Read invoices	\N	t	2026-08-18 12:19:41.557+06	2026-08-25 08:59:41.205+06	ACTIVE
317c5a47-5de2-4601-908a-c5f96f467f2f	invoice.issue	invoice_management	invoice	issue	Issue invoices	\N	t	2026-08-18 12:19:41.56+06	2026-08-25 08:59:41.207+06	ACTIVE
d07a162a-6767-41a2-8f2f-d9ac2a6b27a3	invoice.cancel	invoice_management	invoice	cancel	Cancel invoices	\N	t	2026-08-18 12:19:41.563+06	2026-08-25 08:59:41.21+06	ACTIVE
65a7a1c3-91c1-4d45-8c3e-61f6feb2ca4f	platform.role.assign	platform	role	assign	Assign platform role	Assign or remove roles from platform staff.	t	2026-08-09 11:26:19.018+06	2026-08-10 11:38:00.431+06	ACTIVE
687af476-02d9-45d5-a7e0-dcff0d3b2fde	company.create	company	company	create	Create company	Create and onboard a new company.	t	2026-08-09 11:26:19.027+06	2026-08-10 11:38:00.438+06	ACTIVE
2c78e27c-7f19-496c-869c-c85cc20c95a4	company.read	company	company	read	View companies	View company profiles and operational information.	t	2026-08-09 11:26:19.035+06	2026-08-10 11:38:00.446+06	ACTIVE
8f6b1380-9809-46e0-aa8d-115f17436625	company.update	company	company	update	Update company	Update company information.	t	2026-08-09 11:26:19.042+06	2026-08-10 11:38:00.45+06	ACTIVE
15c5a117-5693-468d-894f-96399ed31d85	company.suspend	company	company	suspend	Suspend company	Suspend or reactivate a company.	t	2026-08-09 11:26:19.047+06	2026-08-10 11:38:00.455+06	ACTIVE
40deb2aa-a584-48f3-8cda-43c340ce7563	subscription.assign	subscription	subscription	assign	Assign subscription	Assign a subscription plan to a company.	t	2026-08-09 11:26:19.052+06	2026-08-10 11:38:00.461+06	ACTIVE
ac49826d-c20a-4153-8e01-ae0b3b0fadef	subscription.read	subscription	subscription	read	View subscriptions	View company subscriptions.	t	2026-08-09 11:26:19.056+06	2026-08-10 11:38:00.467+06	ACTIVE
041fb03f-1cf9-4eb6-bd4b-5d3b8969f789	subscription.update	subscription	subscription	update	Update subscription	Upgrade, downgrade, renew, or cancel a subscription.	t	2026-08-09 11:26:19.061+06	2026-08-10 11:38:00.469+06	ACTIVE
d02efe5b-3237-4d36-a13a-d65b387a7e50	invoice.void	invoice_management	invoice	void	Void invoices	\N	t	2026-08-18 12:19:41.566+06	2026-08-25 08:59:41.213+06	ACTIVE
731918d2-aede-40a1-9dbc-4e850885320e	support.read	support	support	read	View support cases	View company support requests.	t	2026-08-09 11:26:19.086+06	2026-08-10 11:38:00.492+06	ACTIVE
7ee3f6fc-3d86-46e7-8531-b563dd07d645	support.manage	support	support	manage	Manage support cases	Respond to, assign, update, and resolve support cases.	t	2026-08-09 11:26:19.093+06	2026-08-10 11:38:00.496+06	ACTIVE
9b642284-ca15-4d3c-907e-9c9683fe83f4	platform.staff.deactivate	platform	staff	deactivate	Deactivate platform staff	Deactivate a platform staff account.	t	2026-08-09 11:26:18.99+06	2026-08-10 11:38:00.409+06	ACTIVE
d30c100a-b465-40c0-a209-9af4e44cd0a7	billing.collect	billing	billing	collect	Collect payment	Record or collect subscription payments.	t	2026-08-09 11:26:19.074+06	2026-08-10 11:38:00.476+06	ACTIVE
6209cfe1-b3f3-49fb-b87d-ea6e11a25e12	billing.refund	billing	billing	refund	Process refund	Process an eligible payment refund.	t	2026-08-09 11:26:19.081+06	2026-08-10 11:38:00.481+06	ACTIVE
490498e0-c293-40b2-993c-6a3093d03efd	audit.read	audit	audit	read	View audit logs	View platform and company audit logs.	t	2026-08-09 11:26:19.1+06	2026-08-10 11:38:00.501+06	ACTIVE
60efcaab-f139-4f40-a0d6-8e3ef8617fec	company.staff.create	company	staff	create	Create company staff	Invite or create staff within a company.	t	2026-08-09 11:26:19.107+06	2026-08-10 11:38:00.506+06	ACTIVE
39b5ac83-949f-4d30-afcf-27c4f93df489	company.staff.read	company	staff	read	View company staff	View staff belonging to the current company.	t	2026-08-09 11:26:19.114+06	2026-08-10 11:38:00.515+06	ACTIVE
9ae62dea-3098-4e8a-aa65-7a3d3421a693	company.staff.update	company	staff	update	Update company staff	Update staff belonging to the current company.	t	2026-08-09 11:26:19.121+06	2026-08-10 11:38:00.523+06	ACTIVE
2dd86611-ae5b-4537-8143-b551f1f2ffc3	company.staff.deactivate	company	staff	deactivate	Deactivate company staff	Deactivate staff within the current company.	t	2026-08-09 11:26:19.128+06	2026-08-10 11:38:00.532+06	ACTIVE
cc366258-3d02-4cc9-a771-a5f1af0a27f4	company.role.read	company	role	read	View company roles	View company roles and their permissions.	t	2026-08-09 11:26:19.14+06	2026-08-10 11:38:00.545+06	ACTIVE
adac1d14-e27d-419f-aebb-09132bfbdd2f	company.role.assign	company	role	assign	Assign company role	Assign or remove roles from company staff.	t	2026-08-09 11:26:19.152+06	2026-08-10 11:38:00.555+06	ACTIVE
fe87dcbc-0f4c-4fc6-bbe4-f75e75b8d461	platform.role.permission.assign	platform_access	role	permission_assign	Assign platform role permissions	\N	t	2026-08-10 06:21:17.396+06	2026-08-25 08:59:41.122+06	ACTIVE
1f7f0d81-ed57-4f0a-9ffe-09c20bbcb49d	platform.company.read	company_management	company	read	Read companies	\N	t	2026-08-17 12:30:45.152+06	2026-08-25 08:59:41.124+06	ACTIVE
b41dbd05-7235-4e24-a9a1-14c9dc6f3c58	platform.company.create	company_management	company	create	Create companies	\N	t	2026-08-17 12:30:45.162+06	2026-08-25 08:59:41.126+06	ACTIVE
e11d9e2d-a4e2-489b-8d66-f0cc97ab898a	platform.company.update	company_management	company	update	Update companies	\N	t	2026-08-17 12:30:45.167+06	2026-08-25 08:59:41.128+06	ACTIVE
882da7cf-1d50-4add-9b60-1158c4d923d5	platform.company.status	company_management	company	status	Change company status	\N	t	2026-08-17 12:30:45.172+06	2026-08-25 08:59:41.13+06	ACTIVE
71425a3a-0c3d-4165-ac2f-5ea2fa6526a7	platform.company.activate	company_management	company	activate	Activate companies	\N	t	2026-08-17 12:30:45.174+06	2026-08-25 08:59:41.131+06	ACTIVE
54c0b7b2-1f90-47d4-9da9-06850ed7cec6	platform.company.suspend	company_management	company	suspend	Suspend companies	\N	t	2026-08-17 12:30:45.179+06	2026-08-25 08:59:41.133+06	ACTIVE
299a8e23-2ea4-48d0-8d21-bd4b3a4b38e3	platform.company.owner.read	company_management	company_owner	read	Read company owners	\N	t	2026-08-17 12:30:45.184+06	2026-08-25 08:59:41.134+06	ACTIVE
dd22589b-1e15-44ef-98d8-432998485bb6	platform.company.owner.create	company_management	company_owner	create	Create company owners	\N	t	2026-08-17 12:30:45.189+06	2026-08-25 08:59:41.136+06	ACTIVE
ec7ed3c7-9cb6-43a4-8e5e-238a49055230	company.owner.create	company	owner	create	Create company owner	Create or assign a user as the primary owner of a company.	t	2026-08-10 11:38:00.56+06	2026-08-10 11:38:00.56+06	ACTIVE
6686e516-2da5-4829-8fcd-19a2abe317d5	company.owner.read	company	owner	read	View company owners	View company owners and ownership information of a company.	t	2026-08-10 11:38:00.572+06	2026-08-10 11:38:00.572+06	ACTIVE
17fa3c09-0bfb-4b02-8045-dbaa915e5c15	company.owner.update	company	owner	update	Update company owner	Update company owner account and membership information.	t	2026-08-10 11:38:00.576+06	2026-08-10 11:38:00.576+06	ACTIVE
2891ccca-da11-4727-8d8e-6beffb219ba1	company.owner.change	company	owner	change	Change company owner	Transfer primary ownership of a company to another active member.	t	2026-08-10 11:38:00.581+06	2026-08-10 11:38:00.581+06	ACTIVE
a7e37444-37da-4286-91e3-f7c0588c8c89	company.owner.status	company	owner	status	Update company owner status	Update the status of a company owner membership.	t	2026-08-10 11:38:00.587+06	2026-08-10 11:38:00.587+06	ACTIVE
af960c20-df10-4711-8e93-2c9459c84374	platform.company.owner.update	company_management	company_owner	update	Update company owners	\N	t	2026-08-17 12:30:45.196+06	2026-08-25 08:59:41.137+06	ACTIVE
77d5cab6-045d-4f39-8378-4fb36eca0933	platform.company.owner.change	company_management	company_owner	change	Change company owner	\N	t	2026-08-17 12:30:45.201+06	2026-08-25 08:59:41.138+06	ACTIVE
99bf7d4b-ac25-4f82-b0da-91b6b49fbcef	platform.company.owner.status	company_management	company_owner	status	Change company owner status	\N	t	2026-08-17 12:30:45.206+06	2026-08-25 08:59:41.14+06	ACTIVE
5522d948-2798-43ce-b6a7-b8c0dbed2e95	invoice.mark_paid	invoice_management	invoice	mark_paid	Mark invoices as paid	\N	t	2026-08-18 12:19:41.567+06	2026-08-25 08:59:41.215+06	ACTIVE
f928225a-b4e2-4820-955b-0223531a8ecf	payment.read	payment_management	payment	read	Read payments	\N	t	2026-08-19 05:03:17.635+06	2026-08-25 08:59:41.217+06	ACTIVE
e86b3c6b-93cd-417a-92b4-6ae381c66e5a	payment.verify	payment_management	payment	verify	Manually verify/reconcile payments	\N	t	2026-08-19 05:03:17.637+06	2026-08-25 08:59:41.218+06	ACTIVE
deac256c-e495-4ed6-92d4-fb1a3c6abbb3	payment.cancel	payment_management	payment	cancel	Cancel payments	\N	t	2026-08-19 05:03:17.639+06	2026-08-25 08:59:41.22+06	ACTIVE
33dfe5e1-53ae-4223-909c-ce1db2004540	company.rbac.bootstrap	platform_access	company_rbac	bootstrap	Bootstrap company RBAC	\N	t	2026-08-10 06:21:17.398+06	2026-08-25 08:59:41.222+06	ACTIVE
9b393839-4515-4f54-a3ce-b75ddba2dc55	platform.feature.create	feature_management	feature	create	Create features	\N	t	2026-08-17 12:30:45.288+06	2026-08-25 08:59:41.224+06	ACTIVE
294a1318-11d7-4666-8050-250b32ebe128	plan.pricing.read	plan_pricing	plan_price	read	Read plan prices	\N	t	2026-08-17 12:30:45.326+06	2026-08-25 08:59:41.237+06	ACTIVE
7c1242cf-8aaf-4ee4-97d8-082bb1a4df14	plan.pricing.update	plan_pricing	plan_price	update	Update plan prices	\N	t	2026-08-17 12:30:45.331+06	2026-08-25 08:59:41.239+06	ACTIVE
8b2d22d1-1050-4e1a-997f-6cc610965950	plan.pricing.status	plan_pricing	plan_price	status	Change plan price status	\N	t	2026-08-17 12:30:45.336+06	2026-08-25 08:59:41.24+06	ACTIVE
873ed45c-c668-4c4f-9432-8eda27e463c3	platform.plan.read	plan_management	plan	read	Read plans	\N	t	2026-08-17 12:30:45.341+06	2026-08-25 08:59:41.241+06	ACTIVE
0c3796b4-8f25-460b-8648-b2a0d832bd66	platform.plan.create	plan_management	plan	create	Create plans	\N	t	2026-08-17 12:30:45.346+06	2026-08-25 08:59:41.242+06	ACTIVE
acb9d3cf-e8c9-4a12-9f20-1f7f8c00454b	platform.plan.update	plan_management	plan	update	Update plans	\N	t	2026-08-17 12:30:45.351+06	2026-08-25 08:59:41.245+06	ACTIVE
e4ab9a16-bed7-4f2c-92a5-178849a0a642	platform.plan.status	plan_management	plan	status	Change plan status	\N	t	2026-08-17 12:30:45.356+06	2026-08-25 08:59:41.247+06	ACTIVE
36b48beb-1dcc-456a-b212-3adc341edd62	platform.plan.archive	plan_management	plan	archive	Archive plans	\N	t	2026-08-17 12:30:45.36+06	2026-08-25 08:59:41.248+06	ACTIVE
04a3411b-fe73-489c-b696-16b63d8d4cce	platform.plan.feature.read	plan_management	plan_feature	read	Read plan features	\N	t	2026-08-17 12:30:45.365+06	2026-08-25 08:59:41.249+06	ACTIVE
2d30bc30-575f-4489-b25a-bd1825a1e668	platform.plan.feature.assign	plan_management	plan_feature	assign	Assign features to plans	\N	t	2026-08-17 12:30:45.37+06	2026-08-25 08:59:41.251+06	ACTIVE
b93741cd-dde1-40c9-ac1e-35fe6da1acb1	platform.plan.feature.update	plan_management	plan_feature	update	Update plan feature assignments	\N	t	2026-08-17 12:30:45.375+06	2026-08-25 08:59:41.252+06	ACTIVE
55aa4679-287f-434c-bea6-b992ce34cccb	platform.plan.feature.remove	plan_management	plan_feature	remove	Remove features from plans	\N	t	2026-08-17 12:30:45.38+06	2026-08-25 08:59:41.253+06	ACTIVE
75d28702-6f9d-4081-93d2-9125cd113135	subscription:create	subscription_management	subscription	create	Create platform subscriptions	\N	t	2026-08-17 12:30:45.385+06	2026-08-25 08:59:41.254+06	ACTIVE
8ef53f4b-c36e-46d0-ba3a-bd2cfce45da2	subscription:read	subscription_management	subscription	read	Read platform subscriptions	\N	t	2026-08-17 12:30:45.391+06	2026-08-25 08:59:41.255+06	ACTIVE
c6a2c637-8856-417f-bdcf-c470bb1900ad	platform.tenant.create	tenant_management	tenant	create	Create tenants	\N	t	2026-08-17 12:30:45.213+06	2026-08-25 08:59:41.141+06	ACTIVE
7a0670a5-fadd-4828-b6e6-396286b24e5f	platform.tenant.read	tenant_management	tenant	read	Read tenants	\N	t	2026-08-17 12:30:45.218+06	2026-08-25 08:59:41.151+06	ACTIVE
43d26917-db19-4f54-8e3a-b38bf2b08489	platform.tenant.update	tenant_management	tenant	update	Update tenants	\N	t	2026-08-17 12:30:45.223+06	2026-08-25 08:59:41.154+06	ACTIVE
730509b6-e21b-4ae7-bdf4-1761b6542485	platform.tenant.status	tenant_management	tenant	status	Change tenant status	\N	t	2026-08-17 12:30:45.231+06	2026-08-25 08:59:41.158+06	ACTIVE
28fc1bed-c7d9-488f-8330-e3b7b00d3da5	platform.tenant.delete	tenant_management	tenant	delete	Delete tenants	\N	t	2026-08-17 12:30:45.235+06	2026-08-25 08:59:41.162+06	ACTIVE
e604221b-3f6b-40b8-a680-42a23585b3d8	platform.industry.read	industry_management	industry	read	Read industries	\N	t	2026-08-17 12:30:45.24+06	2026-08-25 08:59:41.165+06	ACTIVE
1c5de605-8940-40df-85c4-02a9b23ef8d9	platform.industry.create	industry_management	industry	create	Create industries	\N	t	2026-08-17 12:30:45.245+06	2026-08-25 08:59:41.166+06	ACTIVE
32cb710d-4826-4975-ba31-d147217c8a05	platform.industry.update	industry_management	industry	update	Update industries	\N	t	2026-08-17 12:30:45.25+06	2026-08-25 08:59:41.168+06	ACTIVE
752b439d-8f80-4714-ab51-37d29a3c3ab5	platform.feature.read	feature_management	feature	read	Read features	\N	t	2026-08-17 12:30:45.292+06	2026-08-25 08:59:41.226+06	ACTIVE
0c500626-3ebc-4349-83c7-ec4ee63298c5	platform.feature.update	feature_management	feature	update	Update features	\N	t	2026-08-17 12:30:45.299+06	2026-08-25 08:59:41.228+06	ACTIVE
fe430edd-3662-44f1-b254-a43d5826a5e9	platform.feature.status	feature_management	feature	status	Change feature status	\N	t	2026-08-17 12:30:45.304+06	2026-08-25 08:59:41.23+06	ACTIVE
ca1b775f-3f27-4549-aa9c-94391adb1752	platform.feature.activate	feature_management	feature	activate	Activate features	\N	t	2026-08-17 12:30:45.309+06	2026-08-25 08:59:41.232+06	ACTIVE
aec9e3ff-ff4f-4f16-bfbf-14826ff37446	platform.feature.deactivate	feature_management	feature	deactivate	Deactivate features	\N	t	2026-08-17 12:30:45.311+06	2026-08-25 08:59:41.234+06	ACTIVE
2d2cd6ef-4da8-4d7e-88d4-287aec27f06d	platform.feature.archive	feature_management	feature	archive	Archive features	\N	t	2026-08-17 12:30:45.316+06	2026-08-25 08:59:41.235+06	ACTIVE
cf2e90fa-b57e-45b0-9324-df4b3189c009	plan.pricing.create	plan_pricing	plan_price	create	Create plan prices	\N	t	2026-08-17 12:30:45.321+06	2026-08-25 08:59:41.236+06	ACTIVE
45ab9255-3f42-4f8f-861d-4bc6829fc946	subscription:update	subscription_management	subscription	update	Update platform subscriptions	\N	t	2026-08-17 12:30:45.397+06	2026-08-25 08:59:41.262+06	ACTIVE
5deae01c-7be6-4523-9cf3-2e6409126914	subscription:change-plan	subscription_management	subscription	change_plan	Change platform subscription plan	\N	t	2026-08-17 12:30:45.402+06	2026-08-25 08:59:41.264+06	ACTIVE
c47ff2b0-1110-49fb-93ef-34133aff6015	subscription:cancel	subscription_management	subscription	cancel	Cancel platform subscriptions	\N	t	2026-08-17 12:30:45.408+06	2026-08-25 08:59:41.265+06	ACTIVE
9b7167e8-5732-475a-8d78-53017cc770af	subscription:renew	subscription_management	subscription	renew	Renew platform subscriptions	\N	t	2026-08-17 12:30:45.409+06	2026-08-25 08:59:41.266+06	ACTIVE
b84deaab-62d6-4adf-97d1-12b74063e09a	subscription:suspend	subscription_management	subscription	suspend	Suspend platform subscriptions	\N	t	2026-08-17 12:30:45.411+06	2026-08-25 08:59:41.268+06	ACTIVE
e2dabf75-cf53-418a-8735-f19eab7187b3	subscription:reactivate	subscription_management	subscription	reactivate	Reactivate platform subscriptions	\N	t	2026-08-17 12:30:45.413+06	2026-08-25 08:59:41.269+06	ACTIVE
c39440f7-4ca5-4fcd-b25e-48f2d1088c70	subscription:expire	subscription_management	subscription	expire	Expire platform subscriptions	\N	t	2026-08-17 12:30:45.415+06	2026-08-25 08:59:41.27+06	ACTIVE
86f2978f-3cb2-4f46-999a-e9f5b5c21109	company.rbac.read	company_access	rbac	read	Read company RBAC	\N	t	2026-08-10 06:21:17.401+06	2026-08-25 08:59:41.271+06	ACTIVE
cdec28cd-2e0f-411a-8589-26ee171caea4	company.role.create	company_access	role	create	Create company roles	Create a custom role within the current company.	t	2026-08-09 11:26:19.133+06	2026-08-25 08:59:41.272+06	ACTIVE
ebaae0de-5aa4-4777-8957-bbfd90239994	platform.role.status	platform_access	role	status	Change platform role status	\N	t	2026-08-20 07:56:35.982+06	2026-08-25 08:59:41.121+06	ACTIVE
344923fb-737b-4143-bc77-abab3011206f	platform.industry.activate	industry_management	industry	activate	Activate industries	\N	t	2026-08-17 12:30:45.26+06	2026-08-25 08:59:41.171+06	ACTIVE
1a20b484-b472-49cf-ae56-7f10a03d2766	platform.industry.deactivate	industry_management	industry	deactivate	Deactivate industries	\N	t	2026-08-17 12:30:45.265+06	2026-08-25 08:59:41.173+06	ACTIVE
98882adb-5b28-4c64-a183-dcbde2853eea	platform.industry.delete	industry_management	industry	delete	Delete industries	\N	t	2026-08-17 12:30:45.274+06	2026-08-25 08:59:41.174+06	ACTIVE
96565f5e-07fa-405a-810b-78dc37b82ebf	billing.create	billing_management	billing	create	Create billing records	\N	t	2026-08-17 12:31:45.699+06	2026-08-25 08:59:41.176+06	ACTIVE
1659e27a-4229-4499-b2f4-ce173934c01a	billing.read	billing_management	billing	read	Read billing records	View billing, invoices, and payment information.	t	2026-08-09 11:26:19.067+06	2026-08-25 08:59:41.178+06	ACTIVE
35e41ac2-5944-4f9b-8edf-57d3ab60bd20	billing.process	billing_management	billing	process	Process billing charges	\N	t	2026-08-17 12:31:45.714+06	2026-08-25 08:59:41.18+06	ACTIVE
bcf3a1e0-3eee-4765-810f-95037f04f313	billing.retry	billing_management	billing	retry	Retry failed billing charges	\N	t	2026-08-17 12:31:45.722+06	2026-08-25 08:59:41.181+06	ACTIVE
ba3747cc-6e7b-4e0e-ae0a-6153825c8e5b	billing.cancel	billing_management	billing	cancel	Cancel billing records	\N	t	2026-08-17 12:31:45.729+06	2026-08-25 08:59:41.182+06	ACTIVE
f51db118-413e-48d6-96b2-c54c9da7c2b5	billing.skip	billing_management	billing	skip	Skip billing records	\N	t	2026-08-17 12:31:45.738+06	2026-08-25 08:59:41.183+06	ACTIVE
87d8a365-44ef-4f87-8ff4-91d1d77cf95e	company.role.update	company_access	role	update	Update company roles	Update a company role and its permissions.	t	2026-08-09 11:26:19.147+06	2026-08-25 08:59:41.274+06	ACTIVE
70cf65f8-677b-430d-80a9-ded8069466b3	company.role.permission.assign	company_access	role	permission_assign	Assign company role permissions	\N	t	2026-08-10 06:21:17.419+06	2026-08-25 08:59:41.275+06	ACTIVE
e7a58f9c-e777-4a98-abe5-e7b2509f6178	company.member.read	company_access	member	read	Read company members	\N	t	2026-08-10 06:21:17.421+06	2026-08-25 08:59:41.276+06	ACTIVE
af4b127e-77a4-4423-8cd2-57d7fdea1326	company.member.create	company_access	member	create	Create company members	\N	t	2026-08-10 06:21:17.424+06	2026-08-25 08:59:41.278+06	ACTIVE
af15c184-ddca-4ddf-97f7-2d2d15f53934	company.member.update	company_access	member	update	Update company members	\N	t	2026-08-10 06:21:17.425+06	2026-08-25 08:59:41.28+06	ACTIVE
b5ac9d67-0eac-4962-b8cd-74f7ca854854	company.member.role.assign	company_access	member	role_assign	Assign company member roles	\N	t	2026-08-10 06:21:17.427+06	2026-08-25 08:59:41.282+06	ACTIVE
0585feba-1f8d-4090-a5d8-f2d50b9164ff	company.member.scope.assign	company_access	member	scope_assign	Assign company member scopes	\N	t	2026-08-10 06:21:17.43+06	2026-08-25 08:59:41.283+06	ACTIVE
d1ed2f9e-a9eb-4dc6-b09f-3eeb65d8e263	company.subscription.read	company_subscription	subscription	read	Read own company subscription	\N	t	2026-08-17 12:30:45.454+06	2026-08-25 08:59:41.284+06	ACTIVE
6571f856-2cd7-42a9-820e-831de745f19a	company.subscription.auto-renew	company_subscription	subscription	auto_renew	Update own company subscription auto-renew	\N	t	2026-08-17 12:30:45.459+06	2026-08-25 08:59:41.286+06	ACTIVE
522363a9-a9cc-4d12-8d08-11e3a498851f	company.subscription.change-plan	company_subscription	subscription	change_plan	Change own company subscription plan	\N	t	2026-08-17 12:30:45.464+06	2026-08-25 08:59:41.287+06	ACTIVE
5bb40d60-b9ae-4374-ae43-ce2c997852b5	company.subscription.cancel	company_subscription	subscription	cancel	Cancel own company subscription	\N	t	2026-08-17 12:30:45.469+06	2026-08-25 08:59:41.288+06	ACTIVE
2b90689d-8ea3-459b-88d3-4488b53766f4	company.subscription.reactivate	company_subscription	subscription	reactivate	Reactivate own company subscription	\N	t	2026-08-17 12:30:45.474+06	2026-08-25 08:59:41.29+06	ACTIVE
36fc5d61-6507-4a1b-927b-94a46e7d0a99	company.invoice.read	company_invoice	invoice	read	Read own company invoices	\N	t	2026-08-18 12:19:41.649+06	2026-08-25 08:59:41.291+06	ACTIVE
b66dbc31-15cd-400c-be52-5c61f5b5a06a	company.payment.create	company_payment	payment	create	Initiate payment for own company invoice	\N	t	2026-08-19 05:03:17.722+06	2026-08-25 08:59:41.292+06	ACTIVE
20cecd6d-5d03-4f11-9d29-859062b5ecf5	company.payment.read	company_payment	payment	read	Read own company payments	\N	t	2026-08-19 05:03:17.734+06	2026-08-25 08:59:41.294+06	ACTIVE
\.


--
-- Data for Name: plan_features; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.plan_features ("planId", "featureId", enabled, limits, "createdAt", "updatedAt") FROM stdin;
225c1374-d952-4e8c-8d47-503e2515d26e	b4994c7f-ad92-463f-81f0-28bb8b8d7014	t	{}	2026-08-22 11:34:38.169+06	2026-08-22 11:34:38.169+06
794b6c06-55a9-427c-ae40-874d7628158c	b4994c7f-ad92-463f-81f0-28bb8b8d7014	t	{}	2026-08-25 04:42:27.587+06	2026-08-25 04:42:27.587+06
\.


--
-- Data for Name: plan_prices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.plan_prices (id, "planId", "billingCycle", "currencyCode", amount, "effectiveFrom", "effectiveTo", "isActive", "createdAt") FROM stdin;
eb8568a9-c2ec-42c2-a360-e502a01d1872	225c1374-d952-4e8c-8d47-503e2515d26e	MONTHLY	BDT	2.0000	2026-08-22 11:33:08.435+06	\N	t	2026-08-22 11:33:08.445+06
71a228dc-3769-43c1-ad0f-a760eae8f13f	225c1374-d952-4e8c-8d47-503e2515d26e	YEARLY	BDT	4.0000	2026-08-22 11:33:28.361+06	\N	t	2026-08-22 11:33:28.364+06
3c5af4bb-a889-4212-b505-bf371786fda8	794b6c06-55a9-427c-ae40-874d7628158c	MONTHLY	BDT	3.0000	2026-08-25 04:41:57.89+06	\N	t	2026-08-25 04:41:57.895+06
84ea5c39-80f4-4b70-87a6-efa2a09f1004	794b6c06-55a9-427c-ae40-874d7628158c	YEARLY	BDT	6.0000	2026-08-25 04:42:10.732+06	\N	t	2026-08-25 04:42:10.736+06
\.


--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.plans (id, code, name, description, "trialDays", "isPublic", status, "createdAt", "updatedAt", "isDefaultTrial") FROM stdin;
ea3df633-994b-4022-934a-65ea50508089	BASIC	basic	\N	0	t	ACTIVE	2026-08-22 11:30:11.096+06	2026-08-22 11:30:11.096+06	f
225c1374-d952-4e8c-8d47-503e2515d26e	PRO	pro	\N	0	t	ACTIVE	2026-08-22 11:30:47.742+06	2026-08-22 11:30:47.742+06	f
794b6c06-55a9-427c-ae40-874d7628158c	MEDIUM	medium	\N	1	t	ACTIVE	2026-08-22 11:30:34.475+06	2026-08-27 07:27:20.11+06	t
\.


--
-- Data for Name: platform_member_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.platform_member_roles ("platformMemberId", "platformRoleId", "assignedAt", "assignedByUserId") FROM stdin;
85a18049-a38a-4b9c-9e00-0e387bf3ec01	14424a22-96e3-48ed-aa9b-d5853ce551c0	2026-08-09 08:17:10.156+06	774bb094-6628-422a-beaf-dc0ae9e50984
\.


--
-- Data for Name: platform_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.platform_members (id, "userId", "employeeCode", status, "invitedAt", "activatedAt", "createdAt", "updatedAt") FROM stdin;
85a18049-a38a-4b9c-9e00-0e387bf3ec01	774bb094-6628-422a-beaf-dc0ae9e50984	SA-001	ACTIVE	2026-08-09 08:17:10.053+06	2026-08-22 05:16:14.968+06	2026-08-09 08:17:10.089+06	2026-08-22 05:16:14.979+06
\.


--
-- Data for Name: platform_role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.platform_role_permissions ("platformRoleId", "permissionId", effect, conditions, "assignedAt", "assignedByUserId") FROM stdin;
4c71e5a6-891f-4f31-a7ef-3d395bacf0b6	1659e27a-4229-4499-b2f4-ce173934c01a	ALLOW	\N	2026-08-09 11:26:19.324+06	\N
3675f3ae-4ae9-4218-ac6c-a6182d35029f	1659e27a-4229-4499-b2f4-ce173934c01a	ALLOW	\N	2026-08-09 11:26:19.339+06	\N
eaa0aa1b-9e98-419f-b81f-a22e4f3aa071	98b24f78-db1c-458f-884c-39789505aa9d	ALLOW	\N	2026-08-20 09:55:44.563+06	774bb094-6628-422a-beaf-dc0ae9e50984
eaa0aa1b-9e98-419f-b81f-a22e4f3aa071	1155a9fd-94f4-45c1-b0c5-ff2f01037489	ALLOW	\N	2026-08-20 09:55:44.563+06	774bb094-6628-422a-beaf-dc0ae9e50984
eaa0aa1b-9e98-419f-b81f-a22e4f3aa071	1f7f0d81-ed57-4f0a-9ffe-09c20bbcb49d	ALLOW	\N	2026-08-20 09:55:44.563+06	774bb094-6628-422a-beaf-dc0ae9e50984
eaa0aa1b-9e98-419f-b81f-a22e4f3aa071	8ef53f4b-c36e-46d0-ba3a-bd2cfce45da2	ALLOW	\N	2026-08-20 09:55:44.563+06	774bb094-6628-422a-beaf-dc0ae9e50984
eaa0aa1b-9e98-419f-b81f-a22e4f3aa071	1659e27a-4229-4499-b2f4-ce173934c01a	ALLOW	\N	2026-08-20 09:55:44.563+06	774bb094-6628-422a-beaf-dc0ae9e50984
cbae115c-516e-4a86-b960-0c62d9d32c8a	98b24f78-db1c-458f-884c-39789505aa9d	ALLOW	\N	2026-08-09 11:26:19.393+06	\N
cbae115c-516e-4a86-b960-0c62d9d32c8a	1155a9fd-94f4-45c1-b0c5-ff2f01037489	ALLOW	\N	2026-08-09 11:26:19.394+06	\N
cbae115c-516e-4a86-b960-0c62d9d32c8a	1659e27a-4229-4499-b2f4-ce173934c01a	ALLOW	\N	2026-08-09 11:26:19.397+06	\N
14424a22-96e3-48ed-aa9b-d5853ce551c0	98b24f78-db1c-458f-884c-39789505aa9d	ALLOW	\N	2026-08-09 11:26:19.263+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	157fb420-ae5d-4c26-bed2-4db6de772026	ALLOW	\N	2026-08-09 11:26:19.249+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	c36ed3e8-0f98-4643-abdc-8c718964db7c	ALLOW	\N	2026-08-09 11:26:19.264+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	a2a5135a-c9b1-4216-98a9-2ad1724902a6	ALLOW	\N	2026-08-17 12:31:46.135+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	86e934ad-00f2-403d-89ec-fb04cafda4dc	ALLOW	\N	2026-08-17 12:31:46.145+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	1155a9fd-94f4-45c1-b0c5-ff2f01037489	ALLOW	\N	2026-08-09 11:26:19.267+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	cd83dc7f-09df-47c2-9f12-77cc6d7cd776	ALLOW	\N	2026-08-09 11:26:19.268+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	fe87dcbc-0f4c-4fc6-bbe4-f75e75b8d461	ALLOW	\N	2026-08-17 12:31:46.15+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	1f7f0d81-ed57-4f0a-9ffe-09c20bbcb49d	ALLOW	\N	2026-08-17 12:31:46.152+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	b41dbd05-7235-4e24-a9a1-14c9dc6f3c58	ALLOW	\N	2026-08-17 12:31:46.155+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	e11d9e2d-a4e2-489b-8d66-f0cc97ab898a	ALLOW	\N	2026-08-17 12:31:46.156+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	882da7cf-1d50-4add-9b60-1158c4d923d5	ALLOW	\N	2026-08-17 12:31:46.158+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	71425a3a-0c3d-4165-ac2f-5ea2fa6526a7	ALLOW	\N	2026-08-17 12:31:46.159+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	54c0b7b2-1f90-47d4-9da9-06850ed7cec6	ALLOW	\N	2026-08-17 12:31:46.16+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	299a8e23-2ea4-48d0-8d21-bd4b3a4b38e3	ALLOW	\N	2026-08-17 12:31:46.161+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	dd22589b-1e15-44ef-98d8-432998485bb6	ALLOW	\N	2026-08-17 12:31:46.162+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	af960c20-df10-4711-8e93-2c9459c84374	ALLOW	\N	2026-08-17 12:31:46.163+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	77d5cab6-045d-4f39-8378-4fb36eca0933	ALLOW	\N	2026-08-17 12:31:46.165+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	99bf7d4b-ac25-4f82-b0da-91b6b49fbcef	ALLOW	\N	2026-08-17 12:31:46.166+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	c6a2c637-8856-417f-bdcf-c470bb1900ad	ALLOW	\N	2026-08-17 12:31:46.166+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	7a0670a5-fadd-4828-b6e6-396286b24e5f	ALLOW	\N	2026-08-17 12:31:46.167+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	43d26917-db19-4f54-8e3a-b38bf2b08489	ALLOW	\N	2026-08-17 12:31:46.168+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	730509b6-e21b-4ae7-bdf4-1761b6542485	ALLOW	\N	2026-08-17 12:31:46.169+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	28fc1bed-c7d9-488f-8330-e3b7b00d3da5	ALLOW	\N	2026-08-17 12:31:46.171+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	e604221b-3f6b-40b8-a680-42a23585b3d8	ALLOW	\N	2026-08-17 12:31:46.172+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	1c5de605-8940-40df-85c4-02a9b23ef8d9	ALLOW	\N	2026-08-17 12:31:46.172+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	32cb710d-4826-4975-ba31-d147217c8a05	ALLOW	\N	2026-08-17 12:31:46.173+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	78b64cf1-9944-4a96-887a-9e846aa209e6	ALLOW	\N	2026-08-17 12:31:46.174+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	344923fb-737b-4143-bc77-abab3011206f	ALLOW	\N	2026-08-17 12:31:46.175+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	1a20b484-b472-49cf-ae56-7f10a03d2766	ALLOW	\N	2026-08-17 12:31:46.175+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	0159031e-3e9b-49f0-bcea-8dbc18391a26	ALLOW	\N	2026-08-18 06:58:36.515+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	38711999-7de3-4d4f-adc4-230e879a269a	ALLOW	\N	2026-08-18 06:58:36.522+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	36b48beb-1dcc-456a-b212-3adc341edd62	ALLOW	\N	2026-08-17 12:31:46.201+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	04a3411b-fe73-489c-b696-16b63d8d4cce	ALLOW	\N	2026-08-17 12:31:46.202+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	98882adb-5b28-4c64-a183-dcbde2853eea	ALLOW	\N	2026-08-17 12:31:46.176+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	33dfe5e1-53ae-4223-909c-ce1db2004540	ALLOW	\N	2026-08-17 12:31:46.178+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	cf2e90fa-b57e-45b0-9324-df4b3189c009	ALLOW	\N	2026-08-17 12:31:46.179+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	294a1318-11d7-4666-8050-250b32ebe128	ALLOW	\N	2026-08-17 12:31:46.179+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	7c1242cf-8aaf-4ee4-97d8-082bb1a4df14	ALLOW	\N	2026-08-17 12:31:46.18+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	8b2d22d1-1050-4e1a-997f-6cc610965950	ALLOW	\N	2026-08-17 12:31:46.181+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	75d28702-6f9d-4081-93d2-9125cd113135	ALLOW	\N	2026-08-17 12:31:46.182+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	8ef53f4b-c36e-46d0-ba3a-bd2cfce45da2	ALLOW	\N	2026-08-17 12:31:46.183+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	45ab9255-3f42-4f8f-861d-4bc6829fc946	ALLOW	\N	2026-08-17 12:31:46.183+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	5deae01c-7be6-4523-9cf3-2e6409126914	ALLOW	\N	2026-08-17 12:31:46.184+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	c47ff2b0-1110-49fb-93ef-34133aff6015	ALLOW	\N	2026-08-17 12:31:46.185+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	9b7167e8-5732-475a-8d78-53017cc770af	ALLOW	\N	2026-08-17 12:31:46.186+06	774bb094-6628-422a-beaf-dc0ae9e50984
4c71e5a6-891f-4f31-a7ef-3d395bacf0b6	b41dbd05-7235-4e24-a9a1-14c9dc6f3c58	ALLOW	\N	2026-08-17 12:31:46.242+06	\N
4c71e5a6-891f-4f31-a7ef-3d395bacf0b6	1f7f0d81-ed57-4f0a-9ffe-09c20bbcb49d	ALLOW	\N	2026-08-17 12:31:46.243+06	\N
4c71e5a6-891f-4f31-a7ef-3d395bacf0b6	e11d9e2d-a4e2-489b-8d66-f0cc97ab898a	ALLOW	\N	2026-08-17 12:31:46.243+06	\N
4c71e5a6-891f-4f31-a7ef-3d395bacf0b6	75d28702-6f9d-4081-93d2-9125cd113135	ALLOW	\N	2026-08-17 12:31:46.244+06	\N
4c71e5a6-891f-4f31-a7ef-3d395bacf0b6	8ef53f4b-c36e-46d0-ba3a-bd2cfce45da2	ALLOW	\N	2026-08-17 12:31:46.245+06	\N
4c71e5a6-891f-4f31-a7ef-3d395bacf0b6	45ab9255-3f42-4f8f-861d-4bc6829fc946	ALLOW	\N	2026-08-17 12:31:46.245+06	\N
3675f3ae-4ae9-4218-ac6c-a6182d35029f	1f7f0d81-ed57-4f0a-9ffe-09c20bbcb49d	ALLOW	\N	2026-08-17 12:31:46.261+06	\N
3675f3ae-4ae9-4218-ac6c-a6182d35029f	8ef53f4b-c36e-46d0-ba3a-bd2cfce45da2	ALLOW	\N	2026-08-17 12:31:46.262+06	\N
14424a22-96e3-48ed-aa9b-d5853ce551c0	b84deaab-62d6-4adf-97d1-12b74063e09a	ALLOW	\N	2026-08-17 12:31:46.187+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	e2dabf75-cf53-418a-8735-f19eab7187b3	ALLOW	\N	2026-08-17 12:31:46.188+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	c39440f7-4ca5-4fcd-b25e-48f2d1088c70	ALLOW	\N	2026-08-17 12:31:46.189+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	9b393839-4515-4f54-a3ce-b75ddba2dc55	ALLOW	\N	2026-08-17 12:31:46.19+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	752b439d-8f80-4714-ab51-37d29a3c3ab5	ALLOW	\N	2026-08-17 12:31:46.19+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	0c500626-3ebc-4349-83c7-ec4ee63298c5	ALLOW	\N	2026-08-17 12:31:46.191+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	fe430edd-3662-44f1-b254-a43d5826a5e9	ALLOW	\N	2026-08-17 12:31:46.192+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	ca1b775f-3f27-4549-aa9c-94391adb1752	ALLOW	\N	2026-08-17 12:31:46.192+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	aec9e3ff-ff4f-4f16-bfbf-14826ff37446	ALLOW	\N	2026-08-17 12:31:46.193+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	2d2cd6ef-4da8-4d7e-88d4-287aec27f06d	ALLOW	\N	2026-08-17 12:31:46.194+06	774bb094-6628-422a-beaf-dc0ae9e50984
3675f3ae-4ae9-4218-ac6c-a6182d35029f	35e41ac2-5944-4f9b-8edf-57d3ab60bd20	ALLOW	\N	2026-08-17 12:31:46.263+06	\N
b33eae40-1255-41f6-974b-5033fbded4ed	1f7f0d81-ed57-4f0a-9ffe-09c20bbcb49d	ALLOW	\N	2026-08-20 12:06:47.007+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	96565f5e-07fa-405a-810b-78dc37b82ebf	ALLOW	\N	2026-08-17 12:31:46.194+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	1659e27a-4229-4499-b2f4-ce173934c01a	ALLOW	\N	2026-08-09 11:26:19.276+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	35e41ac2-5944-4f9b-8edf-57d3ab60bd20	ALLOW	\N	2026-08-17 12:31:46.196+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	bcf3a1e0-3eee-4765-810f-95037f04f313	ALLOW	\N	2026-08-17 12:31:46.196+06	774bb094-6628-422a-beaf-dc0ae9e50984
b33eae40-1255-41f6-974b-5033fbded4ed	8ef53f4b-c36e-46d0-ba3a-bd2cfce45da2	ALLOW	\N	2026-08-20 12:06:47.007+06	774bb094-6628-422a-beaf-dc0ae9e50984
cbae115c-516e-4a86-b960-0c62d9d32c8a	1f7f0d81-ed57-4f0a-9ffe-09c20bbcb49d	ALLOW	\N	2026-08-17 12:31:46.314+06	\N
cbae115c-516e-4a86-b960-0c62d9d32c8a	8ef53f4b-c36e-46d0-ba3a-bd2cfce45da2	ALLOW	\N	2026-08-17 12:31:46.315+06	\N
6bc6a835-9459-4fb5-b561-cf8b419a29ca	1f7f0d81-ed57-4f0a-9ffe-09c20bbcb49d	ALLOW	\N	2026-08-17 12:31:46.328+06	\N
6bc6a835-9459-4fb5-b561-cf8b419a29ca	8ef53f4b-c36e-46d0-ba3a-bd2cfce45da2	ALLOW	\N	2026-08-17 12:31:46.328+06	\N
14424a22-96e3-48ed-aa9b-d5853ce551c0	ba3747cc-6e7b-4e0e-ae0a-6153825c8e5b	ALLOW	\N	2026-08-17 12:31:46.197+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	f51db118-413e-48d6-96b2-c54c9da7c2b5	ALLOW	\N	2026-08-17 12:31:46.198+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	873ed45c-c668-4c4f-9432-8eda27e463c3	ALLOW	\N	2026-08-17 12:31:46.198+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	0c3796b4-8f25-460b-8648-b2a0d832bd66	ALLOW	\N	2026-08-17 12:31:46.199+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	acb9d3cf-e8c9-4a12-9f20-1f7f8c00454b	ALLOW	\N	2026-08-17 12:31:46.2+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	e4ab9a16-bed7-4f2c-92a5-178849a0a642	ALLOW	\N	2026-08-17 12:31:46.201+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	11b7604d-5ccb-4b15-94cb-26f16f783db5	ALLOW	\N	2026-08-20 07:56:36.159+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	ebaae0de-5aa4-4777-8957-bbfd90239994	ALLOW	\N	2026-08-20 07:56:36.162+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	04aa886b-d8a3-4ec7-867e-0c8040bf0dc2	ALLOW	\N	2026-08-18 12:19:41.721+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	d59af5c5-49a2-4fb2-bf3d-16688dbfa8fd	ALLOW	\N	2026-08-18 12:19:41.723+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	317c5a47-5de2-4601-908a-c5f96f467f2f	ALLOW	\N	2026-08-18 12:19:41.724+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	d07a162a-6767-41a2-8f2f-d9ac2a6b27a3	ALLOW	\N	2026-08-18 12:19:41.725+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	d02efe5b-3237-4d36-a13a-d65b387a7e50	ALLOW	\N	2026-08-18 12:19:41.726+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	5522d948-2798-43ce-b6a7-b8c0dbed2e95	ALLOW	\N	2026-08-18 12:19:41.728+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	f928225a-b4e2-4820-955b-0223531a8ecf	ALLOW	\N	2026-08-19 05:03:17.813+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	e86b3c6b-93cd-417a-92b4-6ae381c66e5a	ALLOW	\N	2026-08-19 05:03:17.822+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	deac256c-e495-4ed6-92d4-fb1a3c6abbb3	ALLOW	\N	2026-08-19 05:03:17.823+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	2d30bc30-575f-4489-b25a-bd1825a1e668	ALLOW	\N	2026-08-17 12:31:46.204+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	b93741cd-dde1-40c9-ac1e-35fe6da1acb1	ALLOW	\N	2026-08-17 12:31:46.205+06	774bb094-6628-422a-beaf-dc0ae9e50984
14424a22-96e3-48ed-aa9b-d5853ce551c0	55aa4679-287f-434c-bea6-b992ce34cccb	ALLOW	\N	2026-08-17 12:31:46.205+06	774bb094-6628-422a-beaf-dc0ae9e50984
e44e6bb7-5634-4796-89ea-4f52a8fa2d6e	98b24f78-db1c-458f-884c-39789505aa9d	ALLOW	\N	2026-08-09 11:26:19.297+06	774bb094-6628-422a-beaf-dc0ae9e50984
e44e6bb7-5634-4796-89ea-4f52a8fa2d6e	157fb420-ae5d-4c26-bed2-4db6de772026	ALLOW	\N	2026-08-09 11:26:19.296+06	774bb094-6628-422a-beaf-dc0ae9e50984
e44e6bb7-5634-4796-89ea-4f52a8fa2d6e	c36ed3e8-0f98-4643-abdc-8c718964db7c	ALLOW	\N	2026-08-09 11:26:19.298+06	774bb094-6628-422a-beaf-dc0ae9e50984
e44e6bb7-5634-4796-89ea-4f52a8fa2d6e	a2a5135a-c9b1-4216-98a9-2ad1724902a6	ALLOW	\N	2026-08-17 12:31:46.224+06	774bb094-6628-422a-beaf-dc0ae9e50984
e44e6bb7-5634-4796-89ea-4f52a8fa2d6e	86e934ad-00f2-403d-89ec-fb04cafda4dc	ALLOW	\N	2026-08-17 12:31:46.225+06	774bb094-6628-422a-beaf-dc0ae9e50984
e44e6bb7-5634-4796-89ea-4f52a8fa2d6e	1155a9fd-94f4-45c1-b0c5-ff2f01037489	ALLOW	\N	2026-08-09 11:26:19.3+06	774bb094-6628-422a-beaf-dc0ae9e50984
e44e6bb7-5634-4796-89ea-4f52a8fa2d6e	33dfe5e1-53ae-4223-909c-ce1db2004540	ALLOW	\N	2026-08-17 12:31:46.226+06	774bb094-6628-422a-beaf-dc0ae9e50984
\.


--
-- Data for Name: platform_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.platform_roles (id, code, name, description, "createdAt", "updatedAt", "isSystem", status) FROM stdin;
14424a22-96e3-48ed-aa9b-d5853ce551c0	SUPER_ADMIN	Super Admin	Complete administrative access to the DotSkills platform.	2026-08-09 08:17:09.66+06	2026-08-22 05:16:14.385+06	t	ACTIVE
e44e6bb7-5634-4796-89ea-4f52a8fa2d6e	PLATFORM_ADMIN	Platform Admin	Manages platform staff, companies, and subscriptions.	2026-08-09 11:26:19.288+06	2026-08-22 05:16:14.58+06	t	ACTIVE
4c71e5a6-891f-4f31-a7ef-3d395bacf0b6	SALES_MANAGER	Sales Manager	Manages company onboarding and subscription assignment.	2026-08-09 11:26:19.315+06	2026-08-22 05:16:14.601+06	t	ACTIVE
3675f3ae-4ae9-4218-ac6c-a6182d35029f	FINANCE_MANAGER	Finance Manager	Manages billing and collections.	2026-08-09 11:26:19.331+06	2026-08-22 05:16:14.62+06	t	ACTIVE
b33eae40-1255-41f6-974b-5033fbded4ed	SUPPORT_MANAGER	Support Manager	Read-only access for customer support operations.	2026-08-09 11:26:19.35+06	2026-08-22 05:16:14.636+06	t	ACTIVE
eaa0aa1b-9e98-419f-b81f-a22e4f3aa071	COMPLIANCE_OFFICER	Compliance Officer	Monitors companies, subscriptions, and billing.	2026-08-09 11:26:19.366+06	2026-08-22 05:16:14.649+06	t	ACTIVE
cbae115c-516e-4a86-b960-0c62d9d32c8a	AUDITOR	Auditor	Read-only access to business information.	2026-08-09 11:26:19.387+06	2026-08-22 05:16:14.664+06	t	ACTIVE
6bc6a835-9459-4fb5-b561-cf8b419a29ca	PLATFORM_STAFF	Platform Staff	Basic platform staff role with limited read access.	2026-08-09 11:26:19.406+06	2026-08-22 05:16:14.681+06	t	ACTIVE
\.


--
-- Data for Name: subscription_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscription_events (id, "subscriptionId", "tenantId", "companyId", "fromStatus", "toStatus", reason, source, "actorUserId", "idempotencyKey", metadata, "createdAt") FROM stdin;
76229bae-cba1-4de2-9ccb-6923017bd75a	e49f57a0-7342-4181-97e1-ddf2b5bc2320	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	\N	ACTIVE	SUBSCRIPTION_CREATED	API	774bb094-6628-422a-beaf-dc0ae9e50984	\N	\N	2026-08-25 06:26:25.765+06
6eee9d53-c317-452a-be6c-3fedc5ee63f6	e49f57a0-7342-4181-97e1-ddf2b5bc2320	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	ACTIVE	PAST_DUE	PAYMENT_FAILED	PAYMENT	774bb094-6628-422a-beaf-dc0ae9e50984	f81ba5f4-3f34-406a-b6b6-531735e0ef40:attempt:1	\N	2026-08-25 06:39:28.15+06
c5c8b038-71a0-456b-add2-78035ec32516	509dc1a2-0c06-4a9b-b860-e0fed4a0b2c1	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	\N	ACTIVE	SUBSCRIPTION_CREATED	API	774bb094-6628-422a-beaf-dc0ae9e50984	\N	\N	2026-08-25 07:02:06.105+06
928dfd61-b150-4127-8638-d2425992ac91	509dc1a2-0c06-4a9b-b860-e0fed4a0b2c1	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	ACTIVE	ACTIVE	PAYMENT_SUCCEEDED	PAYMENT	3c1bd3c5-8511-413b-8372-95c40f088b3d	eb6d3cbd-7dd9-4ac4-b637-d299495de49d:attempt:1	\N	2026-08-25 07:06:07.066+06
270d3c4a-52d9-4c74-a1d3-3447f7876c39	e49f57a0-7342-4181-97e1-ddf2b5bc2320	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	PAST_DUE	ACTIVE	PAYMENT_SUCCEEDED	PAYMENT	774bb094-6628-422a-beaf-dc0ae9e50984	f81ba5f4-3f34-406a-b6b6-531735e0ef40:attempt:2	\N	2026-08-25 09:07:43.536+06
cb7ada50-3708-471e-9bf3-ed17277471d9	338e8c3e-3cb1-48fa-bdc4-c70dea272fea	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	\N	TRIALING	AUTO_TRIAL_ON_COMPANY_CREATE	SYSTEM	774bb094-6628-422a-beaf-dc0ae9e50984	\N	\N	2026-08-27 07:27:34.11+06
985f9a28-585a-438f-a3b1-d898920d6f1d	338e8c3e-3cb1-48fa-bdc4-c70dea272fea	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	TRIALING	SUSPENDED	live guard test	API	774bb094-6628-422a-beaf-dc0ae9e50984	\N	{"action": "PLATFORM_SUSPEND"}	2026-08-27 07:29:00.031+06
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscriptions (id, "tenantId", "companyId", "planId", status, "billingCycle", "startsAt", "trialEndsAt", "currentPeriodStart", "currentPeriodEnd", "graceEndsAt", "cancelledAt", "autoRenew", "priceSnapshot", "createdAt", "updatedAt", "pastDueEndsAt", "suspendedAt", "suspensionExpiresAt", "isComplimentary") FROM stdin;
509dc1a2-0c06-4a9b-b860-e0fed4a0b2c1	65b4d86b-9ce6-4d78-901c-440b0c0fd721	86531dfa-8018-4f37-a5c3-84cfebe31214	794b6c06-55a9-427c-ae40-874d7628158c	ACTIVE	YEARLY	2026-08-25 07:02:06.08+06	\N	2026-08-25 07:06:07.062+06	2027-08-25 07:06:07.062+06	\N	\N	t	{"amount": "6", "planId": "794b6c06-55a9-427c-ae40-874d7628158c", "planCode": "MEDIUM", "planName": "medium", "capturedAt": "2026-08-25T07:02:06.080Z", "billingCycle": "YEARLY", "currencyCode": "BDT"}	2026-08-25 07:02:06.091+06	2026-08-25 07:06:07.062+06	\N	\N	\N	f
e49f57a0-7342-4181-97e1-ddf2b5bc2320	632bb8a8-f9f9-4093-a903-351e3614fc88	b7cbbf94-491b-4db3-a64c-2daa06556b6e	225c1374-d952-4e8c-8d47-503e2515d26e	ACTIVE	YEARLY	2026-08-25 06:26:25.742+06	\N	2026-08-25 09:07:43.509+06	2027-08-25 09:07:43.509+06	\N	\N	t	{"amount": "4", "planId": "225c1374-d952-4e8c-8d47-503e2515d26e", "planCode": "PRO", "planName": "pro", "capturedAt": "2026-08-25T06:26:25.742Z", "billingCycle": "YEARLY", "currencyCode": "BDT"}	2026-08-25 06:26:25.75+06	2026-08-25 09:07:43.523+06	\N	\N	\N	f
338e8c3e-3cb1-48fa-bdc4-c70dea272fea	65b4d86b-9ce6-4d78-901c-440b0c0fd721	3ea12177-343e-40fa-a9cb-1bcd6f6cf0d7	794b6c06-55a9-427c-ae40-874d7628158c	SUSPENDED	MONTHLY	2026-08-27 07:27:34.091+06	2026-08-28 07:27:34.091+06	2026-08-28 07:27:34.091+06	2026-09-28 07:27:34.091+06	\N	\N	t	{"amount": "3", "planId": "794b6c06-55a9-427c-ae40-874d7628158c", "planCode": "MEDIUM", "planName": "medium", "capturedAt": "2026-08-27T07:27:34.091Z", "billingCycle": "MONTHLY", "currencyCode": "BDT"}	2026-08-27 07:27:34.097+06	2026-08-27 07:29:00.023+06	\N	2026-08-27 07:29:00.022+06	2026-09-26 07:29:00.022+06	f
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenants (id, code, name, slug, status, "trialEndsAt", "activatedAt", "suspendedAt", "createdAt", "updatedAt") FROM stdin;
65b4d86b-9ce6-4d78-901c-440b0c0fd721	TANANT2	Tanant-2	tanant-2	ACTIVE	\N	2026-08-25 09:05:41.489+06	\N	2026-08-25 04:39:40.02+06	2026-08-25 09:05:41.49+06
632bb8a8-f9f9-4093-a903-351e3614fc88	TANANT1	Tanant-1	tanant-1	ACTIVE	\N	2026-08-25 09:05:54.349+06	\N	2026-08-25 04:39:17.043+06	2026-08-25 09:05:54.35+06
809958ef-bcc7-4dfd-a02c-527177ac5ba7	ACME	Acme	acme	ACTIVE	\N	2026-08-25 09:06:06.208+06	\N	2026-08-23 05:04:16.751+06	2026-08-25 09:06:06.209+06
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, phone, "passwordHash", "fullName", "preferredLocale", timezone, status, "emailVerifiedAt", "phoneVerifiedAt", "passwordChangedAt", "failedLoginCount", "lockedUntil", "lastLoginAt", "createdAt", "updatedAt", "deletedAt") FROM stdin;
68c8a00e-0f20-4dda-ad86-5c80143a2877	fresh.owner@dotskills.test	\N	$argon2id$v=19$m=65536,t=3,p=1$E4eK2gnFcEzYbfgTdQMw7Q$yvRUGcM89fsp9Cys2QUjMegE9fcstgVbug1eYv9w6d4	Test Owner	bn-BD	Asia/Dhaka	ACTIVE	\N	\N	2026-08-25 06:18:08.279+06	0	\N	2026-08-25 10:55:14.335+06	2026-08-25 06:16:21.195+06	2026-08-25 10:55:14.534+06	\N
3c1bd3c5-8511-413b-8372-95c40f088b3d	fresh.owner2@dotskills.test	\N	$argon2id$v=19$m=65536,t=3,p=1$Kqk8t9booKxzZpyJTSlAkg$k17HuC1TlKsUMhjG7Bf+hMAxpAYVxSCe5eAYkCjvUHs	owner2	bn-BD	Asia/Dhaka	ACTIVE	\N	\N	2026-08-25 07:04:17.095+06	0	\N	2026-08-25 10:56:14.191+06	2026-08-25 07:04:01.206+06	2026-08-25 10:56:14.367+06	\N
0133dc94-71fe-40d5-9d8d-be28017fd7cf	member@gmail.com	\N	$argon2id$v=19$m=65536,t=3,p=1$bOqqLj4xacFogKIBq2NGgQ$EkGOga4R/FQqVGZhOFOUkOKQjW1bNtjSZCAy3BzcAwY	member1	bn-BD	Asia/Dhaka	ACTIVE	2026-08-25 11:45:44.525+06	\N	2026-08-25 11:45:44.525+06	0	\N	\N	2026-08-25 11:45:44.531+06	2026-08-25 11:45:44.531+06	\N
774bb094-6628-422a-beaf-dc0ae9e50984	admin@dotskills.com	\N	$argon2id$v=19$m=65536,t=3,p=1$5Ci9bVO6srjFnJho7b4vbA$EGXAfhKp+Hg/aTISgrlRzNWyC59vOdb1ptKhT0kg4vU	DotSkills Super Admin	bn-BD	Asia/Dhaka	ACTIVE	2026-08-22 05:16:14.968+06	\N	2026-08-22 07:34:00.403+06	0	\N	2026-08-27 07:25:30.219+06	2026-08-09 08:17:10.058+06	2026-08-27 07:25:30.438+06	\N
1d9c2ef0-a937-4a08-86fe-4c4404b336f0	autotrialowner@test.com	\N	$argon2id$v=19$m=65536,t=3,p=1$TagpuCobGCnbtqIK0lLICQ$gFggUDZxHAgcDngCEi52LMsmntlk4xFM78wvXCgV7Pc	Auto Trial Owner	bn-BD	Asia/Dhaka	ACTIVE	\N	\N	2026-08-27 07:28:16.714+06	0	\N	2026-08-27 07:28:16.714+06	2026-08-27 07:28:08.161+06	2026-08-27 07:28:17.169+06	\N
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: billing_attempts billing_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.billing_attempts
    ADD CONSTRAINT billing_attempts_pkey PRIMARY KEY (id);


--
-- Name: billings billings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.billings
    ADD CONSTRAINT billings_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_member_roles company_member_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_member_roles
    ADD CONSTRAINT company_member_roles_pkey PRIMARY KEY ("companyMemberId", "companyRoleId");


--
-- Name: company_member_scopes company_member_scopes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_member_scopes
    ADD CONSTRAINT company_member_scopes_pkey PRIMARY KEY (id);


--
-- Name: company_members company_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT company_members_pkey PRIMARY KEY (id);


--
-- Name: company_ownerships company_ownerships_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_ownerships
    ADD CONSTRAINT company_ownerships_pkey PRIMARY KEY (id);


--
-- Name: company_role_permissions company_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_role_permissions
    ADD CONSTRAINT company_role_permissions_pkey PRIMARY KEY ("companyRoleId", "permissionId");


--
-- Name: company_roles company_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_roles
    ADD CONSTRAINT company_roles_pkey PRIMARY KEY (id);


--
-- Name: features features_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.features
    ADD CONSTRAINT features_pkey PRIMARY KEY (id);


--
-- Name: industries industries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.industries
    ADD CONSTRAINT industries_pkey PRIMARY KEY (id);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invoice_sequences invoice_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_sequences
    ADD CONSTRAINT invoice_sequences_pkey PRIMARY KEY ("yearKey");


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: login_events login_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_events
    ADD CONSTRAINT login_events_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: plan_features plan_features_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT plan_features_pkey PRIMARY KEY ("planId", "featureId");


--
-- Name: plan_prices plan_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_prices
    ADD CONSTRAINT plan_prices_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: platform_member_roles platform_member_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_member_roles
    ADD CONSTRAINT platform_member_roles_pkey PRIMARY KEY ("platformMemberId", "platformRoleId");


--
-- Name: platform_members platform_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_members
    ADD CONSTRAINT platform_members_pkey PRIMARY KEY (id);


--
-- Name: platform_role_permissions platform_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_role_permissions
    ADD CONSTRAINT platform_role_permissions_pkey PRIMARY KEY ("platformRoleId", "permissionId");


--
-- Name: platform_roles platform_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_roles
    ADD CONSTRAINT platform_roles_pkey PRIMARY KEY (id);


--
-- Name: subscription_events subscription_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT subscription_events_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_action_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_action_createdAt_idx" ON public.audit_logs USING btree (action, "createdAt");


--
-- Name: audit_logs_actorUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON public.audit_logs USING btree ("actorUserId", "createdAt");


--
-- Name: audit_logs_tenantId_companyId_entityType_entityId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_tenantId_companyId_entityType_entityId_createdAt_idx" ON public.audit_logs USING btree ("tenantId", "companyId", "entityType", "entityId", "createdAt");


--
-- Name: auth_sessions_expiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "auth_sessions_expiresAt_idx" ON public.auth_sessions USING btree ("expiresAt");


--
-- Name: auth_sessions_refreshTokenHash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "auth_sessions_refreshTokenHash_key" ON public.auth_sessions USING btree ("refreshTokenHash");


--
-- Name: auth_sessions_userId_revokedAt_expiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "auth_sessions_userId_revokedAt_expiresAt_idx" ON public.auth_sessions USING btree ("userId", "revokedAt", "expiresAt");


--
-- Name: billing_attempts_billingId_attemptNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "billing_attempts_billingId_attemptNumber_key" ON public.billing_attempts USING btree ("billingId", "attemptNumber");


--
-- Name: billing_attempts_billingId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "billing_attempts_billingId_createdAt_idx" ON public.billing_attempts USING btree ("billingId", "createdAt");


--
-- Name: billing_attempts_idempotencyKey_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "billing_attempts_idempotencyKey_key" ON public.billing_attempts USING btree ("idempotencyKey");


--
-- Name: billing_attempts_status_attemptedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "billing_attempts_status_attemptedAt_idx" ON public.billing_attempts USING btree (status, "attemptedAt");


--
-- Name: billings_companyId_status_dueAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "billings_companyId_status_dueAt_idx" ON public.billings USING btree ("companyId", status, "dueAt");


--
-- Name: billings_idempotencyKey_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "billings_idempotencyKey_key" ON public.billings USING btree ("idempotencyKey");


--
-- Name: billings_status_nextAttemptAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "billings_status_nextAttemptAt_idx" ON public.billings USING btree (status, "nextAttemptAt");


--
-- Name: billings_subscriptionId_periodStart_periodEnd_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "billings_subscriptionId_periodStart_periodEnd_idx" ON public.billings USING btree ("subscriptionId", "periodStart", "periodEnd");


--
-- Name: billings_subscriptionId_periodStart_periodEnd_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "billings_subscriptionId_periodStart_periodEnd_key" ON public.billings USING btree ("subscriptionId", "periodStart", "periodEnd");


--
-- Name: billings_tenantId_status_dueAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "billings_tenantId_status_dueAt_idx" ON public.billings USING btree ("tenantId", status, "dueAt");


--
-- Name: companies_industryId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "companies_industryId_status_idx" ON public.companies USING btree ("industryId", status);


--
-- Name: companies_tenantId_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "companies_tenantId_code_key" ON public.companies USING btree ("tenantId", code);


--
-- Name: companies_tenantId_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "companies_tenantId_id_key" ON public.companies USING btree ("tenantId", id);


--
-- Name: companies_tenantId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "companies_tenantId_status_idx" ON public.companies USING btree ("tenantId", status);


--
-- Name: company_member_roles_companyRoleId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "company_member_roles_companyRoleId_idx" ON public.company_member_roles USING btree ("companyRoleId");


--
-- Name: company_member_scopes_companyMemberId_scopeType_scopeKey_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "company_member_scopes_companyMemberId_scopeType_scopeKey_key" ON public.company_member_scopes USING btree ("companyMemberId", "scopeType", "scopeKey");


--
-- Name: company_member_scopes_tenantId_companyId_scopeType_scopeKey_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "company_member_scopes_tenantId_companyId_scopeType_scopeKey_idx" ON public.company_member_scopes USING btree ("tenantId", "companyId", "scopeType", "scopeKey", "validUntil");


--
-- Name: company_members_tenantId_companyId_employeeCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "company_members_tenantId_companyId_employeeCode_key" ON public.company_members USING btree ("tenantId", "companyId", "employeeCode");


--
-- Name: company_members_tenantId_companyId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "company_members_tenantId_companyId_status_idx" ON public.company_members USING btree ("tenantId", "companyId", status);


--
-- Name: company_members_tenantId_companyId_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "company_members_tenantId_companyId_userId_key" ON public.company_members USING btree ("tenantId", "companyId", "userId");


--
-- Name: company_members_userId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "company_members_userId_status_idx" ON public.company_members USING btree ("userId", status);


--
-- Name: company_ownerships_companyMemberId_endedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "company_ownerships_companyMemberId_endedAt_idx" ON public.company_ownerships USING btree ("companyMemberId", "endedAt");


--
-- Name: company_ownerships_tenantId_companyId_endedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "company_ownerships_tenantId_companyId_endedAt_idx" ON public.company_ownerships USING btree ("tenantId", "companyId", "endedAt");


--
-- Name: company_role_permissions_permissionId_effect_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "company_role_permissions_permissionId_effect_idx" ON public.company_role_permissions USING btree ("permissionId", effect);


--
-- Name: company_roles_tenantId_companyId_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "company_roles_tenantId_companyId_code_key" ON public.company_roles USING btree ("tenantId", "companyId", code);


--
-- Name: company_roles_tenantId_companyId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "company_roles_tenantId_companyId_status_idx" ON public.company_roles USING btree ("tenantId", "companyId", status);


--
-- Name: features_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX features_code_key ON public.features USING btree (code);


--
-- Name: features_module_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX features_module_status_idx ON public.features USING btree (module, status);


--
-- Name: industries_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX industries_code_key ON public.industries USING btree (code);


--
-- Name: invitations_email_status_expiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invitations_email_status_expiresAt_idx" ON public.invitations USING btree (email, status, "expiresAt");


--
-- Name: invitations_tenantId_companyId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invitations_tenantId_companyId_status_idx" ON public.invitations USING btree ("tenantId", "companyId", status);


--
-- Name: invitations_tokenHash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "invitations_tokenHash_key" ON public.invitations USING btree ("tokenHash");


--
-- Name: invoices_billingId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "invoices_billingId_key" ON public.invoices USING btree ("billingId");


--
-- Name: invoices_companyId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invoices_companyId_status_idx" ON public.invoices USING btree ("companyId", status);


--
-- Name: invoices_invoiceNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON public.invoices USING btree ("invoiceNumber");


--
-- Name: invoices_subscriptionId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invoices_subscriptionId_createdAt_idx" ON public.invoices USING btree ("subscriptionId", "createdAt");


--
-- Name: invoices_tenantId_status_dueAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "invoices_tenantId_status_dueAt_idx" ON public.invoices USING btree ("tenantId", status, "dueAt");


--
-- Name: login_events_email_occurredAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "login_events_email_occurredAt_idx" ON public.login_events USING btree (email, "occurredAt");


--
-- Name: login_events_success_occurredAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "login_events_success_occurredAt_idx" ON public.login_events USING btree (success, "occurredAt");


--
-- Name: login_events_userId_occurredAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "login_events_userId_occurredAt_idx" ON public.login_events USING btree ("userId", "occurredAt");


--
-- Name: payments_companyId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "payments_companyId_status_idx" ON public.payments USING btree ("companyId", status);


--
-- Name: payments_gatewayReference_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "payments_gatewayReference_key" ON public.payments USING btree ("gatewayReference");


--
-- Name: payments_idempotencyKey_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON public.payments USING btree ("idempotencyKey");


--
-- Name: payments_invoiceId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "payments_invoiceId_status_idx" ON public.payments USING btree ("invoiceId", status);


--
-- Name: payments_providerTransactionId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "payments_providerTransactionId_key" ON public.payments USING btree ("providerTransactionId");


--
-- Name: payments_tenantId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "payments_tenantId_status_idx" ON public.payments USING btree ("tenantId", status);


--
-- Name: permissions_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX permissions_code_key ON public.permissions USING btree (code);


--
-- Name: permissions_moduleCode_resource_action_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "permissions_moduleCode_resource_action_key" ON public.permissions USING btree ("moduleCode", resource, action);


--
-- Name: permissions_moduleCode_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "permissions_moduleCode_status_idx" ON public.permissions USING btree ("moduleCode", status);


--
-- Name: permissions_resource_action_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX permissions_resource_action_status_idx ON public.permissions USING btree (resource, action, status);


--
-- Name: plan_features_featureId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "plan_features_featureId_idx" ON public.plan_features USING btree ("featureId");


--
-- Name: plan_prices_planId_billingCycle_currencyCode_effectiveFrom_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "plan_prices_planId_billingCycle_currencyCode_effectiveFrom_key" ON public.plan_prices USING btree ("planId", "billingCycle", "currencyCode", "effectiveFrom");


--
-- Name: plan_prices_planId_billingCycle_isActive_effectiveFrom_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "plan_prices_planId_billingCycle_isActive_effectiveFrom_idx" ON public.plan_prices USING btree ("planId", "billingCycle", "isActive", "effectiveFrom");


--
-- Name: plans_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX plans_code_key ON public.plans USING btree (code);


--
-- Name: plans_isDefaultTrial_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "plans_isDefaultTrial_idx" ON public.plans USING btree ("isDefaultTrial");


--
-- Name: plans_status_isPublic_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "plans_status_isPublic_idx" ON public.plans USING btree (status, "isPublic");


--
-- Name: platform_member_roles_platformRoleId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "platform_member_roles_platformRoleId_idx" ON public.platform_member_roles USING btree ("platformRoleId");


--
-- Name: platform_members_employeeCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "platform_members_employeeCode_key" ON public.platform_members USING btree ("employeeCode");


--
-- Name: platform_members_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX platform_members_status_idx ON public.platform_members USING btree (status);


--
-- Name: platform_members_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "platform_members_userId_key" ON public.platform_members USING btree ("userId");


--
-- Name: platform_role_permissions_permissionId_effect_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "platform_role_permissions_permissionId_effect_idx" ON public.platform_role_permissions USING btree ("permissionId", effect);


--
-- Name: platform_roles_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX platform_roles_code_key ON public.platform_roles USING btree (code);


--
-- Name: platform_roles_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX platform_roles_status_idx ON public.platform_roles USING btree (status);


--
-- Name: subscription_events_idempotencyKey_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "subscription_events_idempotencyKey_key" ON public.subscription_events USING btree ("idempotencyKey");


--
-- Name: subscription_events_subscriptionId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "subscription_events_subscriptionId_createdAt_idx" ON public.subscription_events USING btree ("subscriptionId", "createdAt");


--
-- Name: subscription_events_tenantId_companyId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "subscription_events_tenantId_companyId_createdAt_idx" ON public.subscription_events USING btree ("tenantId", "companyId", "createdAt");


--
-- Name: subscriptions_companyId_status_currentPeriodEnd_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "subscriptions_companyId_status_currentPeriodEnd_idx" ON public.subscriptions USING btree ("companyId", status, "currentPeriodEnd");


--
-- Name: subscriptions_status_graceEndsAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "subscriptions_status_graceEndsAt_idx" ON public.subscriptions USING btree (status, "graceEndsAt");


--
-- Name: subscriptions_status_pastDueEndsAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "subscriptions_status_pastDueEndsAt_idx" ON public.subscriptions USING btree (status, "pastDueEndsAt");


--
-- Name: subscriptions_status_suspensionExpiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "subscriptions_status_suspensionExpiresAt_idx" ON public.subscriptions USING btree (status, "suspensionExpiresAt");


--
-- Name: subscriptions_status_trialEndsAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "subscriptions_status_trialEndsAt_idx" ON public.subscriptions USING btree (status, "trialEndsAt");


--
-- Name: subscriptions_tenantId_status_currentPeriodEnd_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "subscriptions_tenantId_status_currentPeriodEnd_idx" ON public.subscriptions USING btree ("tenantId", status, "currentPeriodEnd");


--
-- Name: tenants_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tenants_code_key ON public.tenants USING btree (code);


--
-- Name: tenants_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug);


--
-- Name: tenants_status_trialEndsAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "tenants_status_trialEndsAt_idx" ON public.tenants USING btree (status, "trialEndsAt");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_phone_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_phone_key ON public.users USING btree (phone);


--
-- Name: users_status_deletedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "users_status_deletedAt_idx" ON public.users USING btree (status, "deletedAt");


--
-- Name: audit_logs audit_logs_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: auth_sessions auth_sessions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: billing_attempts billing_attempts_billingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.billing_attempts
    ADD CONSTRAINT "billing_attempts_billingId_fkey" FOREIGN KEY ("billingId") REFERENCES public.billings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: billings billings_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.billings
    ADD CONSTRAINT "billings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: billings billings_subscriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.billings
    ADD CONSTRAINT "billings_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES public.subscriptions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: billings billings_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.billings
    ADD CONSTRAINT "billings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: companies companies_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT "companies_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: companies companies_industryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT "companies_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES public.industries(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: companies companies_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT "companies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: company_member_roles company_member_roles_companyMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_member_roles
    ADD CONSTRAINT "company_member_roles_companyMemberId_fkey" FOREIGN KEY ("companyMemberId") REFERENCES public.company_members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: company_member_roles company_member_roles_companyRoleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_member_roles
    ADD CONSTRAINT "company_member_roles_companyRoleId_fkey" FOREIGN KEY ("companyRoleId") REFERENCES public.company_roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: company_member_scopes company_member_scopes_companyMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_member_scopes
    ADD CONSTRAINT "company_member_scopes_companyMemberId_fkey" FOREIGN KEY ("companyMemberId") REFERENCES public.company_members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: company_members company_members_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT "company_members_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: company_members company_members_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT "company_members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: company_members company_members_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_members
    ADD CONSTRAINT "company_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: company_ownerships company_ownerships_assignedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_ownerships
    ADD CONSTRAINT "company_ownerships_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: company_ownerships company_ownerships_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_ownerships
    ADD CONSTRAINT "company_ownerships_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: company_ownerships company_ownerships_companyMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_ownerships
    ADD CONSTRAINT "company_ownerships_companyMemberId_fkey" FOREIGN KEY ("companyMemberId") REFERENCES public.company_members(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: company_ownerships company_ownerships_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_ownerships
    ADD CONSTRAINT "company_ownerships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: company_role_permissions company_role_permissions_companyRoleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_role_permissions
    ADD CONSTRAINT "company_role_permissions_companyRoleId_fkey" FOREIGN KEY ("companyRoleId") REFERENCES public.company_roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: company_role_permissions company_role_permissions_permissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_role_permissions
    ADD CONSTRAINT "company_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: company_roles company_roles_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_roles
    ADD CONSTRAINT "company_roles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: company_roles company_roles_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_roles
    ADD CONSTRAINT "company_roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invitations invitations_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT "invitations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: invitations invitations_invitedUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT "invitations_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: invitations invitations_sentByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT "invitations_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: invitations invitations_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT "invitations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: invoices invoices_billingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "invoices_billingId_fkey" FOREIGN KEY ("billingId") REFERENCES public.billings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invoices invoices_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invoices invoices_subscriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES public.subscriptions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: invoices invoices_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: login_events login_events_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_events
    ADD CONSTRAINT "login_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public.invoices(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_subscriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES public.subscriptions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: plan_features plan_features_featureId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT "plan_features_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES public.features(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: plan_features plan_features_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_features
    ADD CONSTRAINT "plan_features_planId_fkey" FOREIGN KEY ("planId") REFERENCES public.plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: plan_prices plan_prices_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_prices
    ADD CONSTRAINT "plan_prices_planId_fkey" FOREIGN KEY ("planId") REFERENCES public.plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: platform_member_roles platform_member_roles_platformMemberId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_member_roles
    ADD CONSTRAINT "platform_member_roles_platformMemberId_fkey" FOREIGN KEY ("platformMemberId") REFERENCES public.platform_members(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: platform_member_roles platform_member_roles_platformRoleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_member_roles
    ADD CONSTRAINT "platform_member_roles_platformRoleId_fkey" FOREIGN KEY ("platformRoleId") REFERENCES public.platform_roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: platform_members platform_members_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_members
    ADD CONSTRAINT "platform_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: platform_role_permissions platform_role_permissions_permissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_role_permissions
    ADD CONSTRAINT "platform_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: platform_role_permissions platform_role_permissions_platformRoleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_role_permissions
    ADD CONSTRAINT "platform_role_permissions_platformRoleId_fkey" FOREIGN KEY ("platformRoleId") REFERENCES public.platform_roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: subscription_events subscription_events_subscriptionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_events
    ADD CONSTRAINT "subscription_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES public.subscriptions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT "subscriptions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: subscriptions subscriptions_planId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES public.plans(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: subscriptions subscriptions_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict w8DmI3aUr83AVRnn93mEjNRDQBhHEJZLxwe1U8yYRB32OspwO2DtQaOXkvPQOwR

