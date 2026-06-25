import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

// Types for this route
type ScannedItem = {
  product_name_raw: string;
  product_name_matched: string;
  product_id: string | null;
  box_qty: number;
  piece_qty: number;
  confidence: 'high' | 'medium' | 'low';
  price_per_box?: number;
  price_per_piece?: number;
};

type ProductInput = {
  id: string;
  name: string;
  price_per_box: number | null;
  price_per_piece: number | null;
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const productsJson = formData.get('products') as string;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, and WebP images allowed' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Max 10MB allowed' },
        { status: 400 }
      );
    }

    // Convert to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';

    // Parse products list for matching
    const products: ProductInput[] = JSON.parse(productsJson || '[]');
    const productNames = products.map((p) => p.name).join(', ');

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Scan feature not configured. Contact admin.' },
        { status: 500 }
      );
    }

    // Call Claude Vision API
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: `You are an expert at reading handwritten ice cream distribution bills, even with very poor or unclear handwriting.

Available products in database: ${productNames}

Extract bill details and return ONLY valid JSON, no other text:

{
  "vendor_name": "name written after M/S or customer name field",
  "date": "date in YYYY-MM-DD format if readable, else null",
  "items": [
    {
      "product_name_raw": "exactly what is written, even if unclear",
      "product_name_matched": "best matching product from the available products list",
      "product_id": null,
      "box_qty": number or 0,
      "piece_qty": number or 0,
      "confidence": "high/medium/low"
    }
  ]
}

MATCHING RULES — very important:
- Match partial names: "special" = "V. Special", "butter" = "Butter Cup", "choco" = "Chocolate"
- Match abbreviations: "KC" = "Kesar Cup", "BC" = "Butter Cup"
- Match phonetically similar: "volcono" = "Volcano", "bombar" = "Bomber"
- Match even if only 2-3 letters match the start of a word
- ALWAYS pick the closest product from the list — never leave product_name_matched empty
- If truly unreadable, pick the most common product and set confidence "low"

QUANTITY RULES:
- Numbers in HSN/quantity column = box quantity by default for this business
- "1 box", "1b", "1 bx" = 1 box
- "15p", "15 pcs", "15 piece" = piece quantity
- If just a plain number like "15" in quantity column = box quantity
- "1 box 5p" = box_qty: 1, piece_qty: 5

HANDWRITING RULES:
- Even if writing is messy, use context from surrounding words to guess
- Product names will always be ice cream names
- Quantities will always be small numbers (1-100)
- When in doubt, make your best guess — user will verify before saving`,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response from Claude');
    }

    // Parse and validate the response
    const cleanJson = content.text.replace(/```json|```/g, '').trim();
    const extractedData = JSON.parse(cleanJson);

    // Server-side product ID matching
    extractedData.items = (extractedData.items || []).map((item: ScannedItem) => {
      const matched = products.find((p: ProductInput) => {
        const productLower = p.name.toLowerCase();
        const rawLower = (item.product_name_raw || '').toLowerCase();
        const matchedLower = (item.product_name_matched || '').toLowerCase();

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

  } catch (error: unknown) {
    console.error('Scan bill error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process image: ' + message },
      { status: 500 }
    );
  }
}
