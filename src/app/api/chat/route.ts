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
- When PDF documents are attached to this conversation, READ THEM CAREFULLY and use the content to answer the user's question directly. Provide specific steps, settings, wiring info, or whatever technical detail the user needs.
- Walk users through the relevant sections of the manual. Don't just say "refer to the manual" — actually give them the information from the document.
- If the documents don't fully answer the question, share what you can and note what's missing.
- Be friendly but professional — you're helping construction and facilities professionals.
- Do NOT make up technical specifications. Only share info that's in the provided documents.`;

// Download PDF from Supabase Storage public URL and return as base64
// Uses direct HTTP fetch instead of Supabase client for reliability in serverless
async function fetchPdfAsBase64(storagePath: string): Promise<string | null> {
  try {
    // Construct public URL for the file (bucket is public)
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/manuals/${encodeURIComponent(storagePath).replace(/%2F/g, '/')}`;
    console.log(`[PDF] Fetching: ${publicUrl}`);

    const response = await fetch(publicUrl);
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

    // Convert to base64 for Claude API
    const base64 = buffer.toString('base64');
    console.log(`[PDF] Converted to base64: ${base64.length} chars`);
    return base64;
  } catch (error) {
    console.error('[PDF] Fetch error:', storagePath, error);
    return null;
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

    // Search for relevant manuals based on the FULL conversation context
    // This ensures follow-up questions still find the right product
    const latestQuestion = recentMessages[recentMessages.length - 1]?.content || '';
    const allUserMessages = recentMessages
      .filter((m: { role: string; content: string }) => m.role === 'user')
      .map((m: { role: string; content: string }) => m.content)
      .join(' ');
    let contextInfo = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfContentBlocks: any[] = [];

    if (latestQuestion) {
      // Smart keyword search with alias expansion
      // Use ALL user messages for search terms (keeps context across follow-ups)
      const rawTerms = allUserMessages
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

      console.log(`[VULCAN] Search terms: [${searchTerms.join(', ')}] from conversation`);

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

        console.log(`[VULCAN] Found ${manuals?.length || 0} manuals`);
        if (manuals && manuals.length > 0) {
          console.log(`[VULCAN] Top results: ${manuals.slice(0, 5).map(m => `${m.manufacturer}/${m.product_model}/${m.manual_type}`).join(' | ')}`);
          // Build the document list
          const docList = manuals
            .map(
              (m) =>
                `- ${m.manufacturer} / ${m.product_model} / ${m.manual_type}: ${m.filename.replace(/_/g, ' ').replace('.pdf', '')}`
            )
            .join('\n');

          // Fetch the most relevant PDF and send it directly to Claude as a document
          // Claude can read PDFs natively — even scanned/image-based ones
          // Prioritize: Installation Guides > Manuals > Spec Sheets
          const typeOrder: Record<string, number> = {
            'Installation Guide': 1,
            'Manual': 2,
            'Spec Sheet': 3,
            'Wiring Diagram': 4,
          };

          const sortedManuals = [...manuals]
            .filter((m) => m.storage_path && m.file_size_bytes < 5_000_000)
            .sort((a, b) => (typeOrder[a.manual_type] || 5) - (typeOrder[b.manual_type] || 5));

          // Fetch the top 1 PDF (keep it to 1 for speed and cost — each page ~1500 tokens)
          console.log(`[VULCAN] Sorted manuals for PDF fetch: ${sortedManuals.length} candidates`);
          const pdfToFetch = sortedManuals[0];

          if (pdfToFetch) {
            console.log(`[VULCAN] Selected PDF: ${pdfToFetch.manufacturer}/${pdfToFetch.product_model} - ${pdfToFetch.manual_type} (${pdfToFetch.filename}, ${pdfToFetch.file_size_bytes} bytes, path: ${pdfToFetch.storage_path})`);
            const base64Data = await fetchPdfAsBase64(pdfToFetch.storage_path);
            if (base64Data) {
              console.log(`[VULCAN] PDF base64 ready: ${base64Data.length} chars — attaching to Claude request`);
              pdfContentBlocks.push({
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64Data,
                },
                title: `${pdfToFetch.manufacturer} - ${pdfToFetch.product_model} - ${pdfToFetch.manual_type}`,
              });
            } else {
              console.error(`[VULCAN] PDF download returned null for ${pdfToFetch.storage_path}`);
            }
          } else {
            console.log('[VULCAN] No PDF candidates after filtering (size < 5MB, has storage_path)');
          }

          // Build the context info for the system prompt
          contextInfo = `\n\nDOCUMENTS FOUND IN THE LIBRARY:\n${docList}`;

          if (pdfContentBlocks.length > 0) {
            contextInfo += `\n\nA PDF document has been attached to the user's message below. READ IT CAREFULLY and use its content to answer the user's question with specific details, steps, and technical information. The attached document is: ${pdfToFetch.manufacturer} / ${pdfToFetch.product_model} / ${pdfToFetch.manual_type} (${pdfToFetch.filename}).`;
          } else {
            contextInfo += `\n\nNote: PDF content could not be loaded at this time. Let the user know what documents are available and suggest they download the relevant ones from the manual library.`;
          }
        }
      }
    }

    // Build the messages array for Claude API
    // If we have PDF content blocks, attach them to the latest user message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiMessages = recentMessages.map((msg: any, idx: number) => {
      if (idx === recentMessages.length - 1 && msg.role === 'user' && pdfContentBlocks.length > 0) {
        // Attach PDF document(s) to the latest user message
        return {
          role: 'user',
          content: [
            ...pdfContentBlocks,
            { type: 'text', text: msg.content },
          ],
        };
      }
      return msg;
    });

    // Log what we're sending to Claude
    console.log(`[VULCAN] API call: ${pdfContentBlocks.length} PDF(s) attached, ${apiMessages.length} messages, context length: ${contextInfo.length} chars`);

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
        max_tokens: 2048,
        system: SYSTEM_PROMPT + contextInfo,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VULCAN] Claude API error ${response.status}: ${errorText.substring(0, 500)}`);
      return NextResponse.json(
        { error: 'Failed to get a response from Vulcan. Please try again.' },
        { status: 502 }
      );
    }

    const data = await response.json();
    const assistantMessage = data.content?.[0]?.text || 'I apologize, I could not generate a response.';
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    console.log(`[VULCAN] Claude responded: ${inputTokens} input tokens, ${outputTokens} output tokens`);

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
