/* The Humidor · cigar size photos (plan 39, RAY 24 Nov). The slot list only: the photos themselves are
   retailer shots kept in the PRIVATE Supabase bucket 'cigars' (supabase/cigar-photos.sql), never in this
   repo. Filenames are the catalogue's slot ids (P15.003 HUMIDOR images, MAPPED cigar sizes CSV), so a
   leader uploads the 38 files from Humidor > Admin > Cigar photos with no renaming.
   HumidorPhotos.url(name) → a signed URL (1 hour) or null when there is no photo yet. */
(function () {
  const BUCKET = 'cigars';
  // Chart size name → object name. 38 of the catalogue's 41 rows have a photo.
  const FILES = {
    'Mini Cigarillo': 'size-photo-parejo-mini-cigarillo.jpg', 'Perla': 'size-photo-parejo-perla.png', 'Petit Robusto': 'size-photo-parejo-petit-robusto.png',
    'Petit Edmundo': 'size-photo-parejo-petit-edmundo.png', 'Rothschild': 'size-photo-parejo-rothschild.jpg', 'Laguito No.3': 'size-photo-parejo-laguito-no-3.png',
    'Robusto': 'size-photo-parejo-robusto.png', 'Petit Corona': 'size-photo-parejo-petit-corona.png', 'Corona': 'size-photo-parejo-corona.png',
    'Carlota': 'size-photo-parejo-carlota.png', 'Corona Gorda': 'size-photo-parejo-corona-gorda.png', 'Laguito No.2': 'size-photo-parejo-laguito-no-2.png',
    'Gordo': 'size-photo-parejo-gordo.jpg', 'Corona Grande': 'size-photo-parejo-corona-grande.png', 'Toro': 'size-photo-parejo-toro.jpg',
    'Presidente': 'size-photo-parejo-presidente.png', 'Churchill': 'size-photo-parejo-churchill.png', 'Lancero': 'size-photo-parejo-lancero.png',
    'Double Corona': 'size-photo-parejo-double-corona.png', 'Gran Corona': 'size-photo-parejo-gran-corona.jpg',
    'Torpedo': 'size-photo-torpedo-torpedo.png', 'Long Torpedo': 'size-photo-torpedo-long-torpedo.jpg', 'Pirámide': 'size-photo-pyramid-pira-mide.png',
    'Petit Belicoso': 'size-photo-belicoso-petit-belicoso.jpg', 'Mini Belicoso': 'size-photo-belicoso-mini-belicoso.png', 'Campana': 'size-photo-belicoso-campana.png',
    'Belicoso': 'size-photo-belicoso-belicoso.jpg', 'Belicoso Grande': 'size-photo-belicoso-belicoso-grande.jpg',
    'Petit Bouquet': 'size-photo-perfecto-petit-bouquet.png', 'Favorito': 'size-photo-perfecto-favorito.png', 'Generoso': 'size-photo-perfecto-generoso.png',
    'Exquisito': 'size-photo-perfecto-exquisito.png', 'Romeo': 'size-photo-perfecto-romeo.png', 'Salomón': 'size-photo-perfecto-salomo-n.png',
    'Diadema': 'size-photo-perfecto-diadema.jpg', 'Chisel': 'size-photo-chisel-chisel.png', 'Big Chisel': 'size-photo-chisel-big-chisel.png',
    'Culebra': 'size-photo-culebra-culebra.png'
  };
  // Catalogue rows with no photo (none of them is on the chart's sample shelf).
  const MISSING = [['Conchita', 'size-photo-parejo-conchita'], ['Lonsdale', 'size-photo-parejo-lonsdale'], ['Pyramid 6″ × 52', 'size-photo-pyramid-pyramid']];
  // The catalogue README's near matches: the photo is close to, not exactly, the size.
  const NEAR = {
    'Mini Cigarillo': 'Near match: the photo is 3¼″ × 21, not 3⅜″ × 20.',
    'Presidente': 'Near match: the photo is a straight 6″ × 47, not 6¼″ × 47.',
    'Lancero': 'Near match: the photo is a 38 ring, not 39.'
  };
  const cache = {};
  // RAY, 24 Nov: the site's own copies in assets/humidor/cigars/ stay public, so the window uses them directly.
  // The private bucket path below stays for reference but is no longer called.
  async function url(name) { const file = FILES[name]; return file ? 'assets/humidor/cigars/' + file : null; }
  async function bucketUrl(name) {
    const file = FILES[name]; if (!file || !window.FY || !FY.sb) return null;
    const c = cache[file]; if (c && c.until > Date.now()) return c.url;
    const { data, error } = await FY.sb.storage.from(BUCKET).createSignedUrl(file, 3600);
    if (error || !data || !data.signedUrl) return null;
    cache[file] = { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 };
    return data.signedUrl;
  }
  window.HumidorPhotos = { BUCKET, FILES, MISSING, NEAR, url };
})();
