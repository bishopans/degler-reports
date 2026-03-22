import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
- When document content is provided below, USE IT to answer the user's question directly. Provide specific steps, settings, wiring info, or whatever technical detail the user needs from the manual content.
- If you have document content, walk the user through the relevant sections. Don't just say "refer to the manual" — actually give them the information.
- If the document content doesn't fully answer the question, share what you can and note what's missing.
- If you don't have the specific content they need, tell them which documents exist and suggest they download them.
- Be friendly but professional — you're helping construction and facilities professionals.
- Do NOT make up technical specifications. Only share info that's in the provided document content.`;

// Extract text from PDF buffer using pdf-parse
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Use pdf-parse/lib/pdf-parse.js directly to avoid the test file loading issue on Vercel
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF parse error:', error);
    return '';
  }
}

// Fetch PDF from Supabase Storage and extract text
async function fetchPdfContent(storagePath: string): Promise<string> {
  try {
    console.log(`[PDF] Downloading: ${storagePath}`);
    const { data, error } = await supabase.storage
      .from('manuals')
      .download(storagePath);

    if (error || !data) {
      console.error('[PDF] Storage download error:', storagePath, error);
      return '';
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[PDF] Downloaded ${buffer.length} bytes from ${storagePath}`);

    const text = await extractPdfText(buffer);
    console.log(`[PDF] Extracted ${text.length} chars from ${storagePath}`);
    if (text.length > 0) {
      console.log(`[PDF] First 200 chars: ${text.substring(0, 200)}`);
    }

    // Clean up the text — remove excessive whitespace/newlines
    return text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  } catch (error) {
    console.error('[PDF] Fetch error:', storagePath, error);
    return '';
  }
}

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

    // Search for relevant manuals based on the latest user question
    const latestQuestion = recentMessages[recentMessages.length - 1]?.content || '';
    let contextInfo = '';

    if (latestQuestion) {
      // Smart keyword search with alias expansion
      const rawTerms = latestQuestion
        .toLowerCase()
        .replace(/[^\w\s.-]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 1);

      // Expand common aliases — users type these but the database has different names
      const aliasMap: Record<string, string[]> = {
        'powertouch': ['powr-touch', 'powr touch', 'powrtouch'],
        'powrtouch': ['powr-touch', 'powr touch', 'powertouch'],
        'powr-touch': ['powertouch', 'powrtouch'],
        'powerflex': ['powr-flex', 'powr flex'],
        'powrflex': ['powr-flex', 'powr flex'],
        'powernet': ['powr-net', 'powr net'],
        'powrnet': ['powr-net', 'powr net'],
        'powermax': ['powermax'],
        'powerselect': ['powr-select', 'powr select'],
        'powrselect': ['powr-select', 'powr select'],
        'powrcarbon': ['powr-carbon', 'powr carbon'],
        'powercarbon': ['powr-carbon', 'powr carbon'],
        'powrsteel': ['powr-steel', 'powr steel'],
        'powersteel': ['powr-steel', 'powr steel'],
        'powrrib': ['powr rib'],
        'powerrib': ['powr rib'],
        'powrline': ['powr line'],
        'powerline': ['powr line'],
        'powrcourt': ['powr court'],
        'powercourt': ['powr court'],
        'kwikwall': ['kwik-wall', 'kwik wall'],
        'kwik-wall': ['kwikwall'],
        'fairplay': ['fair-play', 'fair play'],
        'fair-play': ['fairplay'],
      };

      // Build expanded search terms
      const expandedTerms = new Set<string>();
      rawTerms.forEach((term: string) => {
        expandedTerms.add(term);
        if (aliasMap[term]) {
          aliasMap[term].forEach((alias: string) => expandedTerms.add(alias));
        }
      });

      // Also try combining consecutive raw terms for compound product names
      for (let i = 0; i < rawTerms.length - 1; i++) {
        const combined = rawTerms[i] + rawTerms[i + 1];
        if (aliasMap[combined]) {
          aliasMap[combined].forEach((alias: string) => expandedTerms.add(alias));
        }
        expandedTerms.add(`${rawTerms[i]}-${rawTerms[i + 1]}`);
      }

      // Pick the most meaningful search terms (skip generic words)
      const stopWords = new Set(['help', 'with', 'the', 'how', 'can', 'you', 'about', 'what', 'does', 'for', 'and', 'programming', 'program', 'install', 'installation', 'guide', 'manual', 'spec', 'specs', 'sheet', 'wiring', 'diagram', 'troubleshoot', 'troubleshooting', 'need', 'want', 'please', 'tell', 'show', 'me', 'find', 'get', 'look', 'up']);
      const searchTerms = Array.from(expandedTerms)
        .filter((t: string) => t.length > 1 && !stopWords.has(t))
        .slice(0, 8);

      if (searchTerms.length > 0) {
        // Separate manufacturer terms from product terms
        const knownManufacturers = ['porter', 'daktronics', 'fair-play', 'fairplay', 'nevco', 'gill', 'interkal', 'hufcor', 'kwik-wall', 'kwikwall'];
        const productTerms = searchTerms.filter((t: string) => !knownManufacturers.includes(t));
        const manufacturerTerms = searchTerms.filter((t: string) => knownManufacturers.includes(t));

        let manuals: { manufacturer: string; product_model: string; manual_type: string; filename: string; storage_path: string; file_size_bytes: number }[] | null = null;

        // Strategy 1: If we have product-specific terms, search product_model first
        if (productTerms.length > 0) {
          const productOrClauses = productTerms
            .map((term: string) => `product_model.ilike.%${term}%`)
            .join(',');

          let query = supabase
            .from('product_manuals')
            .select('manufacturer, product_model, manual_type, filename, storage_path, file_size_bytes')
            .or(productOrClauses)
            .neq('manual_type', 'Placeholder');

          // If a manufacturer was mentioned, filter to that manufacturer
          if (manufacturerTerms.length > 0) {
            const mfrOrClauses = manufacturerTerms
              .map((term: string) => `manufacturer.ilike.%${term}%`)
              .join(',');
            query = query.or(mfrOrClauses);
          }

          const { data } = await query.limit(15);
          manuals = data;
        }

        // Strategy 2: If no product terms or no results, broaden to include manufacturer
        if (!manuals || manuals.length === 0) {
          const allOrClauses = searchTerms
            .flatMap((term: string) => [
              `product_model.ilike.%${term}%`,
              `manufacturer.ilike.%${term}%`,
            ])
            .join(',');

          const { data } = await supabase
            .from('product_manuals')
            .select('manufacturer, product_model, manual_type, filename, storage_path, file_size_bytes')
            .or(allOrClauses)
            .neq('manual_type', 'Placeholder')
            .limit(15);

          manuals = data;
        }

        if (manuals && manuals.length > 0) {
          // Build the document list
          const docList = manuals
            .map(
              (m) =>
                `- ${m.manufacturer} / ${m.product_model} / ${m.manual_type}: ${m.filename.replace(/_/g, ' ').replace('.pdf', '')}`
            )
            .join('\n');

          // Now fetch actual PDF content for the top 2-3 most relevant documents
          // Prioritize: Installation Guides > Manuals > Spec Sheets
          // Only fetch PDFs under 2MB to stay within time/memory limits
          const typeOrder: Record<string, number> = {
            'Installation Guide': 1,
            'Manual': 2,
            'Spec Sheet': 3,
            'Wiring Diagram': 4,
          };

          const sortedManuals = [...manuals]
            .filter((m) => m.storage_path && m.file_size_bytes < 5_000_000)
            .sort((a, b) => (typeOrder[a.manual_type] || 5) - (typeOrder[b.manual_type] || 5));

          // Fetch up to 3 PDFs in parallel — give each document plenty of room
          // Haiku 3.5 has 200K context, so we can afford ~15K chars (~4K tokens) per doc
          const pdfsToFetch = sortedManuals.slice(0, 3);
          const pdfContents: string[] = [];
          const MAX_CHARS_PER_DOC = 15000;

          if (pdfsToFetch.length > 0) {
            const contentPromises = pdfsToFetch.map(async (manual) => {
              const text = await fetchPdfContent(manual.storage_path);
              if (text) {
                const truncated = text.length > MAX_CHARS_PER_DOC
                  ? text.substring(0, MAX_CHARS_PER_DOC) + '\n... [content truncated — full document available for download]'
                  : text;
                return `\n--- DOCUMENT: ${manual.manufacturer} / ${manual.product_model} / ${manual.manual_type} (${manual.filename}) ---\n${truncated}`;
              }
              return '';
            });

            const results = await Promise.all(contentPromises);
            results.forEach((content) => {
              if (content) pdfContents.push(content);
            });
          }

          // Build the context info
          console.log(`[VULCAN] Found ${manuals.length} docs, fetched ${pdfsToFetch.length} PDFs, got ${pdfContents.length} with content`);
          console.log(`[VULCAN] PDF content total chars: ${pdfContents.reduce((sum, c) => sum + c.length, 0)}`);
          contextInfo = `\n\nDOCUMENTS FOUND IN THE LIBRARY:\n${docList}`;

          if (pdfContents.length > 0) {
            contextInfo += `\n\nDOCUMENT CONTENT (extracted from PDFs — use this to answer the user's question):\n${pdfContents.join('\n')}`;
            contextInfo += `\n\nIMPORTANT: Use the document content above to answer the user's question with specific details, steps, and technical information. Walk them through the relevant sections. If the content doesn't fully answer the question, share what you can and suggest they download the full document for more detail.`;
          } else {
            contextInfo += `\n\nNote: PDF content could not be extracted at this time. Let the user know what documents are available and suggest they download the relevant ones from the manual library.`;
          }
        }
      }
    }

    // Call Claude API (Haiku 3.5 for speed and cost efficiency)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT + contextInfo,
        messages: recentMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to get a response from Vulcan. Please try again.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const assistantMessage = data.content?.[0]?.text || 'I apologize, I could not generate a response.';
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;

    // Calculate estimated cost in cents
    const estimatedCostCents =
      (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION * 100 +
      (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION * 100;

    // Log to database (fire and forget)
    supabase
      .from('chat_logs')
      .insert({
        user_question: latestQuestion.substring(0, 1000),
        assistant_response: assistantMessage.substring(0, 2000),
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_cents: estimatedCostCents,
      })
      .then(() => {});

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
