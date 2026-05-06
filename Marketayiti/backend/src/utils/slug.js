function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/ç/g, 'c').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function ensureUniqueSlug(base, existsFn) {
  let slug = base;
  let counter = 1;
  while (existsFn(slug)) {
    slug = `${base}-${++counter}`;
    if (counter > 100) { slug = `${base}-${Date.now()}`; break; }
  }
  return slug;
}

module.exports = { slugify, ensureUniqueSlug };
