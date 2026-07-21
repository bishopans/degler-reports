import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { equipmentChecklists } from '@/lib/equipmentChecklists';

// Vulcan Reports Chat — admin-side AI assistant that answers questions about
// submitted field reports. It gives Claude a search tool; each matching report
// is rendered as a labeled document (equipment sections, field labels, notes)
// so the model sees the full context of the form, not just typed answers.

export const maxDuration = 60;

const MODEL = 'claude-haiku-4-5-20251001';

const REPORT_TYPE_LABELS: Record<string, string> = {
  'maintenance': 'Preventative Maintenance',
  'repair': 'Repair',
  'material-delivery': 'Material Delivery',
  'material-turnover': 'Material Turnover',
  'training': 'Training',
  'jobsite-progress': 'Job Status',
  'accident': 'Accident/Incident',
  'photo-upload': 'Site Visit',
  'lcps-inspection': 'LCPS Building Inspection',
  'time-sheets': 'Time Sheet',
};

// form_data fields that are keyed by equipment type (maintenance / repair / LCPS forms)
const EQUIPMENT_KEYED_FIELDS: Record<string, string> = {
  equipmentChecks: 'Checklist',
  typeChecks: 'Checklist',
  initialProblems: 'Initial problem',
  repairSummaries: 'Repair summary',
  additionalRepairs: 'Additional repairs performed',
  partsNeeded: 'Parts needed',
  futurePartsNeeded: 'Future parts needed',
  equipmentSafe: 'Safe to operate',
  unsafeReasons: 'Reason not safe',
  typeProductInfo: 'Product info',
};

interface SubmissionRow {
  id: string;
  created_at: string;
  report_type: string;
  date: string;
  job_name: string | null;
  job_number: string | null;
  technician_name: string | null;
  status: string | null;
  claimed_by: string | null;
  notes: string | null;
  form_data: Record<string, unknown> | null;
  photo_urls: string[] | null;
}

// "futurePartsNeeded" -> "Future parts needed"
function labelize(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value
      .map(v => (typeof v === 'object' && v !== null ? renderValue(v) : String(v)))
      .filter(Boolean)
      .join('; ');
  }
  if (typeof value === 'object') {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === true) {
        parts.push(`[x] ${k}`);
      } else if (v === false || v === null || v === undefined || v === '') {
        continue;
      } else {
        const rv = renderValue(v);
        if (rv) parts.push(`${labelize(k)}: ${rv}`);
      }
    }
    return parts.join(' | ');
  }
  return '';
}

