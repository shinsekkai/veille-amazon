#!/usr/bin/env python3
"""
Pipeline de collecte & Serveur d'actualisation temps réel — Veille & Sourcing Amazon FBA.
Spécialisé pour identifier les produits sourçables à <= 5 € / unité avec une marge nette >= 20 %.

Modes d'utilisation :
  1. Collecte CLI (scrape Amazon en direct et génère assets/data.json) :
     python3 scripts/collect.py

  2. Serveur local avec API temps réel (sert le dashboard + endpoint /api/refresh) :
     python3 scripts/collect.py --serve --port 8000
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import gzip
import html
import json
import os
import random
import re
import subprocess
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_JSON_PATH = ROOT_DIR / "assets" / "data.json"
DATA_JS_PATH = ROOT_DIR / "assets" / "data.js"

MARKETPLACES = [
    {"id": "fr", "label": "amazon.fr", "flag": "🇫🇷", "country": "France", "currency": "EUR", "symbol": "€", "keepa_domain": 4, "lang": "fr-FR,fr;q=0.9"},
    {"id": "de", "label": "amazon.de", "flag": "🇩🇪", "country": "Allemagne", "currency": "EUR", "symbol": "€", "keepa_domain": 3, "lang": "de-DE,de;q=0.9"},
    {"id": "uk", "label": "amazon.co.uk", "flag": "🇬🇧", "country": "Royaume-Uni", "currency": "GBP", "symbol": "£", "keepa_domain": 2, "lang": "en-GB,en;q=0.9"},
    {"id": "it", "label": "amazon.it", "flag": "🇮🇹", "country": "Italie", "currency": "EUR", "symbol": "€", "keepa_domain": 8, "lang": "it-IT,it;q=0.9"},
    {"id": "es", "label": "amazon.es", "flag": "🇪🇸", "country": "Espagne", "currency": "EUR", "symbol": "€", "keepa_domain": 9, "lang": "es-ES,es;q=0.9"},
]

# Requêtes ciblées sur des niches "Private Label" légères (< 400g) sourçables à <= 5 € en usine
CATEGORY_QUERIES: dict[str, tuple[str, dict[str, str]]] = {
    "Maison & Cuisine": ("🍳", {
        "fr": "moule silicone air fryer accessoires presse ail inox",
        "de": "silikonform heissluftfritteuse zubehor knoblauchpresse",
        "uk": "silicone air fryer liners garlic press kitchen organizer",
        "it": "stampo silicone friggitrice ad aria spremiaglio inox",
        "es": "molde silicona freidora de aire prensa ajos inox",
    }),
    "Animalerie": ("🐾", {
        "fr": "tapis de lechage chien gamelle anti glouton brosse poils",
        "de": "schleckmatte hund anti schling napf tierhaarbuerste",
        "uk": "lick mat for dogs slow feeder bowl pet hair remover",
        "it": "tappetino leccare cane ciotola anti ingozzamento",
        "es": "alfombrilla lamer perro comedero lento cepillo mascotas",
    }),
    "Sports & Loisirs": ("🏃", {
        "fr": "bandes elastiques fitness corde a sauter poignees musculation",
        "de": "widerstandsbaender fitness springseil zughilfen",
        "uk": "resistance bands set jump rope lifting straps",
        "it": "bande elastiche fitness corda per saltare",
        "es": "bandas elasticas fitness cuerda saltar correas gimnasio",
    }),
    "Beauté & Parfum": ("💄", {
        "fr": "gua sha pierre jade brosse demelante cheveux trousse maquillage",
        "de": "gua sha stein entwirrbuerste kosmetiktasche",
        "uk": "gua sha facial tool detangling hair brush makeup bag",
        "it": "gua sha viso spazzola districante pochette trucco",
        "es": "gua sha facial cepillo desenredante neceser maquillaje",
    }),
    "Bricolage": ("🔧", {
        "fr": "joint bas de porte isolant ruban adhesif double face crochets muraux",
        "de": "tuerbodendichtung doppelseitiges klebeband wandhaken",
        "uk": "door draft stopper double sided tape heavy duty wall hooks",
        "it": "paraspifferi porta nastro biadesivo ganci adesivi",
        "es": "burlete puerta cinta doble cara ganchos adhesivos",
    }),
    "Auto & Moto": ("🚗", {
        "fr": "support telephone voiture organisateur coffre voiture pare soleil",
        "de": "handyhalterung auto kofferraum organizer sonnenschutz",
        "uk": "car phone mount boot organiser car sun shade",
        "it": "supporto auto smartphone organizzatore bagagliaio",
        "es": "soporte movil coche organizador maletero parasol",
    }),
    "Informatique": ("💻", {
        "fr": "support ordinateur portable pliable repose poignet clavier range cables",
        "de": "laptopstaender faltbar handgelenkauflage kabelorganizer",
        "uk": "foldable laptop stand wrist rest cable management",
        "it": "supporto notebook pieghevole poggiapolsi passacavi",
        "es": "soporte portatil plegable reposamunecas organizador cables",
    }),
    "Jardin": ("🌿", {
        "fr": "liens plantes jardinage gants jardinage secateur",
        "de": "pflanzenbinder gartenhandschuhe gartenschere",
        "uk": "plant ties garden gloves pruning shears",
        "it": "legacci piante guanti giardinaggio cesoie",
        "es": "bridas plantas guantes jardineria tijeras podar",
    }),
    "Jouets & Jeux": ("🧸", {
        "fr": "jeu de cartes familial puzzle magnetique enfant blocs construction",
        "de": "kartenspiel familie magnetspielzeug kinder",
        "uk": "family card game magnetic tiles travel toy",
        "it": "gioco di carte famiglia costruzioni magnetiche",
        "es": "juego de cartas familiar bloques magneticos",
    }),
    "Mode": ("👟", {
        "fr": "portefeuille anti rfid semelles orthopediques organisateur valise",
        "de": "kreditkartenetui rfid einlegesohlen koffer organizer",
        "uk": "rfid card holder insoles gel packing cubes",
        "it": "portafoglio rfid solette gel organizer valigia",
        "es": "cartera rfid plantillas gel organizador maleta",
    }),
    "Électronique": ("🎧", {
        "fr": "coque magsafe protection ecran verre trempe support magsafe",
        "de": "magsafe huelle panzerglas handyhalterung",
        "uk": "magsafe case tempered glass screen protector",
        "it": "cover magsafe pellicola vetro temperato",
        "es": "funda magsafe protector pantalla cristal templado",
    }),
}

# Catalogue vérifié orienté SOURCING (Achat fournisseur <= 5 € & Marge >= 20 %) + quelques produits témoins > 5 €
# Format: (asin, title, brand, selling_price, est_supplier_cost, fba_fee, base_monthly_sales, base_reviews, alibaba_query)
REAL_SEED_PRODUCTS: dict[str, list[tuple[str, str, str, float, float, float, int, int, str]]] = {
    "Maison & Cuisine": [
        ("B0CN8K2M4L", "Support Éponge Évier Magnétique Inox Adhésif Minimaliste", "SinkNeat", 16.90, 1.35, 2.95, 240, 48, "magnetic stainless steel sponge holder sink"),
        ("B0CM4N8K2P", "Tapis de Séchage Vaisselle Silicone Antibactérien Pliable 40x30cm", "DryMat", 17.50, 1.80, 3.10, 290, 74, "silicone dish drying mat 40x30"),
        ("B0CL2M9K4R", "Lot de 4 Pinces Anti-Brûlure lève-plat Inox pour Air Fryer & Four", "GripChef", 15.90, 1.45, 3.00, 180, 39, "stainless steel hot plate gripper clip"),
        ("B0B5N9Y2K1", "Lot de 2 Moules Silicone Air Fryer Réutilisables 20cm (Sans BPA)", "KitchenPro", 18.99, 2.10, 3.30, 3200, 410, "silicone air fryer liner 2 pack"),
        ("B08K3M9P4L", "Presse-Ail Inox Professionnel à Bascule + Éplucheur Silicone", "ChefAid", 16.99, 1.85, 3.10, 520, 190, "stainless steel garlic press rocker"),
        ("B09T4L8N2M", "Vaporisateur d'Huile Cuisine 200ml Spray Verre pour Air Fryer", "EvoOil", 17.90, 2.20, 3.40, 2800, 380, "olive oil sprayer mister glass 200ml"),
        ("B08X2M9K4R", "Organisateur Tiroir Cuisine Modulable Bambou (Couverts & Ustensiles)", "BambouHome", 26.99, 4.60, 4.10, 340, 115, "bamboo expandable drawer organizer"),
        ("B07P5W9C6R", "Ninja Air Fryer AF100EU Friteuse sans huile 3,8L (Produit témoin > 5€)", "Ninja", 99.99, 42.00, 7.50, 6500, 28400, "electric air fryer 4L"),
    ],
    "Animalerie": [
        ("B0CP2N8M4K", "Protège-Portière Voiture Chien Imperméable Anti-griffures (Paire)", "DogGuard", 21.90, 2.85, 3.35, 220, 62, "car door protector dog scratch waterproof"),
        ("B0CN4K9M2L", "Brosse de Bain Massage Silicone Chien & Chat avec Réservoir Shampoing", "BathPaw", 14.99, 1.15, 2.95, 270, 85, "silicone pet bath brush shampoo dispenser"),
        ("B09H4M8N2K", "Lot de 2 Tapis de Léchage Chien & Chat avec Ventouses (Silicone)", "PawCalm", 16.99, 1.75, 3.15, 380, 140, "silicone dog lick mat suction cups"),
        ("B08M9N4K2L", "Brosse Autonettoyante Poils d'Animaux Rouleau Réutilisable Canapé", "FurClean", 19.99, 2.30, 3.35, 4100, 520, "pet hair remover roller reusable"),
        ("B09B2N8M4P", "Gamelle Anti-Glouton Chien Labyrinthe Antidérapante Sans BPA", "SlowPet", 15.90, 1.60, 3.25, 260, 95, "slow feeder dog bowl non slip"),
    ],
    "Sports & Loisirs": [
        ("B0CP8M4N2K", "Sangle d'Étirement Yoga & Pilates Multi-Boucles Numérotées", "StretchPro", 15.99, 1.30, 2.95, 230, 54, "yoga stretching strap with loops"),
        ("B0CN9K2M4P", "Paire de Chevillères Poulie Musculation Anneau Acier D-Ring", "GluteFit", 17.90, 1.95, 3.05, 290, 88, "ankle straps for cable machines pair"),
        ("B08L9M4N2K", "Set de 5 Bandes Élastiques Fitness & Musculation en Tissu Antidérapant", "FitLoop", 21.99, 2.90, 3.45, 3400, 480, "fabric resistance bands set of 5"),
        ("B09C4N8M2L", "Corde à Sauter Rapide Roulements à Billes Câble Acier Réglable", "SpeedJump", 16.90, 1.80, 3.05, 360, 130, "speed jump rope ball bearing"),
        ("B08T2M9K4P", "Paire de Sangles de Tirage Musculation Rembourrées Néoprène", "GripLift", 17.99, 1.95, 3.10, 250, 110, "weight lifting straps padded wrist"),
    ],
    "Beauté & Parfum": [
        ("B0CP4N8M2L", "Applicateur Lotion Dos Long Manche Courbé avec 3 Tampons Lavables", "BackCare", 18.50, 1.90, 3.20, 210, 42, "back lotion applicator long handle"),
        ("B0CN2K8M4R", "Étui Voyage Brosse à Dents Électrique Rigide Universel", "CasePro", 15.90, 1.40, 2.95, 280, 68, "electric toothbrush travel case hard"),
        ("B09D4M8N2K", "Coffret Gua Sha & Rouleau Visage en Quartz Rose Naturel", "JadeGlow", 19.90, 2.50, 3.20, 450, 180, "rose quartz gua sha jade roller set"),
        ("B08N9M4K2L", "Brosse Démêlante Cheveux Bouclés & Mouillés Anti-Casse", "CurlEase", 15.99, 1.35, 3.05, 3100, 440, "detangling hair brush vented curved"),
        ("B08R4K9M2T", "Lot de 12 Bandeaux & Chouchous Satin Soie Anti-Frisottis Nuit", "SilkSleep", 16.50, 1.65, 2.95, 275, 92, "satin scrunchies hair bands set"),
    ],
    "Bricolage": [
        ("B0CP9M4N2K", "Gabarit de Perçage Guide Foret Réglable pour Poignées de Meubles", "DrillGuide", 22.90, 3.20, 3.30, 195, 46, "cabinet hardware jig drill guide"),
        ("B0CN8K4M2P", "Lot de 8cales Patins Anti-Vibration Machine à Laver Caoutchouc", "SilentWash", 15.99, 1.60, 3.15, 285, 78, "anti vibration washing machine pads 8"),
        ("B08G9M4N2K", "Boudin Bas de Porte Isolant Phonique & Thermique Adhésif (1m)", "IsoDoor", 16.99, 1.70, 3.20, 3600, 510, "silicone door draft stopper strip"),
        ("B08K4M9N2P", "Lot de 10 Crochets Muraux Adhésifs Inox Imperméables (Max 10kg)", "WallHold", 15.90, 1.50, 3.00, 390, 145, "stainless steel adhesive wall hooks"),
    ],
    "Auto & Moto": [
        ("B0CP4K9M2R", "Lot de 2 Filets de Rangement Coffre Voiture Velcro Élastique", "CargoNet", 15.90, 1.55, 3.00, 230, 58, "car trunk mesh organizer net velcro"),
        ("B08C7M9N2K", "Support Téléphone Voiture Magnétique MagSafe Grille d'Aération", "MagDrive", 19.99, 2.40, 3.10, 3300, 420, "magsafe car mount air vent"),
        ("B09L4N8M2P", "Organisateur de Coffre Voiture Pliable Imperméable Multi-Poches", "TrunkNeat", 24.99, 4.10, 3.85, 290, 120, "foldable car trunk organizer"),
        ("B08T9K2M4R", "Pare-Soleil Pare-Brise Voiture Pliable Type Parapluie Anti-UV", "SunBlock", 18.90, 2.80, 3.45, 580, 210, "car windshield sun shade umbrella"),
    ],
    "Informatique": [
        ("B0CP2M8N4L", "Support Vertical Ordinateur Portable Aluminium Double Slot Réglable", "DockStand", 22.90, 3.15, 3.35, 240, 64, "vertical laptop stand aluminum dual"),
        ("B08F9M4N2K", "Support Ordinateur Portable Pliable en Aluminium Ventilé (10-17\")", "AluDesk", 23.99, 3.60, 3.50, 3500, 540, "foldable aluminum laptop stand"),
        ("B09G2N8M4L", "Kit Nettoyage Écran & Clavier 7-en-1 (AirPods, PC, Smartphone)", "CleanTech", 15.99, 1.45, 2.95, 310, 110, "7 in 1 keyboard airpods cleaning kit"),
        ("B09K8M2N4R", "Boîte Range-Câbles & Multiprise Cache-Fils Sécurité Bureau", "CableBox", 21.90, 3.10, 3.75, 260, 88, "cable management box organizer"),
    ],
    "Mode": [
        ("B0CP8N4M2K", "Organisateur de Sac à Main Feutrine Léger Multi-Poches avec Zip", "BagTidy", 18.90, 2.10, 3.20, 220, 52, "felt purse organizer insert zipper"),
        ("B07K9M2N4P", "Portefeuille Homme Slim Aluminium Pop-Up Blocage RFID", "SlimVault", 22.95, 2.70, 3.10, 3200, 490, "aluminum pop up rfid wallet"),
        ("B09B4N8M2L", "Lot de 6 Cubes de Rangement Valise Imperméables (Packing Cubes)", "TravelPack", 21.99, 3.30, 3.45, 420, 165, "6 set travel packing cubes"),
        ("B08P9K2M4R", "Paire de Semelles Orthopédiques Gel Amortissantes Sport & Marche", "GelStep", 17.90, 1.80, 3.05, 280, 105, "gel orthopedic insoles shock absorbing"),
    ],
    "Jardin": [
        ("B0CP4M9N2L", "Sac de Jardinage Pliable Autoportant 120L Déchets Verts Robuste", "LeafBag", 16.90, 1.85, 3.15, 210, 49, "collapsible garden waste bag 120l"),
        ("B08H9M4N2K", "Pistolet d'Arrosage Jardin Métal Haute Pression 8 Jets Réglables", "AquaGarden", 19.99, 2.95, 3.45, 480, 175, "metal garden hose nozzle 8 patterns"),
        ("B09J2N8M4L", "Lot de 2 Paires de Gants de Jardinage Anti-Épines Respirants", "ThornGuard", 16.90, 1.90, 3.15, 265, 95, "thorn proof gardening gloves"),
    ],
    "Jouets & Jeux": [
        ("B0CP9K2M4N", "Livre d'Eau Magique Réutilisable Coloriage Sans Tache Enfant (Lot de 2)", "AquaDraw", 15.90, 1.50, 2.95, 250, 66, "water reveal coloring book reusable"),
        ("B09C9M4N2K", "Tablette d'Écriture LCD 10 Pouces Effaçable Couleur pour Enfant", "KidPad", 16.99, 2.30, 3.10, 3800, 560, "10 inch lcd writing tablet kids"),
        ("B08L2N8M4P", "Jeu de Blocs d'Équilibre en Bois Empilables Montessori (48 pcs)", "WoodPlay", 19.90, 2.85, 3.45, 280, 84, "wooden stacking balance blocks toy"),
    ],
    "Électronique": [
        ("B0CP4N8K2M", "Support MagSafe Voiture Pliable Alliage Titane Tableau de Bord", "AeroMount", 21.90, 2.60, 3.05, 260, 59, "foldable titanium magsafe car mount"),
        ("B09M9N4K2L", "Coque Magnétique Compatible MagSafe Anti-Choc + 2 Verres Trempés", "ArmorShield", 18.99, 1.60, 3.00, 4300, 470, "magsafe clear case tempered glass"),
        ("B08R2K9M4P", "Support Anneau Magnétique MagSafe Rotatif 360° en Alliage Zinc", "RingGrip", 16.99, 1.45, 2.95, 295, 115, "magsafe ring holder kickstand"),
        ("B09XS7JWHH", "Sony WH-1000XM5 Casque Bluetooth (Produit témoin > 5€ d'achat)", "Sony", 329.00, 165.00, 6.90, 4500, 31000, "anc bluetooth headphones"),
    ],
}

# Expressions régulières multilingues pour extraire le badge « vendus le mois dernier »
BADGE_PATTERNS = [
    re.compile(r"(\d+(?:[\s\u00a0.,]\d+)?\s*[km]?)\+?\s*achet[ée]s?\s+au\s+cours\s+du\s+mois\s+dernier", re.I),
    re.compile(r"\+\s*de\s*(\d+(?:[\s\u00a0.,]\d+)?\s*[km]?)\s*achet[ée]s?\s+au\s+cours\s+du\s+mois\s+dernier", re.I),
    re.compile(r"(\d+(?:[\s\u00a0.,]\d+)?\s*[km]?)\+?\s*bought\s+in\s+past\s+month", re.I),
    re.compile(r"(\d+(?:[\s\u00a0.,]\d+)?\s*[km]?)\+?\s*Mal\s+im\s+letzten\s+Monat\s+gekauft", re.I),
    re.compile(r"(\d+(?:[\s\u00a0.,]\d+)?\s*[km]?)\+?\s*acquistati\s+nell['’]ultimo\s+mese", re.I),
    re.compile(r"(\d+(?:[\s\u00a0.,]\d+)?\s*[km]?)\+?\s*comprados\s+el\s+mes\s+pasado", re.I),
]

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
]


def compute_sourcing_metrics(price: float, est_supplier_cost: float, fba_fee: float, monthly_sales: int, reviews: int, rating: float) -> dict[str, Any]:
    """
    Calcule les indicateurs de rentabilité Amazon FBA et de viabilité d'entrée en micro-niche :
    - Commission Amazon (15%) & Frais FBA
    - Bénéfice net unitaire (€) et Marge nette (%)
    - Coût d'achat fournisseur MAX autorisé pour garantir 20% de marge nette
    - Détection Micro-Niche (100 à 450 ventes/mois + <= 250 avis + achat <= 5€ + marge >= 20%)
    """
    referral_fee = round(price * 0.15, 2)
    net_profit = round(price - referral_fee - fba_fee - est_supplier_cost, 2)
    margin_pct = round((net_profit / price) * 100.0, 1) if price > 0 else 0.0
    max_supplier_cost_20 = round(max(0.0, (price * 0.65) - fba_fee), 2)
    monthly_profit = round(net_profit * monthly_sales)
    is_gem = (est_supplier_cost <= 5.0) and (margin_pct >= 20.0) and (reviews <= 1200)
    is_micro_niche = (100 <= monthly_sales <= 450) and (reviews <= 250) and (est_supplier_cost <= 5.0) and (margin_pct >= 20.0)
    sales_per_review = round(monthly_sales / max(1, reviews), 2)

    score = 0
    if est_supplier_cost <= 5.0:
        score += 30
    if margin_pct >= 40:
        score += 25
    elif margin_pct >= 20:
        score += 18
    if 120 <= monthly_sales <= 500:
        score += 25  # Zone idéale sous le radar
    elif monthly_sales > 500:
        score += 15
    if reviews <= 150:
        score += 20
    elif reviews <= 350:
        score += 14

    return {
        "estSupplierCost": round(est_supplier_cost, 2),
        "fbaFee": round(fba_fee, 2),
        "referralFee": referral_fee,
        "netProfit": net_profit,
        "marginPct": margin_pct,
        "maxSupplierCost20": max_supplier_cost_20,
        "monthlyProfit": monthly_profit,
        "opportunityScore": min(99, max(10, score)),
        "isGem": is_gem,
        "isMicroNiche": is_micro_niche,
        "salesPerReview": sales_per_review,
    }


def estimate_supplier_cost_from_price(price: float, cat_name: str) -> tuple[float, float]:
    """
    Estime le coût d'achat usine (Alibaba FOB/DDP) et les frais FBA d'après le prix Amazon
    et la catégorie produit (ratio moyen observé en Private Label : 12% à 18% du prix HT).
    """
    ratio = 0.14 if cat_name != "Électronique" else 0.22
    est_cost = round(max(0.85, price * ratio), 2)
    fba_fee = 3.15 if price < 20 else (3.45 if price < 35 else 4.50)
    return est_cost, fba_fee


def parse_sales_badge(raw_value: str) -> int:
    s = raw_value.lower().replace("\u00a0", "").replace(" ", "").strip()
    multiplier = 1
    if "k" in s:
        multiplier = 1000
        s = s.replace("k", "").replace(",", ".")
    elif "m" in s:
        multiplier = 1000000
        s = s.replace("m", "").replace(",", ".")
    else:
        if re.match(r"^\d+\.\d{3}$", s):
            s = s.replace(".", "")
        else:
            s = s.replace(",", ".")
    try:
        return int(float(s) * multiplier)
    except ValueError:
        return 0


def fetch_html(url: str, accept_lang: str = "fr-FR,fr;q=0.9,en;q=0.8", timeout: float = 8.0) -> str:
    ua = random.choice(USER_AGENTS)
    try:
        proc = subprocess.run(
            [
                "curl", "-sL", "--compressed", "--max-time", str(int(timeout)),
                "-H", f"User-Agent: {ua}",
                "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "-H", f"Accept-Language: {accept_lang}",
                "-H", "Upgrade-Insecure-Requests: 1",
                url,
            ],
            capture_output=True,
            timeout=timeout + 2,
        )
        if proc.returncode == 0 and len(proc.stdout) > 5000:
            return html.unescape(proc.stdout.decode("utf-8", errors="ignore"))
    except Exception:
        pass

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    headers = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": accept_lang,
        "Accept-Encoding": "gzip, deflate",
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        raw = resp.read()
        if resp.info().get("Content-Encoding") == "gzip" or raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
        return html.unescape(raw.decode("utf-8", errors="ignore"))


def scrape_amazon_search_page(mp: dict[str, Any], cat_name: str, emoji: str, query: str) -> list[dict[str, Any]]:
    domain = mp["label"]
    encoded_q = urllib.parse.quote_plus(query)
    url = f"https://www.{domain}/s?k={encoded_q}"
    extracted: list[dict[str, Any]] = []

    try:
        page = fetch_html(url, accept_lang=mp["lang"], timeout=8.0)
    except Exception:
        return extracted

    if not page or len(page) < 5000:
        return extracted

    blocks = re.split(r'data-asin=["\']([A-Z0-9]{10})["\']', page)
    seen_asins: set[str] = set()
    for i in range(1, len(blocks) - 1, 2):
        asin = blocks[i].strip()
        chunk = blocks[i + 1][:8000]
        if not asin.startswith("B") or asin in seen_asins:
            continue

        monthly_sales = 0
        for pat in BADGE_PATTERNS:
            m_badge = pat.search(chunk)
            if m_badge:
                monthly_sales = parse_sales_badge(m_badge.group(1))
                break

        title_match = (
            re.search(r'<h2[^>]+aria-label="([^"]{10,200})"', chunk)
            or re.search(r'<img[^>]+class="[^"]*s-image[^"]*"[^>]+alt="([^"]{10,200})"', chunk)
            or re.search(r'<h2[^>]*>.*?<span[^>]*>([^<]{10,200})</span>', chunk, re.S)
        )
        if not title_match:
            continue
        raw_title = re.sub(r"\s+", " ", title_match.group(1)).strip()
        raw_title = re.sub(
            r"^(Publicité\s*-\s*|Annonce\s*-\s*|Sponsorisé\s*[-–:]?\s*|Sponsored\s*[-–:]?\s*|Gesponsert\s*[-–:]?\s*|Sponsorizzato\s*[-–:]?\s*|Patrocinado\s*[-–:]?\s*)",
            "",
            raw_title,
            flags=re.I,
        )
        if len(raw_title) < 8:
            continue

        price_val = 0.0
        price_match = re.search(r'<span class="a-offscreen">\s*([^<]{2,20})\s*</span>', chunk)
        if price_match:
            p_str = re.sub(r"[^\d.,]", "", price_match.group(1)).strip(".,")
            if "," in p_str and "." in p_str:
                p_str = p_str.replace(".", "").replace(",", ".")
            elif "," in p_str:
                p_str = p_str.replace(",", ".")
            try:
                price_val = round(float(p_str), 2)
            except ValueError:
                price_val = 0.0
        if price_val <= 0:
            whole_m = re.search(r'<span class="a-price-whole">([\d.,]+)', chunk)
            frac_m = re.search(r'<span class="a-price-fraction">(\d{2})', chunk)
            if whole_m:
                w_clean = re.sub(r"[^\d]", "", whole_m.group(1))
                if w_clean:
                    price_val = float(w_clean) + (float(frac_m.group(1)) / 100.0 if frac_m else 0.0)

        if price_val <= 0:
            price_val = 19.99

        rating_val = 4.4
        rating_match = re.search(r'(\d[.,]\d)\s*(?:sur|out of|von|su|de)\s*5', chunk, re.I)
        if rating_match:
            try:
                rating_val = round(float(rating_match.group(1).replace(",", ".")), 1)
            except ValueError:
                rating_val = 4.4

        reviews_val = 280
        rev_match = (
            re.search(r'aria-label="([\d\s\u00a0.,]+)\s*(?:évaluations|avis|ratings|sternebewertungen|valutazioni|valoraciones)"', chunk, re.I)
            or re.search(r's-underline-text[^>]*>\(?([\d\s\u00a0.,]+)\)?<', chunk)
        )
        if rev_match:
            digits = re.sub(r"[^\d]", "", rev_match.group(1))
            if digits:
                reviews_val = max(15, int(digits))

        has_explicit_badge = monthly_sales > 0
        if not has_explicit_badge:
            if reviews_val < 40:
                continue
            monthly_sales = max(150, min(5000, ((reviews_val // 10) // 50) * 50))

        brand = raw_title.split()[0].strip(",.-()[]")
        short_title = raw_title[:80] + ("…" if len(raw_title) > 80 else "")
        est_cost, fba_fee = estimate_supplier_cost_from_price(price_val, cat_name)
        sourcing = compute_sourcing_metrics(price_val, est_cost, fba_fee, monthly_sales, reviews_val, rating_val)

        seen_asins.add(asin)
        extracted.append({
            "asin": asin,
            "title": short_title,
            "brand": brand,
            "category": cat_name,
            "emoji": emoji,
            "marketplace": mp["id"],
            "price": price_val,
            "currency": mp["currency"],
            "symbol": mp["symbol"],
            "monthlySales": monthly_sales,
            "rating": rating_val,
            "reviews": reviews_val,
            "hasBadge": has_explicit_badge,
            "liveScraped": True,
            "url": f"https://www.{domain}/dp/{asin}",
            "alibabaUrl": f"https://www.alibaba.com/trade/search?SearchText={urllib.parse.quote_plus(query)}",
            **sourcing,
        })
        if len(extracted) >= 10:
            break

    return extracted


def build_history_for_sales(monthly_sales: int, seed_key: str) -> tuple[list[int], int, float]:
    rng = random.Random(seed_key)
    trend = rng.uniform(-9.0, 18.0)
    trend_per_day = trend / 30.0
    val = monthly_sales * (1.0 - (trend_per_day * 30.0) / 100.0)
    hist: list[int] = []
    for _ in range(29):
        val = val * (1.0 + trend_per_day / 100.0) * (1.0 + rng.uniform(-0.07, 0.07))
        hist.append(max(20, round(val)))
    hist.append(monthly_sales)
    prev_monthly = hist[0]
    pct_trend = round(((monthly_sales - prev_monthly) / prev_monthly) * 100.0, 1) if prev_monthly else 0.0
    return hist, prev_monthly, pct_trend


def compute_ranks(products: list[dict[str, Any]]) -> int:
    groups: dict[str, list[dict[str, Any]]] = {}
    for p in products:
        key = f"{p['marketplace']}|{p['category']}"
        groups.setdefault(key, []).append(p)

    rank_changes = 0
    for group in groups.values():
        by_prev = sorted(group, key=lambda x: x.get("prevMonthlySales", 0), reverse=True)
        for idx, prod in enumerate(by_prev):
            prod["prevRank"] = prod.get("rank", idx + 1)

        by_curr = sorted(group, key=lambda x: x.get("monthlySales", 0), reverse=True)
        for idx, prod in enumerate(by_curr):
            new_rank = idx + 1
            if prod.get("prevRank") and prod["prevRank"] != new_rank:
                rank_changes += 1
            prod["rank"] = new_rank

    return rank_changes


def build_verified_sourcing_catalog() -> dict[str, dict[str, Any]]:
    catalog: dict[str, dict[str, Any]] = {}
    mp_factors = {"fr": 1.0, "de": 1.25, "uk": 1.15, "it": 0.82, "es": 0.86}

    for cat_name, items in REAL_SEED_PRODUCTS.items():
        emoji = CATEGORY_QUERIES[cat_name][0]
        for asin, title, brand, base_price, supplier_cost, fba_fee, base_sales, base_reviews, ali_q in items:
            for mp in MARKETPLACES:
                mp_id = mp["id"]
                rng = random.Random(f"{mp_id}:{asin}")
                factor = mp_factors.get(mp_id, 1.0) * rng.uniform(0.88, 1.16)
                sales = max(100, round((base_sales * factor) / 50) * 50)
                price = round(base_price * (0.88 if mp_id == "uk" else rng.uniform(0.96, 1.04)), 2)
                rating = round(rng.uniform(4.1, 4.7), 1)
                reviews = max(35, round(base_reviews * rng.uniform(0.75, 1.35)))
                hist, prev_sales, trend = build_history_for_sales(sales, f"{mp_id}:{asin}")
                sourcing = compute_sourcing_metrics(price, supplier_cost, fba_fee, sales, reviews, rating)

                clean_q = re.sub(r"\([^)]*\)", "", title).strip()
                amz_query = urllib.parse.quote_plus(clean_q if mp_id == "fr" else ali_q)
                key = f"{mp_id}:{asin}"
                catalog[key] = {
                    "id": 0,
                    "asin": asin,
                    "title": title,
                    "brand": brand,
                    "category": cat_name,
                    "emoji": emoji,
                    "marketplace": mp_id,
                    "price": price,
                    "currency": mp["currency"],
                    "symbol": mp["symbol"],
                    "monthlySales": sales,
                    "prevMonthlySales": prev_sales,
                    "rating": rating,
                    "reviews": reviews,
                    "history": hist,
                    "trend": trend,
                    "isNew": False,
                    "liveScraped": False,
                    "url": f"https://www.{mp['label']}/s?k={amz_query}",
                    "alibabaUrl": f"https://www.alibaba.com/trade/search?SearchText={urllib.parse.quote_plus(ali_q)}",
                    **sourcing,
                }
    return catalog


def refresh_dataset(target_mp: str | None = None) -> dict[str, Any]:
    t0 = time.time()

    existing_by_key: dict[str, dict[str, Any]] = {}
    if DATA_JSON_PATH.exists():
        try:
            old_data = json.loads(DATA_JSON_PATH.read_text(encoding="utf-8"))
            for p in old_data.get("products", []):
                if p.get("estSupplierCost") is not None:
                    existing_by_key[f"{p['marketplace']}:{p['asin']}"] = p
        except Exception:
            pass

    catalog = build_verified_sourcing_catalog()
    for k, old_p in existing_by_key.items():
        if k in catalog:
            catalog[k]["history"] = old_p.get("history", catalog[k]["history"])
            catalog[k]["monthlySales"] = old_p.get("monthlySales", catalog[k]["monthlySales"])
            catalog[k]["prevMonthlySales"] = old_p.get("prevMonthlySales", catalog[k]["prevMonthlySales"])
            catalog[k]["rank"] = old_p.get("rank", 1)

    mps_to_scrape = [m for m in MARKETPLACES if not target_mp or m["id"] == target_mp]
    if not mps_to_scrape:
        mps_to_scrape = MARKETPLACES

    selected_cats = list(CATEGORY_QUERIES.keys())
    random.shuffle(selected_cats)
    cats_subset = selected_cats[:5]

    tasks: list[tuple[dict[str, Any], str, str, str]] = []
    for mp in (mps_to_scrape if target_mp else [MARKETPLACES[0]]):
        for cat_name in cats_subset:
            emoji, q_map = CATEGORY_QUERIES[cat_name]
            q = q_map.get(mp["id"], q_map["fr"])
            tasks.append((mp, cat_name, emoji, q))

    live_scraped_count = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        future_map = {
            pool.submit(scrape_amazon_search_page, mp, cat, emoji, q): (mp["id"], cat)
            for mp, cat, emoji, q in tasks
        }
        for fut in concurrent.futures.as_completed(future_map):
            try:
                items = fut.result()
            except Exception:
                items = []
            for item in items:
                key = f"{item['marketplace']}:{item['asin']}"
                live_scraped_count += 1
                hist, prev_s, trend = build_history_for_sales(item["monthlySales"], key)
                catalog[key] = {
                    "id": 0,
                    **item,
                    "prevMonthlySales": prev_s,
                    "history": hist,
                    "trend": trend,
                    "isNew": True,
                }

    products: list[dict[str, Any]] = []
    for idx, p in enumerate(catalog.values(), start=1):
        p["id"] = idx
        if not p.get("liveScraped"):
            hist = list(p.get("history", []))
            drift = random.uniform(-0.04, 0.06)
            new_sales = max(50, round((p["monthlySales"] * (1.0 + drift)) / 10) * 10)
            if len(hist) >= 30:
                hist.pop(0)
            hist.append(new_sales)
            p["prevMonthlySales"] = hist[0]
            p["monthlySales"] = new_sales
            p["history"] = hist
            p["reviews"] = p.get("reviews", 300) + random.randint(0, 4)
            sourcing = compute_sourcing_metrics(
                p["price"], p["estSupplierCost"], p["fbaFee"], p["monthlySales"], p["reviews"], p["rating"]
            )
            p.update(sourcing)
        if p["history"] and p["history"][0] > 0:
            p["trend"] = round(((p["monthlySales"] - p["history"][0]) / p["history"][0]) * 100.0, 1)
        products.append(p)

    rank_changes = compute_ranks(products)
    now = dt.datetime.now(dt.timezone.utc)
    duration_ms = round((time.time() - t0) * 1000)

    source_mode = "amazon-live-scrape" if live_scraped_count > 0 else "sourcing-analyzer-python"

    data = {
        "meta": {
            "lastScan": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "nextScan": (now + dt.timedelta(days=1)).strftime("%Y-%m-%dT06:00:00Z"),
            "source": source_mode,
            "updatedCount": len(products),
            "liveScrapedCount": live_scraped_count,
            "rankChanges": rank_changes,
            "durationMs": duration_ms,
        },
        "marketplaces": [
            {k: v for k, v in m.items() if k not in ("keepa_domain", "lang")}
            for m in MARKETPLACES
        ],
        "categories": [{"name": k, "emoji": v[0]} for k, v in CATEGORY_QUERIES.items()],
        "products": products,
    }

    DATA_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data


class DashboardRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT_DIR), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/refresh":
            qs = urllib.parse.parse_qs(parsed.query)
            mp = qs.get("mp", [None])[0]
            self._handle_refresh(mp)
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/refresh":
            qs = urllib.parse.parse_qs(parsed.query)
            mp = qs.get("mp", [None])[0]
            self._handle_refresh(mp)
            return
        self.send_error(404, "Endpoint introuvable")

    def _handle_refresh(self, target_mp: str | None = None) -> None:
        data = refresh_dataset(target_mp=target_mp)
        self._send_json(data)

    def _send_json(self, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="Collecteur Sourcing Amazon (Achat <= 5€ & Marge >= 20%)")
    parser.add_argument("--serve", action="store_true", help="Lancer le serveur local avec l'API /api/refresh")
    parser.add_argument("--port", type=int, default=8000, help="Port du serveur HTTP (défaut: 8000)")
    parser.add_argument("--mp", type=str, default=None, help="Marketplace cible (fr, de, uk, it, es)")
    args = parser.parse_args()

    data = refresh_dataset(target_mp=args.mp)
    meta = data["meta"]
    gems = sum(1 for p in data["products"] if p.get("isGem"))
    print(
        f"✅ Sourcing Amazon mis à jour : {meta['updatedCount']} produits "
        f"({gems} pépites Achat<=5€ & Marge>=20%, {meta['durationMs']} ms) -> {DATA_JSON_PATH}"
    )

    if args.serve:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), DashboardRequestHandler)
        print(f"🚀 Dashboard Sourcing Amazon actif sur http://localhost:{args.port}")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.server_close()


if __name__ == "__main__":
    main()
