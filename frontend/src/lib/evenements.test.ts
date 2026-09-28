import assert from "node:assert/strict";
import test from "node:test";
import { champsDateEvenement, cleMoisEvenement, creerCalendrierIcs, dateLocaleVersIso, formaterHeureEvenement } from "./evenements";

test("horaire du lieu conservé entre Bamako, Paris et Montréal", () => {
  assert.equal(dateLocaleVersIso("2026-10-18", "09:00", "Africa/Bamako"), "2026-10-18T09:00:00.000Z");
  assert.equal(dateLocaleVersIso("2026-10-18", "09:00", "Europe/Paris"), "2026-10-18T07:00:00.000Z");
  assert.equal(dateLocaleVersIso("2026-12-18", "09:00", "Europe/Paris"), "2026-12-18T08:00:00.000Z");
  assert.equal(dateLocaleVersIso("2026-10-18", "09:00", "America/Toronto"), "2026-10-18T13:00:00.000Z");
  assert.equal(formaterHeureEvenement("2026-10-18T07:00:00Z", "Europe/Paris"), "09:00");
});
test("dates invalides et heures DST ambiguës ou absentes refusées", () => {
  assert.throws(() => dateLocaleVersIso("2026-02-30", "09:00", "Africa/Bamako"));
  assert.throws(() => dateLocaleVersIso("2026-03-29", "02:30", "Europe/Paris"), /n’existe pas/);
  assert.throws(() => dateLocaleVersIso("2026-10-25", "02:30", "Europe/Paris"), /deux fois/);
  assert.throws(() => dateLocaleVersIso("2026-10-18", "29:00", "Africa/Bamako"));
  assert.throws(() => dateLocaleVersIso("2026-10-18", "09:00", "zone-inconnue"));
});
test("regroupement des mois utilise le lieu, y compris changement de jour UTC", () => {
  assert.deepEqual(champsDateEvenement("2026-09-30T23:30:00Z", "Europe/Paris"), {jour:"2026-10-01",heure:"01:30"});
  assert.equal(cleMoisEvenement("2026-10-01T01:30:00Z", "America/Toronto"), "2026-09");
});
test("calendrier ICS conserve UTC, échappe les données et replie les lignes UTF-8", () => {
  const ics = creerCalendrierIcs({ id:"event-1", titre:"Réunion, Mali; Diaspora\nSUITE", description:"Échanges 🌍 ".repeat(30), dateDebut:"2026-10-18T07:00:00Z", dateFin:"2026-10-18T09:00:00Z", lieu:"Paris 8e", type:"PRESENTIEL" }, "https://mali-wuli.com/evenements/event-1", new Date("2026-09-28T10:00:00Z"));
  assert(ics.includes("DTSTART:20261018T070000Z\r\nDTEND:20261018T090000Z"));
  assert(ics.includes("SUMMARY:Réunion\\, Mali\\; Diaspora\\nSUITE"));
  assert(ics.includes("UID:event-1@mali-wuli.com"));
  assert(ics.split("\r\n").every(l=>Buffer.byteLength(l,"utf8")<=75));
  assert.equal(ics.split("BEGIN:VEVENT").length,2);
  assert(ics.endsWith("END:VCALENDAR\r\n"));
});
