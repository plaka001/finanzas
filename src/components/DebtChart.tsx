import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCOP } from '../lib/format'
import type { DebtSeriesPoint } from '../lib/debtSeries'

/** Línea de saldo total de deuda: histórico sólido + proyección punteada a cero. */
export default function DebtChart({ data }: { data: DebtSeriesPoint[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#71717a' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={[0, 'dataMax']} />
          <Tooltip
            formatter={(value, name) => [
              formatCOP(Number(value)),
              name === 'real' ? 'Saldo' : 'Proyección',
            ]}
            contentStyle={{
              backgroundColor: '#131a20',
              border: 'none',
              borderRadius: 12,
              fontSize: 12,
              color: '#e4e4e7',
            }}
          />
          <Line
            type="monotone"
            dataKey="real"
            stroke="#fb7185"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="proyeccion"
            stroke="#34d399"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
