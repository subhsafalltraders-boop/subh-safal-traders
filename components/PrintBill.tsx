import React from 'react';
import type { Bill, AppSetting } from '@/lib/types';
import { numberToWords } from '@/lib/numberToWords';

export default function PrintBill({ bill, appSetting, vendorType }: { bill: Bill | null, appSetting: AppSetting | null, vendorType?: string | null }) {
  if (!bill) return null;

  const isGST = bill.bill_type ? bill.bill_type === 'gst' : vendorType === 'shopkeeper';
  const itemCount = (bill.items || []).length;
  const isLandscape = itemCount <= 12;

  // Landscape specific font sizes
  const fsCompany = isLandscape ? '13px' : '18px';
  const fsHeaderInfo = isLandscape ? '8px' : '10px';
  const fsInvoiceDate = isLandscape ? '9px' : '10px';
  const fsMS = isLandscape ? '9px' : '11px';
  const fsTable = isLandscape ? '10px' : '11px';
  const fsTotals = isLandscape ? '10px' : '11px';
  const fsFooter = isLandscape ? '8px' : '10px';

  const renderTemplateA_GST = (type: 'ORIGINAL' | 'DUPLICATE') => (
    <div style={{ width: isLandscape ? '49%' : '100%', boxSizing: 'border-box' }}>
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: isLandscape ? '2px' : '4px' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, fontWeight: 'bold', border: '1px solid #000', padding: '2px 4px', fontSize: '10px' }}>
          {type}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fsHeaderInfo, fontWeight: 'bold' }}>
          <span>GSTIN: {appSetting?.gst_number || '10BDBPM9273J1Z1'}</span>
          <span style={{ textAlign: 'right' }}>MOB: 9122035642{isLandscape ? ' / ' : <br/>}9431836502</span>
        </div>
        <div style={{ fontSize: isLandscape ? '12px' : '14px', fontWeight: 'bold', margin: isLandscape ? '2px 0' : '4px 0', textDecoration: 'underline' }}>Bill of Supply</div>
        <h1 style={{ fontSize: fsCompany, fontWeight: 'bold', margin: 0 }}>{appSetting?.company_name || 'SUBH SAFAL TRADERS'}</h1>
        <div style={{ fontSize: fsHeaderInfo }}>LAKSHMISAGAR, KOTWALI CHOWK, MADHUBANI</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: isLandscape ? '2px 0' : '4px 0', marginBottom: isLandscape ? '2px' : '4px', fontSize: fsMS }}>
        <div>
          <span style={{ fontWeight: 'bold' }}>M/S:</span> {bill.vendor_name}<br/>
          <span style={{ fontWeight: 'bold' }}>Address:</span> ___________________________
        </div>
        <div style={{ textAlign: 'right', fontSize: fsInvoiceDate }}>
          <span style={{ fontWeight: 'bold' }}>Invoice No.:</span> {bill.bill_number}<br/>
          <span style={{ fontWeight: 'bold' }}>Date:</span> {bill.date ? new Date(bill.date).toLocaleDateString('en-GB') : ''}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: isLandscape ? '2px' : '4px', fontSize: fsTable }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', width: '5%', textAlign: 'center' }}>Sl.</th>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'left' }}>Product Description</th>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', width: '10%', textAlign: 'center' }}>HSN</th>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', width: '10%', textAlign: 'center' }}>Qnty.</th>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', width: '10%', textAlign: 'right' }}>Rate</th>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', width: '15%', textAlign: 'right' }}>Amount</th>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', width: '20px', textAlign: 'center' }}>✓</th>
          </tr>
        </thead>
        <tbody>
          {(bill.items as any[])?.map((item, idx) => (
            <tr key={idx}>
              <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}>{item.product_name}</td>
              <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'center' }}>{item.hsn_code || ''}</td>
              <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'center' }}>
                 {item.box_qty ? `${item.box_qty}B ` : ''}{item.piece_qty ? `${item.piece_qty}P` : ''}
              </td>
              <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'right' }}>{item.rate}</td>
              <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'right' }}>{item.total}</td>
              <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'center' }}>
                <div className="tick-box"></div>
              </td>
            </tr>
          ))}
          <tr style={{ borderBottom: '1px solid #000' }}>
            <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: isLandscape ? '2px' : '4px', fontWeight: 'bold', fontSize: fsTotals }}>
        <div style={{ width: '50%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total:</span>
            <span>₹{bill.subtotal}</span>
          </div>
          {bill.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Less Discount:</span>
              <span>-₹{bill.discount_amount}</span>
            </div>
          )}
          {bill.gst_amount > 0 && (
             <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <span>GST:</span>
               <span>+₹{bill.gst_amount}</span>
             </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', marginTop: '2px', paddingTop: '2px' }}>
            <span>Net value of supply:</span>
            <span>₹{bill.grand_total}</span>
          </div>
        </div>
      </div>

      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: fsTotals }}>
        Rupees: {numberToWords(bill.grand_total)}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fsFooter }}>
        <div>
          <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>Terms & Conditions:</span><br/>
          1. Goods once sold can't be taken back<br/>
          2. All disputes subject to Madhubani Jurisdiction<br/>
          3. Check goods at time of delivery
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 'bold' }}>E.& O.E.</span>
          <span style={{ marginTop: '24px', fontWeight: 'bold' }}>For Authorised Signatory</span>
        </div>
      </div>
    </div>
  );

  const renderTemplateB_NON_GST = (type: 'ORIGINAL' | 'DUPLICATE') => (
    <div style={{ width: isLandscape ? '49%' : '100%', boxSizing: 'border-box' }}>
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: isLandscape ? '2px' : '4px' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, fontWeight: 'bold', border: '1px solid #000', padding: '2px 4px', fontSize: '10px' }}>
          {type}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fsHeaderInfo, fontWeight: 'bold' }}>
          <span>Estimate</span>
          <span style={{ textAlign: 'right' }}>MOB: 9122035642{isLandscape ? ' / ' : <br/>}9431836502</span>
        </div>
        <h1 style={{ fontSize: fsCompany, fontWeight: 'bold', margin: '4px 0 0 0' }}>{appSetting?.company_name || 'SUBH SAFAL TRADERS'}</h1>
        <div style={{ fontSize: fsHeaderInfo }}>LAKSHMISAGAR, KOTWALI CHOWK, MADHUBANI</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: isLandscape ? '2px 0' : '4px 0', marginBottom: isLandscape ? '2px' : '4px', fontSize: fsMS }}>
        <div>
          <span style={{ fontWeight: 'bold' }}>M/S:</span> {bill.vendor_name}<br/>
          <span style={{ fontWeight: 'bold' }}>Address:</span> ___________________________
        </div>
        <div style={{ textAlign: 'right', fontSize: fsInvoiceDate }}>
          <span style={{ fontWeight: 'bold' }}>Invoice No.:</span> {bill.bill_number}<br/>
          <span style={{ fontWeight: 'bold' }}>Date:</span> {bill.date ? new Date(bill.date).toLocaleDateString('en-GB') : ''}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: isLandscape ? '2px' : '4px', fontSize: fsTable }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', width: '5%', textAlign: 'center' }}>Sl.</th>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'left' }}>Product Description</th>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', width: '10%', textAlign: 'center' }}>HSN</th>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', width: '10%', textAlign: 'center' }}>Qnty.</th>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', width: '10%', textAlign: 'right' }}>Rate</th>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', width: '15%', textAlign: 'right' }}>Amount</th>
            <th style={{ border: '1px solid #000', padding: isLandscape ? '1px' : '2px', width: '20px', textAlign: 'center' }}>✓</th>
          </tr>
        </thead>
        <tbody>
          {(bill.items as any[])?.map((item, idx) => (
            <tr key={idx}>
              <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}>{item.product_name}</td>
              <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'center' }}>{item.hsn_code || ''}</td>
              <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'center' }}>
                 {item.box_qty ? `${item.box_qty}B ` : ''}{item.piece_qty ? `${item.piece_qty}P` : ''}
              </td>
              <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'right' }}>{item.rate}</td>
              <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'right' }}>{item.total}</td>
              <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px', textAlign: 'center' }}>
                <div className="tick-box"></div>
              </td>
            </tr>
          ))}
          <tr style={{ borderBottom: '1px solid #000' }}>
            <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', padding: isLandscape ? '1px' : '2px' }}></td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: isLandscape ? '2px' : '4px', fontWeight: 'bold', fontSize: fsTotals }}>
        <div style={{ width: '50%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total:</span>
            <span>₹{bill.subtotal}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', marginTop: '2px', paddingTop: '2px' }}>
            <span>Net value:</span>
            <span>₹{bill.grand_total}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: fsFooter, marginTop: '16px' }}>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: 'bold' }}>For Authorised Signatory</span>
        </div>
      </div>
    </div>
  );

  return (
    <div id="print-bill-container" style={{ 
      backgroundColor: 'white', 
      color: 'black', 
      fontFamily: 'Arial, sans-serif',
      boxSizing: 'border-box',
      width: isLandscape ? '297mm' : '210mm',
      margin: '0 auto',
      padding: isLandscape ? '3mm' : '8mm',
    }}>
      <style dangerouslySetInnerHTML={{__html: `
        .tick-box {
          width: 14px;
          height: 14px;
          border: 1.5px solid #000;
          display: inline-block;
          margin: auto;
        }
        .fold-line {
          border-top: 2px dashed #000;
          text-align: center;
          font-size: 9px;
          letter-spacing: 3px;
          margin-bottom: 16px;
          padding-top: 3px;
        }
        .back-field {
          margin-bottom: 18px;
          font-weight: bold;
          font-size: 12px;
        }
        .back-field span {
          display: inline-block;
          width: 200px;
          border-bottom: 1px solid #000;
          margin-left: 8px;
        }
        @media print {
          @page {
            size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
            margin: ${isLandscape ? '3mm' : '8mm'};
          }
          body * { visibility: hidden; }
          #print-bill-root, #print-bill-root * { visibility: visible; }
          #print-bill-root {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
          .page-break { page-break-before: always; }
        }
      `}} />

      <div id="print-bill-root">
        {isLandscape ? (
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
            {isGST ? renderTemplateA_GST('ORIGINAL') : renderTemplateB_NON_GST('ORIGINAL')}
            <div style={{ borderLeft: '2px dashed #000', margin: '0 1%' }}></div>
            {isGST ? renderTemplateA_GST('DUPLICATE') : renderTemplateB_NON_GST('DUPLICATE')}
          </div>
        ) : (
          <div>
            {isGST ? renderTemplateA_GST('ORIGINAL') : renderTemplateB_NON_GST('ORIGINAL')}
            <div className="page-break"></div>
            {isGST ? renderTemplateA_GST('DUPLICATE') : renderTemplateB_NON_GST('DUPLICATE')}
          </div>
        )}

        <div style={{ marginTop: '30px' }}>
          <div className="fold-line">F O L D &nbsp; H E R E</div>
          <div className="back-field">Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <span></span></div>
          <div className="back-field">Total Cash &nbsp;&nbsp;&nbsp;: <span></span></div>
          <div className="back-field">Total Online : <span></span></div>
        </div>
      </div>
    </div>
  );
}
