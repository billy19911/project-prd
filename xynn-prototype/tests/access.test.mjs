/**
 * Uji gate hak akses Ã¢â‚¬â€ lib/access.ts
 * ===================================
 *
 * Fokus utama: menutup DUA MODE KEGAGALAN SENYAP saat menambah tier baru.
 * Keduanya tidak memunculkan error, hanya membuat pengguna kehilangan akses:
 *
 *   (1) Fallthrough tier Ã¢â‚¬â€ `getAccessTier()` menjatuhkan planType yang tidak
 *       dikenal ke `"free"`. Pengguna tier baru kehilangan SEMUA akses berbayar.
 *
 *   (2) Perbandingan tier literal Ã¢â‚¬â€ gate seperti `canFork()` menulis
 *       `=== "pro"`, sehingga tier di atas Pro tidak ikut terbuka walau (1)
 *       sudah dibereskan.
 *
 * Menjalankan: npm test
 * Tanpa dependency tambahan (memakai node:test bawaan Node 22 + type stripping).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  isSubscriptionActive,
  getAccessTier,
  isPaid,
  isProOrAbove,
  canAccessVault,
  canFork,
  canExport,
  canUseCli,
  canGeneratePrd,
  canGenerateAdvanced,
  canDownloadMarkdown,
  canUsePrototype,
  canSaveThemes,
  canGeneratePrototype,
  remainingPrototypeQuota,
  computeStepAvailability,
} from "../lib/access.ts";

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 hari
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000); // kemarin

const sub = (over = {}) => ({
  planType: "PRO",
  status: "ACTIVE",
  validUntil: FUTURE,
  prdLimit: -1,
  prdUsedThisMonth: 0,
  ...over,
});

/**
 * Semua planType yang dikenal aplikasi.
 * Bila menambah tier baru (mis. ENTERPRISE), tambahkan ke daftar ini Ã¢â‚¬â€
 * uji di bawah akan langsung menunjukkan gate mana yang belum diperbarui.
 */
const PAID_PLAN_TYPES = ["STARTER", "PRO", "PRO_YEARLY", "ENTERPRISE"];
const ALL_PLAN_TYPES = ["FREE", ...PAID_PLAN_TYPES];

/* ------------------------------------------------------------------ */
/* isSubscriptionActive Ã¢â‚¬â€ status aktif & belum kedaluwarsa             */
/* ------------------------------------------------------------------ */

describe("isSubscriptionActive", () => {
  test("null / undefined Ã¢â€ â€™ false", () => {
    assert.equal(isSubscriptionActive(null), false);
    assert.equal(isSubscriptionActive(undefined), false);
  });

  test("planType FREE Ã¢â€ â€™ false walau status ACTIVE", () => {
    assert.equal(isSubscriptionActive(sub({ planType: "FREE" })), false);
  });

  test("status bukan ACTIVE Ã¢â€ â€™ false", () => {
    for (const status of ["INACTIVE", "CANCELLED", null, undefined, ""]) {
      assert.equal(
        isSubscriptionActive(sub({ status })),
        false,
        `status=${String(status)} seharusnya tidak aktif`
      );
    }
  });

  test("validUntil di masa lalu Ã¢â€ â€™ false", () => {
    assert.equal(isSubscriptionActive(sub({ validUntil: PAST })), false);
  });

  test("validUntil di masa depan Ã¢â€ â€™ true", () => {
    assert.equal(isSubscriptionActive(sub({ validUntil: FUTURE })), true);
  });

  test("validUntil null Ã¢â€ â€™ true (tanpa tanggal kedaluwarsa)", () => {
    assert.equal(isSubscriptionActive(sub({ validUntil: null })), true);
  });

  test("validUntil string ISO di masa depan Ã¢â€ â€™ true", () => {
    assert.equal(
      isSubscriptionActive(sub({ validUntil: FUTURE.toISOString() })),
      true
    );
  });

  test("validUntil string tidak valid Ã¢â€ â€™ false (bukan lolos)", () => {
    assert.equal(isSubscriptionActive(sub({ validUntil: "bukan-tanggal" })), false);
  });
});

