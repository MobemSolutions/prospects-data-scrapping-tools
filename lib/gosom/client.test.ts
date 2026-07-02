import { describe, expect, it } from "vitest";
import { parseResultsCsv } from "./client";

// En-tetes exacts issus de gmaps.Entry.CsvHeaders() (gosom/google-maps-scraper,
// verifie sur le code source le 2026-07-01).
const HEADERS = [
  "input_id",
  "link",
  "title",
  "category",
  "address",
  "open_hours",
  "popular_times",
  "website",
  "phone",
  "plus_code",
  "review_count",
  "review_rating",
  "reviews_per_rating",
  "latitude",
  "longitude",
  "cid",
  "status",
  "descriptions",
  "reviews_link",
  "thumbnail",
  "timezone",
  "price_range",
  "data_id",
  "street_view_url",
  "place_id",
  "images",
  "reservations",
  "order_online",
  "menu",
  "owner",
  "complete_address",
  "credit_cards_accepted",
  "about",
  "user_reviews",
  "user_reviews_extended",
  "emails",
];

function csvCell(value: string) {
  // gosom stringifie les colonnes complexes en JSON; papaparse a besoin des
  // guillemets doubles internes echappes en CSV standard ("" au lieu de ").
  return `"${value.replace(/"/g, '""')}"`;
}

function buildCsv(rows: Record<string, string>[]) {
  const lines = [HEADERS.join(",")];
  for (const row of rows) {
    lines.push(HEADERS.map((h) => csvCell(row[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

describe("parseResultsCsv", () => {
  it("parse une ligne complete avec site web et photos", () => {
    const csv = buildCsv([
      {
        place_id: "ChIJ123",
        data_id: "0x0:0x1",
        cid: "12345",
        title: "Plomberie Dupont",
        category: "Plombier",
        address: "12 rue de Paris, 75015 Paris",
        website: "https://plomberie-dupont.fr",
        phone: "+33612345678",
        review_count: "42",
        review_rating: "4.5",
        latitude: "48.8417",
        longitude: "2.2989",
        thumbnail: "https://example.com/thumb.jpg",
        images: JSON.stringify([
          { title: "Photo 1", image: "https://example.com/1.jpg" },
          { title: "Photo 2", image: "https://example.com/2.jpg" },
        ]),
        open_hours: JSON.stringify({ monday: ["09:00-18:00"] }),
      },
    ]);

    const results = parseResultsCsv(csv);
    expect(results).toHaveLength(1);

    const r = results[0];
    expect(r.placeId).toBe("ChIJ123");
    expect(r.name).toBe("Plomberie Dupont");
    expect(r.website).toBe("https://plomberie-dupont.fr");
    expect(r.phone).toBe("+33612345678");
    expect(r.reviewCount).toBe(42);
    expect(r.rating).toBe(4.5);
    expect(r.imageCount).toBe(2);
    expect(r.thumbnailUrl).toBe("https://example.com/thumb.jpg");
    expect(r.latitude).toBeCloseTo(48.8417);
    expect(r.longitude).toBeCloseTo(2.2989);
  });

  it("exclut la vignette Street View du comptage de photos", () => {
    const csv = buildCsv([
      {
        place_id: "ChIJ789",
        title: "THIBAUD",
        address: "1 rue Test, 44000 Nantes",
        review_count: "5",
        review_rating: "4.0",
        images: JSON.stringify([
          { title: "Tout", image: "https://lh3.googleusercontent.com/gps-cs-s/photo1.jpg" },
          { title: "Extérieur", image: "https://lh3.googleusercontent.com/gps-cs-s/photo2.jpg" },
          {
            title: "Street View et 360°",
            image: "https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=abc",
          },
        ]),
      },
    ]);

    const results = parseResultsCsv(csv);
    expect(results[0].imageCount).toBe(2);
  });

  it("gere l'absence de site web, de note et de photos", () => {
    const csv = buildCsv([
      {
        place_id: "ChIJ456",
        title: "Boulangerie du Coin",
        address: "3 avenue de Lyon, 69003 Lyon",
        review_count: "0",
        review_rating: "",
        website: "",
        images: "[]",
      },
    ]);

    const results = parseResultsCsv(csv);
    const r = results[0];

    expect(r.website).toBeNull();
    expect(r.rating).toBeNull();
    expect(r.reviewCount).toBe(0);
    expect(r.imageCount).toBe(0);
    expect(r.thumbnailUrl).toBeNull();
  });

  it("ignore les lignes sans titre", () => {
    const csv = buildCsv([{ place_id: "x", title: "" }]);
    expect(parseResultsCsv(csv)).toHaveLength(0);
  });

  it("retourne un tableau vide pour un CSV avec uniquement l'en-tete", () => {
    const csv = buildCsv([]);
    expect(parseResultsCsv(csv)).toEqual([]);
  });
});
