import React, { useMemo, useState } from "react";
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
        status: savedStatuses[lead.id] || lead.status
      }));
      setLeads(restored);
      setSearched(true);
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

  const instagramSearch = (lead) => {
    const search = encodeURIComponent(`site:instagram.com "${lead.name}" "${lead.city}"`);
    window.open(`https://www.google.com/search?q=${search}`, "_blank", "noopener,noreferrer");
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

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = ["İşletme","Kategori","Adres","Telefon","Web Sitesi","Instagram","Puan","Yorum Sayısı","Durum","Google Maps"];
    const rows = filtered.map(l => [
      l.name,l.category,l.address,l.phone,l.website,l.instagram || "",l.rating ?? "",l.reviewCount ?? 0,l.status,l.mapsUrl
    ]);
    const csv = [headers, ...rows].map(row =>
      row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")
    ).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vercodex-${city.toLowerCase()}-${category.toLowerCase().replaceAll(" ","-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            <div><h2>Aday işletmeler</h2><span>{filtered.length} sonuç gösteriliyor · Arama başına 60'a kadar</span></div>
            <div className="result-actions">
              <button className="export-btn" onClick={exportCsv} disabled={!filtered.length}><Download size={14}/> Excel/CSV</button>
              <div className="result-tag"><Globe2 size={15}/> Google Places</div>
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
                        <button className="instagram-btn" onClick={()=>instagramSearch(lead)} title="Google üzerinden Instagram hesabını ara">
                          <Instagram size={14}/> Bul
                        </button>
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
            <span><b>Bul</b> Instagram hesabını arar · <b>Mesaj</b> işletmeye özel DM metnini panoya kopyalar.</span>
            <a href="https://github.com/hasanceylan2375-jpg/Vercodex-LeadFinder" target="_blank" rel="noreferrer">GitHub reposu <ExternalLink size={14}/></a>
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
