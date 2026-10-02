import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Building2, CheckCircle2, ExternalLink, Globe2, Instagram, MapPin, Phone, Search, Send, SlidersHorizontal, Sparkles
} from "lucide-react";
import "./styles.css";

const seedLeads = [
  { id: 1, name: "DentArt Ağız ve Diş Sağlığı", city: "Ankara", district: "Çankaya", category: "Diş Kliniği", website: "", instagram: "@dentartankara", phone: "+90 312 000 00 01", status: "Yeni" },
  { id: 2, name: "Vera Dental", city: "Ankara", district: "Keçiören", category: "Diş Kliniği", website: "", instagram: "@veradentalankara", phone: "+90 312 000 00 02", status: "DM Atıldı" },
  { id: 3, name: "Nova Smile Clinic", city: "İstanbul", district: "Kadıköy", category: "Diş Kliniği", website: "https://novasmile.example", instagram: "@novasmileclinic", phone: "+90 216 000 00 03", status: "Yanıt Bekleniyor" },
  { id: 4, name: "Mavi Ağız ve Diş Sağlığı", city: "Zonguldak", district: "Merkez", category: "Diş Kliniği", website: "", instagram: "@mavidental67", phone: "+90 372 000 00 04", status: "Yeni" },
  { id: 5, name: "Atakum Smile", city: "Samsun", district: "Atakum", category: "Diş Kliniği", website: "", instagram: "@atakumsmile", phone: "+90 362 000 00 05", status: "Demo Hazırlanıyor" },
  { id: 6, name: "Kahve Kodu", city: "Ankara", district: "Bahçelievler", category: "Kafe", website: "", instagram: "@kahvekodu", phone: "+90 312 000 00 07", status: "Yeni" },
  { id: 7, name: "Aura Beauty", city: "İstanbul", district: "Bakırköy", category: "Güzellik Merkezi", website: "", instagram: "@aurabeauty", phone: "+90 212 000 00 08", status: "Yeni" },
  { id: 8, name: "Oris Dental Studio", city: "Ankara", district: "Yenimahalle", category: "Diş Kliniği", website: "https://oris.example", instagram: "@orisdental", phone: "+90 312 000 00 06", status: "Müşteri" },
];

const flow = ["Yeni", "DM Atıldı", "Yanıt Bekleniyor", "Demo Hazırlanıyor", "Müşteri"];
const statusClass = {
  "Yeni": "badge-new",
  "DM Atıldı": "badge-dm",
  "Yanıt Bekleniyor": "badge-wait",
  "Demo Hazırlanıyor": "badge-demo",
  "Müşteri": "badge-client",
};

function App() {
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("Diş Kliniği");
  const [websiteOnly, setWebsiteOnly] = useState(true);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [leads, setLeads] = useState(seedLeads);

  const filtered = useMemo(() => leads.filter((lead) => {
    const cityMatch = !city || lead.city.toLowerCase().includes(city.toLowerCase());
    const categoryMatch = !category || lead.category === category;
    const websiteMatch = !websiteOnly || !lead.website;
    const text = [lead.name, lead.city, lead.district, lead.instagram].join(" ").toLowerCase();
    const textMatch = !query || text.includes(query.toLowerCase());
    return cityMatch && categoryMatch && websiteMatch && textMatch;
  }), [city, category, websiteOnly, query, leads]);

  const stats = {
    total: leads.length,
    noWebsite: leads.filter((lead) => !lead.website).length,
    contacted: leads.filter((lead) => lead.status !== "Yeni").length,
    clients: leads.filter((lead) => lead.status === "Müşteri").length,
  };

  const cycleStatus = (id) => {
    setLeads((current) => current.map((lead) => {
      if (lead.id !== id) return lead;
      const index = flow.indexOf(lead.status);
      return { ...lead, status: flow[(index + 1) % flow.length] };
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
          <a className="active"><Search size={18} /> Lead Ara</a>
          <a><Building2 size={18} /> Adaylar</a>
          <a><Send size={18} /> Takip</a>
        </nav>
        <div className="sidebar-note">
          <span>İlk sürüm</span>
          <p>Şimdilik örnek veri kullanıyor. Sonraki aşamada gerçek işletme araması bağlanabilir.</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <p className="eyebrow">VERCODEX CRM</p>
          <h1>Potansiyel müşterilerini bul.</h1>
          <p className="subtitle">Web sitesi olmayan işletmeleri filtrele, sonra iletişim sürecini tek ekrandan takip et.</p>
        </header>

        <section className="search-card">
          <div className="section-title">
            <div><h2>İşletme ara</h2><span>Aramayı şehir, kategori ve anahtar kelime ile daralt.</span></div>
            <SlidersHorizontal size={20} />
          </div>
          <div className="form-grid">
            <label>Şehir<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Örn. Ankara" /></label>
            <label>Kategori<select value={category} onChange={(e) => setCategory(e.target.value)}><option>Diş Kliniği</option><option>Kafe</option><option>Güzellik Merkezi</option><option>Kuaför</option></select></label>
            <label>Anahtar kelime<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="İşletme adı veya ilçe" /></label>
            <button className="primary-btn" onClick={() => setSearched(true)}><Search size={18} />{searched ? "Aramayı yenile" : "Adayları getir"}</button>
          </div>
          <label className="toggle-row">
            <input type="checkbox" checked={websiteOnly} onChange={(e) => setWebsiteOnly(e.target.checked)} />
            <span className="toggle"><span /></span>
            Sadece web sitesi olmayanları göster
          </label>
        </section>

        <section className="stats">
          <div className="stat-card"><span>Toplam aday</span><strong>{stats.total}</strong><small>kayıt</small></div>
          <div className="stat-card"><span>Web sitesi yok</span><strong>{stats.noWebsite}</strong><small>fırsat</small></div>
          <div className="stat-card"><span>İletişime geçildi</span><strong>{stats.contacted}</strong><small>takipte</small></div>
          <div className="stat-card"><span>Müşteri</span><strong>{stats.clients}</strong><small>dönüşüm</small></div>
        </section>

        <section className="results-card">
          <div className="results-head">
            <div><h2>Aday işletmeler</h2><span>{filtered.length} sonuç gösteriliyor</span></div>
            <div className="result-tag"><Globe2 size={15} /> Demo verisi</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>İşletme</th><th>Konum</th><th>Instagram</th><th>Web sitesi</th><th>Durum</th><th></th></tr></thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id}>
                    <td><div className="business-cell"><div className="avatar"><Building2 size={17} /></div><div><strong>{lead.name}</strong><span>{lead.category}</span></div></div></td>
                    <td><span className="location"><MapPin size={14} />{lead.district}, {lead.city}</span></td>
                    <td><span className="instagram"><Instagram size={14} />{lead.instagram}</span></td>
                    <td>{lead.website ? <a className="website-link" href={lead.website} target="_blank" rel="noreferrer"><Globe2 size={14} />Var</a> : <span className="missing">Yok</span>}</td>
                    <td><button className={"status-badge " + statusClass[lead.status]} onClick={() => cycleStatus(lead.id)}>{lead.status === "Müşteri" ? <CheckCircle2 size={13} /> : null}{lead.status}</button></td>
                    <td><button className="icon-btn" title={lead.phone}><Phone size={16} /></button></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan="6" className="empty">Filtreye uyan aday bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="results-footer"><span>Durumu değiştirmek için badge üzerine tıklayabilirsin.</span><a href="https://github.com/hasanceylan2375-jpg/Vercodex-LeadFinder" target="_blank" rel="noreferrer">GitHub reposu <ExternalLink size={14} /></a></div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);