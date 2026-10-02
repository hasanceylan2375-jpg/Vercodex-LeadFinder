import "dotenv/config";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3001;
const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";
const SEARCH_URL = "https://www.googleapis.com/customsearch/v1";

const categoryQueries = {
  "Diş Kliniği": [
    "diş kliniği",
    "diş hekimi",
    "diş polikliniği",
    "ağız ve diş sağlığı",
    "diş muayenehanesi",
    "dental klinik",
    "dental clinic",
    "ağız diş çene"
  ],
  Emlak: [
    "emlak",
    "emlak ofisi",
    "gayrimenkul",
    "gayrimenkul danışmanı",
    "real estate",
    "property"
  ],
  Kafe: ["kafe", "cafe", "kahve", "coffee shop", "coffee"],
  "Güzellik Merkezi": ["güzellik merkezi", "güzellik salonu", "beauty center", "estetik merkezi", "cilt bakım merkezi"],
  Kuaför: ["kuaför", "berber", "hair salon", "saç tasarım"],
  Restoran: ["restoran", "restaurant", "lokanta", "yemek", "steakhouse"],
  "Oto Servis": ["oto servis", "oto tamir", "otomotiv servis", "araba servisi", "auto service"]
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function placesSearch(textQuery, pageToken = null) {
  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.nationalPhoneNumber",
    "places.websiteUri",
    "places.googleMapsUri",
    "places.primaryType",
    "places.rating",
    "places.userRatingCount",
    "nextPageToken"
  ].join(",");

  const body = {
    textQuery,
    pageSize: 20,
    languageCode: "tr",
    regionCode: "TR"
  };

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

  if (!response.ok) {
    throw new Error(data?.error?.message || "Google Places API isteği başarısız.");
  }

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

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function instagramCandidateScore(result, business) {
  const link = String(result.link || "");
  if (!/^https?:\/\/(www\.)?instagram\.com\//i.test(link)) return -1;

  const path = new URL(link).pathname.replace(/^\/+|\/+$/g, "");
  if (!path || /^(p|reel|reels|explore|accounts|about|direct|stories|tv)(\/|$)/i.test(path)) return -1;

  const name = normalizeText(business.name);
  const title = normalizeText(result.title);
  const snippet = normalizeText(result.snippet);
  const haystack = `${title} ${snippet} ${path}`;
  const words = name.split(" ").filter(word => word.length >= 3);

  let score = 0;
  for (const word of words) {
    if (haystack.includes(word)) score += 2;
  }

  if (normalizeText(business.city) && haystack.includes(normalizeText(business.city))) score += 1;
  if (business.phone && normalizeText(result.snippet).includes(normalizeText(business.phone))) score += 5;

  return score;
}

async function googleSearchInstagram(query) {
  const params = new URLSearchParams({
    key: process.env.GOOGLE_CSE_API_KEY,
    cx: process.env.GOOGLE_CSE_ID,
    q: query,
    num: "10",
    gl: "tr",
    hl: "tr",
    safe: "active"
  });

  const response = await fetch(`${SEARCH_URL}?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Google web araması başarısız.");
  }

  return data.items || [];
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    placesKeyConfigured: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    instagramSearchConfigured: Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID)
  });
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

  try {
    const queries = buildPlaceQueries(city, category, keyword);
    const batches = await Promise.all(queries.map(searchPlacesQuery));
    const allPlaces = batches.flat();

    const uniquePlaces = Array.from(
      new Map(allPlaces.map(place => [place.id, place])).values()
    );

    const leads = uniquePlaces.map((place) => ({
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

    res.json({
      leads,
      count: leads.length,
      searchCount: queries.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Google Places bağlantısı sırasında hata oluştu." });
  }
});

app.get("/api/instagram-search", async (req, res) => {
  if (!process.env.GOOGLE_CSE_API_KEY || !process.env.GOOGLE_CSE_ID) {
    return res.status(503).json({
      error: "Instagram otomatik araması için GOOGLE_CSE_API_KEY ve GOOGLE_CSE_ID .env dosyasına eklenmeli."
    });
  }

  const business = {
    name: String(req.query.name || "").trim(),
    city: String(req.query.city || "").trim(),
    address: String(req.query.address || "").trim(),
    phone: String(req.query.phone || "").trim()
  };

  if (!business.name || !business.city) {
    return res.status(400).json({ error: "İşletme adı ve şehir zorunlu." });
  }

  const district = business.address.split(",")[0]?.trim() || "";
  const queries = [
    `site:instagram.com "${business.name}" "${business.city}"`,
    `site:instagram.com "${business.name}" "${district}"`,
    `site:instagram.com "${business.name}" "${business.phone}"`
  ].filter((query, index, list) => query && list.indexOf(query) === index);

  try {
    const resultSets = await Promise.all(queries.map(googleSearchInstagram));
    const candidates = resultSets.flat();

    const scored = candidates
      .map(result => ({ result, score: instagramCandidateScore(result, business) }))
      .filter(item => item.score >= 4)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      return res.json({ instagram: "", found: false });
    }

    const url = new URL(scored[0].result.link);
    const username = url.pathname.split("/").filter(Boolean)[0] || "";

    res.json({
      instagram: username ? `@${username}` : "",
      instagramUrl: scored[0].result.link,
      found: Boolean(username)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Instagram araması sırasında hata oluştu." });
  }
});

app.listen(PORT, () => {
  console.log("Vercodex API: http://localhost:" + PORT);
});
