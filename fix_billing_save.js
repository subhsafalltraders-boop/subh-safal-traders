const fs = require('fs');
const file = 'app/(dashboard)/billing/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetContent = `    const cleanItems = items.map(({ ui_id, ...rest }) => ({
      ...rest,
      box_qty: rest.box_quantity,
      piece_qty: rest.piece_quantity,
      rate: \`Box: ₹\${rest.price_per_box} | Piece: ₹\${rest.price_per_piece}\`,
      amount: rest.total
    }));

    const payload = {
      vendor_id: formData.vendor_id,
      vendor_name: vendor?.name || '',
      bill_number: billNumber,
      date: formData.date,
      subtotal: Math.round(subtotal),
      discount_type: discountType,
      discount_amount: Math.round(discountAmount),
      gst_type: '0%',
      gst_amount: 0,
      grand_total: Math.round(grandTotal),
      bill_type: billType,
      items: cleanItems as any
    };`;

const replacementContent = `    let total_cost = 0;
    const cleanItems = items.map(({ ui_id, ...rest }) => {
      const product = products.find(p => p.id === rest.product_id);
      const ppb = product?.pieces_per_box || 1;
      const cp = product?.cost_price || 0;
      const cpPerPiece = cp / ppb;
      const totalPieces = (Number(rest.box_quantity || 0) * ppb) + Number(rest.piece_quantity || 0);
      total_cost += (totalPieces * cpPerPiece);

      return {
        ...rest,
        box_qty: rest.box_quantity,
        piece_qty: rest.piece_quantity,
        rate: \`Box: ₹\${rest.price_per_box} | Piece: ₹\${rest.price_per_piece}\`,
        amount: rest.total
      };
    });

    const payload = {
      vendor_id: formData.vendor_id,
      vendor_name: vendor?.name || '',
      bill_number: billNumber,
      date: formData.date,
      subtotal: Math.round(subtotal),
      discount_type: discountType,
      discount_amount: Math.round(discountAmount),
      gst_type: '0%',
      gst_amount: 0,
      grand_total: Math.round(grandTotal),
      bill_type: billType,
      items: cleanItems as any,
      total_cost: Math.round(total_cost),
      total_profit: Math.round(grandTotal) - Math.round(total_cost)
    };`;

content = content.replace(targetContent, replacementContent);
fs.writeFileSync(file, content, 'utf8');
