import { useState, useEffect } from 'react'

const PACS_COLORS = {
  'P1+': '#dc2626',
  'P1':  '#ea580c',
  'P2':  '#ca8a04',
  'P3':  '#16a34a',
  'P4':  '#64748b',
}

function PacsBadge({ pacs }) {
  const color = PACS_COLORS[pacs] ?? '#475569'
  return (
    <span style={{
      background: color,
      color: '#fff',
      fontSize: '10px',
      fontWeight: 700,
      padding: '2px 5px',
      borderRadius: '3px',
      letterSpacing: '0.05em',
      minWidth: '32px',
      textAlign: 'center',
      display: 'inline-block',
      flexShrink: 0,
    }}>
      {pacs ?? '—'}
    </span>
  )
}

function StatusDot({ status }) {
  if (status === 'ringing') {
    return (
      <>
        <style>{`@keyframes amberPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: '#f59e0b', display: 'inline-block', flexShrink: 0,
          animation: 'amberPulse 0.8s ease-in-out infinite',
        }} />
      </>
    )
  }
  if (status === 'active') {
    return (
      <>
        <style>{`@keyframes greenPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }`}</style>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: '#22c55e', display: 'inline-block', flexShrink: 0,
          animation: 'greenPulse 1.4s ease-in-out infinite',
        }} />
      </>
    )
  }
  if (status === 'smart_hold') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: '#3b82f6', display: 'inline-block', flexShrink: 0,
        }} />
        <span style={{ fontSize: '9px', color: '#3b82f6', fontWeight: 700, letterSpacing: '0.05em' }}>AI</span>
      </span>
    )
  }
  // ended / unknown
  return (
    <span style={{
      width: '8px', height: '8px', borderRadius: '50%',
      background: '#334155', display: 'inline-block', flexShrink: 0,
    }} />
  )
}

function CallDuration({ startedAt, answeredAt, status }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (status === 'ended' || status === 'ringing') return
    const ref = answeredAt || startedAt
    const tick = () => setElapsed(Math.floor(Date.now() / 1000 - ref))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt, answeredAt, status])

  if (status === 'ringing') return <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 600 }}>Ringing</span>
  if (status === 'ended') return null

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  return (
    <span style={{ fontSize: '10px', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
      {mm}:{ss}
    </span>
  )
}

function CallRow({ call, isSelected, onSelect }) {
  const label = call.patient?.name || call.call_id?.slice(-8) || '—'
  const isEnded = call.status === 'ended'

  return (
    <div
      onClick={() => onSelect && onSelect(call.call_id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '9px 14px',
        cursor: 'pointer',
        borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
        background: isSelected ? '#263348' : 'transparent',
        opacity: isEnded ? 0.55 : 1,
        transition: 'background 0.15s',
        userSelect: 'none',
      }}
    >
      <PacsBadge pacs={call.pacs} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '12px',
          color: isEnded ? '#64748b' : '#cbd5e1',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: call.patient?.name ? 'system-ui, sans-serif' : "'Courier New', monospace",
        }}>
          {label}
        </div>
        <CallDuration
          startedAt={call.startedAt}
          answeredAt={call.answeredAt}
          status={call.status}
        />
      </div>
      <StatusDot status={call.status} />
    </div>
  )
}

function SectionHeader({ title }) {
  return (
    <div style={{
      padding: '10px 14px 6px',
      borderBottom: '1px solid #0f172a',
    }}>
      <span style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#475569',
      }}>
        {title}
      </span>
    </div>
  )
}

export default function CallQueue({ activeCalls = [], pastCalls = [], selectedCallId, onSelect }) {
  return (
    <div style={{
      width: '220px',
      minWidth: '220px',
      background: '#1e293b',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #0f172a',
      overflow: 'hidden',
    }}>
      <SectionHeader title="Active Calls" />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeCalls.length === 0 ? (
          <div style={{ padding: '12px 14px', color: '#475569', fontSize: '12px' }}>No active calls</div>
        ) : (
          activeCalls.map(call => (
            <CallRow
              key={call.call_id}
              call={call}
              isSelected={call.call_id === selectedCallId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      {pastCalls.length > 0 && (
        <>
          <SectionHeader title="Past Calls" />
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {pastCalls.map(call => (
              <CallRow
                key={call.call_id}
                call={call}
                isSelected={call.call_id === selectedCallId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
