// SAMPLE DATA, NOT REAL STOCK. 38 cigar sizes with illustrative attributes, from the Claude Design handoff (Humidor v2.0, RAY 24 Nov).
// Sample shelf + question set for the Humidor concept drafts. Attributes are illustrative, not real stock.
(function(){
  const SIZES = [
    ['parejo','Mini Cigarillo',3.375,20],['parejo','Perla',4,40],['parejo','Petit Robusto',4,50],['parejo','Petit Edmundo',4.375,52],
    ['parejo','Rothschild',4.5,48],['parejo','Laguito No.3',4.5,26],['parejo','Robusto',4.875,50],['parejo','Petit Corona',5.125,42],
    ['parejo','Corona',5.625,42],['parejo','Carlota',5.625,35],['parejo','Corona Gorda',5.625,46],['parejo','Laguito No.2',6,38],
    ['parejo','Gordo',6,60],['parejo','Corona Grande',6.125,42],['parejo','Toro',6.125,50],['parejo','Presidente',6.25,47],
    ['parejo','Churchill',7,47],['parejo','Lancero',7.5,39],['parejo','Double Corona',7.625,49],['parejo','Gran Corona',9.25,47],
    ['torpedo','Torpedo',6.125,52],['torpedo','Long Torpedo',6.5,54],['pyramid','Pirámide',6.125,52],
    ['belicoso','Petit Belicoso',4.875,52],['belicoso','Mini Belicoso',5,52],['belicoso','Campana',5.5,52],['belicoso','Belicoso',6,52],['belicoso','Belicoso Grande',6.125,52],
    ['perfecto','Petit Bouquet',4,43],['perfecto','Favorito',4.75,42],['perfecto','Generoso',5.25,42],['perfecto','Exquisito',5.75,46],
    ['perfecto','Romeo',6.375,52],['perfecto','Salomón',7.25,57],['perfecto','Diadema',9.125,55],
    ['chisel','Chisel',6,54],['chisel','Big Chisel',6.5,58],['culebra','Culebra',5.75,39]
  ];
  const ext = { 'Gordo':'jpg','Gran Corona':'jpg','Mini Cigarillo':'jpg','Rothschild':'jpg','Toro':'jpg','Diadema':'jpg','Long Torpedo':'jpg','Belicoso Grande':'jpg','Belicoso':'jpg','Petit Belicoso':'jpg' };
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, m => '-').replace(/\./g,' ').replace(/[^a-z0-9-]+/g,'-').replace(/-+$/,'');
  const fix = { 'Pirámide':'pira-mide', 'Salomón':'salomo-n' };
  const FLAV = ['Creamy','Nutty','Woody','Spicy','Sweet','Earthy'];
  const WR = ['Light','Medium','Dark'];
  const CIGARS = [];
  SIZES.forEach(([shape, name, len, ring], i) => {
    const mins = Math.round(len * ring * 0.24 / 5) * 5;
    const img = 'img/cigars/size-photo-' + shape + '-' + (fix[name] || slug(name)) + '.' + (ext[name] || 'png');
    WR.forEach((wrapper, w) => {
      const strength = w === 0 ? (i % 3 === 0 ? 'Medium' : 'Mild') : w === 1 ? (i % 4 === 0 ? 'Full' : i % 3 === 1 ? 'Mild' : 'Medium') : (i % 2 ? 'Full' : 'Medium');
      const price = Math.round((4 + mins * 0.13 + w * 2.5 + (i % 5) * 1.6) * 2) / 2;
      CIGARS.push({ id: i + '-' + w, size: name, shape, len, ring, mins, img, wrapper, strength, price, flav: [FLAV[(i + w) % 6], FLAV[(i * 2 + w + 3) % 6]] });
    });
  });
  const QUESTIONS = [
    { key:'budget', short:'Budget', kicker:'What it costs', q:'What will you spend on one cigar?',
      tip:'Priced per stick. Everyone chips in the same, so the most common answer sets the ceiling.',
      options:[ {v:'Under £10', sub:'A solid everyday smoke', t:c=>c.price<10},
                {v:'£10 – £18', sub:'Where most good ones sit', t:c=>c.price>=10&&c.price<18},
                {v:'£18 – £30', sub:'A proper treat', t:c=>c.price>=18&&c.price<30},
                {v:'£30 +', sub:'Special occasion', t:c=>c.price>=30} ] },
    { key:'time', short:'Burn time', kicker:'How long it lasts', q:'How long have you got?',
      tip:'Length sets the time, thickness slows it down. A robusto is about an hour.',
      options:[ {v:'Half an hour', sub:'Short and small', t:c=>c.mins<=40},
                {v:'About an hour', sub:'Robusto, corona', t:c=>c.mins>40&&c.mins<=65},
                {v:'An hour and a half', sub:'Toro, torpedo', t:c=>c.mins>65&&c.mins<=95},
                {v:'All night', sub:'Churchill and up', t:c=>c.mins>95} ] },
    { key:'strength', short:'Strength', kicker:'How hard it hits', q:'How strong?',
      tip:'Strength is the nicotine kick, not the taste. New to it? Start mild.',
      options:[ {v:'Mild', sub:'Easy going', t:c=>c.strength==='Mild'},
                {v:'Medium', sub:'Some backbone', t:c=>c.strength==='Medium'},
                {v:'Full', sub:'Sit down first', t:c=>c.strength==='Full'} ] },
    { key:'wrapper', short:'Wrapper', kicker:'The outside leaf', q:'Light, medium or dark leaf?',
      tip:'The wrapper gives most of the flavour. Darker is sweeter, not stronger.',
      options:[ {v:'Light', sub:'Creamy, grassy', t:c=>c.wrapper==='Light'},
                {v:'Medium', sub:'Nutty, woody', t:c=>c.wrapper==='Medium'},
                {v:'Dark', sub:'Sweet, rich', t:c=>c.wrapper==='Dark'} ] },
    { key:'flavour', short:'Flavour', kicker:'Nice to have', q:'Any flavour you like?', optional:true, multi:2,
      tip:'Optional. Pick up to two. Hank uses it to break a tie, it never rules a cigar out.',
      options: FLAV.map(f => ({ v:f, sub:'', t:c=>c.flav.includes(f) })) }
  ];
  const ROUND = ['Your taste','Hank picks three','Rank them','Pay or pass'];
  // hard filters = first four; flavour only ranks
  const filter = (answers, upto) => { let list = CIGARS; QUESTIONS.slice(0, upto == null ? 4 : Math.min(upto, 4)).forEach(q => { const a = answers[q.key]; if (!a) return; const o = q.options.find(x => x.v === a); if (o) list = list.filter(o.t); }); return list; };
  const sizesOf = list => { const seen = {}; return list.filter(c => seen[c.size] ? false : (seen[c.size] = true)); };
  window.HumidorShelf = { CIGARS, QUESTIONS, ROUND, filter, sizesOf, FLAV };
})();
