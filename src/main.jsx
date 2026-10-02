import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Building2, CheckCircle2, ExternalLink, Globe2, Instagram, MapPin, Phone,
  Search, Send, SlidersHorizontal, Sparkles
} from "lucide-react";
import "./styles.css";

const flow = ["Yeni", "DM Atıldı", "Yanıt Bekleniyor", "Demo Hazırlanıyor", "Müşteri"];
const statusClass = {
  "Yeni":"badge-new","DM Atıldı":"badge-dm","Yanıt Bekleniyor":"badge-wait",
  "Demo Hazırlanıyor":"badge-demo","Müşteri":"badge-client"
};

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
    if (!city.trim()) {
      setError("Önce bir şehir yaz. Örn. Ankara");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        city: city.trim(),
        category,
        keyword: query.trim()
      });
      const response = await fetch("/api/leads?" + params.toString());
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Arama başarısız.");
      setLeads(data.leads || []);
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
      return { ...lead, status: flow[(i + 1) % flow.length] };
    }));
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
          <p className="subtitle">Şehir ve kategori seç, gerçek işletmeleri getir, web sitesi olmayan fırsatları ayır.</p>
        </header>

        <section className="search-card">
          <div className="section-title">
            <div><h2>İşletme ara</h2><span>Örn. Ankara + Diş Kliniği</span></div>
            <SlidersHorizontal size={20}/>
          </div>
          <div className="form-grid">
            <label>Şehir<input value={city} onChange={e=>setCity(e.target.value)} placeholder="Örn. Ankara"/></label>
            <label>Kategori<select value={category} onChange={e=>setCategory(e.target.value)}>
              <option>Diş Kliniği</option><option>Kafe</option><option>Güzellik Merkezi</option><option>Kuaför</option>
            </select></label>
            <label>Anahtar kelime<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="İşletme adı veya ilçe"/></label>
            <button className="primary-btn" onClick={searchLeads} disabled={loading}>
              <Search size={18}/>{loading ? "Aranıyor..." : searched ? "Aramayı yenile" : "Gerçek işletmeleri getir"}
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
            <div><h2>Aday işletmeler</h2><span>{filtered.length} sonuç gösteriliyor</span></div>
            <div className="result-tag"><Globe2 size={15}/> Google Places</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>İşletme</th><th>Adres</th><th>Telefon</th><th>Web sitesi</th><th>Durum</th><th></th></tr></thead>
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
                    <td><button className={"status-badge "+statusClass[lead.status]} onClick={()=>cycleStatus(lead.id)}>
                      {lead.status === "Müşteri" && <CheckCircle2 size={13}/>} {lead.status}
                    </button></td>
                    <td><a className="icon-btn" title="Google Maps'te aç" href={lead.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={16}/></a></td>
                  </tr>
                ))}
                {!filtered.length && <tr><td colSpan="6" className="empty">{searched ? "Sonuç bulunamadı." : "Şehir ve kategori seçip aramayı başlat."}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="results-footer">
            <span>Durumu değiştirmek için badge üzerine tıklayabilirsin.</span>
            <a href="https://github.com/hasanceylan2375-jpg/Vercodex-LeadFinder" target="_blank" rel="noreferrer">GitHub reposu <ExternalLink size={14}/></a>
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App/></React.StrictMode>);
