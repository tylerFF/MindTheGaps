const https = require('https');

const API_KEY = process.env.JOTFORM_API_KEY;
const FORM_ID = '260435948553162';

https.get(`https://eu-api.jotform.com/form/${FORM_ID}/properties?apiKey=${API_KEY}`, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const j = JSON.parse(data);
    const conds = j.content.conditions;

    if (!conds) {
      console.log('No conditions found!');
      return;
    }

    // Could be array or object
    const condArray = Array.isArray(conds) ? conds : Object.values(conds);
    console.log('Total conditions:', condArray.length);
    console.log('---');

    condArray.forEach((c, i) => {
      const terms = typeof c.terms === 'string' ? JSON.parse(c.terms) : c.terms;
      const termsArr = Array.isArray(terms) ? terms : Object.values(terms);
      const action = typeof c.action === 'string' ? JSON.parse(c.action) : c.action;
      const actionArr = Array.isArray(action) ? action : Object.values(action);

      const termStr = termsArr.map(t => `q${t.field}="${t.value}"`).join(' AND ');
      const shows = actionArr.filter(a => a.visibility === 'Show' || a.visibility === 'ShowMultiple')
        .flatMap(a => a.field ? [a.field] : (a.fields || []));
      const hides = actionArr.filter(a => a.visibility === 'Hide' || a.visibility === 'HideMultiple')
        .flatMap(a => a.field ? [a.field] : (a.fields || []));

      console.log(`${i + 1}. When ${termStr}`);
      if (shows.length > 0) console.log(`   Show: [${shows.join(', ')}]`);
      if (hides.length > 0) console.log(`   Hide: [${hides.join(', ')}]`);
    });
  });
});
