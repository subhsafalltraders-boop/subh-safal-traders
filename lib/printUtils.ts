import { Bill, AppSetting, Settlement } from './types';

export function generateSettlementHTML(settlement: Settlement, vendorName: string, appSetting: AppSetting | null, bills: any[] = [], payments: any[] = []): string {
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getCompanyDetails = () => {
    if (!appSetting) {
      return `
        <div style="font-size: 16px; font-weight: bold;">SUBH SAFAL TRADERS</div>
        <div style="font-size: 10px;">LAKSHMISAGAR, KOTWALI CHOWK, MADHUBANI</div>
      `;
    }
    return `
      <div style="font-size: 16px; font-weight: bold; text-transform: uppercase;">${appSetting.company_name || 'SUBH SAFAL TRADERS'}</div>
      <div style="font-size: 10px; text-transform: uppercase;">${appSetting.address || 'LAKSHMISAGAR, KOTWALI CHOWK, MADHUBANI'}</div>
    `;
  };

  const vanStockDetail = settlement.van_stock_detail || [];
  const vanStockValue = (settlement as any).van_stock_value || settlement.van_stock_total || 0;
  const gstRate = settlement.gst_rate || 0;
  const gstAmount = settlement.gst_amount || 0;
  const advanceAmount = (settlement as any).advance_amount || 0;

  const generateVanStockTable = () => {
    if (!vanStockDetail || vanStockDetail.length === 0) {
      return '<div style="text-align: center; padding: 20px; color: #666;">No van stock recorded</div>';
    }

    let rows = '';
    vanStockDetail.forEach((item: any, idx: number) => {
      rows += `
        <tr style="border-bottom: 1px dashed #ccc;">
          <td style="padding: 6px 8px; border-right: 1px dashed #ccc; text-align: center;">${idx + 1}</td>
          <td style="padding: 6px 8px; border-right: 1px dashed #ccc; text-align: right;">₹${item.price}</td>
          <td style="padding: 6px 8px; border-right: 1px dashed #ccc; text-align: center;">${item.pieces} pcs</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: bold;">₹${item.total.toLocaleString('en-IN')}</td>
        </tr>
      `;
    });

    return `
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #000; margin-top: 15px;">
        <thead style="border-bottom: 2px solid #000; background: #f5f5f5;">
          <tr>
            <th style="padding: 8px; border-right: 1px dashed #ccc; width: 10%;">Sl.</th>
            <th style="padding: 8px; border-right: 1px dashed #ccc; text-align: right;">Price</th>
            <th style="padding: 8px; border-right: 1px dashed #ccc;">Quantity</th>
            <th style="padding: 8px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr style="border-top: 2px solid #000; background: #f9f9f9;">
            <td colspan="3" style="padding: 8px; text-align: right; font-weight: bold;">Van Stock Total:</td>
            <td style="padding: 8px; text-align: right; font-weight: bold; font-size: 12px;">₹${vanStockValue.toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>
    `;
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <title>Settlement Report - ${vendorName}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
    * { box-sizing: border-box; }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div style="width: 100%; max-width: 800px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 8px;">
          <div>GSTIN: ${appSetting?.gstin || '10BDBPM9273J1Z1'}</div>
          <div>MOB: ${appSetting?.phone || '9122035642, 9431836502'}</div>
        </div>
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px; text-transform: uppercase;">
          Settlement Report
        </div>
        ${getCompanyDetails()}
      </div>

      <!-- Settlement Info -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px; padding: 12px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px;">
        <div>
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">Vendor/Shopkeeper:</div>
          <div style="font-size: 14px; font-weight: bold;">${vendorName}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">Settlement Period:</div>
          <div style="font-size: 14px; font-weight: bold;">${formatDate(settlement.date_from)} → ${formatDate(settlement.date_to)}</div>
        </div>
      </div>

      <!-- Bills Table -->
      ${bills && bills.length > 0 ? (() => {
      const paymentsByDate: Record<string, number> = {};
      payments.forEach(p => {
        const d = p.date;
        paymentsByDate[d] = (paymentsByDate[d] || 0) + Number(p.total_received);
      });
      const renderedPaymentDates = new Set<string>();

      return `
      <div style="margin-bottom:20px${bills.length > 8 ? '; page-break-after: always' : ''}">
        <h3 style="font-size:13px;font-weight:bold;
          border-bottom:2px solid #000;
          padding-bottom:4px;margin-bottom:8px">
          Bills in Settlement Period
        </h3>
        <table style="width:100%;border-collapse:collapse;
          font-size:11px">
          <thead>
            <tr style="border-bottom:1px solid #000">
              <th style="text-align:left;padding:4px">Bill No.</th>
              <th style="text-align:left;padding:4px">Date</th>
              <th style="text-align:right;padding:4px">Amount</th>
              <th style="text-align:right;padding:4px">Payment Received</th>
            </tr>
          </thead>
          <tbody>
            ${bills.map((b: any) => {
        let paymentStr = '-';
        if (paymentsByDate[b.date] && !renderedPaymentDates.has(b.date)) {
          paymentStr = '₹' + paymentsByDate[b.date].toLocaleString('en-IN', { minimumFractionDigits: 2 });
          renderedPaymentDates.add(b.date);
        }
        return `
              <tr style="border-bottom:1px solid #eee">
                <td style="padding:4px">${b.bill_number}</td>
                <td style="padding:4px">${new Date(b.date).toLocaleDateString('en-IN')}</td>
                <td style="padding:4px;text-align:right">₹${(b.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style="padding:4px;text-align:right;color:#2E7D32">${paymentStr}</td>
              </tr>
            `}).join('')}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid #000;
              font-weight:bold">
              <td colspan="2" style="padding:4px">Total</td>
              <td style="padding:4px;text-align:right">₹${bills.reduce((s: number, b: any) => s + (b.total || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td style="padding:4px;text-align:right;color:#2E7D32">₹${payments.reduce((s: number, p: any) => s + (Number(p.total_received) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      `})() : ''}

      <!-- Summary Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
        <tr style="background: #f9f9f9;">
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Total Supplied (Bills)</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${settlement.total_supplied.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Van Stock Value</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: #d32f2f;">- ₹${vanStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        ${gstAmount > 0 ? `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">GST Adjustment (${gstRate}%)</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: #d32f2f;">- ₹${gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        ` : ''}
        <tr style="background: #f9f9f9;">
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Total Received (Payments)</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: #388e3c;">- ₹${settlement.total_received.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        ${advanceAmount > 0 ? `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Advance Taken by Vendor</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: #d32f2f;">+ ₹${advanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
        ` : ''}
        <tr style="background: ${settlement.final_balance > 0 ? '#ffebee' : settlement.final_balance < 0 ? '#e8f5e9' : '#f5f5f5'}; border-top: 3px solid #000;">
          <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; font-size: 14px;">FINAL BALANCE</td>
          <td style="padding: 12px; border: 1px solid #ddd; text-align: right; font-weight: bold; font-size: 16px; color: ${settlement.final_balance > 0 ? '#d32f2f' : settlement.final_balance < 0 ? '#388e3c' : '#000'};">
            ${settlement.final_balance > 0 ? '- ' : settlement.final_balance < 0 ? '+ ' : ''}₹${Math.abs(settlement.final_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </td>
        </tr>
      </table>

      <!-- Balance Description -->
      <div style="padding: 15px; background: ${settlement.final_balance > 0 ? '#ffebee' : settlement.final_balance < 0 ? '#e8f5e9' : '#f5f5f5'}; border-left: 4px solid ${settlement.final_balance > 0 ? '#d32f2f' : settlement.final_balance < 0 ? '#388e3c' : '#999'}; margin-bottom: 20px; border-radius: 4px;">
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 5px;">Settlement Result:</div>
        <div style="font-size: 14px;">
          ${settlement.final_balance > 0
      ? `Vendor pe <strong>₹${Math.abs(settlement.final_balance).toLocaleString('en-IN')}</strong> baaki hai (Vendor owes you)`
      : settlement.final_balance < 0
        ? `Aap vendor ko <strong>₹${Math.abs(settlement.final_balance).toLocaleString('en-IN')}</strong> denge (You owe vendor)`
        : 'Hisab barabar hai (Settled)'}
        </div>
      </div>

      <!-- Van Stock Detail -->
      <div style="margin-top: 25px;">
        <h3 style="font-size: 13px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 5px;">Van Stock Detail</h3>
        ${generateVanStockTable()}
      </div>

      <!-- Footer -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 2px dashed #ccc;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 10px; color: #666; margin-bottom: 5px;">Settled On:</div>
            <div style="font-size: 12px; font-weight: bold;">${formatDate(settlement.created_at)}</div>
          </div>
          <div style="text-align: center; min-width: 200px;">
            <div style="border-top: 2px solid #000; padding-top: 5px; font-size: 11px;">
              Authorized Signature
            </div>
          </div>
        </div>
      </div>

      <!-- Print Button (hidden when printed) -->
      <div class="no-print" style="margin-top: 30px; text-align: center;">
        <button onclick="window.print()" style="padding: 12px 30px; background: #1976d2; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; font-weight: bold;">
          🖨️ Print Settlement
        </button>
        <button onclick="window.close()" style="padding: 12px 30px; background: #666; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; margin-left: 10px;">
          ✕ Close
        </button>
      </div>
    </div>
</body>
</html>
  `;
}

export function generateBillHTML(bill: Bill, appSetting: AppSetting | null, vendorType?: string | null): string {
  const isGST = bill.bill_type ? bill.bill_type === 'gst' : vendorType === 'shopkeeper';
  const itemCount = (bill.items || []).length;
  const isLandscape = itemCount < 8;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getCompanyDetails = () => {
    if (!appSetting) {
      return `
        <div style="font-size: 20px; font-weight: bold;">SUBH SAFAL TRADERS</div>
        <div style="font-size: 11px;">LAKSHMISAGAR, KOTWALI CHOWK, MADHUBANI</div>
      `;
    }
    return `
      <div style="font-size: 20px; font-weight: bold; text-transform: uppercase;">${appSetting.company_name || 'SUBH SAFAL TRADERS'}</div>
      <div style="font-size: 11px; text-transform: uppercase;">${appSetting.address || 'LAKSHMISAGAR, KOTWALI CHOWK, MADHUBANI'}</div>
    `;
  };

  const generateItemsTable = (itemsToRender: any[], minRows: number, startIndex: number = 0) => {
    let rows = '';
    itemsToRender.forEach((item: any, idx: number) => {
      rows += `
        <tr style="border-bottom: 1px dashed #ccc; line-height: 1.6;">
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: center;">${startIndex + idx + 1}</td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc;">${item.product_name}</td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: center;">${item.box_qty || item.box_quantity || 0}</td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: center;">${item.piece_qty || item.piece_quantity || 0}</td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: right;">₹${item.price_per_piece || '-'}</td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: right;">₹${item.amount || item.total || '-'}</td>
          <td style="padding: 8px 10px; text-align: center;">
            <div style="width: 14px; height: 14px; border: 1.5px solid #000; margin: 0 auto;"></div>
          </td>
        </tr>
      `;
    });

    // Add empty rows to maintain height
    const currentRows = itemsToRender.length;
    for (let i = currentRows; i < minRows; i++) {
      rows += `
        <tr style="line-height: 1.6;">
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: center;">&nbsp;</td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 8px 10px;"></td>
        </tr>
      `;
    }

    return `
      <div style="${isLandscape ? `flex: 1; overflow: hidden; max-height: ${isGST ? '170mm' : '140mm'};` : 'flex-grow: 1;'}">
        <table style="width: 100%; border-collapse: collapse; font-size: ${isLandscape ? '11px' : '13px'}; border: 1px solid #000;">
          <thead style="border-bottom: 1px solid #000; font-size: 12px; font-weight: bold;">
            <tr style="line-height: 1.6;">
              <th style="padding: 8px 10px; border-right: 1px dashed #ccc; width: 5%;">Sl.</th>
              <th style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: left;">Product Description</th>
              <th style="padding: 8px 10px; border-right: 1px dashed #ccc; width: 12%;">No. of Box</th>
              <th style="padding: 8px 10px; border-right: 1px dashed #ccc; width: 12%;">No. of Piece</th>
              <th style="padding: 8px 10px; border-right: 1px dashed #ccc; width: 15%;">Rate</th>
              <th style="padding: 8px 10px; border-right: 1px dashed #ccc; width: 15%;">Amount</th>
              <th style="padding: 8px 10px; width: 8%;">✓</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  };

  const generateTotals = () => {
    let totalsHtml = `<div style="font-size: 13px; margin-top: 5px; line-height: 1.6;">`;

    if (isGST) {
      totalsHtml += `
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>Subtotal:</span>
          <span>${Number(bill.subtotal || 0).toFixed(2)}</span>
        </div>
        ${Number(bill.discount_amount || 0) > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>Discount:</span>
          <span>-${Number(bill.discount_amount || 0).toFixed(2)}</span>
        </div>` : ''}
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>Taxable:</span>
          <span>${(Number(bill.subtotal || 0) - Number(bill.discount_amount || 0)).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>(-) GST (${bill.gst_type || '0%'}):</span>
          <span>-${Number(bill.gst_amount || 0).toFixed(2)}</span>
        </div>
      `;
    } else {
      if (Number(bill.discount_amount || 0) > 0 || Number(bill.gst_amount || 0) > 0) {
        totalsHtml += `
          <div style="display: flex; justify-content: space-between; padding: 2px 0;">
            <span>Subtotal:</span>
            <span>${Number(bill.subtotal || 0).toFixed(2)}</span>
          </div>
        `;

        if (Number(bill.discount_amount || 0) > 0) {
          totalsHtml += `
          <div style="display: flex; justify-content: space-between; padding: 2px 0;">
            <span>Discount:</span>
            <span>-${Number(bill.discount_amount || 0).toFixed(2)}</span>
          </div>
          `;
        }

        if (Number(bill.gst_amount || 0) > 0) {
          if (Number(bill.discount_amount || 0) > 0) {
            totalsHtml += `
            <div style="display: flex; justify-content: space-between; padding: 2px 0;">
              <span>Taxable:</span>
              <span>${(Number(bill.subtotal || 0) - Number(bill.discount_amount || 0)).toFixed(2)}</span>
            </div>
            `;
          }
          totalsHtml += `
          <div style="display: flex; justify-content: space-between; padding: 2px 0;">
            <span>(-) GST (${bill.gst_type || '0%'}):</span>
            <span>-${Number(bill.gst_amount || 0).toFixed(2)}</span>
          </div>
          `;
        }
      }
    }

    totalsHtml += `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-top: 1px solid #000; font-weight: bold; font-size: 16px;">
        <span>Grand Total:</span>
        <span>₹${Number(bill.grand_total || 0).toLocaleString('en-IN')}</span>
      </div>
    </div>`;

    return totalsHtml;
  };

  const generateFooter = (gstBill: boolean) => `
    <div style="margin-top: 15px; text-align: center; font-size: 11px;">
      <div style="border-top: 1px dashed #ccc; width: 50%; margin: 0 auto 5px;"></div>
      <div>Thank you for shopping with us!</div>
    </div>
    ${!gstBill ? `
    <div style="margin-top: 16px; padding-top: 12px;">
      <div style="font-size: 13px; font-weight: bold; text-align: center; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 1px solid #000; padding-bottom: 6px;">
        MONEY RECEIVED
      </div>
      <div style="font-size: 12px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center;">
        Total Cash Received
        <div style="flex: 1; border-bottom: 1px solid #000; margin-left: 8px; height: 16px;"></div>
      </div>
      <div style="font-size: 12px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center;">
        Total Online Received
        <div style="flex: 1; border-bottom: 1px solid #000; margin-left: 8px; height: 16px;"></div>
      </div>
      <div style="font-size: 12px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center;">
        Total Amount
        <div style="flex: 1; border-bottom: 1px solid #000; margin-left: 8px; height: 16px;"></div>
      </div>
    </div>
    ` : ''}
  `;

  const pageStyle = isLandscape
    ? `@page { size: A4 landscape; margin: 6mm; }`
    : `@page { size: A4 portrait; margin: 8mm; }`;

  const commonHtmlTop = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <title>Bill - ${bill.bill_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; }
    
    @media print {
      ${pageStyle}
      
      .page-break {
        page-break-before: always !important;
        break-before: page !important;
      }
      
      .no-print { display: none !important; }
    }
    
    /* Portrait layout — 2 separate pages */
    .bill-page {
      width: 100%;
      padding: 8mm;
      font-size: 11px;
      min-height: 277mm;
    }
    
    .stamp {
      font-size: 14px;
      font-weight: bold;
      border: 2px solid #000;
      padding: 2px 8px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 10px;
    }
  </style>
</head>
<body>
`;

  const printButtons = `
  <!-- Print button (hidden on actual print) -->
  <div class="no-print" style="text-align:center; margin:20px; padding:20px">
    <button onclick="window.print()" 
      style="padding:12px 32px;font-size:16px; background:#1565C0;color:white; border:none;border-radius:8px;cursor:pointer">
      🖨️ Print Bill
    </button>
    <button onclick="window.close()" 
      style="padding:12px 32px;font-size:16px; background:#666;color:white;border:none; border-radius:8px;cursor:pointer; margin-left:12px">
      ✕ Close
    </button>
  </div>
</body>
</html>
  `;

  if (isLandscape) {
    const generateCopy = (copyType: string) => `
      <div style="position: relative; height: ${isGST ? '195mm' : '190mm'}; overflow: hidden; display: flex; flex-direction: column; padding: 10px; box-sizing: border-box;">
        
        <div style="text-align: center; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px;">
            ${isGST ? `<div>GSTIN: ${appSetting?.gstin || '10BDBPM9273J1Z1'}</div>` : '<div></div>'}
            <div style="line-height: 1.8;">MOB: 9122035642<br/>9431836502</div>
          </div>
          <div style="font-size: 13px; font-weight: bold; margin-bottom: 2px;">
            ${isGST ? 'Bill of Supply' : 'Estimate'}
          </div>
          ${getCompanyDetails()}
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 5px;">
          <div>
            <div>Invoice No.: <b>${bill.bill_number || ''}</b></div>
            <div style="margin-top: 4px;">M/S: <b style="font-size: 14px;">${(bill as any).vendors?.name || bill.vendor_name || ''}</b></div>
          </div>
          <div style="text-align: right;">
            <div>Date: <b>${formatDate(bill.date)}</b></div>
            <div style="margin-top: 4px; font-weight: bold; padding: 2px 6px; border: 1px solid #000; display: inline-block;">${copyType}</div>
          </div>
        </div>

        ${generateItemsTable(bill.items || [], 8, 0)}

        <div style="flex-shrink: 0; margin-top: auto;">
          <div style="margin-top: 10px; width: 60%; margin-left: auto;">
            ${generateTotals()}
          </div>
          ${generateFooter(isGST)}
        </div>
      </div>
    `;

    return `
      ${commonHtmlTop}
      <div style="display: flex; width: 100%; height: 100vh;">
        <div style="width: 49%; border-right: 1px dashed #000;">
          ${generateCopy('ORIGINAL')}
        </div>
        <div style="width: 49%; margin-left: 2%;">
          ${generateCopy('DUPLICATE')}
        </div>
      </div>
      ${printButtons}
    `;
  } else {
    const items = bill.items || [];
    const ITEMS_WITH_FOOTER = isGST ? 18 : 13;
    const ITEMS_WITHOUT_FOOTER = isGST ? 22 : 18;

    let itemChunks: any[][] = [];
    if (items.length <= ITEMS_WITH_FOOTER) {
      itemChunks = [items];
    } else {
      let remaining = [...items];
      const chunks = [];
      while (remaining.length > ITEMS_WITH_FOOTER) {
        chunks.push(remaining.slice(0, ITEMS_WITHOUT_FOOTER));
        remaining = remaining.slice(ITEMS_WITHOUT_FOOTER);
      }
      if (remaining.length > 0 || chunks.length === 0) {
        chunks.push(remaining); // last chunk with footer
      }
      itemChunks = chunks;
    }

    const generatePortraitPages = (copyType: string) => {
      let html = '';
      let currentItemIndex = 0;
      itemChunks.forEach((chunkItems, pageIndex) => {
        const isLastPage = pageIndex === itemChunks.length - 1;
        const pageNumber = pageIndex + 1;
        const totalPages = itemChunks.length;
        const startIndex = currentItemIndex;
        currentItemIndex += chunkItems.length;

        html += `
        <div style="
          width: 210mm;
          min-height: 277mm;
          padding: 10mm;
          page-break-after: always;
          display: flex;
          flex-direction: column;
          font-family: Arial, sans-serif;
          font-size: 11px;
        ">
          <!-- HEADER -->
          <div style="text-align: center; margin-bottom: 10px; position: relative;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px;">
              ${isGST ? `<div style="font-size: 11px;">GSTIN: ${appSetting?.gstin || '10BDBPM9273J1Z1'}</div>` : '<div></div>'}
              <div>MOB: ${appSetting?.phone || '9122035642<br/>9431836502'}</div>
            </div>
            <div style="display: block; text-align: right; font-size: 10px; margin-bottom: 4px;">Page ${pageNumber} of ${totalPages}</div>
            <div style="font-size: 13px; font-weight: bold; margin-bottom: 2px;">
              ${isGST ? 'Bill of Supply' : 'Estimate'}
            </div>
            ${getCompanyDetails()}
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 5px;">
            <div>
              <div>Invoice No.: <b>${bill.bill_number || ''}</b></div>
              <div style="margin-top: 4px;">M/S: <b style="font-size: 14px;">${(bill as any).vendors?.name || bill.vendor_name || ''}</b></div>
            </div>
            <div style="text-align: right;">
              <div>Date: <b>${formatDate(bill.date)}</b></div>
              ${pageIndex === 0 ? `<div style="margin-top: 4px; font-weight: bold; padding: 2px 6px; border: 1px solid #000; display: inline-block;">${copyType}</div>` : ''}
            </div>
          </div>

          ${generateItemsTable(chunkItems, isLastPage ? Math.max(8, chunkItems.length) : ITEMS_WITHOUT_FOOTER, startIndex)}

          ${isLastPage ? `
            <div style="flex-shrink: 0; margin-top: auto;">
              <div style="margin-top: 10px; width: 60%; margin-left: auto;">
                ${generateTotals()}
              </div>
              ${generateFooter(isGST)}
            </div>
          ` : `
            <div style="
              margin-top: auto;
              text-align: center;
              font-size: 11px;
              color: #666;
              border-top: 1px dashed #999;
              padding-top: 6px;
            ">
              Continued on next page...
            </div>
          `}
        </div>
        `;
      });
      return html;
    };

    return `
      ${commonHtmlTop}
      ${generatePortraitPages('ORIGINAL')}
      ${generatePortraitPages('DUPLICATE')}
      ${printButtons}
    `;
  }
}

export const printBill = (billHTML: string) => {
  const printWindow = window.open('', '_blank', 'width=900,height=700')

  if (!printWindow) {
    alert('Please allow popups for printing')
    return
  }

  printWindow.document.write(billHTML)
  printWindow.document.close()

  // Wait for content to load then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
      // Don't close — let user close after printing
    }, 500)
  }
}
