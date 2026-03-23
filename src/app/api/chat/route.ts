import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Claude API pricing (Haiku 3.5 — fast and cheap)
const INPUT_COST_PER_MILLION = 0.80;  // $0.80 per 1M input tokens
const OUTPUT_COST_PER_MILLION = 4.00; // $4.00 per 1M output tokens

const SYSTEM_PROMPT = `You are Vulcan, an AI assistant for the Degler Whiting product manual library. You are named after the Roman god of the forge — knowledgeable, reliable, and helpful.

Your role is to help users find the right product documents and answer technical questions using the actual content from the manufacturers' manuals, installation guides, and spec sheets.

MANUFACTURERS AND PRODUCTS YOU KNOW ABOUT:
- Daktronics: LED scoreboards, controllers, and display systems
- Fair-Play: LED scoreboards and scoring systems
- Nevco: Scoreboards and display systems
- Porter: Basketball goals (900 Series, ceiling-suspended backstops), volleyball systems (POWR-NET, POWR-RIB II, POWR-LINE, POWR-COURT, POWR-CARBON II, POWR-STEEL, POWR-FLEX), divider curtains (center-roll, wall-guided), control panels (POWR-TOUCH 2.5, POWR-TOUCH 4, POWR-TOUCH 6), electric winches, and gym equipment
- Gill: Track & field equipment, basketball, volleyball systems
- Interkal: Telescopic bleachers, fixed seating, and grandstands
- Hufcor: Folding partitions — 600 Series, Summit Vertical, GF Series, GU Series, GL Series, GT Series, Accordion
- Kwik-Wall: Folding partitions (documents coming soon)

DOCUMENT TYPES AVAILABLE:
- Spec Sheets: Product specifications, technical data sheets, brochures
- Manuals: Owner's manuals, installation guides
- Installation Guides: Step-by-step installation instructions
- Wiring Diagrams: Electrical wiring and connection diagrams (mainly Daktronics/Fair-Play/Nevco)

GUIDELINES:
- Be concise and helpful. Keep responses focused and practical.
- When PDF documents are attached to this conversation, READ THEM CAREFULLY and use the content to answer the user's question directly. Provide specific steps, settings, wiring info, or whatever technical detail the user needs.
- Walk users through the relevant sections of the manual. Don't just say "refer to the manual" — actually give them the information from the document.
- If the documents don't fully answer the question, share what you can and note what's missing.
- Be friendly but professional — you're helping construction and facilities professionals.
- Do NOT make up technical specifications. Only share info that's in the provided documents.`;

// Download PDF from Supabase Storage and extract text content
// Text extraction uses ~90% fewer tokens than raw PDF binary
async function fetchPdfText(storagePath: string): Promise<{ text: string; pages: number } | null> {
  try {
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/manuals/${encodeURIComponent(storagePath).replace(/%2F/g, '/')}`;
    console.log(`[PDF] Fetching: ${publicUrl}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(publicUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[PDF] HTTP error ${response.status}: ${response.statusText} for ${storagePath}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[PDF] Downloaded ${buffer.length} bytes from ${storagePath}`);

    if (buffer.length === 0) {
      console.error('[PDF] Downloaded file is empty!');
      return null;
    }

    // Extract text from PDF — dramatically reduces token usage
    const parsed = await pdfParse(buffer);
    const text = parsed.text || '';
    const pages = parsed.numpages || 0;
    console.log(`[PDF] Extracted ${text.length} chars of text from ${pages} pages`);

    if (text.trim().length < 100) {
      console.warn(`[PDF] Very little text extracted (${text.trim().length} chars) — may be a scanned/image PDF`);
    }

    // Cap text at ~30K chars (~8K tokens) to stay well within rate limits
    const cappedText = text.length > 30000 ? text.substring(0, 30000) + '\n\n[... document continues — text truncated for length ...]' : text;

    return { text: cappedText, pages };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[PDF] Download timed out after 20s: ${storagePath}`);
    } else {
      console.error('[PDF] Text extraction error:', storagePath, error);
    }
    return null;
  }
}

