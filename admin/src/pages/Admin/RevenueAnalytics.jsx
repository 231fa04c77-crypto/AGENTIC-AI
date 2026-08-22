import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import LineChart from '../../components/charts/LineChart'
import BarChart from '../../components/charts/BarChart'
import AnimatedCounter from '../../components/ui/AnimatedCounter'
import { DeskPage, DeskHeader, DeskCard } from '../../components/desk/DeskChrome'

const PERIODS = [
  { id: 'today', label: 'Today', short: '24h' },
  { id: 'days15', label: '15 Days', short: '15d' },
  { id: 'monthly', label: 'This Month', short: 'Mo' },
  { id: 'monthWise', label: 'By Month', short: 'YTD' },
  { id: 'yearWise', label: 'By Year', short: 'Yr' },
]

const fmtInr = (n) =>
  Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

const SparkBars = ({ values = [], color = '#059669' }) => {
  const max = Math.max(...values.map(Number), 1)
  const slice = values.length > 48 ? values.filter((_, i) => i % Math.ceil(values.length / 40) === 0) : values
  return (
    <div className='flex items-end gap-[3px] h-10 w-full' aria-hidden>
      {slice.map((v, i) => {
        const h = Math.max(4, Math.round((Number(v) / max) * 40))
        return (
          <div
            key={i}
            className='flex-1 min-w-[2px] rounded-t-sm opacity-80 transition-all duration-500'
            style={{
              height: `${h}px`,
              background: `linear-gradient(180deg, ${color} 0%, ${color}55 100%)`,
            }}
          />
        )
      })}
    </div>
  )
}

