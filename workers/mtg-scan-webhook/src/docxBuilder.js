/**
 * MindtheGaps — One-Page Plan DOCX Builder
 *
 * Pure function that takes structured plan content (deterministic),
 * scan data, contact info, and confidence result, then generates a
 * professional One-Page Plan as a DOCX buffer.
 *
 * Uses the `docx` npm package. Zero external service calls.
 *
 * Spec reference: PROJECT_CONTEXT.md Section 5 (Plan Generation Rules)
 *
 * Public API:
 *   buildDocx(planContent, scanData, contactInfo, confidenceResult) → Promise<Buffer>
 *
 * Plan sections:
 *   A) What We Found — primary gap + sub-diagnosis + supporting signal
 *   B) Baseline Metrics — table of Tier-1 fields (non-"Not sure" only)
 *   C) One Lever — the fix + one-sentence + what done looks like
 *   D) Action Plan — 6 actions with owner + timeline
 *   E) Weekly Scorecard — 2-4 metrics with baseline + 30-day target
 *   F) Risks / Constraints — CONDITIONAL on confidence level
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  PageOrientation,
} = require('docx');

const { BASELINE_FIELDS } = require('../../shared/constants');

// ---------------------------------------------------------------------------
// Styling constants
// ---------------------------------------------------------------------------

const COLORS = Object.freeze({
  PRIMARY: '1B3A5C',     // dark blue
  HEADER_BG: 'E8E8E8',   // light gray for table headers
  BODY_TEXT: '333333',    // dark gray
  WHITE: 'FFFFFF',
  LIGHT_BLUE: 'E8F4F8',
});

const FONT = 'Calibri';
const BODY_SIZE = 22;     // 11pt (half-points)
const HEADER_SIZE = 28;   // 14pt
const TITLE_SIZE = 36;    // 18pt

// Human-readable labels for baseline field keys
// Labels must match JotForm picklist text exactly (form is source of truth).
// Verified against JotForm API on 2026-02-27 (QIDs 15-34).
const BASELINE_LABELS = Object.freeze({
  conv_inbound_leads: 'Inbound leads per month',
  conv_first_response_time: 'Typical first response time',
  conv_lead_to_booked: 'Lead to booked %',
  conv_booked_to_show: 'Booked to show %',
  conv_time_to_first_appointment: 'Time to first appointment',
  conv_quote_sent_timeline: 'Quote sent timeline',
  conv_quote_to_close: 'Quote to close %',
  acq_inbound_leads: 'Inbound leads per month',
  acq_top_source_dependence: 'Top lead source dependence',
  acq_pct_from_top_source: '% of leads from top source',
  acq_calls_answered_live: 'Calls answered live %',
  acq_website_capture_friction: 'Website lead capture friction',
  acq_reviews_per_month: 'Reviews per month',
  acq_referral_intros_per_month: 'Referral intros per month',
  ret_pct_revenue_repeat: '% revenue from repeat',
  ret_pct_revenue_referrals: '% revenue from referrals',
  ret_rebook_scheduling: 'Rebook/next-step scheduling',
  ret_reviews_per_month: 'Reviews per month',
  ret_follow_up_time: 'Time to follow-up after service',
  ret_check_in_rhythm: 'Customer check-in rhythm',
});

// ---------------------------------------------------------------------------
// Helper: create a styled text run
// ---------------------------------------------------------------------------

function text(content, opts = {}) {
  return new TextRun({
    text: content,
    font: FONT,
    size: opts.size || BODY_SIZE,
    bold: opts.bold || false,
    italics: opts.italics || false,
    color: opts.color || COLORS.BODY_TEXT,
  });
}

// ---------------------------------------------------------------------------
// Helper: create a section header paragraph
// ---------------------------------------------------------------------------

function sectionHeader(title) {
  return new Paragraph({
    spacing: { before: 360, after: 120 },
    children: [
      text(title, { size: HEADER_SIZE, bold: true, color: COLORS.PRIMARY }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Helper: create a table cell with standard styling
// ---------------------------------------------------------------------------

function cell(content, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shading ? { type: ShadingType.SOLID, color: opts.shading } : undefined,
    children: [
      new Paragraph({
        children: [
          text(content, {
            bold: opts.bold || false,
            color: opts.headerCell ? COLORS.PRIMARY : COLORS.BODY_TEXT,
          }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Helper: create a table row
// ---------------------------------------------------------------------------

function row(cells) {
  return new TableRow({ children: cells });
}

// ---------------------------------------------------------------------------
// Helper: create an insight callout paragraph (light blue background)
// ---------------------------------------------------------------------------

function insightCallout(insightText) {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { type: ShadingType.SOLID, color: COLORS.LIGHT_BLUE },
    children: [
      text(insightText, { italics: true }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Helper: get insights by placement
// ---------------------------------------------------------------------------

function getInsightsByPlacement(planContent, placement) {
  return (planContent.insights || []).filter((i) => i.placement === placement);
}

// ---------------------------------------------------------------------------
// Section A: What We Found
// ---------------------------------------------------------------------------

function buildSectionA(planContent) {
  const a = planContent.sectionA || {};
  const children = [
    sectionHeader('What We Found'),
  ];

  // Phase 5 (3.5): Manual plan flag — bold, prominent warning for Marc
  if (a.manualPlanFlag) {
    children.push(
      new Paragraph({
        spacing: { before: 60, after: 120 },
        shading: { type: ShadingType.SOLID, color: 'FFF3CD' }, // yellow highlight
        children: [
          text(a.manualPlanFlag, { bold: true, color: 'CC0000' }),
        ],
      }),
    );
  }

  // 3.1: Opener is first prominent line (oneLeverSentence verbatim)
  if (a.opener) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          text(a.opener, { bold: true, size: HEADER_SIZE }),
        ],
      }),
    );
  }

  // Phase 5 (3.4): Contradiction note — placed directly under the opener
  if (a.contradictionNote) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          text('Why this focus: ', { bold: true }),
          text(a.contradictionNote, { italics: true }),
        ],
      }),
    );
  }

  // 3.6: Phrasing bank — "Most likely leak" and "What changes"
  if (a.mostLikelyLeak) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          text('Most likely leak: ', { bold: true }),
          text(a.mostLikelyLeak),
        ],
      }),
    );
  }

  if (a.whatChanges) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          text('What changes if we fix it: ', { bold: true }),
          text(a.whatChanges),
        ],
      }),
    );
  }

  // Field 2: supporting data point from sub-path follow-up question
  if (a.field2Answer && a.field2Label) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          text('Sub-path confirmation: ', { bold: true }),
          text(`${a.field2Label}: ${a.field2Answer}`),
        ],
      }),
    );
  }

  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        text('Primary Growth Gap: ', { bold: true }),
        text(a.primaryGap || 'Unknown'),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        text('Root Cause: ', { bold: true }),
        text(a.subDiagnosis || 'Not identified'),
      ],
    }),
  );

  if (a.supportingSignal) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          text('Supporting Signal: ', { bold: true }),
          text(a.supportingSignal, { italics: true }),
        ],
      }),
    );
  }

  if (a.quizKeySignals) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          text(a.quizKeySignals, { italics: true }),
        ],
      }),
    );
  }

  // Personalization: signal-to-action insight
  for (const insight of getInsightsByPlacement(planContent, 'sectionA')) {
    children.push(insightCallout(insight.text));
  }

  return children;
}

// ---------------------------------------------------------------------------
// Section B: Baseline Metrics
// ---------------------------------------------------------------------------

function buildSectionB(planContent) {
  const b = planContent.sectionB || {};
  const metrics = (b.baselineMetrics || []).filter(
    (m) => m && m.field && m.value,
  );

  const children = [sectionHeader('Your Current Baseline')];

  if (metrics.length === 0) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [text('No baseline data available.', { italics: true })],
      }),
    );
    return children;
  }

  const headerRow = row([
    cell('Metric', { bold: true, shading: COLORS.HEADER_BG, headerCell: true, width: 50 }),
    cell('Current Value', { bold: true, shading: COLORS.HEADER_BG, headerCell: true, width: 50 }),
  ]);

  const dataRows = metrics.map((m) =>
    row([
      cell(m.field, { width: 50 }),
      cell(m.value, { width: 50 }),
    ]),
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    }),
  );

  return children;
}

// ---------------------------------------------------------------------------
// Section C: One Lever
// ---------------------------------------------------------------------------

function buildSectionC(planContent) {
  const c = planContent.sectionC || {};
  const leverName = c.leverName || 'Not selected';

  const children = [
    sectionHeader(`One Lever: ${leverName}`),
  ];

  if (c.leverDescription) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [text(c.leverDescription)],
      }),
    );
  }

  if (c.whatDoneLooksLike && c.whatDoneLooksLike.metric) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 120 },
        shading: { type: ShadingType.SOLID, color: COLORS.LIGHT_BLUE },
        children: [
          text('What done looks like: ', { bold: true }),
          text(`${c.whatDoneLooksLike.metric} → ${c.whatDoneLooksLike.target || 'TBD'}`),
        ],
      }),
    );
  }

  return children;
}

// ---------------------------------------------------------------------------
// Section D: Action Plan (6 actions)
// ---------------------------------------------------------------------------

function buildSectionD(planContent, scanData) {
  const d = planContent.sectionD || {};
  const actions = d.actions || [];

  const children = [sectionHeader('Action Plan')];

  // 3.2: Single-line format: "{action text} Owner: {role}. Due: Day {X}."
  const headerRow = row([
    cell('#', { bold: true, shading: COLORS.HEADER_BG, headerCell: true, width: 5 }),
    cell('Action', { bold: true, shading: COLORS.HEADER_BG, headerCell: true, width: 95 }),
  ]);

  const dataRows = [];
  for (let i = 0; i < 6; i++) {
    const action = actions[i] || {};
    let actionLine = action.description || '';
    if (action.owner) {
      actionLine += ` Owner: ${action.owner}.`;
    }
    if (action.dueDate) {
      actionLine += ` Due: ${action.dueDate}.`;
    }

    // Build action cell: action line + optional facilitator note
    const cellChildren = [
      new Paragraph({
        children: [text(actionLine.trim())],
      }),
    ];

    // Per-action facilitator note (only if non-empty)
    if (action.note) {
      cellChildren.push(
        new Paragraph({
          spacing: { before: 40 },
          children: [
            new TextRun({ text: 'Facilitator note: ', bold: true, size: 20, font: 'Calibri', italics: true }),
            new TextRun({ text: action.note, size: 20, font: 'Calibri', italics: true }),
          ],
        }),
      );
    }

    dataRows.push(
      row([
        cell(String(i + 1), { width: 5 }),
        new TableCell({
          width: { size: 95, type: WidthType.PERCENTAGE },
          children: cellChildren,
        }),
      ]),
    );
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    }),
  );

  return children;
}

// ---------------------------------------------------------------------------
// Section E: Weekly Scorecard
// ---------------------------------------------------------------------------

function buildSectionE(planContent) {
  const e = planContent.sectionE || {};
  const metrics = e.metrics || [];

  const children = [sectionHeader('Weekly Scorecard')];

  const headerRow = row([
    cell('Metric', { bold: true, shading: COLORS.HEADER_BG, headerCell: true, width: 40 }),
    cell('Baseline', { bold: true, shading: COLORS.HEADER_BG, headerCell: true, width: 30 }),
    cell('30-Day Target', { bold: true, shading: COLORS.HEADER_BG, headerCell: true, width: 30 }),
  ]);

  const dataRows = metrics.map((m) =>
    row([
      cell(m.name || '', { width: 40 }),
      cell(m.baseline || 'TBD', { width: 30 }),
      cell(m.target30Day || 'TBD', { width: 30 }),
    ]),
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    }),
  );

  // 3.3: Add data gap note for any metric with "Start tracking weekly." target
  const hasDataGapMetric = metrics.some(
    (m) => m.target30Day === 'Start tracking weekly.',
  );
  if (hasDataGapMetric) {
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        shading: { type: ShadingType.SOLID, color: COLORS.LIGHT_BLUE },
        children: [
          text('This is a data gap. Track for 2 weeks, then tighten targets.', { italics: true }),
        ],
      }),
    );
  }

  // Personalization: stability target insight
  for (const insight of getInsightsByPlacement(planContent, 'sectionE')) {
    children.push(insightCallout(insight.text));
  }

  return children;
}

// ---------------------------------------------------------------------------
// Section F: Risks / Constraints (conditional on confidence)
// ---------------------------------------------------------------------------

function buildSectionF(planContent, confidenceResult) {
  const f = planContent.sectionF || {};
  const constraints = f.constraints || [];
  const dataGaps = f.dataGaps || [];

  // High confidence + no constraints = skip section entirely
  if (!confidenceResult.includeConstraints && constraints.length === 0) {
    return [];
  }

  const children = [sectionHeader('Risks & Constraints')];

  if (constraints.length > 0) {
    constraints.slice(0, 3).forEach((constraint) => {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          bullet: { level: 0 },
          children: [text(constraint)],
        }),
      );
    });
  } else if (confidenceResult.includeConstraints) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [text('No constraints noted.', { italics: true })],
      }),
    );
  }

  // Personalization: risk callout insight
  for (const insight of getInsightsByPlacement(planContent, 'sectionF')) {
    children.push(insightCallout(insight.text));
  }

  // Data gaps box (Low confidence only)
  if (confidenceResult.includeDataGaps) {
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          text('Data Gaps to Measure', { bold: true, color: COLORS.PRIMARY }),
        ],
      }),
    );

    if (dataGaps.length > 0) {
      dataGaps.forEach((gap) => {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            bullet: { level: 0 },
            children: [text(gap)],
          }),
        );
      });
    } else {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [text('Track all baseline metrics weekly to fill data gaps.', { italics: true })],
        }),
      );
    }
  }

  return children;
}

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------

function createStyledDoc(sections, contactInfo) {
  const businessName = (contactInfo && contactInfo.businessName) || 'Your Business';
  const dateStr = new Date().toLocaleDateString('en-CA');

  // Build optional personalization details line
  const details = [];
  if (contactInfo && contactInfo.industry) details.push(contactInfo.industry);
  if (contactInfo && contactInfo.location) details.push(contactInfo.location);
  if (contactInfo && contactInfo.teamSize) details.push('Team: ' + contactInfo.teamSize);

  const hasDetails = details.length > 0;

  // Header paragraphs
  const headerParagraphs = [
    // Title
    new Paragraph({
      spacing: { after: 40 },
      alignment: AlignmentType.CENTER,
      children: [
        text('One-Page Growth Plan', { size: TITLE_SIZE, bold: true, color: COLORS.PRIMARY }),
      ],
    }),
    // Business name + date (tighter spacing if details follow)
    new Paragraph({
      spacing: { after: hasDetails ? 40 : 280 },
      alignment: AlignmentType.CENTER,
      children: [
        text(`${businessName} — ${dateStr}`, { italics: true }),
      ],
    }),
  ];

  // Add details line if any personalization fields exist
  if (hasDetails) {
    headerParagraphs.push(
      new Paragraph({
        spacing: { after: 280 },
        alignment: AlignmentType.CENTER,
        children: [
          text(details.join(' \u00B7 '), { italics: true, size: 20 }),
        ],
      }),
    );
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE, color: COLORS.BODY_TEXT },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            size: { orientation: PageOrientation.PORTRAIT },
          },
        },
        children: [
          ...headerParagraphs,
          // All sections flattened
          ...sections,
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a One-Page Plan DOCX from plan content and scan data.
 *
 * @param {object} planContent — structured plan content (from planGenerator)
 * @param {object} scanData — raw scan worksheet data
 * @param {object} contactInfo — { businessName, email, firstName, ... }
 * @param {object} confidenceResult — from calculateConfidence()
 * @returns {Promise<Buffer>} DOCX file as Buffer
 */
async function buildDocx(planContent, scanData, contactInfo, confidenceResult) {
  if (!planContent) {
    throw new Error('planContent is required');
  }
  if (!confidenceResult || !confidenceResult.level) {
    throw new Error('confidenceResult with a valid level is required');
  }

  const sections = [
    ...buildSectionA(planContent),
    ...buildSectionB(planContent),
    ...buildSectionC(planContent),
    ...buildSectionD(planContent, scanData),
    ...buildSectionE(planContent),
    ...buildSectionF(planContent, confidenceResult),
  ];

  const doc = createStyledDoc(sections, contactInfo);
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  buildDocx,
  BASELINE_LABELS,
  _internal: {
    buildSectionA,
    buildSectionB,
    buildSectionC,
    buildSectionD,
    buildSectionE,
    buildSectionF,
    createStyledDoc,
    text,
    sectionHeader,
    cell,
    row,
    COLORS,
  },
};
