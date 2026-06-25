import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const limit = rateLimitMap.get(ip);

    if (limit && now < limit.resetTime) {
      if (limit.count >= 10) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a minute.' },
          { status: 429 }
        );
      }
      limit.count++;
    } else {
      rateLimitMap.set(ip, { count: 1, resetTime: now + 60000 });
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;
    const productsJson = formData.get('products') as string;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, and WebP images allowed' },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Max 10MB allowed' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';

    const products = JSON.parse(productsJson || '[]');
    const productNames = products.map((p: { name: string; aliases?: string[] }) => {
      const aliasStr = p.aliases && p.aliases.length > 0 ? ` (also known as: ${p.aliases.join(', ')})` : '';
      return `${p.name}${aliasStr}`;
    }).join('\n');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-pro-preview',
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      }
    });

    const prompt = `You are an expert data extraction assistant for 'Subh Safal Traders'.
Read the uploaded handwritten diary page carefully.

CRITICAL TWO-STEP PROCESS:
1. First, read exactly what is written on the page line by line (Pure OCR).
2. Then, map that exact text to a product in our database.

Available products in database: ${productNames}

Extract bill details and return ONLY valid JSON, no other text, no markdown:

{
  "vendor_name": "name written after M/S or customer name field",
  "date": "date in YYYY-MM-DD format if readable, else null",
  "items": [
    {
      "product_name_raw": "exactly what is written, even if unclear",
      "product_name_matched": "best matching product from the available products list",
      "product_id": null,
      "box_qty": 0,
      "piece_qty": 0,
      "confidence": "high/medium/low"
    }
  ]
}

MATCHING RULES:
- MATCH TO CATALOG: The shopkeeper uses abbreviations and shorthand. You MUST map the handwritten item name to the MOST LIKELY EXACT MATCH from our provided products database list. DO NOT guess randomly.
- Use this explicit mapping guide for shorthand names:
  - If written "BPK Kulfi" -> map to "BPK - Badam Pista Kulfi (60)"
  - If written "Mava Kulfi" -> map to "Mava Malai Kufi (20)"
  - If written "Oneup chocobar" -> map to "OneUp Chocobar (20)"
  - If written "B.T Royal" -> map to "BT Royal Cone(30)"
  - If written "Special" -> map to "V Special kulfi (10)"
  - If written "chocobar" -> map to "Chocobar(10)"
  - If written "conemul" or "cone no 1" -> map to "Cone no.1 (10)"
  - If written "V.T Cone" -> map to "VT Cone(20)"
  - If written "vanilla p/p" or "vanilla pip" -> map to "Vanilla PP"
  - If written "Butter p/p" or "Butter pip" -> map to "Butter PP"
  - If written "kesar p/p" or "kesar pip" -> map to "Kesar PP"
  - If written "Butter cup" -> map to "Cup 20 - Butter" OR "Butterscotch Cup(30)" based on context.
- ALWAYS pick closest product from list, never leave product_name_matched empty.

QUANTITY RULES:
- Look at the text after the hyphen "-" or the HSN Code column.
- If it says "box", "bx", "b", assign the number to the "box_qty" integer field.
- If it says "p", "pc", "pieces", assign the number to the "piece_qty" integer field.
- "1 box", "1b", "1 bx" = box_qty: 1
- "15p", "15 pcs" = piece_qty: 15
- "1 box 5p" = box_qty: 1, piece_qty: 5
- Plain number like "15" without unit = box_qty: 15 by default.

HANDWRITING RULES:
- Use context from surrounding words to guess unclear writing
- Product names will always be ice cream names
- Quantities will always be small numbers 1-100
- Make best guess always, user will verify before saving

Return ONLY the JSON object, no explanation, no markdown backticks.`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType: mimeType,
        },
      },
      prompt,
    ]);

    const responseText = result.response.text();

    let extractedData;
    try {
      const cleanJson = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      extractedData = JSON.parse(cleanJson);
    } catch {
      console.error('Raw Gemini response:', responseText);
      return NextResponse.json(
        { error: 'AI could not read the bill. Please try with a clearer photo.' },
        { status: 422 }
      );
    }

    // Server-side product ID matching
    extractedData.items = extractedData.items.map((item: {
      product_name_raw: string;
      product_name_matched: string;
      product_id: string | null;
      box_qty: number;
      piece_qty: number;
      confidence: string;
    }) => {
      const matched = products.find((p: {
        id: string;
        name: string;
        price_per_box: number;
        price_per_piece: number;
        aliases?: string[];
      }) => {
        const productLower = p.name.toLowerCase();
        const rawLower = item.product_name_raw.toLowerCase();
        const matchedLower = item.product_name_matched.toLowerCase();
        const aliases = (p.aliases || []).map((a: string) => a.toLowerCase());

        return (
          productLower === matchedLower ||
          aliases.some(a => a === rawLower || rawLower.includes(a) || a.includes(rawLower)) ||
          productLower.includes(rawLower) ||
          rawLower.includes(productLower.split(' ')[0]) ||
          matchedLower.includes(productLower.split(' ')[0]) ||
          productLower.split(' ').some((word: string) =>
            word.length > 2 && (rawLower.includes(word) || matchedLower.includes(word))
          )
        );
      });

      return {
        ...item,
        product_id: matched?.id || null,
        product_name_matched: matched?.name || item.product_name_matched,
        price_per_box: matched?.price_per_box || 0,
        price_per_piece: matched?.price_per_piece || 0,
      };
    });

    return NextResponse.json({ success: true, data: extractedData });

  } catch (error) {
    const err = error as { status?: number };
    if (err.status === 429) {
      return NextResponse.json(
        { error: 'Scan feature is temporarily unavailable. Please try again after some time or enter the bill manually.' },
        { status: 503 }
      );
    }
    console.error('Scan bill full error:', JSON.stringify(error, null, 2));
    console.error('Error message:', (error as Error).message);
    console.error('Error stack:', (error as Error).stack);
    return NextResponse.json(
      { error: 'Failed to process image. Please try again.' },
      { status: 500 }
    );
  }
}
