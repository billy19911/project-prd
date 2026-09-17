/**
 * Uji logika akses workspace berbasis organisasi.
 * ================================================
 *
 * Fokus: aturan yang menentukan siapa boleh LIHAT, UBAH, dan KELOLA sebuah
 * workspace. Aturan ini dulunya menyebabkan dua mode kegagalan nyata:
 *
 *   (1) Anggota tim salah DITOLAK karena query memakai `where: { userId }`.
 *   (2) OWNER org salah DITOLAK menghapus workspace org (sisa cek userId).
 *
 * Logika murni diuji di sini tanpa database (lihat `lib/workspace-access-core.ts`).
 * Menjalankan: npm test
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  resolveWorkspaceAccess,
  roleCanEdit,
  roleCanManage,
  roleCanCreateWorkspace,
  NO_ACCESS,
} from "../lib/workspace-access-core.ts";

const ALICE = "user-alice";
const BOB = "user-bob";
const CAROL = "user-carol";

/** Workspace pribadi milik Alice. */
const personal = (owner = ALICE) => ({ userId: owner, organizationId: null });
/** Workspace milik organisasi (dibuat Alice), org = "org-1". */
const orgWs = (owner = ALICE) => ({ userId: owner, organizationId: "org-1" });

/* ------------------------------------------------------------------ */
/* roleCanEdit / roleCanManage                                         */
/* ------------------------------------------------------------------ */

describe("roleCanEdit", () => {
  test("OWNER & EDITOR boleh mengubah", () => {
    assert.equal(roleCanEdit("OWNER"), true);
    assert.equal(roleCanEdit("EDITOR"), true);
  });
  test("VIEWER tidak boleh mengubah", () => {
    assert.equal(roleCanEdit("VIEWER"), false);
  });
});

describe("roleCanManage", () => {
  test("hanya OWNER yang boleh mengelola", () => {
    assert.equal(roleCanManage("OWNER"), true);
    assert.equal(roleCanManage("EDITOR"), false);
    assert.equal(roleCanManage("VIEWER"), false);
  });
});

describe("roleCanCreateWorkspace", () => {
  test("OWNER & EDITOR boleh menambah workspace", () => {
    assert.equal(roleCanCreateWorkspace("OWNER"), true);
    assert.equal(roleCanCreateWorkspace("EDITOR"), true);
  });
  test("VIEWER tidak boleh menambah workspace", () => {
    assert.equal(roleCanCreateWorkspace("VIEWER"), false);
  });
});

/* ------------------------------------------------------------------ */
/* Workspace pribadi                                                   */
/* ------------------------------------------------------------------ */

describe("resolveWorkspaceAccess — workspace pribadi", () => {
  test("pemilik pribadi mendapat akses penuh", () => {
    const a = resolveWorkspaceAccess(personal(ALICE), ALICE, null);
    assert.deepEqual(a, {
      canView: true,
      canEdit: true,
      canManage: true,
      role: "OWNER_PERSONAL",
      isOrgWorkspace: false,
    });
  });

  test("orang lain tidak punya akses (bahkan bila punya peran org)", () => {
    const a = resolveWorkspaceAccess(personal(ALICE), BOB, "OWNER");
    assert.deepEqual(a, NO_ACCESS);
  });
});

/* ------------------------------------------------------------------ */
/* Workspace organisasi                                                */
/* ------------------------------------------------------------------ */

describe("resolveWorkspaceAccess — workspace organisasi", () => {
  test("pembuat (pemilik pribadi) tetap akses penuh walau milik org", () => {
    const a = resolveWorkspaceAccess(orgWs(ALICE), ALICE, null);
    assert.equal(a.canView, true);
    assert.equal(a.canEdit, true);
    assert.equal(a.canManage, true);
    assert.equal(a.role, "OWNER_PERSONAL");
    assert.equal(a.isOrgWorkspace, true);
  });

  test("anggota EDITOR boleh lihat & ubah, tapi tidak kelola", () => {
    const a = resolveWorkspaceAccess(orgWs(ALICE), BOB, "EDITOR");
    assert.equal(a.canView, true);
    assert.equal(a.canEdit, true);
    assert.equal(a.canManage, false);
    assert.equal(a.role, "EDITOR");
    assert.equal(a.isOrgWorkspace, true);
  });

  test("anggota VIEWER hanya boleh lihat", () => {
    const a = resolveWorkspaceAccess(orgWs(ALICE), CAROL, "VIEWER");
    assert.equal(a.canView, true);
    assert.equal(a.canEdit, false);
    assert.equal(a.canManage, false);
    assert.equal(a.role, "VIEWER");
  });

  test("anggota OWNER org boleh kelola (bukan pembuat workspace)", () => {
    // Skenario bug lama: OWNER org yang BUKAN pembuat workspace harus bisa
    // menghapus. resolveWorkspaceAccess memberinya canManage = true.
    const a = resolveWorkspaceAccess(orgWs(ALICE), BOB, "OWNER");
    assert.equal(a.canView, true);
    assert.equal(a.canEdit, true);
    assert.equal(a.canManage, true);
    assert.equal(a.role, "OWNER");
  });

  test("bukan anggota org => tidak ada akses", () => {
    const a = resolveWorkspaceAccess(orgWs(ALICE), BOB, null);
    assert.deepEqual(a, NO_ACCESS);
  });
});
