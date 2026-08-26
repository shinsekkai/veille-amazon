/* Jeu de données de DÉMONSTRATION généré de façon déterministe côté navigateur.
   À remplacer par la sortie réelle du pipeline de collecte (Keepa/PA-API + scraping ciblé) :
   il suffit d'exposer le même objet `window.VEILLE_DATA`. */
(function () {
  "use strict";

  // PRNG déterministe (mulberry32) — sortie identique à chaque chargement.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(20260817);
  const rand = (a, b) => a + (b - a) * rng();
  const randint = (a, b) => Math.floor(rand(a, b + 1));
  const choice = arr => arr[Math.floor(rng() * arr.length)];
  const sample = (arr, k) => {
    const c = arr.slice();
    for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
    return c.slice(0, k);
  };

  const MARKETPLACES = [
    { id: "fr", label: "amazon.fr", flag: "🇫🇷", country: "France", currency: "EUR", symbol: "€" },
    { id: "de", label: "amazon.de", flag: "🇩🇪", country: "Allemagne", currency: "EUR", symbol: "€" },
    { id: "uk", label: "amazon.co.uk", flag: "🇬🇧", country: "Royaume-Uni", currency: "GBP", symbol: "£" },
    { id: "it", label: "amazon.it", flag: "🇮🇹", country: "Italie", currency: "EUR", symbol: "€" },
    { id: "es", label: "amazon.es", flag: "🇪🇸", country: "Espagne", currency: "EUR", symbol: "€" },
  ];

  // Catégories Amazon natives -> [emoji, [ [titre, marque], ... ] ]
  const CATEGORIES = {
    "Électronique": ["🎧", [
      ["Casque Bluetooth à réduction de bruit", "SoundCore"], ["Écouteurs sans fil intra-auriculaires", "AeroBuds"],
      ["Chargeur USB-C 65W GaN", "PowerNova"], ["Barre de son 2.1 Dolby", "AudioMax"],
      ["Enceinte portable étanche", "BoomGo"], ["Batterie externe 20000mAh", "VoltPack"],
      ["Casque audio filaire hi-fi", "PureTone"], ["Câble HDMI 2.1 8K 2m", "LinkPro"],
      ["Station de charge 3-en-1", "DockPlus"], ["Liseuse écran e-ink 6\"", "PageLite"],
      ["Cadre photo numérique WiFi", "FrameView"], ["Micro-cravate sans fil", "MicClip"],
    ]],
    "Informatique": ["💻", [
      ["Clavier mécanique rétroéclairé", "KeyForge"], ["Souris gaming 26000 DPI", "RaptorX"],
      ["SSD NVMe 1To", "DataZoom"], ["Hub USB-C 7-en-1", "PortHub"],
      ["Webcam 1080p autofocus", "ClearView"], ["Support d'ordinateur portable ergonomique", "DeskLift"],
      ["Disque dur externe 4To", "VaultDrive"], ["Clé USB 128Go USB 3.2", "FlashGo"],
      ["Tapis de souris XXL", "GlidePad"], ["Casque-micro gaming 7.1", "SonarHz"],
      ["Routeur WiFi 6 mesh", "NetWave"], ["Écran portable 15,6\" USB-C", "ScreenGo"],
    ]],
    "Maison & Cuisine": ["🍳", [
      ["Friteuse sans huile 5,5L", "AirCrisp"], ["Robot pâtissier 1500W", "MixPro"],
      ["Aspirateur balai sans fil", "CycloVac"], ["Cafetière à grains automatique", "BaristaOne"],
      ["Blender chauffant 1200W", "SmoothMax"], ["Set de couteaux en inox", "ChefEdge"],
      ["Bouilloire électrique à température", "HeatWell"], ["Balance de cuisine connectée", "GramSmart"],
      ["Autocuiseur multifonction 6L", "InstaChef"], ["Diffuseur d'huiles essentielles", "AromaMist"],
      ["Set de boîtes de conservation", "FreshBox"], ["Machine à pâtes manuelle", "PastaRoll"],
    ]],
    "Beauté & Parfum": ["💄", [
      ["Sèche-cheveux ionique", "AeroDry"], ["Brosse lissante chauffante", "GlossPro"],
      ["Tondeuse à barbe de précision", "TrimMaster"], ["Sérum vitamine C bio", "GlowLab"],
      ["Lisseur céramique vapeur", "SilkStraight"], ["Épilateur lumière pulsée", "SmoothIPL"],
      ["Palette maquillage 24 teintes", "ColorMuse"], ["Brosse nettoyante visage", "PureFace"],
      ["Coffret parfum boisé 50ml", "NoirEssence"], ["Boucleur automatique", "CurlMagic"],
    ]],
    "Sports & Loisirs": ["🏃", [
      ["Montre GPS multisport", "PulseTrack"], ["Tapis de yoga antidérapant", "ZenMat"],
      ["Corde à sauter connectée", "JumpFit"], ["Gourde isotherme 1L", "HydroKeep"],
      ["Haltères ajustables 24kg", "FlexWeight"], ["Vélo d'appartement pliable", "SpinHome"],
      ["Bandes de résistance (set)", "FlexBand"], ["Sac de sport imperméable 40L", "GymCarry"],
      ["Tente 2 places ultralégère", "TrekDome"], ["Bracelet d'activité", "FitBand"],
      ["Ballon de fitness 65cm", "CoreBall"],
    ]],
    "Jardin": ["🌿", [
      ["Tondeuse robot connectée", "MowBot"], ["Nettoyeur haute pression 140 bars", "JetClean"],
      ["Salon de jardin résine tressée", "OutLiving"], ["Barbecue à gaz 3 brûleurs", "GrillMaster"],
      ["Tuyau d'arrosage extensible 30m", "FlexHose"], ["Serre de jardin 2m²", "GreenGrow"],
      ["Parasol déporté 3m", "ShadeMax"], ["Programmateur d'arrosage", "DripTimer"],
      ["Brasero de jardin acier", "FirePit"],
    ]],
    "Jouets & Jeux": ["🧸", [
      ["Circuit de billes 300 pièces", "MarbleRun"], ["Drone caméra pour enfant", "SkyKid"],
      ["Puzzle 1000 pièces panorama", "PuzzleWorld"], ["Jeu de société stratégie", "TableQuest"],
      ["Briques de construction 500 pcs", "BrickCity"], ["Peluche interactive", "CuddleBot"],
      ["Circuit voiture télécommandée", "RaceTrack"], ["Kit de science pour enfant", "LabKids"],
      ["Jeu de cartes familial", "CardFun"],
    ]],
    "Auto & Moto": ["🚗", [
      ["Caméra embarquée 4K", "RoadEye"], ["Compresseur d'air portable", "TirePump"],
      ["Support téléphone magnétique", "MagMount"], ["Aspirateur de voiture sans fil", "AutoVac"],
      ["Chargeur de batterie intelligent", "AmpCare"], ["Housse de protection voiture", "CarShield"],
      ["Kit de démarrage booster", "JumpStart"], ["Organisateur de coffre pliable", "TrunkTidy"],
      ["Manomètre digital pression", "PSIcheck"],
    ]],
    "Bricolage": ["🔧", [
      ["Perceuse-visseuse 20V", "DrillForce"], ["Set de tournevis de précision", "FixKit"],
      ["Mètre laser 40m", "LaserMeasure"], ["Ponceuse excentrique 350W", "SandPro"],
      ["Coffret de douilles 108 pièces", "SocketSet"], ["Scie sauteuse 700W", "CutMax"],
      ["Établi pliant portable", "WorkFold"], ["Pistolet à colle chaude", "GlueGun"],
      ["Niveau laser croix", "CrossLine"],
    ]],
    "Mode": ["👟", [
      ["Baskets running légères", "StrideOne"], ["Sac à dos imperméable 30L", "UrbanPack"],
      ["Montre automatique acier", "TimeCraft"], ["Lunettes de soleil polarisées", "SunGuard"],
      ["Ceinture cuir réversible", "BeltCraft"], ["Portefeuille anti-RFID", "SafeFold"],
      ["Doudoune légère compressible", "PackDown"], ["Bottines chelsea cuir", "StepUp"],
      ["Écharpe cachemire", "SoftWrap"],
    ]],
    "Animalerie": ["🐾", [
      ["Fontaine à eau pour chat", "PetFlow"], ["Distributeur automatique de croquettes", "FeedSmart"],
      ["Harnais anti-traction pour chien", "WalkEasy"], ["Arbre à chat 120cm", "ClimbTree"],
      ["Panier orthopédique pour chien", "CozyRest"], ["Litière autonettoyante", "CleanPaw"],
      ["Jouet distributeur de friandises", "TreatBall"],
    ]],
    "Livres": ["📚", [
      ["Best-seller thriller de l'année", "Éditions Nord"], ["Guide de développement personnel", "MindPress"],
      ["Roman feel-good", "Éditions Soleil"], ["Manuel de cuisine 500 recettes", "Éditions Gourmet"],
      ["BD aventure tome 1", "Éditions Bulle"], ["Essai société contemporaine", "Éditions Forum"],
      ["Livre pour enfant illustré", "Éditions Petit"],
    ]],
  };

  function genHistory(base, days, volatility, trendPerDay) {
    const pts = [];
    let val = base * (1 - (trendPerDay * days) / 2 / 100);
    for (let d = 0; d < days; d++) {
      val = val * (1 + trendPerDay / 100) * (1 + rand(-volatility, volatility));
      pts.push(Math.max(0, Math.round(val)));
    }
    return pts;
  }

  const ASIN_CHARS = "0123456789ABCDEFGHJKLMNP";
  const products = [];
  let pid = 0;
  const baseChoices = [50, 100, 200, 300, 500, 800, 1000, 2000, 4000, 6000];

  Object.keys(CATEGORIES).forEach(cat => {
    const emoji = CATEGORIES[cat][0];
    CATEGORIES[cat][1].forEach(([title, brand]) => {
      MARKETPLACES.forEach(mp => {
        if (rng() < 0.42) return; // fiche sans badge de ventes -> exclue (règle du brief)
        pid++;
        const baseSales = choice(baseChoices);
        let monthly = Math.round(baseSales * rand(0.6, 1.6));
        const trend = rand(-14, 18);
        const hist = genHistory(monthly, 30, 0.10, trend / 30);
        monthly = hist[hist.length - 1];
        const prevMonthly = hist[0];
        const price = Math.round(rand(9.9, 399.0) * 100) / 100;
        const rating = Math.round(rand(3.6, 4.9) * 10) / 10;
        const reviews = randint(45, 38000);
        let asin = "B0";
        for (let i = 0; i < 8; i++) asin += ASIN_CHARS[Math.floor(rng() * ASIN_CHARS.length)];
        products.push({
          id: pid, asin, title, brand, category: cat, emoji,
          marketplace: mp.id, price, currency: mp.currency, symbol: mp.symbol,
          monthlySales: monthly, prevMonthlySales: prevMonthly,
          rating, reviews, history: hist, trend: Math.round(trend * 10) / 10,
        });
      });
    });
  });

  // Rangs courant / précédent par (marketplace, catégorie) — pour les alertes
  const groups = {};
  products.forEach(p => { (groups[p.marketplace + "|" + p.category] = groups[p.marketplace + "|" + p.category] || []).push(p); });
  Object.values(groups).forEach(list => {
    list.slice().sort((a, b) => b.monthlySales - a.monthlySales).forEach((p, i) => { p.rank = i + 1; });
    list.slice().sort((a, b) => b.prevMonthlySales - a.prevMonthlySales).forEach((p, i) => { p.prevRank = i + 1; });
  });

  // Quelques nouveaux produits détectés
  sample(products, Math.max(6, Math.floor(products.length / 25))).forEach(p => { p.isNew = true; });

  window.VEILLE_DATA = {
    meta: { lastScan: "2026-08-17T06:00:00Z", nextScan: "2026-08-18T06:00:00Z" },
    marketplaces: MARKETPLACES,
    categories: Object.keys(CATEGORIES).map(k => ({ name: k, emoji: CATEGORIES[k][0] })),
    products,
  };
})();
