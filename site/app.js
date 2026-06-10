"use strict";

// API BODACC (Opendatasoft / DILA), dataset des annonces commerciales.
const API_BASE =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";
const PAGE_SIZE = 100; // maximum autorisé par l'API v2.1
const MAX_PAGES = 10; // garde-fou : jusqu'à 1000 annonces

const form = document.getElementById("form");
const btn = document.getElementById("btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  rechercher();
});

// Lance une recherche dès le chargement avec les valeurs par défaut.
rechercher();

async function rechercher() {
  const dept = document.getElementById("dept").value.trim();
  const jours = parseInt(document.getElementById("jours").value, 10) || 14;
  const motcle = document.getElementById("motcle").value.trim();
  const montantMin = parseFloat(document.getElementById("montantMin").value) || 0;
  const seulementCapital = document.getElementById("seulementCapital").checked;

  const depuis = dateIso(joursAvant(jours));

  setStatus(`Recherche en cours pour le département ${dept}…`);
  resultsEl.innerHTML = "";
  btn.disabled = true;

  try {
    const annonces = await fetchToutesAnnonces({ dept, depuis, motcle });

    // Enrichissement : on extrait les infos de capital de chaque annonce.
    let lignes = annonces.map((rec) => ({
      rec,
      capital: parseCapital(rec.modificationsgenerales),
    }));

    if (seulementCapital) {
      lignes = lignes.filter((l) => l.capital && l.capital.nouveau != null);
    }
    if (montantMin > 0) {
      lignes = lignes.filter(
        (l) => l.capital && l.capital.nouveau != null && l.capital.nouveau >= montantMin
      );
    }

    // Tri : date de parution la plus récente d'abord.
    lignes.sort((a, b) =>
      (b.rec.dateparution || "").localeCompare(a.rec.dateparution || "")
    );

    afficherResultats(lignes, { dept, jours, total: annonces.length });
  } catch (err) {
    setStatus(`Erreur lors de l'appel à l'API BODACC : ${err.message}`, true);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

async function fetchToutesAnnonces({ dept, depuis, motcle }) {
  const out = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = buildUrl({ dept, depuis, motcle, offset: page * PAGE_SIZE });
    const resp = await fetch(url);
    if (!resp.ok) {
      let detail = "";
      try {
        const j = await resp.json();
        detail = j.message || j.error_code || "";
      } catch (_) {}
      throw new Error(`HTTP ${resp.status} ${detail}`);
    }
    const data = await resp.json();
    const results = data.results || [];
    out.push(...results);
    if (results.length < PAGE_SIZE) break; // dernière page atteinte
  }
  return out;
}

function buildUrl({ dept, depuis, motcle, offset }) {
  // Clause ODSQL : département + date de parution dans la fenêtre + plein texte.
  const clauses = [];
  if (dept) clauses.push(`numerodepartement = "${dept}"`);
  clauses.push(`dateparution >= date'${depuis}'`);
  if (motcle) clauses.push(`"${motcle.replace(/"/g, '\\"')}"`);

  const params = new URLSearchParams({
    where: clauses.join(" and "),
    order_by: "dateparution desc",
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  return `${API_BASE}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Extraction des montants de capital depuis le champ `modificationsgenerales`.
// Ce champ est un JSON sérialisé dont la structure varie selon les annonces ;
// l'extraction est volontairement défensive.
// ---------------------------------------------------------------------------
function parseCapital(modString) {
  if (!modString) return null;
  const result = { ancien: null, nouveau: null, devise: "EUR", descriptif: "" };

  let obj = null;
  try {
    obj = JSON.parse(modString);
  } catch (_) {
    /* pas du JSON valide : on tentera le repli regex */
  }

  if (obj && typeof obj === "object") {
    scanObjet(obj, result);
  }

  // Repli : on cherche des montants dans le texte si rien n'a été trouvé.
  const texte = result.descriptif || (typeof modString === "string" ? modString : "");
  if (result.nouveau == null && texte) {
    const variation = texte.match(
      /de\s+([\d\s.,]+)\s*(?:euros?|eur|€)\s+(?:à|a)\s+([\d\s.,]+)\s*(?:euros?|eur|€)/i
    );
    if (variation) {
      result.ancien = toNumber(variation[1]);
      result.nouveau = toNumber(variation[2]);
    } else {
      const simple = texte.match(/capital[^\d]{0,30}([\d\s.,]+)\s*(?:euros?|eur|€)/i);
      if (simple) result.nouveau = toNumber(simple[1]);
    }
  }

  if (result.nouveau == null && result.ancien == null && !result.descriptif) {
    return null;
  }
  return result;
}

function scanObjet(o, result) {
  for (const [k, v] of Object.entries(o)) {
    const key = k.toLowerCase();
    if (v && typeof v === "object") {
      scanObjet(v, result);
      continue;
    }
    if (key.includes("devise") && typeof v === "string" && v) {
      result.devise = v;
      continue;
    }
    if ((key === "descriptif" || key === "description") && typeof v === "string") {
      if (!result.descriptif) result.descriptif = v;
      continue;
    }
    if (key.includes("capital")) {
      const num = toNumber(v);
      if (num == null) continue;
      if (key.includes("ancien") || key.includes("anterieur")) {
        result.ancien = num;
      } else if (result.nouveau == null) {
        result.nouveau = num;
      }
    }
  }
}

function toNumber(v) {
  if (v == null) return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const cleaned = String(v)
    .replace(/\s/g, "")
    .replace(/ /g, "")
    .replace(/€|euros?|eur/gi, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // séparateur de milliers
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------------
function afficherResultats(lignes, { dept, jours, total }) {
  if (lignes.length === 0) {
    setStatus(
      `Aucune société trouvée pour le département ${dept} sur les ${jours} derniers jours ` +
        `(${total} annonce(s) brute(s) analysée(s)).`
    );
    resultsEl.innerHTML =
      '<p class="empty">Aucun résultat. Essayez d\'élargir la période ou de décocher le filtre de capital.</p>';
    return;
  }

  setStatus(
    `<span class="count">${lignes.length}</span> société(s) avec changement de capital ` +
      `dans le département ${dept} sur les ${jours} derniers jours.`
  );

  resultsEl.innerHTML = lignes.map((l) => carte(l)).join("");
}

function carte({ rec, capital }) {
  const nom = nomSociete(rec);
  const ville = [rec.ville, rec.cp].filter(Boolean).join(" ");
  const registre = registreStr(rec);
  const date = formatDate(rec.dateparution);

  return `
    <article class="card">
      <div class="card-head">
        <h2 class="card-name">${escapeHtml(nom)}</h2>
        <span class="card-date">Parution du ${escapeHtml(date)}</span>
      </div>
      <p class="card-meta">
        ${ville ? escapeHtml(ville) : ""}${ville && registre ? " · " : ""}${
    registre ? "SIREN/RCS&nbsp;: " + escapeHtml(registre) : ""
  }${rec.tribunal ? " · " + escapeHtml(rec.tribunal) : ""}
      </p>
      ${blocCapital(capital)}
      ${blocDirigeants(rec)}
      ${
        capital && capital.descriptif
          ? `<p class="descriptif">${escapeHtml(capital.descriptif)}</p>`
          : ""
      }
      <p class="card-links">
        <a href="${lienAnnonce(rec)}" target="_blank" rel="noopener">Voir l'annonce (données brutes)</a>
      </p>
    </article>`;
}

function blocCapital(capital) {
  if (!capital || capital.nouveau == null) return "";
  const devise = capital.devise || "EUR";
  let badge = "";
  let ancienHtml = "";

  if (capital.ancien != null) {
    ancienHtml = `<span class="old">${formatMontant(capital.ancien, devise)}</span><span class="arrow">→</span>`;
    const diff = capital.nouveau - capital.ancien;
    if (capital.ancien > 0) {
      const pct = Math.round((diff / capital.ancien) * 100);
      if (diff > 0) badge = `<span class="badge up">+${pct}%</span>`;
      else if (diff < 0) badge = `<span class="badge down">${pct}%</span>`;
      else badge = `<span class="badge flat">inchangé</span>`;
    }
  }

  return `
    <div class="capital">
      <span>Capital social&nbsp;:</span>
      ${ancienHtml}
      <span class="new">${formatMontant(capital.nouveau, devise)}</span>
      ${badge}
    </div>`;
}

function nomSociete(rec) {
  // On essaie d'abord la dénomination dans listepersonnes, sinon le commerçant.
  const fromPersonnes = denominationPersonnes(rec.listepersonnes);
  return fromPersonnes || rec.commercant || "(dénomination non précisée)";
}

function extrairePersonnes(listepersonnes) {
  if (!listepersonnes) return [];
  let obj = listepersonnes;
  if (typeof obj === "string") {
    try {
      obj = JSON.parse(obj);
    } catch (_) {
      return [];
    }
  }
  let personnes;
  if (Array.isArray(obj)) personnes = obj;
  else if (Array.isArray(obj.personnes)) personnes = obj.personnes;
  else if (obj.personne) personnes = [obj.personne];
  else personnes = [];
  return personnes.filter((p) => p && typeof p === "object");
}

function denominationPersonnes(listepersonnes) {
  for (const p of extrairePersonnes(listepersonnes)) {
    const nom = p.denomination || p.nom || p.nomCommercial;
    if (nom) return String(nom);
  }
  return null;
}

// Dirigeants : personnes physiques de l'annonce + éventuel texte d'administration.
function blocDirigeants(rec) {
  const noms = dirigeants(rec);
  const admin = administration(rec);
  let contenu = "";
  if (noms.length) contenu = escapeHtml(noms.join(", "));
  if (admin) contenu += (contenu ? " — " : "") + escapeHtml(admin);
  if (!contenu) contenu = '<span class="muted">non précisé dans l\'annonce</span>';
  return `<p class="dirigeants"><strong>Dirigeants&nbsp;:</strong> ${contenu}</p>`;
}

function dirigeants(rec) {
  const noms = [];
  for (const p of extrairePersonnes(rec.listepersonnes)) {
    if (p.denomination) continue; // personne morale = la société, pas un dirigeant
    const nom = nomPhysique(p);
    if (!nom) continue;
    const qualite = p.qualite || p.fonction || p.role || "";
    noms.push(qualite ? `${nom} (${qualite})` : nom);
  }
  return noms;
}

function nomPhysique(p) {
  const nom = p.nom || p.nomUsage || "";
  const prenom =
    p.prenom || (Array.isArray(p.prenoms) ? p.prenoms.join(" ") : p.prenoms) || "";
  const complet = `${prenom} ${nom}`.trim();
  return complet || null;
}

function administration(rec) {
  const obj = parseMods(rec.modificationsgenerales);
  if (!obj) return "";
  const v = obj.administration || obj.dirigeants || obj.gerance;
  return typeof v === "string" ? v.trim() : "";
}

function parseMods(modString) {
  if (!modString) return null;
  if (typeof modString === "object") return modString;
  try {
    return JSON.parse(modString);
  } catch (_) {
    return null;
  }
}

function registreStr(rec) {
  const r = rec.registre;
  if (!r) return "";
  if (Array.isArray(r)) return r[0] || "";
  return String(r);
}

function lienAnnonce(rec) {
  const id = rec.id || "";
  const where = encodeURIComponent(`id = "${id}"`);
  return `${API_BASE}?where=${where}`;
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------
function joursAvant(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function dateIso(d) {
  return d.toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return "?";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("fr-FR");
}

function formatMontant(n, devise) {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: devise || "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch (_) {
    return `${n} ${devise || ""}`.trim();
  }
}

function setStatus(html, isError) {
  statusEl.innerHTML = html;
  statusEl.classList.toggle("error", !!isError);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
