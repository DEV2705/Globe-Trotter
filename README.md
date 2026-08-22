# GlobeTrotter 🌍✈️

GlobeTrotter is a modern, full-stack travel itinerary planning, budgeting, city discovery, and community sharing web application built with **Next.js 15**, **TypeScript**, **Prisma ORM**, and **Tailwind CSS**.

---

## ✨ Features

- **🗺️ Multi-Stop Trip Planning:** Create custom trip itineraries with start/end dates, multiple city stops, and daily activity timelines.
- **🖐️ Drag-and-Drop Activity Management:** Reorder trip stops and daily activities using `@dnd-kit`.
- **💰 Budgeting & Expense Tracking:** Track trip expenses by categories (Transport, Stay, Activity, Meal, Other), monitor budget caps, and receive over-budget alerts.
- **🏙️ City & Activity Explorer:** Search cities by region, popularity, and cost index, and explore curated activities categorized by type (Sightseeing, Adventure, Food, Culture, Nightlife, etc.).
- **🌐 Community & Itinerary Sharing:** Share public trips, post travel stories with tags and images, like community posts, and clone public trip itineraries directly into your personal trip planner.
- **🔒 Authentication & RBAC:** Secure cookie-based JWT authentication, password hashing with Bcrypt, and role-based authorization for administrative management.
- **⚡ High Performance:** Optimized for Next.js 15 App Router, React Server Components (RSC), Turbopack, and package import optimization.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Database & ORM:** [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/), [Radix UI Primitives](https://www.radix-ui.com/), [Lucide Icons](https://lucide.dev/)
- **Drag & Drop:** [@dnd-kit](https://dndkit.com/) (`core`, `sortable`, `modifiers`)
- **Data Visualization:** [Recharts](https://recharts.org/)
- **Validation:** [Zod](https://zod.dev/) & [React Hook Form](https://react-hook-form.com/)
- **Auth:** `jose` (JWT) & `bcryptjs`
- **Testing:** Node.js native test runner (`node:test`) & `tsx`

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.x or higher
- **Database**: PostgreSQL (local instance or Docker container)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd Globe-Trotter
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and fill in your configuration:

```bash
cp .env.example .env
```

Ensure `.env` contains valid database credentials and a JWT secret:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/globetrotter?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
```

### 3. Database Setup & Seeding

Initialize the database schema and seed initial cities, activities, and sample data:

```bash
npm run setup
```

Alternatively, run database operations individually:

```bash
# Push database schema
npm run db:push

# Seed database with sample data
npm run db:seed
```

### 4. Running the Development Server

Start the Next.js dev server with Turbopack:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Next.js development server with Turbopack |
| `npm run build` | Generates Prisma client and builds production bundle |
| `npm run start` | Starts the production server |
| `npm run setup` | Runs Prisma generate, pushes DB schema, and seeds sample data |
| `npm run db:push` | Pushes Prisma schema changes to PostgreSQL |
| `npm run db:seed` | Seeds database using `prisma/seed.ts` |
| `npm run db:studio` | Opens Prisma Studio GUI to view/edit database records |
| `npm run typecheck` | Runs TypeScript compiler checks without emitting files (`tsc --noEmit`) |
| `npm run test` | Runs unit tests for validators, budget logic, dates, and utilities |
| `npm run lint` | Runs Next.js ESLint checks |

---

## 📁 Project Structure

```text
Globe-Trotter/
├── prisma/
│   ├── schema.prisma        # Database models & enums
│   └── seed.ts              # Database seeding script
├── src/
│   ├── app/                 # Next.js App Router pages & layouts
│   │   ├── (admin)/         # Admin dashboard & user management routes
│   │   ├── (app)/           # Main application routes (trips, explore, community, profile)
│   │   └── (auth)/          # Login & registration routes
│   ├── components/          # Reusable UI components & Radix primitives
│   ├── lib/                 # Core utilities, validation schemas & helper functions
│   └── server/              # Server actions, queries, database client, & auth logic
├── next.config.ts           # Next.js configuration & package import optimizations
├── package.json             # Project dependencies & scripts
└── README.md                # Project documentation
```

---

## 🧪 Testing

Run unit tests covering validation schemas, budget calculations, and date helpers:

```bash
npm run test
```

Run TypeScript typechecks:

```bash
npm run typecheck
```
