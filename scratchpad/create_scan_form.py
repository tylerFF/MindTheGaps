"""Create the MindtheGaps Scan Worksheet form in JotForm via API."""
import sys
sys.path.insert(0, r'c:\Users\vwill\Documents\Tyler Project\Project 1\MindTheGapsCodebase\jotform-mcp-server')
from jotform import JotformAPIClient

client = JotformAPIClient(apiKey='a215bd6c660dd268df26062518e54abe')

q = {}
order_num = 1

def add(qtype, text, name, required='Yes', options=None, **extra):
    global order_num
    entry = {'type': qtype, 'text': text, 'name': name, 'order': str(order_num), 'required': required}
    entry.update(extra)
    if options:
        entry['options'] = options
    q[str(order_num)] = entry
    order_num += 1

# ---- SECTION 1: Call Metadata + Quiz Recap ----
add('control_head', 'Section 1: Call Metadata & Quiz Recap', 'sec1Header', required='No',
    subHeader='Prefilled from quiz submission. Confirm details with client.')
add('control_email', 'Contact Email', 'contactEmail')
add('control_textbox', 'First Name', 'scanFirstName')
add('control_textbox', 'Business Name', 'scanBusinessName')
add('control_dropdown', 'Industry', 'scanIndustry',
    options='Home Services|Health & Wellness|Professional Services|Financial Services|Automotive|Real Estate|Legal|Dental / Medical|Trades / Contracting|Beauty / Personal Care|Insurance|Fitness / Recreation|Other')
add('control_phone', 'Phone', 'scanPhone', required='No')
add('control_dropdown', 'Primary Gap from Quiz', 'quizPrimaryGap',
    options='Acquisition|Conversion|Retention')

# ---- SECTION 2: Gap Confirmation + Sub-Path ----
add('control_head', 'Section 2: Gap Confirmation & Sub-Path', 'sec2Header', required='No',
    subHeader='Confirm or update the primary gap, then select the sub-path')
add('control_dropdown', 'Confirmed Primary Gap', 'primaryGap',
    options='Acquisition|Conversion|Retention')
add('control_textarea', 'Reason for Gap Change (if different from quiz)', 'gapChangeReason', required='No')

# Sub-paths per pillar (show/hide with conditional logic in JotForm UI)
add('control_dropdown', 'Sub-Path (Conversion)', 'subPathConversion', required='No',
    options='Speed-to-lead|Booking friction|Show rate|Quote follow-up / decision drop-off|Other (manual)')
add('control_dropdown', 'Sub-Path (Acquisition)', 'subPathAcquisition', required='No',
    options='Channel concentration risk|Demand capture / local visibility|Lead capture friction|Fit mismatch|Referral / partner flow is not intentional|Other (manual)')
add('control_dropdown', 'Sub-Path (Retention)', 'subPathRetention', required='No',
    options='Rebook/recall gap|Review rhythm gap|Referral ask gap|Post-service follow-up gap|Other (manual)')

# ---- SECTION 3: Tier-1 Baseline Metrics ----
add('control_head', 'Section 3: Tier-1 Baseline Metrics', 'sec3Header', required='No',
    subHeader='Fill in baseline fields for the confirmed primary gap. Need at least 5 non-Not sure answers.')

# Conversion baselines (7)
add('control_dropdown', '[Conv] Inbound leads per month', 'convInboundLeads', required='No',
    options='0-10|11-25|26-50|51-100|100+|Not sure')
add('control_dropdown', '[Conv] Typical first response time', 'convFirstResponseTime', required='No',
    options='<1 hour|Same day|1-2 days|3+ days|Not sure')
add('control_dropdown', '[Conv] Lead to booked %', 'convLeadToBooked', required='No',
    options='0-20%|21-40%|41-60%|61%+|Not sure')
add('control_dropdown', '[Conv] Booked to show %', 'convBookedToShow', required='No',
    options='0-40%|41-60%|61-80%|81%+|Not sure')
add('control_dropdown', '[Conv] Time to first appointment', 'convTimeToFirstAppt', required='No',
    options='Same day|1-3 days|4-7 days|8-14 days|15+ days|Not sure')
add('control_dropdown', '[Conv] Quote sent timeline', 'convQuoteSentTimeline', required='No',
    options='Same day|48 hours|3-5 days|7+ days|Not sure')
add('control_dropdown', '[Conv] Quote to close %', 'convQuoteToClose', required='No',
    options='0-10%|11-20%|21-30%|31-50%|51%+|Not sure')

# Acquisition baselines (7)
add('control_dropdown', '[Acq] Inbound leads per month', 'acqInboundLeads', required='No',
    options='0-10|11-25|26-50|51-100|100+|Not sure')
add('control_dropdown', '[Acq] Top lead source dependence', 'acqTopSourceDep', required='No',
    options='1 source|2 sources|3-4 sources|5+ sources|Not sure')
add('control_dropdown', '[Acq] % of leads from top source', 'acqPctFromTopSource', required='No',
    options='0-40%|41-60%|61-80%|81%+|Not sure')
