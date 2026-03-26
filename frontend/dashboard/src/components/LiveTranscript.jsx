import { useEffect, useRef } from 'react'

function formatTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleTimeString('en-SG', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

export default function LiveTranscript({ messages = [], pendingText = '' }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, pendingText])

  const isEmpty = messages.length === 0 && !pendingText

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
          padding: '10px 12px',
          maxHeight: '240px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {isEmpty ? (
          <span style={{ color: '#475569', fontFamily: "'Courier New', monospace", fontSize: '13px' }}>
            Awaiting transcript…
          </span>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{
                  background: '#1e293b',
                  borderRadius: '4px 12px 12px 12px',
                  padding: '7px 12px',
                  fontSize: '13px',
                  color: '#e2e8f0',
                  lineHeight: '1.5',
                  maxWidth: '90%',
                  wordBreak: 'break-word',
                }}>
                  {msg.text}
                </div>
                <span style={{ fontSize: '10px', color: '#475569', marginTop: '2px', paddingLeft: '4px' }}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            ))}
            {pendingText && (
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{
                  background: '#0f172a',
                  border: '1px dashed #334155',
                  borderRadius: '4px 12px 12px 12px',
                  padding: '7px 12px',
                  fontSize: '13px',
                  color: '#475569',
                  fontStyle: 'italic',
                  maxWidth: '90%',
                  wordBreak: 'break-word',
                }}>
                  {pendingText}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
