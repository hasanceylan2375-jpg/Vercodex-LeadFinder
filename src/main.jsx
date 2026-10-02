import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { createRoot } from "react-dom/client";
import {
  Building2, CheckCircle2, ExternalLink, Globe2, Instagram, MapPin, Phone,
  Search, Send, SlidersHorizontal, Sparkles, Download
} from "lucide-react";
import "./styles.css";

const flow = ["Yeni", "DM Atıldı", "Yanıt Bekleniyor", "Demo Hazırlanıyor", "Müşteri"];
const statusClass = {
  "Yeni":"badge-new","DM Atıldı":"badge-dm","Yanıt Bekleniyor":"badge-wait",
  "Demo Hazırlanıyor":"badge-demo","Müşteri":"badge-client"
};

const cities = [
  "Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan","Artvin",
  "Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa",
  "Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan","Erzurum",
  "Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır","Isparta","İstanbul","İzmir",
  "Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kilis","Kırıkkale","Kırklareli",
  "Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Mardin","Mersin","Muğla","Muş","Nevşehir",
  "Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Şanlıurfa","Şırnak",
  "Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak"
];

const savedStatuses = JSON.parse(localStorage.getItem("vercodex-statuses") || "{}");

function App() {
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("Diş Kliniği");
  const [websiteOnly, setWebsiteOnly] = useState(true);
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [instagramSearching, setInstagramSearching] = useState(false);
  const [instagramFound, setInstagramFound] = useState(0);

  const searchLeads = async () => {
    if (!city) {
      setError("Önce bir şehir seç.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        city,
        category,
        keyword: query.trim()
      });
      const response = await fetch("/api/leads?" + params.toString());
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Arama başarısız.");

      const restored = (data.leads || []).map(lead => ({
        ...lead,
        status: savedStatuses[lead.id] || lead.status,
        instagram: lead.instagram || "",
        instagramSearching: false
      }));
      setLeads(restored);
      setSearched(true);
      setInstagramFound(0);

      // Sonuçlar ekrana geldikten sonra, web sitesi olmayan adaylar için
      // Instagram hesaplarını arka planda otomatik bul.
      autoFindInstagram(restored);
    } catch (err) {
      setError(err.message || "Bir hata oluştu.");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => leads.filter((lead) => {
    const text = [lead.name, lead.address, lead.phone].join(" ").toLowerCase();
    return (!websiteOnly || !lead.website) &&
      (!query || text.includes(query.toLowerCase()));
  }), [leads, websiteOnly, query]);

  const stats = {
    total: leads.length,
    noWebsite: leads.filter((lead) => !lead.website).length,
    contacted: leads.filter((lead) => lead.status !== "Yeni").length,
    clients: leads.filter((lead) => lead.status === "Müşteri").length
  };

  const cycleStatus = (id) => {
    setLeads(current => current.map(lead => {
      if (lead.id !== id) return lead;
      const i = flow.indexOf(lead.status);
      const updated = { ...lead, status: flow[(i + 1) % flow.length] };
      const statuses = JSON.parse(localStorage.getItem("vercodex-statuses") || "{}");
      statuses[id] = updated.status;
      localStorage.setItem("vercodex-statuses", JSON.stringify(statuses));
      return updated;
    }));
  };

  const findInstagram = async (lead) => {
    setLeads(current => current.map(item =>
      item.id === lead.id ? { ...item, instagramSearching: true } : item
    ));

    try {
      const params = new URLSearchParams({
        name: lead.name,
        city: lead.city,
        address: lead.address || "",
        phone: lead.phone || ""
      });

      const response = await fetch("/api/instagram-search?" + params.toString());
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Instagram araması başarısız.");
      }

      if (data.found && data.instagram) {
        setInstagramFound(current => current + 1);
      }

      setLeads(current => current.map(item =>
        item.id === lead.id
          ? { ...item, instagram: data.instagram || "", instagramUrl: data.instagramUrl || "", instagramSearching: false }
          : item
      ));
    } catch (err) {
      setLeads(current => current.map(item =>
        item.id === lead.id ? { ...item, instagramSearching: false } : item
      ));
      setError(err.message || "Instagram araması başarısız.");
    }
  };

  const autoFindInstagram = async (items) => {
    if (!items.length) return;

    try {
      const healthResponse = await fetch("/api/health");
      const health = await healthResponse.json();

      if (!health.instagramSearchConfigured) {
        setError("Instagram otomatik araması için GOOGLE_CSE_API_KEY ve GOOGLE_CSE_ID .env dosyasına eklenmeli. Klinik araması çalışmaya devam eder.");
        return;
      }
    } catch {
      return;
    }

    const targets = items.filter(lead => !lead.website);

    setInstagramSearching(targets.length > 0);

    // Aynı anda sınırlı sayıda arama yaparak tarayıcıyı/API'yi boğma.
    const concurrency = 4;
    let index = 0;

    const worker = async () => {
      while (index < targets.length) {
        const currentIndex = index;
        index += 1;
        await findInstagram(targets[currentIndex]);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, targets.length) }, worker)
    );

    setInstagramSearching(false);
  };

  const buildMessage = (lead) => `Merhaba ${lead.name} 👋

Web siteniz olmadığı için size ulaşmak istedik. Vercodex olarak işletmelere modern, mobil uyumlu web siteleri ve online randevu sistemleri geliştiriyoruz.

İsterseniz ${lead.name} için hazırlayabileceğimiz örnek tasarımı ücretsiz gösterebiliriz.

İyi çalışmalar 🙌`;

  const copyMessage = async (lead) => {
    try {
      await navigator.clipboard.writeText(buildMessage(lead));
      setError("");
      alert("Mesaj panoya kopyalandı. Instagram DM'ye yapıştırabilirsin.");
    } catch {
      setError("Mesaj kopyalanamadı. Tarayıcı izinlerini kontrol et.");
    }
  };

  const openInstagram = () => {
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  };

  const exportExcel = () => {
    if (!filtered.length) return;

    const rows = filtered.map((l, index) => ({
      "No": index + 1,
      "İşletme": l.name,
      "Kategori": l.category,
      "Adres": l.address,
      "Telefon": l.phone || "",
      "Web Sitesi": l.website || "",
      "Instagram": l.instagram || "",
      "Google Puanı": l.rating ?? "",
      "Yorum Sayısı": l.reviewCount ?? 0,
      "Durum": l.status,
      "Google Maps": l.mapsUrl || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 6 }, { wch: 32 }, { wch: 20 }, { wch: 48 }, { wch: 18 },
      { wch: 38 }, { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 48 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Müşteri Adayları");

    const safeCity = city.toLowerCase().replaceAll(" ", "-");
    const safeCategory = category.toLowerCase().replaceAll(" ", "-");
    XLSX.writeFile(workbook, `vercodex-${safeCity}-${safeCategory}.xlsx`);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sparkles size={18} /></div>
          <div><strong>Vercodex</strong><span>Lead Finder</span></div>
        </div>
        <nav>
          <a className="active"><Search size={18}/> Lead Ara</a>
          <a><Building2 size={18}/> Adaylar</a>
          <a><Send size={18}/> Takip</a>
        </nav>
        <div className="sidebar-note">
          <span>Gerçek veri</span>
          <p>Aramalar Google Places API üzerinden yapılır. API anahtarı sadece sunucuda tutulur.</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <p className="eyebrow">VERCODEX CRM</p>
          <h1>Potansiyel müşterilerini bul.</h1>
          <p className="subtitle">Şehir ve kategori seç, daha fazla gerçek işletme getir, web sitesi olmayan fırsatları ayır.</p>
        </header>

        <section className="search-card">
          <div className="section-title">
            <div><h2>İşletme ara</h2><span>Şehir + kategori ile müşteri adaylarını tara</span></div>
            <SlidersHorizontal size={20}/>
          </div>
          <div className="form-grid">
            <label>Şehir
              <select value={city} onChange={e=>setCity(e.target.value)}>
                <option value="">Şehir seç...</option>
                {cities.map(item => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>Kategori
              <select value={category} onChange={e=>setCategory(e.target.value)}>
                <option>Diş Kliniği</option>
                <option>Emlak</option>
                <option>Kafe</option>
                <option>Güzellik Merkezi</option>
                <option>Kuaför</option>
                <option>Restoran</option>
                <option>Oto Servis</option>
              </select>
            </label>
            <label>İlçe / anahtar kelime
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Örn. Çankaya"/>
            </label>
            <button className="primary-btn" onClick={searchLeads} disabled={loading}>
              <Search size={18}/>{loading ? "Taranıyor..." : searched ? "Tekrar tara" : "İşletmeleri getir"}
            </button>
          </div>
          <label className="toggle-row">
            <input type="checkbox" checked={websiteOnly} onChange={e=>setWebsiteOnly(e.target.checked)}/>
            <span className="toggle"><span/></span>
            Sadece web sitesi olmayanları göster
          </label>
          {error && <div className="api-error">{error}</div>}
        </section>

        <section className="stats">
          <div className="stat-card"><span>Toplam aday</span><strong>{stats.total}</strong><small>Google sonucu</small></div>
          <div className="stat-card"><span>Web sitesi yok</span><strong>{stats.noWebsite}</strong><small>fırsat</small></div>
          <div className="stat-card"><span>İletişime geçildi</span><strong>{stats.contacted}</strong><small>takipte</small></div>
          <div className="stat-card"><span>Müşteri</span><strong>{stats.clients}</strong><small>dönüşüm</small></div>
        </section>

        <section className="results-card">
          <div className="results-head">
            <div><h2>Aday işletmeler</h2><span>{filtered.length} sonuç gösteriliyor · Çoklu Google Places sorgusu</span></div>
            <div className="result-actions">
              <button className="export-btn" onClick={exportExcel} disabled={!filtered.length}><Download size={14}/> Excel</button>
              <div className="result-tag"><Globe2 size={15}/> Google Places {instagramSearching ? "· Instagramlar aranıyor..." : instagramFound ? `· ${instagramFound} Instagram bulundu` : ""}</div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>İşletme</th><th>Adres</th><th>Telefon</th><th>Web</th><th>Instagram</th><th>Puan</th><th>Durum</th><th></th></tr></thead>
              <tbody>
                {filtered.map(lead => (
                  <tr key={lead.id}>
                    <td><div className="business-cell"><div className="avatar"><Building2 size={17}/></div><div><strong>{lead.name}</strong><span>{lead.category}</span></div></div></td>
                    <td><span className="location"><MapPin size={14}/>{lead.address || city}</span></td>
                    <td><span className="instagram"><Phone size={14}/>{lead.phone || "Yok"}</span></td>
                    <td>{lead.website
                      ? <a className="website-link" href={lead.website} target="_blank" rel="noreferrer"><Globe2 size={14}/>Var</a>
                      : <span className="missing">Yok</span>}
                    </td>
                    <td>
                      <div className="social-actions">
                        {lead.instagram ? (
                          <a className="instagram-found" href={lead.instagramUrl || `https://www.instagram.com/${lead.instagram.replace("@", "")}/`} target="_blank" rel="noreferrer">
                            <Instagram size={14}/> {lead.instagram}
                          </a>
                        ) : (
                          <button className="instagram-btn" onClick={()=>findInstagram(lead)} disabled={lead.instagramSearching} title="Google üzerinden otomatik Instagram araması yap">
                            <Instagram size={14}/> {lead.instagramSearching ? "Aranıyor..." : "Bul"}
                          </button>
                        )}
                        <button className="message-btn" onClick={()=>copyMessage(lead)} title="Kişiselleştirilmiş mesajı kopyala">
                          Mesaj
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="rating-cell">
                        <strong>{lead.rating ? `★ ${lead.rating.toFixed(1)}` : "—"}</strong>
                        <span>{lead.reviewCount ? `(${lead.reviewCount})` : "Yorum yok"}</span>
                      </div>
                    </td>
                    <td><button className={"status-badge "+statusClass[lead.status]} onClick={()=>cycleStatus(lead.id)}>
                      {lead.status === "Müşteri" && <CheckCircle2 size={13}/>} {lead.status}
                    </button></td>
                    <td><a className="icon-btn" title="Google Maps'te aç" href={lead.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={16}/></a></td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan="8" className="empty">{searched ? "Sonuç bulunamadı." : "Şehir ve kategori seçip aramayı başlat."}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="results-footer">
            <span><b>Instagram</b> sonuçları Google web aramasıyla otomatik taranır · <b>Bul</b> bulunamayan hesabı tekrar dener.</span>
            <a href="https://github.com/hasanceylan2375-jpg/Vercodex-LeadFinder" target="_blank" rel="noreferrer">GitHub reposu <ExternalLink size={14}/></a>
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
