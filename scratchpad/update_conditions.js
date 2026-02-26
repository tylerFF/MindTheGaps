const https = require('https');

const API_KEY = process.env.JOTFORM_API_KEY || 'a215bd6c660dd268df26062518e54abe';
const FORM_ID = '260435948553162';

// Ladder QIDs
const ACQ_LADDERS = ['69','70','71'];
const CONV_LADDERS = ['72','73','74','75'];
const RET_LADDERS = ['76','77','78'];

const conditions = [
  // 1. Gap = Retention: show Ret fields, hide Acq/Conv fields + their ladders
  {
    type: "field", link: "Any",
    terms: JSON.stringify([{field:"9",operator:"equals",value:"Retention"}]),
    action: JSON.stringify([
      {visibility:"ShowMultiple",fields:["38","62","13","29","30","31","32","33","34"]},
      {visibility:"HideMultiple",fields:["61","37","36","60","11","12","22","23","24","25","26","27","28","15","16","17","18","19","20","21",...CONV_LADDERS,...ACQ_LADDERS]}
    ])
  },
  // 2. Gap = Acquisition: show Acq fields, hide Conv/Ret fields + their ladders
  {
    type: "field", link: "Any",
    terms: JSON.stringify([{field:"9",operator:"equals",value:"Acquisition"}]),
    action: JSON.stringify([
      {visibility:"ShowMultiple",fields:["12","61","37","22","23","24","25","26","27","28"]},
      {visibility:"HideMultiple",fields:["11","13","36","38","60","62","15","16","17","18","19","20","21","29","30","31","32","33","34",...CONV_LADDERS,...RET_LADDERS]}
    ])
  },
  // 3. Gap = Conversion: show Conv fields, hide Acq/Ret fields + their ladders
  {
    type: "field", link: "Any",
    terms: JSON.stringify([{field:"9",operator:"equals",value:"Conversion"}]),
    action: JSON.stringify([
      {visibility:"ShowMultiple",fields:["11","36","60","15","16","17","18","19","20","21"]},
      {visibility:"HideMultiple",fields:["12","13","37","38","61","62","22","23","24","25","26","27","28","29","30","31","32","33","34",...ACQ_LADDERS,...RET_LADDERS]}
    ])
  },
  // 4-12: Existing gap-change reason conditions (unchanged)
  {type:"field",link:"All",terms:JSON.stringify([{field:"9",operator:"equals",value:"Acquisition"},{field:"7",operator:"equals",value:"Conversion"}]),action:JSON.stringify([{visibility:"Show",field:"10"}])},
  {type:"field",link:"All",terms:JSON.stringify([{field:"9",operator:"equals",value:"Acquisition"},{field:"7",operator:"equals",value:"Retention"}]),action:JSON.stringify([{visibility:"Show",field:"10"}])},
  {type:"field",link:"All",terms:JSON.stringify([{field:"9",operator:"equals",value:"Conversion"},{field:"7",operator:"equals",value:"Acquisition"}]),action:JSON.stringify([{visibility:"Show",field:"10"}])},
  {type:"field",link:"All",terms:JSON.stringify([{field:"9",operator:"equals",value:"Conversion"},{field:"7",operator:"equals",value:"Retention"}]),action:JSON.stringify([{visibility:"Show",field:"10"}])},
  {type:"field",link:"All",terms:JSON.stringify([{field:"9",operator:"equals",value:"Retention"},{field:"7",operator:"equals",value:"Acquisition"}]),action:JSON.stringify([{visibility:"Show",field:"10"}])},
  {type:"field",link:"All",terms:JSON.stringify([{field:"9",operator:"equals",value:"Retention"},{field:"7",operator:"equals",value:"Conversion"}]),action:JSON.stringify([{visibility:"Show",field:"10"}])},
  {type:"field",link:"All",terms:JSON.stringify([{field:"9",operator:"equals",value:"Acquisition"},{field:"7",operator:"equals",value:"Acquisition"}]),action:JSON.stringify([{visibility:"Hide",field:"10"}])},
  {type:"field",link:"All",terms:JSON.stringify([{field:"9",operator:"equals",value:"Conversion"},{field:"7",operator:"equals",value:"Conversion"}]),action:JSON.stringify([{visibility:"Hide",field:"10"}])},
  {type:"field",link:"All",terms:JSON.stringify([{field:"9",operator:"equals",value:"Retention"},{field:"7",operator:"equals",value:"Retention"}]),action:JSON.stringify([{visibility:"Hide",field:"10"}])},

  // === NEW: Sub-path ladder conditions ===

  // Acquisition sub-paths (field 12 -> ladders 69,70,71)
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"12",operator:"equals",value:"Demand capture / local visibility"}]),
   action:JSON.stringify([{visibility:"Show",field:"69"},{visibility:"HideMultiple",fields:["70","71"]}])},
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"12",operator:"equals",value:"Lead capture friction"}]),
   action:JSON.stringify([{visibility:"Show",field:"70"},{visibility:"HideMultiple",fields:["69","71"]}])},
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"12",operator:"equals",value:"Channel concentration risk"}]),
   action:JSON.stringify([{visibility:"Show",field:"71"},{visibility:"HideMultiple",fields:["69","70"]}])},
  // Acq sub-paths with no ladder
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"12",operator:"equals",value:"Fit mismatch"}]),
   action:JSON.stringify([{visibility:"HideMultiple",fields:["69","70","71"]}])},
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"12",operator:"equals",value:"Referral / partner flow is not intentional"}]),
   action:JSON.stringify([{visibility:"HideMultiple",fields:["69","70","71"]}])},
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"12",operator:"equals",value:"Other (manual)"}]),
   action:JSON.stringify([{visibility:"HideMultiple",fields:["69","70","71"]}])},

  // Conversion sub-paths (field 11 -> ladders 72,73,74,75)
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"11",operator:"equals",value:"Speed-to-lead"}]),
   action:JSON.stringify([{visibility:"Show",field:"72"},{visibility:"HideMultiple",fields:["73","74","75"]}])},
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"11",operator:"equals",value:"Booking friction"}]),
   action:JSON.stringify([{visibility:"Show",field:"73"},{visibility:"HideMultiple",fields:["72","74","75"]}])},
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"11",operator:"equals",value:"Show rate"}]),
   action:JSON.stringify([{visibility:"Show",field:"74"},{visibility:"HideMultiple",fields:["72","73","75"]}])},
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"11",operator:"equals",value:"Quote follow-up / decision drop-off"}]),
   action:JSON.stringify([{visibility:"Show",field:"75"},{visibility:"HideMultiple",fields:["72","73","74"]}])},
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"11",operator:"equals",value:"Other (manual)"}]),
   action:JSON.stringify([{visibility:"HideMultiple",fields:["72","73","74","75"]}])},

  // Retention sub-paths (field 13 -> ladders 76,77,78)
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"13",operator:"equals",value:"Post-service follow-up gap"}]),
   action:JSON.stringify([{visibility:"Show",field:"76"},{visibility:"HideMultiple",fields:["77","78"]}])},
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"13",operator:"equals",value:"Review rhythm gap"}]),
   action:JSON.stringify([{visibility:"Show",field:"77"},{visibility:"HideMultiple",fields:["76","78"]}])},
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"13",operator:"equals",value:"Referral ask gap"}]),
   action:JSON.stringify([{visibility:"Show",field:"77"},{visibility:"HideMultiple",fields:["76","78"]}])},
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"13",operator:"equals",value:"Rebook/recall gap"}]),
   action:JSON.stringify([{visibility:"Show",field:"78"},{visibility:"HideMultiple",fields:["76","77"]}])},
  {type:"field",link:"Any",
   terms:JSON.stringify([{field:"13",operator:"equals",value:"Other (manual)"}]),
   action:JSON.stringify([{visibility:"HideMultiple",fields:["76","77","78"]}])},
];

// Build POST body
const body = 'properties[conditions]=' + encodeURIComponent(JSON.stringify(conditions));

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
    console.log('Total conditions:', conditions.length);
    if (j.responseCode !== 200) console.log('Detail:', data.substring(0, 500));
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
