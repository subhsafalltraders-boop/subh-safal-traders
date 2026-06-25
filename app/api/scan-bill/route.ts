import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
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
        temperature: 0.0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            vendor_name: { type: SchemaType.STRING },
            date: { type: SchemaType.STRING, description: "Format: YYYY-MM-DD" },
            items: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  product_name_raw: { type: SchemaType.STRING, description: "Exactly what is written on paper line by line" },
                  product_name_matched: { type: SchemaType.STRING, description: "Must be the exact matching string from the provided database list" },
                  box_qty: { type: SchemaType.INTEGER },
                  piece_qty: { type: SchemaType.INTEGER },
                  confidence: { type: SchemaType.STRING, description: "high/medium/low" }
                },
                required: ["product_name_raw", "product_name_matched", "box_qty", "piece_qty", "confidence"]
              }
            }
          },
          required: ["vendor_name", "date", "items"]
        }
      }
    });

    const prompt = `Transcribe the handwritten diary bill exactly as seen.
- If line ends with 'box', 'bx', 'b', assign quantity to 'box_qty' and set 'piece_qty' to 0.
- If line ends with 'p', 'pc', 'pieces', assign quantity to 'piece_qty' and set 'box_qty' to 0.

Available products in database: ${productNames}`;

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
      extractedData = JSON.parse(responseText);
    } catch {
      console.error('Raw Gemini response:', responseText);
      return NextResponse.json(
        { error: 'AI could not read the bill. Please try with a clearer photo.' },
        { status: 422 }
      );
    }

    // --- 100% DETERMINISTIC TYPESCRIPT MAPPING INTERCEPTOR ---
    extractedData.items = extractedData.items.map((item: any) => {
      const raw = (item.product_name_raw || "").toLowerCase();
      let finalMatch = item.product_name_matched;

      if (raw.includes("b p k") || raw.includes("bpk")) finalMatch = "BPK - Badam Pista Kulfi (60)";
      else if (raw.includes("mava")) finalMatch = "Mava Malai Kufi (20)";
      else if (raw.includes("oneup") || raw.includes("group")) finalMatch = "OneUp Chocobar (20)";
      else if (raw.includes("b.t royal") || raw.includes("b t royal") || raw.includes("bt royal")) finalMatch = "BT Royal Cone(30)";
      else if (raw.includes("special")) finalMatch = "V Special kulfi (10)";
      else if (raw.includes("chocobar") && !raw.includes("oneup") && !raw.includes("group")) finalMatch = "Chocobar(10)";
      else if (raw.includes("cone no") || raw.includes("conemul")) finalMatch = "Cone no.1 (10)";
      else if (raw.includes("v.t") || raw.includes("vt cone") || raw.includes("v t cone")) finalMatch = "VT Cone(20)";
      else if (raw.includes("vanilla pip") || raw.includes("vanilla p") || raw.includes("vanilla pp")) finalMatch = "Vanilla PP";
      else if (raw.includes("butter pip") || raw.includes("butter p") || raw.includes("butter pp")) finalMatch = "Butter PP";
      else if (raw.includes("kesar pip") || raw.includes("kesar p") || raw.includes("kesar pp")) finalMatch = "Kesar PP";
      else if (raw.includes("butter cup")) finalMatch = "Butterscotch Cup(30)";

      return { ...item, product_name_matched: finalMatch };
    });

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
