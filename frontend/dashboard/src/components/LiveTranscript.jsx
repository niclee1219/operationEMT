import { useEffect, useRef } from 'react'

export default function LiveTranscript({ transcript = '' }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript])

  return (
    <div>
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: '#64748b',
        fontFamily: "'Courier New', monospace",
        marginBottom: '6px',
      }}>
        Live Transcript
      </div>
      <div
        ref={scrollRef}
        style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '6px',
          padding: '12px',
          maxHeight: '200px',
          overflowY: 'auto',
          fontFamily: "'Courier New', monospace",
          fontSize: '13px',
          color: '#cbd5e1',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {transcript || <span style={{ color: '#475569' }}>Awaiting transcript…</span>}
      </div>
    </div>
  )
}
