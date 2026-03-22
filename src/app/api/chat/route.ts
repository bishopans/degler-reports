import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Claude API pricing (Haiku 3.5 — fast and cheap)
const INPUT_COST_PER_MILLION = 0.80;  // $0.80 per 1M input tokens
const OUTPUT_COST_PER_MILLION = 4.00; // $4.00 per 1M output tokens

const SYSTEM_PROMPT = `You are Vulcan, an AI assistant for the Degler Whiting product manual library. You are named after the Roman god of the forge — knowledgeable, reliable, and helpful.

Your role is to help users find the right product documents and answer questions about the manufacturers and products in the library.

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
- When users ask about a product, suggest relevant documents they can find in the library.
- If you don't know something specific about a product's technical details, say so and point them to the relevant spec sheet or manual.
- You can help users navigate the library: explain how to filter by category, manufacturer, or document type.
- Be friendly but professional — you're helping construction and facilities professionals.
- Do NOT make up technical specifications. Always refer users to the actual documents.
- Keep responses under 200 words unless the user asks for more detail.`;

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
      // Build search terms from the question
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
        // Check for aliases
        if (aliasMap[term]) {
          aliasMap[term].forEach((alias: string) => expandedTerms.add(alias));
        }
        // Also try combining adjacent words (e.g., "power" + "touch" → "powr-touch")
      });

      // Also try combining consecutive raw terms for compound product names
      for (let i = 0; i < rawTerms.length - 1; i++) {
        const combined = rawTerms[i] + rawTerms[i + 1];
        if (aliasMap[combined]) {
          aliasMap[combined].forEach((alias: string) => expandedTerms.add(alias));
        }
        // Also add hyphenated version
        expandedTerms.add(`${rawTerms[i]}-${rawTerms[i + 1]}`);
      }

      // Pick the most meaningful search terms (skip generic words)
      const stopWords = new Set(['help', 'with', 'the', 'how', 'can', 'you', 'about', 'what', 'does', 'for', 'and', 'programming', 'program', 'install', 'installation', 'guide', 'manual', 'spec', 'specs', 'sheet', 'wiring', 'diagram', 'troubleshoot', 'troubleshooting']);
      const searchTerms = Array.from(expandedTerms)
        .filter((t: string) => t.length > 1 && !stopWords.has(t))
        .slice(0, 8);

      if (searchTerms.length > 0) {
        // Separate manufacturer terms from product terms
        const knownManufacturers = ['porter', 'daktronics', 'fair-play', 'fairplay', 'nevco', 'gill', 'interkal', 'hufcor', 'kwik-wall', 'kwikwall'];
        const productTerms = searchTerms.filter((t: string) => !knownManufacturers.includes(t));
        const manufacturerTerms = searchTerms.filter((t: string) => knownManufacturers.includes(t));

        let manuals: { manufacturer: string; product_model: string; manual_type: string; filename: string }[] | null = null;

        // Strategy 1: If we have product-specific terms, search product_model first
        if (productTerms.length > 0) {
          const productOrClauses = productTerms
            .map((term: string) => `product_model.ilike.%${term}%`)
            .join(',');

          let query = supabase
            .from('product_manuals')
            .select('manufacturer, product_model, manual_type, filename')
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
            .select('manufacturer, product_model, manual_type, filename')
            .or(allOrClauses)
            .neq('manual_type', 'Placeholder')
            .limit(15);

          manuals = data;
        }

        if (manuals && manuals.length > 0) {
          contextInfo = `\n\nRELEVANT DOCUMENTS FOUND IN THE LIBRARY:\n${manuals
            .map(
              (m) =>
                `- ${m.manufacturer} / ${m.product_model} / ${m.manual_type}: ${m.filename.replace(/_/g, ' ').replace('.pdf', '')}`
            )
            .join('\n')}\n\nIMPORTANT: When the user asks about a product, ALWAYS reference these documents. Tell them what documents are available and what they contain. Do not say you don't have documentation if documents are listed above.`;
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
        max_tokens: 512,
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