const RevenueAnalytics = () => {
  const { getRevenueAnalytics, revenueData } = useContext(AdminContext)
  const [loading, setLoading] = useState(true)
  const [selectedOption, setSelectedOption] = useState('today')
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    await getRevenueAnalytics()
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 60000)
    return () => clearInterval(id)
  }, [])

  const currentChartData = revenueData?.[selectedOption] || { labels: [], values: [], total: 0 }
  const values = currentChartData.values || []
  const labels = currentChartData.labels || []

  const insights = useMemo(() => {
    const nums = values.map(Number)
    const total = Number(currentChartData.total || nums.reduce((a, b) => a + b, 0))
    let peakIdx = 0
    nums.forEach((v, i) => {
      if (v > nums[peakIdx]) peakIdx = i
    })
    const active = nums.filter((v) => v > 0).length
    const avg = active ? total / active : 0
    return {
      total,
      peakLabel: labels[peakIdx] || '—',
      peakValue: nums[peakIdx] || 0,
      avg,
      active,
      buckets: nums.length,
    }
  }, [currentChartData, values, labels])

  const periodMeta = PERIODS.find((p) => p.id === selectedOption)

  if (loading || !revenueData) {
    return (
      <DeskPage>
        <div className='flex flex-col items-center justify-center min-h-[50vh] gap-3'>
          <div className='relative w-12 h-12'>
            <div className='absolute inset-0 rounded-full border-2 border-emerald-200' />
            <div className='absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-600 animate-spin' />
          </div>
          <p className='text-sm font-medium text-rd-muted'>Loading revenue pulse…</p>
        </div>
      </DeskPage>
    )
  }

  const useBars = ['monthWise', 'yearWise'].includes(selectedOption)

  return (
    <DeskPage className='relative overflow-hidden'>
      {/* soft atmosphere — not a flat wash */}
      <div
        className='pointer-events-none absolute -top-24 -right-16 w-[420px] h-[420px] rounded-full opacity-[0.12] blur-3xl'
        style={{ background: 'radial-gradient(circle, #059669 0%, transparent 70%)' }}
      />
      <div
        className='pointer-events-none absolute top-40 -left-20 w-[320px] h-[320px] rounded-full opacity-[0.08] blur-3xl'
        style={{ background: 'radial-gradient(circle, #0ea5e9 0%, transparent 70%)' }}
      />

      <DeskHeader
        title='Revenue Hub'
        subtitle='Live collections across the network — pick a window, read the pulse.'
        right={
          <button
            type='button'
            onClick={() => load(true)}
            disabled={refreshing}
            className='inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold border border-rd-border bg-rd-surface text-rd-text hover:bg-slate-50 disabled:opacity-50 transition-colors'
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
              />
            </svg>
            Refresh
          </button>
        }
      />

      {/* Hero total */}
      <DeskCard className='relative overflow-hidden p-0'>
        <div
          className='absolute inset-0 opacity-[0.97]'
          style={{
            background:
              'linear-gradient(135deg, #0b1f17 0%, #0f2f24 42%, #134e3a 78%, #0c4a6e 100%)',
          }}
        />
        <div
          className='absolute inset-0 opacity-[0.15]'
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #34d399 0%, transparent 40%), radial-gradient(circle at 85% 10%, #38bdf8 0%, transparent 35%)',
          }}
        />
        <div
          className='absolute inset-0 opacity-[0.06]'
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className='relative z-10 p-5 sm:p-7 flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-10'>
          <div className='flex-1 min-w-0'>
            <div className='inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-2.5 py-1 mb-3'>
              <span className='relative flex h-2 w-2'>
                <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75' />
                <span className='relative inline-flex rounded-full h-2 w-2 bg-emerald-400' />
              </span>
              <span className='text-[10px] font-bold tracking-[0.18em] uppercase text-emerald-200'>
                Live · {periodMeta?.label}
              </span>
            </div>
            <p className='text-sm text-emerald-100/70 font-medium mb-1'>Gross collections</p>
            <p className='text-4xl sm:text-5xl font-bold text-white tracking-tight tabular-nums leading-none'>
              <span className='text-2xl sm:text-3xl font-semibold text-emerald-200/90 mr-1'>₹</span>
              <AnimatedCounter value={insights.total} />
            </p>
            <p className='mt-3 text-xs text-white/50 max-w-md'>
              Aggregated from completed appointment fees for the selected window.
            </p>
          </div>

          <div className='w-full lg:w-[280px] shrink-0'>
            <p className='text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2'>
              Distribution sketch
            </p>
            <div className='rounded-2xl bg-black/25 border border-white/10 px-3 pt-3 pb-2 backdrop-blur-sm'>
              <SparkBars values={values} color='#34d399' />
            </div>
          </div>
        </div>
      </DeskCard>

      {/* Period pills */}
      <div className='flex flex-wrap gap-2'>
        {PERIODS.map((p) => {
          const active = selectedOption === p.id
          return (
            <button
              key={p.id}
              type='button'
              onClick={() => setSelectedOption(p.id)}
              className={`group relative overflow-hidden rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 border ${
                active
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-[0_8px_20px_rgba(5,150,105,0.28)] scale-[1.02]'
                  : 'bg-rd-surface text-rd-muted border-rd-border hover:border-emerald-300 hover:text-rd-text'
              }`}
            >
              <span className='relative z-10 flex items-center gap-2'>
                <span
                  className={`text-[10px] font-black tracking-wider uppercase opacity-70 ${
                    active ? 'text-emerald-100' : 'text-rd-muted'
                  }`}
                >
                  {p.short}
                </span>
                {p.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Insight tiles */}
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4'>
        <DeskCard className='p-4 flex items-start gap-3'>
          <div className='w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'
              />
            </svg>
          </div>
          <div className='min-w-0'>
            <p className='text-[11px] font-medium text-rd-muted'>Peak bucket</p>
            <p className='text-lg font-bold text-rd-text truncate'>{insights.peakLabel}</p>
            <p className='text-xs font-semibold text-emerald-600 tabular-nums'>
              ₹ {fmtInr(insights.peakValue)}
            </p>
          </div>
        </DeskCard>

        <DeskCard className='p-4 flex items-start gap-3'>
          <div className='w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'
              />
            </svg>
          </div>
          <div className='min-w-0'>
            <p className='text-[11px] font-medium text-rd-muted'>Avg / active period</p>
            <p className='text-lg font-bold text-rd-text tabular-nums'>₹ {fmtInr(insights.avg)}</p>
            <p className='text-xs text-rd-muted'>
              {insights.active} of {insights.buckets} slots earned
            </p>
          </div>
        </DeskCard>

        <DeskCard className='p-4 flex items-start gap-3'>
          <div className='w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0'>
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
          </div>
          <div className='min-w-0'>
            <p className='text-[11px] font-medium text-rd-muted'>Window total</p>
            <p className='text-lg font-bold text-rd-text tabular-nums'>₹ {fmtInr(insights.total)}</p>
            <p className='text-xs text-rd-muted'>{periodMeta?.label} gross</p>
          </div>
        </DeskCard>
      </div>

      {/* Chart */}
      <DeskCard className='p-4 sm:p-6'>
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4'>
          <div className='flex items-center gap-2'>
            <span className='w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]' />
            <h3 className='text-xs font-bold text-rd-muted uppercase tracking-[0.16em]'>
              Revenue distribution
            </h3>
          </div>
          <p className='text-[11px] text-rd-muted font-medium'>
            {useBars ? 'Bar view for calendar buckets' : 'Trend view for continuous windows'}
          </p>
        </div>

        <div className='h-[280px] sm:h-[320px] w-full rounded-2xl bg-gradient-to-b from-slate-50/80 to-transparent px-1 py-2'>
          {useBars ? (
            <BarChart
              key={`bar-${selectedOption}`}
              data={currentChartData}
              title='Revenue'
              color='#059669'
            />
          ) : (
            <LineChart
              key={`line-${selectedOption}`}
              data={currentChartData}
              title='Revenue Trend'
              color='#059669'
            />
          )}
        </div>
      </DeskCard>
    </DeskPage>
  )
}

export default RevenueAnalytics
