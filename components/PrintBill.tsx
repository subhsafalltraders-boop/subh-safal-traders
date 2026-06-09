import type { Bill, AppSetting } from '@/lib/types';
import { numberToWords } from '@/lib/numberToWords';

export default function PrintBill({ bill, appSetting, vendorType }: { bill: Bill | null, appSetting: AppSetting | null, vendorType?: string | null }) {
  if (!bill) return null;

  const isGST = vendorType === 'shopkeeper';

  const renderTemplateA_GST = (type: 'ORIGINAL' | 'DUPLICATE') => (
    <div className={`bill-${type.toLowerCase()}`}>
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: '4px' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, fontWeight: 'bold', border: '1px solid #000', padding: '2px 4px', fontSize: '10px' }}>
          {type}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold' }}>
          <span>GSTIN: {appSetting?.gst_number || '10BDBPM9273J1Z1'}</span>
          <span>MOB: 9122035642<br/>9431836502</span>
        </div>
        <div style={{ fontSize: '14px', fontWeight: 'bold', margin: '4px 0', textDecoration: 'underline' }}>Bill of Supply</div>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>{appSetting?.company_name || 'SUBH SAFAL TRADERS'}</h1>
        <div style={{ fontSize: '11px' }}>LAKSHMISAGAR, KOTWALI CHOWK, MADHUBANI</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '4px 0', marginBottom: '4px' }}>
        <div>
          <span style={{ fontWeight: 'bold' }}>M/S:</span> {bill.vendor_name}<br/>
          <span style={{ fontWeight: 'bold' }}>Address:</span> ___________________________
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: 'bold' }}>Invoice No.:</span> {bill.bill_number}<br/>
          <span style={{ fontWeight: 'bold' }}>Date:</span> {bill.date ? new Date(bill.date).toLocaleDateString('en-GB') : ''}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ border: '1px solid #000', padding: '2px', width: '5%', textAlign: 'center' }}>Sl. No.</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'left' }}>Product Description</th>
            <th style={{ border: '1px solid #000', padding: '2px', width: '10%', textAlign: 'center' }}>HSN Code</th>
            <th style={{ border: '1px solid #000', padding: '2px', width: '10%', textAlign: 'center' }}>Qnty.</th>
            <th style={{ border: '1px solid #000', padding: '2px', width: '10%', textAlign: 'right' }}>Rate</th>
            <th style={{ border: '1px solid #000', padding: '2px', width: '15%', textAlign: 'right' }}>Value of supply</th>
          </tr>
        </thead>
        <tbody>
          {(bill.items as any[])?.map((item, idx) => (
            <tr key={idx}>
              <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: '2px', textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ borderRight: '1px solid #000', padding: '2px' }}>{item.product_name}</td>
              <td style={{ borderRight: '1px solid #000', padding: '2px', textAlign: 'center' }}>{item.hsn_code || ''}</td>
              <td style={{ borderRight: '1px solid #000', padding: '2px', textAlign: 'center' }}>
                 {item.box_qty ? `${item.box_qty}B ` : ''}{item.piece_qty ? `${item.piece_qty}P` : ''}
              </td>
              <td style={{ borderRight: '1px solid #000', padding: '2px', textAlign: 'right' }}>{item.rate}</td>
              <td style={{ borderRight: '1px solid #000', padding: '2px', textAlign: 'right' }}>{item.total}</td>
            </tr>
          ))}
          {/* Fill empty rows to make table look consistent if needed, but flex takes care of it */}
          <tr>
            <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '2px' }}></td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px', fontWeight: 'bold' }}>
        <div style={{ width: '40%' }}>
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

      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        Rupees: {numberToWords(bill.grand_total)}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
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
    <div className={`bill-${type.toLowerCase()}`}>
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: '4px' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, fontWeight: 'bold', border: '1px solid #000', padding: '2px 4px', fontSize: '10px' }}>
          {type}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold' }}>
          <span>Estimate</span>
          <span>MOB: 9122035642<br/>9431836502</span>
        </div>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '4px 0 0 0' }}>{appSetting?.company_name || 'SUBH SAFAL TRADERS'}</h1>
        <div style={{ fontSize: '11px' }}>LAKSHMISAGAR, KOTWALI CHOWK, MADHUBANI</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '4px 0', marginBottom: '4px' }}>
        <div>
          <span style={{ fontWeight: 'bold' }}>M/S:</span> {bill.vendor_name}<br/>
          <span style={{ fontWeight: 'bold' }}>Address:</span> ___________________________
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: 'bold' }}>Invoice No.:</span> {bill.bill_number}<br/>
          <span style={{ fontWeight: 'bold' }}>Date:</span> {bill.date ? new Date(bill.date).toLocaleDateString('en-GB') : ''}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000' }}>
            <th style={{ border: '1px solid #000', padding: '2px', width: '5%', textAlign: 'center' }}>Sl. No.</th>
            <th style={{ border: '1px solid #000', padding: '2px', textAlign: 'left' }}>Product Description</th>
            <th style={{ border: '1px solid #000', padding: '2px', width: '10%', textAlign: 'center' }}>HSN Code</th>
            <th style={{ border: '1px solid #000', padding: '2px', width: '10%', textAlign: 'center' }}>Qnty.</th>
            <th style={{ border: '1px solid #000', padding: '2px', width: '10%', textAlign: 'right' }}>Rate</th>
            <th style={{ border: '1px solid #000', padding: '2px', width: '15%', textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(bill.items as any[])?.map((item, idx) => (
            <tr key={idx}>
              <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: '2px', textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ borderRight: '1px solid #000', padding: '2px' }}>{item.product_name}</td>
              <td style={{ borderRight: '1px solid #000', padding: '2px', textAlign: 'center' }}>{item.hsn_code || ''}</td>
              <td style={{ borderRight: '1px solid #000', padding: '2px', textAlign: 'center' }}>
                 {item.box_qty ? `${item.box_qty}B ` : ''}{item.piece_qty ? `${item.piece_qty}P` : ''}
              </td>
              <td style={{ borderRight: '1px solid #000', padding: '2px', textAlign: 'right' }}>{item.rate}</td>
              <td style={{ borderRight: '1px solid #000', padding: '2px', textAlign: 'right' }}>{item.total}</td>
            </tr>
          ))}
          <tr>
            <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '2px' }}></td>
            <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '2px' }}></td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px', fontWeight: 'bold' }}>
        <div style={{ width: '40%' }}>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '10px', marginTop: '16px' }}>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontWeight: 'bold' }}>For Authorised Signatory</span>
        </div>
      </div>
    </div>
  );

  return (
    <div id="print-bill" className="hidden print:block" style={{ boxSizing: 'border-box' }}>
      {isGST ? renderTemplateA_GST('ORIGINAL') : renderTemplateB_NON_GST('ORIGINAL')}
      
      <div className="cut-line">
        ---------------------------------- ✂ CUT HERE ✂ ----------------------------------
      </div>
      
      {isGST ? renderTemplateA_GST('DUPLICATE') : renderTemplateB_NON_GST('DUPLICATE')}
    </div>
  );
}