/* ------------------------------------------------------------------ */
/* getAccessTier                                                       */
/* ------------------------------------------------------------------ */

describe("getAccessTier", () => {
  test("null Ã¢â€ â€™ free", () => {
    assert.equal(getAccessTier(null), "free");
  });

  test("FREE Ã¢â€ â€™ free (walau ACTIVE)", () => {
    assert.equal(getAccessTier(sub({ planType: "FREE" })), "free");
  });

  test("STARTER aktif Ã¢â€ â€™ starter", () => {
    assert.equal(getAccessTier(sub({ planType: "STARTER", prdLimit: 5 })), "starter");
  });

  test("PRO aktif Ã¢â€ â€™ pro", () => {
    assert.equal(getAccessTier(sub({ planType: "PRO" })), "pro");
  });

  test("PRO_YEARLY diperlakukan identik dengan PRO", () => {
    assert.equal(getAccessTier(sub({ planType: "PRO_YEARLY" })), "pro");
  });

  test("ENTERPRISE adalah tier tersendiri, bukan alias pro", () => {
    assert.equal(getAccessTier(sub({ planType: "ENTERPRISE" })), "enterprise");
  });

  test("berbayar tapi kedaluwarsa Ã¢â€ â€™ free", () => {
    assert.equal(getAccessTier(sub({ validUntil: PAST })), "free");
  });

  test("berbayar tapi CANCELLED Ã¢â€ â€™ free", () => {
    assert.equal(getAccessTier(sub({ status: "CANCELLED" })), "free");
  });

  /* ---- MODE KEGAGALAN (1): fallthrough tier ---- */

  test("planType tidak dikenal Ã¢â€ â€™ free, BUKAN tier lain", () => {
    // Mendokumentasikan perilaku fallthrough. Setiap tier baru yang nyata
    // HARUS ditangani di getAccessTier() sebelum baris `return "free"`,
    // kalau tidak penggunanya kehilangan seluruh akses berbayar.
    // ENTERPRISE kini ditangani, jadi ia BUKAN lagi bagian dari daftar ini.
    for (const unknown of ["STUDIO", "NOPE", "MEGA", ""]) {
      assert.equal(
        getAccessTier(sub({ planType: unknown })),
        "free",
        `planType "${unknown}" jatuh ke free Ã¢â‚¬â€ pastikan ini memang disengaja`
      );
    }
  });
});

/* ------------------------------------------------------------------ */
/* isPaid & gate turunannya                                            */
/* ------------------------------------------------------------------ */