// Render one submission as a labeled text document. Equipment-keyed fields are
// grouped under their equipment heading so notes carry their context.
function renderReport(sub: SubmissionRow): string {
  const lines: string[] = [];
  lines.push(`Type: ${REPORT_TYPE_LABELS[sub.report_type] || sub.report_type}`);
  lines.push(`Job: ${sub.job_name || 'Unknown'}${sub.job_number ? ` (Job #${sub.job_number})` : ''}`);
  if (sub.technician_name) lines.push(`Technician: ${sub.technician_name}`);
  lines.push(`Report date: ${sub.date}${sub.created_at ? ` (submitted ${sub.created_at.slice(0, 10)})` : ''}`);
  if (sub.status) lines.push(`Status: ${sub.status}`);
  if (sub.claimed_by) lines.push(`Claimed by: ${sub.claimed_by}`);

  const fd = (sub.form_data || {}) as Record<string, unknown>;
  const usedKeys = new Set<string>(['selectedEquipment', 'inspectedEquipment']);

  const equipmentRaw = fd.selectedEquipment || fd.inspectedEquipment;
  const equipment: string[] = Array.isArray(equipmentRaw) ? equipmentRaw.map(String) : [];

  if (equipment.length > 0) {
    for (const equip of equipment) {
      lines.push(`\nEquipment: ${equip}`);
      for (const [key, label] of Object.entries(EQUIPMENT_KEYED_FIELDS)) {
        const record = fd[key];
        if (
          record && typeof record === 'object' && !Array.isArray(record) &&
          (record as Record<string, unknown>)[equip] !== undefined
        ) {
          const rendered = renderValue((record as Record<string, unknown>)[equip]);
          if (rendered) lines.push(`  ${label}: ${rendered}`);
        }
      }
    }
    // Don't re-render equipment-keyed fields generically below
    Object.keys(EQUIPMENT_KEYED_FIELDS).forEach(k => {
      if (fd[k] !== undefined) usedKeys.add(k);
    });
    lines.push('');
  }

  // Everything else in form_data, rendered generically with readable labels
  for (const [key, value] of Object.entries(fd)) {
    if (usedKeys.has(key)) continue;
    const rendered = renderValue(value);
    if (rendered) lines.push(`${labelize(key)}: ${rendered}`);
  }

  if (sub.notes) lines.push(`Notes: ${sub.notes}`);
  const photoCount = Array.isArray(sub.photo_urls) ? sub.photo_urls.length : 0;
  if (photoCount > 0) lines.push(`Photos attached: ${photoCount}`);
  lines.push(`Link: /admin/report/${sub.id}`);
  return lines.join('\n');
}

interface SearchInput {
  keywords?: string[];
  report_type?: string;
  equipment_type?: string;
  job?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

const MAX_ROWS_SCANNED = 500;

async function searchReports(input: SearchInput): Promise<string> {
  let query = supabase
    .from('submissions')
    .select('id, created_at, report_type, date, job_name, job_number, technician_name, status, claimed_by, notes, form_data, photo_urls')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS_SCANNED);

  if (input.report_type) query = query.eq('report_type', input.report_type);
  if (input.date_from) query = query.gte('date', input.date_from);
  if (input.date_to) query = query.lte('date', input.date_to);

  const { data, error } = await query;
  if (error) {
    console.error('[REPORT-CHAT] Search query error:', error);
    return `Search failed: ${error.message}`;
  }

  const rows = (data || []) as SubmissionRow[];
  let matches = rows.map(sub => ({ sub, text: renderReport(sub), score: 0 }));

  if (input.job) {
    const j = input.job.toLowerCase();
    matches = matches.filter(m =>
      (m.sub.job_name || '').toLowerCase().includes(j) ||
      (m.sub.job_number || '').toLowerCase().includes(j)
    );
  }

  if (input.equipment_type) {
    const e = input.equipment_type.toLowerCase();
    matches = matches.filter(m => m.text.toLowerCase().includes(e));
  }

  const keywords = (input.keywords || []).map(k => String(k).toLowerCase().trim()).filter(Boolean);
  if (keywords.length > 0) {
    matches = matches
      .map(m => {
        const t = m.text.toLowerCase();
        return { ...m, score: keywords.filter(k => t.includes(k)).length };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  if (matches.length === 0) {
    return `No reports matched${rows.length === MAX_ROWS_SCANNED ? ` (searched the ${MAX_ROWS_SCANNED} most recent reports)` : ''}. Try fewer or broader keywords — e.g. just "motor" instead of an exact phrase.`;
  }

  const limit = Math.min(Math.max(input.limit || 8, 1), 20);
  const top = matches.slice(0, limit);

  const summaryList = matches
    .slice(0, 100)
    .map(m => `- ${m.sub.date} | ${REPORT_TYPE_LABELS[m.sub.report_type] || m.sub.report_type} | ${m.sub.job_name || '?'}${m.sub.job_number ? ` (#${m.sub.job_number})` : ''} | ${m.sub.technician_name || '?'} | /admin/report/${m.sub.id}`)
    .join('\n');

  const out =
    `${matches.length} report(s) matched${rows.length === MAX_ROWS_SCANNED ? ` (searched the ${MAX_ROWS_SCANNED} most recent reports)` : ''}.\n\n` +
    `All matches:\n${summaryList}\n\n` +
    `=== FULL TEXT OF TOP ${top.length} MATCH(ES) ===\n\n` +
    top.map(m => m.text.slice(0, 3000)).join('\n\n---\n\n');

  return out.slice(0, 40000);
}

// --- view_photos tool: lets the model actually look at report photos ---

type ToolResultContent = string | Array<Record<string, unknown>>;

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)(\?.*)?$/i;
const MAX_PHOTO_REPORTS = 4;
const MAX_PHOTOS_TOTAL = 16;

interface ViewPhotosInput {
  report_ids?: string[];
}

async function viewPhotos(input: ViewPhotosInput): Promise<ToolResultContent> {
  const ids = (input.report_ids || []).map(String).slice(0, MAX_PHOTO_REPORTS);
  if (ids.length === 0) return 'No report_ids provided.';

  const { data, error } = await supabase
    .from('submissions')
    .select('id, report_type, date, job_name, job_number, technician_name, photo_urls, form_data')
    .in('id', ids);

  if (error) {
    console.error('[REPORT-CHAT] view_photos query error:', error);
    return `Photo lookup failed: ${error.message}`;
  }

  const blocks: Array<Record<string, unknown>> = [];
  let photoCount = 0;
  let skipped = 0;

  for (const sub of (data || []) as SubmissionRow[]) {
    const urls = Array.isArray(sub.photo_urls) ? sub.photo_urls : [];
    const captions = ((sub.form_data || {}) as Record<string, unknown>).photo_captions;
    const header = `Photos from ${REPORT_TYPE_LABELS[sub.report_type] || sub.report_type} — ${sub.job_name || '?'}${sub.job_number ? ` (#${sub.job_number})` : ''}, ${sub.date} (/admin/report/${sub.id}):`;

    if (urls.length === 0) {
      blocks.push({ type: 'text', text: `${header} no photos attached.` });
      continue;
    }
    blocks.push({ type: 'text', text: header });

    urls.forEach((url, i) => {
      if (photoCount >= MAX_PHOTOS_TOTAL) { skipped++; return; }
      if (!IMAGE_EXTENSIONS.test(url)) { skipped++; return; }
      const caption = captions && typeof captions === 'object'
        ? renderValue((captions as Record<string, unknown>)[String(i)] ?? (Array.isArray(captions) ? captions[i] : undefined))
        : '';
      blocks.push({ type: 'text', text: `Photo ${i + 1} of ${urls.length}${caption ? ` — tech caption: ${caption}` : ''}:` });
      blocks.push({ type: 'image', source: { type: 'url', url } });
      photoCount++;
    });
  }

  if (photoCount === 0 && blocks.length === 0) return 'None of those report ids were found.';
  if (skipped > 0) {
    blocks.push({ type: 'text', text: `(${skipped} photo(s) not shown — over the ${MAX_PHOTOS_TOTAL}-photo limit or an unsupported format. Call view_photos again with fewer reports to see the rest.)` });
  }
  return blocks;
}

const EQUIPMENT_TYPES = Object.keys(equipmentChecklists).join(', ');

const SYSTEM_PROMPT = `You are Vulcan, the AI assistant for Degler Whiting's admin report dashboard. Admins ask you questions about field reports submitted by technicians (maintenance visits, repairs, deliveries, inspections, accidents, etc.), and you answer by searching the report database with your search_reports tool.

Report types: maintenance (Preventative Maintenance), repair, material-delivery, material-turnover, training, jobsite-progress (Job Status), accident (Accident/Incident), photo-upload (Site Visit), lcps-inspection, time-sheets.
Equipment types used on maintenance/repair/inspection forms: ${EQUIPMENT_TYPES}.

Search tips:
- Keywords are OR-matched against the full rendered report text, which includes equipment section headings, field labels, checklist items, notes, job names, and technician names. Results are ranked by how many keywords hit.
- Use short, distinctive keywords and synonyms: for "batting cage motor swap" search keywords like ["batting cage", "motor", "winch"]. Prefer several short keywords over one long phrase.
- Use the equipment_type filter when the question is about a type of equipment ("Batting Cages", "Bleachers", "Scoreboard Equipment"...), since notes are organized under equipment headings.
- If a search returns nothing, retry with broader or different keywords before giving up. You may call tools up to 5 times total.
- For counting/aggregate questions, use the "All matches" list (it includes date, type, job, and tech for every match, not just the top full-text results).

Photos:
- The view_photos tool shows you the actual photos attached to specific reports (up to 4 reports / 16 photos per call). Use it when a question is about what something looked like, visible damage, colors, installed products, site conditions, etc.
- Always narrow down with search_reports FIRST (by equipment type, job, keywords, or date), then view photos of the most likely reports. There is no visual index across all photos, so for a broad question like "which site had black bleacher seats?" search for candidate reports (e.g. equipment_type "Bleachers"), view photos from the best candidates, and if you can't check them all, say which reports you examined so the admin knows the coverage.

Answering:
- Base answers ONLY on what the search returns. If reports don't contain the answer, say so plainly — never guess or invent job names, dates, or details.
- When you reference a specific report, ALWAYS format it as a markdown link — [Springfield High — 2026-03-12](/admin/report/REPORT_ID) — using the real id from the search results. Never paste a bare /admin/report/... path or raw URL as plain text; the link text should be the job name and date.
- Be concise and practical. Lead with the answer, then supporting details.
- Today's date is ${new Date().toISOString().slice(0, 10)}.`;

const SEARCH_TOOL = {
  name: 'search_reports',
  description: 'Search submitted field reports. Filters are ANDed together; keywords are OR-matched against the full text of each report (equipment headings, field labels, checklist items, notes, job and technician names) and results ranked by number of keyword hits. Returns a summary list of all matches plus the full rendered text of the top matches.',
  input_schema: {
    type: 'object',
    properties: {
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Words or short phrases to look for, e.g. ["batting cage", "motor", "winch"]. Case-insensitive substring match. Omit to list reports by the other filters alone.',
      },
      report_type: {
        type: 'string',
        enum: ['maintenance', 'repair', 'material-delivery', 'material-turnover', 'training', 'jobsite-progress', 'accident', 'photo-upload', 'lcps-inspection', 'time-sheets'],
        description: 'Only return reports of this type.',
      },
      equipment_type: {
        type: 'string',
        description: 'Only return reports mentioning this equipment type, e.g. "Batting Cages" or "Bleachers".',
      },
      job: {
        type: 'string',
        description: 'Only return reports whose job name or job number contains this text.',
      },
      date_from: { type: 'string', description: 'Earliest report date, YYYY-MM-DD.' },
      date_to: { type: 'string', description: 'Latest report date, YYYY-MM-DD.' },
      limit: { type: 'number', description: 'How many full report texts to return (default 8, max 20).' },
    },
    required: [],
  },
};

const VIEW_PHOTOS_TOOL = {
  name: 'view_photos',
  description: 'Look at the actual photos attached to specific reports. Returns the images so you can see them, with any technician captions. Use AFTER search_reports has identified candidate reports — max 4 report ids and 16 photos per call, so pick the most promising reports.',
  input_schema: {
    type: 'object',
    properties: {
      report_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Report ids (from search_reports results) whose photos to view. Max 4.',
      },
    },
    required: ['report_ids'],
  },
};

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

async function callClaude(
  apiKey: string,
  messages: Array<{ role: string; content: unknown }>
): Promise<{ ok: true; data: { content: ContentBlock[]; stop_reason: string; usage?: { input_tokens?: number; output_tokens?: number } } } | { ok: false; status: number }> {
  const body = JSON.stringify({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [SEARCH_TOOL, VIEW_PHOTOS_TOOL],
    messages,
  });
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  let response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body });

  // One quick retry on rate limit / overload, same as the manuals chat
  if (response.status === 429 || response.status === 529 || response.status === 503) {
    console.error(`[REPORT-CHAT] Claude API ${response.status}, retrying in 5s`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body });
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[REPORT-CHAT] Claude API error ${response.status}: ${errText.substring(0, 500)}`);
    return { ok: false, status: response.status };
  }
  return { ok: true, data: await response.json() };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Chat is not configured (missing API key).' }, { status: 500 });
    }

    const { messages } = await request.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided.' }, { status: 400 });
    }

    // Keep the last 12 turns to bound cost
    const apiMessages: Array<{ role: string; content: unknown }> = messages
      .slice(-12)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Agentic loop: let the model use tools up to 5 times before answering
    for (let step = 0; step < 6; step++) {
      const result = await callClaude(apiKey, apiMessages);
      if (!result.ok) {
        const isRateLimit = result.status === 429 || result.status === 529 || result.status === 503;
        return NextResponse.json(
          {
            error: isRateLimit
              ? 'Vulcan is busy with another request. Retrying automatically...'
              : `Failed to get a response (error ${result.status}). Please try again.`,
            retryAfter: isRateLimit ? 30 : 0,
          },
          { status: isRateLimit ? 429 : 502 }
        );
      }

      totalInputTokens += result.data.usage?.input_tokens || 0;
      totalOutputTokens += result.data.usage?.output_tokens || 0;

      const toolUses = result.data.content.filter(b => b.type === 'tool_use');
      if (result.data.stop_reason === 'tool_use' && toolUses.length > 0 && step < 5) {
        apiMessages.push({ role: 'assistant', content: result.data.content });
        const toolResults = [];
        for (const tu of toolUses) {
          console.log(`[REPORT-CHAT] ${tu.name}:`, JSON.stringify(tu.input).substring(0, 300));
          let output: ToolResultContent;
          if (tu.name === 'view_photos') {
            output = await viewPhotos((tu.input || {}) as ViewPhotosInput);
          } else {
            output = await searchReports((tu.input || {}) as SearchInput);
          }
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: output });
        }
        apiMessages.push({ role: 'user', content: toolResults });
        continue;
      }

      const text = result.data.content
        .filter(b => b.type === 'text' && b.text)
        .map(b => b.text)
        .join('\n')
        .trim();

      console.log(`[REPORT-CHAT] Done in ${step + 1} step(s): ${totalInputTokens} input / ${totalOutputTokens} output tokens`);
      return NextResponse.json({
        message: text || 'I could not generate a response. Please try rephrasing your question.',
      });
    }

    return NextResponse.json({ message: 'I ran too many searches without finding a clear answer. Try narrowing your question (a job name, date range, or equipment type helps).' });
  } catch (error) {
    console.error('[REPORT-CHAT] Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
