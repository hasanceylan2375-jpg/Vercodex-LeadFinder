import "dotenv/config";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3001;
const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

const categoryQueries = {
  "Diş Kliniği": ["diş kliniği","diş hekimi","diş polikliniği","ağız ve diş sağlığı","diş muayenehanesi","dental klinik","dental clinic","ağız diş çene"],
  Emlak: ["emlak","emlak ofisi","gayrimenkul","gayrimenkul danışmanı","real estate","property"],
  Kafe: ["kafe","cafe","kahve","coffee shop","coffee"],
  "Güzellik Merkezi": ["güzellik merkezi","güzellik salonu","beauty center","estetik merkezi","cilt bakım merkezi"],
  Kuaför: ["kuaför","berber","hair salon","saç tasarım"],
  Restoran: ["restoran","restaurant","lokanta","yemek","steakhouse"],
  "Oto Servis": ["oto servis","oto tamir","otomotiv servis","araba servisi","auto service"]
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function placesSearch(textQuery, pageToken = null) {
  const fieldMask = [
    "places.id","places.displayName","places.formattedAddress","places.nationalPhoneNumber",
    "places.websiteUri","places.googleMapsUri","places.primaryType","places.rating",
    "places.userRatingCount","nextPageToken"
  ].join(",");

  const body = { textQuery, pageSize: 20, languageCode: "tr", regionCode: "TR" };
  if (pageToken) body.pageToken = pageToken;

  const response = await fetch(PLACES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": fieldMask
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Google Places API isteği başarısız.");
  return data;
}

function buildPlaceQueries(city, category, keyword) {
  const variants = categoryQueries[category] || [category];
  const suffix = keyword ? ` ${keyword}` : "";
  return [...new Set(variants.map(term => `${city} ${term}${suffix}`))];
}

async function searchPlacesQuery(textQuery) {
  const results = [];
  let pageToken = null;

  for (let page = 0; page < 3; page += 1) {
    const data = await placesSearch(textQuery, pageToken);
    results.push(...(data.places || []));
    pageToken = data.nextPageToken || null;
    if (!pageToken) break;
    await sleep(1200);
  }

  return results;
}

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
  if (!city) return res.status(400).json({ error: "Şehir alanı zorunlu." });

  try {
    const queries = buildPlaceQueries(city, category, keyword);
    const batches = await Promise.all(queries.map(searchPlacesQuery));
    const allPlaces = batches.flat();

    const uniquePlaces = Array.from(new Map(allPlaces.map(place => [place.id, place])).values());

    const leads = uniquePlaces.map(place => ({
      id: place.id,
      name: place.displayName?.text || "İsimsiz işletme",
      address: place.formattedAddress || "",
      city,
      category,
      website: place.websiteUri || "",
      instagram: "",
      phone: place.nationalPhoneNumber || "",
      mapsUrl: place.googleMapsUri || "",
      rating: place.rating ?? null,
      reviewCount: place.userRatingCount ?? 0,
      status: "Yeni"
    }));

    res.json({ leads, count: leads.length, searchCount: queries.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Google Places bağlantısı sırasında hata oluştu." });
  }
});

app.listen(PORT, () => console.log("Vercodex API: http://localhost:" + PORT));
