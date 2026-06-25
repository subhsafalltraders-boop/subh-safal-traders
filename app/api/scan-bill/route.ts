import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function POST(request: NextRequest) {
  try {
    console.log('API route hit');
    console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);

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
    const productNames = products.map((p: { name: string }) => p.name).join(', ');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const prompt = `You are an expert at reading handwritten ice cream distribution bills, even with very poor or unclear handwriting.

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
- Match partial names: "special" = "V. Special", "butter" = "Butter Cup", "choco" = "Chocolate"
- Match abbreviations: "KC" = "Kesar Cup", "BC" = "Butter Cup"
- Match phonetically: "volcono" = "Volcano", "bombar" = "Bomber"
- Match even 2-3 starting letters
- ALWAYS pick closest product from list, never leave product_name_matched empty
- If truly unreadable, pick most common product and set confidence "low"

QUANTITY RULES:
- Numbers in quantity column = box quantity by default
- "1 box", "1b", "1 bx" = box_qty: 1
- "15p", "15 pcs" = piece_qty: 15
- "1 box 5p" = box_qty: 1, piece_qty: 5
- Plain number like "15" = box_qty: 15

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
      }) => {
        const productLower = p.name.toLowerCase();
        const rawLower = item.product_name_raw.toLowerCase();
        const matchedLower = item.product_name_matched.toLowerCase();

        return (
          productLower === matchedLower ||
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
    console.error('Scan bill full error:', JSON.stringify(error, null, 2));
    console.error('Error message:', (error as Error).message);
    console.error('Error stack:', (error as Error).stack);
    return NextResponse.json(
      { error: 'Failed to process image. Please try again.' },
      { status: 500 }
    );
  }
}
