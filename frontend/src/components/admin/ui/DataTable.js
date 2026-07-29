// Tek tip veri tablosu. columns: [{ key, label, align?, width?, render?(row) }].
// Kart içinde flush kullanılmak üzere tasarlandı (kendi kenarlığı yok).

export default function DataTable({ columns, rows, rowKey, empty = "Kayıt yok.", className = "" }) {
  const align = (a) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] text-gray-600 uppercase tracking-wider border-b border-edge/60">
            {columns.map((c) => (
              <th key={c.key} className={`font-medium px-5 py-2.5 ${align(c.align)}`} style={c.width ? { width: c.width } : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-edge/30">
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-5 py-8 text-center text-xs text-gray-600">{empty}</td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row, i) : i} className="hover:bg-hover transition-colors">
              {columns.map((c) => (
                <td key={c.key} className={`px-5 py-3 ${align(c.align)}`}>
                  {c.render ? c.render(row, i) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