add('control_dropdown', '[Acq] Calls answered live', 'acqCallsAnsweredLive', required='No',
    options='Always|Often|Sometimes|Rarely|Not sure|Not applicable')
add('control_dropdown', '[Acq] Website lead capture friction', 'acqWebsiteCaptureFriction', required='No',
    options='Low|Medium|High|Not sure')
add('control_dropdown', '[Acq] Reviews per month', 'acqReviewsPerMonth', required='No',
    options='0|1-2|3-5|6+|Not sure')
add('control_dropdown', '[Acq] Referral intros per month', 'acqReferralIntrosPerMonth', required='No',
    options='0|1-2|3-5|6+|Not sure')

# Retention baselines (6)
add('control_dropdown', '[Ret] % revenue from repeat', 'retPctRevenueRepeat', required='No',
    options='0-20%|21-40%|41-60%|61%+|Not sure')
add('control_dropdown', '[Ret] % revenue from referrals', 'retPctRevenueReferrals', required='No',
    options='0-10%|11-20%|21-30%|31%+|Not sure')
add('control_dropdown', '[Ret] Rebook/next-step scheduling', 'retRebookScheduling', required='No',
    options='Always scheduled|Often|Sometimes|Rarely|Not sure')
add('control_dropdown', '[Ret] Reviews per month', 'retReviewsPerMonth', required='No',
    options='0|1-2|3-5|6+|Not sure')
add('control_dropdown', '[Ret] Time to follow-up after service', 'retFollowUpTime', required='No',
    options='Same day|1-2 days|3-7 days|8+ days|Not sure')
add('control_dropdown', '[Ret] Customer check-in rhythm', 'retCheckInRhythm', required='No',
    options='Yes (scheduled)|Yes (ad hoc)|No|Not sure')

# ---- SECTION 4: One Lever ----
add('control_head', 'Section 4: One Lever to Fix First', 'sec4Header', required='No',
    subHeader='Choose the primary lever for the client plan')

add('control_dropdown', 'One Lever (Conversion)', 'oneLeverConversion', required='No',
    options='Response ownership + SLA + follow-up sequence|Booking standardization (one path) + confirmations/reminders|Show-rate lift package (what to expect + reminders + prep)|Quote turnaround + after-quote follow-up package|Other (manual)')
add('control_dropdown', 'One Lever (Acquisition)', 'oneLeverAcquisition', required='No',
    options='Add a secondary warm channel + weekly cadence|Fix lead capture path (one page, one CTA, one follow-up path)|Call handling + response ownership + SLA|Qualification gate (2-3 questions) to improve fit|Review generation rhythm (simple ask + timing)|Other (manual)')
add('control_dropdown', 'One Lever (Retention)', 'oneLeverRetention', required='No',
    options='Rebook/recall system (prompt + script + schedule)|Review + referral moment (timing + script + 2-step ask)|Post-service check-in (30-day touch + simple template)|Win-back for dormant clients (light touch sequence)|Other (manual)')

add('control_textarea', 'What we fix first (one sentence, max 160 chars)', 'oneLeverSentence')

# ---- SECTION 5: 6 Action Slots ----
add('control_head', 'Section 5: 6 Actions (Next 30 Days)', 'sec5Header', required='No',
    subHeader='All 6 action slots must be filled with description, owner, and due date')

for i in range(1, 7):
    add('control_textbox', f'Action {i} - Description', f'action{i}Desc')
    add('control_textbox', f'Action {i} - Owner', f'action{i}Owner')
    add('control_datetime', f'Action {i} - Due Date', f'action{i}Due')

# ---- SECTION 6: Weekly Scorecard Metrics ----
add('control_head', 'Section 6: Weekly Scorecard Metrics', 'sec6Header', required='No',
    subHeader='Select 2-4 metrics to track weekly progress')

add('control_checkbox', 'Scorecard Metrics (Conversion)', 'metricsConversion', required='No',
    options='Median response time|Lead to booked %|Show rate %|Quote sent within 48h %')
add('control_checkbox', 'Scorecard Metrics (Acquisition)', 'metricsAcquisition', required='No',
    options='Leads/week|% leads from top source|Calls answered live %|Median response time|Reviews/week|Referral intros/week')
add('control_checkbox', 'Scorecard Metrics (Retention)', 'metricsRetention', required='No',
    options='Rebook rate (or count)|Reviews/week|Referral intros/week|30-day follow-up completion %|Repeat revenue band')

# ---- SECTION 7: Constraints & Risks ----
add('control_head', 'Section 7: Constraints & Risks', 'sec7Header', required='No',
    subHeader='Optional for High confidence; at least 1 required for Med/Low')
add('control_textarea', 'Constraint 1', 'constraint1', required='No')
add('control_textarea', 'Constraint 2', 'constraint2', required='No')
add('control_textarea', 'Constraint 3', 'constraint3', required='No')

# Submit button
add('control_button', 'Submit Scan Worksheet', 'scanSubmit', required='No')

form_def = {
    'properties': {'title': 'MindtheGaps Scan Worksheet'},
    'questions': q
}

result = client.create_form(form_def)
print('Scan Worksheet Form Created!')
print('Form ID:', result.get('id'))
print('Form URL:', result.get('url'))