// Allow up to 60 seconds for PDF download + Claude API call
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Check if chatbot is enabled
    const { data: setting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'chatbot_enabled')
      .single();

    if (!setting || setting.value !== 'true') {
      return NextResponse.json(
        { error: 'The Vulcan assistant is currently offline. Please check back later.' },
        { status: 503 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI assistant is not configured. Please contact the administrator.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required.' }, { status: 400 });
    }

    // Limit conversation history to last 10 messages to control costs
    const recentMessages = messages.slice(-10);

    // Search for relevant manuals based on the FULL conversation context
    // This ensures follow-up questions still find the right product
    const latestQuestion = recentMessages[recentMessages.length - 1]?.content || '';
    const allUserMessages = recentMessages
      .filter((m: { role: string; content: string }) => m.role === 'user')
      .map((m: { role: string; content: string }) => m.content)
      .join(' ');

    // Extract product context from assistant's previous responses
    // If Vulcan already discussed a specific product, we should stay locked onto it
    const assistantMessages = recentMessages
      .filter((m: { role: string; content: string }) => m.role === 'assistant')
      .map((m: { role: string; content: string }) => m.content)
      .join(' ');

    // Look for product names Vulcan mentioned in its responses
    // These patterns help maintain context across follow-up questions
    const knownProductPatterns = [
      // Porter POWR-* products
      /POWR-TOUCH\s+[\d.]+/gi,
      /POWR-(?:NET|RIB|LINE|COURT|CARBON|STEEL|FLEX|SELECT)\s*(?:II|III|IV)?/gi,
      /POWR\s+(?:RIB|LINE|COURT|CARBON|SAND|HYBRID|VOLLEYBALL)\s*(?:II|III|IV)?[^,.]{0,30}/gi,
      // Fair-Play model numbers (MP-80, BA-7118, BB-1600, FB-8120, HK-1700, etc.)
      /(?:MP|BA|BB|FB|HK|CL|SC|SP|ST|TK|TN|VB|WR|QP|PC|PSO|PT|SG|CST|HS)-?\d[\w.-]*/gi,
      // Daktronics model numbers (All Sport 5000, ADPC-2023, etc.)
      /All\s+Sport\s*(?:\d+|CG|Lite|MX-\d+|Pro)/gi,
      /(?:ADPC|ADTI|AR|BA|BB|DA|DB|FB|GN|MS|SB|SO|SS|VS)-\d{3,}/gi,
      /Galaxy\s+(?:Pro|AF|Max)/gi,
      /Omni\s+Sport\s*\d*/gi,
      // Series patterns (500 Series, 600 Series, etc.)
      /\d+\s+SERIES[^,.]{0,40}/gi,
      // Hufcor series
      /(?:GF|GL|GT|GU)\s+Series/gi,
      /Summit\s+Vertical/gi,
      // Gill numeric models
      /(?:Gill|GILL)\s+\d{3,}/gi,
      // Nevco controllers and products
      /MPC[W]?-\d+/gi,
      // Generic manufacturer + product
      /(?:HUFCOR|NEVCO|DAKTRONICS|INTERKAL|GILL)\s+\w+/gi,
    ];
    const previousProductContext: string[] = [];
    for (const pattern of knownProductPatterns) {
      const matches = assistantMessages.match(pattern);
      if (matches) {
        matches.forEach(m => previousProductContext.push(m.toLowerCase()));
      }
    }
    // Deduplicate and take the most recent product mentions
    const uniqueProductContext = Array.from(new Set(previousProductContext)).slice(0, 3);
    if (uniqueProductContext.length > 0) {
      console.log(`[VULCAN] Product context from previous responses: [${uniqueProductContext.join(', ')}]`);
    }

    let contextInfo = '';
    let pdfExtractedText = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfContentBlocks: any[] = []; // kept for backward compat but no longer used

    if (latestQuestion) {
      // Smart keyword search with alias expansion
      // Use ALL user messages for search terms (keeps context across follow-ups)
      const rawTerms = allUserMessages
        .toLowerCase()
        .replace(/[^\w\s.-]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 1);

      // Also extract terms from JUST the latest message — used for relevance scoring
      // (prevents conversation history from polluting which PDF is selected)
      const latestRawTerms = latestQuestion
        .toLowerCase()
        .replace(/[^\w\s.-]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 1);

      // Expand common aliases — users type these but the database has different names
      const aliasMap: Record<string, string[]> = {
        'powertouch': ['powr-touch', 'powrtouch'],
        'powrtouch': ['powr-touch', 'powertouch'],
        'powr-touch': ['powertouch', 'powrtouch'],
        'powerflex': ['powr-flex', 'powrflex'],
        'powrflex': ['powr-flex', 'powerflex'],
        'powernet': ['powr-net', 'powrnet'],
        'powrnet': ['powr-net', 'powernet'],
        'powermax': ['powermax'],
        'powerselect': ['powr-select', 'powrselect'],
        'powrselect': ['powr-select', 'powerselect'],
        'powrcarbon': ['powr-carbon', 'powrcarbon', 'powercarbon'],
        'powercarbon': ['powr-carbon', 'powrcarbon'],
        'powrsteel': ['powr-steel', 'powrsteel', 'powersteel'],
        'powersteel': ['powr-steel', 'powrsteel'],
        'powrrib': ['powr-rib', 'powerrib'],
        'powerrib': ['powr-rib', 'powrrib'],
        'powrline': ['powr-line', 'powerline'],
        'powerline': ['powr-line', 'powrline'],
        'powrcourt': ['powr-court', 'powercourt'],
        'powercourt': ['powr-court', 'powrcourt'],
        'kwikwall': ['kwik-wall'],
        'kwik-wall': ['kwikwall'],
        'fairplay': ['fair-play'],
        'fair-play': ['fairplay'],
        'allsport': ['all-sport'],
        'all-sport': ['allsport'],
        'omnisport': ['omni-sport'],
        'omni-sport': ['omnisport'],
        'galaxypro': ['galaxy-pro'],
        // Nevco controller aliases
        'mpcw': ['mpcw'],
      };

      // Build expanded search terms
      const expandedTerms = new Set<string>();
      rawTerms.forEach((term: string) => {
        expandedTerms.add(term);
        if (aliasMap[term]) {
          aliasMap[term].forEach((alias: string) => expandedTerms.add(alias));
        }
      });

      // Inject product context from assistant's previous responses
      // This ensures follow-ups stay locked onto the established product
      uniqueProductContext.forEach((ctx: string) => {
        ctx.split(/\s+/).forEach((word: string) => {
          if (word.length > 1) expandedTerms.add(word);
        });
      });

      // Handle compound tokens like "powrtouch2.5" or "mp80" — split on letter/digit boundary
      // Also generates hyphenated version (e.g., "mp80" → "mp-80") for database matching
      // IMPORTANT: Do this BEFORE compound pair combining so product terms get priority in the Set
      rawTerms.forEach((term: string) => {
        const splitMatch = term.match(/^([a-z-]+)([\d].*)$/);
        if (splitMatch) {
          const [, wordPart, numberPart] = splitMatch;
          expandedTerms.add(wordPart);
          expandedTerms.add(numberPart);
          expandedTerms.add(`${wordPart}-${numberPart}`); // "mp80" → "mp-80"
          if (aliasMap[wordPart]) {
            aliasMap[wordPart].forEach((alias: string) => expandedTerms.add(alias));
          }
        }
      });

      // Also try combining consecutive raw terms for compound product names
      // Only add if at least one part is NOT a stop word (avoids junk like "help-me", "change-the")
      for (let i = 0; i < rawTerms.length - 1; i++) {
        const combined = rawTerms[i] + rawTerms[i + 1];
        if (aliasMap[combined]) {
          aliasMap[combined].forEach((alias: string) => expandedTerms.add(alias));
        }
        // Skip compound pairs where both parts are common words (they'd match nothing useful)
        const bothPartsGeneric = rawTerms[i].length <= 3 && rawTerms[i + 1].length <= 3;
        if (!bothPartsGeneric) {
          expandedTerms.add(`${rawTerms[i]}-${rawTerms[i + 1]}`);
        }
      }

      // Build expanded terms from LATEST message only (for relevance scoring)
      const latestExpandedTerms = new Set<string>();
      latestRawTerms.forEach((term: string) => {
        latestExpandedTerms.add(term);
        if (aliasMap[term]) {
          aliasMap[term].forEach((alias: string) => latestExpandedTerms.add(alias));
        }
      });
      // Token splitting first (product terms get priority)
      latestRawTerms.forEach((term: string) => {
        const splitMatch = term.match(/^([a-z-]+)([\d].*)$/);
        if (splitMatch) {
          const [, wordPart, numberPart] = splitMatch;
          latestExpandedTerms.add(wordPart);
          latestExpandedTerms.add(numberPart);
          latestExpandedTerms.add(`${wordPart}-${numberPart}`);
          if (aliasMap[wordPart]) {
            aliasMap[wordPart].forEach((alias: string) => latestExpandedTerms.add(alias));
          }
        }
      });
      // Then compound pairs (with junk filtering)
      for (let i = 0; i < latestRawTerms.length - 1; i++) {
        const combined = latestRawTerms[i] + latestRawTerms[i + 1];
        if (aliasMap[combined]) {
          aliasMap[combined].forEach((alias: string) => latestExpandedTerms.add(alias));
        }
        const bothPartsGeneric = latestRawTerms[i].length <= 3 && latestRawTerms[i + 1].length <= 3;
        if (!bothPartsGeneric) {
          latestExpandedTerms.add(`${latestRawTerms[i]}-${latestRawTerms[i + 1]}`);
        }
      }

      // Pick the most meaningful search terms (skip generic words)
      const stopWords = new Set(['help', 'with', 'the', 'how', 'can', 'you', 'about', 'what', 'does', 'for', 'and', 'programming', 'program', 'install', 'installation', 'guide', 'manual', 'spec', 'specs', 'sheet', 'wiring', 'diagram', 'troubleshoot', 'troubleshooting', 'need', 'want', 'please', 'tell', 'show', 'me', 'find', 'get', 'look', 'up', 'do', 'is', 'it', 'of', 'to', 'in', 'on', 'at', 'by', 'or', 'an', 'be', 'if', 'so', 'no', 'not', 'but', 'all', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'each', 'every', 'any', 'some', 'this', 'that', 'these', 'those', 'its', 'my', 'your', 'our', 'their', 'im', 'ive', 'know', 'knowing', 'okay', 'ok', 'different', 'topic', 'change', 'switch', 'question', 'scoreboard', 'scoreboards', 'controller', 'panel', 'set', 'setting', 'number', 'group', 'board', 'type', 'model', 'system', 'display', 'timer', 'clock', 'light', 'operate', 'operating', 'use', 'using', 'make', 'made', 'turn', 'give', 'work', 'working', 'run', 'running', 'both', 'two', 'one', 'same', 'time', 'way', 'new', 'old', 'first', 'second', 'also', 'just', 'like', 'from', 'when', 'where', 'which', 'who', 'why', 'then', 'than', 'them', 'only', 'other', 'into', 'over', 'after', 'before', 'between', 'under', 'through', 'during', 'while', 'out', 'off', 'down', 'back', 'here', 'there', 'much', 'many', 'more', 'most', 'very', 'too', 'still', 'already', 'again', 'even', 'never', 'always', 'often', 'sometimes', 'keep', 'going', 'come', 'take', 'put', 'let', 'try', 'thing', 'things', 'able', 'sure', 'right', 'left', 'side', 'top', 'bottom', 'wall', 'floor', 'gym', 'field', 'court', 'sport', 'game', 'play', 'team', 'home', 'away', 'visitor', 'score', 'point', 'reset', 'start', 'stop', 'replace', 'fix', 'replace', 'repair', 'connect', 'disconnect', 'power', 'wire', 'cable', 'plug', 'main', 'split', 'separately']);
      const searchTerms = Array.from(expandedTerms)
        .filter((t: string) => t.length > 1 && !stopWords.has(t))
        .slice(0, 15);

      // Separate scoring terms from LATEST message only
      const latestScoringTerms = Array.from(latestExpandedTerms)
        .filter((t: string) => t.length > 1 && !stopWords.has(t))
        .slice(0, 15);

      console.log(`[VULCAN] Search terms: [${searchTerms.join(', ')}] from conversation`);
      console.log(`[VULCAN] Scoring terms: [${latestScoringTerms.join(', ')}] from latest message`);

      if (searchTerms.length > 0) {
        // Separate manufacturer terms from product terms
        const knownManufacturers = ['porter', 'daktronics', 'fair-play', 'fairplay', 'nevco', 'gill', 'interkal', 'hufcor', 'kwik-wall', 'kwikwall'];
        const productTerms = searchTerms.filter((t: string) => !knownManufacturers.includes(t));
        const manufacturerTerms = searchTerms.filter((t: string) => knownManufacturers.includes(t));

        // Map user-typed manufacturer names to their canonical database form
        // e.g., "fairplay" → "Fair-Play", "kwikwall" → "Kwik-Wall"
        const canonicalManufacturer: Record<string, string> = {
          'porter': 'Porter',
          'daktronics': 'Daktronics',
          'fair-play': 'Fair-Play',
          'fairplay': 'Fair-Play',
          'nevco': 'Nevco',
          'gill': 'Gill',
          'interkal': 'Interkal',
          'hufcor': 'Hufcor',
          'kwik-wall': 'Kwik-Wall',
          'kwikwall': 'Kwik-Wall',
        };

        // ONLY apply manufacturer filter if the LATEST message explicitly mentions one
        // If the user says "help me with the mp80" without naming Fair-Play, we should
        // search ALL manufacturers and let relevance scoring find the right match.
        // Using conversation history manufacturer would block topic switches (e.g.,
        // Porter conversation → asking about Fair-Play MP-80 without saying "fairplay")
        const latestManufacturerTerms = latestScoringTerms.filter((t: string) => knownManufacturers.includes(t));
        const rawPreferred = latestManufacturerTerms.length > 0
          ? latestManufacturerTerms[0]
          : null;  // Don't fall back to conversation history — it blocks topic switches
        // Use canonical form for the ILIKE query (e.g., "fairplay" → "Fair-Play")
        const preferredManufacturer = rawPreferred ? (canonicalManufacturer[rawPreferred] || rawPreferred) : null;
        console.log(`[VULCAN] Manufacturer filter: ${preferredManufacturer || 'NONE (no mfr in latest msg)'} (raw: ${rawPreferred}, latest: [${latestManufacturerTerms.join(', ')}])`);

        let manuals: { manufacturer: string; product_model: string; manual_type: string; filename: string; storage_path: string; file_size_bytes: number }[] | null = null;

        // Strategy 1: If we have product-specific terms, search product_model first
        // Filter out terms with spaces — they break PostgREST .or() query parsing
        const safeProductTerms = productTerms.filter((t: string) => !t.includes(' '));
        if (safeProductTerms.length > 0) {
          const productOrClauses = safeProductTerms
            .map((term: string) => `product_model.ilike.%${term}%`)
            .join(',');

          let query = supabase
            .from('product_manuals')
            .select('manufacturer, product_model, manual_type, filename, storage_path, file_size_bytes')
            .or(productOrClauses)
            .neq('manual_type', 'Placeholder');

          // If a manufacturer was mentioned, AND-filter to that manufacturer
          // Uses preferredManufacturer which prioritizes the LATEST message's manufacturer
          if (preferredManufacturer) {
            query = query.ilike('manufacturer', `%${preferredManufacturer}%`);
          }

          const { data, error: searchError } = await query.limit(50);
          if (searchError) {
            console.error(`[VULCAN] Search error:`, searchError.message);
          }
          manuals = data;
        }

        // Strategy 2: If no product terms or no results, broaden search
        // Still apply manufacturer filter if we know one, to avoid random results
        if (!manuals || manuals.length === 0) {
          console.log(`[VULCAN] Strategy 1 returned 0 results, trying Strategy 2`);
          // Filter out terms with spaces — they break PostgREST .or() query parsing
          const safeSearchTerms = searchTerms.filter((t: string) => !t.includes(' '));
          const allOrClauses = safeSearchTerms
            .flatMap((term: string) => [
              `product_model.ilike.%${term}%`,
              `manufacturer.ilike.%${term}%`,
            ])
            .join(',');

          let fallbackQuery = supabase
            .from('product_manuals')
            .select('manufacturer, product_model, manual_type, filename, storage_path, file_size_bytes')
            .or(allOrClauses)
            .neq('manual_type', 'Placeholder');

          // Apply manufacturer filter in fallback too, so we don't get random products
          if (preferredManufacturer) {
            fallbackQuery = fallbackQuery.ilike('manufacturer', `%${preferredManufacturer}%`);
          }

          const { data } = await fallbackQuery.limit(50);
          manuals = data;
        }

        console.log(`[VULCAN] Found ${manuals?.length || 0} manuals`);
        if (manuals && manuals.length > 0) {
          console.log(`[VULCAN] Top results: ${manuals.slice(0, 5).map(m => `${m.manufacturer}/${m.product_model}/${m.manual_type}`).join(' | ')}`);
          // Decode HTML entities that appear in some DB product names (e.g., &#x27; → ', &amp; → &)
          const decodeHtml = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

          // Build the document list (show top 15 in context, not all 50)
          const docList = manuals.slice(0, 15)
            .map(
              (m) =>
                `- ${m.manufacturer} / ${decodeHtml(m.product_model)} / ${m.manual_type}: ${m.filename.replace(/_/g, ' ').replace('.pdf', '')}`
            )
            .join('\n');

          // Fetch the most relevant PDF and send it directly to Claude as a document
          // Claude can read PDFs natively — even scanned/image-based ones
          // Score each manual by: (1) how many search terms match its product_model, (2) manual type priority
          const typeOrder: Record<string, number> = {
            'Installation Guide': 1,
            'installation_guide': 1,
            'user_manual': 1,
            'Manual': 2,
            'Maintenance Manual': 2,
            'Quick Guide': 2,
            'Spec Sheet': 3,
            'spec_sheet': 3,
            'Wiring Diagram': 4,
            'install_drawing': 4,
            'faceview_drawing': 5,
            'color_chart': 6,
            'Safety Data Sheet': 7,
            'Form': 7,
            'other': 6,
            'Other': 6,
          };

          // Score relevance: try LATEST message terms first, fall back to full history
          // This prevents history pollution (POWR-TOUCH 4 vs 2.5) while still
          // supporting follow-up questions that don't repeat the product name
          const scoreWithTerms = (productModel: string, terms: string[]): number => {
            const modelLower = productModel.toLowerCase();
            return terms.reduce((score, term) => {
              return score + (modelLower.includes(term.toLowerCase()) ? 1 : 0);
            }, 0);
          };

          // Check if latest message terms can differentiate products
          // If max score from latest terms is 0, the follow-up doesn't mention a product
          // — fall back to full history to maintain context
          const maxLatestScore = latestScoringTerms.length > 0
            ? Math.max(...manuals.map(m => scoreWithTerms(m.product_model, latestScoringTerms)))
            : 0;
          const useLatestForScoring = maxLatestScore > 0;
          const scoringTerms = useLatestForScoring ? latestScoringTerms : searchTerms;
          console.log(`[VULCAN] Scoring with ${useLatestForScoring ? 'LATEST' : 'FULL HISTORY'} terms (maxLatestScore=${maxLatestScore}): [${scoringTerms.join(', ')}]`);

          const scoreRelevance = (productModel: string): number => {
            return scoreWithTerms(productModel, scoringTerms);
          };

          // Types where larger files = more complete content (prefer bigger)
          const preferLargerTypes = new Set(['Installation Guide', 'installation_guide', 'user_manual', 'Manual', 'Maintenance Manual']);

          const sortedManuals = [...manuals]
            .filter((m) => m.storage_path && m.file_size_bytes < 5_000_000)
            .sort((a, b) => {
              // Primary sort: relevance score (higher = better, so b - a)
              const relevanceDiff = scoreRelevance(b.product_model) - scoreRelevance(a.product_model);
              if (relevanceDiff !== 0) return relevanceDiff;
              // Secondary sort: manual type priority (lower = better)
              const typeDiff = (typeOrder[a.manual_type] || 5) - (typeOrder[b.manual_type] || 5);
              if (typeDiff !== 0) return typeDiff;
              // Tertiary sort: for manuals/guides prefer LARGER files (more complete);
              // for drawings/spec sheets prefer smaller (faster download)
              if (preferLargerTypes.has(a.manual_type) || preferLargerTypes.has(b.manual_type)) {
                return b.file_size_bytes - a.file_size_bytes; // larger first
              }
              return a.file_size_bytes - b.file_size_bytes; // smaller first
            });

          // Fetch the top 1 PDF (keep it to 1 for speed and cost — each page ~1500 tokens)
          console.log(`[VULCAN] Sorted manuals for PDF fetch: ${sortedManuals.length} candidates — top 3: ${sortedManuals.slice(0, 3).map(m => `${m.product_model}(score:${scoreRelevance(m.product_model)},type:${m.manual_type})`).join(' | ')}`);
          const pdfToFetch = sortedManuals[0];

          if (pdfToFetch) {
            // Always extract PDF text on every request — text extraction is lightweight (~3K tokens)
            // so no need to skip on follow-ups. This ensures Claude always has the manual content.
            console.log(`[VULCAN] Selected PDF: ${pdfToFetch.manufacturer}/${pdfToFetch.product_model} - ${pdfToFetch.manual_type} (${pdfToFetch.filename}, ${pdfToFetch.file_size_bytes} bytes, path: ${pdfToFetch.storage_path})`);
            const pdfResult = await fetchPdfText(pdfToFetch.storage_path);
            if (pdfResult && pdfResult.text.trim().length > 100) {
              console.log(`[VULCAN] Text extracted: ${pdfResult.text.length} chars from ${pdfResult.pages} pages — adding to context`);
              pdfExtractedText = `\n\n--- DOCUMENT CONTENT: ${pdfToFetch.manufacturer} / ${pdfToFetch.product_model} / ${pdfToFetch.manual_type} (${pdfToFetch.filename}, ${pdfResult.pages} pages) ---\n\n${pdfResult.text}`;
            } else if (pdfResult) {
              console.warn(`[VULCAN] PDF text too short (${pdfResult.text.trim().length} chars) — likely scanned/image PDF. Content may be limited.`);
              pdfExtractedText = `\n\n--- DOCUMENT: ${pdfToFetch.manufacturer} / ${pdfToFetch.product_model} / ${pdfToFetch.manual_type} ---\nNote: This appears to be a scanned/image-based PDF. Only limited text could be extracted:\n${pdfResult.text}`;
            } else {
              console.error(`[VULCAN] PDF download/extraction returned null for ${pdfToFetch.storage_path}`);
            }
          } else {
            console.log('[VULCAN] No PDF candidates after filtering (size < 5MB, has storage_path)');
          }

          // Build the context info for the system prompt
          contextInfo = `\n\nDOCUMENTS FOUND IN THE LIBRARY:\n${docList}`;

          if (pdfExtractedText) {
            contextInfo += `\n\nThe following document content was extracted from the manual. READ IT CAREFULLY and use it to answer the user's question with specific details, steps, and technical information.${pdfExtractedText}`;
          } else {
            contextInfo += `\n\nNote: PDF content could not be loaded at this time. Let the user know what documents are available and suggest they download the relevant ones from the manual library.`;
          }
        }
      }
    }

    // Build the messages array for Claude API — all content is now text-based
    const apiMessages = recentMessages.map((msg: { role: string; content: string }) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Log what we're sending to Claude
    const systemPromptFull = SYSTEM_PROMPT + contextInfo;
    console.log(`[VULCAN] API call: ${apiMessages.length} messages, system prompt: ${systemPromptFull.length} chars, extracted text: ${pdfExtractedText.length > 0 ? pdfExtractedText.length + ' chars' : 'none'}`);

    // Call Claude API (Haiku 4.5 for speed and cost efficiency)
    // No PDF beta header needed — we send extracted text, not raw PDF binary
    const claudeHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };

    const claudeBody = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPromptFull,
      messages: apiMessages,
    };

    console.log(`[VULCAN] Sending to Claude: text-only (extracted PDF content in system prompt), messages: ${apiMessages.length}`);

    // Retry logic: one quick retry for rate limits, then let frontend handle longer waits
    let response: Response | null = null;
    let lastErrorText = '';
    let lastStatus = 0;

    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: claudeHeaders,
      body: JSON.stringify(claudeBody),
    });

    // If rate-limited, try ONE more time after 5s (within our 60s budget)
    if (response.status === 429 || response.status === 529 || response.status === 503) {
      lastStatus = response.status;
      const retryAfterHeader = response.headers.get('retry-after');
      lastErrorText = await response.text();
      console.error(`[VULCAN] Claude API ${lastStatus} (attempt 1): retry-after=${retryAfterHeader}, body=${lastErrorText.substring(0, 300)}`);

      // Quick retry: wait 5s then try once more
      await new Promise(resolve => setTimeout(resolve, 5000));
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: claudeHeaders,
        body: JSON.stringify(claudeBody),
      });

      if (!response.ok) {
        lastStatus = response.status;
        lastErrorText = await response.text();
        console.error(`[VULCAN] Claude API ${lastStatus} (attempt 2): ${lastErrorText.substring(0, 300)}`);
      }
    } else if (!response.ok) {
      lastStatus = response.status;
      lastErrorText = await response.text();
      console.error(`[VULCAN] Claude API error ${lastStatus}: ${lastErrorText.substring(0, 500)}`);
    }

    if (!response.ok) {
      const isRateLimitOrOverload = lastStatus === 429 || lastStatus === 529 || lastStatus === 503;
      const isTimeout = lastStatus === 408 || lastStatus === 504;
      // Tell frontend to auto-retry after 30s for rate limits
      return NextResponse.json(
        {
          error: isRateLimitOrOverload
            ? 'Vulcan is processing your previous request. Retrying automatically...'
            : isTimeout
            ? 'Vulcan took too long to respond. Please try again.'
            : `Failed to get a response from Vulcan (error ${lastStatus}). Please try again.`,
          retryAfter: isRateLimitOrOverload ? 30 : 0,
        },
        { status: isRateLimitOrOverload ? 429 : 502 }
      );
    }

    // Log rate limit headers so we can monitor usage (Anthropic header names)
    const tokensLimit = response.headers.get('anthropic-ratelimit-tokens-limit');
    const tokensRemaining = response.headers.get('anthropic-ratelimit-tokens-remaining');
    const tokensReset = response.headers.get('anthropic-ratelimit-tokens-reset');
    const reqLimit = response.headers.get('anthropic-ratelimit-requests-limit');
    const reqRemaining = response.headers.get('anthropic-ratelimit-requests-remaining');
    console.log(`[VULCAN] Rate limits: tokens ${tokensRemaining}/${tokensLimit} (resets ${tokensReset}), requests ${reqRemaining}/${reqLimit}`);

    const data = await response.json();
    const assistantMessage = data.content?.[0]?.text || 'I apologize, I could not generate a response.';
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    console.log(`[VULCAN] Claude responded: ${inputTokens} input tokens, ${outputTokens} output tokens`);

    // Calculate estimated cost in cents
    const estimatedCostCents =
      (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION * 100 +
      (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION * 100;

    // Log to database (fire and forget, but log errors)
    supabase
      .from('chat_logs')
      .insert({
        user_question: latestQuestion.substring(0, 1000),
        assistant_response: assistantMessage.substring(0, 2000),
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_cents: estimatedCostCents,
      })
      .then(({ error: insertError }) => {
        if (insertError) {
          console.error(`[VULCAN] Chat log insert failed:`, insertError.message);
        }
      });

    return NextResponse.json({
      message: assistantMessage,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if chatbot is enabled (used by frontend)
export async function GET() {
  try {
    const { data: setting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'chatbot_enabled')
      .single();

    return NextResponse.json({ enabled: setting?.value === 'true' });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
