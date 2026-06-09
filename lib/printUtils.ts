import { Bill, AppSetting } from './types';

export function generateBillHTML(bill: Bill, appSetting: AppSetting | null, vendorType?: string | null): string {
  const isGST = bill.bill_type ? bill.bill_type === 'gst' : vendorType === 'shopkeeper';
  const itemCount = (bill.items || []).length;
  const isLandscape = itemCount <= 12;

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
        <div style="font-size: 13px; font-weight: bold;">SUBH SAFAL TRADERS</div>
        <div style="font-size: 8px;">LAKSHMISAGAR, KOTWALI CHOWK, MADHUBANI</div>
      `;
    }
    return `
      <div style="font-size: 13px; font-weight: bold; text-transform: uppercase;">${appSetting.company_name}</div>
      <div style="font-size: 8px; text-transform: uppercase;">${appSetting.address}</div>
    `;
  };

  const generateItemsTable = () => {
    let rows = '';
    (bill.items || []).forEach((item: any, idx: number) => {
      rows += `
        <tr style="border-bottom: 1px dashed #ccc;">
          <td style="padding: 2px 4px; border-right: 1px dashed #ccc; text-align: center;">${idx + 1}</td>
          <td style="padding: 2px 4px; border-right: 1px dashed #ccc;">${item.product_name}</td>
          ${isGST ? `<td style="padding: 2px 4px; border-right: 1px dashed #ccc; text-align: center;">${item.hsn_code || '-'}</td>` : ''}
          <td style="padding: 2px 4px; border-right: 1px dashed #ccc; text-align: center;">${item.quantity} ${item.unit === 'box' ? 'B' : 'P'}</td>
          <td style="padding: 2px 4px; border-right: 1px dashed #ccc; text-align: right;">${Number(item.rate).toFixed(2)}</td>
          <td style="padding: 2px 4px; border-right: 1px dashed #ccc; text-align: right;">${Number(item.amount).toFixed(2)}</td>
          <td style="padding: 2px 4px; text-align: center;">
            <div style="width: 14px; height: 14px; border: 1.5px solid #000; margin: 0 auto;"></div>
          </td>
        </tr>
      `;
    });
    
    // Add empty rows to maintain height
    const minRows = 8;
    const currentRows = (bill.items || []).length;
    for (let i = currentRows; i < minRows; i++) {
      rows += `
        <tr>
          <td style="padding: 2px 4px; border-right: 1px dashed #ccc; text-align: center;">&nbsp;</td>
          <td style="padding: 2px 4px; border-right: 1px dashed #ccc;"></td>
          ${isGST ? `<td style="padding: 2px 4px; border-right: 1px dashed #ccc;"></td>` : ''}
          <td style="padding: 2px 4px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 2px 4px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 2px 4px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 2px 4px;"></td>
        </tr>
      `;
    }

    return `
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #000;">
        <thead style="border-bottom: 1px solid #000;">
          <tr>
            <th style="padding: 4px; border-right: 1px dashed #ccc; width: 5%;">Sl.</th>
            <th style="padding: 4px; border-right: 1px dashed #ccc; text-align: left;">Product</th>
            ${isGST ? `<th style="padding: 4px; border-right: 1px dashed #ccc; width: 12%;">HSN</th>` : ''}
            <th style="padding: 4px; border-right: 1px dashed #ccc; width: 12%;">Qty</th>
            <th style="padding: 4px; border-right: 1px dashed #ccc; width: 15%;">Rate</th>
            <th style="padding: 4px; border-right: 1px dashed #ccc; width: 15%;">Amount</th>
            <th style="padding: 4px; width: 8%;"></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  };

  const generateTotals = () => {
    let totalsHtml = `<div style="font-size: 10px; margin-top: 5px;">`;
    
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
          <span>GST (${bill.gst_type || '0%'}):</span>
          <span>+${Number(bill.gst_amount || 0).toFixed(2)}</span>
        </div>
      `;
    } else {
      if (Number(bill.discount_amount || 0) > 0) {
        totalsHtml += `
          <div style="display: flex; justify-content: space-between; padding: 2px 0;">
            <span>Subtotal:</span>
            <span>${Number(bill.subtotal || 0).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 2px 0;">
            <span>Discount:</span>
            <span>-${Number(bill.discount_amount || 0).toFixed(2)}</span>
          </div>
        `;
      }
    }
    
    totalsHtml += `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-top: 1px solid #000; font-weight: bold; font-size: 11px;">
        <span>Grand Total:</span>
        <span>₹${Number(bill.grand_total || 0).toLocaleString('en-IN')}</span>
      </div>
    </div>`;
    
    return totalsHtml;
  };

  const generateFooter = () => `
    <div style="margin-top: 15px; text-align: center; font-size: 8px;">
      <div style="border-top: 1px dashed #ccc; width: 50%; margin: 0 auto 5px;"></div>
      <div>Thank you for your business!</div>
    </div>
    <div style="margin-top: 20px; font-size: 10px;">
      <div style="text-align: center; margin-bottom: 5px;">─ ─ ─ ─ FOLD HERE ─ ─ ─ ─</div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div>Date&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: _______________</div>
        <div>Total Cash&nbsp;&nbsp;&nbsp;&nbsp;: _______________</div>
        <div>Total Online&nbsp;&nbsp;: _______________</div>
      </div>
    </div>
  `;

  const generateCopy = (copyType: string) => `
    <div style="position: relative; height: 100%; display: flex; flex-direction: column; padding: 10px; box-sizing: border-box;">
      <div style="position: absolute; top: 10px; right: 10px; border: 1px solid #000; padding: 2px 8px; font-size: 10px; font-weight: bold; border-radius: 4px;">
        ${copyType}
      </div>
      
      <div style="text-align: center; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; font-size: 8px; margin-bottom: 5px;">
          <div>GSTIN: ${appSetting?.gstin || '10BDBPM9273J1Z1'}</div>
          <div>MOB: ${appSetting?.phone || '9122035642<br/>9431836502'}</div>
        </div>
        <div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">
          ${isGST ? 'Bill of Supply' : 'Estimate'}
        </div>
        ${getCompanyDetails()}
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 5px;">
        <div>
          <div>Invoice No.: <b>${bill.bill_number}</b></div>
          <div style="margin-top: 4px;">M/S: <b>${(bill as any).vendors?.name || bill.vendor_name || 'Cash'}</b></div>
        </div>
        <div style="text-align: right;">
          <div>Date: <b>${formatDate(bill.date)}</b></div>
        </div>
      </div>

      <div style="flex-grow: 1;">
        ${generateItemsTable()}
      </div>

      <div style="margin-top: 10px; width: 60%; margin-left: auto;">
        ${generateTotals()}
      </div>

      ${generateFooter()}
    </div>
  `;

  const pageStyle = isLandscape 
    ? `@page { size: A4 landscape; margin: 6mm; }`
    : `@page { size: A4 portrait; margin: 8mm; }`;

  if (isLandscape) {
    return `
      <style>
        ${pageStyle}
        body { margin: 0; padding: 0; font-family: sans-serif; }
        * { box-sizing: border-box; }
      </style>
      <div style="display: flex; width: 100%; height: 100vh;">
        <div style="width: 49%; border-right: 1px dashed #000;">
          ${generateCopy('ORIGINAL')}
        </div>
        <div style="width: 49%; margin-left: 2%;">
          ${generateCopy('DUPLICATE')}
        </div>
      </div>
    `;
  } else {
    return `
      <style>
        ${pageStyle}
        body { margin: 0; padding: 0; font-family: sans-serif; }
        * { box-sizing: border-box; }
        .page-break { page-break-before: always; }
      </style>
      <div style="width: 100%; min-height: 100vh;">
        ${generateCopy('ORIGINAL')}
      </div>
      <div class="page-break"></div>
      <div style="width: 100%; min-height: 100vh;">
        ${generateCopy('DUPLICATE')}
      </div>
    `;
  }
}
