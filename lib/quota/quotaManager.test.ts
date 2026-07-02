import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkAndIncrement, getQuotaStatus, periodKeyFor } from "./quotaManager";

describe("periodKeyFor", () => {
  it("formate une cle YYYY-MM en base UTC", () => {
    expect(periodKeyFor(new Date("2026-07-01T12:00:00Z"))).toBe("2026-07");
    expect(periodKeyFor(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01");
  });

  it("distingue deux mois consecutifs (rollover)", () => {
    const juin = periodKeyFor(new Date("2026-06-30T23:00:00Z"));
    const juillet = periodKeyFor(new Date("2026-07-01T01:00:00Z"));
    expect(juin).not.toBe(juillet);
  });
});

describe("checkAndIncrement (integration)", () => {
  const service = `test-quota-${Date.now()}`;

  afterAll(async () => {
    await prisma.quotaUsage.deleteMany({ where: { service } });
  });

  it("autorise et incremente tant que la limite n'est pas atteinte", async () => {
    const first = await checkAndIncrement(service, 2);
    expect(first).toEqual({ allowed: true, count: 1, limit: 2, remaining: 1 });

    const second = await checkAndIncrement(service, 2);
    expect(second).toEqual({ allowed: true, count: 2, limit: 2, remaining: 0 });
  });

  it("bloque au plafond sans incrementer davantage", async () => {
    const third = await checkAndIncrement(service, 2);
    expect(third.allowed).toBe(false);
    expect(third.count).toBe(2);
    expect(third.remaining).toBe(0);
  });

  it("repart a zero sur une nouvelle periode (rollover mensuel)", async () => {
    const nextMonth = new Date("2027-01-15T00:00:00Z");
    const status = await checkAndIncrement(service, 2, nextMonth);
    expect(status).toEqual({ allowed: true, count: 1, limit: 2, remaining: 1 });

    await prisma.quotaUsage.deleteMany({ where: { service, periodKey: "2027-01" } });
  });

  it("getQuotaStatus ne modifie pas le compteur", async () => {
    const before = await getQuotaStatus(service, 2);
    const after = await getQuotaStatus(service, 2);
    expect(after.count).toBe(before.count);
  });

  it("gere deux increments quasi simultanes sans depasser la limite", async () => {
    const raceService = `${service}-race`;
    const [a, b, c] = await Promise.all([
      checkAndIncrement(raceService, 2),
      checkAndIncrement(raceService, 2),
      checkAndIncrement(raceService, 2),
    ]);
    const allowedCount = [a, b, c].filter((r) => r.allowed).length;
    expect(allowedCount).toBe(2);

    await prisma.quotaUsage.deleteMany({ where: { service: raceService } });
  });
});