describe("isPaid dan gate yang memakai isPaid()", () => {
  const paidGates = {
    isPaid,
    canAccessVault,
    canExport,
    canUseCli,
    canGenerateAdvanced,
    canDownloadMarkdown,
  };

  test("gratis / kedaluwarsa / null Ã¢â€ â€™ semua gate isPaid false", () => {
    const nonPaid = [null, undefined, sub({ planType: "FREE" }), sub({ validUntil: PAST })];
    for (const [name, fn] of Object.entries(paidGates)) {
      for (const s of nonPaid) {
        assert.equal(fn(s), false, `${name} seharusnya false untuk non-paid`);
      }
    }
  });

  test("SETIAP planType berbayar Ã¢â€ â€™ semua gate isPaid true", () => {
    // Uji ini otomatis mengungkap gate yang memakai perbandingan literal:
    // bila menambah tier ke PAID_PLAN_TYPES tapi gate-nya masih `=== "pro"`,
    // assertion di bawah gagal.
    for (const planType of PAID_PLAN_TYPES) {
      const s = sub({ planType });
      for (const [name, fn] of Object.entries(paidGates)) {
        assert.equal(
          fn(s),
          true,
          `${name} seharusnya true untuk planType=${planType} yang aktif`
        );
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* canFork Ã¢â‚¬â€ satu-satunya gate dengan perbandingan tier literal        */
/* ------------------------------------------------------------------ */

describe("canFork (gate khusus Pro)", () => {
  test("STARTER Ã¢â€ â€™ tidak boleh fork", () => {
    assert.equal(canFork(sub({ planType: "STARTER", prdLimit: 5 })), false);
  });

  test("PRO Ã¢â€ â€™ boleh fork", () => {
    assert.equal(canFork(sub({ planType: "PRO" })), true);
  });

  test("PRO_YEARLY dan ENTERPRISE boleh fork", () => {
    assert.equal(canFork(sub({ planType: "PRO_YEARLY" })), true);
    assert.equal(canFork(sub({ planType: "ENTERPRISE" })), true);
  });

  test("FREE / kedaluwarsa / null Ã¢â€ â€™ tidak boleh fork", () => {
    assert.equal(canFork(null), false);
    assert.equal(canFork(sub({ planType: "FREE" })), false);
    assert.equal(canFork(sub({ validUntil: PAST })), false);
  });

  /* ---- MODE KEGAGALAN (2): perbandingan tier literal ---- */

  test("REGRESI: canFork tidak boleh lebih ketat dari canExport", () => {
    // canFork memakai `=== "pro"` (literal), sedangkan canExport memakai
    // isPaid(). Bila kelak ada tier DI ATAS pro (mis. ENTERPRISE), canFork
    // harus ikut menyesuaikan Ã¢â‚¬â€ bukan hanya menerima "pro" persis.
    // Uji ini menangkap tier yang terbuka di canExport tapi tertutup di canFork.
    for (const planType of PAID_PLAN_TYPES) {
      const s = sub({ planType });
      if (canExport(s)) {
        assert.equal(
          canFork(s),
          planType === "PRO" || planType === "PRO_YEARLY" || planType === "ENTERPRISE",
          `canFork(${planType}) tidak konsisten Ã¢â‚¬â€ periksa perbandingan literal di canFork()`
        );
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* canGeneratePrd Ã¢â‚¬â€ kuota                                               */
/* ------------------------------------------------------------------ */

describe("canGeneratePrd (kuota PRD)", () => {
  test("non-paid Ã¢â€ â€™ false", () => {
    assert.equal(canGeneratePrd(null), false);
    assert.equal(canGeneratePrd(sub({ planType: "FREE" })), false);
    assert.equal(canGeneratePrd(sub({ validUntil: PAST })), false);
  });

  test("prdLimit -1 (unlimited) Ã¢â€ â€™ selalu true", () => {
    assert.equal(canGeneratePrd(sub({ prdLimit: -1, prdUsedThisMonth: 9999 })), true);
  });

  test("prdLimit 5: di bawah kuota Ã¢â€ â€™ true, tepat/sudah lewat Ã¢â€ â€™ false", () => {
    const s = (used) => sub({ planType: "STARTER", prdLimit: 5, prdUsedThisMonth: used });
    assert.equal(canGeneratePrd(s(0)), true);
    assert.equal(canGeneratePrd(s(4)), true);
    assert.equal(canGeneratePrd(s(5)), false, "tepat di limit harus terkunci");
    assert.equal(canGeneratePrd(s(6)), false);
  });

  test("prdLimit 0 Ã¢â€ â€™ terkunci", () => {
    assert.equal(canGeneratePrd(sub({ planType: "STARTER", prdLimit: 0 })), false);
  });

  test("prdLimit tidak ada (undefined) Ã¢â€ â€™ terkunci, bukan unlimited", () => {
    const s = sub({ planType: "STARTER" });
    delete s.prdLimit;
    assert.equal(canGeneratePrd(s), false);
  });
});

/* ------------------------------------------------------------------ */
/* computeStepAvailability Ã¢â‚¬â€ rantai prasyarat                          */
/* ------------------------------------------------------------------ */

describe("computeStepAvailability", () => {
  test("semua kosong Ã¢â€ â€™ semua tertutup", () => {
    const r = computeStepAvailability({
      sub: sub(),
      hasMindmap: false,
      hasPrd: false,
      hasTasks: false,
    });
    assert.deepEqual(r, { mindmap: false, prd: false, tasks: false, style: false });
  });

  test("free dengan mindmap Ã¢â€ â€™ hanya mindmap terbuka", () => {
    const r = computeStepAvailability({
      sub: sub({ planType: "FREE" }),
      hasMindmap: true,
      hasPrd: false,
      hasTasks: false,
    });
    assert.deepEqual(r, { mindmap: true, prd: false, tasks: false, style: false });
  });

  test("berbayar + mindmap Ã¢â€ â€™ prd terbuka, task/style belum", () => {
    const r = computeStepAvailability({
      sub: sub({ planType: "STARTER" }),
      hasMindmap: true,
      hasPrd: false,
      hasTasks: false,
    });
    assert.deepEqual(r, { mindmap: true, prd: true, tasks: false, style: false });
  });

  test("berbayar + prd + task Ã¢â€ â€™ task & style terbuka", () => {
    const r = computeStepAvailability({
      sub: sub({ planType: "STARTER" }),
      hasMindmap: true,
      hasPrd: true,
      hasTasks: true,
    });
    assert.deepEqual(r, { mindmap: true, prd: true, tasks: true, style: true });
  });

  test("prasyarat tidak dilompati: ada prd tanpa mindmap Ã¢â€ â€™ prd tertutup", () => {
    const r = computeStepAvailability({
      sub: sub(),
      hasMindmap: false,
      hasPrd: true,
      hasTasks: false,
    });
    assert.equal(r.prd, false, "PRD butuh mindmap lebih dulu");
  });

  test("tasks mengikuti hasPrd (bukan hasMindmap) Ã¢â‚¬â€ sesuai rantai API", () => {
    // tasks/route.ts mensyaratkan fullPrdMd. Karena PRD sendiri sudah
    // mensyaratkan mindmap, ketergantungan ini bersifat transitif.
    const tanpaPrd = computeStepAvailability({
      sub: sub(),
      hasMindmap: true,
      hasPrd: false,
      hasTasks: false,
    });
    assert.equal(tanpaPrd.tasks, false, "tanpa PRD, task tertutup");

    const denganPrd = computeStepAvailability({
      sub: sub(),
      hasMindmap: true,
      hasPrd: true,
      hasTasks: false,
    });
    assert.equal(denganPrd.tasks, true, "dengan PRD, task terbuka");
  });

  /**
   * CATATAN: dahulu `computeStepAvailability` menghitung `style: paid && hasPrd`,
   * sehingga melaporkan langkah "style" TERBUKA padahal server menolaknya (400)
   * karena `styleGuide/route.ts` mensyaratkan `tasksJson`. Sudah diperbaiki
   * menjadi `paid && hasTasks`. Uji di bawah mengunci perilaku yang benar.
   */
  test("style mengikuti hasTasks (sesuai syarat server)", () => {
    const tanpaTasks = computeStepAvailability({
      sub: sub(),
      hasMindmap: true,
      hasPrd: true,
      hasTasks: false,
    });
    assert.equal(
      tanpaTasks.style,
      false,
      "tanpa Task Breakdown, Style Guide harus tertutup (server menolak 400)"
    );

    const denganTasks = computeStepAvailability({
      sub: sub(),
      hasMindmap: true,
      hasPrd: true,
      hasTasks: true,
    });
    assert.equal(denganTasks.style, true, "dengan Task Breakdown, Style terbuka");
  });
  test("langganan kedaluwarsa Ã¢â€ â€™ hanya mindmap (yang gratis)", () => {
    const r = computeStepAvailability({
      sub: sub({ validUntil: PAST }),
      hasMindmap: true,
      hasPrd: true,
      hasTasks: false,
    });
    assert.deepEqual(r, { mindmap: true, prd: false, tasks: false, style: false });
  });
});

/* ------------------------------------------------------------------ */
/* canUsePrototype & canSaveThemes (tier baru)                         */
/* ------------------------------------------------------------------ */

describe("canUsePrototype (pembeda Starter vs Pro)", () => {
  test("FREE & STARTER tidak boleh", () => {
    assert.equal(canUsePrototype(null), false);
    assert.equal(canUsePrototype(sub({ planType: "FREE" })), false);
    assert.equal(canUsePrototype(sub({ planType: "STARTER", prdLimit: 5 })), false);
  });

  test("PRO, PRO_YEARLY, & ENTERPRISE boleh", () => {
    assert.equal(canUsePrototype(sub({ planType: "PRO" })), true);
    assert.equal(canUsePrototype(sub({ planType: "PRO_YEARLY" })), true);
    assert.equal(canUsePrototype(sub({ planType: "ENTERPRISE" })), true);
  });

  test("kedaluwarsa -> tidak boleh", () => {
    assert.equal(canUsePrototype(sub({ planType: "ENTERPRISE", validUntil: PAST })), false);
  });
});

/* ------------------------------------------------------------------ */
/* canSaveThemes (pembeda Pro vs Enterprise)                           */
/* ------------------------------------------------------------------ */

describe("canSaveThemes (library tema lintas-project)", () => {
  test("hanya ENTERPRISE yang boleh", () => {
    assert.equal(canSaveThemes(null), false);
    assert.equal(canSaveThemes(sub({ planType: "FREE" })), false);
    assert.equal(canSaveThemes(sub({ planType: "STARTER" })), false);
    assert.equal(canSaveThemes(sub({ planType: "PRO" })), false);
    assert.equal(canSaveThemes(sub({ planType: "PRO_YEARLY" })), false);
    assert.equal(canSaveThemes(sub({ planType: "ENTERPRISE" })), true);
  });

  test("kedaluwarsa -> tidak boleh", () => {
    assert.equal(canSaveThemes(sub({ planType: "ENTERPRISE", validUntil: PAST })), false);
  });
});

/* ------------------------------------------------------------------ */
/* canGeneratePrototype & remainingPrototypeQuota (penjaga biaya AI)    */
/* ------------------------------------------------------------------ */

describe("canGeneratePrototype (kuota prototype)", () => {
  const proto = (over = {}) =>
    sub({ planType: "PRO", prototypeLimit: 20, prototypeUsedThisMonth: 0, ...over });

  test("non-Pro -> false walau kuota tersedia", () => {
    assert.equal(canGeneratePrototype(null), false);
    assert.equal(
      canGeneratePrototype(sub({ planType: "FREE", prototypeLimit: 20 })),
      false
    );
    assert.equal(
      canGeneratePrototype(sub({ planType: "STARTER", prototypeLimit: 20 })),
      false
    );
  });

  test("Pro dengan kuota tersisa -> true", () => {
    assert.equal(canGeneratePrototype(proto({ prototypeUsedThisMonth: 0 })), true);
    assert.equal(canGeneratePrototype(proto({ prototypeUsedThisMonth: 19 })), true);
  });

  test("kuota habis -> false (tepat di limit & sudah lewat)", () => {
    assert.equal(
      canGeneratePrototype(proto({ prototypeUsedThisMonth: 20 })),
      false,
      "tepat di limit harus terkunci"
    );
    assert.equal(canGeneratePrototype(proto({ prototypeUsedThisMonth: 21 })), false);
  });

  test("prototypeLimit -1 (unlimited) -> selalu true", () => {
    assert.equal(
      canGeneratePrototype(
        sub({ planType: "ENTERPRISE", prototypeLimit: -1, prototypeUsedThisMonth: 9999 })
      ),
      true
    );
  });

  test("prototypeLimit tidak ada -> terkunci, BUKAN unlimited", () => {
    const s = sub({ planType: "PRO" });
    delete s.prototypeLimit;
    assert.equal(
      canGeneratePrototype(s),
      false,
      "limit undefined harus terkunci (fallback 0), bukan dianggap unlimited"
    );
  });

  test("kedaluwarsa -> false walau kuota tersisa", () => {
    assert.equal(canGeneratePrototype(proto({ validUntil: PAST })), false);
  });
});

describe("remainingPrototypeQuota", () => {
  test("unlimited (-1) -> null", () => {
    assert.equal(
      remainingPrototypeQuota(sub({ planType: "ENTERPRISE", prototypeLimit: -1 })),
      null
    );
  });

  test("menghitung sisa dengan benar", () => {
    assert.equal(
      remainingPrototypeQuota(sub({ prototypeLimit: 20, prototypeUsedThisMonth: 3 })),
      17
    );
    assert.equal(
      remainingPrototypeQuota(sub({ prototypeLimit: 20, prototypeUsedThisMonth: 0 })),
      20
    );
  });

  test("tidak pernah negatif walau pemakaian melebihi limit", () => {
    assert.equal(
      remainingPrototypeQuota(sub({ prototypeLimit: 20, prototypeUsedThisMonth: 20 })),
      0
    );
    assert.equal(
      remainingPrototypeQuota(sub({ prototypeLimit: 20, prototypeUsedThisMonth: 99 })),
      0
    );
  });

  test("limit tidak ada -> 0", () => {
    const s = sub({ planType: "PRO" });
    delete s.prototypeLimit;
    assert.equal(remainingPrototypeQuota(s), 0);
  });
});

/* ------------------------------------------------------------------ */
/* Konsistensi menyeluruh antar planType                               */
/* ------------------------------------------------------------------ */

describe("konsistensi gate lintas planType", () => {
  /**
   * Tabel kebenaran: untuk SETIAP planType, catat tier efektif dan
   * pastikan semua gate konsisten dengan tier tersebut.
   * Inilah uji yang akan gagal paling jelas saat tier baru ditambahkan
   * tanpa memperbarui gate.
   */
  test("semua planType aktif menghasilkan gate yang konsisten dengan tier-nya", () => {
    const expected = {
      FREE: { paid: false, fork: false, proto: false, themes: false },
      STARTER: { paid: true, fork: false, proto: false, themes: false },
      PRO: { paid: true, fork: true, proto: true, themes: false },
      PRO_YEARLY: { paid: true, fork: true, proto: true, themes: false },
      ENTERPRISE: { paid: true, fork: true, proto: true, themes: true },
    };

    for (const planType of ALL_PLAN_TYPES) {
      const s = sub({ planType });
      const exp = expected[planType];
      assert.ok(exp, `planType ${planType} belum ada di tabel harapan`);
      assert.equal(isPaid(s), exp.paid, `isPaid(${planType})`);
      assert.equal(isProOrAbove(s), exp.proto, `isProOrAbove(${planType})`);
      assert.equal(canFork(s), exp.fork, `canFork(${planType})`);
      assert.equal(canExport(s), exp.paid, `canExport(${planType})`);
      assert.equal(canUseCli(s), exp.paid, `canUseCli(${planType})`);
      assert.equal(canAccessVault(s), exp.paid, `canAccessVault(${planType})`);
      assert.equal(canUsePrototype(s), exp.proto, `canUsePrototype(${planType})`);
      assert.equal(canSaveThemes(s), exp.themes, `canSaveThemes(${planType})`);
    }
  });

  test("tidak ada planType berbayar yang bocor menjadi tier free", () => {
    // Penjaga utama mode kegagalan (1).
    for (const planType of PAID_PLAN_TYPES) {
      const s = sub({ planType });
      assert.notEqual(
        getAccessTier(s),
        "free",
        `planType ${planType} yang aktif TIDAK boleh dianggap free`
      );
    }
  });
});
