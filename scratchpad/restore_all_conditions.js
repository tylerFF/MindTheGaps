const https = require('https');

const API_KEY = process.env.JOTFORM_API_KEY;
const FORM_ID = '260435948553162';

// Ladder QIDs (existing — old visual summary cards, always hidden)
const ACQ_LADDERS = ['69','70','71'];
const CONV_LADDERS = ['72','73','74','75'];
const RET_LADDERS = ['76','77','78'];
const ALL_LADDERS = [...ACQ_LADDERS, ...CONV_LADDERS, ...RET_LADDERS];

// Field 2 QIDs (follow-up diagnostic questions, shown per sub-path)
const ACQ_FIELD2 = ['84','85','86'];   // A1=84, A2=85, A3=86
const CONV_FIELD2 = ['80','81','82','83']; // C1=80, C2=81, C3=82, C4=83
const RET_FIELD2 = ['87','88','89'];   // R1=87, R3=88, R4=89 (R2 has no Field 2)

// Predetermined field QIDs
const A1_FIELDS = ['95','96','97','98','99','100','179'];
const A2_FIELDS = ['101','102','103','104','105','106','180'];
const A3_FIELDS = ['107','108','109','110','111','112','181'];
const A4_FIELDS = ['113','114','115','116','117','118','182'];
const ALL_ACQ_PRED = [...A1_FIELDS, ...A2_FIELDS, ...A3_FIELDS, ...A4_FIELDS];

const C1_FIELDS = ['119','120','121','122','123','124','183'];
const C2_FIELDS = ['125','126','127','128','129','130','184'];
const C3_FIELDS = ['131','132','133','134','135','136','185'];
const C4_FIELDS = ['137','138','139','140','141','142','186'];
const C5_FIELDS = ['143','144','145','146','147','148','187'];
const ALL_CONV_PRED = [...C1_FIELDS, ...C2_FIELDS, ...C3_FIELDS, ...C4_FIELDS, ...C5_FIELDS];

const R1_FIELDS = ['149','150','151','152','153','154','188'];
const R2_FIELDS = ['155','156','157','158','159','160','189'];
const R3_FIELDS = ['161','162','163','164','165','166','190'];
const R4_FIELDS = ['167','168','169','170','171','172','191'];
const R5_FIELDS = ['173','174','175','176','177','178','192'];
const ALL_RET_PRED = [...R1_FIELDS, ...R2_FIELDS, ...R3_FIELDS, ...R4_FIELDS, ...R5_FIELDS];

function excludeFrom(all, keep) {
  return all.filter(f => !keep.includes(f));
}

