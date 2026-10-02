import "dotenv/config";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3001;
const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, placesKeyConfigured: Boolean(process.env.GOOGLE_PLACES_API_KEY) });
});

app.get("/api/leads", async (req, res) => {
  const city = String(req.query.city || "").trim();
  const category = String(req.query.category || "Diş Kliniği").trim();
  const keyword = String(req.query.keyword || "").trim();

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return res.status(500).json({ error: "GOOGLE_PLACES_API_KEY bulunamadı. .env dosyanı kontrol et." });
  }
  if (!city) {
    return res.status(400).json({ error: "Şehir alanı zorunlu." });
  }

  const textQuery = [category, keyword, city].filter(Boolean).join(" ");

  try {
    const response = await fetch(PLACES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.nationalPhoneNumber",
          "places.websiteUri",
          "places.googleMapsUri",
          "places.primaryType"
        ].join(",")
      },
      body: JSON.stringify({
        textQuery,
        pageSize: 20,
        languageCode: "tr",
        regionCode: "TR"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Google Places API isteği başarısız."
      });
    }

    const leads = (data.places || []).map((place) => {
      const address = place.formattedAddress || "";
      return {
        id: place.id,
        name: place.displayName?.text || "İsimsiz işletme",
        address,
        city,
        category,
        website: place.websiteUri || "",
        instagram: "",
        phone: place.nationalPhoneNumber || "",
        mapsUrl: place.googleMapsUri || "",
        status: "Yeni"
      };
    });

    res.json({ leads, count: leads.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Google Places bağlantısı sırasında hata oluştu." });
  }
});

app.listen(PORT, () => {
  console.log("Vercodex API: http://localhost:" + PORT);
});
