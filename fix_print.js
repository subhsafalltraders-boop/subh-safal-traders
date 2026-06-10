const fs = require('fs');
const file = './lib/printUtils.ts';
let code = fs.readFileSync(file, 'utf8');

const newCode = `export function generateBillHTML(bill: Bill, appSetting: AppSetting | null, vendorType?: string | null): string {
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
      return \`
        <div style="font-size: 20px; font-weight: bold;">SUBH SAFAL TRADERS</div>
        <div style="font-size: 11px;">LAKSHMISAGAR, KOTWALI CHOWK, MADHUBANI</div>
      \`;
    }
    return \`
      <div style="font-size: 20px; font-weight: bold; text-transform: uppercase;">\${appSetting.company_name || 'SUBH SAFAL TRADERS'}</div>
      <div style="font-size: 11px; text-transform: uppercase;">\${appSetting.address || 'LAKSHMISAGAR, KOTWALI CHOWK, MADHUBANI'}</div>
    \`;
  };

  const generateItemsTable = (itemsToRender: any[], minRows: number, startIndex: number = 0) => {
    let rows = '';
    itemsToRender.forEach((item: any, idx: number) => {
      rows += \`
        <tr style="border-bottom: 1px dashed #ccc; line-height: 1.6;">
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: center;">\${startIndex + idx + 1}</td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc;">\${item.product_name}</td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: center;">\${item.box_qty || item.box_quantity || '-'}</td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: center;">\${item.pieces_per_box || '-'}</td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: right;">₹\${item.price_per_piece || '-'}</td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: right;">₹\${item.amount || item.total || '-'}</td>
          <td style="padding: 8px 10px; text-align: center;">
            <div style="width: 14px; height: 14px; border: 1.5px solid #000; margin: 0 auto;"></div>
          </td>
        </tr>
      \`;
    });
    
    // Add empty rows to maintain height
    const currentRows = itemsToRender.length;
    for (let i = currentRows; i < minRows; i++) {
      rows += \`
        <tr style="line-height: 1.6;">
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: center;">&nbsp;</td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 8px 10px; border-right: 1px dashed #ccc;"></td>
          <td style="padding: 8px 10px;"></td>
        </tr>
      \`;
    }

    return \`
      <div style="\${isLandscape ? 'flex: 1; overflow: hidden; max-height: 140mm;' : 'flex-grow: 1;'}">
        <table style="width: 100%; border-collapse: collapse; font-size: \${isLandscape ? '11px' : '13px'}; border: 1px solid #000;">
          <thead style="border-bottom: 1px solid #000; font-size: 12px; font-weight: bold;">
            <tr style="line-height: 1.6;">
              <th style="padding: 8px 10px; border-right: 1px dashed #ccc; width: 5%;">Sl.</th>
              <th style="padding: 8px 10px; border-right: 1px dashed #ccc; text-align: left;">Product Description</th>
              <th style="padding: 8px 10px; border-right: 1px dashed #ccc; width: 12%;">No. of Box</th>
              <th style="padding: 8px 10px; border-right: 1px dashed #ccc; width: 12%;">Pieces/Box</th>
              <th style="padding: 8px 10px; border-right: 1px dashed #ccc; width: 15%;">Rate</th>
              <th style="padding: 8px 10px; border-right: 1px dashed #ccc; width: 15%;">Amount</th>
              <th style="padding: 8px 10px; width: 8%;">✓</th>
            </tr>
          </thead>
          <tbody>
            \${rows}
          </tbody>
        </table>
      </div>
    \`;
  };

  const generateTotals = () => {
    let totalsHtml = \`<div style="font-size: 13px; margin-top: 5px; line-height: 1.6;">\`;
    
    if (isGST) {
      totalsHtml += \`
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>Subtotal:</span>
          <span>\${Number(bill.subtotal || 0).toFixed(2)}</span>
        </div>
        \${Number(bill.discount_amount || 0) > 0 ? \`
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>Discount:</span>
          <span>-\${Number(bill.discount_amount || 0).toFixed(2)}</span>
        </div>\` : ''}
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>Taxable:</span>
          <span>\${(Number(bill.subtotal || 0) - Number(bill.discount_amount || 0)).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>(-) GST (\${bill.gst_type || '0%'}):</span>
          <span>-\${Number(bill.gst_amount || 0).toFixed(2)}</span>
        </div>
      \`;
    } else {
      if (Number(bill.discount_amount || 0) > 0) {
        totalsHtml += \`
          <div style="display: flex; justify-content: space-between; padding: 2px 0;">
            <span>Subtotal:</span>
            <span>\${Number(bill.subtotal || 0).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 2px 0;">
            <span>Discount:</span>
            <span>-\${Number(bill.discount_amount || 0).toFixed(2)}</span>
          </div>
        \`;
      }
    }
    
    totalsHtml += \`
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-top: 1px solid #000; font-weight: bold; font-size: 16px;">
        <span>Grand Total:</span>
        <span>₹\${Number(bill.grand_total || 0).toLocaleString('en-IN')}</span>
      </div>
    </div>\`;
    
    return totalsHtml;
  };

  const generateFooter = () => \`
    <div style="margin-top: 15px; text-align: center; font-size: 11px;">
      <div style="border-top: 1px dashed #ccc; width: 50%; margin: 0 auto 5px;"></div>
      <div>Thank you for shopping with us!</div>
    </div>
    <div class="fold-section" style="margin-top: 16px; padding-top: 12px; font-family: Arial, sans-serif;">
      <div class="fold-title" style="font-size: 13px; font-weight: bold; text-align: center; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 1px solid #000; padding-bottom: 6px;">
        MONEY RECEIVED
      </div>
      <div class="fold-field" style="font-size: 12px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center;">
        Total Cash Received <div class="fold-line" style="flex: 1; border-bottom: 1px solid #000; margin-left: 8px; height: 16px;"></div>
      </div>
      <div class="fold-field" style="font-size: 12px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center;">
        Total Online Received <div class="fold-line" style="flex: 1; border-bottom: 1px solid #000; margin-left: 8px; height: 16px;"></div>
      </div>
      <div class="fold-field" style="font-size: 12px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center;">
        Total Amount <div class="fold-line" style="flex: 1; border-bottom: 1px solid #000; margin-left: 8px; height: 16px;"></div>
      </div>
    </div>
  \`;

  const pageStyle = isLandscape 
    ? \`@page { size: A4 landscape; margin: 6mm; }\`
    : \`@page { size: A4 portrait; margin: 8mm; }\`;

  const commonHtmlTop = \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <title>Bill - \${bill.bill_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; }
    
    @media print {
      \${pageStyle}
      
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
\`;

  const printButtons = \`
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
  \`;

  if (isLandscape) {
    const generateCopy = (copyType: string) => \`
      <div style="position: relative; height: 190mm; overflow: hidden; display: flex; flex-direction: column; padding: 10px; box-sizing: border-box;">
        
        <div style="text-align: center; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 5px;">
            <div>GSTIN: \${appSetting?.gstin || '10BDBPM9273J1Z1'}</div>
            <div>MOB: \${appSetting?.phone || '9122035642<br/>9431836502'}</div>
          </div>
          <div style="font-size: 13px; font-weight: bold; margin-bottom: 2px;">
            \${isGST ? 'Bill of Supply' : 'Estimate'}
          </div>
          \${getCompanyDetails()}
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 5px;">
          <div>
            <div>Invoice No.: <b>\${bill.bill_number || ''}</b></div>
            <div style="margin-top: 4px;">M/S: <b style="font-size: 14px;">\${(bill as any).vendors?.name || bill.vendor_name || ''}</b></div>
          </div>
          <div style="text-align: right;">
            <div>Date: <b>\${formatDate(bill.date)}</b></div>
          </div>
        </div>

        \${generateItemsTable(bill.items || [], 8, 0)}

        <div style="flex-shrink: 0; margin-top: auto;">
          <div style="margin-top: 10px; width: 60%; margin-left: auto;">
            \${generateTotals()}
          </div>
          \${generateFooter()}
        </div>
      </div>
    \`;

    return \`
      \${commonHtmlTop}
      <div style="display: flex; width: 100%; height: 100vh;">
        <div style="width: 49%; border-right: 1px dashed #000;">
          \${generateCopy('ORIGINAL')}
        </div>
        <div style="width: 49%; margin-left: 2%;">
          \${generateCopy('DUPLICATE')}
        </div>
      </div>
      \${printButtons}
    \`;
  } else {
    const items = bill.items || [];
    const itemsPerPage = 15;
    const itemChunks: any[][] = [];
    for (let i = 0; i < items.length; i += itemsPerPage) {
      itemChunks.push(items.slice(i, i + itemsPerPage));
    }

    const generatePortraitPages = (copyType: string) => {
      let html = '';
      itemChunks.forEach((chunkItems, pageIndex) => {
        const isLastPage = pageIndex === itemChunks.length - 1;
        const pageNumber = pageIndex + 1;
        const totalPages = itemChunks.length;
        const startIndex = pageIndex * itemsPerPage;
        
        html += \`
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
              <div>GSTIN: \${appSetting?.gstin || '10BDBPM9273J1Z1'}</div>
              <div>MOB: \${appSetting?.phone || '9122035642<br/>9431836502'}</div>
            </div>
            <div style="position: absolute; right: 0; top: 0; font-size: 10px;">Page \${pageNumber} of \${totalPages}</div>
            <div style="font-size: 13px; font-weight: bold; margin-bottom: 2px;">
              \${isGST ? 'Bill of Supply' : 'Estimate'}
            </div>
            \${getCompanyDetails()}
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 5px;">
            <div>
              <div>Invoice No.: <b>\${bill.bill_number || ''}</b></div>
              <div style="margin-top: 4px;">M/S: <b style="font-size: 14px;">\${(bill as any).vendors?.name || bill.vendor_name || ''}</b></div>
            </div>
            <div style="text-align: right;">
              <div>Date: <b>\${formatDate(bill.date)}</b></div>
              \${pageIndex === 0 ? \`<div style="margin-top: 4px; font-weight: bold; padding: 2px 6px; border: 1px solid #000; display: inline-block;">\${copyType}</div>\` : ''}
            </div>
          </div>

          \${generateItemsTable(chunkItems, isLastPage ? Math.max(8, chunkItems.length) : itemsPerPage, startIndex)}

          \${isLastPage ? \`
            <div style="flex-shrink: 0; margin-top: auto;">
              <div style="margin-top: 10px; width: 60%; margin-left: auto;">
                \${generateTotals()}
              </div>
              \${generateFooter()}
            </div>
          \` : \`
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
          \`}
        </div>
        \`;
      });
      return html;
    };

    return \`
      \${commonHtmlTop}
      \${generatePortraitPages('ORIGINAL')}
      \${generatePortraitPages('DUPLICATE')}
      \${printButtons}
    \`;
  }
}`;

const startIndex = code.indexOf('export function generateBillHTML');
if (startIndex !== -1) {
  const finalCode = code.substring(0, startIndex) + newCode + '\n';
  fs.writeFileSync(file, finalCode);
  console.log('Successfully updated printUtils.ts');
} else {
  console.error('Could not find generateBillHTML in printUtils.ts');
}
