# Shell App Project Overview

## Onboarding Initiaives
The following outlines the onboarding scheduling status:

### Current Apps Officially Scoped for Onboarding
- **CMS**: Was confirmed for Q3 and deferred to October of Q4.  HCMS Team unable to provide a firm timeline.  I reached out again for an updated timeline. 
- **I&A**: Onboarding planned for Q1 2026.  Data Engineering team is very motivated to move forward.
- **AI Admin**: Onboarding discussions are in early stages.  Tentative Q4 October timeframe has passed.  I reached for an updated timeline and offered help to build a base application.
- **Referrals**: Initial onboarding questions have been raised by Georgi Lichev.  No firm timeline established.
- **Events**: Uninitiated discussions regarding onboarding.  No firm timeline established.
- **CRM**: Uninitiated discussions regarding onboarding.  No firm timeline established.

### Core UI Team Support Needs
_The following requirements will be required to support successful onboarding and operational support across all MFEs_
- **Onboarding Support**: Dedicated resources to assist each MFE team with onboarding tasks, including integration support and support documentation.
- **Troubleshooting Support**: Resources to help diagnose and resolve issues during the onboarding process and post-onboarding operational and production support.
- **Styling Support / Component Generation**: Assistance with adapting existing components and new components to fit within the companies UX guidelines and Design System to increase overall consistency across Talent Acquisition Cloud.
- **New UI Generation**: Resources to help MFE teams generate and implement the new UI applications within the Shell App framework.


## Potential Core Infrastructure Projects

**Key Principle**: Build once in the App Shell → every MFE benefits, reducing engineering costs to scale.

### 1. Global Support Ticket Services (Zendesk Integration)

**Source**: Data Engineering Team → David Levitz (PO) and Priyank

**Project Phase**: Inception → Iteration (Platform has set up SSO)

**Priority**: Q1 - Data Engineering Team (I&A) -- (I believe CRM too, unknown timeline)

**Design**: None

**Impacted Apps**: Shell App, I&A, CRM *(all apps)*

**Business Benefits**:
- Increases customer satisfaction through better customer support
- Build once in the App Shell → every MFE benefits
- Reduces engineering cost to scale support across products

---

### 2. Global User Notifications

**Source**: Alexis Braillon, via James M.

**Project Phase**: Concept

**Priority**: Unknown

**Design**: None

**Impacted Apps**: Shell App, Referrals and CRM *(all apps)*

**Business Benefits**:
- Efficiently provides users call-to-actions from anywhere in the platform
- Build once in the App Shell → every MFE benefits (requires work from each team to integrate)
- Reduces engineering duplication cost across teams

---

### 3. Master Admin

**Source**: Spencer and James

**Project Phase**: Concept

**Design**: In Draft (James M)

**Priority**: Unknown (2026?)

**Impacted Apps**: Shell App, AI Admin app *(all apps with Admin Interface)*

**Business Benefits**:
- Easier for users to manage admin settings all in one place
- Consolidated administration reduces training and support costs

---

### 4. Re-designed Shell Navigation (Left Nav)

**Source**: Spencer and James

**Project Phase**: Inception

**Design**: Nearly Complete (James)

**Priority**: Q4 (awaiting final confirmation)

**Impacted Apps**: Shell App *(all apps)*

**Business Benefits**:
- More cohesive cross-app and feature navigation
- Build once in the App Shell → every MFE benefits
- Reduces engineering cost to scale design implementation across apps
- Improves user experience consistency across CRM, Events, and Referrals

---

### 5. Tenant Workspaces

**Source**: Chad, Data Engineering

**Project Phase**: Pre-existing support feature (from Marketing CRM)

**Design**: None

**Priority**: Unknown (important per Chad)

**Impacted Apps**: Shell App, I&A (Reports) CRM (Campaign Creation)

**Business Benefits**:
- Enables Radancy employees to craft reports and CRM Campaigns on behalf of users
- Critical for customer success and support operations
- Build once in the App Shell → every MFE benefits
- Reduces engineering cost to scale across apps

---

## Strategic Alignment

These projects represent **foundational infrastructure work** required to support the successful rollout and operation of CRM, Events, and Referrals. They are not standalone "innovation" features but rather essential capabilities that:

1. **Reduce duplication** - Built once in Shell App, consumed by all MFEs
2. **Lower operational costs** - Centralized support, notifications, and administration
3. **Enable product priorities** - Direct support for CRM, Events, and Referrals success
4. **Scale efficiently** - Every new MFE automatically inherits these capabilities

---

## Recommendations

To determine appropriate Core UI team sizing, we need:

1. **Breakdown of ongoing Shell App work** to support CRM, Events, and Referrals rollout
2. **Timeline alignment** with product launch schedules (Q1, Q4, 2026)
3. **Resource requirements** for projects in Inception/Iteration phases
4. **Maintenance and support commitments** for deployed infrastructure

These infrastructure investments directly tie to product success and should be prioritized based on their support of revenue-generating product launches, not as standalone feature development.
