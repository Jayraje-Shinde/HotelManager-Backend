/**
 * FULL DATABASE SEED SCRIPT
 * ─────────────────────────────────────────────────────────────────
 * Place this file at:  prisma/seed.ts
 *
 * Run with:
 *   npx ts-node --transpile-only prisma/seed.ts
 *
 * What gets created:
 *   4 roles → 7 users → 12 categories → 5 units
 *   → 30+ items (food + liquor with bottle sizes)
 *   → 3 vendors → 3 purchases (paid / partial / credit)
 *   → 4 customers → 10 table statuses
 *   → 8 bills (open / closed / paid / credit) with KOTs
 * ─────────────────────────────────────────────────────────────────
 */

import { PrismaClient, BillStatus, PaymentMethods, KOTStatus, SaleMode, TableState } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── helpers ──────────────────────────────────────────────────────
const hash = (p: string) => bcrypt.hashSync(p, 10);
const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000);

async function main() {
  console.log("🌱  Starting seed...\n");

  // ══════════════════════════════════════════════════════════════
  // 1. ROLES
  // ══════════════════════════════════════════════════════════════
  console.log("→ Roles");
  const [roleAdmin, roleWaiter, roleCashier, roleManager] = await Promise.all([
    prisma.role.create({ data: { name: "admin",   description: "Full system access" } }),
    prisma.role.create({ data: { name: "waiter",  description: "KOT and table operations" } }),
    prisma.role.create({ data: { name: "cashier", description: "Billing and payments" } }),
    prisma.role.create({ data: { name: "manager", description: "Reports and purchases" } }),
  ]);

  // ══════════════════════════════════════════════════════════════
  // 2. USERS
  // ══════════════════════════════════════════════════════════════
  console.log("→ Users");
  const [uAdmin, uManager, uCashier1, uCashier2, uWaiter1, uWaiter2, uWaiter3] = await Promise.all([
    prisma.user.create({ data: { name: "Admin",          username: "admin",    password_hash: hash("admin123"),  role_id: roleAdmin.id,   is_active: true, waitercode: null } }),
    prisma.user.create({ data: { name: "Prakash Jadhav", username: "manager",  password_hash: hash("pass123"),   role_id: roleManager.id, is_active: true, waitercode: null } }),
    prisma.user.create({ data: { name: "Meena Sharma",   username: "cashier1", password_hash: hash("pass123"),   role_id: roleCashier.id, is_active: true, waitercode: null } }),
    prisma.user.create({ data: { name: "Suresh Patil",   username: "cashier2", password_hash: hash("pass123"),   role_id: roleCashier.id, is_active: true, waitercode: null } }),
    prisma.user.create({ data: { name: "Raju Shinde",    username: "waiter1",  password_hash: hash("pass123"),   role_id: roleWaiter.id,  is_active: true, waitercode: "W01" } }),
    prisma.user.create({ data: { name: "Bablu Kumar",    username: "waiter2",  password_hash: hash("pass123"),   role_id: roleWaiter.id,  is_active: true, waitercode: "W02" } }),
    prisma.user.create({ data: { name: "Mohan Tiwari",   username: "waiter3",  password_hash: hash("pass123"),   role_id: roleWaiter.id,  is_active: true, waitercode: "W03" } }),
  ]);

  // ══════════════════════════════════════════════════════════════
  // 3. CATEGORIES
  // ══════════════════════════════════════════════════════════════
  console.log("→ Categories");
  const [catStarters, catMain, catTandoor, catBreads, catBeverages, catDesserts,
         catIndWhisky, catImpWhisky, catRum, catBeer, catVodka, catBrandy] = await Promise.all([
    prisma.category.create({ data: { name: "Starters",          is_liquor: false } }),
    prisma.category.create({ data: { name: "Main Course",       is_liquor: false } }),
    prisma.category.create({ data: { name: "Tandoor",           is_liquor: false } }),
    prisma.category.create({ data: { name: "Breads",            is_liquor: false } }),
    prisma.category.create({ data: { name: "Beverages",         is_liquor: false } }),
    prisma.category.create({ data: { name: "Desserts",          is_liquor: false } }),
    prisma.category.create({ data: { name: "Indian Whisky",     is_liquor: true  } }),
    prisma.category.create({ data: { name: "Imported Whisky",   is_liquor: true  } }),
    prisma.category.create({ data: { name: "Rum",               is_liquor: true  } }),
    prisma.category.create({ data: { name: "Beer",              is_liquor: true  } }),
    prisma.category.create({ data: { name: "Vodka",             is_liquor: true  } }),
    prisma.category.create({ data: { name: "Brandy",            is_liquor: true  } }),
  ]);

  // ══════════════════════════════════════════════════════════════
  // 4. UNITS
  // ══════════════════════════════════════════════════════════════
  console.log("→ Units");
  const [unitPlate, unitGlass, unitBottle, unitNos, unitBowl] = await Promise.all([
    prisma.unit.create({ data: { name: "Plate",  description: "Full plate serving" } }),
    prisma.unit.create({ data: { name: "Glass",  description: "Single glass" } }),
    prisma.unit.create({ data: { name: "Bottle", description: "Sealed bottle" } }),
    prisma.unit.create({ data: { name: "Nos",    description: "Number / piece" } }),
    prisma.unit.create({ data: { name: "Bowl",   description: "Bowl serving" } }),
  ]);

  // ══════════════════════════════════════════════════════════════
  // 5. FOOD ITEMS (non-liquor)
  // ══════════════════════════════════════════════════════════════
  console.log("→ Food items");
  const foodItems = await Promise.all([
    // Starters
    prisma.item.create({ data: { name: "Chicken Tikka",        category_id: catStarters.id, unit_id: unitPlate.id,  selling_price: 320, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Paneer Tikka",         category_id: catStarters.id, unit_id: unitPlate.id,  selling_price: 260, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Fish Fry",             category_id: catStarters.id, unit_id: unitPlate.id,  selling_price: 380, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Egg Pakoda",           category_id: catStarters.id, unit_id: unitPlate.id,  selling_price: 160, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Veg Platter",          category_id: catStarters.id, unit_id: unitPlate.id,  selling_price: 220, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Chicken 65",           category_id: catStarters.id, unit_id: unitPlate.id,  selling_price: 300, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    // Main Course
    prisma.item.create({ data: { name: "Butter Chicken",       category_id: catMain.id,     unit_id: unitBowl.id,   selling_price: 340, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Dal Makhni",           category_id: catMain.id,     unit_id: unitBowl.id,   selling_price: 220, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Mutton Curry",         category_id: catMain.id,     unit_id: unitBowl.id,   selling_price: 420, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Paneer Butter Masala", category_id: catMain.id,     unit_id: unitBowl.id,   selling_price: 280, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    // Tandoor
    prisma.item.create({ data: { name: "Tandoori Chicken",     category_id: catTandoor.id,  unit_id: unitPlate.id,  selling_price: 360, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Fish Tikka",           category_id: catTandoor.id,  unit_id: unitPlate.id,  selling_price: 400, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    // Breads
    prisma.item.create({ data: { name: "Butter Naan",          category_id: catBreads.id,   unit_id: unitNos.id,    selling_price: 50,  tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Garlic Naan",          category_id: catBreads.id,   unit_id: unitNos.id,    selling_price: 60,  tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Tandoori Roti",        category_id: catBreads.id,   unit_id: unitNos.id,    selling_price: 35,  tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    // Beverages
    prisma.item.create({ data: { name: "Mineral Water",        category_id: catBeverages.id, unit_id: unitBottle.id, selling_price: 30,  tax_rate: 5,  stock: 200, manage_stock: true,  is_liquor: false } }),
    prisma.item.create({ data: { name: "Soda",                 category_id: catBeverages.id, unit_id: unitGlass.id,  selling_price: 30,  tax_rate: 5,  stock: 200, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Cold Drink",           category_id: catBeverages.id, unit_id: unitBottle.id, selling_price: 60,  tax_rate: 5,  stock: 100, manage_stock: true,  is_liquor: false } }),
    prisma.item.create({ data: { name: "Fresh Lime Water",     category_id: catBeverages.id, unit_id: unitGlass.id,  selling_price: 80,  tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    // Desserts
    prisma.item.create({ data: { name: "Gulab Jamun",          category_id: catDesserts.id,  unit_id: unitPlate.id,  selling_price: 100, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
    prisma.item.create({ data: { name: "Ice Cream",            category_id: catDesserts.id,  unit_id: unitPlate.id,  selling_price: 120, tax_rate: 5,  stock: 100, manage_stock: false, is_liquor: false } }),
  ]);

  const [iChickenTikka, iPaneerTikka, iFishFry, iEggPakoda, iVegPlatter, iChicken65,
         iButterChicken, iDalMakhni, iMuttonCurry, iPaneerBM,
         iTandooriChicken, iFishTikka,
         iButterNaan, iGarlicNaan, iRoti,
         iWater, iSoda, iColdDrink, iLimeWater,
         iGulabJamun, iIceCream] = foodItems;

  // ══════════════════════════════════════════════════════════════
  // 6. LIQUOR ITEMS (multiple sizes per brand)
  // ══════════════════════════════════════════════════════════════
  console.log("→ Liquor items");

  type LiquorSize = { ml: number; price: number; excise: number };
  async function createLiquorBrand(
    name: string,
    categoryId: number,
    pegPricePerMl: number,
    sizes: LiquorSize[]
  ) {
    return Promise.all(
      sizes.map((s) =>
        prisma.item.create({
          data: {
            name:            `${name} ${s.ml}ml`,
            category_id:     categoryId,
            unit_id:         unitBottle.id,
            selling_price:   s.price,
            excise_rate:     s.excise,
            peg_price_per_ml: pegPricePerMl,
            ml_per_unit:     s.ml,
            tax_rate:        0,
            stock:           0,
            manage_stock:    true,
            is_liquor:       true,
          },
        })
      )
    );
  }

  const [rsw750, rsw375, rsw180]   = await createLiquorBrand("Royal Stag",         catIndWhisky.id, 2.8,  [{ ml:750, price:650,  excise:550  }, { ml:375, price:340, excise:290  }, { ml:180, price:175, excise:150  }]);
  const [oc750,  oc375,  oc180]    = await createLiquorBrand("Officer's Choice",   catIndWhisky.id, 2.4,  [{ ml:750, price:580,  excise:480  }, { ml:375, price:300, excise:260  }, { ml:180, price:155, excise:140  }]);
  const [mc750,  mc375,  mc180]    = await createLiquorBrand("McDowell's No.1",    catIndWhisky.id, 2.6,  [{ ml:750, price:620,  excise:520  }, { ml:375, price:320, excise:275  }, { ml:180, price:165, excise:145  }]);
  const [om750,  om375,  om180]    = await createLiquorBrand("Old Monk Rum",       catRum.id,       2.5,  [{ ml:750, price:560,  excise:460  }, { ml:375, price:290, excise:250  }, { ml:180, price:150, excise:130  }]);
  const [kf650,  kf330]            = await createLiquorBrand("Kingfisher",         catBeer.id,      0,    [{ ml:650, price:160,  excise:120  }, { ml:330, price:100, excise:80   }]);
  const [bud650, bud330]           = await createLiquorBrand("Budweiser",          catBeer.id,      0,    [{ ml:650, price:180,  excise:140  }, { ml:330, price:110, excise:90   }]);
  const [sm750,  sm375]            = await createLiquorBrand("Smirnoff",           catVodka.id,     3.0,  [{ ml:750, price:720,  excise:620  }, { ml:375, price:380, excise:330  }]);
  const [jw750]                    = await createLiquorBrand("Johnnie Walker Black",catImpWhisky.id, 6.5,  [{ ml:750, price:3200, excise:2800 }]);
  const [jd750,  jd375]            = await createLiquorBrand("Jack Daniel's",      catImpWhisky.id, 6.0,  [{ ml:750, price:2800, excise:2400 }, { ml:375, price:1500, excise:1300 }]);
  const [mc_brandy750]             = await createLiquorBrand("Morpheus",           catBrandy.id,    2.6,  [{ ml:750, price:600,  excise:500  }]);

  // ══════════════════════════════════════════════════════════════
  // 7. VENDORS
  // ══════════════════════════════════════════════════════════════
  console.log("→ Vendors");
  const [vSharma, vPooja, vFresh] = await Promise.all([
    prisma.vendor.create({ data: { name: "Sharma Distributors",  contact: "9876543210", license_no: "FL/DIST/MH/2021/001", type: "liquor" } }),
    prisma.vendor.create({ data: { name: "Pooja Traders",        contact: "9823456789", license_no: "FL/DIST/MH/2021/045", type: "liquor" } }),
    prisma.vendor.create({ data: { name: "Fresh Farms Pvt Ltd",  contact: "9900112233", license_no: null,                  type: "food"   } }),
  ]);

  // ══════════════════════════════════════════════════════════════
  // 8. PURCHASES  (with batches + stock)
  // ══════════════════════════════════════════════════════════════
  console.log("→ Purchases");

  // Helper: create purchase + batches + stock movements in one shot
  async function createPurchase(opts: {
    vendor_id:      number;
    invoice_no:     string;
    purchase_date:  Date;
    amount_paid:    number;
    items: Array<{
      item: { id: number; ml_per_unit: number | null };
      qty:  number;
      price: number;
    }>;
  }) {
    const totalAmount = opts.items.reduce((s, i) => s + i.qty * i.price, 0);
    const status =
      opts.amount_paid <= 0            ? "CREDIT"  :
      opts.amount_paid < totalAmount   ? "PARTIAL" : "PAID";

    const purchase = await prisma.purchase.create({
      data: {
        vendor_id:      opts.vendor_id,
        invoice_no:     opts.invoice_no,
        purchase_date:  opts.purchase_date,
        total_amount:   totalAmount,
        amount_paid:    opts.amount_paid,
        payment_status: status as any,
        created_by:     uManager.id,
      },
    });

    for (const it of opts.items) {
      await prisma.purchaseItem.create({
        data: { purchase_id: purchase.id, item_id: it.item.id, quantity: it.qty, price: it.price },
      });

      const batch = await prisma.purchaseBatch.create({
        data: {
          item_id:       it.item.id,
          purchase_id:   purchase.id,
          qty_total:     it.qty,
          qty_remaining: it.qty,
          cost_price:    it.price,
          pack_size:     1,
          ml_per_bottle: it.item.ml_per_unit,
          is_duty_paid:  true,
          batch_number:  `${opts.invoice_no}-B${it.item.id}`,
        },
      });

      await prisma.item.update({ where: { id: it.item.id }, data: { stock: { increment: it.qty } } });

      await prisma.stockMovement.create({
        data: {
          item_id:        it.item.id,
          change_qty:     it.qty,
          reason:         `Purchase: ${opts.invoice_no}`,
          movement_type:  "PURCHASE",
          ref_id:         purchase.id,
          created_by:     uManager.id,
          purchaseBatchId: batch.id,
        },
      });
    }

    // Record initial payment if amount_paid > 0
    if (opts.amount_paid > 0) {
      await prisma.purchasePayment.create({
        data: {
          purchase_id: purchase.id,
          amount:      opts.amount_paid,
          method:      "CASH",
          note:        "Initial payment at time of purchase",
          created_by:  uManager.id,
        },
      });
    }

    return purchase;
  }

  // Purchase 1 — 15 days ago — fully PAID
  await createPurchase({
    vendor_id:     vSharma.id,
    invoice_no:    "INV-2026-001",
    purchase_date: daysAgo(15),
    amount_paid:   0,   // will compute
    items: [
      { item: rsw750, qty: 24, price: 420 },
      { item: rsw375, qty: 24, price: 220 },
      { item: rsw180, qty: 24, price: 110 },
      { item: oc750,  qty: 12, price: 380 },
      { item: om750,  qty: 12, price: 370 },
      { item: kf650,  qty: 24, price: 90  },
      { item: kf330,  qty: 24, price: 55  },
    ],
  });
  // set it PAID after the fact
  const p1Total = (24*420)+(24*220)+(24*110)+(12*380)+(12*370)+(24*90)+(24*55);
  await prisma.purchase.update({
    where: { invoice_no: "INV-2026-001" },
    data: { amount_paid: p1Total, payment_status: "PAID" },
  });
  await prisma.purchasePayment.create({
    data: {
      purchase_id: (await prisma.purchase.findUnique({ where: { invoice_no: "INV-2026-001" } }))!.id,
      amount:      p1Total,
      method:      "BANK_TRANSFER",
      note:        "Full payment via NEFT",
      reference:   "NEFT20260218001",
      created_by:  uManager.id,
    },
  });

  // Purchase 2 — 5 days ago — PARTIAL (paid half)
  const p2 = await createPurchase({
    vendor_id:     vPooja.id,
    invoice_no:    "INV-2026-002",
    purchase_date: daysAgo(5),
    amount_paid:   15000,
    items: [
      { item: mc750,  qty: 12, price: 400 },
      { item: mc375,  qty: 12, price: 210 },
      { item: jw750,  qty: 6,  price: 2200 },
      { item: jd750,  qty: 6,  price: 1950 },
      { item: sm750,  qty: 12, price: 490 },
      { item: bud650, qty: 24, price: 100 },
    ],
  });

  // Purchase 3 — today — CREDIT (nothing paid yet)
  await createPurchase({
    vendor_id:     vFresh.id,
    invoice_no:    "INV-2026-003",
    purchase_date: today,
    amount_paid:   0,
    items: [
      { item: rsw750, qty: 12, price: 420 },
      { item: om375,  qty: 12, price: 240 },
      { item: mc_brandy750, qty: 6, price: 390 },
    ],
  });

  // ══════════════════════════════════════════════════════════════
  // 9. CUSTOMERS
  // ══════════════════════════════════════════════════════════════
  console.log("→ Customers");
  const [cRamesh, cSunil, cPriya, cAkbar] = await Promise.all([
    prisma.customer.create({ data: { name: "Ramesh Sharma",  phone: "9876500001", address: "Near Station, Pune",    credit_limit: 5000  } }),
    prisma.customer.create({ data: { name: "Sunil Desai",    phone: "9876500002", address: "MG Road, Pune",         credit_limit: 10000 } }),
    prisma.customer.create({ data: { name: "Priya Nair",     phone: "9876500003", address: "Koregaon Park, Pune",   credit_limit: 8000  } }),
    prisma.customer.create({ data: { name: "Akbar Khan",     phone: "9876500004", address: "Camp Area, Pune",       credit_limit: 3000  } }),
  ]);

  // ══════════════════════════════════════════════════════════════
  // 10. TABLE STATUSES
  // ══════════════════════════════════════════════════════════════
  console.log("→ Tables");
  const tableZones = [
    { table_no: "T1",  zone: "AC" },
    { table_no: "T2",  zone: "AC" },
    { table_no: "T3",  zone: "AC" },
    { table_no: "T4",  zone: "AC" },
    { table_no: "T5",  zone: "Non-AC" },
    { table_no: "T6",  zone: "Non-AC" },
    { table_no: "T7",  zone: "Non-AC" },
    { table_no: "T8",  zone: "Non-AC" },
    { table_no: "B1",  zone: "Bar" },
    { table_no: "B2",  zone: "Bar" },
  ];
  for (const t of tableZones) {
    await prisma.tableStatus.create({ data: { table_no: t.table_no, zone: t.zone, status: "VACANT" } });
  }

  // ══════════════════════════════════════════════════════════════
  // 11. BILLS, KOTs, PAYMENTS
  // ══════════════════════════════════════════════════════════════
  console.log("→ Bills and KOTs");

  // ── Helper: create a KOT with items, serve + close it ─────────
  async function buildKOT(opts: {
    billId:    number;
    tableNo:   string;
    waiterId:  number;
    kotNo:     string;
    status:    KOTStatus;
    items: Array<{
      item:     { id: number; selling_price: number; is_liquor: boolean; ml_per_unit: number | null };
      qty:      number;
      saleMode?: SaleMode;
      mlPerShot?: number;
    }>;
  }) {
    const kot = await prisma.kOT.create({
      data: {
        table_no:   opts.tableNo,
        waiter_id:  opts.waiterId,
        bill_id:    opts.billId,
        kot_no:     opts.kotNo,
        status:     opts.status,
        created_at: today,
        updated_at: today,
      },
    });

    for (const it of opts.items) {
      await prisma.kOTItem.create({
        data: {
          kot_id:     kot.id,
          item_id:    it.item.id,
          quantity:   it.qty,
          sale_mode:  it.saleMode ?? null,
          ml_per_shot: it.mlPerShot ?? null,
        },
      });
    }

    // If KOT is CLOSED, create BillItems and deduct stock
    if (opts.status === "CLOSED") {
      let billTotal = 0;
      for (const it of opts.items) {
        const subtotal = it.item.selling_price * it.qty;
        billTotal += subtotal;

        await prisma.billItem.create({
          data: {
            bill_id:    opts.billId,
            item_id:    it.item.id,
            quantity:   it.qty,
            rate:       it.item.selling_price,
            subtotal,
            sale_mode:  it.saleMode ?? null,
            ml_per_shot: it.mlPerShot ?? null,
          },
        });

        // Deduct stock from a batch if manage_stock (simple: just decrement item.stock)
        if (it.item.is_liquor) {
          await prisma.item.update({ where: { id: it.item.id }, data: { stock: { decrement: it.qty } } });
          await prisma.stockMovement.create({
            data: {
              item_id:       it.item.id,
              change_qty:    -it.qty,
              reason:        `Sale: Bill #${opts.billId} KOT ${opts.kotNo}`,
              movement_type: "SALE",
              ref_id:        opts.billId,
              created_by:    opts.waiterId,
            },
          });
        }
      }
      // Update bill total
      await prisma.bill.update({ where: { id: opts.billId }, data: { total: { increment: billTotal } } });
    }

    return kot;
  }

  // ── Bill helper ─────────────────────────────────────────────
  async function createBill(tableNo: string, userId: number, customerId?: number) {
    const bill = await prisma.bill.create({
      data: { table_no: tableNo, user_id: userId, customer_id: customerId ?? null, status: "OPEN", total: 0, discount: 0 },
    });
    await prisma.tableStatus.update({
      where: { table_no: tableNo },
      data: { status: "OCCUPIED", current_bill_id: bill.id },
    });
    return bill;
  }

  let kotSeq = 1;
  const kotNo = () => `KOT-${String(kotSeq++).padStart(4, "0")}`;

  // ════════════════════════════════════════════════════════
  // BILL 1 — T1 — OPEN — 2 KOTs (1 closed, 1 open)
  // ════════════════════════════════════════════════════════
  const bill1 = await createBill("T1", uCashier1.id);
  await buildKOT({
    billId: bill1.id, tableNo: "T1", waiterId: uWaiter1.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: iChickenTikka.id,    selling_price: 320, is_liquor: false, ml_per_unit: null }, qty: 1 },
      { item: { id: iPaneerTikka.id,     selling_price: 260, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: rsw750.id,           selling_price: 650, is_liquor: true,  ml_per_unit: 750  }, qty: 1, saleMode: "BOTTLE" },
      { item: { id: kf650.id,            selling_price: 160, is_liquor: true,  ml_per_unit: 650  }, qty: 2, saleMode: "BOTTLE" },
      { item: { id: iSoda.id,            selling_price: 30,  is_liquor: false, ml_per_unit: null }, qty: 2 },
    ],
  });
  await buildKOT({
    billId: bill1.id, tableNo: "T1", waiterId: uWaiter1.id, kotNo: kotNo(), status: "OPEN",
    items: [
      { item: { id: iButterChicken.id,   selling_price: 340, is_liquor: false, ml_per_unit: null }, qty: 1 },
      { item: { id: iGarlicNaan.id,      selling_price: 60,  is_liquor: false, ml_per_unit: null }, qty: 4 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // BILL 2 — T2 — OPEN — 1 KOT (open)
  // ════════════════════════════════════════════════════════
  const bill2 = await createBill("T2", uCashier1.id);
  await buildKOT({
    billId: bill2.id, tableNo: "T2", waiterId: uWaiter2.id, kotNo: kotNo(), status: "OPEN",
    items: [
      { item: { id: iEggPakoda.id,       selling_price: 160, is_liquor: false, ml_per_unit: null }, qty: 1 },
      { item: { id: iChicken65.id,       selling_price: 300, is_liquor: false, ml_per_unit: null }, qty: 1 },
      { item: { id: om750.id,            selling_price: 560, is_liquor: true,  ml_per_unit: 750  }, qty: 1, saleMode: "BOTTLE" },
      { item: { id: iWater.id,           selling_price: 30,  is_liquor: false, ml_per_unit: null }, qty: 2 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // BILL 3 — T3 — OPEN — 3 KOTs (2 closed, 1 served)
  // ════════════════════════════════════════════════════════
  const bill3 = await createBill("T3", uCashier2.id);
  await buildKOT({
    billId: bill3.id, tableNo: "T3", waiterId: uWaiter3.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: iFishFry.id,         selling_price: 380, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: jw750.id,            selling_price: 3200, is_liquor: true, ml_per_unit: 750  }, qty: 1, saleMode: "BOTTLE" },
      { item: { id: iSoda.id,            selling_price: 30,  is_liquor: false, ml_per_unit: null }, qty: 3 },
      { item: { id: iLimeWater.id,       selling_price: 80,  is_liquor: false, ml_per_unit: null }, qty: 2 },
    ],
  });
  await buildKOT({
    billId: bill3.id, tableNo: "T3", waiterId: uWaiter3.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: iTandooriChicken.id, selling_price: 360, is_liquor: false, ml_per_unit: null }, qty: 1 },
      { item: { id: iMuttonCurry.id,     selling_price: 420, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: iButterNaan.id,      selling_price: 50,  is_liquor: false, ml_per_unit: null }, qty: 6 },
    ],
  });
  const kot3c = await buildKOT({
    billId: bill3.id, tableNo: "T3", waiterId: uWaiter3.id, kotNo: kotNo(), status: "OPEN",
    items: [
      { item: { id: iGulabJamun.id,      selling_price: 100, is_liquor: false, ml_per_unit: null }, qty: 2 },
    ],
  });
  await prisma.kOT.update({ where: { id: kot3c.id }, data: { status: "SERVED" } });

  // ════════════════════════════════════════════════════════
  // BILL 4 — B1 (Bar) — OPEN — 2 KOTs (both closed)
  // ════════════════════════════════════════════════════════
  const bill4 = await createBill("B1", uCashier1.id);
  await buildKOT({
    billId: bill4.id, tableNo: "B1", waiterId: uWaiter1.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: rsw375.id,           selling_price: 340, is_liquor: true,  ml_per_unit: 375  }, qty: 2, saleMode: "BOTTLE" },
      { item: { id: iSoda.id,            selling_price: 30,  is_liquor: false, ml_per_unit: null }, qty: 4 },
      { item: { id: iVegPlatter.id,      selling_price: 220, is_liquor: false, ml_per_unit: null }, qty: 1 },
    ],
  });
  await buildKOT({
    billId: bill4.id, tableNo: "B1", waiterId: uWaiter1.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: mc750.id,            selling_price: 620, is_liquor: true,  ml_per_unit: 750  }, qty: 1, saleMode: "BOTTLE" },
      { item: { id: iChickenTikka.id,    selling_price: 320, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: iColdDrink.id,       selling_price: 60,  is_liquor: false, ml_per_unit: null }, qty: 2 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // BILL 5 — T5 — CLOSED (all KOTs done, waiting for payment)
  // ════════════════════════════════════════════════════════
  const bill5 = await createBill("T5", uCashier1.id);
  await buildKOT({
    billId: bill5.id, tableNo: "T5", waiterId: uWaiter2.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: iPaneerTikka.id,     selling_price: 260, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: iDalMakhni.id,       selling_price: 220, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: iPaneerBM.id,        selling_price: 280, is_liquor: false, ml_per_unit: null }, qty: 1 },
      { item: { id: iButterNaan.id,      selling_price: 50,  is_liquor: false, ml_per_unit: null }, qty: 8 },
      { item: { id: iWater.id,           selling_price: 30,  is_liquor: false, ml_per_unit: null }, qty: 2 },
    ],
  });
  await prisma.bill.update({ where: { id: bill5.id }, data: { status: "CLOSED" } });
  await prisma.tableStatus.update({ where: { table_no: "T5" }, data: { status: "BILLED" } });

  // ════════════════════════════════════════════════════════
  // BILL 6 — T6 — CLOSED (waiting for payment, bigger table)
  // ════════════════════════════════════════════════════════
  const bill6 = await createBill("T6", uCashier2.id);
  await buildKOT({
    billId: bill6.id, tableNo: "T6", waiterId: uWaiter3.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: iChickenTikka.id,    selling_price: 320, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: iFishTikka.id,       selling_price: 400, is_liquor: false, ml_per_unit: null }, qty: 1 },
      { item: { id: jd375.id,            selling_price: 1500, is_liquor: true, ml_per_unit: 375  }, qty: 2, saleMode: "BOTTLE" },
      { item: { id: sm750.id,            selling_price: 720, is_liquor: true,  ml_per_unit: 750  }, qty: 1, saleMode: "BOTTLE" },
      { item: { id: iSoda.id,            selling_price: 30,  is_liquor: false, ml_per_unit: null }, qty: 6 },
    ],
  });
  await buildKOT({
    billId: bill6.id, tableNo: "T6", waiterId: uWaiter3.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: iMuttonCurry.id,     selling_price: 420, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: iButterChicken.id,   selling_price: 340, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: iGarlicNaan.id,      selling_price: 60,  is_liquor: false, ml_per_unit: null }, qty: 8 },
      { item: { id: iIceCream.id,        selling_price: 120, is_liquor: false, ml_per_unit: null }, qty: 4 },
    ],
  });
  await prisma.bill.update({ where: { id: bill6.id }, data: { status: "CLOSED" } });
  await prisma.tableStatus.update({ where: { table_no: "T6" }, data: { status: "BILLED" } });

  // ════════════════════════════════════════════════════════
  // BILL 7 — T7 — PAID (settled, from yesterday)
  // ════════════════════════════════════════════════════════
  const bill7 = await prisma.bill.create({
    data: { table_no: "T7", user_id: uCashier1.id, status: "OPEN", total: 0, discount: 0, bill_date: daysAgo(1) },
  });
  await prisma.tableStatus.update({ where: { table_no: "T7" }, data: { status: "OCCUPIED", current_bill_id: bill7.id } });
  await buildKOT({
    billId: bill7.id, tableNo: "T7", waiterId: uWaiter2.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: iVegPlatter.id,      selling_price: 220, is_liquor: false, ml_per_unit: null }, qty: 1 },
      { item: { id: iEggPakoda.id,       selling_price: 160, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: oc750.id,            selling_price: 580, is_liquor: true,  ml_per_unit: 750  }, qty: 2, saleMode: "BOTTLE" },
      { item: { id: bud650.id,           selling_price: 180, is_liquor: true,  ml_per_unit: 650  }, qty: 3, saleMode: "BOTTLE" },
      { item: { id: iSoda.id,            selling_price: 30,  is_liquor: false, ml_per_unit: null }, qty: 4 },
      { item: { id: iWater.id,           selling_price: 30,  is_liquor: false, ml_per_unit: null }, qty: 2 },
    ],
  });
  const bill7Refreshed = await prisma.bill.findUnique({ where: { id: bill7.id } });
  await prisma.bill.update({ where: { id: bill7.id }, data: { status: "CLOSED" } });
  // Pay it
  await prisma.payment.create({
    data: { billId: bill7.id, method: "CASH", amount: bill7Refreshed!.total, note: "Full cash payment" },
  });
  await prisma.bill.update({ where: { id: bill7.id }, data: { status: "PAID" } });
  await prisma.tableStatus.update({ where: { table_no: "T7" }, data: { status: "VACANT", current_bill_id: null } });

  // ════════════════════════════════════════════════════════
  // BILL 8 — T8 — PAID (UPI + card split, from yesterday)
  // ════════════════════════════════════════════════════════
  const bill8 = await prisma.bill.create({
    data: { table_no: "T8", user_id: uCashier2.id, status: "OPEN", total: 0, discount: 100, bill_date: daysAgo(1) },
  });
  await prisma.tableStatus.update({ where: { table_no: "T8" }, data: { status: "OCCUPIED", current_bill_id: bill8.id } });
  await buildKOT({
    billId: bill8.id, tableNo: "T8", waiterId: uWaiter1.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: iChickenTikka.id,    selling_price: 320, is_liquor: false, ml_per_unit: null }, qty: 3 },
      { item: { id: iDalMakhni.id,       selling_price: 220, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: iRoti.id,            selling_price: 35,  is_liquor: false, ml_per_unit: null }, qty: 10 },
      { item: { id: iGulabJamun.id,      selling_price: 100, is_liquor: false, ml_per_unit: null }, qty: 3 },
      { item: { id: iColdDrink.id,       selling_price: 60,  is_liquor: false, ml_per_unit: null }, qty: 4 },
    ],
  });
  const bill8Refreshed = await prisma.bill.findUnique({ where: { id: bill8.id } });
  const b8Net = (bill8Refreshed!.total ?? 0) - 100;
  await prisma.bill.update({ where: { id: bill8.id }, data: { status: "CLOSED" } });
  await prisma.payment.create({ data: { billId: bill8.id, method: "UPI",        amount: Math.round(b8Net * 0.6), referenceNo: "UPI2026001", note: "UPI part" } });
  await prisma.payment.create({ data: { billId: bill8.id, method: "CREDITCARD", amount: Math.round(b8Net * 0.4), referenceNo: "POS2026001", note: "Card part" } });
  await prisma.bill.update({ where: { id: bill8.id }, data: { status: "PAID" } });
  await prisma.tableStatus.update({ where: { table_no: "T8" }, data: { status: "VACANT", current_bill_id: null } });

  // ════════════════════════════════════════════════════════
  // BILL 9 — B2 (Bar) — CREDIT (Ramesh udhar)
  // ════════════════════════════════════════════════════════
  const bill9 = await prisma.bill.create({
    data: { table_no: "B2", user_id: uCashier1.id, customer_id: cRamesh.id, status: "OPEN", total: 0, discount: 0, bill_date: daysAgo(3) },
  });
  await prisma.tableStatus.update({ where: { table_no: "B2" }, data: { status: "OCCUPIED", current_bill_id: bill9.id } });
  await buildKOT({
    billId: bill9.id, tableNo: "B2", waiterId: uWaiter2.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: rsw750.id,           selling_price: 650, is_liquor: true,  ml_per_unit: 750  }, qty: 2, saleMode: "BOTTLE" },
      { item: { id: iChickenTikka.id,    selling_price: 320, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: iSoda.id,            selling_price: 30,  is_liquor: false, ml_per_unit: null }, qty: 4 },
      { item: { id: iChicken65.id,       selling_price: 300, is_liquor: false, ml_per_unit: null }, qty: 1 },
    ],
  });
  // Close → mark credit → free table
  await prisma.bill.update({ where: { id: bill9.id }, data: { status: "CLOSED" } });
  await prisma.bill.update({ where: { id: bill9.id }, data: { status: "CREDIT" } });
  await prisma.tableStatus.update({ where: { table_no: "B2" }, data: { status: "VACANT", current_bill_id: null } });
  // Ramesh made a partial payment
  const bill9Data = await prisma.bill.findUnique({ where: { id: bill9.id } });
  await prisma.payment.create({
    data: { billId: bill9.id, method: "CASH", amount: 500, note: "Advance — rest later" },
  });

  // ════════════════════════════════════════════════════════
  // BILL 10 — T4 — CREDIT (Sunil bigger udhar)
  // ════════════════════════════════════════════════════════
  const bill10 = await prisma.bill.create({
    data: { table_no: "T4", user_id: uCashier2.id, customer_id: cSunil.id, status: "OPEN", total: 0, discount: 200, bill_date: daysAgo(7) },
  });
  await prisma.tableStatus.update({ where: { table_no: "T4" }, data: { status: "OCCUPIED", current_bill_id: bill10.id } });
  await buildKOT({
    billId: bill10.id, tableNo: "T4", waiterId: uWaiter3.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: jd750.id,            selling_price: 2800, is_liquor: true, ml_per_unit: 750  }, qty: 1, saleMode: "BOTTLE" },
      { item: { id: jw750.id,            selling_price: 3200, is_liquor: true, ml_per_unit: 750  }, qty: 1, saleMode: "BOTTLE" },
      { item: { id: iFishTikka.id,       selling_price: 400, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: iTandooriChicken.id, selling_price: 360, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: iSoda.id,            selling_price: 30,  is_liquor: false, ml_per_unit: null }, qty: 6 },
      { item: { id: iWater.id,           selling_price: 30,  is_liquor: false, ml_per_unit: null }, qty: 4 },
    ],
  });
  await buildKOT({
    billId: bill10.id, tableNo: "T4", waiterId: uWaiter3.id, kotNo: kotNo(), status: "CLOSED",
    items: [
      { item: { id: iMuttonCurry.id,     selling_price: 420, is_liquor: false, ml_per_unit: null }, qty: 3 },
      { item: { id: iGarlicNaan.id,      selling_price: 60,  is_liquor: false, ml_per_unit: null }, qty: 10 },
      { item: { id: iDalMakhni.id,       selling_price: 220, is_liquor: false, ml_per_unit: null }, qty: 2 },
      { item: { id: iIceCream.id,        selling_price: 120, is_liquor: false, ml_per_unit: null }, qty: 4 },
    ],
  });
  await prisma.bill.update({ where: { id: bill10.id }, data: { status: "CLOSED" } });
  await prisma.bill.update({ where: { id: bill10.id }, data: { status: "CREDIT" } });
  await prisma.tableStatus.update({ where: { table_no: "T4" }, data: { status: "VACANT", current_bill_id: null } });
  // Sunil paid 3000 of his tab
  await prisma.payment.create({
    data: { billId: bill10.id, method: "UPI", amount: 3000, referenceNo: "UPI2026090", note: "Partial UPI payment" },
  });

  // ══════════════════════════════════════════════════════════════
  // SUMMARY PRINT
  // ══════════════════════════════════════════════════════════════
  console.log("\n✅  Seed complete!\n");

  const [billCount, kotCount, itemCount, userCount] = await Promise.all([
    prisma.bill.count(),
    prisma.kOT.count(),
    prisma.item.count(),
    prisma.user.count(),
  ]);

  const bills = await prisma.bill.groupBy({ by: ["status"], _count: true });

  console.log("────────────────────────────────");
  console.log(`  Users      : ${userCount}`);
  console.log(`  Items      : ${itemCount}`);
  console.log(`  Bills      : ${billCount}`);
  console.log(`  KOTs       : ${kotCount}`);
  bills.forEach(b => console.log(`    ${b.status.padEnd(10)}: ${b._count}`));
  console.log("────────────────────────────────");
  console.log("\nLogin credentials:");
  console.log("  admin    / admin123");
  console.log("  manager  / pass123");
  console.log("  cashier1 / pass123");
  console.log("  waiter1  / pass123");
  console.log("────────────────────────────────\n");
}

main()
  .catch((e) => { console.error("❌  Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());