const conditions = [
  // ===== ORIGINAL 28 CONDITIONS =====

  // 1-3: Gap-level pillar conditions
  {
    type: "field", link: "Any",
    terms: [{field:"9",operator:"equals",value:"Retention"}],
    action: [
      {visibility:"ShowMultiple",fields:["38","62","13","29","30","31","32","33","34"]},
      {visibility:"HideMultiple",fields:["61","37","36","60","11","12","22","23","24","25","26","27","28","15","16","17","18","19","20","21",...CONV_LADDERS,...ACQ_LADDERS,...ALL_ACQ_PRED,...ALL_CONV_PRED,...ACQ_FIELD2,...CONV_FIELD2]}
    ]
  },
  {
    type: "field", link: "Any",
    terms: [{field:"9",operator:"equals",value:"Acquisition"}],
    action: [
      {visibility:"ShowMultiple",fields:["12","61","37","22","23","24","25","26","27","28"]},
      {visibility:"HideMultiple",fields:["11","13","36","38","60","62","15","16","17","18","19","20","21","29","30","31","32","33","34",...CONV_LADDERS,...RET_LADDERS,...ALL_CONV_PRED,...ALL_RET_PRED,...CONV_FIELD2,...RET_FIELD2]}
    ]
  },
  {
    type: "field", link: "Any",
    terms: [{field:"9",operator:"equals",value:"Conversion"}],
    action: [
      {visibility:"ShowMultiple",fields:["11","36","60","15","16","17","18","19","20","21"]},
      {visibility:"HideMultiple",fields:["12","13","37","38","61","62","22","23","24","25","26","27","28","29","30","31","32","33","34",...ACQ_LADDERS,...RET_LADDERS,...ALL_ACQ_PRED,...ALL_RET_PRED,...ACQ_FIELD2,...RET_FIELD2]}
    ]
  },

  // 4-12: Gap-change reason conditions
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Acquisition"},{field:"7",operator:"equals",value:"Conversion"}],action:[{visibility:"Show",field:"10"},{visibility:"Show",field:"79"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Acquisition"},{field:"7",operator:"equals",value:"Retention"}],action:[{visibility:"Show",field:"10"},{visibility:"Show",field:"79"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Conversion"},{field:"7",operator:"equals",value:"Acquisition"}],action:[{visibility:"Show",field:"10"},{visibility:"Show",field:"79"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Conversion"},{field:"7",operator:"equals",value:"Retention"}],action:[{visibility:"Show",field:"10"},{visibility:"Show",field:"79"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Retention"},{field:"7",operator:"equals",value:"Acquisition"}],action:[{visibility:"Show",field:"10"},{visibility:"Show",field:"79"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Retention"},{field:"7",operator:"equals",value:"Conversion"}],action:[{visibility:"Show",field:"10"},{visibility:"Show",field:"79"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Acquisition"},{field:"7",operator:"equals",value:"Acquisition"}],action:[{visibility:"Hide",field:"10"},{visibility:"Hide",field:"79"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Conversion"},{field:"7",operator:"equals",value:"Conversion"}],action:[{visibility:"Hide",field:"10"},{visibility:"Hide",field:"79"}]},
  {type:"field",link:"All",terms:[{field:"9",operator:"equals",value:"Retention"},{field:"7",operator:"equals",value:"Retention"}],action:[{visibility:"Hide",field:"10"},{visibility:"Hide",field:"79"}]},

  // 13-18: Acquisition sub-path — LADDER CARDS NOW ALWAYS HIDDEN
  {type:"field",link:"Any",terms:[{field:"12",operator:"equals",value:"Demand capture / local visibility"}],action:[{visibility:"HideMultiple",fields:ACQ_LADDERS}]},
  {type:"field",link:"Any",terms:[{field:"12",operator:"equals",value:"Lead capture friction"}],action:[{visibility:"HideMultiple",fields:ACQ_LADDERS}]},
  {type:"field",link:"Any",terms:[{field:"12",operator:"equals",value:"Channel concentration risk"}],action:[{visibility:"HideMultiple",fields:ACQ_LADDERS}]},
  // REMOVED: "Fit mismatch" and "Referral / partner flow is not intentional" (old sub-path options, no longer exist)
  {type:"field",link:"Any",terms:[{field:"12",operator:"equals",value:"Lead tracking + ownership gap"}],action:[{visibility:"HideMultiple",fields:ACQ_LADDERS}]},

  // 19-23: Conversion sub-path — LADDER CARDS NOW ALWAYS HIDDEN
  {type:"field",link:"Any",terms:[{field:"11",operator:"equals",value:"Speed-to-lead"}],action:[{visibility:"HideMultiple",fields:CONV_LADDERS}]},
  {type:"field",link:"Any",terms:[{field:"11",operator:"equals",value:"Booking friction"}],action:[{visibility:"HideMultiple",fields:CONV_LADDERS}]},
  {type:"field",link:"Any",terms:[{field:"11",operator:"equals",value:"Show rate"}],action:[{visibility:"HideMultiple",fields:CONV_LADDERS}]},
  {type:"field",link:"Any",terms:[{field:"11",operator:"equals",value:"Quote follow-up / decision drop-off"}],action:[{visibility:"HideMultiple",fields:CONV_LADDERS}]},
  {type:"field",link:"Any",terms:[{field:"11",operator:"equals",value:"Stage clarity + follow-up consistency gap"}],action:[{visibility:"HideMultiple",fields:CONV_LADDERS}]},

  // 24-28: Retention sub-path — LADDER CARDS NOW ALWAYS HIDDEN
  {type:"field",link:"Any",terms:[{field:"13",operator:"equals",value:"Post-service follow-up gap"}],action:[{visibility:"HideMultiple",fields:RET_LADDERS}]},
  {type:"field",link:"Any",terms:[{field:"13",operator:"equals",value:"Review rhythm gap"}],action:[{visibility:"HideMultiple",fields:RET_LADDERS}]},
  {type:"field",link:"Any",terms:[{field:"13",operator:"equals",value:"Referral ask gap"}],action:[{visibility:"HideMultiple",fields:RET_LADDERS}]},
  {type:"field",link:"Any",terms:[{field:"13",operator:"equals",value:"Rebook/recall gap"}],action:[{visibility:"HideMultiple",fields:RET_LADDERS}]},
  {type:"field",link:"Any",terms:[{field:"13",operator:"equals",value:"Value review / renewal alignment gap"}],action:[{visibility:"HideMultiple",fields:RET_LADDERS}]},

  // ===== 14 PREDETERMINED CONDITIONS =====

  // Acquisition predetermined (field 12) + Field 2 show/hide
  {type:"field",link:"Any",
   terms:[{field:"12",operator:"equals",value:"Channel concentration risk"}],
   action:[{visibility:"ShowMultiple",fields:[...A1_FIELDS,'84']},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_ACQ_PRED, A1_FIELDS),'85','86']}]},
  {type:"field",link:"Any",
   terms:[{field:"12",operator:"equals",value:"Lead capture friction"}],
   action:[{visibility:"ShowMultiple",fields:[...A2_FIELDS,'85']},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_ACQ_PRED, A2_FIELDS),'84','86']}]},
  {type:"field",link:"Any",
   terms:[{field:"12",operator:"equals",value:"Demand capture / local visibility"}],
   action:[{visibility:"ShowMultiple",fields:[...A3_FIELDS,'86']},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_ACQ_PRED, A3_FIELDS),'84','85']}]},
  {type:"field",link:"Any",
   terms:[{field:"12",operator:"equals",value:"Lead tracking + ownership gap"}],
   action:[{visibility:"ShowMultiple",fields:A4_FIELDS},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_ACQ_PRED, A4_FIELDS),...ACQ_FIELD2]}]},

  // Conversion predetermined (field 11) + Field 2 show/hide
  {type:"field",link:"Any",
   terms:[{field:"11",operator:"equals",value:"Speed-to-lead"}],
   action:[{visibility:"ShowMultiple",fields:[...C1_FIELDS,'80']},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_CONV_PRED, C1_FIELDS),'81','82','83']}]},
  {type:"field",link:"Any",
   terms:[{field:"11",operator:"equals",value:"Booking friction"}],
   action:[{visibility:"ShowMultiple",fields:[...C2_FIELDS,'81']},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_CONV_PRED, C2_FIELDS),'80','82','83']}]},
  {type:"field",link:"Any",
   terms:[{field:"11",operator:"equals",value:"Show rate"}],
   action:[{visibility:"ShowMultiple",fields:[...C3_FIELDS,'82']},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_CONV_PRED, C3_FIELDS),'80','81','83']}]},
  {type:"field",link:"Any",
   terms:[{field:"11",operator:"equals",value:"Quote follow-up / decision drop-off"}],
   action:[{visibility:"ShowMultiple",fields:[...C4_FIELDS,'83']},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_CONV_PRED, C4_FIELDS),'80','81','82']}]},
  {type:"field",link:"Any",
   terms:[{field:"11",operator:"equals",value:"Stage clarity + follow-up consistency gap"}],
   action:[{visibility:"ShowMultiple",fields:C5_FIELDS},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_CONV_PRED, C5_FIELDS),...CONV_FIELD2]}]},

  // Retention predetermined (field 13) + Field 2 show/hide
  {type:"field",link:"Any",
   terms:[{field:"13",operator:"equals",value:"Rebook/recall gap"}],
   action:[{visibility:"ShowMultiple",fields:[...R1_FIELDS,'87']},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_RET_PRED, R1_FIELDS),'88','89']}]},
  {type:"field",link:"Any",
   terms:[{field:"13",operator:"equals",value:"Review rhythm gap"}],
   action:[{visibility:"ShowMultiple",fields:R2_FIELDS},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_RET_PRED, R2_FIELDS),...RET_FIELD2]}]},
  {type:"field",link:"Any",
   terms:[{field:"13",operator:"equals",value:"Referral ask gap"}],
   action:[{visibility:"ShowMultiple",fields:[...R3_FIELDS,'88']},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_RET_PRED, R3_FIELDS),'87','89']}]},
  {type:"field",link:"Any",
   terms:[{field:"13",operator:"equals",value:"Post-service follow-up gap"}],
   action:[{visibility:"ShowMultiple",fields:[...R4_FIELDS,'89']},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_RET_PRED, R4_FIELDS),'87','88']}]},
  {type:"field",link:"Any",
   terms:[{field:"13",operator:"equals",value:"Value review / renewal alignment gap"}],
   action:[{visibility:"ShowMultiple",fields:R5_FIELDS},{visibility:"HideMultiple",fields:[...excludeFrom(ALL_RET_PRED, R5_FIELDS),...RET_FIELD2]}]},
];

console.log(`Total conditions: ${conditions.length} (26 original + 14 predetermined = 40)`);

// Build form-encoded body
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
    if (j.responseCode === 200) {
      console.log('SUCCESS: All 42 conditions restored (ladder cards hidden).');
    } else {
      console.log('FAILED:', data.substring(0, 1000));
    }
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
