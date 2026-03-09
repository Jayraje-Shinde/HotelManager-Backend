<div align="center">

# 🏨 Hotel Manager

**A complete Point-of-Sale and operations management system for restaurants and FL3 permit bars in Maharashtra, India.**

![Status](https://img.shields.io/badge/status-active%20development-brightgreen)
![Platform](https://img.shields.io/badge/platform-Windows-blue)
![License](https://img.shields.io/badge/license-Proprietary-red)

</div>

---

## What Is This

Hotel Manager is a desktop POS application built for Indian restaurant and bar owners operating under a Maharashtra FL3 (permit room) excise license. It handles the full lifecycle of a working shift — from taking orders to closing the day — while keeping your excise registers and tax records accurate without any manual effort.

The system is packaged as a self-contained Windows desktop app. There is no cloud dependency, no subscription, and no internet required for day-to-day operations. Everything runs locally on the owner's machine.

---

## Who It's For

- Restaurants with a bar (FL3 permit room)
- Single-location operations running on Windows
- Owners who need to comply with Maharashtra Excise Department register requirements
- Businesses that need clean GST and VAT records for their CA

---

## Key Features

### Point of Sale
- Table-wise KOT (Kitchen Order Ticket) management
- Separate food and liquor ordering flows
- Sealed bottle sales and peg/shot tracking with ml-level accuracy
- Waiter assignment and split billing
- Multiple payment methods per bill (cash, UPI, card)
- Discount handling merged atomically with payment
- Credit bill support with customer ledger

### Excise Compliance (Maharashtra FL3)
Generates all registers required by the Maharashtra Excise Department — no manual filling:

| Register | Description |
|----------|-------------|
| FLR-1/A | Brand-wise daily stock register |
| FLR-3 | Total account register (daily IMFL aggregate) |
| FLR-3/A | Daily transaction register (brand-wise, monthly) |
| FLR-4 | Monthly excise statement for officer submission |
| BEER-A | Beer stock register (separate from IMFL) |
| Breakage Register | Bottle breakage audit trail |
| Stock Variance Report | Theoretical vs actual ml per brand |

### Tax & Accounting
- Inclusive GST calculation for food (CGST + SGST stored at bill time)
- Inclusive VAT calculation for liquor (Maharashtra FL3 rate)
- Monthly VAT & GST Liability Report for CA with rate-wise GSTR-1 breakdown
- Weekly tax summary and full bill-level detail

### Inventory & Purchasing
- Stock management for food and liquor items
- Purchase register with vendor tracking and payment status
- Bottle-level open stock tracking (ml remaining per open bottle)
- Excise duty paid flag per purchase batch

### Day-End Operations
- Guided day-end close workflow
- Daily liquor snapshots for excise register accuracy
- Variance detection across brands

### Business Reports
- Item-wise sales report
- Waiter-wise sales summary
- Daily sales quantity report
- KOT report and cancellation log
- Sale register and purchase register

---

## Architecture

Hotel Manager is a two-process desktop application:

```
┌─────────────────────────────────────────┐
│           Launcher (Electron)            │
│  • License & registration management    │
│  • Starts portable PostgreSQL           │
│  • Downloads & spawns backend.exe       │
│  • Hosts the React frontend             │
└────────────┬──────────────┬─────────────┘
             │              │
    ┌────────▼──────┐  ┌────▼──────────────┐
    │  backend.exe  │  │  PostgreSQL 16     │
    │  Node + Express│  │  (portable,        │
    │  Prisma ORM   │  │   no install)      │
    └───────────────┘  └───────────────────┘
```

| Component | Technology |
|-----------|------------|
| Launcher | Electron |
| Frontend | React + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 16 (portable, bundled) |
| Packaging | pkg (backend → .exe) |

The backend runs on port `7912`. PostgreSQL runs on port `5433` to avoid conflicts with any system installation. Both are started and managed by the launcher — nothing is installed to Windows services.

All data lives in `%APPDATA%\HotelManager\pgdata\` and survives app updates.

---

## Project Structure

```
├── backend/                  # Node.js + Express API
│   ├── src/
│   │   ├── api/              # Feature modules (billing, kot, excise, etc.)
│   │   ├── config/           # Database connection
│   │   ├── middleware/       # Auth, role, logger
│   │   ├── types/            # TypeScript types
│   │   ├── utils/            # Shared utilities
│   │   ├── migrate.ts        # Runtime migration runner (no CLI needed)
│   │   └── index.ts          # Entry point, launcher guard, bootstrap
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
└── launcher/                 # Electron desktop wrapper
    ├── src/
    │   ├── backend/          # Backend process manager
    │   └── postgres/         # Portable PostgreSQL manager
    └── resources/
        ├── backend.exe       # Compiled backend
        └── pgsql/            # Portable PostgreSQL binaries
```

---

## Security

- Backend validates a machine-bound HMAC token on every start — running `backend.exe` directly without the launcher exits immediately
- License is bound to the hardware fingerprint of the customer's machine
- PostgreSQL listens on `127.0.0.1` only — not accessible from the network
- JWT-based authentication with role-based access control (admin / manager / waiter)

---

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL (local install for dev, port 5433)
- npm

### Backend
```bash
cd backend
npm install
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, LAUNCHER_TOKEN
npx prisma migrate dev
npm run dev
```

### Environment Variables
```env
DATABASE_URL=postgresql://postgres:<password>@127.0.0.1:5433/hotel_manager
JWT_SECRET=your_jwt_secret
PORT=7912
TOKEN_BUILD_SECRET=<get from team>
LAUNCHER_TOKEN=<generated by launcher on your dev machine>
```

### Building backend.exe
```bash
cd backend
npx prisma generate
npx tsc
npx pkg . --output build/backend.exe
```

---

## License

© 2026 Sai IT Solutions. All rights reserved.

This repository is public for portfolio and reference purposes. No permission is granted to use, copy, modify, merge, distribute, or deploy this software or any portion of it, commercially or otherwise, without explicit written permission from the author.
