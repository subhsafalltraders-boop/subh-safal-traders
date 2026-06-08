import type { Bill, AppSetting } from '@/lib/types';

export default function PrintBill({ bill, appSetting }: { bill: Bill | null, appSetting: AppSetting | null }) {
  if (!bill) return null;

  const renderHalf = (type: 'ORIGINAL' | 'DUPLICATE') => (
    <div className={`flex flex-col h-[48%] page-break-inside-avoid ${type === 'DUPLICATE' ? 'mt-[4%]' : ''}`}>
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold uppercase tracking-wider">{appSetting?.company_name || 'SUBH SAFAL TRADERS'}</h1>
        <p className="text-sm text-gray-600">GSTIN: {appSetting?.gst_number || 'N/A'}</p>
        <p className="text-sm font-bold border-y border-black py-1 my-2">
          {type === 'ORIGINAL' ? 'ORIGINAL' : 'DUPLICATE'}
        </p>
      </div>
      
      <div className="flex justify-between mb-4 border-b-2 border-black pb-2">
        <div>
          <p><span className="font-semibold text-lg">Billed To:</span> {bill.vendor_name || 'Unknown'}</p>
        </div>
        <div className="text-right">
          <p><span className="font-semibold">Bill No:</span> {bill.bill_number}</p>
          <p><span className="font-semibold">Date:</span> {bill.date}</p>
        </div>
      </div>

      <table className="w-full text-left border-collapse mb-4 flex-1">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-2 font-semibold w-1/2">Product Description</th>
            <th className="py-2 text-center font-semibold">Qty (B/P)</th>
            <th className="py-2 text-right font-semibold">Rate</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(bill.items as any[])?.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-300 text-sm">
              <td className="py-2">{item.product_name}</td>
              <td className="py-2 text-center">
                {item.box_qty ? `${item.box_qty}B ` : ''}{item.piece_qty ? `${item.piece_qty}P` : ''}
              </td>
              <td className="py-2 text-right">₹{Number(item.rate).toLocaleString('en-IN')}</td>
              <td className="py-2 text-right">₹{Number(item.total).toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end w-full border-t-2 border-black pt-2">
        <div className="w-1/2">
          <div className="flex justify-between py-1 text-sm"><span className="font-semibold">Subtotal:</span> <span>₹{Number(bill.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
          {Number(bill.discount_amount || 0) > 0 && (
            <div className="flex justify-between py-1 text-sm"><span className="font-semibold">Discount ({bill.discount_type || ''}):</span> <span>-₹{Number(bill.discount_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
          )}
          {Number(bill.gst_amount || 0) > 0 && (
            <div className="flex justify-between py-1 text-sm"><span className="font-semibold">GST ({bill.gst_type || ''}):</span> <span>+₹{Number(bill.gst_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
          )}
          <div className="flex justify-between py-2 text-xl font-bold border-t border-black mt-1"><span>TOTAL:</span> <span>₹{Number(bill.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
        </div>
      </div>
      
      <div className="mt-4 text-sm text-gray-500 italic text-center">Thank you for your business!</div>
    </div>
  );

  return (
    <div id="print-bill" className="hidden print:flex flex-col w-full h-screen bg-white text-black p-8 font-sans absolute top-0 left-0 bg-white z-50">
      {renderHalf('ORIGINAL')}
      <div className="w-full border-t-2 border-dashed border-black my-4 text-center text-xs relative">
        <span className="bg-white px-2 absolute -top-2 left-1/2 -translate-x-1/2 text-gray-400 font-mono tracking-widest">✂ CUT HERE ✂</span>
      </div>
      {renderHalf('DUPLICATE')}
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          #print-bill, #print-bill * { visibility: visible; }
          #print-bill { 
            position: absolute; 
            top: 0; left: 0; 
            width: 100%;
          }
        }
      `}} />
    </div>
  );
}
