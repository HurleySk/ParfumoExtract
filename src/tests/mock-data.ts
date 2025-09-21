export const mockFragranceListHTML = `
<!DOCTYPE html>
<html>
<head><title>Parfumo - Perfumes</title></head>
<body>
  <div class="fragrance-list">
    <a href="/perfume/Chanel/No-5-1234.html" class="fragrance-link">Chanel No. 5</a>
    <a href="/perfume/Dior/Sauvage-5678.html" class="fragrance-link">Dior Sauvage</a>
    <a href="/fragrance/Creed/Aventus-9012.html">Creed Aventus</a>
  </div>
</body>
</html>
`;

export const mockFragrancePageHTML = `
<!DOCTYPE html>
<html>
<head><title>Aventus by Creed</title></head>
<body>
  <h1 itemprop="name">Aventus</h1>
  <span itemprop="brand">Creed</span>

  <div class="release-year">Released: 2010</div>
  <div class="gender">Men</div>
  <div class="fragrance-type">Eau de Parfum</div>
  <div class="concentration">Eau de Parfum</div>

  <div itemprop="description">
    Aventus celebrates strength, vision and success, inspired by the dramatic life of war,
    peace and romance lived by Emperor Napoleon.
  </div>

  <div class="ratings">
    <span itemprop="ratingValue">4.25</span>
    <span itemprop="ratingCount">12543</span>
  </div>

  <div class="performance">
    <span>Longevity</span>
    <span class="rating-bar" data-value="3.8">3.8</span>
    <span>Sillage</span>
    <span class="rating-bar" data-value="3.5">3.5</span>
  </div>

  <div class="pyramid-level">
    <h3>Top Notes</h3>
    <a href="/note/Pineapple" class="note-name">Pineapple</a>
    <a href="/note/Bergamot" class="note-name">Bergamot</a>
    <a href="/note/Black-Currant" class="note-name">Black Currant</a>
    <a href="/note/Apple" class="note-name">Apple</a>
  </div>

  <div class="pyramid-level">
    <h3>Middle Notes</h3>
    <a href="/note/Birch" class="note-name">Birch</a>
    <a href="/note/Patchouli" class="note-name">Patchouli</a>
    <a href="/note/Rose" class="note-name">Rose</a>
    <a href="/note/Jasmine" class="note-name">Jasmine</a>
  </div>

  <div class="pyramid-level">
    <h3>Base Notes</h3>
    <a href="/note/Musk" class="note-name">Musk</a>
    <a href="/note/Oak-Moss" class="note-name">Oak Moss</a>
    <a href="/note/Ambergris" class="note-name">Ambergris</a>
    <a href="/note/Vanilla" class="note-name">Vanilla</a>
  </div>

  <div class="perfumers">
    <span>Perfumer</span>
    <a href="/perfumer/Olivier-Creed">Olivier Creed</a>
    <a href="/perfumer/Erwin-Creed">Erwin Creed</a>
  </div>

  <div class="accords">
    <div class="accord-bar" data-strength="75">
      <span class="accord-name">Fruity</span>
    </div>
    <div class="accord-bar" data-strength="65">
      <span class="accord-name">Woody</span>
    </div>
    <div class="accord-bar" data-strength="55">
      <span class="accord-name">Smoky</span>
    </div>
  </div>

  <div class="seasons">
    <span>Spring: 85</span>
    <span>Summer: 70</span>
    <span>Fall: 95</span>
    <span>Winter: 60</span>
  </div>

  <div class="occasions">
    <span data-rating="90">Business</span>
    <span data-rating="85">Evening</span>
    <span data-rating="70">Casual</span>
    <span data-rating="95">Special Occasions</span>
  </div>
</body>
</html>
`;

export const mockRobotsTxt = `
User-agent: *
Disallow: /admin/
Disallow: /api/
Disallow: /user/
Allow: /perfume/
Allow: /fragrance/
Crawl-delay: 2
Sitemap: https://www.parfumo.com/sitemap.xml
`;

export const mockEmptyFragrancePageHTML = `
<!DOCTYPE html>
<html>
<head><title>Unknown Fragrance</title></head>
<body>
  <h1>Unknown Fragrance</h1>
  <div class="error">Fragrance not found</div>
</body>
</html>
`;