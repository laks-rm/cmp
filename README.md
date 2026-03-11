# CMP — Compliance Monitoring Platform

A premium internal compliance management system for Deriv Group with security-first architecture.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up database (update .env first with your PostgreSQL credentials)
npx prisma db push
npx prisma db seed

# Start development server
npm run dev
```

Visit http://localhost:3000/login

## 🔐 Test Credentials (Dev Mode)

All users use password: `password123`

- **Lakshmi Bichu** - Super Admin (All entities, All teams)
- **Gary Roberts** - Super Admin (All entities, All teams)
- **Sarah Mitchell** - Manager (DIEL + DGL, Compliance)
- **Wa'ed Al-Rashid** - Manager (DIEL + DGL + DBVI, CompOps)
- **Ahmed Khalil** - Analyst (DIEL, Compliance)
- **Reem Khalil** - Executor (DIEL, CompOps)

## 📐 Design System

### Colors
- **Primary Action**: `--blue` (#3B6CE7)
- **Deriv Brand Accent**: `--deriv-coral` (#FF444F) — used sparingly on logo and brand marks
- **Functional**: Success (green), Warning (amber), Error (red), Info (purple), Neutral (teal)
- **Surfaces**: Light backgrounds with subtle greys for depth

### Typography
- **UI Text**: Outfit (300-700 weights)
- **Monospace**: IBM Plex Mono (400-500) for codes, references, IDs

### Component Patterns
- **Cards**: 14px radius, white background, subtle border + shadow on hover
- **Status Pills**: Rounded capsules with colored dot + light background
- **Entity Badges**: Small uppercase tags with entity-specific colors
- **Buttons**: Primary (blue), Secondary (outlined), Danger (red outline)

## 🏗️ Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + CSS Variables
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js (JWT strategy, Okta-ready)
- **Validation**: Zod schemas on all API routes

### Security Features
- ✅ RBAC with defense-in-depth (middleware + API + UI layers)
- ✅ Entity-scoped data access filtering
- ✅ Rate limiting (login: 5/15min, API: 100/min)
- ✅ Comprehensive audit logging (INSERT-only)
- ✅ Input validation & sanitization (Zod)
- ✅ HTTP security headers (CSP, X-Frame-Options, HSTS)
- ✅ Secure file storage with authenticated API serving
- ✅ Password hashing (bcrypt cost 12)
- ✅ Session security (HttpOnly, Secure, SameSite)

### Project Structure
```
src/
├── app/
│   ├── (auth)/login/          # Login page (dev cards + manual form)
│   ├── (dashboard)/           # Main app shell with sidebar + topbar
│   │   ├── layout.tsx         # Protected layout with entity context
│   │   ├── page.tsx           # Dashboard with KPIs
│   │   ├── sources/
│   │   ├── tasks/
│   │   ├── reviews/
│   │   ├── findings/
│   │   ├── reports/
│   │   ├── audit-log/
│   │   └── admin/
│   └── api/
│       ├── auth/[...nextauth]/ # NextAuth handlers
│       └── files/[id]/         # Authenticated file serving
├── components/
│   ├── auth/                   # Login components
│   ├── dashboard/              # Dashboard client components
│   ├── layout/                 # Sidebar, Topbar, etc.
│   └── ui/                     # Reusable UI components
├── contexts/
│   └── EntityContext.tsx       # Entity + team selection context
├── lib/
│   ├── auth.ts                 # NextAuth config (provider-agnostic)
│   ├── permissions.ts          # RBAC helpers
│   ├── audit.ts                # Audit logging
│   ├── api.ts                  # API route wrapper
│   ├── rate-limit.ts           # Rate limiting
│   ├── storage.ts              # File storage abstraction
│   ├── validation.ts           # Zod schemas
│   └── prisma.ts               # Prisma client singleton
└── types/
    ├── index.ts                # Shared types
    └── next-auth.d.ts          # NextAuth augmentation

prisma/
├── schema.prisma               # Complete domain schema (15 models)
└── seed.ts                     # Seed script (entities, teams, roles, users)
```

## 📊 Database Models

- **Entity** — Legal entities (DIEL, DGL, DBVI, FINSERV)
- **Team** — Organizational teams (Compliance, CompOps, Internal Audit)
- **Role** — System roles with permissions (Super Admin, Manager, Analyst, Executor, Viewer)
- **Permission** — Granular permissions (14 modules × 7 actions)
- **RolePermission** — Permission matrix
- **User** — User accounts with multi-entity/team access
- **Source** — Compliance sources (regulations, standards, audits, policies)
- **SourceItem** — Hierarchical source requirements
- **Task** — Compliance tasks with evidence + workflow
- **Finding** — Issues and action items
- **Evidence** — File attachments
- **Comment** — Collaboration threads
- **AuditLog** — Tamper-proof event trail (INSERT-only)
- **Notification** — In-app notifications

## 🎨 Phase 2 Deliverables

### ✅ Design System
- Deriv-branded color palette with coral accent
- Outfit + IBM Plex Mono typography
- CSS variables for consistent theming
- Professional component patterns (cards, pills, badges, forms)

### ✅ Layout Shell
- **Sidebar**: Entity/team switcher, nav with permission-based visibility, user pill
- **Topbar**: Breadcrumb navigation, search box, notifications, quick-add, logout
- **Entity Context**: React context + localStorage persistence for entity/team filtering

### ✅ Premium Login Page
- Coral-to-blue gradient CMP logo
- Dev mode: Quick-login role cards (2×3 grid)
- Manual login form with validation
- Okta SSO ready (hidden in dev mode)

### ✅ Dashboard
- Time-aware greeting
- Group view banner (when consolidated)
- 5 KPI cards with trends
- Action items panel
- Compliance by source chart
- Active sources grid (3 columns)

## 🔄 Next Steps (Phase 3+)

- [ ] Sources library (CRUD + source-item hierarchy)
- [ ] Task tracker (planning, assignment, execution)
- [ ] Review queue (approval workflows)
- [ ] Findings lifecycle (issue tracking + remediation)
- [ ] Reports module (regulatory + management reporting)
- [ ] Audit log viewer (tamper-proof event trails)
- [ ] Admin panel (user, role, entity, team management)

## 🐳 Deployment

```bash
# Build production Docker image
docker build -t cmp-app .

# Run container (requires PostgreSQL + env vars)
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_SECRET="..." \
  -e NEXTAUTH_URL="https://cmp.deriv.com" \
  cmp-app
```

## 📝 Environment Variables

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/cmpdb"
NEXTAUTH_SECRET="long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
AUTH_PROVIDER="credentials"  # or "okta"
STORAGE_PROVIDER="local"     # or "gcs"
```

## 🔒 Security Checklist

- [x] No hardcoded secrets
- [x] All API routes validate input with Zod
- [x] Parameterized queries only (Prisma enforces this)
- [x] Authentication required on all dashboard routes
- [x] Authorization checks at middleware + API + UI layers
- [x] Entity-scoped data filtering
- [x] Rate limiting on login + API
- [x] Audit logging on all mutations
- [x] Security headers configured
- [x] HTTPS enforced in production
- [x] File uploads validated + stored securely
- [x] Session tokens HttpOnly + Secure

---

Built with ❤️ for Deriv Group
