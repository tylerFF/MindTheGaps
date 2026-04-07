const https = require('https');
const querystring = require('querystring');

const API_KEY = process.env.JOTFORM_API_KEY;
const FORM_ID = '260435948553162';

const ACQ_LADDERS = ['69','70','71'];
const CONV_LADDERS = ['72','73','74','75'];
const RET_LADDERS = ['76','77','78'];

const conditions = [
  // 1-3: Gap-level pillar conditions (updated to also hide cross-pillar ladders)
  {
    type: "field", link: "Any",
    terms: [{field:"9",operator:"equals",value:"Retention"}],
    action: [
      {visibility:"ShowMultiple",fields:["38","62","13","29","30","31","32","33","34"]},
      {visibility:"HideMultiple",fields:["61","37","36","60","11","12","22","23","24","25","26","27","28","15","16","17","18","19","20","21",...CONV_LADDERS,...ACQ_LADDERS]}
    ]
  },
  {
    type: "field", link: "Any",
    terms: [{field:"9",operator:"equals",value:"Acquisition"}],
    action: [
      {visibility:"ShowMultiple",fields:["12","61","37","22","23","24","25","26","27","28"]},
      {visibility:"HideMultiple",fields:["11","13","36","38","60","62","15","16","17","18","19","20","21","29","30","31","32","33","34",...CONV_LADDERS,...RET_LADDERS]}
    ]
  },
  {
    type: "field", link: "Any",
    terms: [{field:"9",operator:"equals",value:"Conversion"}],
    action: [
      {visibility:"ShowMultiple",fields:["11","36","60","15","16","17","18","19","20","21"]},
      {visibility:"HideMultiple",fields:["12","13","37","38","61","62","22","23","24","25","26","27","28","29","30","31","32","33","34",...ACQ_LADDERS,...RET_LADDERS]}
    ]
  },
  // 4-12: Gap-change reason conditions
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Acquisition"},{field:"7",operator:"equals",value:"Conversion"}],action:[{visibility:"Show",field:"10"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Acquisition"},{field:"7",operator:"equals",value:"Retention"}],action:[{visibility:"Show",field:"10"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Conversion"},{field:"7",operator:"equals",value:"Acquisition"}],action:[{visibility:"Show",field:"10"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Conversion"},{field:"7",operator:"equals",value:"Retention"}],action:[{visibility:"Show",field:"10"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Retention"},{field:"7",operator:"equals",value:"Acquisition"}],action:[{visibility:"Show",field:"10"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Retention"},{field:"7",operator:"equals",value:"Conversion"}],action:[{visibility:"Show",field:"10"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Acquisition"},{field:"7",operator:"equals",value:"Acquisition"}],action:[{visibility:"Hide",field:"10"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Conversion"},{field:"7",operator:"equals",value:"Conversion"}],action:[{visibility:"Hide",field:"10"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Retention"},{field:"7",operator:"equals",value:"Retention"}],action:[{visibility:"Hide",field:"10"}]},

  // 13-18: Acquisition sub-path ladders
  {type:"field",link:"Any",terms:[{field:"12",operator:"equals",value:"Demand capture / local visibility"}],action:[{visibility:"Show",field:"69"},{visibility:"HideMultiple",fields:["70","71"]}]},
  {type:"field",link:"Any",terms:[{field:"12",operator:"equals",value:"Lead capture friction"}],action:[{visibility:"Show",field:"70"},{visibility:"HideMultiple",fields:["69","71"]}]},
  {type:"field",link:"Any",terms:[{field:"12",operator:"equals",value:"Channel concentration risk"}],action:[{visibility:"Show",field:"71"},{visibility:"HideMultiple",fields:["69","70"]}]},
  {type:"field",link:"Any",terms:[{field:"12",operator:"equals",value:"Fit mismatch"}],action:[{visibility:"HideMultiple",fields:["69","70","71"]}]},
  {type:"field",link:"Any",terms:[{field:"12",operator:"equals",value:"Referral / partner flow is not intentional"}],action:[{visibility:"HideMultiple",fields:["69","70","71"]}]},
  {type:"field",link:"Any",terms:[{field:"12",operator:"equals",value:"Lead tracking + ownership gap"}],action:[{visibility:"HideMultiple",fields:["69","70","71"]}]},

  // 19-23: Conversion sub-path ladders
  {type:"field",link:"Any",terms:[{field:"11",operator:"equals",value:"Speed-to-lead"}],action:[{visibility:"Show",field:"72"},{visibility:"HideMultiple",fields:["73","74","75"]}]},
  {type:"field",link:"Any",terms:[{field:"11",operator:"equals",value:"Booking friction"}],action:[{visibility:"Show",field:"73"},{visibility:"HideMultiple",fields:["72","74","75"]}]},
  {type:"field",link:"Any",terms:[{field:"11",operator:"equals",value:"Show rate"}],action:[{visibility:"Show",field:"74"},{visibility:"HideMultiple",fields:["72","73","75"]}]},
  {type:"field",link:"Any",terms:[{field:"11",operator:"equals",value:"Quote follow-up / decision drop-off"}],action:[{visibility:"Show",field:"75"},{visibility:"HideMultiple",fields:["72","73","74"]}]},
  {type:"field",link:"Any",terms:[{field:"11",operator:"equals",value:"Stage clarity + follow-up consistency gap"}],action:[{visibility:"HideMultiple",fields:["72","73","74","75"]}]},

  // 24-28: Retention sub-path ladders
  {type:"field",link:"Any",terms:[{field:"13",operator:"equals",value:"Post-service follow-up gap"}],action:[{visibility:"Show",field:"76"},{visibility:"HideMultiple",fields:["77","78"]}]},
  {type:"field",link:"Any",terms:[{field:"13",operator:"equals",value:"Review rhythm gap"}],action:[{visibility:"Show",field:"77"},{visibility:"HideMultiple",fields:["76","78"]}]},
  {type:"field",link:"Any",terms:[{field:"13",operator:"equals",value:"Referral ask gap"}],action:[{visibility:"Show",field:"77"},{visibility:"HideMultiple",fields:["76","78"]}]},
  {type:"field",link:"Any",terms:[{field:"13",operator:"equals",value:"Rebook/recall gap"}],action:[{visibility:"Show",field:"78"},{visibility:"HideMultiple",fields:["76","77"]}]},
  {type:"field",link:"Any",terms:[{field:"13",operator:"equals",value:"Value review / renewal alignment gap"}],action:[{visibility:"HideMultiple",fields:["76","77","78"]}]},
];

// Build form-encoded body with indexed array format
const parts = [];
conditions.forEach((cond, i) => {
  const prefix = `properties[conditions][${i}]`;
  parts.push(`${prefix}[type]=${encodeURIComponent(cond.type)}`);
  parts.push(`${prefix}[link]=${encodeURIComponent(cond.link)}`);
  parts.push(`${prefix}[terms]=${encodeURIComponent(JSON.stringify(cond.terms))}`);
  parts.push(`${prefix}[action]=${encodeURIComponent(JSON.stringify(cond.action))}`);
});
const body = parts.join('&');

const options = {
  hostname: 'eu-api.jotform.com',
  path: '/form/' + FORM_ID + '/properties?apiKey=' + API_KEY,
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const j = JSON.parse(data);
    console.log('Response:', j.responseCode, j.message);
    console.log('Total conditions sent:', conditions.length);
    if (j.responseCode !== 200) console.log('Detail:', data.substring(0, 1000));
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
