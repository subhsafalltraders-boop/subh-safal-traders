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
                  product_name_raw: { type: SchemaType.STRING, description: "Just write exactly what you read on the paper." },
                  box_qty: { type: SchemaType.INTEGER },
                  piece_qty: { type: SchemaType.INTEGER }
                },
                required: ["product_name_raw", "box_qty", "piece_qty"]
              }
            }
          },
          required: ["vendor_name", "date", "items"]
        }
      }
    });

    // STEP 1: PURE OCR - NO MATCHING
    const prompt = `
      You are an expert OCR engine. Transcribe the handwritten text exactly as you see it. 
      DO NOT map it to any database. 
      - If a line has 'box', 'bx', 'b', assign the number to 'box_qty' and 0 to 'piece_qty'.
      - If a line has 'p', 'pc', 'pieces', assign the number to 'piece_qty' and 0 to 'box_qty'.
    `;

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

    // STEP 2: TYPESCRIPT MATCHING ENGINE
    const aliasDictionary: Record<string, string> = {
      "b p k": "BPK - Badam Pista Kulfi (60)",
      "bpk": "BPK - Badam Pista Kulfi (60)",
      "mava": "Mava Malai Kufi (20)",
      "oneup": "OneUp Chocobar (20)",
      "group chocobar": "OneUp Chocobar (20)",
      "b.t royal": "BT Royal Cone(30)",
      "b t royal": "BT Royal Cone(30)",
      "bt royal": "BT Royal Cone(30)",
      "special": "V Special kulfi (10)",
      "chocobar": "Chocobar(10)",
      "conemul": "Cone no.1 (10)",
      "cone no": "Cone no.1 (10)",
      "v.t": "VT Cone(20)",
      "v t cone": "VT Cone(20)",
      "vt cone": "VT Cone(20)",
      "vanilla pip": "Vanilla PP",
      "vanilla p/p": "Vanilla PP",
      "vanilla p.p": "Vanilla PP",
      "vanilla p": "Vanilla PP",
      "butter pip": "Butter PP",
      "butter p/p": "Butter PP",
      "butter p.p": "Butter PP",
      "butter p": "Butter PP",
      "kesar pip": "Kesar PP",
      "kesar p/p": "Kesar PP",
      "kesar p.p": "Kesar PP",
      "kesar p": "Kesar PP",
      "butter cup": "Cup 20 - Butter",
      "silk": "Gourmet Silk Chocolate Cup (50)",
      "disc cone": "Chocolate Disc Cone(60)",
      "aam": "AAM Chaska (30)",
      "bomber": "Bomber(35)",
      "dolly": "Mango Dolly (15)"
    };

    extractedData.items = extractedData.items.map((item: any) => {
      const raw = (item.product_name_raw || "").toLowerCase().trim();
      let finalMatch = "";

      // 1. Check direct aliases first
      for (const [alias, actualProductName] of Object.entries(aliasDictionary)) {
        if (raw.includes(alias)) {
          finalMatch = actualProductName;
          break;
        }
      }

      // 2. Fallback Substring Matching (Fuzzy)
      if (!finalMatch) {
        let bestMatch = products[0]?.name || "";
        let highestScore = 0;
        const tokens = raw.split(/[\s,.-]+/);

        for (const product of products) {
          const lowerProduct = product.name.toLowerCase();
          let score = 0;
          for (const token of tokens) {
            if (token.length > 2 && lowerProduct.includes(token)) {
              score += token.length; 
            }
          }
          if (score > highestScore) {
            highestScore = score;
            bestMatch = product.name;
          }
        }
        finalMatch = highestScore > 0 ? bestMatch : "⚠️ Manual Verify Needed";
      }

      return { ...item, product_name_matched: finalMatch, confidence: finalMatch.includes("⚠️") ? "low" : "high" };
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
